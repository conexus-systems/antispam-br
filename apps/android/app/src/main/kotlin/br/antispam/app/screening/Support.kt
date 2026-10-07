package br.antispam.app.screening

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.antispam.app.R
import br.antispam.engine.Decision

class DecisionNotifier(private val context: Context) {
    init {
        val channel = NotificationChannel(CHANNEL_WARN, context.getString(R.string.channel_warn_name), NotificationManager.IMPORTANCE_HIGH)
            .apply { description = context.getString(R.string.channel_warn_description) }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun warn(decision: Decision) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val who = decision.number.e164 ?: "Número oculto"
        val why = decision.reasons.firstOrNull()?.message ?: ""
        val n = NotificationCompat.Builder(context, CHANNEL_WARN)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("Possível spam: $who")
            .setContentText(why)
            .setStyle(NotificationCompat.BigTextStyle().bigText(why))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setTimeoutAfter(60_000)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(who.hashCode(), n) }
    }

    companion object {
        const val CHANNEL_WARN = "warn"
    }
}
