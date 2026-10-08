package br.antispam.app.ui.theme

import android.os.Build
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider

/**
 * Acrylic dialog as in the launcher's ConexusDialog: 8 dp translucent surface, 1 dp outline, 0.4 dim.
 * Blur behind only on Android 12+ when the device has cross-window blur on; otherwise a more opaque fill.
 */
@Composable
fun AcrylicDialog(
    title: String,
    onDismiss: () -> Unit,
    actions: @Composable RowScope.() -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        val view = LocalView.current
        val blurPx = with(LocalDensity.current) { 16.dp.roundToPx() }
        var blurred by remember { mutableStateOf(false) }
        DisposableEffect(view) {
            val window = (view.parent as? DialogWindowProvider)?.window
            window?.setDimAmount(0.4f)
            if (window != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && window.windowManager.isCrossWindowBlurEnabled) {
                window.addFlags(WindowManager.LayoutParams.FLAG_BLUR_BEHIND)
                window.attributes = window.attributes.apply { blurBehindRadius = blurPx }
                blurred = true
            }
            onDispose { }
        }
        val shape = RoundedCornerShape(8.dp)
        Column(
            Modifier
                .padding(horizontal = 12.dp, vertical = 16.dp)
                .fillMaxWidth()
                .clip(shape)
                .background(if (blurred) Metro.DIALOG_BLURRED else Metro.DIALOG)
                .border(1.dp, Metro.OUTLINE, shape)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(title.lowercase(), Modifier.semantics { heading() }, color = Metro.TEXT, fontSize = 26.sp, fontWeight = FontWeight.Light)
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp), content = content)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically, content = actions)
        }
    }
}
