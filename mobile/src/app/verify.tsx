import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Backdrop, Body, Card, ErrorText, Eyebrow, Field, GoldButton, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/config';

/** Enter the 6-digit code emailed after registering (or signing in unverified). */
export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.verifyOtp(email ?? '', code.trim());
      if (res.appToken) await signIn(res.appToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop source={require('@/assets/images/login-bg.webp')}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Eyebrow>Check your email</Eyebrow>
            <Title size={24}>Enter your code</Title>
            <Body>We sent a 6-digit code to {email}. It expires in 10 minutes.</Body>
            <Field label="Code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" returnKeyType="go" onSubmitEditing={submit} style={styles.code} />
            <ErrorText>{error}</ErrorText>
            <GoldButton title="Verify" onPress={submit} busy={busy} />
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.link}>No code? Go back and sign in again for a new one.</Text>
            </Pressable>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: 400, maxWidth: '100%' },
  code: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: 10, textAlign: 'center', height: 52 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.gold, textAlign: 'center' },
});
