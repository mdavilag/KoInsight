import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../config';
import { requireAuth } from './auth-middleware';
import { authRouter } from './auth-router';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  // A stand-in protected route to exercise requireAuth end to end.
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

const { username, password, cookieName } = appConfig.auth;

describe('auth-router', () => {
  describe('POST /api/auth/login', () => {
    it('rejects invalid credentials without setting a cookie', async () => {
      const response = await request(buildApp())
        .post('/api/auth/login')
        .send({ username, password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('sets an httpOnly session cookie on valid credentials', async () => {
      const response = await request(buildApp())
        .post('/api/auth/login')
        .send({ username, password });

      expect(response.status).toBe(200);
      const setCookie = response.headers['set-cookie']?.[0] ?? '';
      expect(setCookie).toContain(`${cookieName}=`);
      expect(setCookie.toLowerCase()).toContain('httponly');
    });
  });

  describe('requireAuth via /api/protected', () => {
    it('blocks requests without a valid session', async () => {
      const response = await request(buildApp()).get('/api/protected');
      expect(response.status).toBe(401);
    });

    it('allows requests after login, and blocks again after logout', async () => {
      const agent = request.agent(buildApp());

      await agent.post('/api/auth/login').send({ username, password }).expect(200);

      await agent.get('/api/protected').expect(200);
      await agent.get('/api/auth/me').expect(200);

      await agent.post('/api/auth/logout').expect(200);

      await agent.get('/api/protected').expect(401);
      await agent.get('/api/auth/me').expect(401);
    });
  });
});
