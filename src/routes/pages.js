import { Elysia } from 'elysia';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { listPages } from '../services/pages.js';

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
    return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Changes</span>';
  }
  if (page.isPublished) {
    return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Published</span>';
  }
  return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Draft</span>';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

      pagesWithStatus.sort((a, b) => {
        if (a.hasUnpublishedChanges && !b.hasUnpublishedChanges) return -1;
        if (!a.hasUnpublishedChanges && b.hasUnpublishedChanges) return 1;
        if (!a.isPublished && b.isPublished) return -1;
        if (a.isPublished && !b.isPublished) return 1;
        return a.path.localeCompare(b.path);
      });

      set.headers['Content-Type'] = 'text/html';
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pages - Capuzzella</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 min-h-screen">
          <div class="max-w-4xl mx-auto py-12 px-4">
            <div class="flex justify-between items-center mb-8">
              <h1 class="text-3xl font-bold text-gray-900">Pages</h1>
              <div class="flex gap-4">
                <a href="/settings" class="text-gray-600 hover:text-gray-800">Settings</a>
                <a href="/auth/logout" class="text-red-600 hover:text-red-800">Sign out</a>
              </div>
            </div>

            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
              <div class="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div class="text-2xl font-bold text-gray-900">${pagesWithStatus.length}</div>
                  <div class="text-sm text-gray-500">Total Pages</div>
                </div>
                <div>
                  <div class="text-2xl font-bold text-green-600">${pagesWithStatus.filter(p => p.isPublished && !p.hasUnpublishedChanges).length}</div>
                  <div class="text-sm text-gray-500">Published</div>
                </div>
                <div>
                  <div class="text-2xl font-bold text-amber-600">${pagesWithStatus.filter(p => p.hasUnpublishedChanges || !p.isPublished).length}</div>
                  <div class="text-sm text-gray-500">Unpublished</div>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              ${pagesWithStatus.length === 0 ? `
                <div class="p-8 text-center text-gray-500">
                  <p>No pages found in drafts.</p>
                  <p class="mt-2 text-sm">Add HTML files to the <code class="bg-gray-100 px-2 py-1 rounded">drafts/</code> directory to get started.</p>
                </div>
              ` : `
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${pagesWithStatus.map(page => `
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="flex items-center">
                            <svg class="h-5 w-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <div>
                              <a href="/${escapeHtml(page.path)}${page.isPublished ? '' : '?draft=true'}" class="text-indigo-600 hover:text-indigo-900 font-medium">${escapeHtml(page.path)}</a>
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          ${getStatusBadge(page)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          ${!page.isPublished || page.hasUnpublishedChanges ? `
                            <button onclick="publishPage('${escapeHtml(page.path)}')" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">Publish</button>
                          ` : `
                            <button onclick="unpublishPage('${escapeHtml(page.path)}')" class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Unpublish</button>
                          `}
                          <a href="/${escapeHtml(page.path)}?edit=true" class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Edit</a>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <div class="mt-6 text-sm text-gray-500">
              <h3 class="font-medium text-gray-700 mb-2">Status Legend:</h3>
              <div class="flex flex-wrap gap-4">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Published</span>
                  <span>Live and up to date</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Changes</span>
                  <span>Published but has edits</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Draft</span>
                  <span>Not yet published</span>
                </div>
              </div>
            </div>
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
      console.error('Pages list error:', error);
      set.status = 500;
      return 'Failed to load pages';
    }
  });

export default pagesRoutes;
