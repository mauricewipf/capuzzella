import { createSessionCookie, saveSession } from './session.js';

/**
 * Authentication guards for Elysia
 */

/**
 * Check if request is an API request
 */
function isApiRequest(path, headers) {
  return path.startsWith('/api') ||
    path.startsWith('/publish') ||
    headers['x-requested-with']?.toLowerCase() === 'xmlhttprequest' ||
    headers.accept?.includes('application/json');
}

/**
 * Guard to require authentication
 * Returns error response or redirect if not authenticated
 */
export function requireAuth({ session, path, request, set }) {
  if (session.userId) {
    return; // Authenticated, continue (return undefined)
  }

  const headers = Object.fromEntries(request.headers);

  // Check if this is an API request
  if (isApiRequest(path, headers)) {
    set.status = 401;
    return { error: 'Authentication required' };
  }

  // Store the URL they were trying to access
  session.returnTo = path + (request.url.includes('?') ? '?' + request.url.split('?')[1] : '');

  // Manually save session and return redirect with cookie
  saveSession(session._sessionId, session._getData());
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/auth/login',
      'Set-Cookie': createSessionCookie(session._sessionId)
    }
  });
}

/**
 * Guard to enforce password change
 */
export function requirePasswordChanged({ session, path, request, set }) {
  if (!session.mustChangePassword) {
    return; // Password already changed, continue
  }

  const headers = Object.fromEntries(request.headers);

  // Check if this is an API request
  if (isApiRequest(path, headers)) {
    set.status = 403;
    return { error: 'You must change your password before accessing this resource' };
  }

  // Return redirect (session already exists, cookie should be set)
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/settings?message=' + encodeURIComponent('Please change your generated password before continuing')
    }
  });
}

/**
 * Check if user is authenticated (non-blocking)
 * Adds isAuthenticated and user to context
 */
export function checkAuth({ session }) {
  return {
    isAuthenticated: !!session.userId,
    user: session.userId ? {
      id: session.userId,
      username: session.username
    } : null
  };
}
