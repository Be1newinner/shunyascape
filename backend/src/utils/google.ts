import { OAuth2Client } from 'google-auth-library';

// "Sign in with Google" (Google Identity Services). The browser gets a signed
// ID token from Google and posts it to us; we verify it here and never see a
// Google password or need a client secret.

const client = new OAuth2Client();

/** OAuth client ID from Google Cloud Console, or null if Google sign-in is off. */
export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID || null;
}

export interface GoogleProfile {
  /** Stable Google account id. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Verify a Google ID token: signature against Google's published keys,
 * issuer, expiry, and that it was issued for our client ID.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const audience = googleClientId();
  if (!audience) throw new Error('GOOGLE_CLIENT_ID is not configured');

  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Google token is missing the account id or email');
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase().trim(),
    emailVerified: payload.email_verified === true,
    name: payload.name?.trim() || null,
  };
}
