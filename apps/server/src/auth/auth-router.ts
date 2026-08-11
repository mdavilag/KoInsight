import { Request, Response, Router } from 'express';
import { appConfig } from '../config';
import { requireAuth } from './auth-middleware';
import { checkCredentials, expectedToken } from './auth-token';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: appConfig.auth.cookieSecure,
  maxAge: appConfig.auth.maxAgeMs,
  path: '/',
};

/**
 * Validates the fixed dashboard credentials and, on success, sets the session
 * cookie the dashboard endpoints check.
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};

  if (!checkCredentials(username, password)) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  res.cookie(appConfig.auth.cookieName, expectedToken(), cookieOptions);
  res.status(200).json({ ok: true });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(appConfig.auth.cookieName, { path: '/' });
  res.status(200).json({ ok: true });
});

/**
 * Used by the frontend guard to check whether the current session is valid.
 */
router.get('/me', requireAuth, (_req: Request, res: Response) => {
  res.status(200).json({ authenticated: true });
});

export { router as authRouter };
