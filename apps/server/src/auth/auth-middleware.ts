import { NextFunction, Request, Response } from 'express';
import { appConfig } from '../config';
import { verifyToken } from './auth-token';

/**
 * Reads a single cookie value from the raw `Cookie` header. Avoids pulling in a
 * cookie-parser dependency for the one session cookie we care about.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return undefined;
}

export function isAuthenticated(req: Request): boolean {
  return verifyToken(readCookie(req, appConfig.auth.cookieName));
}

/**
 * Gate for dashboard/management endpoints. The KOReader plugin sync endpoints
 * are intentionally mounted without this middleware.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}
