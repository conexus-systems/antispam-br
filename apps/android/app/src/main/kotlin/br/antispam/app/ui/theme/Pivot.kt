package br.antispam.app.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

/**
 * Windows Phone pivot as in the launcher: app name in small caps, then thin lowercase section titles;
 * the current one white with a 28×3 dp accent bar, the others dimmed. Pages themselves swipe.
 */
@Composable
fun PivotHeader(appName: String, titles: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    val list = rememberLazyListState()
    LaunchedEffect(selected) { list.animateScrollToItem(selected) }
    Column {
        Text(
            appName.uppercase(Locale.getDefault()), Modifier.padding(start = 16.dp, top = 8.dp),
            color = Metro.MUTED, fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 1.5.sp,
        )
        LazyRow(state = list, contentPadding = PaddingValues(horizontal = 12.dp)) {
            itemsIndexed(titles) { index, title ->
                val current = index == selected
                Column(
                    Modifier
                        .heightIn(min = 48.dp)
                        .clickable { onSelect(index) }
                        .clearAndSetSemantics {
                            role = Role.Tab
                            this.selected = current
                            contentDescription = "$title, seção ${index + 1} de ${titles.size}"
                        }
                        .padding(start = 4.dp, end = 14.dp, top = 2.dp, bottom = 6.dp),
                ) {
                    Text(
                        title.lowercase(Locale.getDefault()), color = if (current) Metro.TEXT else Metro.DISABLED,
                        fontSize = 30.sp, fontWeight = FontWeight.Light,
                    )
                    Box(
                        Modifier.padding(top = 2.dp).width(28.dp).height(3.dp).clip(RoundedCornerShape(2.dp))
                            .background(if (current) Metro.ACCENT else Color.Transparent),
                    )
                }
            }
        }
    }
}
