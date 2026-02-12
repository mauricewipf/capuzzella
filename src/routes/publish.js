import crypto from 'crypto';
import { Elysia } from 'elysia';
import fs from 'fs/promises';
import path from 'path';
import { brotliCompressSync } from 'zlib';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';
import { safePath, PathTraversalError } from '../lib/safe-path.js';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { loadManifest } from '../services/asset-manifest.js';
import { listPages } from '../services/pages.js';
import { generateSitemap } from '../services/sitemap.js';

const log = logger.child('publish');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRAFTS_DIR = path.join(__dirname, '../../drafts');
const PUBLIC_DIR = path.join(__dirname, '../../public');
const DRAFTS_ASSETS_DIR = path.join(DRAFTS_DIR, 'assets');
const PUBLIC_ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

/**
 * Recursively list all file paths under dir, relative to dir
 */
async function listFilesRecursive(dir, base = '') {
  const entries = await fs.readdir(path.join(dir, base), { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      files.push(...(await listFilesRecursive(dir, rel)));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Return fingerprinted filename: insert .<hash> before the last extension.
 * e.g. "css/bootstrap.min.css" + hash -> "css/bootstrap.min.<hash>.css"
 */
function fingerprintedName(relativePath, hash) {
  const dir = path.dirname(relativePath);
  const base = path.basename(relativePath);
  const lastDot = base.lastIndexOf('.');
  if (lastDot <= 0) return path.join(dir, `${base}.${hash}`);
  const nameWithoutExt = base.slice(0, lastDot);
  const ext = base.slice(lastDot);
  const newBase = `${nameWithoutExt}.${hash}${ext}`;
  return dir ? path.join(dir, newBase) : newBase;
}

/**
 * Publish all drafts/assets/ files to public/assets/ with MD5 fingerprints.
 * For each file: copy as <name>.<hash>.<ext> and create a Brotli-compressed .br version.
 * Existing .br files from drafts are skipped (regenerated from the source).
 */
async function publishDraftAssets() {
  let entries;
  try {
    entries = await listFilesRecursive(DRAFTS_ASSETS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return; // no drafts/assets
    throw err;
  }

  const hashByBasePath = new Map(); // relative path -> hash

  for (const rel of entries) {
    // Skip existing .br files from drafts — we generate fresh ones below
    if (rel.endsWith('.br')) continue;

    const fullPath = path.join(DRAFTS_ASSETS_DIR, rel);
    const content = await fs.readFile(fullPath);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    hashByBasePath.set(rel, hash);

    const outName = fingerprintedName(rel, hash);
    const outPath = path.join(PUBLIC_ASSETS_DIR, outName);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    // Write the fingerprinted file
    await fs.writeFile(outPath, content);

    // Write a Brotli-compressed version alongside it
    const compressed = brotliCompressSync(content);
    await fs.writeFile(outPath + '.br', compressed);
  }

  // Write asset manifest mapping original paths to fingerprinted paths
  const manifest = {};
  for (const [rel, hash] of hashByBasePath) {
    manifest[rel] = fingerprintedName(rel, hash);
  }
  await fs.writeFile(
    path.join(PUBLIC_ASSETS_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Reload in-memory manifest so the server picks up the new fingerprints
  await loadManifest();
}

/**
 * Publish routes plugin for Elysia
 */
export const publishRoutes = new Elysia({ prefix: '/publish' })
  .onBeforeHandle(({ session, request, set }) => {
    const url = new URL(request.url);
    const fullPath = url.pathname;

    const authResult = requireAuth({ session, path: fullPath, request, set });
    if (authResult !== undefined) return authResult;

    const pwResult = requirePasswordChanged({ session, path: fullPath, request, set });
    if (pwResult !== undefined) return pwResult;
  })

  /**
   * POST /publish - Publish all drafts to public directory
   */
  .post('/', async ({ set }) => {
    try {
      const pages = await listPages();

      if (pages.length === 0) {
        set.status = 400;
        return { error: 'No pages to publish' };
      }

      await fs.mkdir(PUBLIC_DIR, { recursive: true });

      const published = [];
      const errors = [];

      for (const pagePath of pages) {
        try {
          const sourcePath = path.join(DRAFTS_DIR, pagePath);
          const destPath = path.join(PUBLIC_DIR, pagePath);

          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
          published.push(pagePath);
        } catch (error) {
          log.error(`Failed to publish ${pagePath}`, { error: error.message });
          errors.push({ path: pagePath, error: error.message });
        }
      }

      try {
        await publishDraftAssets();
      } catch (assetsError) {
        log.error('Failed to publish draft assets', { error: assetsError.message });
        errors.push({ path: 'assets', error: assetsError.message });
      }

      let sitemap;
      try {
        sitemap = await generateSitemap();
      } catch (sitemapError) {
        log.error('Failed to generate sitemap', { error: sitemapError.message });
      }

      return {
        success: true,
        published,
        errors: errors.length > 0 ? errors : undefined,
        sitemap
      };
    } catch (error) {
      log.error('Publish all error', { error: error.message });
      set.status = 500;
      return { error: 'Failed to publish pages' };
    }
  })

  /**
   * GET /publish/status/* - Check if a specific page is published
   */
  .get('/status/*', async ({ params, set }) => {
    const pagePath = params['*'];

    // Validate path against both directories
    try {
      safePath(DRAFTS_DIR, pagePath);
      safePath(PUBLIC_DIR, pagePath);
    } catch (err) {
      if (err instanceof PathTraversalError) {
        set.status = 400;
        return { error: 'Invalid page path' };
      }
      throw err;
    }

    try {
      const draftPath = path.join(DRAFTS_DIR, pagePath);
      const publicPath = path.join(PUBLIC_DIR, pagePath);

      let draftExists = false;
      try {
        await fs.access(draftPath);
        draftExists = true;
      } catch {
        draftExists = false;
      }

      if (!draftExists) {
        set.status = 404;
        return { error: 'Page not found' };
      }

      let isPublished = false;
      try {
        await fs.access(publicPath);
        isPublished = true;
      } catch {
        isPublished = false;
      }

      let hasUnpublishedChanges = false;
      if (isPublished) {
        const [draftStat, publicStat] = await Promise.all([
          fs.stat(draftPath),
          fs.stat(publicPath)
        ]);
        hasUnpublishedChanges = draftStat.mtime > publicStat.mtime;
      }

      return { pagePath, isPublished, hasUnpublishedChanges };
    } catch (error) {
      log.error('Status check error', { error: error.message });
      set.status = 500;
      return { error: 'Failed to check publish status' };
    }
  })

  /**
   * POST /publish/* - Publish a specific page
   */
  .post('/*', async ({ params, set }) => {
    const pagePath = params['*'];

    // Skip the root publish route
    if (!pagePath) return;

    // Validate path against both directories
    try {
      safePath(DRAFTS_DIR, pagePath);
      safePath(PUBLIC_DIR, pagePath);
    } catch (err) {
      if (err instanceof PathTraversalError) {
        set.status = 400;
        return { error: 'Invalid page path' };
      }
      throw err;
    }

    try {
      const sourcePath = path.join(DRAFTS_DIR, pagePath);
      const destPath = path.join(PUBLIC_DIR, pagePath);

      try {
        await fs.access(sourcePath);
      } catch {
        set.status = 404;
        return { error: 'Page not found in drafts' };
      }

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);

      try {
        await publishDraftAssets();
      } catch (assetsError) {
        log.error('Failed to publish draft assets', { error: assetsError.message });
      }

      let sitemap;
      try {
        sitemap = await generateSitemap();
      } catch (sitemapError) {
        log.error('Failed to generate sitemap', { error: sitemapError.message });
      }

      return { success: true, published: pagePath, sitemap };
    } catch (error) {
      log.error('Publish page error', { error: error.message, pagePath });
      set.status = 500;
      return { error: 'Failed to publish page' };
    }
  })

  /**
   * DELETE /publish/* - Unpublish a specific page
   */
  .delete('/*', async ({ params, set }) => {
    const pagePath = params['*'];

    // Validate path against public directory
    try {
      safePath(PUBLIC_DIR, pagePath);
    } catch (err) {
      if (err instanceof PathTraversalError) {
        set.status = 400;
        return { error: 'Invalid page path' };
      }
      throw err;
    }

    try {
      const publicPath = path.join(PUBLIC_DIR, pagePath);

      try {
        await fs.access(publicPath);
      } catch {
        set.status = 404;
        return { error: 'Page is not published' };
      }

      await fs.unlink(publicPath);

      let sitemap;
      try {
        sitemap = await generateSitemap();
      } catch (sitemapError) {
        log.error('Failed to generate sitemap', { error: sitemapError.message });
      }

      return { success: true, unpublished: pagePath, sitemap };
    } catch (error) {
      log.error('Unpublish error', { error: error.message, pagePath });
      set.status = 500;
      return { error: 'Failed to unpublish page' };
    }
  });

export default publishRoutes;
