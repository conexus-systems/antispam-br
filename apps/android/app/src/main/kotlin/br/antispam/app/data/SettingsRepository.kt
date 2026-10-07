package br.antispam.app.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import br.antispam.engine.Action
import br.antispam.engine.EngineSettings
import br.antispam.engine.Mode
import br.antispam.engine.phone.PhoneNormalizer
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

data class AppSettings(
    val engine: EngineSettings = EngineSettings(),
    val warnNotifications: Boolean = true,
    val autoUpdateDatasets: Boolean = true,
)

class SettingsRepository(private val context: Context) {
    private object Keys {
        val MODE = stringPreferencesKey("mode")
        val USER_DDD = stringPreferencesKey("user_ddd")
        val HIDDEN_ACTION = stringPreferencesKey("hidden_action")
        val INTERNATIONAL_ACTION = stringPreferencesKey("international_action")
        val WARN_NOTIFICATIONS = booleanPreferencesKey("warn_notifications")
        val AUTO_UPDATE = booleanPreferencesKey("auto_update")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map(::fromPrefs)

    private fun fromPrefs(p: Preferences) = AppSettings(
        engine = EngineSettings(
            mode = p[Keys.MODE]?.let { runCatching { Mode.valueOf(it) }.getOrNull() } ?: Mode.BALANCED,
            userDdd = p[Keys.USER_DDD]?.takeIf { it in PhoneNormalizer.VALID_DDDS },
            hiddenAction = p[Keys.HIDDEN_ACTION]?.let { runCatching { Action.valueOf(it) }.getOrNull() },
            internationalAction = p[Keys.INTERNATIONAL_ACTION]?.let { runCatching { Action.valueOf(it) }.getOrNull() },
        ),
        warnNotifications = p[Keys.WARN_NOTIFICATIONS] ?: true,
        autoUpdateDatasets = p[Keys.AUTO_UPDATE] ?: true,
    )

    suspend fun setMode(mode: Mode) = context.dataStore.edit { it[Keys.MODE] = mode.name }

    suspend fun setUserDdd(ddd: String?) = context.dataStore.edit {
        if (ddd != null && ddd in PhoneNormalizer.VALID_DDDS) it[Keys.USER_DDD] = ddd else it.remove(Keys.USER_DDD)
    }

    suspend fun setHiddenAction(action: Action?) = context.dataStore.edit {
        if (action == null) it.remove(Keys.HIDDEN_ACTION) else it[Keys.HIDDEN_ACTION] = action.name
    }

    suspend fun setInternationalAction(action: Action?) = context.dataStore.edit {
        if (action == null) it.remove(Keys.INTERNATIONAL_ACTION) else it[Keys.INTERNATIONAL_ACTION] = action.name
    }

    suspend fun setWarnNotifications(on: Boolean) = context.dataStore.edit { it[Keys.WARN_NOTIFICATIONS] = on }
    suspend fun setAutoUpdate(on: Boolean) = context.dataStore.edit { it[Keys.AUTO_UPDATE] = on }
}
