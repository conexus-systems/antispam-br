package br.antispam.engine.phone

/**
 * Normalização BR → E.164. Contrato: data/test-vectors/phone-normalization.json
 * (mesma lógica de packages/phone-normalizer em TS).
 */
enum class NumberKind {
    MOBILE, LANDLINE, TOLL_FREE, TELEMARKETING, SHARED_COST, DONATION, PREMIUM,
    NON_GEO_UNIQUE, EMERGENCY, SHORT_CODE, INTERNATIONAL, LOCAL_NO_DDD, HIDDEN, INVALID,
}

data class NormalizedNumber(
    val input: String,
    val kind: NumberKind,
    val e164: String?,
    val ddd: String?,
    val shard: String?,
) {
    /** Dígitos E.164 sem "+" — chave dos registros do dataset. */
    val key: Long? get() = e164?.substring(1)?.toLongOrNull()

    /**
     * Formas equivalentes para casar regras do usuário: E.164 com "+", nacional com DDD
     * e nacional com zero para não geográficos ("0303…"). Sem a forma "55…" sem "+":
     * um prefixo "55" é o DDD de Santa Maria, não o Brasil inteiro.
     */
    val matchForms: List<String>
        get() {
            val e = e164 ?: return listOf(input.filter { it.isDigit() })
                .filter { it.isNotEmpty() && it.length <= MAX_RAW_MATCH_DIGITS }
            val forms = linkedSetOf(e)
            if (e.startsWith("+55")) {
                val national = e.substring(3)
                forms += national
                if (ddd == null) forms += "0$national"
            }
            return forms.toList()
        }

    private companion object {
        const val MAX_RAW_MATCH_DIGITS = 20
    }
}

object PhoneNormalizer {
    val VALID_DDDS: Set<String> = setOf(
        "11", "12", "13", "14", "15", "16", "17", "18", "19",
        "21", "22", "24", "27", "28",
        "31", "32", "33", "34", "35", "37", "38",
        "41", "42", "43", "44", "45", "46", "47", "48", "49",
        "51", "53", "54", "55",
        "61", "62", "63", "64", "65", "66", "67", "68", "69",
        "71", "73", "74", "75", "77", "79",
        "81", "82", "83", "84", "85", "86", "87", "88", "89",
        "91", "92", "93", "94", "95", "96", "97", "98", "99",
    )

    /**
     * Códigos 1XX são exclusivos de utilidade pública/emergência (Res. Anatel 749/2022 art. 14 §1º);
     * 10X com extensão (103xx, 105xx) são centrais de operadoras. 112 e 911 também levam à polícia.
     */
    fun isEmergencyOrUtility(digits: String): Boolean = when {
        digits == "911" -> true
        digits.length == 3 && digits[0] == '1' -> true
        else -> (digits.length == 4 || digits.length == 5) && digits.startsWith("10")
    }

    /** "+190", "0190", "+55 190" e "55190" também chegam como caller ID e são o mesmo 190. */
    private fun isEmergencyInAnyForm(digits: String): Boolean {
        if (digits.length > 8) return false
        val withoutCountry = if (digits.startsWith("55") && digits.length > 3) digits.substring(2) else digits
        return listOf(digits, digits.trimStart('0'), withoutCountry.trimStart('0'))
            .any { it.length in 3..5 && isEmergencyOrUtility(it) }
    }

    private val NON_GEO_PREFIXES = listOf(
        "0800" to NumberKind.TOLL_FREE,
        "0303" to NumberKind.TELEMARKETING,
        "0300" to NumberKind.SHARED_COST,
        "0500" to NumberKind.DONATION,
        "0900" to NumberKind.PREMIUM,
    )

    private val NON_GEO_UNIQUE = Regex("^(300[0-9]|400[0-9]|4020|4062|4090|4091)\\d{4}$")

    private val HIDDEN_TOKENS = setOf("", "anonymous", "private", "unknown", "restricted", "privado", "desconhecido")

    private fun result(input: String, kind: NumberKind, e164: String?, ddd: String?): NormalizedNumber {
        val shard = when {
            e164 == null -> null
            kind == NumberKind.MOBILE || kind == NumberKind.LANDLINE -> "55-$ddd"
            kind == NumberKind.INTERNATIONAL -> "55-intl"
            else -> "55-ng"
        }
        return NormalizedNumber(input, kind, e164, ddd, shard)
    }

    private fun fromNational(input: String, national: String): NormalizedNumber {
        if (national.length != 10 && national.length != 11) return result(input, NumberKind.INVALID, null, null)
        val ddd = national.substring(0, 2)
        if (ddd !in VALID_DDDS) return result(input, NumberKind.INVALID, null, null)
        val sub = national.substring(2)
        if (sub.length == 9) {
            return if (sub[0] == '9') result(input, NumberKind.MOBILE, "+55$ddd$sub", ddd)
            else result(input, NumberKind.INVALID, null, null)
        }
        return when (sub[0]) {
            in '2'..'6' -> result(input, NumberKind.LANDLINE, "+55$ddd$sub", ddd)
            in '7'..'9' -> result(input, NumberKind.MOBILE, "+55${ddd}9$sub", ddd)
            else -> result(input, NumberKind.INVALID, null, null)
        }
    }

    private fun nonGeo(input: String, digits: String): NormalizedNumber? {
        for ((prefix, kind) in NON_GEO_PREFIXES) {
            if (digits.startsWith(prefix) && (digits.length == 11 || digits.length == 10)) {
                return result(input, kind, "+55${digits.substring(1)}", null)
            }
        }
        return null
    }

    fun normalize(raw: String?, userDdd: String? = null): NormalizedNumber {
        val input = raw ?: ""
        val trimmed = input.trim()
        if (trimmed.lowercase() in HIDDEN_TOKENS) return result(input, NumberKind.HIDDEN, null, null)

        val hasPlus = trimmed.startsWith("+")
        val digits = trimmed.filter { it in '0'..'9' }
        if (digits.isEmpty()) return result(input, NumberKind.HIDDEN, null, null)
        if (isEmergencyInAnyForm(digits)) return result(input, NumberKind.EMERGENCY, null, null)

        if (hasPlus) {
            if (digits.startsWith("55")) {
                val rest = digits.substring(2)
                nonGeo(input, "0$rest")?.let { return it }
                if (NON_GEO_UNIQUE.matches(rest)) return result(input, NumberKind.NON_GEO_UNIQUE, "+55$rest", null)
                return fromNational(input, rest)
            }
            return if (digits.length in 8..15) result(input, NumberKind.INTERNATIONAL, "+$digits", null)
            else result(input, NumberKind.INVALID, null, null)
        }

        if (digits.length <= 5) {
            return when {
                isEmergencyOrUtility(digits) -> result(input, NumberKind.EMERGENCY, null, null)
                digits.length >= 4 -> result(input, NumberKind.SHORT_CODE, null, null)
                else -> result(input, NumberKind.INVALID, null, null)
            }
        }

        if (digits.startsWith("00")) {
            val intl = digits.substring(4)
            if (intl.startsWith("55")) return normalize("+$intl", userDdd).copy(input = input)
            return if (intl.length in 8..15) result(input, NumberKind.INTERNATIONAL, "+$intl", null)
            else result(input, NumberKind.INVALID, null, null)
        }

        if (digits.startsWith("0")) {
            nonGeo(input, digits)?.let { return it }
            return when (digits.length) {
                11, 12 -> fromNational(input, digits.substring(1))
                13, 14 -> fromNational(input, digits.substring(3))
                else -> result(input, NumberKind.INVALID, null, null)
            }
        }

        if (NON_GEO_UNIQUE.matches(digits)) return result(input, NumberKind.NON_GEO_UNIQUE, "+55$digits", null)

        if (digits.startsWith("55") && (digits.length == 12 || digits.length == 13)) {
            return fromNational(input, digits.substring(2))
        }

        if (digits.length == 10 || digits.length == 11) return fromNational(input, digits)

        if (digits.length == 8 || digits.length == 9) {
            return if (userDdd != null && userDdd in VALID_DDDS) fromNational(input, "$userDdd$digits")
            else result(input, NumberKind.LOCAL_NO_DDD, null, null)
        }

        return result(input, NumberKind.INVALID, null, null)
    }
}
