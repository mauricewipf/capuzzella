import crypto from 'crypto';

const CSRF_SESSION_KEY = '_csrfToken';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokensMatch(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function getTokenFromRequest(body, request) {
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) return headerToken;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (typeof body._csrf === 'string') {
      return body._csrf;
    }

    if (typeof body.get === 'function') {
      const formToken = body.get('_csrf');
      return typeof formToken === 'string' ? formToken : null;
    }
  }

  return null;
}

/**
 * Generate or retrieve the per-session CSRF token.
 */
export function getCsrfToken(session) {
  if (!session[CSRF_SESSION_KEY]) {
    session[CSRF_SESSION_KEY] = crypto.randomBytes(32).toString('hex');
  }

  return session[CSRF_SESSION_KEY];
}

/**
 * Validate CSRF token for non-idempotent requests.
 * Returns a response payload when validation fails.
 */
export function verifyCsrfRequest({ request, body, session, set }) {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return undefined;
  }

  const expectedToken = getCsrfToken(session);
  const providedToken = getTokenFromRequest(body, request);

  if (!tokensMatch(expectedToken, providedToken)) {
    set.status = 403;
    return { error: 'Invalid CSRF token' };
  }

  return undefined;
}

