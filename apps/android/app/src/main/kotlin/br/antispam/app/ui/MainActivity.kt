package br.antispam.app.ui

import android.Manifest
import android.app.role.RoleManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import br.antispam.app.AntiSpamApplication

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as AntiSpamApplication).container
        setContent {
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
                App(container)
            }
        }
    }
}

private enum class Tab(val label: String, val glyph: String) {
    HOME("Início", "🛡"), HISTORY("Histórico", "🕑"), LISTS("Listas", "☰"), SETTINGS("Ajustes", "⚙")
}

@Composable
private fun App(container: br.antispam.app.AppContainer) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val roleManager = androidx.compose.ui.platform.LocalContext.current.getSystemService(RoleManager::class.java)
    var roleHeld by remember { mutableStateOf(roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) }
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        roleHeld = roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
    }
    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEachIndexed { i, t ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = { tab = i },
                        icon = { Text(t.glyph) },
                        label = { Text(t.label) },
                    )
                }
            }
        },
    ) { padding ->
        val mod = Modifier.padding(padding)
        when (Tab.entries[tab]) {
            Tab.HOME -> HomeScreen(container, roleHeld, mod, onRequestRole = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                roleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
            })
            Tab.HISTORY -> HistoryScreen(container, mod)
            Tab.LISTS -> ListsScreen(container, mod)
            Tab.SETTINGS -> SettingsScreen(container, mod)
        }
    }
}
