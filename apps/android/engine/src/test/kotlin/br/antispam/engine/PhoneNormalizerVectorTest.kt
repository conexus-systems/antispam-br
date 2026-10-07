package br.antispam.engine

import br.antispam.engine.phone.PhoneNormalizer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import kotlin.test.assertEquals

class PhoneNormalizerVectorTest {
    @TestFactory
    fun vectors(): List<DynamicTest> = Vectors.json("phone-normalization.json")["cases"]!!.jsonArray.map { el ->
        val c = el.jsonObject
        val input = c["input"]!!.jsonPrimitive.content
        val ddd = c["user_ddd"]!!.takeIf { it != JsonNull }?.jsonPrimitive?.content
        DynamicTest.dynamicTest("normalize '$input' ddd=$ddd") {
            val r = PhoneNormalizer.normalize(input, ddd)
            assertEquals(c["kind"]!!.jsonPrimitive.content, r.kind.name, "kind")
            assertEquals(c["e164"]!!.jsonPrimitive.contentOrNull, r.e164, "e164")
            assertEquals(c["shard"]!!.jsonPrimitive.contentOrNull, r.shard, "shard")
        }
    }
}
