import { Elysia } from 'elysia';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db/index.js';
import { initSessionTable, sessionPlugin, startSessionCleanup } from './middleware/session.js';
import { handleDraftPreview, handleEditMode } from './routes/preview.js';
import { loadManifest, rewriteAssetPaths } from './services/asset-manifest.js';

// Import route plugins
import { apiRoutes } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { designSystemRoutes } from './routes/design-system.js';
import { pagesRoutes } from './routes/pages.js';
import { publishRoutes } from './routes/publish.js';
import { settingsRoutes } from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Static file directories
const PUBLIC_DIR = path.join(__dirname, '../public');
const DRAFTS_DIR = path.join(__dirname, '../drafts');
const EDITOR_DIR = path.join(__dirname, '../editor');

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
 * Serve a pre-compressed Brotli (.br) file when available and the client accepts it.
 * Returns null if no .br file exists or the client doesn't accept Brotli.
 */
async function serveStaticFileWithBr(filepath, request) {
  const acceptEncoding = (request.headers.get('accept-encoding') || '').toLowerCase();
  if (!acceptEncoding.includes('br')) return null;

  const brFile = Bun.file(filepath + '.br');
  if (!(await brFile.exists())) return null;

  return new Response(brFile, {
    headers: {
      'Content-Type': getMimeType(filepath),
      'Content-Encoding': 'br',
      'Vary': 'Accept-Encoding'
    }
  });
}

/**
 * Serve a static file
 */
async function serveStaticFile(filepath) {
  const file = Bun.file(filepath);

  if (await file.exists()) {
    return new Response(file, {
      headers: { 'Content-Type': getMimeType(filepath) }
    });
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
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * Try to serve static files
 */
async function tryServeStatic(reqPath, request) {
  // Serve editor assets from /editor/*
  if (reqPath.startsWith('/editor/')) {
    const filepath = path.join(EDITOR_DIR, reqPath.slice(8));
    return await serveStaticFile(filepath);
  }

  // Serve draft assets (e.g. /assets/css/main.css or /about/assets/css/main.css from drafts/assets/)
  const assetsMatch = reqPath.match(/\/assets\/(.+)$/);
  if (assetsMatch) {
    const draftAssetPath = path.join(DRAFTS_DIR, 'assets', assetsMatch[1]);
    const brResponse = await serveStaticFileWithBr(draftAssetPath, request);
    if (brResponse) return brResponse;

    const response = await serveStaticFile(draftAssetPath);
    if (response) return response;
  }

  // Serve static files from public directory
  let staticPath = reqPath;

  // Default to index.html for root
  if (staticPath === '/') {
    staticPath = '/index.html';
  }

  // Try exact path first
  const publicFilePath = path.join(PUBLIC_DIR, staticPath);
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
    const htmlPath = path.join(PUBLIC_DIR, staticPath + '.html');
    return await servePublicHtml(htmlPath);
  }

  return null;
}

// Create Elysia app
const app = new Elysia()
  // Add session support
  .use(sessionPlugin)

  // Test route
  .get('/test', () => {
    console.log('Test route called');
    return 'Test works!';
  })

  // Register route plugins FIRST (before any wildcards)
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
    console.error('Server error:', error);
    set.status = 500;
    return { error: 'Something went wrong!' };
  })

  // Start server
  .listen(PORT);

console.log(`Capuzzella server running at http://localhost:${app.server?.port}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
