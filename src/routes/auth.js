import { Elysia } from 'elysia';
import { createClearSessionCookie, createSessionCookie, saveSession } from '../middleware/session.js';
import { authenticateUser } from '../services/auth.js';

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
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 class="text-2xl font-bold text-gray-900 mb-6 text-center">Capuzzella</h1>
          <form method="POST" action="/auth/login" class="space-y-4">
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700">Username</label>
              <input type="text" name="username" id="username" required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" name="password" id="password" required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            </div>
            <button type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Sign in
            </button>
          </form>
        </div>
      </body>
      </html>
    `;
  })

  /**
   * POST /auth/login - Handle login
   */
  .post('/login', async ({ body, session, set }) => {
    const { username, password } = body;

    try {
      const user = await authenticateUser(username, password);

      if (user) {
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

      set.status = 401;
      return 'Invalid credentials';
    } catch (error) {
      console.error('Login error:', error);
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
  })

  /**
   * GET /auth/logout - Handle logout via GET (convenience)
   */
  .get('/logout', ({ session }) => {
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
