package br.antispam.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.antispam.app.AppContainer
import br.antispam.app.data.AppSettings
import br.antispam.app.data.db.CallEventEntity
import br.antispam.app.ui.theme.AcrylicDialog
import br.antispam.app.ui.theme.Chip
import br.antispam.app.ui.theme.ChipRow
import br.antispam.app.ui.theme.GlyphSquare
import br.antispam.app.ui.theme.Metro
import br.antispam.app.ui.theme.MetroCard
import br.antispam.app.ui.theme.N9Card
import br.antispam.app.ui.theme.Note
import br.antispam.app.ui.theme.Pill
import br.antispam.app.ui.theme.ThinHeader
import br.antispam.app.ui.theme.ThinValue
import br.antispam.app.ui.theme.Tile
import br.antispam.app.ui.theme.metroFieldColors
import br.antispam.app.update.SpamDatabaseUpdater
import br.antispam.engine.Action
import br.antispam.engine.Category
import br.antispam.engine.Decision
import br.antispam.engine.Mode
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

private fun Action.label() = when (this) {
    Action.ALLOW -> "Liberada"
    Action.WARN -> "Aviso"
    Action.SILENCE -> "Silenciada"
    Action.BLOCK -> "Bloqueada"
}

private fun Action.glyph() = when (this) {
    Action.ALLOW -> "✓"
    Action.WARN -> "!"
    Action.SILENCE -> "–"
    Action.BLOCK -> "✕"
}

/** Stopped calls in the accent, warnings in the dark brand red, allowed ones neutral. */
private fun Action.color(): Color = when (this) {
    Action.BLOCK, Action.SILENCE -> Metro.ACCENT
    Action.WARN -> Metro.BRAND_DARK
    Action.ALLOW -> Metro.SURFACE_STRONG
}

@Composable
private fun Page(modifier: Modifier, content: @Composable () -> Unit) {
    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 14.dp).padding(bottom = 24.dp)) { content() }
}

@Composable
fun HomeScreen(container: AppContainer, roleHeld: Boolean, modifier: Modifier, onOpenHistory: () -> Unit, onRequestRole: () -> Unit) {
    val stopped by container.events.observeStoppedSince(System.currentTimeMillis() - 7L * 86_400_000).collectAsState(initial = 0)
    val recent by container.events.observeRecent().collectAsState(initial = emptyList())
    val lastSpam = recent.firstOrNull { it.action != Action.ALLOW.name }
    val fmt = remember { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT) }
    var query by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf<Decision?>(null) }
    val base = container.reputation.installedVersion?.toString() ?: "ainda não baixada"

    Page(modifier) {
        Spacer(Modifier.heightIn(min = 6.dp))
        Tile(
            label = if (roleHeld) "proteção de chamadas" else "toque para ativar a proteção",
            description = if (roleHeld) "Proteção de chamadas ativa. Ligações desconhecidas são analisadas no aparelho, sem internet."
            else "Proteção de chamadas inativa. Toque para definir o AntiSpam BR como app de identificação de chamadas e spam.",
            modifier = Modifier.fillMaxWidth().heightIn(min = 132.dp),
            color = if (roleHeld) Metro.ACCENT else Metro.SURFACE_STRONG,
            onClick = if (roleHeld) null else onRequestRole,
        ) {
            Column {
                ThinValue(if (roleHeld) "ativa" else "inativa", 48)
                Text(
                    if (roleHeld) "Ligações desconhecidas são analisadas no aparelho, sem internet."
                    else "Defina o AntiSpam BR como app de identificação de chamadas e spam.",
                    color = Metro.TEXT, fontSize = 14.sp,
                )
            }
        }
        Row(Modifier.fillMaxWidth()) {
            Tile(
                label = "spam interrompido · 7 dias",
                description = "Spam interrompido nos últimos 7 dias: $stopped",
                modifier = Modifier.weight(1f).aspectRatio(1f),
            ) { ThinValue("$stopped", 56) }
            Tile(
                label = "base comunitária",
                description = "Base comunitária: $base",
                modifier = Modifier.weight(1f).aspectRatio(1f),
                color = Metro.BRAND_DARK,
            ) { Text(base, color = Metro.TEXT, fontSize = 20.sp, fontWeight = FontWeight.Light) }
        }
        Tile(
            label = "último spam · ver histórico",
            description = lastSpam?.let { "Último spam: ${it.displayNumber}, ${Action.valueOf(it.action).label()}, ${fmt.format(Date(it.at))}. Toque para ver o histórico" }
                ?: "Nenhum spam recente. Toque para ver o histórico",
            modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp),
            color = Metro.SURFACE,
            onClick = onOpenHistory,
        ) {
            Column {
                Text(lastSpam?.displayNumber ?: "nenhum spam recente", color = Metro.TEXT, fontSize = 22.sp, fontWeight = FontWeight.Light, maxLines = 1)
                lastSpam?.let { Text("${Action.valueOf(it.action).label()} · ${fmt.format(Date(it.at))}", color = Metro.MUTED, fontSize = 13.sp) }
            }
        }

        ThinHeader("verificar um número")
        OutlinedTextField(
            value = query, onValueChange = { query = it; preview = null },
            label = { Text("Número") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth(), colors = metroFieldColors(),
        )
        Pill("Verificar", onClick = { preview = container.screening.preview(query) }, accent = true, enabled = query.isNotBlank())
        preview?.let { DecisionCard(it) }

        ThinHeader("privacidade")
        Note("A decisão acontece neste aparelho. Agenda, histórico e mensagens nunca são enviados. Sem anúncios, sem conta.")
    }
}

@Composable
fun DecisionCard(d: Decision) {
    MetroCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            GlyphSquare(d.action.glyph(), d.action.color())
            Spacer(Modifier.width(12.dp))
            Column {
                Text("${d.action.label()} — risco ${d.score}/100", color = Metro.TEXT, fontSize = 18.sp)
                Text(d.number.e164 ?: d.number.kind.name, color = Metro.MUTED, fontSize = 14.sp)
            }
        }
        d.reasons.forEach { Note("• ${it.message}") }
    }
}

@Composable
fun HistoryScreen(container: AppContainer, modifier: Modifier) {
    val events by container.events.observeRecent().collectAsState(initial = emptyList())
    val settings by container.settings.settings.collectAsState(initial = AppSettings())
    val scope = rememberCoroutineScope()
    val fmt = remember { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT) }
    val timeFmt = remember { DateFormat.getTimeInstance(DateFormat.SHORT) }
    var details by remember { mutableStateOf<CallEventEntity?>(null) }

    val notSpam: (CallEventEntity, String) -> Unit = { e, e164 ->
        scope.launch {
            container.allowList.allowNumber(e164, userDdd = settings.engine.userDdd)
            container.community.report(e164, Category.LEGITIMATE)
            container.events.setFeedback(e.id, "LEGITIMATE")
        }
    }
    val reportSpam: (CallEventEntity, String) -> Unit = { e, e164 ->
        scope.launch {
            container.community.report(e164, Category.OTHER)
            container.events.setFeedback(e.id, "SPAM")
        }
    }

    if (events.isEmpty()) {
        Page(modifier) {
            ThinHeader("nada ainda", size = 28)
            Note("Nenhuma ligação analisada ainda.")
        }
        return
    }
    LazyColumn(modifier.padding(horizontal = 14.dp)) {
        items(events, key = { it.id }) { e ->
            val action = Action.valueOf(e.action)
            val e164 = e.e164
            val canRate = e164 != null && e.feedback == null
            val feedback = e.feedback?.let { "Sua avaliação: ${if (it == "LEGITIMATE") "legítima" else "spam"}" }
            val actions = buildList<Pair<String, () -> Unit>> {
                add("Ver motivos" to { details = e })
                if (canRate && action != Action.ALLOW) add("Não é spam" to { notSpam(e, e164!!) })
                if (canRate) add("Denunciar" to { reportSpam(e, e164!!) })
            }
            N9Card(
                glyph = action.glyph(), glyphColor = action.color(),
                title = e.displayNumber,
                subtitle = feedback ?: "${action.label()} · risco ${e.score}/100 · ${e.reasons}",
                trailing = timeFmt.format(Date(e.at)),
                description = "${action.label()}, ${e.displayNumber}, ${fmt.format(Date(e.at))}, risco ${e.score} de 100" +
                    (feedback?.let { ". $it" } ?: "") + ". Toque para ver os motivos",
                onClick = { details = e },
                onLongClick = { details = e },
                actions = actions,
                chips = if (!canRate) null else {
                    {
                        if (action != Action.ALLOW) Chip("não é spam", description = "Não é spam: ${e.displayNumber}") { notSpam(e, e164!!) }
                        Chip("denunciar", description = "Denunciar ${e.displayNumber}") { reportSpam(e, e164!!) }
                    }
                },
            )
        }
        item { Spacer(Modifier.heightIn(min = 24.dp)) }
    }

    details?.let { e ->
        val action = Action.valueOf(e.action)
        val e164 = e.e164
        val canRate = e164 != null && e.feedback == null
        AcrylicDialog(
            title = action.label(),
            onDismiss = { details = null },
            actions = {
                if (canRate && action != Action.ALLOW) Pill("Não é spam", onClick = { notSpam(e, e164!!); details = null })
                if (canRate) Pill("Denunciar", onClick = { reportSpam(e, e164!!); details = null })
                Pill("Fechar", onClick = { details = null }, accent = true)
            },
        ) {
            Text(e.displayNumber, color = Metro.TEXT, fontSize = 18.sp)
            Note("${fmt.format(Date(e.at))} · risco ${e.score}/100 · ${e.elapsedMicros / 1000} ms")
            Note(e.reasons)
            e.feedback?.let { Note("Sua avaliação: ${if (it == "LEGITIMATE") "legítima" else "spam"}") }
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

    Page(modifier) {
        ThinHeader("adicionar")
        OutlinedTextField(
            value = input, onValueChange = { input = it; error = null },
            label = { Text("Número ou prefixo (ex.: 0303)") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(), colors = metroFieldColors(),
        )
        error?.let { Text(it, color = Metro.BRAND_LIGHT, fontSize = 14.sp) }
        ChipRow {
            Pill("Permitir", accent = true, onClick = {
                scope.launch {
                    if (container.allowList.allowNumber(input, userDdd = settings.engine.userDdd)) input = "" else error = "Número inválido"
                }
            })
            Pill("Bloquear", onClick = {
                scope.launch {
                    if (container.blockList.blockNumber(input, userDdd = settings.engine.userDdd)) input = "" else error = "Número inválido"
                }
            })
            Pill("Bloquear prefixo", onClick = {
                scope.launch { if (container.blockList.addPrefix(input, Action.BLOCK)) input = "" else error = "Prefixo inválido" }
            })
        }
        RuleGroup("sempre permitir", allow, Metro.SURFACE_STRONG, { it.pattern }) { scope.launch { container.allowList.remove(it.id) } }
        RuleGroup("bloqueios e regras", block, Metro.ACCENT, { "${it.type.name.lowercase()} ${it.pattern} → ${it.action.label()}" }) {
            scope.launch { container.blockList.remove(it.id) }
        }
    }
}

/** Group header as in the launcher's A–Z list: an accent square (here with the count) before a thin title. */
@Composable
private fun <T> RuleGroup(title: String, rules: List<T>, color: Color, text: (T) -> String, onRemove: (T) -> Unit)
    where T : Any {
    Row(Modifier.padding(top = 18.dp, bottom = 2.dp).semantics(mergeDescendants = true) { contentDescription = "$title, ${rules.size}" }, verticalAlignment = Alignment.CenterVertically) {
        GlyphSquare("${rules.size}", color, size = 44)
        Spacer(Modifier.width(12.dp))
        Text(title, color = Metro.TEXT, fontSize = 22.sp, fontWeight = FontWeight.Light)
    }
    if (rules.isEmpty()) Note("Nenhuma regra.")
    rules.forEach { r ->
        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(text(r), Modifier.weight(1f).padding(start = 4.dp), color = Metro.TEXT, fontSize = 16.sp)
            Chip("remover", description = "Remover ${text(r)}") { onRemove(r) }
        }
    }
}

@Composable
fun SettingsScreen(container: AppContainer, modifier: Modifier) {
    val settings by container.settings.settings.collectAsState(initial = AppSettings())
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var ddd by remember(settings.engine.userDdd) { mutableStateOf(settings.engine.userDdd ?: "") }

    Page(modifier) {
        ThinHeader("modo de proteção")
        MetroCard {
            Mode.entries.forEach { m ->
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp)
                        .selectable(selected = settings.engine.mode == m, role = Role.RadioButton, onClick = { scope.launch { container.settings.setMode(m) } }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = settings.engine.mode == m, onClick = null)
                    Spacer(Modifier.width(8.dp))
                    val t = m.thresholds
                    Text("${m.name.lowercase().replaceFirstChar(Char::titlecase)} (aviso ${t.warn}, silêncio ${t.silence}, bloqueio ${t.block})", color = Metro.TEXT)
                }
            }
            Note("Bloqueio só acontece com evidência forte (sua regra ou base comunitária publicada). Heurísticas no máximo silenciam.")
        }
        ThinHeader("seu ddd")
        OutlinedTextField(
            value = ddd, onValueChange = { v -> ddd = v.filter(Char::isDigit).take(2); if (ddd.length == 2 || ddd.isEmpty()) scope.launch { container.settings.setUserDdd(ddd.ifEmpty { null }) } },
            label = { Text("DDD (para números locais sem DDD)") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = metroFieldColors(),
        )
        ThinHeader("números ocultos")
        Note(
            "O Android não envia ligações de número oculto para apps de triagem. " +
                "Para bloqueá-las, use a opção de bloquear desconhecidos/ocultos do app Telefone.",
        )
        ThinHeader("chamadas internacionais")
        ActionChooser(settings.engine.internationalAction) { scope.launch { container.settings.setInternationalAction(it) } }
        ThinHeader("outros")
        MetroCard {
            ToggleRow("Avisar sobre possível spam", settings.warnNotifications) { scope.launch { container.settings.setWarnNotifications(it) } }
            ToggleRow("Atualizar base comunitária automaticamente (Wi-Fi)", settings.autoUpdateDatasets) { on ->
                scope.launch { container.settings.setAutoUpdate(on) }
                if (on) SpamDatabaseUpdater.schedule(context) else SpamDatabaseUpdater.cancel(context)
            }
            Pill("Atualizar base agora", onClick = { SpamDatabaseUpdater.runNow(context) })
        }
    }
}

@Composable
private fun ActionChooser(current: Action?, onChange: (Action?) -> Unit) {
    ChipRow {
        Chip("analisar", selected = current == null) { onChange(null) }
        listOf(Action.WARN, Action.SILENCE, Action.BLOCK).forEach { a ->
            Chip(a.label().lowercase(), selected = current == a) { onChange(a) }
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(role = Role.Switch) { onChange(!checked) }.semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), color = Metro.TEXT)
        Switch(checked = checked, onCheckedChange = null)
    }
}
