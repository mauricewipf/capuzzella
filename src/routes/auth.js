import { Elysia } from 'elysia';
import { logger } from '../lib/logger.js';
import { createClearSessionCookie, createSessionCookie, saveSession } from '../middleware/session.js';
import { authenticateUser } from '../services/auth.js';

const log = logger.child('auth');

/**
 * In-memory rate limiter for login attempts.
 * Tracks failed login timestamps per IP and rejects if the limit is exceeded.
 */
const loginAttemptMap = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;

function isLoginRateLimited(ip) {
  const now = Date.now();
  const timestamps = loginAttemptMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < LOGIN_WINDOW_MS);
  loginAttemptMap.set(ip, recent);
  return recent.length >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const timestamps = loginAttemptMap.get(ip) || [];
  timestamps.push(now);
  loginAttemptMap.set(ip, timestamps);
}

function clearLoginAttempts(ip) {
  loginAttemptMap.delete(ip);
}

// Periodically clean up stale entries (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of loginAttemptMap) {
    const recent = timestamps.filter((t) => now - t < LOGIN_WINDOW_MS);
    if (recent.length === 0) {
      loginAttemptMap.delete(ip);
    } else {
      loginAttemptMap.set(ip, recent);
    }
  }
}, 30 * 60 * 1000);

/**
 * Auth routes plugin for Elysia
 */
export const authRoutes = new Elysia({ prefix: '/auth' })
  /**
   * GET /auth/login - Render login page
   */
  .get('/login', ({ session, set }) => {
    if (session.userId) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/' }
      });
    }

    set.headers['Content-Type'] = 'text/html';
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - Capuzzella</title>
        <link rel="stylesheet" href="/static/css/bootstrap.min.css">
        <script src="/static/js/bootstrap.bundle.min.js"></script>
      </head>
      <body class="bg-body-tertiary d-flex align-items-center min-vh-100">
        <div class="container" style="max-width: 420px;">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <h1 class="h4 fw-bold text-center mb-4">Capuzzella</h1>
              <form method="POST" action="/auth/login">
                <div class="mb-3">
                  <label for="username" class="form-label">Username</label>
                  <input type="text" name="username" id="username" required class="form-control">
                </div>
                <div class="mb-3">
                  <label for="password" class="form-label">Password</label>
                  <input type="password" name="password" id="password" required class="form-control">
                </div>
                <button type="submit" class="btn btn-primary w-100">Sign in</button>
              </form>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  })

  /**
   * POST /auth/login - Handle login
   */
  .post('/login', async ({ body, session, set, request }) => {
    const ip = request.headers.get('x-real-ip') || 'unknown';

    // Check rate limit before attempting authentication
    if (isLoginRateLimited(ip)) {
      log.warn('Login rate limit exceeded', { ip });
      set.status = 429;
      return 'Too many login attempts. Please try again later.';
    }

    const { username, password } = body;

    try {
      const user = await authenticateUser(username, password);

      if (user) {
        // Successful login — clear failed attempt counter
        clearLoginAttempts(ip);

        session.userId = user.id;
        session.username = user.username;
        session.mustChangePassword = user.mustChangePassword;

        // Force redirect to settings if user must change their password
        if (user.mustChangePassword) {
          // Save session and redirect with cookie
          saveSession(session._sessionId, session._getData());
          return new Response(null, {
            status: 302,
            headers: {
              'Location': '/settings?message=' + encodeURIComponent('Please change your generated password before continuing'),
              'Set-Cookie': createSessionCookie(session._sessionId)
            }
          });
        }

        // Redirect to the page they were trying to access, or home
        const returnTo = session.returnTo || '/';
        delete session.returnTo;
        // Save session and redirect with cookie
        saveSession(session._sessionId, session._getData());
        return new Response(null, {
          status: 302,
          headers: {
            'Location': returnTo,
            'Set-Cookie': createSessionCookie(session._sessionId)
          }
        });
      }

      // Failed login — record the attempt
      recordFailedLogin(ip);
      set.status = 401;
      return 'Invalid credentials';
    } catch (error) {
      log.error('Login error', { error: error.message });
      set.status = 500;
      return 'Login failed';
    }
  })

  /**
   * POST /auth/logout - Handle logout
   */
  .post('/logout', ({ session }) => {
    session.destroy();
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/auth/login',
        'Set-Cookie': createClearSessionCookie()
      }
    });
  });

export default authRoutes;
