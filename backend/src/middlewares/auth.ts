import { Request, Response, NextFunction } from 'express';
import { verifyToken, signToken } from '../utils/auth';
import User from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    if (!accessToken && !refreshToken) {
      req.user = null;
      next();
      return;
    }

    // 1. Try to verify access token
    if (accessToken) {
      const payload = verifyToken(accessToken);
      if (payload) {
        // Access token is valid. Verify session version in DB
        const user = await User.findById(payload.userId);
        if (user && user.currentSessionId === payload.sessionId) {
          req.user = user;
          next();
          return;
        }
      }
    }

    // 2. If access token is invalid/expired, try refresh token
    if (refreshToken) {
      const payload = verifyToken(refreshToken);
      if (payload) {
        const user = await User.findById(payload.userId);
        // Verify that the refresh token matches the one in DB and session matches
        if (
          user &&
          user.currentRefreshToken === refreshToken &&
          user.currentSessionId === payload.sessionId
        ) {
          // Generate new access token
          const newAccessToken = signToken(
            { userId: user._id, email: user.email, role: user.role, sessionId: user.currentSessionId },
            '1d'
          );
          
          // Set new cookie in Express (maxAge is in milliseconds)
          res.cookie('accessToken', newAccessToken, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
          });

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
