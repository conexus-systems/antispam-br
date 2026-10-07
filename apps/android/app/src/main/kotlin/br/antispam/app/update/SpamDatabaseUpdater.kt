package br.antispam.app.update

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.antispam.app.AntiSpamApplication
import br.antispam.engine.dataset.DatasetFetcher
import br.antispam.engine.dataset.UpdateResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Atualiza o dataset assinado em background (Wi-Fi/rede não medida + bateria ok por padrão).
 * Toda a verificação (assinatura, sha256, anti-rollback) acontece no DatasetInstaller.
 */
class SpamDatabaseUpdater(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val container = (applicationContext as AntiSpamApplication).container
        container.pruneHistory()
        when (val r = container.reputation.update()) {
            is UpdateResult.Installed, UpdateResult.UpToDate -> Result.success()
            is UpdateResult.Rejected -> Result.failure()
            is UpdateResult.Failed -> if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val PERIODIC = "dataset-periodic"
        private const val NOW = "dataset-now"

        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<SpamDatabaseUpdater>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).setRequiresBatteryNotLow(true).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun cancel(context: Context) = WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)

        fun runNow(context: Context) {
            val req = OneTimeWorkRequestBuilder<SpamDatabaseUpdater>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, req)
        }
    }
}

/** HTTPS simples com teto de bytes; sem cookies, sem identificadores, User-Agent genérico. */
class HttpDatasetFetcher(private val baseUrl: String) : DatasetFetcher {
    override fun fetch(path: String, maxBytes: Long): ByteArray {
        require(!path.contains("..") && !path.startsWith("/")) { "path inválido" }
        val conn = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.instanceFollowRedirects = false
            conn.setRequestProperty("User-Agent", "AntiSpamBR")
            if (conn.responseCode != 200) throw IOException("HTTP ${conn.responseCode} em $path")
            if (conn.contentLengthLong > maxBytes) throw IOException("conteúdo maior que o esperado em $path")
            conn.inputStream.use { input ->
                val out = ByteArrayOutputStream()
                val buf = ByteArray(32 * 1024)
                var total = 0L
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    total += n
                    if (total > maxBytes) throw IOException("conteúdo maior que o esperado em $path")
                    out.write(buf, 0, n)
                }
                return out.toByteArray()
            }
        } finally {
            conn.disconnect()
        }
    }
}
