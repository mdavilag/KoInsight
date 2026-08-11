import crypto from 'crypto';
import { appConfig } from '../config';

/**
 * Simple single-credential dashboard auth.
 *
 * The session cookie holds an opaque token derived from the configured
 * credentials and secret. It carries no user data and is only ever compared
 * against the value we would generate ourselves, so there's nothing to decode.
 */

export function expectedToken(): string {
  const { username, password, secret } = appConfig.auth;
  return crypto.createHmac('sha256', secret).update(`${username}:${password}`).digest('hex');
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) {
    return false;
  }

  const expected = expectedToken();
  const given = Buffer.from(token);
  const wanted = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, so guard first.
  if (given.length !== wanted.length) {
    return false;
  }

  return crypto.timingSafeEqual(given, wanted);
}

export function checkCredentials(username: unknown, password: unknown): boolean {
  return username === appConfig.auth.username && password === appConfig.auth.password;
}
