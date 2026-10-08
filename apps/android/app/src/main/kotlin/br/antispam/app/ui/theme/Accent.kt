package br.antispam.app.ui.theme

import kotlin.math.pow

/**
 * Accent math in plain ARGB ints (JVM-testable), same rule as the Conexus Launcher: tiles carry white
 * text, so the accent is darkened until white reaches WCAG AA (4.5:1).
 */
object Accent {
    fun luminance(color: Int): Double {
        fun channel(shift: Int): Double {
            val c = (color shr shift and 0xFF) / 255.0
            return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
        }
        return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
    }

    fun contrast(a: Int, b: Int): Double {
        val (hi, lo) = luminance(a).let { la -> luminance(b).let { lb -> maxOf(la, lb) to minOf(la, lb) } }
        return (hi + 0.05) / (lo + 0.05)
    }

    fun contrastWithWhite(color: Int) = 1.05 / (luminance(color) + 0.05)

    /** Darkens in 5% steps until white text passes AA; already compliant colors are returned unchanged. */
    fun forWhiteText(color: Int): Int {
        var current = color or 0xFF000000.toInt()
        repeat(40) {
            if (contrastWithWhite(current) >= 4.5) return current
            current = scale(current, 0.95)
        }
        return current
    }

    private fun scale(color: Int, factor: Double): Int {
        fun c(shift: Int) = ((color shr shift and 0xFF) * factor).toInt().coerceIn(0, 255)
        return (0xFF shl 24) or (c(16) shl 16) or (c(8) shl 8) or c(0)
    }
}
