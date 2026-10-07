package br.antispam.app.screening

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.TelecomManager
import android.util.Log

/**
 * CallScreeningService real (Android 10+).
 *
 * CONTRATO DE SEGURANÇA (THREAT_MODEL.md §24):
 * - NUNCA responder null nem travar: qualquer exceção → respondAllow (fail-safe).
 * - Timeout curto no caminho nativo → JS; sem resposta a tempo → ALLOW.
 * - Decisão JAMAIS depende de rede; nuvem não participa do bloqueio.
 * - BLOCK: rejeita e oculta do log/notificação. SILENCE (API 31+): toque silenciado.
 */
class AntiSpamCallScreeningService : CallScreeningService() {

  override fun onScreenCall(details: Call.Details) {
    try {
      val direction = details.callDirection

      if (direction != Call.Details.DIRECTION_INCOMING) {
        respondAllow(details)
        return
      }

      val number = details.handle?.schemeSpecificPart ?: ""
      val presentation = presentationName(details.handlePresentation)

      val decision = AntiSpamCallScreeningServiceBridge.requestDecisionBlocking(
        number = number,
        presentation = presentation,
        timeoutMs = TIMEOUT_MS,
      )

      val block = decision.action == "BLOCK"
      val builder = CallResponse.Builder()
        .setDisallowCall(block)
        .setRejectCall(block)
        .setSkipCallLog(block)
        .setSkipNotification(block)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        builder.setSilenceCall(decision.action == "SILENCE")
      }
      respondToCall(details, builder.build())
    } catch (t: Throwable) {
      Log.e(TAG, "onScreenCall fail-safe", t)
      respondAllow(details)
    }
  }

  private fun presentationName(p: Int): String =
    when (p) {
      TelecomManager.PRESENTATION_ALLOWED -> "ALLOWED"
      TelecomManager.PRESENTATION_PAYPHONE -> "PAYPHONE"
      TelecomManager.PRESENTATION_RESTRICTED -> "RESTRICTED"
      else -> "UNKNOWN"
    }

  private fun respondAllow(details: Call.Details) {
    try {
      val builder = CallResponse.Builder()
        .setDisallowCall(false)
        .setRejectCall(false)
        .setSkipCallLog(false)
        .setSkipNotification(false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        builder.setSilenceCall(false)
      }
      respondToCall(details, builder.build())
    } catch (_: Throwable) {
      // nada a fazer — nunca derrubar o serviço por falha de resposta
    }
  }

  companion object {
    private const val TAG = "AntiSpamScreening"
    /** Bem abaixo do timeout do sistema (~10 s) e da meta p95 do PRD. */
    const val TIMEOUT_MS = 1200L
  }
}
