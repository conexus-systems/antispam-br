package br.antispam.engine

import br.antispam.engine.dataset.DatasetRecord
import br.antispam.engine.heuristics.CallHeuristics
import br.antispam.engine.phone.NormalizedNumber
import br.antispam.engine.phone.NumberKind
import br.antispam.engine.phone.PhoneNormalizer
import br.antispam.engine.rules.RuleSet

fun interface ReputationSource {
    fun lookup(number: NormalizedNumber): DatasetRecord?
}

/** Denúncias feitas pelo próprio usuário neste aparelho (última categoria por número). */
fun interface LocalReportSource {
    fun lastCategory(e164: String): Category?
}

/** Reputação comunitária obtida antes (consulta opcional por hash-prefix), nunca durante a chamada. */
data class CommunityScore(val score: Int, val category: Category, val weightedReporters: Double)

fun interface CommunityCache {
    fun lookup(e164: String): CommunityScore?
}

/** Modelo local (M7). Deve ser rápido e determinístico; retorno limitado a [MAX_MODEL_POINTS]. */
fun interface RiskModel {
    fun points(number: NormalizedNumber, ctx: CallContext): Int?
}

const val MAX_MODEL_POINTS = 20
const val MIN_REPORTERS_FOR_STRONG_EVIDENCE = 3

/** Snapshot imutável de tudo que é configuração do usuário. */
data class UserState(
    val settings: EngineSettings = EngineSettings(),
    val rules: RuleSet = RuleSet.EMPTY,
)

/**
 * Pipeline de decisão on-device (ADR 0005). Sem I/O de rede; leituras de dataset são mmap.
 * Nunca lança: erros viram ALLOW com estágio FAIL_SAFE.
 */
class SpamEngine(
    private val reputation: ReputationSource = ReputationSource { null },
    private val localReports: LocalReportSource = LocalReportSource { null },
    private val community: CommunityCache = CommunityCache { null },
    private val model: RiskModel? = null,
    private val heuristics: CallHeuristics = CallHeuristics(),
) {
    fun decide(ctx: CallContext, state: UserState): Decision {
        val start = System.nanoTime()
        val number = runCatching { PhoneNormalizer.normalize(ctx.rawNumber, state.settings.userDdd) }
            .getOrElse { return failSafe(ctx, start, it) }
        return try {
            decideNormalized(ctx, number, state).copy(elapsedNanos = System.nanoTime() - start)
        } catch (e: Throwable) {
            failSafe(ctx, start, e, number)
        }
    }

    private fun decideNormalized(ctx: CallContext, number: NormalizedNumber, state: UserState): Decision {
        val settings = state.settings

        if (number.kind == NumberKind.EMERGENCY) {
            return hard(Action.ALLOW, Stage.EMERGENCY, number, "EMERGENCY", "Número de emergência/utilidade pública — nunca bloqueado")
        }
        if (ctx.inContacts) {
            return hard(Action.ALLOW, Stage.CONTACT, number, "CONTACT", "Contato salvo no aparelho")
        }

        state.rules.match(number)?.let { rule ->
            val stage = if (rule.action == Action.ALLOW) Stage.ALLOWLIST else Stage.USER_RULE
            val label = rule.label?.let { " ($it)" } ?: ""
            return hard(rule.action, stage, number, "RULE_${rule.type}", "Regra sua: ${rule.type.name.lowercase()} ${rule.pattern}$label")
        }

        when (number.kind) {
            NumberKind.HIDDEN -> settings.hiddenAction?.let {
                return hard(it, Stage.USER_POLICY, number, "POLICY_HIDDEN", "Sua configuração para números ocultos")
            }
            NumberKind.INTERNATIONAL -> settings.internationalAction?.let {
                return hard(it, Stage.USER_POLICY, number, "POLICY_INTERNATIONAL", "Sua configuração para chamadas internacionais")
            }
            else -> Unit
        }

        number.e164?.let { localReports.lastCategory(it) }?.let { category ->
            return if (category == Category.LEGITIMATE) {
                hard(Action.ALLOW, Stage.USER_REPORT, number, "USER_LEGITIMATE", "Você marcou este número como legítimo")
            } else {
                hard(Action.BLOCK, Stage.USER_REPORT, number, "USER_REPORTED", "Você denunciou este número como ${category.name}", category)
            }
        }

        val thresholds = settings.thresholds
        val reasons = mutableListOf<Reason>()
        var strongEvidence = false
        var capAtWarn = false
        var category: Category? = null

        reputation.lookup(number)?.let { rec ->
            category = rec.category
            reasons += Reason(Stage.REPUTATION, rec.score, "DATASET", describe(rec))
            strongEvidence = rec.score >= thresholds.block && rec.reporters >= MIN_REPORTERS_FOR_STRONG_EVIDENCE &&
                !rec.isDisputed && !rec.isVerifiedOrg
            capAtWarn = rec.isDisputed || rec.isVerifiedOrg
        }

        reasons += heuristics.evaluate(ctx, number)

        if (reasons.none { it.stage == Stage.REPUTATION }) {
            number.e164?.let { community.lookup(it) }?.let { c ->
                val pts = (c.score * 0.6).toInt().coerceAtMost(thresholds.block - 1)
                if (pts > 0) {
                    category = category ?: c.category
                    reasons += Reason(Stage.COMMUNITY, pts, "COMMUNITY", "Comunidade: ${c.category.name}, score ${c.score} (consulta prévia)")
                }
            }
        }

        model?.points(number, ctx)?.coerceIn(-MAX_MODEL_POINTS, MAX_MODEL_POINTS)?.takeIf { it != 0 }?.let {
            reasons += Reason(Stage.MODEL, it, "MODEL", "Modelo local")
        }

        val score = reasons.sumOf { it.points }.coerceIn(0, 100)
        var action = thresholds.actionFor(score)
        if (action == Action.BLOCK && !strongEvidence) action = Action.SILENCE
        if (capAtWarn) action = action.atMost(Action.WARN)

        val top = reasons.filter { it.points > 0 }.maxByOrNull { it.points }
        val stage = if (score == 0 || top == null) Stage.DEFAULT else top.stage
        return Decision(action, score, stage, reasons.sortedByDescending { it.points }, number, category)
    }

    private fun describe(rec: DatasetRecord): String = buildString {
        append("Base comunitária: denunciado como ${rec.category.name}, score ${rec.score}, ${rec.reporters} denunciantes")
        if (rec.isCampaign) append(", parte de campanha ativa")
        if (rec.isDisputed) append(" — classificação contestada")
        if (rec.isVerifiedOrg) append(" — organização verificada (só aviso)")
    }

    private fun hard(action: Action, stage: Stage, number: NormalizedNumber, code: String, message: String, category: Category? = null) =
        Decision(action, if (action == Action.ALLOW) 0 else 100, stage, listOf(Reason(stage, 0, code, message)), number, category)

    private fun failSafe(ctx: CallContext, start: Long, e: Throwable, number: NormalizedNumber? = null): Decision {
        val n = number ?: br.antispam.engine.phone.NormalizedNumber(ctx.rawNumber ?: "", NumberKind.INVALID, null, null, null)
        return Decision(
            Action.ALLOW, 0, Stage.FAIL_SAFE,
            listOf(Reason(Stage.FAIL_SAFE, 0, "FAIL_SAFE", "Erro interno (${e.javaClass.simpleName}) — chamada liberada por segurança")),
            n, elapsedNanos = System.nanoTime() - start,
        )
    }
}
