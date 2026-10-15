import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { verifyToken, signToken } from '../utils/auth';
import User from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const ACCESS_TOKEN_MS = 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * After a refresh token is rotated, the old one still works this long, so
 * several requests sent at once with the old cookie don't sign the player out.
 */
const ROTATION_GRACE_MS = 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function claimsOf(user: any) {
  return { userId: user._id, email: user.email, role: user.role, sessionId: user.currentSessionId };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function signRefreshToken(user: any) {
  // `jti` makes every refresh token unique, even two issued in the same second.
  return signToken({ ...claimsOf(user), kind: 'refresh', jti: randomUUID() }, '30d');
}

/** Session cookies: access token (1 day) and refresh token (30 days), HTTP-only, SameSite=Lax. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setSessionCookies(res: Response, user: any, refreshToken: string) {
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookie('accessToken', signToken(claimsOf(user), '1d'), { ...cookie, maxAge: ACCESS_TOKEN_MS });
  res.cookie('refreshToken', refreshToken, { ...cookie, maxAge: REFRESH_TOKEN_MS });
}

/**
 * The access token expired (or is gone): swap the refresh token for a new
 * one and a new access token. Rotating on every refresh keeps active players
 * signed in indefinitely; 30 days without a visit ends the session.
 * Returns the user and their now-current refresh token, or null.
 */
async function refreshSession(refreshToken: string) {
  const payload = verifyToken(refreshToken);
  if (!payload) return null;
  const user = await User.findById(payload.userId);
  if (!user || !user.currentSessionId || user.currentSessionId !== payload.sessionId) return null;
  const recent = () => !!user.refreshRotatedAt && Date.now() - new Date(user.refreshRotatedAt).getTime() < ROTATION_GRACE_MS;

  if (user.currentRefreshToken === refreshToken) {
    const next = signRefreshToken(user);
    // Atomic: only one of several parallel requests gets to rotate.
    const rotated = await User.findOneAndUpdate(
      { _id: user._id, currentRefreshToken: refreshToken },
      { $set: { currentRefreshToken: next, previousRefreshToken: refreshToken, refreshRotatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (rotated) return { user: rotated, refreshToken: next };
    const fresh = await User.findById(user._id);
    if (fresh && fresh.previousRefreshToken === refreshToken && fresh.currentRefreshToken && fresh.currentSessionId === payload.sessionId) {
      return { user: fresh, refreshToken: fresh.currentRefreshToken as string };
    }
    return null;
  }
  // Another request rotated it a moment ago: hand out the token it got.
  if (user.previousRefreshToken === refreshToken && recent() && user.currentRefreshToken) {
    return { user, refreshToken: user.currentRefreshToken as string };
  }
  return null;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const accessToken = req.cookies?.accessToken;
    const cookieRefresh = req.cookies?.refreshToken;
    // The mobile app sends its session token as a bearer token.
    const auth = req.headers.authorization;
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;

    if (!accessToken && !cookieRefresh && !bearer) {
      req.user = null;
      next();
      return;
    }

    // 1. A valid access token for the current session.
    if (accessToken) {
      const payload = verifyToken(accessToken) as (ReturnType<typeof verifyToken> & { kind?: string }) | null;
      if (payload && !payload.kind) {
        const user = await User.findById(payload.userId);
        if (user && user.currentSessionId && user.currentSessionId === payload.sessionId) {
          req.user = user;
          next();
          return;
        }
      }
    }

    // 2. Website: the refresh cookie gets a new access token and is rotated.
    if (cookieRefresh) {
      const session = await refreshSession(cookieRefresh);
      if (session) {
        setSessionCookies(res, session.user, session.refreshToken);
        req.user = session.user;
        next();
        return;
      }
    }

    // 3. Mobile app: its token is good while the session it belongs to is (a new
    // sign-in anywhere or a logout ends it). The app gets a fresh one at every launch.
    if (bearer) {
      const payload = verifyToken(bearer);
      if (payload) {
        const user = await User.findById(payload.userId);
        if (user && user.currentSessionId && user.currentSessionId === payload.sessionId && user.currentRefreshToken) {
          req.user = user;
          next();
          return;
        }
      }
    }
  } catch (error) {
    console.error('Error authenticating user from cookies in Express middleware:', error);
  }

  req.user = null;
  next();
}

// Middleware to require authenticated user
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Middleware to require admin role
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  next();
}
