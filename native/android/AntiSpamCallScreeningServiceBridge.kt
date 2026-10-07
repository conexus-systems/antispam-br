package br.antispam.app.screening

import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Ponte serviço nativo ↔ JS (single-flight com timeout e cache de decisões).
 *
 * Fluxo de uma chamada recebida:
 *  1. requestDecisionBlocking() registra um pending, emite evento onIncomingCall ao JS
 *     e espera o future (notifyDecision) até TIMEOUT_MS.
 *  2. Cache LRU de decisões recentes (cooldown ≥ 30 s) é consultado ANTES de acordar o JS —
 *     caminho quente fica em ~1 ms (meta p95 < 100 ms).
 *  3. Sem resposta no prazo, sem JS ou sem papel ativo → ALLOW (fail-safe §24).
 */
object AntiSpamCallScreeningServiceBridge {
  private const val TAG = "AntiSpamScreening"

  private const val CACHE_LIMIT = 128
  private const val CACHE_TTL_MS = 30_000L

  /** Tempera o cache: decisões ALLOW de números desconhecidos não viram atalho eterno. */
  private val CACHEABLE_ACTIONS = setOf("BLOCK", "SILENCE", "WARN")

  private val seq = AtomicLong(0)
  private val pending = ConcurrentHashMap<String, PendingDecision>()
  private val cache = object : LinkedHashMap<String, CacheEntry>(64, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CacheEntry>): Boolean =
      size > CACHE_LIMIT
  }
  private val cacheLock = ReentrantLock()

  @Volatile
  private var emitter: ((number: String, presentation: String) -> Unit)? = null

  private class PendingDecision(val latch: java.util.concurrent.CountDownLatch) {
    @Volatile
    var action: String = "ALLOW"
  }

  private class CacheEntry(val action: String, val at: Long)

  fun init(onCall: (number: String, presentation: String) -> Unit) {
    emitter = onCall
  }

  fun shutdown() {
    emitter = null
    cacheLock.withLock { cache.clear() }
    // Libera pendentes que ficarem presos (fail-safe → ALLOW)
    for (p in pending.values) p.latch.countDown()
    pending.clear()
  }

  fun requestDecisionBlocking(number: String, presentation: String, timeoutMs: Long): Decision {
    if (emitter == null) return Decision("ALLOW", "NO_JS")

    cacheLock.withLock {
      cache[number]?.let { hit ->
        if (System.currentTimeMillis() - hit.at <= CACHE_TTL_MS) {
          return Decision(hit.action, "CACHE")
        }
        cache.remove(number)
      }
    }

    val key = "${number}:${seq.incrementAndGet()}"
    val p = PendingDecision(java.util.concurrent.CountDownLatch(1))
    pending[key] = p
    try {
      try {
        emitter?.invoke(number, presentation)
      } catch (e: Exception) {
        Log.e(TAG, "emit onIncomingCall falhou", e)
        return Decision("ALLOW", "EMIT_FAIL")
      }
      val answered = p.latch.await(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS)
      val source = if (answered) "JS" else "TIMEOUT"
      val action = if (answered) p.action else "ALLOW"
      if (action in CACHEABLE_ACTIONS) {
        cacheLock.withLock { cache[number] = CacheEntry(action, System.currentTimeMillis()) }
      }
      return Decision(action, source)
    } catch (e: InterruptedException) {
      Thread.currentThread().interrupt()
      return Decision("ALLOW", "INTERRUPTED")
    } finally {
      pending.remove(key)
    }
  }

  fun publishDecision(number: String, action: String) {
    val valid = action in setOf("ALLOW", "WARN", "SILENCE", "BLOCK")
    val resolved = if (valid) action else "ALLOW"
    // Entrega a TODOS os pendentes com esse número (ignora o sufixo seq).
    for ((key, p) in pending) {
      if (key.substringBeforeLast(':') == number) {
        p.action = resolved
        p.latch.countDown()
      }
    }
  }

  data class Decision(val action: String, val source: String)
}
