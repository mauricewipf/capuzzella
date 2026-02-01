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
