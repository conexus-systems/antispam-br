package br.antispam.app

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import br.antispam.app.data.AllowListRepository
import br.antispam.app.data.BlockListRepository
import br.antispam.app.data.CommunityRepository
import br.antispam.app.data.ReputationRepository
import br.antispam.app.data.RulesRepository
import br.antispam.app.data.SettingsRepository
import br.antispam.app.data.db.AppDatabase
import br.antispam.app.screening.DecisionNotifier
import br.antispam.app.screening.ScreeningCoordinator
import br.antispam.engine.Action
import br.antispam.engine.Category
import br.antispam.engine.Stage
import br.antispam.engine.Verification
import br.antispam.engine.dataset.DatasetInstaller
import br.antispam.engine.dataset.ManifestVerifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.IOException

@RunWith(AndroidJUnit4::class)
class ScreeningInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private lateinit var db: AppDatabase
    private lateinit var scope: CoroutineScope
    private lateinit var coordinator: ScreeningCoordinator
    private lateinit var allow: AllowListRepository
    private lateinit var block: BlockListRepository
    private lateinit var community: CommunityRepository

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        allow = AllowListRepository(db.rules())
        block = BlockListRepository(db.rules())
        community = CommunityRepository(db.localReports())
        val offline = DatasetInstaller(
            File(context.cacheDir, "ds-test").apply { deleteRecursively() },
            ManifestVerifier(emptyMap(), allowTestKeys = false),
            { _, _ -> throw IOException("offline") },
        )
        coordinator = ScreeningCoordinator(
            scope, SettingsRepository(context), RulesRepository(db.rules()), community,
            ReputationRepository(offline), db.callEvents(), DecisionNotifier(context),
        )
    }

    @After
    fun tearDown() {
        scope.cancel()
        db.close()
    }

    @Test
    fun emergenciaSempreLiberada() = runBlocking {
        val d = coordinator.screen("190", Verification.NOT_VERIFIED)
        assertEquals(Action.ALLOW, d.action)
        assertEquals(Stage.EMERGENCY, d.stage)
    }

    @Test
    fun bloqueioDoUsuarioEAllowlistDepoisDeNaoESpam() = runBlocking {
        block.blockNumber("(11) 98888-7777")
        awaitRules()
        assertEquals(Action.BLOCK, coordinator.screen("+5511988887777", Verification.NOT_VERIFIED).action)

        allow.allowNumber("+55 11 98888-7777")
        community.report("+5511988887777", Category.LEGITIMATE)
        awaitRules()
        val d = coordinator.screen("011988887777", Verification.NOT_VERIFIED)
        assertEquals(Action.ALLOW, d.action)
        assertEquals(Stage.ALLOWLIST, d.stage)
    }

    @Test
    fun decisaoRegistradaNoHistoricoDentroDoOrcamento() = runBlocking {
        val d = coordinator.screen("0303 555 1234", Verification.NOT_VERIFIED)
        assertEquals(Action.WARN, d.action)
        assertTrue("decisão levou ${d.elapsedNanos / 1_000_000} ms", d.elapsedNanos < ScreeningCoordinator.BUDGET_MILLIS * 1_000_000)
        coordinator.record(d)
        repeat(50) { if (db.callEvents().observeRecent().first().isNotEmpty()) return@runBlocking; delay(20) }
        error("evento não registrado")
    }

    private suspend fun awaitRules() {
        val expected = db.rules().observeAll().first().size
        repeat(100) {
            if ((coordinator.snapshot.value?.state?.rules?.size ?: -1) == expected) return
            delay(20)
        }
    }
}
