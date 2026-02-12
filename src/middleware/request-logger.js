/**
 * HTTP request logging middleware for Elysia.
 *
 * Logs every request with method, path, status code, and response time.
 * - Skips /health to avoid noise
 * - Uses debug level for static asset requests (/assets/, /editor/)
 */

import { logger } from '../lib/logger.js';

const log = logger.child('http');

/**
 * Check if a path is a static asset request.
 */
function isAssetPath(path) {
  return path.startsWith('/assets/') || path.startsWith('/editor/');
}

/**
 * Elysia request-logging plugin.
 * Attach before route registration so all requests are captured.
 */
export function requestLoggerPlugin(app) {
  return app
    .onBeforeHandle(({ request, store }) => {
      // Stash the start time so we can measure duration in onAfterResponse
      store.requestStart = performance.now();
    })
    .onAfterResponse(({ request, store, set }) => {
      const url = new URL(request.url);
      const path = url.pathname;

      // Skip health checks — they add noise and are called frequently
      if (path === '/health') return;

      const method = request.method;
      const status = set.status || 200;
      const durationMs = store.requestStart
        ? (performance.now() - store.requestStart).toFixed(1)
        : '?';

      const message = `${method} ${path} ${status} ${durationMs}ms`;

      if (isAssetPath(path)) {
        log.debug(message, { method, path, status, durationMs: Number(durationMs) });
      } else {
        log.info(message, { method, path, status, durationMs: Number(durationMs) });
      }
    });
}
