package br.antispam.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import br.antispam.app.AppContainer
import br.antispam.app.data.AppSettings
import br.antispam.app.update.SpamDatabaseUpdater
import br.antispam.engine.Action
import br.antispam.engine.Category
import br.antispam.engine.Decision
import br.antispam.engine.Mode
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            content()
        }
    }
}

private fun Action.label() = when (this) {
    Action.ALLOW -> "Liberada"
    Action.WARN -> "Aviso"
    Action.SILENCE -> "Silenciada"
    Action.BLOCK -> "Bloqueada"
}

@Composable
fun HomeScreen(container: AppContainer, roleHeld: Boolean, modifier: Modifier, onRequestRole: () -> Unit) {
    val stopped by container.events.observeStoppedSince(System.currentTimeMillis() - 7L * 86_400_000).collectAsState(initial = 0)
    var query by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf<Decision?>(null) }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Section("Proteção de chamadas") {
            if (roleHeld) {
                Text("Ativa. Ligações desconhecidas são analisadas no aparelho, sem internet.")
            } else {
                Text("Inativa. Defina o AntiSpam BR como app de identificação de chamadas e spam.")
                Button(onClick = onRequestRole) { Text("Ativar proteção") }
            }
            Text("Spam interrompido nos últimos 7 dias: $stopped")
            Text("Base comunitária: ${container.reputation.installedVersion?.toString() ?: "ainda não baixada"}", style = MaterialTheme.typography.bodySmall)
        }
        Section("Verificar um número") {
            OutlinedTextField(
                value = query, onValueChange = { query = it; preview = null },
                label = { Text("Número") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(onClick = { preview = container.screening.preview(query) }, enabled = query.isNotBlank()) { Text("Verificar") }
            preview?.let { DecisionCard(it) }
        }
        Section("Privacidade") {
            Text("A decisão acontece neste aparelho. Agenda, histórico e mensagens nunca são enviados. Sem anúncios, sem conta.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun DecisionCard(d: Decision) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("${d.action.label()} — risco ${d.score}/100", fontWeight = FontWeight.Bold)
            Text(d.number.e164 ?: d.number.kind.name, style = MaterialTheme.typography.bodySmall)
            d.reasons.forEach { Text("• ${it.message}", style = MaterialTheme.typography.bodySmall) }
        }
    }
}

@Composable
fun HistoryScreen(container: AppContainer, modifier: Modifier) {
    val events by container.events.observeRecent().collectAsState(initial = emptyList())
    val settings by container.settings.settings.collectAsState(initial = AppSettings())
    val scope = rememberCoroutineScope()
    val fmt = remember { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT) }

    if (events.isEmpty()) {
        Column(modifier.fillMaxSize().padding(24.dp)) { Text("Nenhuma ligação analisada ainda.") }
        return
    }
    LazyColumn(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        items(events, key = { it.id }) { e ->
            Section("${Action.valueOf(e.action).label()} · ${e.displayNumber}") {
                Text("${fmt.format(Date(e.at))} · risco ${e.score}/100 · ${e.elapsedMicros / 1000} ms", style = MaterialTheme.typography.bodySmall)
                Text(e.reasons, style = MaterialTheme.typography.bodySmall)
                val e164 = e.e164
                if (e164 != null && e.feedback == null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (e.action != Action.ALLOW.name) {
                            OutlinedButton(onClick = {
                                scope.launch {
                                    container.allowList.allowNumber(e164, userDdd = settings.engine.userDdd)
                                    container.community.report(e164, Category.LEGITIMATE)
                                    container.events.setFeedback(e.id, "LEGITIMATE")
                                }
                            }) { Text("Não é spam") }
                        }
                        TextButton(onClick = {
                            scope.launch {
                                container.community.report(e164, Category.OTHER)
                                container.events.setFeedback(e.id, "SPAM")
                            }
                        }) { Text("Denunciar") }
                    }
                } else if (e.feedback != null) {
                    Text("Sua avaliação: ${if (e.feedback == "LEGITIMATE") "legítima" else "spam"}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun ListsScreen(container: AppContainer, modifier: Modifier) {
    val allow by container.allowList.entries.collectAsState(initial = emptyList())
    val block by container.blockList.entries.collectAsState(initial = emptyList())
    val settings by container.settings.settings.collectAsState(initial = AppSettings())
    val scope = rememberCoroutineScope()
    var input by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Section("Adicionar") {
            OutlinedTextField(
                value = input, onValueChange = { input = it; error = null },
                label = { Text("Número ou prefixo (ex.: 0303)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    scope.launch {
                        if (container.allowList.allowNumber(input, userDdd = settings.engine.userDdd)) input = "" else error = "Número inválido"
                    }
                }) { Text("Permitir") }
                OutlinedButton(onClick = {
                    scope.launch {
                        if (container.blockList.blockNumber(input, userDdd = settings.engine.userDdd)) input = "" else error = "Número inválido"
                    }
                }) { Text("Bloquear") }
                TextButton(onClick = {
                    scope.launch { if (container.blockList.addPrefix(input, Action.BLOCK)) input = "" else error = "Prefixo inválido" }
                }) { Text("Bloquear prefixo") }
            }
        }
        Section("Sempre permitir (${allow.size})") {
            allow.forEach { r ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(r.pattern, Modifier.weight(1f))
                    TextButton(onClick = { scope.launch { container.allowList.remove(r.id) } }) { Text("Remover") }
                }
            }
        }
        Section("Bloqueios e regras (${block.size})") {
            block.forEach { r ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("${r.type.name.lowercase()} ${r.pattern} → ${r.action.label()}", Modifier.weight(1f))
                    TextButton(onClick = { scope.launch { container.blockList.remove(r.id) } }) { Text("Remover") }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(container: AppContainer, modifier: Modifier) {
    val settings by container.settings.settings.collectAsState(initial = AppSettings())
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var ddd by remember(settings.engine.userDdd) { mutableStateOf(settings.engine.userDdd ?: "") }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Section("Modo de proteção") {
            Mode.entries.forEach { m ->
                Row(
                    Modifier.fillMaxWidth().selectable(selected = settings.engine.mode == m, onClick = { scope.launch { container.settings.setMode(m) } }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = settings.engine.mode == m, onClick = null)
                    Spacer(Modifier.width(8.dp))
                    val t = m.thresholds
                    Text("${m.name.lowercase().replaceFirstChar(Char::titlecase)} (aviso ${t.warn}, silêncio ${t.silence}, bloqueio ${t.block})")
                }
            }
            Text("Bloqueio só acontece com evidência forte (sua regra ou base comunitária publicada). Heurísticas no máximo silenciam.", style = MaterialTheme.typography.bodySmall)
        }
        Section("Seu DDD") {
            OutlinedTextField(
                value = ddd, onValueChange = { v -> ddd = v.filter(Char::isDigit).take(2); if (ddd.length == 2 || ddd.isEmpty()) scope.launch { container.settings.setUserDdd(ddd.ifEmpty { null }) } },
                label = { Text("DDD (para números locais sem DDD)") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
        }
        Section("Números ocultos") {
            Text(
                "O Android não envia ligações de número oculto para apps de triagem. " +
                    "Para bloqueá-las, use a opção de bloquear desconhecidos/ocultos do app Telefone.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Section("Chamadas internacionais") {
            ActionChooser(settings.engine.internationalAction) { scope.launch { container.settings.setInternationalAction(it) } }
        }
        Section("Outros") {
            ToggleRow("Avisar sobre possível spam", settings.warnNotifications) { scope.launch { container.settings.setWarnNotifications(it) } }
            ToggleRow("Atualizar base comunitária automaticamente (Wi-Fi)", settings.autoUpdateDatasets) { on ->
                scope.launch { container.settings.setAutoUpdate(on) }
                if (on) SpamDatabaseUpdater.schedule(context) else SpamDatabaseUpdater.cancel(context)
            }
            OutlinedButton(onClick = { SpamDatabaseUpdater.runNow(context) }) { Text("Atualizar base agora") }
        }
    }
}

@Composable
private fun ActionChooser(current: Action?, onChange: (Action?) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        FilterChip(selected = current == null, onClick = { onChange(null) }, label = { Text("Analisar") })
        listOf(Action.WARN, Action.SILENCE, Action.BLOCK).forEach { a ->
            FilterChip(selected = current == a, onClick = { onChange(a) }, label = { Text(a.label()) })
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
