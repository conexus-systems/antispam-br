package br.antispam.app.screening

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.Connection
import android.telecom.TelecomManager
import br.antispam.app.AntiSpamApplication
import br.antispam.engine.Action
import br.antispam.engine.Decision
import br.antispam.engine.Verification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Ponto de entrada do sistema para ligações recebidas (papel ROLE_CALL_SCREENING, API 29+).
 * Responde exatamente uma vez; qualquer falha resulta em ALLOW.
 */
class AntiSpamCallScreeningService : CallScreeningService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onScreenCall(details: Call.Details) {
        if (details.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, CallResponse.Builder().build())
            return
        }
        val responded = AtomicBoolean(false)
        fun respond(response: CallResponse): Boolean {
            if (!responded.compareAndSet(false, true)) return false
            runCatching { respondToCall(details, response) }
            return true
        }

        val raw = if (details.handlePresentation == TelecomManager.PRESENTATION_ALLOWED) details.handle?.schemeSpecificPart else null
        val verification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            when (details.callerNumberVerificationStatus) {
                Connection.VERIFICATION_STATUS_PASSED -> Verification.PASSED
                Connection.VERIFICATION_STATUS_FAILED -> Verification.FAILED
                else -> Verification.NOT_VERIFIED
            }
        } else Verification.NOT_VERIFIED

        val coordinator = (application as AntiSpamApplication).container.screening
        // withTimeout não interrompe CPU puro (ex.: regex patológica): o cão de guarda garante a resposta.
        val watchdog = scope.launch {
            delay(ScreeningCoordinator.BUDGET_MILLIS + WATCHDOG_MARGIN_MILLIS)
            respond(CallResponse.Builder().build())
        }
        scope.launch(decisionDispatcher) {
            val decision = runCatching { coordinator.screen(raw, verification) }.getOrNull()
            if (decision == null) {
                respond(CallResponse.Builder().build())
                watchdog.cancel()
                return@launch
            }
            if (respond(decision.toResponse())) coordinator.record(decision)
            watchdog.cancel()
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun Decision.toResponse(): CallResponse = CallResponse.Builder().apply {
        when (action) {
            Action.ALLOW, Action.WARN -> Unit
            Action.SILENCE -> setSilenceCall(true)
            Action.BLOCK -> {
                setDisallowCall(true)
                setRejectCall(true)
                // Mantém no registro de chamadas: o usuário precisa ver e poder reverter.
                setSkipCallLog(false)
                setSkipNotification(true)
            }
        }
    }.build()

    private companion object {
        const val WATCHDOG_MARGIN_MILLIS = 300L

        /** Thread dedicada: uma decisão travada não ocupa o pool Default nem bloqueia o cão de guarda. */
        val decisionDispatcher = Executors.newFixedThreadPool(2) { r ->
            Thread(r, "antispam-decision").apply { isDaemon = true }
        }.asCoroutineDispatcher()
    }
}
