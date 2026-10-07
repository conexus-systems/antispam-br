package br.antispam.app.screening

import android.app.Activity
import android.content.Context
import android.os.Build
import android.telecom.TelecomManager
import android.app.role.RoleManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Módulo Expo (M2 — ROADMAP.md): papel ROLE_CALL_SCREENING + ponte de decisão
 * com o AntiSpamCallScreeningService.
 */
class AntiSpamScreeningModule : Module() {
  private val bridge get() = AntiSpamCallScreeningServiceBridge

  private fun telecom(): TelecomManager? =
    appContext.reactContext?.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager

  override fun definition() = ModuleDefinition {
    Name("AntiSpamScreening")
    Events("onIncomingCall")

    OnCreate {
      bridge.init { number, presentation ->
        sendEvent("onIncomingCall", mapOf("number" to number, "presentation" to presentation))
      }
    }

    AsyncFunction("isRoleHeld") { promise: Promise ->
      try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
          promise.resolve(false)
          return@AsyncFunction
        }
        val rm = appContext.reactContext?.getSystemService(Context.ROLE_SERVICE) as? RoleManager
        promise.resolve(rm?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) ?: false)
      } catch (e: Exception) {
        promise.reject("ROLE_CHECK", e.message, e)
      }
    }

    AsyncFunction("isRoleAvailable") { promise: Promise ->
      try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
          promise.resolve(false)
          return@AsyncFunction
        }
        val rm = appContext.reactContext?.getSystemService(Context.ROLE_SERVICE) as? RoleManager
        promise.resolve(rm?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) ?: false)
      } catch (e: Exception) {
        promise.reject("ROLE_AVAILABLE", e.message, e)
      }
    }

    AsyncFunction("requestRole") { promise: Promise ->
      try {
        val activity: Activity = appContext.currentActivity ?: run {
          promise.resolve(false)
          return@AsyncFunction
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val rm = activity.getSystemService(Context.ROLE_SERVICE) as? RoleManager
          if (rm?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true) {
            activity.startActivityForResult(
              rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING),
              REQUEST_ROLE,
            )
            promise.resolve(true)
            return@AsyncFunction
          }
        }
        promise.resolve(false)
      } catch (e: Exception) {
        promise.reject("ROLE_REQUEST", e.message, e)
      }
    }

    AsyncFunction("openRoleSettings") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(null); return@AsyncFunction }
        val intent = android.content.Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
        intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        ctx.startActivity(intent)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ROLE_SETTINGS", e.message, e)
      }
    }

    AsyncFunction("notifyDecision") { number: String, action: String, promise: Promise ->
      bridge.publishDecision(number, action)
      promise.resolve(null)
    }

    OnDestroy {
      bridge.shutdown()
    }
  }

  companion object {
    const val REQUEST_ROLE = 4711
  }
}
