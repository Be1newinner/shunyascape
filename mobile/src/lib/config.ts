/** The ShunyaScape website (game + API proxy), e.g. https://shunyascape.shipsar.in — set in mobile/.env. */
export const GAME_URL = (process.env.EXPO_PUBLIC_GAME_URL ?? '').replace(/\/$/, '');
export const GAME_ORIGIN = GAME_URL ? new URL(GAME_URL).origin : '';

/** Google OAuth client IDs (Google Cloud console). The web one is the backend's GOOGLE_CLIENT_ID. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/** Added to the WebView's user agent: the site then hands sign-in over to the app. */
export const APP_USER_AGENT = 'ShunyaScapeApp/1.0';

export const colors = {
  bg: '#070b12',
  panel: 'rgba(12, 17, 28, 0.86)',
  line: 'rgba(255, 255, 255, 0.14)',
  ink: '#ffffff',
  inkDim: '#b8c2d1',
  gold: '#ffc23d',
  goldDeep: '#f39a12',
  goldInk: '#2a1700',
  danger: '#ff5a5f',
};

export const fonts = {
  medium: 'ChakraPetch_500Medium',
  semibold: 'ChakraPetch_600SemiBold',
  bold: 'ChakraPetch_700Bold',
};
