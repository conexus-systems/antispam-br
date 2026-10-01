package br.antispam.app.screening

import android.app.Activity
import android.content.Context
import android.telecom.TelecomManager
import android.os.Build
import com.facebook.react.bridge.*

/**
 * Módulo nativo de referência (Android 10+).
 *
 * Em um development build (`npx expo prebuild --platform android` + `expo run:android`),
 * este módulo é registrado e permite:
 *  - verificar/conceder RoleManager.ROLE_CALL_SCREENING;
 *  - receber eventos do AntiSpamCallScreeningService.
 *
 * O serviço de screening real (AntiSpamCallScreeningService) chama o motor JS
 * via evento; a decisão volta por notifyDecision. Enquanto o motor não responde,
 * o serviço mantém comportamento fail-safe (ALLOW) — ver THREAT_MODEL.md.
 */
class AntiSpamScreeningModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "AntiSpamScreening"

  private fun telecom(): TelecomManager? =
    reactContext.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager

  @ReactMethod
  fun isRoleHeld(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        promise.resolve(false)
        return
      }
      val tm = telecom()
      val held = tm?.getDefaultDialerPackage() != null &&
        tm.phoneAccountsSupported &&
        reactContext.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) ==
          android.content.pm.PackageManager.PERMISSION_GRANTED
      // Verificação canônica do papel:
      val roleHeld = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        (reactContext.getSystemService(Context.ROLE_SERVICE) as? android.app.role.RoleManager)
          ?.isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING) ?: false
      } else false
      promise.resolve(roleHeld || held)
    } catch (e: Exception) {
      promise.reject("ROLE_CHECK", e)
    }
  }

  @ReactMethod
  fun requestRole(promise: Promise) {
    try {
      val activity = currentActivity ?: run {
        promise.resolve(false); return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val rm = activity.getSystemService(Context.ROLE_SERVICE) as? android.app.role.RoleManager
        if (rm?.isRoleAvailable(android.app.role.RoleManager.ROLE_CALL_SCREENING) == true) {
          val intent = rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_CALL_SCREENING)
          activity.startActivityForResult(intent, REQUEST_ROLE)
          promise.resolve(true) // resultado definitivo chega em isRoleHeld
          return
        }
      }
      promise.resolve(false)
    } catch (e: Exception) {
      promise.reject("ROLE_REQUEST", e)
    }
  }

  @ReactMethod
  fun openRoleSettings(promise: Promise) {
    try {
      val intent = android.content.Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
      intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
      reactContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("ROLE_SETTINGS", e)
    }
  }

  @ReactMethod
  fun notifyDecision(number: String, action: String, promise: Promise) {
    // Entrega o resultado do motor JS ao serviço nativo (ver arquivo de serviço de referência).
    AntiSpamCallScreeningServiceBridge.publishDecision(number, action)
    promise.resolve(null)
  }

  companion object {
    const val REQUEST_ROLE = 4711
  }
}
