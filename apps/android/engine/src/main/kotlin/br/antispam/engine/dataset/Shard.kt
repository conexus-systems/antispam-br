package br.antispam.engine.dataset

import br.antispam.engine.Category
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.GZIPInputStream

/** docs/specs/DATASET_FORMAT.md §3. */
object ShardFormat {
    const val HEADER_SIZE = 32
    const val RECORD_SIZE = 16
    const val FORMAT_VERSION = 1
    const val KIND_FULL = 0
    const val KIND_DELTA = 1
    val MAGIC = byteArrayOf('A'.code.toByte(), 'S'.code.toByte(), 'B'.code.toByte(), 'R'.code.toByte())

    const val FLAG_TOMBSTONE = 1
    const val FLAG_CAMPAIGN = 1 shl 1
    const val FLAG_DISPUTED = 1 shl 2
    const val FLAG_VERIFIED_ORG = 1 shl 3

    /** Limite contra gzip bomb — 4 M registros. */
    const val MAX_RECORDS = 4_000_000
}

class DatasetFormatException(message: String) : Exception(message)

data class DatasetRecord(
    val number: Long,
    val score: Int,
    val category: Category,
    val confidence: Int,
    val flags: Int,
    val reporters: Int,
    val lastSeenDay: Int,
) {
    val isTombstone get() = flags and ShardFormat.FLAG_TOMBSTONE != 0
    val isCampaign get() = flags and ShardFormat.FLAG_CAMPAIGN != 0
    val isDisputed get() = flags and ShardFormat.FLAG_DISPUTED != 0
    val isVerifiedOrg get() = flags and ShardFormat.FLAG_VERIFIED_ORG != 0
}

/**
 * Leitor de shard sobre um [ByteBuffer] (heap ou arquivo mapeado). Valida header, tamanho e
 * ordenação na construção; depois [find] é busca binária sem alocação além do resultado.
 */
class ShardReader(buffer: ByteBuffer, validateOrder: Boolean = true) {
    private val buf: ByteBuffer = buffer.duplicate().order(ByteOrder.BIG_ENDIAN)
    val kind: Int
    val count: Int
    val version: Long
    val fromVersion: Long

    init {
        if (buf.capacity() < ShardFormat.HEADER_SIZE) throw DatasetFormatException("arquivo menor que o header")
        for (i in 0 until 4) if (buf.get(i) != ShardFormat.MAGIC[i]) throw DatasetFormatException("magic inválido")
        if (buf.get(4).toInt() != ShardFormat.FORMAT_VERSION) throw DatasetFormatException("format_version não suportada")
        kind = buf.get(5).toInt()
        if (kind != ShardFormat.KIND_FULL && kind != ShardFormat.KIND_DELTA) throw DatasetFormatException("kind inválido")
        val rawCount = buf.getInt(8).toLong() and 0xffffffffL
        if (rawCount > ShardFormat.MAX_RECORDS) throw DatasetFormatException("record_count acima do limite")
        count = rawCount.toInt()
        if (buf.capacity().toLong() != ShardFormat.HEADER_SIZE + ShardFormat.RECORD_SIZE.toLong() * count) {
            throw DatasetFormatException("tamanho não confere com record_count")
        }
        version = buf.getLong(16)
        fromVersion = buf.getLong(24)
        if (validateOrder) {
            var prev = -1L
            for (i in 0 until count) {
                val n = numberAt(i)
                if (n <= prev) throw DatasetFormatException("registros fora de ordem")
                prev = n
                if (kind == ShardFormat.KIND_FULL && flagsAt(i) and ShardFormat.FLAG_TOMBSTONE != 0) {
                    throw DatasetFormatException("TOMBSTONE em shard FULL")
                }
            }
        }
    }

    private fun offset(i: Int) = ShardFormat.HEADER_SIZE + i * ShardFormat.RECORD_SIZE
    private fun numberAt(i: Int): Long = buf.getLong(offset(i))
    private fun flagsAt(i: Int): Int = buf.get(offset(i) + 11).toInt() and 0xff

    fun recordAt(i: Int): DatasetRecord {
        val o = offset(i)
        return DatasetRecord(
            number = buf.getLong(o),
            score = (buf.get(o + 8).toInt() and 0xff).coerceAtMost(100),
            category = Category.fromCode(buf.get(o + 9).toInt() and 0xff),
            confidence = (buf.get(o + 10).toInt() and 0xff).coerceAtMost(100),
            flags = buf.get(o + 11).toInt() and 0xff,
            reporters = buf.getShort(o + 12).toInt() and 0xffff,
            lastSeenDay = buf.getShort(o + 14).toInt() and 0xffff,
        )
    }

    fun find(number: Long): DatasetRecord? {
        var lo = 0
        var hi = count - 1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            val n = numberAt(mid)
            when {
                n < number -> lo = mid + 1
                n > number -> hi = mid - 1
                else -> return recordAt(mid)
            }
        }
        return null
    }

    fun records(): Sequence<DatasetRecord> = (0 until count).asSequence().map(::recordAt)
}

object ShardCodec {
    fun encode(kind: Int, version: Long, fromVersion: Long, records: List<DatasetRecord>): ByteArray {
        val sorted = records.sortedBy { it.number }
        for (i in 1 until sorted.size) {
            if (sorted[i].number == sorted[i - 1].number) throw DatasetFormatException("número duplicado")
        }
        val buf = ByteBuffer.allocate(ShardFormat.HEADER_SIZE + ShardFormat.RECORD_SIZE * sorted.size).order(ByteOrder.BIG_ENDIAN)
        buf.put(ShardFormat.MAGIC)
        buf.put(ShardFormat.FORMAT_VERSION.toByte())
        buf.put(kind.toByte())
        buf.putShort(0)
        buf.putInt(sorted.size)
        buf.putInt(0)
        buf.putLong(version)
        buf.putLong(fromVersion)
        for (r in sorted) {
            buf.putLong(r.number)
            buf.put(r.score.coerceIn(0, 100).toByte())
            buf.put(r.category.code.toByte())
            buf.put(r.confidence.coerceIn(0, 100).toByte())
            buf.put(r.flags.toByte())
            buf.putShort(r.reporters.coerceIn(0, 0xffff).toShort())
            buf.putShort(r.lastSeenDay.coerceIn(0, 0xffff).toShort())
        }
        return buf.array()
    }

    /** gunzip com teto de bytes (proteção contra gzip bomb). */
    fun gunzip(input: InputStream, maxBytes: Long): ByteArray {
        GZIPInputStream(input).use { gz ->
            val out = ByteArrayOutputStream()
            val chunk = ByteArray(64 * 1024)
            var total = 0L
            while (true) {
                val n = gz.read(chunk)
                if (n < 0) break
                total += n
                if (total > maxBytes) throw DatasetFormatException("conteúdo descomprimido excede o esperado")
                out.write(chunk, 0, n)
            }
            return out.toByteArray()
        }
    }

    /** Aplica delta sobre shard completo e devolve o novo shard completo codificado. */
    fun applyDelta(base: ShardReader, delta: ShardReader): ByteArray {
        if (base.kind != ShardFormat.KIND_FULL || delta.kind != ShardFormat.KIND_DELTA) throw DatasetFormatException("tipos incompatíveis")
        if (delta.fromVersion != base.version) throw DatasetFormatException("delta não parte da versão instalada")
        val merged = java.util.TreeMap<Long, DatasetRecord>()
        base.records().forEach { merged[it.number] = it }
        delta.records().forEach { if (it.isTombstone) merged.remove(it.number) else merged[it.number] = it }
        return encode(ShardFormat.KIND_FULL, delta.version, 0, merged.values.toList())
    }
}
