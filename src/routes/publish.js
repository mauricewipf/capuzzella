import crypto from 'crypto';
import { Elysia } from 'elysia';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { listPages } from '../services/pages.js';
import { generateSitemap } from '../services/sitemap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRAFTS_DIR = path.join(__dirname, '../../drafts');
const PUBLIC_DIR = path.join(__dirname, '../../public');
const DRAFTS_CSS_DIR = path.join(DRAFTS_DIR, 'assets', 'css');
const PUBLIC_CSS_DIR = path.join(PUBLIC_DIR, 'assets', 'css');

/**
 * Publish drafts/assets/css/ to public: copy each file with MD5 fingerprint,
 * write main.css with updated @import paths (main.css itself is not fingerprinted).
 */
async function publishCssAssets() {
  await fs.mkdir(PUBLIC_CSS_DIR, { recursive: true });

  const mainPath = path.join(DRAFTS_CSS_DIR, 'main.css');
  let mainContent;
  try {
    mainContent = await fs.readFile(mainPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  const importRegex = /@import\s+"([^"]+)";/g;
  const imports = [...mainContent.matchAll(importRegex)].map((m) => m[1]);
  const fingerprintMap = new Map();

  for (const importPath of imports) {
    const sourcePath = path.join(DRAFTS_CSS_DIR, importPath);
    let content;
    try {
      content = await fs.readFile(sourcePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const ext = path.extname(importPath);
    const base = importPath.slice(0, -ext.length);
    const fingerprintedName = `${base}.${hash}${ext}`;
    fingerprintMap.set(importPath, fingerprintedName);
    await fs.writeFile(path.join(PUBLIC_CSS_DIR, fingerprintedName), content, 'utf-8');
  }

  let newMainContent = mainContent;
  for (const [original, fingerprinted] of fingerprintMap) {
    newMainContent = newMainContent.replace(
      new RegExp(`@import\\s+"${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}";`),
      `@import "${fingerprinted}";`
    );
  }

  await fs.writeFile(path.join(PUBLIC_CSS_DIR, 'main.css'), newMainContent, 'utf-8');
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
          console.error(`Failed to publish ${pagePath}:`, error);
          errors.push({ path: pagePath, error: error.message });
        }
      }

      try {
        await publishCssAssets();
      } catch (cssError) {
        console.error('Failed to publish CSS assets:', cssError);
        errors.push({ path: 'assets/css', error: cssError.message });
      }

      let sitemap;
      try {
        sitemap = await generateSitemap();
      } catch (sitemapError) {
        console.error('Failed to generate sitemap:', sitemapError);
      }

      return {
        success: true,
        published,
        errors: errors.length > 0 ? errors : undefined,
        sitemap
      };
    } catch (error) {
      console.error('Publish error:', error);
      set.status = 500;
      return { error: 'Failed to publish pages' };
    }
  })

  /**
   * GET /publish/status/* - Check if a specific page is published
   */
  .get('/status/*', async ({ params, set }) => {
    const pagePath = params['*'];

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
      console.error('Status check error:', error);
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
        await publishCssAssets();
      } catch (cssError) {
        console.error('Failed to publish CSS assets:', cssError);
      }

      let sitemap;
      try {
        sitemap = await generateSitemap();
      } catch (sitemapError) {
        console.error('Failed to generate sitemap:', sitemapError);
      }

      return { success: true, published: pagePath, sitemap };
    } catch (error) {
      console.error('Publish error:', error);
      set.status = 500;
      return { error: 'Failed to publish page' };
    }
  })

  /**
   * DELETE /publish/* - Unpublish a specific page
   */
  .delete('/*', async ({ params, set }) => {
    const pagePath = params['*'];

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
        console.error('Failed to generate sitemap:', sitemapError);
      }

      return { success: true, unpublished: pagePath, sitemap };
    } catch (error) {
      console.error('Unpublish error:', error);
      set.status = 500;
      return { error: 'Failed to unpublish page' };
    }
  });

export default publishRoutes;
