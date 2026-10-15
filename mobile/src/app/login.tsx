import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop, Body, Card, ErrorText, Eyebrow, Field, GhostButton, GoldButton, Title } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/config';
import { GoogleUnavailableError, googleIdToken } from '@/lib/google';

type Mode = 'signin' | 'register';

/** One screen for signing in and creating an account (email or Google). */
export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    setError('');
    const e = email.trim().toLowerCase();
    if (!e || !password || (mode === 'register' && !name.trim())) {
      setError('Fill in every field.');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('Use at least 6 characters for your password.');
      return;
    }
    setBusy('email');
    try {
      if (mode === 'register') {
        await api.register(name.trim(), e, password);
        router.push({ pathname: '/verify', params: { email: e } });
      } else {
        const res = await api.login(e, password);
        if (res.appToken) await signIn(res.appToken);
      }
    } catch (err) {
      if (err instanceof ApiError && err.body.requiresVerification) {
        router.push({ pathname: '/verify', params: { email: e } });
      } else if (err instanceof ApiError && err.body.requiresPasswordReset) {
        router.push({ pathname: '/forgot', params: { email: e } });
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError('');
    setBusy('google');
    try {
      const idToken = await googleIdToken();
      if (!idToken) return; // cancelled
      const res = await api.google(idToken);
      if (res.appToken) await signIn(res.appToken);
    } catch (err) {
      setError(err instanceof GoogleUnavailableError || err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Backdrop source={require('@/assets/images/login-bg.webp')}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.row, { paddingLeft: insets.left + 28, paddingRight: insets.right + 28 }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} contentFit="contain" />
            <Eyebrow>Battle royale</Eyebrow>
            <Title size={34}>ShunyaScape</Title>
            <Body>30 soldiers. One island. Be the last one standing.</Body>
            <GhostButton
              title={busy === 'google' ? 'Connecting…' : 'Continue with Google'}
              onPress={google}
              disabled={!!busy}
              icon={<Text style={styles.g}>G</Text>}
              style={styles.google}
            />
            <Text style={styles.orEmail}>or use your email →</Text>
          </View>

          <Card style={styles.card}>
            <View style={styles.tabs}>
              {(['signin', 'register'] as Mode[]).map((m) => (
                <Pressable key={m} onPress={() => { setMode(m); setError(''); }} style={[styles.tab, mode === m && styles.tabOn]}>
                  <Text style={[styles.tabText, mode === m && styles.tabTextOn]}>{m === 'signin' ? 'Sign in' : 'Register'}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'register' && (
              <Field label="Player name" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} maxLength={24} />
            )}
            <Field
              ref={emailRef}
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <ErrorText>{error}</ErrorText>
            <GoldButton title={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} busy={busy === 'email'} disabled={!!busy} />
            {mode === 'signin' && (
              <Pressable onPress={() => router.push({ pathname: '/forgot', params: { email: email.trim() } })} hitSlop={8}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 28, paddingVertical: 20 },
  brand: { flex: 1, maxWidth: 360, gap: 8 },
  logo: { width: 64, height: 64, marginBottom: 6 },
  card: { width: 360, maxWidth: '55%', gap: 10, padding: 16 },
  tabs: { flexDirection: 'row', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', padding: 3 },
  tab: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.gold },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.inkDim },
  tabTextOn: { color: colors.goldInk },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.gold, textAlign: 'center' },
  google: { marginTop: 14, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.12)' },
  orEmail: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkDim, letterSpacing: 1, marginTop: 4 },
  g: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
});
