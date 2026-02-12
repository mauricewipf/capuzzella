import { Elysia } from 'elysia';
import { logger } from '../lib/logger.js';
import { sendContactEmail } from '../services/email.js';

const log = logger.child('forms');

/**
 * Simple in-memory rate limiter.
 * Tracks submission timestamps per IP and rejects if the limit is exceeded.
 */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // max submissions per window

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];

  // Remove expired entries
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// Periodically clean up stale entries (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, recent);
    }
  }
}, 30 * 60 * 1000);

/** Maximum number of fields accepted per submission. */
const MAX_FIELDS = 20;

/** Maximum length per field value. */
const MAX_VALUE_LENGTH = 5000;

/**
 * Basic email format validation.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Form submission route plugin for Elysia.
 * Public endpoint — no auth required.
 *
 * Accepts any JSON object of { fieldName: value } pairs.
 * If an "email" field is present it is validated as an email address.
 */
export const formRoutes = new Elysia({ prefix: '/api' })
  /**
   * POST /api/contact - Handle contact form submissions
   */
  .post('/form', async ({ body, set, request }) => {
    // Body must be a non-null object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      set.status = 400;
      return { error: 'Request body must be a JSON object' };
    }

    // Collect string fields, reject anything else
    const fields = {};
    const entries = Object.entries(body);

    if (entries.length === 0) {
      set.status = 400;
      return { error: 'At least one field is required' };
    }

    if (entries.length > MAX_FIELDS) {
      set.status = 400;
      return { error: `Too many fields (max ${MAX_FIELDS})` };
    }

    for (const [key, value] of entries) {
      if (typeof value !== 'string') {
        set.status = 400;
        return { error: `Field "${key}" must be a string` };
      }

      const trimmed = value.trim();
      if (!trimmed) {
        set.status = 400;
        return { error: `Field "${key}" must not be empty` };
      }

      if (trimmed.length > MAX_VALUE_LENGTH) {
        set.status = 400;
        return { error: `Field "${key}" is too long (max ${MAX_VALUE_LENGTH} characters)` };
      }

      fields[key] = trimmed;
    }

    // Validate email format if an email field is present
    if (fields.email && !isValidEmail(fields.email)) {
      set.status = 400;
      return { error: 'Invalid email address' };
    }

    // Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      log.warn('Rate limit exceeded', { ip });
      set.status = 429;
      return { error: 'Too many submissions. Please try again later.' };
    }

    // Send email
    const result = await sendContactEmail(fields);

    if (!result.success) {
      set.status = 500;
      return { error: 'Failed to send message. Please try again later.' };
    }

    return { success: true };
  });

export default formRoutes;
