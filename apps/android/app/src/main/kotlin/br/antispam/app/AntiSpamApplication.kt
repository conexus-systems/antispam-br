package br.antispam.app

import android.app.Application
import android.content.Context
import br.antispam.app.data.AllowListRepository
import br.antispam.app.data.BlockListRepository
import br.antispam.app.data.CommunityRepository
import br.antispam.app.data.ReputationRepository
import br.antispam.app.data.RulesRepository
import br.antispam.app.data.SettingsRepository
import br.antispam.app.data.db.AppDatabase
import br.antispam.app.screening.DecisionNotifier
import br.antispam.app.screening.ScreeningCoordinator
import br.antispam.app.update.HttpDatasetFetcher
import br.antispam.app.update.SpamDatabaseUpdater
import br.antispam.engine.dataset.DatasetInstaller
import br.antispam.engine.dataset.ManifestVerifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.File
import java.util.Base64

class AntiSpamApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.scope.launch {
            if (container.settings.settings.first().autoUpdateDatasets) SpamDatabaseUpdater.schedule(this@AntiSpamApplication)
        }
    }
}

/** Injeção manual — o grafo é pequeno e o processo pode subir frio só para triar uma chamada. */
class AppContainer(context: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val db = AppDatabase.build(context)

    val settings = SettingsRepository(context)
    val rules = RulesRepository(db.rules())
    val allowList = AllowListRepository(db.rules())
    val blockList = BlockListRepository(db.rules())
    val community = CommunityRepository(db.localReports())
    val events = db.callEvents()

    val reputation = ReputationRepository(
        DatasetInstaller(
            root = File(context.noBackupFilesDir, "datasets"),
            verifier = ManifestVerifier(parseKeys(BuildConfig.DATASET_KEYS), allowTestKeys = BuildConfig.ALLOW_TEST_KEYS),
            fetcher = HttpDatasetFetcher(BuildConfig.DATASET_BASE_URL),
        ),
    )

    val screening = ScreeningCoordinator(
        scope = scope,
        settings = settings,
        rules = rules,
        community = community,
        reputation = reputation,
        events = events,
        notifier = DecisionNotifier(context),
    )

    suspend fun pruneHistory() {
        events.prune(System.currentTimeMillis() - HISTORY_RETENTION_MILLIS)
    }

    companion object {
        const val HISTORY_RETENTION_MILLIS = 90L * 24 * 3600 * 1000

        fun parseKeys(spec: String): Map<String, ByteArray> = spec.split(',')
            .mapNotNull { entry ->
                val (id, b64) = entry.split(':', limit = 2).takeIf { it.size == 2 } ?: return@mapNotNull null
                runCatching { id.trim() to Base64.getDecoder().decode(b64.trim()) }.getOrNull()
            }.toMap()
    }
}
