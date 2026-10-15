import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

/**
 * The whole game is the ShunyaScape web app in a full-screen WebView: one
 * codebase for browser and app. The site adds on-screen controls and the phone
 * graphics preset itself (it recognises the app by its user agent).
 */
/** The site's address, e.g. https://play.example.com — set EXPO_PUBLIC_GAME_URL in mobile/.env. */
const GAME_URL = (process.env.EXPO_PUBLIC_GAME_URL ?? '').replace(/\/$/, '');
const GAME_ORIGIN = GAME_URL ? new URL(GAME_URL).origin : '';
/** The site checks for this to skip the landing page and hide Google sign-in (Google blocks it in web views). */
const APP_USER_AGENT = 'ShunyaScapeApp/1.0';

export default function GameView() {
  useKeepAwake();
  const webview = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Shooters are played sideways.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  // Android back button navigates inside the game before leaving the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        webview.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // Pages from the game's own site stay in the app; everything else opens in the browser.
  const onNavigate = useCallback((req: WebViewNavigation) => {
    if (req.url.startsWith('about:') || req.url.startsWith(GAME_ORIGIN)) return true;
    WebBrowser.openBrowserAsync(req.url).catch(() => {});
    return false;
  }, []);

  if (!GAME_URL) {
    SplashScreen.hideAsync().catch(() => {});
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Game address not set</Text>
        <Text style={styles.errorText}>Set EXPO_PUBLIC_GAME_URL in mobile/.env and restart Expo.</Text>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Can&apos;t reach ShunyaScape</Text>
        <Text style={styles.errorText}>Check your internet connection and try again.</Text>
        <Pressable
          style={styles.retry}
          onPress={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      key={attempt}
      ref={webview}
      source={{ uri: `${GAME_URL}/battleground` }}
      style={styles.web}
      containerStyle={styles.web}
      applicationNameForUserAgent={APP_USER_AGENT}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsBackForwardNavigationGestures={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      contentInsetAdjustmentBehavior="never"
      androidLayerType="hardware"
      webviewDebuggingEnabled={__DEV__}
      onShouldStartLoadWithRequest={onNavigate}
      onNavigationStateChange={(nav) => {
        canGoBack.current = nav.canGoBack;
      }}
      onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
      onError={() => {
        SplashScreen.hideAsync().catch(() => {});
        setFailed(true);
      }}
      // The game's 3D page can be killed in the background on low-memory phones: reload it.
      onRenderProcessGone={() => setAttempt((a) => a + 1)}
      onContentProcessDidTerminate={() => webview.current?.reload()}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#070b12' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#070b12' },
  errorTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  errorText: { color: '#b8c2d1', fontSize: 15, textAlign: 'center' },
  retry: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5a623' },
  retryText: { color: '#2a1700', fontSize: 16, fontWeight: '700' },
});
