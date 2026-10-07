package br.antispam.engine

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.io.File

object Vectors {
    val dir: File = File(requireNotNull(System.getProperty("testVectorsDir")) { "testVectorsDir não definido" })

    fun json(path: String): JsonObject = Json.parseToJsonElement(File(dir, path).readText()).jsonObject
}
