package br.antispam.engine

import br.antispam.engine.dataset.DatasetInstaller
import br.antispam.engine.dataset.InstalledDataset
import br.antispam.engine.dataset.ManifestVerifier
import br.antispam.engine.dataset.UpdateResult
import br.antispam.engine.dataset.VerifyFailure
import br.antispam.engine.dataset.VerifyResult
import br.antispam.engine.phone.PhoneNormalizer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.time.Instant
import java.util.Base64
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DatasetVectorTest {
    @TempDir lateinit var tmp: File

    private val vectors = Vectors.json("datasets/vectors.json")
    private val keys = vectors["trusted_keys"]!!.jsonObject.mapValues { Base64.getDecoder().decode(it.value.jsonPrimitive.content) }
    private val now = Instant.parse(vectors["now"]!!.jsonPrimitive.content)
    private val ds = File(Vectors.dir, "datasets")
    private val verifier = ManifestVerifier(keys, allowTestKeys = true)

    @Test
    fun `manifests válidos e rollback`() {
        for (v in vectors["valid"]!!.jsonArray.map { it.jsonObject }) {
            val dir = File(ds, v["dir"]!!.jsonPrimitive.content)
            val installed = v["installed_version"]!!.takeIf { it != JsonNull }?.jsonPrimitive?.long
            val r = verifier.verify(File(dir, "manifest.json").readBytes(), File(dir, "manifest.json.sig").readText(), installed, now)
            val got = if (r is VerifyResult.Failed) r.reason.name else "OK"
            assertEquals(v["expect"]!!.jsonPrimitive.content, got, "${dir.name} installed=$installed")
        }
    }

    @Test
    fun `manifests adulterados são recusados`() {
        for (v in vectors["invalid"]!!.jsonArray.map { it.jsonObject }) {
            val base = File(ds, v["file"]!!.jsonPrimitive.content).path
            val r = verifier.verify(File("$base.manifest.json").readBytes(), File("$base.manifest.json.sig").readText(), null, now)
            assertEquals(v["expect"]!!.jsonPrimitive.content, (r as? VerifyResult.Failed)?.reason?.name ?: "OK", base)
        }
    }

    @Test
    fun `chave de teste é recusada em build release`() {
        val dir = File(ds, "v2")
        val r = ManifestVerifier(keys, allowTestKeys = false)
            .verify(File(dir, "manifest.json").readBytes(), File(dir, "manifest.json.sig").readText(), null, now)
        assertEquals(VerifyFailure.TEST_KEY_REJECTED, (r as VerifyResult.Failed).reason)
    }

    private fun installer(source: () -> File, fetched: MutableList<String> = mutableListOf()) = DatasetInstaller(
        root = File(tmp, "ds"),
        verifier = verifier,
        fetcher = { path, _ -> fetched += path; File(source(), path).readBytes() },
        clock = { now },
    )

    @Test
    fun `instala v1 completo, depois v2 via delta, e lookups conferem`() {
        var source = File(ds, "v1")
        val fetched = mutableListOf<String>()
        val inst = installer({ source }, fetched)

        val first = inst.update()
        assertIs<UpdateResult.Installed>(first)
        assertEquals(listOf("55-11", "55-21", "55-ng"), first.viaFull.sorted())
        assertEquals(UpdateResult.UpToDate, inst.update())

        source = File(ds, "v2")
        fetched.clear()
        val second = inst.update()
        assertIs<UpdateResult.Installed>(second)
        assertEquals(2026100700, second.version)
        assertEquals(listOf("55-11", "55-21", "55-ng"), second.viaDelta.sorted())
        assertTrue(fetched.none { it.startsWith("brazil/55-") }, "não deveria baixar shards completos: $fetched")

        val dataset = InstalledDataset(inst)
        for (l in vectors["lookups_after_v2"]!!.jsonArray.map { it.jsonObject }) {
            val n = PhoneNormalizer.normalize("+" + l["number"]!!.jsonPrimitive.content)
            val rec = dataset.lookup(n)
            if (l["found"]!!.jsonPrimitive.boolean) {
                assertNotNull(rec, n.e164)
                assertEquals(l["score"]!!.jsonPrimitive.int, rec.score)
                assertEquals(l["category"]!!.jsonPrimitive.content, rec.category.name)
                assertEquals(l["flags"]!!.jsonPrimitive.int, rec.flags)
            } else {
                assertNull(rec, n.e164)
            }
        }

        source = File(ds, "v1")
        assertEquals(UpdateResult.Rejected(VerifyFailure.ROLLBACK), inst.update())
        assertEquals(2026100700, inst.installedState()?.version)
    }

    @Test
    fun `shard corrompido mantém a versão anterior`() {
        val inst = installer({ File(ds, "v1") })
        assertIs<UpdateResult.Installed>(inst.update())

        val corrupt = File(tmp, "corrupt").apply { File(ds, "v2").copyRecursively(this) }
        File(corrupt, "brazil/deltas").deleteRecursively()
        File(corrupt, "brazil/55-11.bin.gz").writeBytes(ByteArray(10))
        val bad = installer({ corrupt })
        assertIs<UpdateResult.Failed>(bad.update())
        assertEquals(2026100600, bad.installedState()?.version)
        assertNotNull(InstalledDataset(bad).lookup(PhoneNormalizer.normalize("+5511900000002")))
    }

    @Test
    fun `anti-rollback sobrevive a estado local corrompido`() {
        var source = File(ds, "v2")
        val inst = installer({ source })
        assertIs<UpdateResult.Installed>(inst.update())
        val root = File(tmp, "ds")
        File(root, DatasetInstaller.CURRENT).writeText("")
        assertNull(inst.installedState())

        source = File(ds, "v1")
        assertEquals(UpdateResult.Rejected(VerifyFailure.ROLLBACK), inst.update())

        source = File(ds, "v2")
        assertIs<UpdateResult.Installed>(inst.update(), "reinstalar a mesma versão é permitido")
        assertEquals(2026100700, inst.installedState()?.version)
    }

    @Test
    fun `restos de instalação interrompida são limpos`() {
        val inst = installer({ File(ds, "v1") })
        val root = File(tmp, "ds").apply { mkdirs() }
        File(root, "staging-123/55-11.bin").apply { parentFile.mkdirs(); writeText("lixo") }
        File(root, "v999").mkdirs()
        assertIs<UpdateResult.Installed>(inst.update())
        assertEquals(setOf("v2026100600"), root.listFiles()!!.filter { it.isDirectory }.map { it.name }.toSet())
    }

    @Test
    fun `reload não mistura leitores de versões diferentes`() {
        var source = File(ds, "v1")
        val inst = installer({ source })
        assertIs<UpdateResult.Installed>(inst.update())
        val dataset = InstalledDataset(inst)
        dataset.warmUp()
        source = File(ds, "v2")
        assertIs<UpdateResult.Installed>(inst.update())
        dataset.reload()
        assertEquals(2026100700, dataset.version)
        val l = vectors["lookups_after_v2"]!!.jsonArray.map { it.jsonObject }.first { !it["found"]!!.jsonPrimitive.boolean }
        assertNull(dataset.lookup(PhoneNormalizer.normalize("+" + l["number"]!!.jsonPrimitive.content)))
    }

    @Test
    fun `sem nada instalado e fetch falhando não lança`() {
        val inst = DatasetInstaller(File(tmp, "x"), verifier, { _, _ -> throw java.io.IOException("offline") }, { now })
        assertIs<UpdateResult.Failed>(inst.update())
        assertNull(InstalledDataset(inst).lookup(PhoneNormalizer.normalize("+5511900000001")))
    }
}
