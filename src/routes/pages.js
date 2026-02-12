import { Elysia } from 'elysia';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { escapeHtml } from '../lib/escape-html.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { listPages } from '../services/pages.js';

const log = logger.child('pages');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRAFTS_DIR = path.join(__dirname, '../../drafts');
const PUBLIC_DIR = path.join(__dirname, '../../public');

/**
 * Get the publish status of a page
 */
async function getPageStatus(pagePath) {
  const draftPath = path.join(DRAFTS_DIR, pagePath);
  const publicPath = path.join(PUBLIC_DIR, pagePath);

  let isPublished = false;
  let hasUnpublishedChanges = false;

  try {
    await fs.access(publicPath);
    isPublished = true;

    const [draftStat, publicStat] = await Promise.all([
      fs.stat(draftPath),
      fs.stat(publicPath)
    ]);
    hasUnpublishedChanges = draftStat.mtime > publicStat.mtime;
  } catch {
    isPublished = false;
  }

  return { isPublished, hasUnpublishedChanges };
}

/**
 * Get the status badge HTML for a page
 */
function getStatusBadge(page) {
  if (page.hasUnpublishedChanges) {
    return '<span class="badge text-bg-warning">Changes</span>';
  }
  if (page.isPublished) {
    return '<span class="badge text-bg-success">Published</span>';
  }
  return '<span class="badge text-bg-secondary">Draft</span>';
}

/**
 * Pages routes plugin for Elysia
 */
export const pagesRoutes = new Elysia({ prefix: '/pages' })
  .onBeforeHandle(({ session, request, set }) => {
    const url = new URL(request.url);
    const fullPath = url.pathname;

    const authResult = requireAuth({ session, path: fullPath, request, set });
    if (authResult !== undefined) return authResult;
  })

  /**
   * GET /pages - Render pages list
   */
  .get('/', async ({ set }) => {
    try {
      const pages = await listPages();

      const pagesWithStatus = await Promise.all(
        pages.map(async (pagePath) => {
          const status = await getPageStatus(pagePath);
          return { path: pagePath, ...status };
        })
      );

      pagesWithStatus.sort((a, b) => a.path.localeCompare(b.path));

      set.headers['Content-Type'] = 'text/html';
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pages - Capuzzella</title>
          <link rel="stylesheet" href="/static/css/bootstrap.min.css">
          <script src="/static/js/bootstrap.bundle.min.js"></script>
        </head>
        <body class="bg-body-tertiary">
          <div class="container py-5" style="max-width: 900px;">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h1 class="h3 mb-0">Pages</h1>
              <nav class="d-flex gap-3">
                <a href="/design-system" class="text-secondary text-decoration-none">Design System</a>
                <a href="/settings" class="text-secondary text-decoration-none">Settings</a>
                <a href="/auth/logout" class="text-danger text-decoration-none">Sign out</a>
              </nav>
            </div>

            <div class="text-end mb-3">
              <h6 class="text-body-secondary mb-1">Status Legend</h6>
              <div class="d-flex flex-column align-items-end gap-1 small">
                <span><span class="badge text-bg-success">Published</span> Live and up to date</span>
                <span><span class="badge text-bg-warning">Changes</span> Published but has edits</span>
                <span><span class="badge text-bg-secondary">Draft</span> Not yet published</span>
              </div>
            </div>

            ${pagesWithStatus.length === 0 ? `
              <div class="text-center text-body-secondary py-5">
                <p class="mb-1">No pages found in drafts.</p>
                <p class="mb-0"><small>Add HTML files to the <code>drafts/</code> directory to get started.</small></p>
              </div>
            ` : `
              <table class="table table-striped align-middle">
                <caption><a href="/sitemap.xml" target="_blank">sitemap.xml</a> &middot; ${pagesWithStatus.length} pages &middot; ${pagesWithStatus.filter(p => p.isPublished && !p.hasUnpublishedChanges).length} published &middot; ${pagesWithStatus.filter(p => p.hasUnpublishedChanges || !p.isPublished).length} unpublished</caption>
                <thead class="table-light">
                  <tr>
                    <th scope="col">Page</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${pagesWithStatus.map(page => `
                    <tr>
                      <td>
                        <a href="/${escapeHtml(page.path)}${page.isPublished ? '' : '?draft=true'}" class="text-decoration-none fw-medium">${escapeHtml(page.path)}</a>
                      </td>
                      <td>
                        ${getStatusBadge(page)}
                      </td>
                      <td class="text-end">
                        ${!page.isPublished || page.hasUnpublishedChanges ? `
                          <button onclick="publishPage('${escapeHtml(page.path)}')" class="btn btn-success btn-sm">Publish</button>
                        ` : `
                          <button onclick="unpublishPage('${escapeHtml(page.path)}')" class="btn btn-outline-secondary btn-sm">Unpublish</button>
                        `}
                        <a href="/${escapeHtml(page.path)}?edit=true" class="btn btn-outline-secondary btn-sm">Edit</a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}

          </div>

          <script>
            async function publishPage(pagePath) {
              try {
                const response = await fetch('/publish/' + pagePath, { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                  window.location.reload();
                } else {
                  alert('Failed to publish: ' + (data.error || 'Unknown error'));
                }
              } catch (error) {
                alert('Failed to publish: ' + error.message);
              }
            }

            async function unpublishPage(pagePath) {
              if (!confirm('Are you sure you want to unpublish this page?')) return;
              try {
                const response = await fetch('/publish/' + pagePath, { method: 'DELETE' });
                const data = await response.json();
                if (data.success) {
                  window.location.reload();
                } else {
                  alert('Failed to unpublish: ' + (data.error || 'Unknown error'));
                }
              } catch (error) {
                alert('Failed to unpublish: ' + error.message);
              }
            }
          </script>
        </body>
        </html>
      `;
    } catch (error) {
      log.error('Pages list error', { error: error.message });
      set.status = 500;
      return 'Failed to load pages';
    }
  });

export default pagesRoutes;
