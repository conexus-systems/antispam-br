/**
 * Componentes base reutilizáveis (Card, Botão, Badge, Anel de Score).
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme, scoreColor } from './theme';

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: object; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Btn({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'warn';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: object;
}) {
  const bg =
    variant === 'primary' ? theme.primaryDim : variant === 'danger' ? theme.dangerDim : variant === 'warn' ? '#78350F' : 'transparent';
  const fg = variant === 'ghost' ? theme.textDim : variant === 'warn' ? '#FCD34D' : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: variant === 'ghost' ? theme.border : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : <Text style={[styles.btnText, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>}
    </Pressable>
  );
}

export function Badge({ text, color, filled }: { text: string; color: string; filled?: boolean }) {
  return (
    <View style={{ backgroundColor: filled ? color : 'transparent', borderColor: color, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: filled ? '#fff' : color, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ position: 'absolute', fontSize: size / 3.4, fontWeight: '800', color }}>{score}</Text>
    </View>
  );
}

export function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: theme.textDim, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: color ?? theme.text, fontSize: 14, fontWeight: '600', flexShrink: 1, marginLeft: 12, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.border, padding: theme.space(2) },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnText: { fontWeight: '700', fontSize: 15 },
});
