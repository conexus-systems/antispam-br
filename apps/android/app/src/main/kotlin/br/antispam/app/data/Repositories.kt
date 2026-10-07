package br.antispam.app.data

import br.antispam.app.data.db.LocalReportDao
import br.antispam.app.data.db.LocalReportEntity
import br.antispam.app.data.db.RuleDao
import br.antispam.app.data.db.RuleEntity
import br.antispam.engine.Action
import br.antispam.engine.Category
import br.antispam.engine.dataset.DatasetInstaller
import br.antispam.engine.dataset.InstalledDataset
import br.antispam.engine.dataset.UpdateResult
import br.antispam.engine.phone.PhoneNormalizer
import br.antispam.engine.rules.RuleType
import br.antispam.engine.rules.UserRule
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private fun RuleEntity.toRule() = UserRule(
    id = id,
    type = runCatching { RuleType.valueOf(type) }.getOrDefault(RuleType.EXACT),
    pattern = pattern,
    action = runCatching { Action.valueOf(action) }.getOrDefault(Action.WARN),
    label = label,
    enabled = enabled,
)

/** Todas as regras do usuário, para compilar o snapshot do engine. */
class RulesRepository(private val dao: RuleDao) {
    val rules: Flow<List<UserRule>> = dao.observeAll().map { list -> list.map { it.toRule() } }
}

class AllowListRepository(private val dao: RuleDao) {
    val entries: Flow<List<UserRule>> = dao.observeAll().map { l -> l.map { it.toRule() }.filter { it.action == Action.ALLOW } }

    /** Guarda sempre na forma E.164 para que "(11) 9…" e "+55 11 9…" sejam a mesma entrada. */
    suspend fun allowNumber(raw: String, label: String? = null, userDdd: String? = null): Boolean {
        val e164 = PhoneNormalizer.normalize(raw, userDdd).e164 ?: return false
        dao.upsert(RuleEntity(type = RuleType.EXACT.name, pattern = e164, action = Action.ALLOW.name, label = label))
        return true
    }

    suspend fun remove(id: Long) = dao.delete(id)
}

class BlockListRepository(private val dao: RuleDao) {
    val entries: Flow<List<UserRule>> = dao.observeAll().map { l -> l.map { it.toRule() }.filter { it.action != Action.ALLOW } }

    suspend fun blockNumber(raw: String, action: Action = Action.BLOCK, label: String? = null, userDdd: String? = null): Boolean {
        require(action != Action.ALLOW)
        val e164 = PhoneNormalizer.normalize(raw, userDdd).e164 ?: return false
        dao.upsert(RuleEntity(type = RuleType.EXACT.name, pattern = e164, action = action.name, label = label))
        return true
    }

    suspend fun addPrefix(prefix: String, action: Action, label: String? = null): Boolean {
        val p = prefix.trim()
        val digits = p.count(Char::isDigit)
        if (digits < 2 || digits > 16 || action == Action.ALLOW) return false
        dao.upsert(RuleEntity(type = RuleType.PREFIX.name, pattern = p, action = action.name, label = label))
        return true
    }

    suspend fun remove(id: Long) = dao.delete(id)
}

/** Denúncias do próprio usuário. Envio à comunidade é opt-in e chega no M2. */
class CommunityRepository(private val dao: LocalReportDao) {
    val latestByNumber: Flow<Map<String, Category>> = dao.observeLatestPerNumber().map { list ->
        list.associate { it.e164 to (runCatching { Category.valueOf(it.category) }.getOrDefault(Category.OTHER)) }
    }

    suspend fun report(e164: String, category: Category) {
        dao.insert(LocalReportEntity(e164 = e164, category = category.name))
    }
}

/** Reputação local = dataset assinado instalado (mmap). */
class ReputationRepository(private val installer: DatasetInstaller) {
    val dataset = InstalledDataset(installer)

    val installedVersion: Long? get() = dataset.version

    fun update(): UpdateResult = installer.update().also { if (it is UpdateResult.Installed) dataset.reload() }
}
