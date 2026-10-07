package br.antispam.engine.rules

import br.antispam.engine.Action
import br.antispam.engine.phone.NormalizedNumber
import br.antispam.engine.phone.PhoneNormalizer

enum class RuleType { EXACT, PREFIX, REGEX }

data class UserRule(
    val id: Long = 0,
    val type: RuleType,
    val pattern: String,
    val action: Action,
    val label: String? = null,
    val enabled: Boolean = true,
)

/**
 * Conjunto compilado de regras do usuário. Imutável — o app recompila quando as listas mudam
 * e o serviço de triagem só lê o snapshot (sem I/O no caminho da chamada).
 *
 * Precedência: qualquer regra ALLOW que case vence; senão EXACT > PREFIX (mais longo) > REGEX.
 */
class RuleSet private constructor(
    private val exact: Map<String, UserRule>,
    private val prefixes: List<Pair<String, UserRule>>,
    private val regexes: List<Pair<Regex, UserRule>>,
    val rejected: List<Pair<UserRule, String>>,
) {
    fun match(number: NormalizedNumber): UserRule? {
        val forms = number.matchForms
        if (forms.isEmpty()) return null
        val candidates = buildList {
            addAll(forms.mapNotNull { exact[it] })
            addAll(prefixes.filter { (p, _) -> forms.any { it.startsWith(p) } }.map { it.second })
            addAll(regexes.filter { (r, _) -> forms.any { r.matches(it) } }.map { it.second })
        }
        return candidates.firstOrNull { it.action == Action.ALLOW } ?: candidates.firstOrNull()
    }

    val size: Int get() = exact.size + prefixes.size + regexes.size

    companion object {
        const val MAX_REGEX_LENGTH = 128
        const val MAX_PREFIX_LENGTH = 16

        val EMPTY: RuleSet = compile(emptyList())

        fun compile(rules: List<UserRule>, userDdd: String? = null): RuleSet {
            val exact = HashMap<String, UserRule>()
            val prefixes = mutableListOf<Pair<String, UserRule>>()
            val regexes = mutableListOf<Pair<Regex, UserRule>>()
            val rejected = mutableListOf<Pair<UserRule, String>>()

            for (rule in rules.filter { it.enabled }) {
                when (rule.type) {
                    RuleType.EXACT -> {
                        val n = PhoneNormalizer.normalize(rule.pattern, userDdd)
                        val key = n.e164 ?: rule.pattern.filter { it.isDigit() }.ifEmpty { null }
                        if (key == null) rejected += rule to "número inválido"
                        else {
                            val prev = exact[key]
                            if (prev == null || rule.action == Action.ALLOW) exact[key] = rule
                        }
                    }
                    RuleType.PREFIX -> {
                        val p = rule.pattern.trim().let { if (it.startsWith("+")) "+" + it.filter(Char::isDigit) else it.filter(Char::isDigit) }
                        if (p.length < 2 || p.length > MAX_PREFIX_LENGTH) rejected += rule to "prefixo deve ter 2–$MAX_PREFIX_LENGTH dígitos"
                        else prefixes += p to rule
                    }
                    RuleType.REGEX -> {
                        // Entradas têm no máximo ~20 caracteres, o que limita o custo de backtracking;
                        // ainda assim padrões longos são recusados.
                        if (rule.pattern.length > MAX_REGEX_LENGTH) rejected += rule to "regex maior que $MAX_REGEX_LENGTH caracteres"
                        else runCatching { Regex(rule.pattern) }
                            .onSuccess { regexes += it to rule }
                            .onFailure { rejected += rule to "regex inválida" }
                    }
                }
            }
            prefixes.sortByDescending { it.first.length }
            return RuleSet(exact, prefixes, regexes, rejected)
        }
    }
}
