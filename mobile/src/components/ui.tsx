import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fonts } from '@/lib/config';

/** Full-screen game art with a dark gradient so text stays readable. */
export function Backdrop({ source, children }: { source: ImageSource | number; children: ReactNode }) {
  return (
    <View style={styles.fill}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient
        colors={['rgba(7,11,18,0.35)', 'rgba(7,11,18,0.7)', 'rgba(7,11,18,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export function GoldButton({ title, onPress, busy, disabled, style }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [styles.btnWrap, style, (pressed || disabled) && { opacity: 0.8 }]}>
      <LinearGradient colors={[colors.gold, colors.goldDeep]} style={styles.btn}>
        {busy ? <ActivityIndicator color={colors.goldInk} /> : <Text style={styles.btnText}>{title}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, icon, style, disabled }: { title: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.ghost, style, (pressed || disabled) && { opacity: 0.7 }]}>
      {icon}
      <Text style={styles.ghostText}>{title}</Text>
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string }>(function Field({ label, style, ...props }, ref) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput ref={ref} placeholderTextColor="rgba(255,255,255,0.35)" style={[styles.input, style]} {...props} />
    </View>
  );
});

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children, size = 30 }: { children: ReactNode; size?: number }) {
  return <Text style={[styles.title, { fontSize: size }]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.body, style as object]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  btnWrap: { borderRadius: 12, overflow: 'hidden' },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: 2, textTransform: 'uppercase', color: colors.goldInk },
  ghost: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  ghostText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  field: { gap: 5 },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.inkDim },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 18,
    gap: 12,
  },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: colors.gold },
  title: { fontFamily: fonts.bold, color: colors.ink, textTransform: 'uppercase', letterSpacing: 1 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.inkDim },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },
});
