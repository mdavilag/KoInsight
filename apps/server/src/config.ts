require('dotenv').config();

import path from 'path';

const BASE_PATH = __dirname;
const DATA_PATH = process.env.DATA_PATH || path.resolve(BASE_PATH, '../../../', 'data');
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 100;

const UPLOAD_DB_FILENAME = 'statistics.sqlite3';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const appConfig = {
  hostname: process.env.HOSTNAME || '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  env: process.env.NODE_ENV,

  coversPath: path.resolve(DATA_PATH, 'covers'),

  auth: {
    username: process.env.AUTH_USERNAME || 'admin',
    password: process.env.AUTH_PASSWORD || 'davila',
    // Secret used to derive the opaque session cookie token.
    secret: process.env.AUTH_SECRET || 'koinsight-dev-secret-change-me',
    cookieName: 'koinsight_session',
    // Mark the cookie as Secure when served behind HTTPS.
    cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
    maxAgeMs: 30 * ONE_DAY_MS,
  },

  dataPath: DATA_PATH,

  webBuildPath: path.join(BASE_PATH, '../../web/dist'),

  upload: {
    filename: UPLOAD_DB_FILENAME,
    path: path.resolve(DATA_PATH, UPLOAD_DB_FILENAME),
    maxFileSizeMegaBytes: MAX_FILE_SIZE_MB,
  },

  db: {
    dev: path.resolve(DATA_PATH, 'dev.sqlite3'),
    prod: path.resolve(DATA_PATH, 'prod.sqlite3'),
  },
};
