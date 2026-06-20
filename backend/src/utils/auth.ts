import crypto from 'crypto';

const SALT = 'shunyascape-3d-secret-salt-string';
const JWT_SECRET = process.env.JWT_SECRET || 'shunyascape-secret-key-for-jwt-signing-12345678';

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  const inputHash = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(hash, 'hex'));
}

export function signToken(payload: any, expiresIn: string): string {
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

export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerStr, payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerStr}.${payloadStr}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}
