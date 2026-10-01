package br.antispam.app.screening

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.UIManagerModule

/**
 * Registro do módulo nativo (fase dev build):
 * em MainApplication (prebuild), adicione:
 *   packages.add(AntiSpamScreeningPackage())
 */
class AntiSpamScreeningPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(AntiSpamScreeningModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<View, ReactShadowNode<View>>> = emptyList()
}
