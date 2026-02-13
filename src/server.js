import { Elysia } from 'elysia';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db/index.js';
import { logger } from './lib/logger.js';
import { PathTraversalError, safePath } from './lib/safe-path.js';
import { requestLoggerPlugin } from './middleware/request-logger.js';
import { initSessionTable, sessionPlugin, startSessionCleanup } from './middleware/session.js';
import { handleDraftPreview, handleEditMode } from './routes/preview.js';
import { loadManifest, rewriteAssetPaths } from './services/asset-manifest.js';

// Import route plugins
import { apiRoutes } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { designSystemRoutes } from './routes/design-system.js';
import { formRoutes } from './routes/forms.js';
import { pagesRoutes } from './routes/pages.js';
import { publishRoutes } from './routes/publish.js';
import { settingsRoutes } from './routes/settings.js';

const log = logger.child('server');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "frame-src 'self'",
  "img-src 'self' data: https:", // ACCEPTED RISK: Allow external HTTPS images (e.g. placehold.co in design-system)
  "font-src 'self' data:",
  "connect-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'"
].join('; ');

// Static file directories
const PUBLIC_DIR = path.join(__dirname, '../public');
const DRAFTS_DIR = path.join(__dirname, '../drafts');
const EDITOR_DIR = path.join(__dirname, '../editor');
const STATIC_DIR = path.join(__dirname, '../static');

// Initialize database and session table
getDb();
initSessionTable();
startSessionCleanup();

// Load asset manifest (fingerprinted asset paths) into memory
await loadManifest();

/**
 * Get MIME type for a file based on extension
 */
function getMimeType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.map': 'application/json'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Check if a file path contains a fingerprint hash (e.g. bootstrap.min.1b1cb0e2.css)
 */
function isFingerprintedAsset(filepath) {
  return /\.[a-f0-9]{8,}\.\w+$/.test(path.basename(filepath));
}

/**
 * Serve a pre-compressed Brotli (.br) file when available and the client accepts it.
 * Returns null if no .br file exists or the client doesn't accept Brotli.
 */
async function serveStaticFileWithBr(filepath, request) {
  const acceptEncoding = (request.headers.get('accept-encoding') || '').toLowerCase();
  if (!acceptEncoding.includes('br')) return null;

  const brFile = Bun.file(filepath + '.br');
  if (!(await brFile.exists())) return null;

  const headers = {
    'Content-Type': getMimeType(filepath),
    'Content-Encoding': 'br',
    'Vary': 'Accept-Encoding'
  };

  if (isFingerprintedAsset(filepath)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }

  return new Response(brFile, { headers });
}

/**
 * Serve a static file
 */
async function serveStaticFile(filepath) {
  const file = Bun.file(filepath);

  if (await file.exists()) {
    const headers = { 'Content-Type': getMimeType(filepath) };

    if (isFingerprintedAsset(filepath)) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    return new Response(file, { headers });
  }

  return null;
}

/**
 * Serve an HTML file from public/ with asset paths rewritten via the manifest
 */
async function servePublicHtml(filepath) {
  const file = Bun.file(filepath);
  if (!(await file.exists())) return null;

  const html = await file.text();
  const rewritten = rewriteAssetPaths(html);

  return new Response(rewritten, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * Try to serve static files
 */
async function tryServeStatic(reqPath, request) {
  try {
    // Serve editor assets from /editor/*
    if (reqPath.startsWith('/editor/')) {
      // reqPath.slice(8) removes '/editor/'
      const filepath = safePath(EDITOR_DIR, reqPath.slice(8));
      return await serveStaticFile(filepath);
    }

    // Serve admin UI assets from /static/*
    if (reqPath.startsWith('/static/')) {
      // reqPath.slice(8) removes '/static/'
      const filepath = safePath(STATIC_DIR, reqPath.slice(8));
      return await serveStaticFile(filepath);
    }

    // Serve assets: ?source=draft → drafts/assets/, otherwise → public/assets/
    const assetsMatch = reqPath.match(/^\/assets\/(.+)$/);
    if (assetsMatch) {
      const url = new URL(request.url);
      if (url.searchParams.get('source') === 'draft') {
        const draftAssetPath = safePath(path.join(DRAFTS_DIR, 'assets'), assetsMatch[1]);
        const brResponse = await serveStaticFileWithBr(draftAssetPath, request);
        if (brResponse) return brResponse;
        return await serveStaticFile(draftAssetPath);
      }

      // Public assets (fingerprinted) — fall through to public directory handling below
    }

    // Serve static files from public directory
    let staticPath = reqPath;

    // Default to index.html for root
    if (staticPath === '/') {
      staticPath = '/index.html';
    }

    // For safePath, we need a relative path. staticPath starts with '/'.
    const relativeStaticPath = staticPath.startsWith('/') ? staticPath.slice(1) : staticPath;

    // Try exact path first
    const publicFilePath = safePath(PUBLIC_DIR, relativeStaticPath);
    if (publicFilePath.endsWith('.html')) {
      // HTML from public/ gets asset paths rewritten via the manifest
      const htmlResponse = await servePublicHtml(publicFilePath);
      if (htmlResponse) return htmlResponse;
    } else {
      const brResponse = await serveStaticFileWithBr(publicFilePath, request);
      const response = brResponse || (await serveStaticFile(publicFilePath));
      if (response) return response;
    }

    // Try adding .html extension
    if (!staticPath.endsWith('.html')) {
      const htmlPath = safePath(PUBLIC_DIR, relativeStaticPath + '.html');
      return await servePublicHtml(htmlPath);
    }
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return null;
    }
    throw error;
  }

  return null;
}

// Create Elysia app
const app = new Elysia()
  // Add session support
  .use(sessionPlugin)

  // HTTP request logging
  .use(requestLoggerPlugin)

  // Security headers
  .onAfterHandle(({ set }) => {
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    set.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';
    set.headers['Content-Security-Policy'] = BASE_CONTENT_SECURITY_POLICY;
    if (process.env.NODE_ENV === 'production') {
      set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
  })

  // Health check endpoint
  .get('/health', () => 'ok')

  // Register route plugins FIRST (before any wildcards)
  .use(formRoutes)
  .use(apiRoutes)
  .use(authRoutes)
  .use(pagesRoutes)
  .use(publishRoutes)
  .use(settingsRoutes)
  .use(designSystemRoutes)

  // Handle all other requests (preview modes and static files)
  .all('*', async ({ path: reqPath, query, session, set, request }) => {
    // Handle draft preview
    const draftResult = await handleDraftPreview({ path: reqPath, query, session, set });
    if (draftResult !== null) return draftResult;

    // Handle edit mode
    const editResult = await handleEditMode({ path: reqPath, query, session, set });
    if (editResult !== null) return editResult;

    // Try static files
    const staticResponse = await tryServeStatic(reqPath, request);
    if (staticResponse) return staticResponse;

    // 404 Not Found
    set.status = 404;
    return 'Not Found';
  })

  // Error handler
  .onError(({ error, set }) => {
    log.error('Server error', { error: error.message, stack: error.stack });
    set.status = 500;
    return { error: 'Something went wrong!' };
  })

  // Start server
  .listen(PORT);

console.log(`Capuzzella server running at http://localhost:${app.server?.port}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
