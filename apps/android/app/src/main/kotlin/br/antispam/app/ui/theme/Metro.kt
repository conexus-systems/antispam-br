package br.antispam.app.ui.theme

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Visual tokens shared with the Conexus Launcher (Windows 10 Mobile + MeeGo/N9): dark translucent
 * surfaces, pills, 6–8 dp cards, flat tiles in the accent, thin lowercase headers.
 */
object Metro {
    /** Brand palette from fleet.yml (antispam-br). */
    val BRAND = Color(0xFFDC2626)
    val BRAND_DARK = Color(0xFF7F1D1D)
    val BRAND_LIGHT = Color(0xFFFECACA)

    /** Brand red adjusted for white text; #DC2626 already passes AA (4.8:1), so it stays unchanged. */
    val ACCENT = Color(Accent.forWhiteText(0xFFDC2626.toInt()))

    val TEXT = Color.White
    val MUTED = Color(255, 255, 255, 180)
    val DISABLED = Color(255, 255, 255, 110)
    val SURFACE = Color(255, 255, 255, 40)
    val SURFACE_STRONG = Color(255, 255, 255, 70)
    /** Over the wallpaper, so text always sits on a dark base. */
    val SCRIM = Color(0xE60B0F14)
    val DIALOG = Color(0xF21A2430)
    val DIALOG_BLURRED = Color(0xB81A2430)
    val OUTLINE = Color(0x33FFFFFF)

    val TILE = RoundedCornerShape(2.dp)
    val CARD = RoundedCornerShape(6.dp)
    val PILL = RoundedCornerShape(28.dp)
}

@Composable
fun MetroTheme(content: @Composable () -> Unit) {
    val base = Typography()
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Metro.ACCENT, onPrimary = Color.White,
            secondary = Metro.BRAND_LIGHT, onSecondary = Metro.BRAND_DARK,
            background = Color.Transparent, onBackground = Metro.TEXT,
            surface = Metro.DIALOG, onSurface = Metro.TEXT,
            surfaceVariant = Metro.SURFACE, onSurfaceVariant = Metro.MUTED,
            outline = Metro.SURFACE_STRONG, error = Metro.BRAND_LIGHT,
        ),
        typography = base.copy(
            bodyLarge = base.bodyLarge.copy(fontFamily = FontFamily.SansSerif),
            bodyMedium = base.bodyMedium.copy(fontFamily = FontFamily.SansSerif),
        ),
        content = content,
    )
}

/** Thin lowercase heading (pivot sections, "nada novo"). */
@Composable
fun ThinHeader(text: String, modifier: Modifier = Modifier, size: Int = 24) {
    Text(
        text.lowercase(), modifier.padding(top = 18.dp, bottom = 6.dp).semantics { heading() },
        color = Metro.TEXT, fontSize = size.sp, fontWeight = FontWeight.Light,
    )
}

@Composable
fun Note(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier.padding(vertical = 4.dp), color = Metro.MUTED, fontSize = 14.sp)
}

/** 48 dp touch target with the visible pill inset 4 dp, like the launcher's Ui.pill. */
@Composable
fun Pill(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Boolean = false,
    enabled: Boolean = true,
    description: String? = null,
) {
    Box(
        modifier
            .heightIn(min = 48.dp)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)
            .padding(vertical = 4.dp, horizontal = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.heightIn(min = 40.dp).clip(Metro.PILL).background(if (accent && enabled) Metro.ACCENT else Metro.SURFACE).padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(text, color = if (enabled) Metro.TEXT else Metro.DISABLED, fontSize = 15.sp, maxLines = 1)
        }
    }
}

@Composable
fun Chip(text: String, selected: Boolean = false, description: String? = null, onClick: () -> Unit) {
    Box(
        Modifier
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                this.selected = selected
                if (description != null) contentDescription = description
            }
            .padding(vertical = 6.dp, horizontal = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.heightIn(min = 36.dp).clip(Metro.PILL).background(if (selected) Metro.ACCENT else Metro.SURFACE).padding(horizontal = 16.dp),
            contentAlignment = Alignment.Center,
        ) { Text(text, color = Metro.TEXT, fontSize = 14.sp, maxLines = 1) }
    }
}

@Composable
fun ChipRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically, content = content)
}

/** Flat Metro tile: solid color, 2 dp corners, label bottom-left. The whole tile is one TalkBack node. */
@Composable
fun Tile(
    label: String,
    description: String,
    modifier: Modifier = Modifier,
    color: Color = Metro.ACCENT,
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier
            .padding(2.dp)
            .heightIn(min = 48.dp)
            .clip(Metro.TILE)
            .background(color)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .clearAndSetSemantics {
                contentDescription = description
                if (onClick != null) role = Role.Button
            }
            .padding(10.dp),
    ) {
        content()
        Text(label, Modifier.align(Alignment.BottomStart), color = Metro.TEXT, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** Big thin number or word for tiles and the protection status. */
@Composable
fun ThinValue(text: String, size: Int = 44) {
    Text(text, color = Metro.TEXT, fontSize = size.sp, fontWeight = FontWeight.Thin, lineHeight = (size + 4).sp, maxLines = 1)
}

/** Small accent square with a glyph or count (N9 card icon, A–Z style group header). */
@Composable
fun GlyphSquare(glyph: String, color: Color = Metro.ACCENT, size: Int = 40) {
    Box(Modifier.size(size.dp).clip(Metro.TILE).background(color), contentAlignment = Alignment.Center) {
        Text(glyph, color = Metro.TEXT, fontSize = (size * 0.45f).sp, fontWeight = FontWeight.Light, maxLines = 1)
    }
}

@Composable
fun MetroCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().padding(top = 8.dp).clip(Metro.CARD).background(Metro.SURFACE).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        content = content,
    )
}

/**
 * N9 Events-style card: glyph, title, subtitle, time on the right and a row of chips. Long-press
 * opens [onLongClick]; the same actions are exposed to TalkBack as custom actions.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun N9Card(
    glyph: String,
    glyphColor: Color,
    title: String,
    subtitle: String,
    trailing: String,
    description: String,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null,
    actions: List<Pair<String, () -> Unit>> = emptyList(),
    chips: (@Composable RowScope.() -> Unit)? = null,
) {
    MetroCard {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .combinedClickable(onClick = onClick, onLongClick = onLongClick)
                .clearAndSetSemantics {
                    contentDescription = description
                    role = Role.Button
                    customActions = actions.map { (label, run) -> CustomAccessibilityAction(label) { run(); true } }
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GlyphSquare(glyph, glyphColor)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = Metro.TEXT, fontSize = 18.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle, color = Metro.MUTED, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Text(trailing, Modifier.padding(start = 8.dp), color = Metro.MUTED, fontSize = 13.sp, textAlign = TextAlign.End)
        }
        if (chips != null) ChipRow(chips)
    }
}

@Composable
fun metroFieldColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Metro.ACCENT, unfocusedBorderColor = Metro.SURFACE_STRONG,
    focusedLabelColor = Metro.TEXT, unfocusedLabelColor = Metro.MUTED,
    cursorColor = Metro.TEXT, focusedTextColor = Metro.TEXT, unfocusedTextColor = Metro.TEXT,
)
