package br.antispam.engine

import br.antispam.engine.dataset.DatasetFormatException
import br.antispam.engine.dataset.DatasetRecord
import br.antispam.engine.dataset.ShardCodec
import br.antispam.engine.dataset.ShardFormat
import br.antispam.engine.dataset.ShardReader
import br.antispam.engine.heuristics.CampaignBurstDetector
import br.antispam.engine.phone.PhoneNormalizer
import br.antispam.engine.rules.RuleSet
import br.antispam.engine.rules.RuleType
import br.antispam.engine.rules.UserRule
import org.junit.jupiter.api.Test
import java.nio.ByteBuffer
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EngineBehaviourTest {

    @Test
    fun `exceção na fonte de reputação vira ALLOW fail-safe`() {
        val engine = SpamEngine(reputation = { throw IllegalStateException("boom") })
        val d = engine.decide(CallContext("+5511900000001"), UserState())
        assertEquals(Action.ALLOW, d.action)
        assertEquals(Stage.FAIL_SAFE, d.stage)
    }

    @Test
    fun `número cru gigante não é oferecido às regex do usuário`() {
        val rules = RuleSet.compile(listOf(UserRule(type = RuleType.REGEX, pattern = "\\d+", action = Action.BLOCK)), null)
        val d = SpamEngine().decide(CallContext("1".repeat(40)), UserState(rules = rules))
        assertEquals(Action.ALLOW, d.action)
        assertTrue(PhoneNormalizer.normalize("1".repeat(40)).matchForms.isEmpty())
    }

    @Test
    fun `heurísticas acumuladas nunca bloqueiam sem evidência forte`() {
        val engine = SpamEngine()
        val now = 1_000_000L
        val numbers = listOf("+5511912340001", "+5511912340002", "+5511912340003")
        val decisions = numbers.map {
            engine.decide(CallContext(it, verification = Verification.FAILED, timestampMillis = now), UserState(EngineSettings(mode = Mode.AGGRESSIVE)))
        }
        val last = decisions.last()
        assertTrue(last.reasons.any { it.code == "CAMPAIGN_BURST" }, last.reasons.toString())
        assertTrue(last.score >= Mode.AGGRESSIVE.thresholds.block)
        assertEquals(Action.SILENCE, last.action)
    }

    @Test
    fun `comunidade sozinha nunca alcança o limiar de bloqueio`() {
        val engine = SpamEngine(community = { CommunityScore(100, Category.BANK_SCAM, 50.0) })
        val d = engine.decide(CallContext("+5511912345678"), UserState())
        assertTrue(d.score < Mode.BALANCED.thresholds.block)
        assertEquals(Stage.COMMUNITY, d.stage)
    }

    @Test
    fun `modelo local é limitado`() {
        val engine = SpamEngine(model = { _, _ -> 999 })
        val d = engine.decide(CallContext("+5511912345678"), UserState())
        assertEquals(MAX_MODEL_POINTS, d.score)
    }

    @Test
    fun `campanha exige números distintos dentro da janela`() {
        val det = CampaignBurstDetector(windowMillis = 1000)
        val n = { s: String -> PhoneNormalizer.normalize(s) }
        assertFalse(det.record(n("+5511912340001"), 0))
        assertFalse(det.record(n("+5511912340001"), 10))
        assertFalse(det.record(n("+5511912340002"), 20))
        assertFalse(det.record(n("+5511912340003"), 5000))
        assertFalse(det.record(n("+5511912340004"), 5100))
        assertTrue(det.record(n("+5511912340005"), 5200))
    }

    @Test
    fun `regras inválidas são recusadas sem derrubar o conjunto`() {
        val rules = RuleSet.compile(listOf(
            UserRule(type = RuleType.REGEX, pattern = "([", action = Action.BLOCK),
            UserRule(type = RuleType.REGEX, pattern = "a".repeat(200), action = Action.BLOCK),
            UserRule(type = RuleType.PREFIX, pattern = "1", action = Action.BLOCK),
            UserRule(type = RuleType.EXACT, pattern = "abc", action = Action.BLOCK),
            UserRule(type = RuleType.PREFIX, pattern = "+5511", action = Action.WARN),
            UserRule(type = RuleType.EXACT, pattern = "+5511999990000", action = Action.BLOCK, enabled = false),
        ))
        assertEquals(4, rules.rejected.size)
        assertEquals(1, rules.size)
        assertEquals(Action.WARN, rules.match(PhoneNormalizer.normalize("+5511999990000"))?.action)
    }

    @Test
    fun `shard rejeita header, tamanho e ordem inválidos`() {
        val rec = { n: Long -> DatasetRecord(n, 90, Category.BANK_SCAM, 90, 0, 10, 100) }
        val ok = ShardCodec.encode(ShardFormat.KIND_FULL, 1, 0, listOf(rec(2), rec(1)))
        assertEquals(1L, ShardReader(ByteBuffer.wrap(ok)).find(1)?.number)

        assertFailsWith<DatasetFormatException> { ShardReader(ByteBuffer.wrap(ok.copyOf(ok.size - 1))) }
        assertFailsWith<DatasetFormatException> { ShardReader(ByteBuffer.wrap(ok.copyOf().also { it[0] = 'X'.code.toByte() })) }
        val swapped = ok.copyOf().also {
            System.arraycopy(ok, 32 + 16, it, 32, 16)
            System.arraycopy(ok, 32, it, 32 + 16, 16)
        }
        assertFailsWith<DatasetFormatException> { ShardReader(ByteBuffer.wrap(swapped)) }
        val tomb = ShardCodec.encode(ShardFormat.KIND_FULL, 1, 0, listOf(rec(1).copy(flags = ShardFormat.FLAG_TOMBSTONE)))
        assertFailsWith<DatasetFormatException> { ShardReader(ByteBuffer.wrap(tomb)) }
    }

    @Test
    fun `decisão com 1 milhão de registros fica bem abaixo do orçamento`() {
        val base = 5511900000000L
        val records = (0 until 1_000_000).map { DatasetRecord(base + it * 7L, 50 + it % 50, Category.TELEMARKETING, 80, 0, 5, 2000) }
        val reader = ShardReader(ByteBuffer.wrap(ShardCodec.encode(ShardFormat.KIND_FULL, 1, 0, records)))
        val engine = SpamEngine(reputation = { n -> n.key?.let(reader::find) })
        val state = UserState()
        repeat(2_000) { engine.decide(CallContext("+55119${(it * 13) % 100000000}".padEnd(14, '0')), state) }
        val times = (0 until 5_000).map { i ->
            val num = "+55" + (base + (i * 7919L % 7_000_000L)).toString().substring(2)
            engine.decide(CallContext(num), state).elapsedNanos
        }.sorted()
        val p95Micros = times[(times.size * 0.95).toInt()] / 1000
        assertTrue(p95Micros < 2_000, "p95 = ${p95Micros}µs")
    }
}
