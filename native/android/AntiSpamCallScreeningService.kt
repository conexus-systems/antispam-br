package br.antispam.app.screening

import android.telecom.Call
import android.telecom.CallScreeningService
import android.os.Build
import android.util.Log

/**
 * CallScreeningService de referência (Android 10+).
 *
 * CONTRATO DE SEGURANÇA:
 * - NUNCA responder null nem travar: qualquer exceção → respondComAllow() (fail-safe).
 * - Meta p95 < 100 ms no caminho local (cache/banco local); nuvem nunca decide.
 * - Preservar número/nome para o sistema quando permitido.
 */
class AntiSpamCallScreeningService : CallScreeningService() {

  override fun onScreenCall(call: Call) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return

      val details = call.details
      val number = details.handle?.schemeSpecificPart ?: ""
      val direction = details.callDirection

      // Somente chamadas recebidas são analisadas
      if (direction == Call.Details.DIRECTION_INCOMING) {
        val decision = AntiSpamCallScreeningServiceBridge.requestDecisionBlocking(
          number = number,
          presentation = details.callPresentation.name,
          timeoutMs = 1200L, // nunca aproximar do timeout do sistema
        )
        val response = CallResponse.Builder()
          .setDisallowCall(decision.action == "BLOCK")
          .setRejectCall(decision.action == "BLOCK")
          .setSkipCallLog(decision.action == "BLOCK")
          .setSkipNotification(decision.action == "BLOCK")
          .build()
        respondToCall(call, response)
      } else {
        respondAllow(call)
      }
    } catch (t: Throwable) {
      Log.e(TAG, "onScreenCall fail-safe", t)
      respondAllow(call)
    }
  }

  private fun respondAllow(call: Call) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        respondToCall(
          call,
          CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build(),
        )
      }
    } catch (_: Throwable) {
      // nada a fazer — nunca derrubar o serviço por falha de resposta
    }
  }

  companion object {
    private const val TAG = "AntiSpamScreening"
  }
}

/**
 * Ponte de decisão entre serviço nativo e motor JS (single-flight com timeout).
 * Implementação real: promise de CompletableFuture alimentada pelo módulo JS
 * notifyDecision(); timeout → ALLOW.
 */
object AntiSpamCallScreeningServiceBridge {
  data class Decision(val action: String)

  fun requestDecisionBlocking(number: String, presentation: String, timeoutMs: Long): Decision {
    // TODO(dev-build): emitir evento ao JS com o número e aguarde future com timeout.
    // Sem resposta no prazo → ALLOW (fail-safe §24).
    return Decision(action = "ALLOW")
  }

  fun publishDecision(number: String, action: String) {
    // TODO(dev-build): completar o future pendente correspondente ao número.
  }
}
