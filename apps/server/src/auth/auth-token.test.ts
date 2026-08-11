import { describe, expect, it } from 'vitest';
import { appConfig } from '../config';
import { checkCredentials, expectedToken, verifyToken } from './auth-token';

describe('auth-token', () => {
  describe('expectedToken', () => {
    it('is deterministic and opaque (not the raw credentials)', () => {
      const token = expectedToken();
      expect(token).toEqual(expectedToken());
      expect(token).not.toContain(appConfig.auth.password);
      expect(token).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    });
  });

  describe('verifyToken', () => {
    it('accepts the expected token', () => {
      expect(verifyToken(expectedToken())).toBe(true);
    });

    it('rejects an invalid, empty or missing token', () => {
      expect(verifyToken('nope')).toBe(false);
      expect(verifyToken('')).toBe(false);
      expect(verifyToken(undefined)).toBe(false);
      expect(verifyToken(null)).toBe(false);
    });

    it('rejects a token of a different length without throwing', () => {
      expect(verifyToken(expectedToken() + 'extra')).toBe(false);
    });
  });

  describe('checkCredentials', () => {
    it('accepts the configured credentials', () => {
      expect(checkCredentials(appConfig.auth.username, appConfig.auth.password)).toBe(true);
    });

    it('rejects wrong credentials', () => {
      expect(checkCredentials(appConfig.auth.username, 'wrong')).toBe(false);
      expect(checkCredentials('wrong', appConfig.auth.password)).toBe(false);
      expect(checkCredentials(undefined, undefined)).toBe(false);
    });
  });
});
