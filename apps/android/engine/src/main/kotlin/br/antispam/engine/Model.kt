package br.antispam.engine

import br.antispam.engine.phone.NormalizedNumber

enum class Action {
    ALLOW, WARN, SILENCE, BLOCK;

    fun atMost(limit: Action): Action = if (ordinal > limit.ordinal) limit else this
}

/** Estágio do pipeline que determinou a decisão (ADR 0005). */
enum class Stage {
    EMERGENCY, CONTACT, ALLOWLIST, USER_RULE, USER_POLICY, USER_REPORT,
    REPUTATION, HEURISTICS, COMMUNITY, MODEL, DEFAULT, FAIL_SAFE,
}

/** Códigos estáveis — docs/specs/DATASET_FORMAT.md §4. */
enum class Category(val code: Int) {
    OTHER(0), TELEMARKETING(1), ROBOCALL(2), SILENT_CALL(3), COLLECTION(4), BANK_SCAM(5),
    PIX_SCAM(6), PHISHING(7), DELIVERY_SCAM(8), FAKE_SUPPORT(9), LOAN(10), SURVEY(11),
    SPOOFING(12), LEGITIMATE(13);

    companion object {
        private val byCode = entries.associateBy { it.code }
        fun fromCode(code: Int): Category = byCode[code] ?: OTHER
    }
}

/** Resultado STIR/SHAKEN / Origem Verificada exposto pelo sistema. */
enum class Verification { PASSED, FAILED, NOT_VERIFIED }

data class Thresholds(val warn: Int, val silence: Int, val block: Int) {
    init {
        require(warn in 1..100 && silence in warn..100 && block in silence..100) {
            "thresholds devem satisfazer 1 <= warn <= silence <= block <= 100"
        }
    }

    fun actionFor(score: Int): Action = when {
        score >= block -> Action.BLOCK
        score >= silence -> Action.SILENCE
        score >= warn -> Action.WARN
        else -> Action.ALLOW
    }
}

enum class Mode(val thresholds: Thresholds) {
    CONSERVATIVE(Thresholds(warn = 40, silence = 70, block = 90)),
    BALANCED(Thresholds(warn = 40, silence = 60, block = 80)),
    AGGRESSIVE(Thresholds(warn = 30, silence = 50, block = 70)),
}

data class EngineSettings(
    val mode: Mode = Mode.BALANCED,
    val customThresholds: Thresholds? = null,
    /** DDD do usuário, para completar números locais de 8/9 dígitos. */
    val userDdd: String? = null,
    /** Ação explícita do usuário para números ocultos (null = só sinal heurístico). */
    val hiddenAction: Action? = null,
    /** Ação explícita do usuário para números internacionais (null = só sinal heurístico). */
    val internationalAction: Action? = null,
) {
    val thresholds: Thresholds get() = customThresholds ?: mode.thresholds
}

data class CallContext(
    val rawNumber: String?,
    val inContacts: Boolean = false,
    val verification: Verification = Verification.NOT_VERIFIED,
    val timestampMillis: Long = System.currentTimeMillis(),
)

data class Reason(val stage: Stage, val points: Int, val code: String, val message: String)

data class Decision(
    val action: Action,
    val score: Int,
    val stage: Stage,
    val reasons: List<Reason>,
    val number: NormalizedNumber,
    val category: Category? = null,
    val elapsedNanos: Long = 0,
)
