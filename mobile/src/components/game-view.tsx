import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { Body, GoldButton, Title } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { APP_USER_AGENT, GAME_ORIGIN, GAME_URL, colors } from '@/lib/config';

/**
 * The game (lobby, matches) is the ShunyaScape website in a full-screen
 * WebView. The app logs the WebView into its own session with a one-time
 * handoff code, then listens for the site saying the session ended.
 */
export default function GameView() {
  useKeepAwake();
  const { token, signOut } = useAuth();
  const webview = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Shooters are played sideways.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  // Exchange the app session for a one-time code the WebView turns into site cookies.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .handoff(token)
      .then(({ code }) => {
        if (!cancelled) setUri(`${GAME_URL}/api/auth/handoff?code=${encodeURIComponent(code)}&next=%2Fbattleground`);
      })
      .catch((err) => {
        if (cancelled) return;
        // Session gone (signed in on another device, or expired): back to login.
        if (err instanceof ApiError && err.status === 401) signOut({ remote: false });
        else {
          SplashScreen.hideAsync().catch(() => {});
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt, signOut]);

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

  // The site tells us when you log out or the session ends; the native login takes over.
  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let type = '';
      try {
        type = (JSON.parse(e.nativeEvent.data) as { type?: string }).type ?? '';
      } catch {
        return;
      }
      if (type === 'logout' || type === 'session-expired' || type === 'auth-required') signOut({ remote: false });
    },
    [signOut],
  );

  const retry = () => {
    setFailed(false);
    setUri(null);
    setAttempt((a) => a + 1);
  };

  if (failed) {
    return (
      <View style={styles.center}>
        <Title size={22}>Can&apos;t reach ShunyaScape</Title>
        <Body>Check your internet connection and try again.</Body>
        <GoldButton title="Try again" onPress={retry} style={{ marginTop: 8, minWidth: 180 }} />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <WebView
      key={attempt}
      ref={webview}
      source={{ uri }}
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
      webviewDebuggingEnabled={__DEV__}
      onShouldStartLoadWithRequest={onNavigate}
      onMessage={onMessage}
      onNavigationStateChange={(nav) => {
        canGoBack.current = nav.canGoBack;
      }}
      onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
      onError={() => {
        SplashScreen.hideAsync().catch(() => {});
        setFailed(true);
      }}
      // The 3D page can be killed in the background on low-memory phones: start it again.
      onRenderProcessGone={retry}
      onContentProcessDidTerminate={retry}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.bg },
});
