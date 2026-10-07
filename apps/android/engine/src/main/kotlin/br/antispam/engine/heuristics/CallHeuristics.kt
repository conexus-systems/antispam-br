package br.antispam.engine.heuristics

import br.antispam.engine.CallContext
import br.antispam.engine.Reason
import br.antispam.engine.Stage
import br.antispam.engine.Verification
import br.antispam.engine.phone.NormalizedNumber
import br.antispam.engine.phone.NumberKind

/**
 * Sinais locais sem base de dados. Pesos deliberadamente baixos: heurística sozinha nunca
 * chega a BLOCK porque o engine exige evidência forte para bloquear (ADR 0005).
 */
object HeuristicWeights {
    const val TELEMARKETING_PREFIX = 40
    const val VERIFICATION_FAILED = 45
    const val VERIFICATION_PASSED = -10
    const val INVALID_FORMAT = 25
    const val HIDDEN = 15
    const val INTERNATIONAL = 15
    const val PREMIUM = 20
    const val CAMPAIGN_BURST = 30
}

class CallHeuristics(private val burst: CampaignBurstDetector = CampaignBurstDetector()) {

    fun evaluate(ctx: CallContext, number: NormalizedNumber): List<Reason> = buildList {
        when (number.kind) {
            NumberKind.TELEMARKETING -> add(r(HeuristicWeights.TELEMARKETING_PREFIX, "PREFIX_0303", "Prefixo 0303: chamador de alto volume (telemarketing, cobrança ou doações)"))
            NumberKind.PREMIUM -> add(r(HeuristicWeights.PREMIUM, "PREMIUM", "Número 0900 (tarifado)"))
            NumberKind.INVALID -> add(r(HeuristicWeights.INVALID_FORMAT, "INVALID_FORMAT", "Formato de número não usado no Brasil (possível spoofing)"))
            NumberKind.HIDDEN -> add(r(HeuristicWeights.HIDDEN, "HIDDEN", "Número oculto"))
            NumberKind.INTERNATIONAL -> add(r(HeuristicWeights.INTERNATIONAL, "INTERNATIONAL", "Chamada internacional"))
            else -> Unit
        }
        when (ctx.verification) {
            Verification.FAILED -> add(r(HeuristicWeights.VERIFICATION_FAILED, "VERIFICATION_FAILED", "Operadora indicou falha na verificação de origem (STIR/SHAKEN)"))
            Verification.PASSED -> add(r(HeuristicWeights.VERIFICATION_PASSED, "VERIFICATION_PASSED", "Origem verificada pela operadora"))
            Verification.NOT_VERIFIED -> Unit
        }
        if (burst.record(number, ctx.timestampMillis)) {
            add(r(HeuristicWeights.CAMPAIGN_BURST, "CAMPAIGN_BURST", "Vários números parecidos ligaram em poucos minutos (campanha)"))
        }
    }

    private fun r(points: Int, code: String, message: String) = Reason(Stage.HEURISTICS, points, code, message)
}

/**
 * Detecta campanhas: ≥ [threshold] números distintos com o mesmo prefixo (E.164 sem os últimos
 * [suffixDigits] dígitos) dentro de [windowMillis]. Memória limitada a [capacity] eventos.
 */
class CampaignBurstDetector(
    private val windowMillis: Long = 10 * 60_000L,
    private val threshold: Int = 3,
    private val suffixDigits: Int = 4,
    private val capacity: Int = 64,
) {
    private val events = ArrayDeque<Pair<String, Long>>()

    @Synchronized
    fun record(number: NormalizedNumber, at: Long): Boolean {
        val e164 = number.e164 ?: return false
        if (e164.length <= suffixDigits + 6) return false
        while (events.isNotEmpty() && at - events.first().second > windowMillis) events.removeFirst()
        events.addLast(e164 to at)
        while (events.size > capacity) events.removeFirst()
        val prefix = e164.dropLast(suffixDigits)
        return events.filter { it.first.startsWith(prefix) }.map { it.first }.distinct().size >= threshold
    }
}
