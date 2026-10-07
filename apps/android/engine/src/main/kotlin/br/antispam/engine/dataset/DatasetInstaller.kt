package br.antispam.engine.dataset

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.channels.FileChannel
import java.time.Instant

/** Busca bytes relativos à raiz do dataset publicado ("manifest.json", "brazil/55-11.bin.gz"…). */
fun interface DatasetFetcher {
    fun fetch(path: String, maxBytes: Long): ByteArray
}

@Serializable
data class InstalledState(val version: Long, val shards: Map<String, Long>)

sealed interface UpdateResult {
    data object UpToDate : UpdateResult
    data class Installed(val version: Long, val viaDelta: List<String>, val viaFull: List<String>, val unchanged: List<String>) : UpdateResult
    data class Rejected(val reason: VerifyFailure) : UpdateResult
    data class Failed(val message: String) : UpdateResult
}

/**
 * Instala datasets de forma atômica:
 *   root/current          → nome do diretório ativo (troca via rename)
 *   root/v<versão>/       → state.json + <shard>.bin (descomprimido, pronto para mmap)
 * Qualquer falha de verificação mantém a versão anterior intacta.
 */
class DatasetInstaller(
    private val root: File,
    private val verifier: ManifestVerifier,
    private val fetcher: DatasetFetcher,
    private val clock: () -> Instant = Instant::now,
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun currentDir(): File? {
        val pointer = File(root, CURRENT)
        if (!pointer.isFile) return null
        val name = pointer.readText().trim()
        if (!name.matches(Regex("^v\\d+$"))) return null
        return File(root, name).takeIf { it.isDirectory }
    }

    fun installedState(): InstalledState? = currentDir()?.let { dir ->
        runCatching { json.decodeFromString(InstalledState.serializer(), File(dir, STATE).readText()) }.getOrNull()
    }

    @Synchronized
    fun update(): UpdateResult {
        val state = installedState()
        val manifestBytes: ByteArray
        val signature: String
        try {
            manifestBytes = fetcher.fetch("manifest.json", MAX_MANIFEST_BYTES)
            signature = fetcher.fetch("manifest.json.sig", 1024).decodeToString()
        } catch (e: Exception) {
            return UpdateResult.Failed("falha ao baixar manifest: ${e.message}")
        }
        val manifest = when (val r = verifier.verify(manifestBytes, signature, installedVersion = null, now = clock())) {
            is VerifyResult.Failed -> return UpdateResult.Rejected(r.reason)
            is VerifyResult.Ok -> r.manifest
        }
        if (state != null) {
            if (manifest.version == state.version) return UpdateResult.UpToDate
            if (manifest.version < state.version) return UpdateResult.Rejected(VerifyFailure.ROLLBACK)
        }
        // Igual é permitido: reinstalar a mesma versão se o estado local se perdeu.
        if (manifest.version < highWater()) return UpdateResult.Rejected(VerifyFailure.ROLLBACK)

        root.mkdirs()
        val current = currentDir()
        removeOrphans(keep = current)
        val staging = File(root, "staging-${manifest.version}")
        staging.mkdirs()
        val viaDelta = mutableListOf<String>()
        val viaFull = mutableListOf<String>()
        val unchanged = mutableListOf<String>()

        try {
            for (entry in manifest.shards) {
                require(entry.id.matches(Regex("^[a-z0-9-]{2,16}$"))) { "id de shard inválido" }
                val target = File(staging, "${entry.id}.bin")
                val installedShardVersion = state?.shards?.get(entry.id)
                val currentFile = current?.let { File(it, "${entry.id}.bin") }?.takeIf { it.isFile }

                if (installedShardVersion == entry.version && currentFile != null) {
                    currentFile.copyTo(target)
                    unchanged += entry.id
                    continue
                }
                val delta = manifest.deltas.firstOrNull {
                    it.shard == entry.id && it.fromVersion == installedShardVersion && it.toVersion == entry.version
                }
                val deltaBytes = if (delta != null && currentFile != null) runCatching {
                    val d = download(delta.path, delta.size, delta.sha256, delta.recordCount)
                    val reader = ShardReader(java.nio.ByteBuffer.wrap(d))
                    require(reader.kind == ShardFormat.KIND_DELTA && reader.version == entry.version) { "delta inconsistente" }
                    val merged = ShardCodec.applyDelta(mmap(currentFile), reader)
                    require(ShardReader(java.nio.ByteBuffer.wrap(merged)).count == entry.recordCount) { "delta gerou contagem divergente" }
                    merged
                }.getOrNull() else null

                if (deltaBytes != null) {
                    writeSynced(target, deltaBytes)
                    viaDelta += entry.id
                } else {
                    val full = download(entry.path, entry.size, entry.sha256, entry.recordCount)
                    val reader = ShardReader(java.nio.ByteBuffer.wrap(full))
                    require(reader.kind == ShardFormat.KIND_FULL && reader.version == entry.version) { "shard inconsistente" }
                    writeSynced(target, full)
                    viaFull += entry.id
                }
            }
            val newState = InstalledState(manifest.version, manifest.shards.associate { it.id to it.version })
            writeSynced(File(staging, STATE), json.encodeToString(InstalledState.serializer(), newState).encodeToByteArray())

            val finalDir = File(root, "v${manifest.version}")
            if (finalDir.name == current?.name) {
                // Reinstalação da versão ativa: troca o conteúdo sem apagar o diretório em uso.
                staging.listFiles()?.forEach { f ->
                    if (!f.renameTo(File(finalDir, f.name))) throw IllegalStateException("rename de ${f.name} falhou")
                }
                staging.deleteRecursively()
            } else {
                finalDir.deleteRecursively()
                if (!staging.renameTo(finalDir)) throw IllegalStateException("rename do staging falhou")
            }
            val tmp = File(root, "$CURRENT.tmp")
            writeSynced(tmp, finalDir.name.encodeToByteArray())
            if (!tmp.renameTo(File(root, CURRENT))) throw IllegalStateException("rename do ponteiro falhou")
            runCatching { raiseHighWater(manifest.version) }
            current?.takeIf { it.name != finalDir.name }?.deleteRecursively()
        } catch (e: Throwable) {
            staging.deleteRecursively()
            return UpdateResult.Failed(e.message ?: e.javaClass.simpleName)
        }
        return UpdateResult.Installed(manifest.version, viaDelta, viaFull, unchanged)
    }

    /** Maior versão já instalada; só cresce. Protege o anti-rollback se state.json se perder. */
    fun highWater(): Long = File(root, HIGH_WATER).takeIf { it.isFile }
        ?.let { runCatching { it.readText().trim().toLong() }.getOrNull() } ?: 0L

    private fun raiseHighWater(version: Long) {
        if (version <= highWater()) return
        val tmp = File(root, "$HIGH_WATER.tmp")
        writeSynced(tmp, version.toString().encodeToByteArray())
        if (!tmp.renameTo(File(root, HIGH_WATER))) throw IllegalStateException("rename do highwater falhou")
    }

    /** Restos de uma instalação interrompida (queda de energia, processo morto). */
    private fun removeOrphans(keep: File?) {
        root.listFiles()?.forEach { f ->
            val orphan = f.isDirectory && f.name != keep?.name &&
                (f.name.startsWith("staging-") || f.name.matches(Regex("^v\\d+$")))
            if (orphan) f.deleteRecursively()
        }
    }

    private fun writeSynced(file: File, bytes: ByteArray) {
        FileOutputStream(file).use { out ->
            out.write(bytes)
            out.fd.sync()
        }
    }

    private fun download(path: String, size: Long, sha256: String, recordCount: Int): ByteArray {
        require(recordCount in 0..ShardFormat.MAX_RECORDS) { "record_count fora do limite em $path" }
        require(size in 1..MAX_SHARD_GZ_BYTES) { "tamanho fora do limite em $path" }
        val gz = fetcher.fetch(path, size)
        require(gz.size.toLong() == size) { "tamanho divergente em $path" }
        require(ManifestVerifier.sha256Hex(gz) == sha256.lowercase()) { "sha256 divergente em $path" }
        val expected = ShardFormat.HEADER_SIZE + ShardFormat.RECORD_SIZE.toLong() * recordCount
        val raw = ShardCodec.gunzip(ByteArrayInputStream(gz), expected)
        require(raw.size.toLong() == expected) { "record_count divergente em $path" }
        return raw
    }

    companion object {
        const val CURRENT = "current"
        const val STATE = "state.json"
        const val HIGH_WATER = "highwater"
        const val MAX_MANIFEST_BYTES = 1L shl 20
        const val MAX_SHARD_GZ_BYTES = 128L shl 20

        fun mmap(file: File): ShardReader = RandomAccessFile(file, "r").use { raf ->
            ShardReader(raf.channel.map(FileChannel.MapMode.READ_ONLY, 0, raf.length()), validateOrder = false)
        }
    }
}
