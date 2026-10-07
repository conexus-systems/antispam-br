package br.antispam.engine

import br.antispam.engine.dataset.DatasetInstaller
import br.antispam.engine.dataset.InstalledDataset
import br.antispam.engine.dataset.ManifestVerifier
import br.antispam.engine.rules.RuleSet
import br.antispam.engine.rules.RuleType
import br.antispam.engine.rules.UserRule
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.time.Instant
import java.util.Base64
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CallDecisionVectorTest {
    @TempDir lateinit var tmp: File

    private fun installedV2(): InstalledDataset {
        val vectors = Vectors.json("datasets/vectors.json")
        val keys = vectors["trusted_keys"]!!.jsonObject.mapValues { Base64.getDecoder().decode(it.value.jsonPrimitive.content) }
        val src = File(Vectors.dir, "datasets/v2")
        val installer = DatasetInstaller(
            root = File(tmp, "ds"),
            verifier = ManifestVerifier(keys, allowTestKeys = true),
            fetcher = { path, _ -> File(src, path).readBytes() },
            clock = { Instant.parse("2026-10-07T12:00:00Z") },
        )
        installer.update()
        return InstalledDataset(installer)
    }

    @TestFactory
    fun vectors(): List<DynamicTest> {
        val doc = Vectors.json("call-decisions.json")
        val defaults = doc["defaults"]!!.jsonObject
        return doc["cases"]!!.jsonArray.map { el ->
            val c = el.jsonObject
            fun field(name: String): JsonElement? = if (c.containsKey(name)) c[name] else defaults[name]
            fun str(name: String): String? = field(name)?.takeIf { it != JsonNull }?.jsonPrimitive?.contentOrNull

            DynamicTest.dynamicTest(c["name"]!!.jsonPrimitive.content) {
                val dataset = installedV2()
                val reports = field("local_reports")!!.jsonArray.associate {
                    it.jsonObject["number"]!!.jsonPrimitive.content to Category.valueOf(it.jsonObject["category"]!!.jsonPrimitive.content)
                }
                val engine = SpamEngine(reputation = dataset, localReports = { reports[it] })
                val settings = EngineSettings(
                    mode = Mode.valueOf(str("mode")!!),
                    userDdd = str("user_ddd"),
                    hiddenAction = str("hidden_action")?.let(Action::valueOf),
                    internationalAction = str("international_action")?.let(Action::valueOf),
                )
                val rules = field("rules")!!.jsonArray.map { r ->
                    val o = r.jsonObject
                    UserRule(type = RuleType.valueOf(o.s("type")), pattern = o.s("pattern"), action = Action.valueOf(o.s("action")))
                }
                val ctx = CallContext(
                    rawNumber = c["number"]!!.jsonPrimitive.content,
                    inContacts = field("in_contacts")!!.jsonPrimitive.content.toBoolean(),
                    verification = Verification.valueOf(str("verification")!!),
                )
                val d = engine.decide(ctx, UserState(settings, RuleSet.compile(rules, settings.userDdd)))
                val expect = c["expect"]!!.jsonObject
                val why = d.reasons.joinToString { "${it.code}:${it.points}" }
                assertEquals(expect.s("action"), d.action.name, "action (score=${d.score}, reasons=$why)")
                assertEquals(expect.s("stage"), d.stage.name, "stage (score=${d.score}, reasons=$why)")
                expect["max_score"]?.jsonPrimitive?.intOrNull?.let { assertTrue(d.score <= it, "score ${d.score} > $it") }
            }
        }
    }

    private fun JsonObject.s(k: String) = this[k]!!.jsonPrimitive.content
}
