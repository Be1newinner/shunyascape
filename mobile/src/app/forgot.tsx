import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Backdrop, Body, Card, ErrorText, Eyebrow, Field, GoldButton, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, fonts } from '@/lib/config';

/** Reset a password with an emailed code (also how Google-only accounts add a password). */
export default function Forgot() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await api.forgotPassword(email.trim().toLowerCase());
      setStep('reset');
    });

  const reset = () =>
    run(async () => {
      if (password.length < 6) throw new Error('Use at least 6 characters for your password.');
      await api.resetPassword(email.trim().toLowerCase(), code.trim(), password);
      setStep('done');
    });

  return (
    <Backdrop source={require('@/assets/images/login-bg.webp')}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Eyebrow>Account</Eyebrow>
            <Title size={24}>{step === 'done' ? 'Password updated' : 'Reset password'}</Title>
            {step === 'email' && (
              <>
                <Body>We&apos;ll email you a code to set a new password.</Body>
                <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={sendCode} />
                <ErrorText>{error}</ErrorText>
                <GoldButton title="Send code" onPress={sendCode} busy={busy} />
              </>
            )}
            {step === 'reset' && (
              <>
                <Body>Enter the code we sent to {email} and choose a new password.</Body>
                <Field label="Code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" />
                <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" onSubmitEditing={reset} />
                <ErrorText>{error}</ErrorText>
                <GoldButton title="Set password" onPress={reset} busy={busy} />
              </>
            )}
            {step === 'done' && (
              <>
                <Body>You can sign in with your new password now.</Body>
                <GoldButton title="Back to sign in" onPress={() => router.back()} />
              </>
            )}
            {step !== 'done' && (
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text style={styles.link}>Back to sign in</Text>
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
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: 420, maxWidth: '100%' },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.gold, textAlign: 'center' },
});
