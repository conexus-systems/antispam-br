package br.antispam.app.ui

import android.Manifest
import android.app.role.RoleManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import br.antispam.app.AntiSpamApplication
import br.antispam.app.ui.theme.Metro
import br.antispam.app.ui.theme.MetroTheme
import br.antispam.app.ui.theme.PivotHeader
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        val container = (application as AntiSpamApplication).container
        setContent {
            MetroTheme { App(container) }
        }
    }
}

private enum class Section(val title: String) { HOME("Início"), HISTORY("Histórico"), LISTS("Listas"), SETTINGS("Ajustes") }

@Composable
private fun App(container: br.antispam.app.AppContainer) {
    val pager = rememberPagerState { Section.entries.size }
    val scope = rememberCoroutineScope()
    val roleManager = LocalContext.current.getSystemService(RoleManager::class.java)
    var roleHeld by remember { mutableStateOf(roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) }
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        roleHeld = roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
    }
    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    val goTo: (Section) -> Unit = { scope.launch { pager.animateScrollToPage(it.ordinal) } }

    Column(Modifier.fillMaxSize().background(Metro.SCRIM).safeDrawingPadding().imePadding()) {
        PivotHeader("AntiSpam BR", Section.entries.map { it.title }, pager.currentPage) { goTo(Section.entries[it]) }
        HorizontalPager(pager, Modifier.weight(1f)) { page ->
            val mod = Modifier.fillMaxSize()
            when (Section.entries[page]) {
                Section.HOME -> HomeScreen(container, roleHeld, mod, onOpenHistory = { goTo(Section.HISTORY) }, onRequestRole = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    roleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
                })
                Section.HISTORY -> HistoryScreen(container, mod)
                Section.LISTS -> ListsScreen(container, mod)
                Section.SETTINGS -> SettingsScreen(container, mod)
            }
        }
    }
}
