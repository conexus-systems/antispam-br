package br.antispam.engine.dataset

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64

@Serializable
data class PublicationPolicy(
    @SerialName("min_weighted_reporters") val minWeightedReporters: Int,
    @SerialName("min_age_hours") val minAgeHours: Int,
    @SerialName("min_score") val minScore: Int,
)

@Serializable
data class ShardEntry(
    val id: String,
    val path: String,
    val version: Long,
    val sha256: String,
    val size: Long,
    @SerialName("record_count") val recordCount: Int,
)

@Serializable
data class DeltaEntry(
    val shard: String,
    @SerialName("from_version") val fromVersion: Long,
    @SerialName("to_version") val toVersion: Long,
    val path: String,
    val sha256: String,
    val size: Long,
    @SerialName("record_count") val recordCount: Int,
)

@Serializable
data class Manifest(
    @SerialName("schema_version") val schemaVersion: Int,
    val dataset: String,
    val version: Long,
    @SerialName("created_at") val createdAt: String,
    @SerialName("expires_at") val expiresAt: String,
    @SerialName("key_id") val keyId: String,
    val compression: String,
    @SerialName("record_count") val recordCount: Long,
    @SerialName("publication_policy") val publicationPolicy: PublicationPolicy,
    val shards: List<ShardEntry>,
    val deltas: List<DeltaEntry> = emptyList(),
)

enum class VerifyFailure { BAD_SIGNATURE, UNKNOWN_KEY, TEST_KEY_REJECTED, BAD_SCHEMA, ROLLBACK, EXPIRED, UNSUPPORTED_COMPRESSION, BAD_PATH }

sealed interface VerifyResult {
    data class Ok(val manifest: Manifest) : VerifyResult
    data class Failed(val reason: VerifyFailure) : VerifyResult
}

/**
 * Verificação de manifest — DATASET_FORMAT.md §2. A assinatura é checada **antes** de qualquer
 * campo ser usado (só `key_id` é lido para escolher a chave).
 */
class ManifestVerifier(
    private val trustedKeys: Map<String, ByteArray>,
    private val allowTestKeys: Boolean,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val pathRegex = Regex("^brazil/(deltas/)?[a-z0-9.-]+\\.bin\\.gz$")

    fun verify(manifestBytes: ByteArray, signatureB64: String, installedVersion: Long?, now: Instant): VerifyResult {
        val manifest = try {
            json.decodeFromString(Manifest.serializer(), manifestBytes.decodeToString())
        } catch (e: Exception) {
            return VerifyResult.Failed(VerifyFailure.BAD_SCHEMA)
        }
        if (manifest.keyId.startsWith("test-") && !allowTestKeys) return VerifyResult.Failed(VerifyFailure.TEST_KEY_REJECTED)
        val key = trustedKeys[manifest.keyId] ?: return VerifyResult.Failed(VerifyFailure.UNKNOWN_KEY)
        if (!ed25519Verify(key, manifestBytes, signatureB64)) return VerifyResult.Failed(VerifyFailure.BAD_SIGNATURE)

        if (manifest.schemaVersion != 1 || manifest.dataset != "br-calls") return VerifyResult.Failed(VerifyFailure.BAD_SCHEMA)
        if (installedVersion != null && manifest.version <= installedVersion) return VerifyResult.Failed(VerifyFailure.ROLLBACK)
        val expires = runCatching { Instant.parse(manifest.expiresAt) }.getOrNull()
            ?: return VerifyResult.Failed(VerifyFailure.BAD_SCHEMA)
        if (!now.isBefore(expires)) return VerifyResult.Failed(VerifyFailure.EXPIRED)
        if (manifest.compression != "gzip") return VerifyResult.Failed(VerifyFailure.UNSUPPORTED_COMPRESSION)
        val paths = manifest.shards.map { it.path } + manifest.deltas.map { it.path }
        if (paths.any { !pathRegex.matches(it) || ".." in it }) return VerifyResult.Failed(VerifyFailure.BAD_PATH)
        return VerifyResult.Ok(manifest)
    }

    companion object {
        fun ed25519Verify(publicKey: ByteArray, message: ByteArray, signatureB64: String): Boolean = try {
            val sig = Base64.getDecoder().decode(signatureB64.trim())
            if (publicKey.size != 32 || sig.size != 64) false
            else Ed25519Signer().run {
                init(false, Ed25519PublicKeyParameters(publicKey, 0))
                update(message, 0, message.size)
                verifySignature(sig)
            }
        } catch (e: IllegalArgumentException) {
            false
        }

        fun sha256Hex(bytes: ByteArray): String =
            MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    }
}
