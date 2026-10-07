package br.antispam.engine.dataset

import br.antispam.engine.ReputationSource
import br.antispam.engine.phone.NormalizedNumber
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Fonte de reputação sobre o dataset instalado. Shards são mapeados em memória sob demanda;
 * [reload] troca o diretório ativo depois de uma atualização (leitores antigos continuam válidos
 * até o GC, porque o mmap mantém o arquivo vivo mesmo após remoção).
 */
class InstalledDataset(private val installer: DatasetInstaller) : ReputationSource {
    /** Diretório e cache trocados juntos: um leitor da versão antiga nunca entra no cache da nova. */
    private class Generation(val dir: File?, val version: Long?) {
        val readers = ConcurrentHashMap<String, ShardReader>()
    }

    @Volatile private var generation = Generation(installer.currentDir(), installer.installedState()?.version)

    val version: Long? get() = generation.version

    fun reload() {
        generation = Generation(installer.currentDir(), installer.installedState()?.version)
    }

    /** Abre todos os shards antecipadamente, fora do caminho da chamada. */
    fun warmUp() {
        val gen = generation
        gen.dir?.listFiles { f -> f.name.endsWith(".bin") }?.forEach { reader(gen, it.name.removeSuffix(".bin")) }
    }

    private fun reader(gen: Generation, shard: String): ShardReader? {
        gen.readers[shard]?.let { return it }
        val file = gen.dir?.let { File(it, "$shard.bin") }?.takeIf { it.isFile } ?: return null
        return runCatching { DatasetInstaller.mmap(file) }.getOrNull()?.also { gen.readers[shard] = it }
    }

    override fun lookup(number: NormalizedNumber): DatasetRecord? {
        val shard = number.shard ?: return null
        val key = number.key ?: return null
        return reader(generation, shard)?.find(key)
    }
}
