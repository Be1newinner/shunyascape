/** The ShunyaScape mobile app (an Expo WebView) adds this to its user agent. */
export const NATIVE_APP_UA = "ShunyaScapeApp";

export function isNativeApp() {
  return typeof navigator !== "undefined" && navigator.userAgent.includes(NATIVE_APP_UA);
}
