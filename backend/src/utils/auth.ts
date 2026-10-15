import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

// scrypt with a random per-user salt. Stored as `scrypt$<salt>$<hash>` (base64).
// Hashing is async so a login never blocks the event loop.
const SCRYPT_OPTIONS: crypto.ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt$';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  // Development only: a per-process secret, so sessions end on restart instead
  // of being signed with a secret that is published in the repository.
  console.warn('JWT_SECRET is not set; using a random development secret.');
  return crypto.randomBytes(32).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${HASH_PREFIX}${salt.toString('base64')}$${key.toString('base64')}`;
}

export type PasswordCheck = 'valid' | 'invalid' | 'needs-reset';

/**
 * Hashes from before per-user salts can't be verified safely any more; those
 * accounts must set a new password through the reset flow.
 */
export async function verifyPassword(password: string, stored: string): Promise<PasswordCheck> {
  if (!stored?.startsWith(HASH_PREFIX)) return 'needs-reset';
  const [saltB64, hashB64] = stored.slice(HASH_PREFIX.length).split('$');
  if (!saltB64 || !hashB64) return 'invalid';
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT_OPTIONS);
  return crypto.timingSafeEqual(actual, expected) ? 'valid' : 'invalid';
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  exp?: number;
  iat?: number;
}

export function signToken(payload: Omit<TokenPayload, 'exp' | 'iat'> | Record<string, unknown>, expiresIn: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = Buffer.from(JSON.stringify(header)).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  let exp = now;
  if (expiresIn.endsWith('d')) {
    exp += parseInt(expiresIn) * 24 * 60 * 60;
  } else if (expiresIn.endsWith('m')) {
    exp += parseInt(expiresIn) * 30 * 24 * 60 * 60;
  } else if (expiresIn.endsWith('h')) {
    exp += parseInt(expiresIn) * 60 * 60;
  } else if (expiresIn.endsWith('s')) {
    exp += parseInt(expiresIn);
  }

  const fullPayload = { ...payload, exp, iat: now };
  const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerStr}.${payloadStr}`)
    .digest('base64url');

  return `${headerStr}.${payloadStr}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerStr}.${payloadStr}`)
      .digest();
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expectedSignature.length || !crypto.timingSafeEqual(given, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8')) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}
