/**
 * SQLite-backed session management for Elysia
 */

import crypto from 'crypto';
import { getDb } from '../db/index.js';

const SESSION_COOKIE_NAME = 'capuzzella.sid';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour

let cleanupTimer = null;

/**
 * Initialize the sessions table if it doesn't exist
 * Also handles migration from old better-sqlite3-session-store schema
 */
export function initSessionTable() {
  const db = getDb();

  // Check if sessions table exists
  const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();

  if (tableExists) {
    // Check if it has the old schema (expired column as DATETIME instead of INTEGER)
    const columns = db.query("PRAGMA table_info(sessions)").all();
    const expiredCol = columns.find(c => c.name === 'expired');

    if (expiredCol && expiredCol.type !== 'INTEGER') {
      console.log('Migrating sessions table to new schema...');
      db.exec('DROP TABLE sessions');
    } else if (!expiredCol) {
      console.log('Migrating sessions table to new schema...');
      db.exec('DROP TABLE sessions');
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)
  `);
}

/**
 * Generate a secure session ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get session data from database
 */
export function getSession(sessionId) {
  if (!sessionId) return null;

  const db = getDb();
  const now = Date.now();

  const row = db.query('SELECT sess FROM sessions WHERE sid = ? AND expired > ?').get(sessionId, now);

  if (!row) return null;

  try {
    return JSON.parse(row.sess);
  } catch {
    return null;
  }
}

/**
 * Save session data to database
 */
export function saveSession(sessionId, data) {
  const db = getDb();
  const expired = Date.now() + SESSION_MAX_AGE;
  const sess = JSON.stringify(data);

  db.query(`
    INSERT OR REPLACE INTO sessions (sid, sess, expired)
    VALUES (?, ?, ?)
  `).run(sessionId, sess, expired);
}

/**
 * Destroy a session
 */
export function destroySession(sessionId) {
  if (!sessionId) return;

  const db = getDb();
  db.query('DELETE FROM sessions WHERE sid = ?').run(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions() {
  const db = getDb();
  const now = Date.now();
  db.query('DELETE FROM sessions WHERE expired <= ?').run(now);
}

/**
 * Start periodic cleanup of expired sessions
 */
export function startSessionCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    try {
      cleanupExpiredSessions();
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Stop periodic cleanup
 */
export function stopSessionCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Parse session ID from cookie header
 */
function getSessionIdFromCookie(cookie) {
  if (!cookie) return null;

  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return rest.join('=');
    }
  }

  return null;
}

/**
 * Create a session cookie string
 */
export function createSessionCookie(sessionId) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(SESSION_MAX_AGE / 1000)}`,
    'SameSite=Lax'
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Create a cookie to clear the session
 */
export function createClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`;
}

/**
 * Elysia session plugin
 * Adds session support to Elysia context
 */
export function sessionPlugin(app) {
  return app
    .derive(({ request, cookie, set }) => {
      // Get session ID from cookie
      const cookieHeader = request.headers.get('cookie');
      let sessionId = getSessionIdFromCookie(cookieHeader);
      let sessionData = null;
      let isNew = false;

      // Load or create session
      if (sessionId) {
        sessionData = getSession(sessionId);
      }

      if (!sessionData) {
        sessionId = generateSessionId();
        sessionData = {};
        isNew = true;
      }

      // Track if session was modified
      let isModified = false;
      let isDestroyed = false;

      // Create session proxy for easy access
      const session = new Proxy(sessionData, {
        get(target, prop) {
          if (prop === 'destroy') {
            return () => {
              destroySession(sessionId);
              isDestroyed = true;
            };
          }
          if (prop === 'save') {
            return () => {
              if (!isDestroyed) {
                saveSession(sessionId, sessionData);
              }
            };
          }
          if (prop === '_isNew') return isNew;
          if (prop === '_isModified') return isModified;
          if (prop === '_isDestroyed') return isDestroyed;
          if (prop === '_sessionId') return sessionId;
          if (prop === '_getData') return () => sessionData;
          return target[prop];
        },
        set(target, prop, value) {
          target[prop] = value;
          isModified = true;
          return true;
        },
        deleteProperty(target, prop) {
          delete target[prop];
          isModified = true;
          return true;
        }
      });

      return { session };
    })
    .onAfterHandle(({ session, set }) => {
      // Save session if modified
      if (!session._isDestroyed && (session._isNew || session._isModified)) {
        // Use _getData() to get the underlying data object, avoiding proxy spread issues
        saveSession(session._sessionId, session._getData());
        set.headers['Set-Cookie'] = createSessionCookie(session._sessionId);
      }

      // Clear cookie if session was destroyed
      if (session._isDestroyed) {
        set.headers['Set-Cookie'] = createClearSessionCookie();
      }
    });
}

export default {
  initSessionTable,
  getSession,
  saveSession,
  destroySession,
  cleanupExpiredSessions,
  startSessionCleanup,
  stopSessionCleanup,
  createSessionCookie,
  createClearSessionCookie,
  sessionPlugin
};
