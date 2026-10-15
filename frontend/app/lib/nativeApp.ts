/** The ShunyaScape mobile app (an Expo WebView) adds this to its user agent. */
export const NATIVE_APP_UA = "ShunyaScapeApp";

export function isNativeApp() {
  return typeof navigator !== "undefined" && navigator.userAgent.includes(NATIVE_APP_UA);
}

/** Events the site sends to the app; the app handles sign-in natively. */
export type AppEvent = "auth-required" | "logout" | "session-expired";

export function postToApp(type: AppEvent) {
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
  bridge?.postMessage(JSON.stringify({ type }));
}
