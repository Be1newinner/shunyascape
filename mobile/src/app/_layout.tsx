import { ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold, useFonts } from '@expo-google-fonts/chakra-petch';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/lib/config';

// Splash stays up until fonts and the saved session are loaded.
SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { ready, token, onboarded } = useAuth();
  const [fontsLoaded] = useFonts({ ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold });

  useEffect(() => {
    // The game screen keeps the splash up until its page has loaded.
    if (ready && fontsLoaded && !token) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsLoaded, token]);

  if (!ready || !fontsLoaded) return null;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!token && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!token && onboarded}>
        <Stack.Screen name="login" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="forgot" />
      </Stack.Protected>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="play" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar hidden />
      <Navigator />
    </AuthProvider>
  );
}
