package br.antispam.app.data.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/** Regra do usuário: allowlist (action = ALLOW) ou blocklist/regras (WARN/SILENCE/BLOCK). */
@Entity(tableName = "rules", indices = [Index(value = ["type", "pattern"], unique = true)])
data class RuleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val pattern: String,
    val action: String,
    val label: String? = null,
    val enabled: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
)

/** Histórico local de decisões. Nunca sai do aparelho; retenção limitada (ver CallEventDao.prune). */
@Entity(tableName = "call_events", indices = [Index("at"), Index("e164")])
data class CallEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val e164: String?,
    val displayNumber: String,
    val action: String,
    val score: Int,
    val stage: String,
    val category: String?,
    /** Razões legíveis, uma por linha. */
    val reasons: String,
    val at: Long,
    val elapsedMicros: Long,
    val feedback: String? = null,
)

/** Denúncia feita neste aparelho. `synced` só muda quando o envio comunitário (opt-in, M2) existir. */
@Entity(tableName = "local_reports", indices = [Index(value = ["e164"])])
data class LocalReportEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val e164: String,
    val category: String,
    val at: Long = System.currentTimeMillis(),
    val synced: Boolean = false,
)

@Dao
interface RuleDao {
    @Query("SELECT * FROM rules ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<RuleEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(rule: RuleEntity): Long

    @Query("DELETE FROM rules WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM rules WHERE type = 'EXACT' AND pattern = :pattern")
    suspend fun deleteExact(pattern: String)
}

@Dao
interface CallEventDao {
    @Query("SELECT * FROM call_events ORDER BY at DESC LIMIT :limit")
    fun observeRecent(limit: Int = 200): Flow<List<CallEventEntity>>

    @Insert
    suspend fun insert(event: CallEventEntity): Long

    @Query("UPDATE call_events SET feedback = :feedback WHERE id = :id")
    suspend fun setFeedback(id: Long, feedback: String)

    @Query("DELETE FROM call_events WHERE at < :before")
    suspend fun prune(before: Long): Int

    @Query("SELECT COUNT(*) FROM call_events WHERE action IN ('BLOCK','SILENCE') AND at >= :since")
    fun observeStoppedSince(since: Long): Flow<Int>
}

@Dao
interface LocalReportDao {
    /** Última denúncia por número. */
    @Query("SELECT * FROM local_reports WHERE id IN (SELECT MAX(id) FROM local_reports GROUP BY e164)")
    fun observeLatestPerNumber(): Flow<List<LocalReportEntity>>

    @Insert
    suspend fun insert(report: LocalReportEntity): Long
}

@Database(entities = [RuleEntity::class, CallEventEntity::class, LocalReportEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun rules(): RuleDao
    abstract fun callEvents(): CallEventDao
    abstract fun localReports(): LocalReportDao

    companion object {
        fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "antispam.db").build()
    }
}
