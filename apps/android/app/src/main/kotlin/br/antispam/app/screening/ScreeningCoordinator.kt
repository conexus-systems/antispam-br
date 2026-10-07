package br.antispam.app.screening

import br.antispam.app.data.AppSettings
import br.antispam.app.data.CommunityRepository
import br.antispam.app.data.ReputationRepository
import br.antispam.app.data.RulesRepository
import br.antispam.app.data.SettingsRepository
import br.antispam.app.data.db.CallEventDao
import br.antispam.app.data.db.CallEventEntity
import br.antispam.engine.Action
import br.antispam.engine.CallContext
import br.antispam.engine.Decision
import br.antispam.engine.Reason
import br.antispam.engine.SpamEngine
import br.antispam.engine.Stage
import br.antispam.engine.UserState
import br.antispam.engine.Verification
import br.antispam.engine.Category
import br.antispam.engine.phone.NormalizedNumber
import br.antispam.engine.phone.NumberKind
import br.antispam.engine.rules.RuleSet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

data class Snapshot(val state: UserState, val app: AppSettings, val reports: Map<String, Category>)

/**
 * Mantém um snapshot imutável (regras compiladas + configurações + denúncias) atualizado por
 * Flows, para que a decisão durante a chamada seja só memória + mmap.
 */
class ScreeningCoordinator(
    private val scope: CoroutineScope,
    settings: SettingsRepository,
    rules: RulesRepository,
    community: CommunityRepository,
    private val reputation: ReputationRepository,
    private val events: CallEventDao,
    private val notifier: DecisionNotifier,
) {
    private val _snapshot = MutableStateFlow<Snapshot?>(null)
    val snapshot: StateFlow<Snapshot?> = _snapshot

    private val engine = SpamEngine(
        reputation = reputation.dataset,
        localReports = { e164 -> _snapshot.value?.reports?.get(e164) },
    )

    /** Instância separada: consultas manuais não podem alimentar o detector de campanha das ligações reais. */
    private val previewEngine = SpamEngine(
        reputation = reputation.dataset,
        localReports = { e164 -> _snapshot.value?.reports?.get(e164) },
    )

    init {
        scope.launch {
            combine(settings.settings, rules.rules, community.latestByNumber) { s, r, reports ->
                Snapshot(UserState(s.engine, RuleSet.compile(r, s.engine.userDdd)), s, reports)
            }.collect { _snapshot.value = it }
        }
        scope.launch { reputation.dataset.warmUp() }
    }

    /**
     * Decide dentro do orçamento. Se o snapshot ainda não carregou (processo frio) ou algo
     * demorar, devolve ALLOW (fail-open) — nunca segura a chamada.
     */
    suspend fun screen(raw: String?, verification: Verification, budgetMillis: Long = BUDGET_MILLIS): Decision {
        val started = System.nanoTime()
        return withTimeoutOrNull(budgetMillis) {
            val snap = _snapshot.filterNotNull().first()
            engine.decide(CallContext(raw, inContacts = false, verification = verification), snap.state)
        } ?: Decision(
            Action.ALLOW, 0, Stage.FAIL_SAFE,
            listOf(Reason(Stage.FAIL_SAFE, 0, "TIMEOUT", "Tempo de decisão esgotado — chamada liberada por segurança")),
            NormalizedNumber(raw ?: "", NumberKind.INVALID, null, null, null),
            elapsedNanos = System.nanoTime() - started,
        )
    }

    /** Decisão manual (tela "Verificar número"): mesmo pipeline, sem efeitos colaterais. */
    fun preview(raw: String): Decision? = _snapshot.value?.let { previewEngine.decide(CallContext(raw), it.state) }

    fun record(decision: Decision) {
        scope.launch {
            events.insert(
                CallEventEntity(
                    e164 = decision.number.e164,
                    displayNumber = decision.number.e164 ?: decision.number.input.ifBlank { "Número oculto" },
                    action = decision.action.name,
                    score = decision.score,
                    stage = decision.stage.name,
                    category = decision.category?.name,
                    reasons = decision.reasons.joinToString("\n") { it.message },
                    at = System.currentTimeMillis(),
                    elapsedMicros = decision.elapsedNanos / 1000,
                ),
            )
            if (decision.action == Action.WARN && _snapshot.value?.app?.warnNotifications != false) {
                notifier.warn(decision)
            }
        }
    }

    companion object {
        /** Bem abaixo do prazo do sistema para responder à triagem. */
        const val BUDGET_MILLIS = 1_500L
    }
}
