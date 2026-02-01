import { Elysia } from 'elysia';
import { injectEditor } from '../middleware/inject-editor.js';
import { createSessionCookie, saveSession } from '../middleware/session.js';
import { getPage } from '../services/pages.js';

/**
 * Normalize page path from URL
 */
function normalizePath(pathname) {
  let pagePath = pathname;

  // Default to index.html for root or directory paths
  if (pagePath === '/' || pagePath.endsWith('/')) {
    pagePath = pagePath + 'index.html';
  }

  // Ensure .html extension
  if (!pagePath.endsWith('.html')) {
    pagePath = pagePath + '.html';
  }

  // Remove leading slash for file operations
  return pagePath.replace(/^\//, '');
}

/**
 * Handle draft preview mode
 */
export async function handleDraftPreview({ path, query, session, set }) {
  // Only handle requests with ?draft=true
  if (query.draft !== 'true' && query.drafts !== 'true') {
    return null;
  }

  // Require authentication
  if (!session.userId) {
    session.returnTo = path + '?draft=true';
    // Manually save session and return redirect with cookie
    saveSession(session._sessionId, session._getData());
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/auth/login',
        'Set-Cookie': createSessionCookie(session._sessionId)
      }
    });
  }

  const pagePath = normalizePath(path);

  try {
    const html = await getPage(pagePath);

    if (!html) {
      set.status = 404;
      return 'Page not found in drafts';
    }

    set.headers['Content-Type'] = 'text/html';
    return html;
  } catch (error) {
    console.error('Draft preview error:', error);
    set.status = 500;
    return 'Failed to load draft';
  }
}

/**
 * Handle edit mode
 */
export async function handleEditMode({ path, query, session, set }) {
  // Only handle requests with ?edit=true
  if (query.edit !== 'true') {
    return null;
  }

  // Require authentication
  if (!session.userId) {
    session.returnTo = path + '?edit=true';
    // Manually save session and return redirect with cookie
    saveSession(session._sessionId, session._getData());
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/auth/login',
        'Set-Cookie': createSessionCookie(session._sessionId)
      }
    });
  }

  const pagePath = normalizePath(path);

  try {
    const html = await getPage(pagePath);

    if (!html) {
      set.status = 404;
      return 'Page not found in drafts';
    }

    // Inject the editor UI into the HTML
    const modifiedHtml = injectEditor(html, pagePath);

    set.headers['Content-Type'] = 'text/html';
    return modifiedHtml;
  } catch (error) {
    console.error('Preview error:', error);
    set.status = 500;
    return 'Failed to load preview';
  }
}

/**
 * Preview routes plugin - empty as preview is handled in server.js
 */
export const previewRoutes = new Elysia();

export default previewRoutes;
