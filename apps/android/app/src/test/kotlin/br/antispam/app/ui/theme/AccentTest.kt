package br.antispam.app.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccentTest {
    @Test
    fun vermelhoDaMarcaJaPassaAaComBranco() {
        val brand = 0xFFDC2626.toInt()
        assertTrue(Accent.contrastWithWhite(brand) >= 4.5)
        assertEquals(brand, Accent.forWhiteText(brand))
    }

    @Test
    fun corClaraEscurecidaAteAa() {
        val adjusted = Accent.forWhiteText(0xFFFECACA.toInt())
        assertTrue(Accent.contrastWithWhite(adjusted) >= 4.5)
    }

    @Test
    fun paletaDaMarcaTemContrasteAa() {
        val white = 0xFFFFFFFF.toInt()
        assertTrue(Accent.contrast(white, 0xFF7F1D1D.toInt()) >= 4.5)
        assertTrue(Accent.contrast(0xFFFECACA.toInt(), 0xFF7F1D1D.toInt()) >= 4.5)
    }
}
