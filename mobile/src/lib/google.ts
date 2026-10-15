import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';

/**
 * Native Google sign-in. The module needs a development or store build; in
 * Expo Go (or before the client IDs are set) it reports itself unavailable.
 */
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let mod: GoogleModule | null | undefined;
function load(): GoogleModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@react-native-google-signin/google-signin') as GoogleModule;
    mod.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined });
  } catch {
    mod = null;
  }
  return mod;
}

export function googleAvailable() {
  return !!GOOGLE_WEB_CLIENT_ID && !!load();
}

export class GoogleUnavailableError extends Error {}

/** Returns a Google ID token for the backend, or null if the player cancelled. */
export async function googleIdToken(): Promise<string | null> {
  const g = load();
  if (!g || !GOOGLE_WEB_CLIENT_ID) {
    throw new GoogleUnavailableError('Google sign-in needs the installed app build.');
  }
  await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await g.GoogleSignin.signIn();
  if (!g.isSuccessResponse(res)) return null;
  if (!res.data.idToken) throw new Error("Google didn't return an ID token.");
  return res.data.idToken;
}

export async function signOutOfGoogle() {
  const g = load();
  if (!g) return;
  await g.GoogleSignin.signOut().catch(() => {});
}
