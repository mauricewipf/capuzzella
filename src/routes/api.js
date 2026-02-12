import { Elysia } from 'elysia';
import { logger } from '../lib/logger.js';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { processChat } from '../services/ai/index.js';
import { deletePage, getPage, listPages, savePage } from '../services/pages.js';

const log = logger.child('api');

/**
 * Validate that HTML output from the AI has essential structure.
 * 
 * @param {string} html - The HTML to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateHtml(html) {
  if (!html || html.length < 50) {
    return { valid: false, reason: 'HTML content is empty or too short' };
  }

  if (!html.toLowerCase().includes('<!doctype html>')) {
    return { valid: false, reason: 'Missing <!DOCTYPE html> declaration' };
  }

  if (!html.includes('bootstrap.min.css')) {
    return { valid: false, reason: 'Missing Bootstrap CSS reference (bootstrap.min.css)' };
  }

  if (!html.includes('theme.css')) {
    return { valid: false, reason: 'Missing theme CSS reference (theme.css)' };
  }

  return { valid: true };
}

/**
 * API routes plugin for Elysia
 */
export const apiRoutes = new Elysia({ prefix: '/api' })
  // Apply auth guards to all routes in this group
  .onBeforeHandle(({ session, request, set }) => {
    const url = new URL(request.url);
    const fullPath = url.pathname;

    const authResult = requireAuth({ session, path: fullPath, request, set });
    if (authResult !== undefined) return authResult;

    const pwResult = requirePasswordChanged({ session, path: fullPath, request, set });
    if (pwResult !== undefined) return pwResult;
  })

  /**
   * POST /api/chat - Process AI chat message for page editing or creation
   */
  .post('/chat', async ({ body, set }) => {
    const { message, pagePath, conversationId } = body;

    if (!message || !pagePath) {
      set.status = 400;
      return { error: 'Message and pagePath are required' };
    }

    try {
      // Get current page content (may be null if page doesn't exist)
      const currentHtml = await getPage(pagePath);

      const result = await processChat(message, currentHtml, pagePath, conversationId || null);

      // Handle different actions
      if (result.action === 'create' && result.newPagePath && result.updatedHtml) {
        // Validate new page HTML before saving
        const validation = validateHtml(result.updatedHtml);
        if (!validation.valid) {
          log.warn('AI produced invalid HTML for new page', { reason: validation.reason });
          set.status = 422;
          return {
            error: `AI produced invalid HTML: ${validation.reason}`,
            conversationId: result.conversationId
          };
        }

        // Create a new page
        await savePage(result.newPagePath, result.updatedHtml);

        return {
          success: true,
          action: 'create',
          message: result.assistantMessage,
          updatedHtml: result.updatedHtml,
          newPagePath: result.newPagePath,
          conversationId: result.conversationId
        };
      } else if (result.action === 'edit' && result.updatedHtml) {
        // Validate edited HTML before saving
        const validation = validateHtml(result.updatedHtml);
        if (!validation.valid) {
          log.warn('AI produced invalid HTML after edit', { reason: validation.reason });
          set.status = 422;
          return {
            error: `AI produced invalid HTML: ${validation.reason}`,
            conversationId: result.conversationId
          };
        }

        // Edit the current page
        await savePage(pagePath, result.updatedHtml);

        return {
          success: true,
          action: 'edit',
          message: result.assistantMessage,
          updatedHtml: result.updatedHtml,
          conversationId: result.conversationId
        };
      } else {
        // Just a response, no page changes
        return {
          success: true,
          action: 'respond',
          message: result.assistantMessage,
          updatedHtml: null,
          conversationId: result.conversationId
        };
      }
    } catch (error) {
      log.error('Chat error', { error: error.message, stack: error.stack });

      set.status = 500;
      return {
        error: 'Failed to process chat message',
        message: error.message,
        ...(process.env.NODE_ENV !== 'production' && {
          stack: error.stack,
          name: error.name
        })
      };
    }
  })

  /**
   * GET /api/pages - List all pages in drafts
   */
  .get('/pages', async ({ set }) => {
    try {
      const pages = await listPages();
      return { pages };
    } catch (error) {
      log.error('List pages error', { error: error.message });
      set.status = 500;
      return { error: 'Failed to list pages' };
    }
  })

  /**
   * GET /api/pages/* - Get a specific page
   */
  .get('/pages/*', async ({ params, set }) => {
    const pagePath = params['*'];

    try {
      const html = await getPage(pagePath);

      if (!html) {
        set.status = 404;
        return { error: 'Page not found' };
      }

      return { html };
    } catch (error) {
      log.error('Get page error', { error: error.message });
      set.status = 500;
      return { error: 'Failed to get page' };
    }
  })

  /**
   * PUT /api/pages/* - Save/update a page
   */
  .put('/pages/*', async ({ params, body, set }) => {
    const pagePath = params['*'];
    const { html } = body;

    if (!html) {
      set.status = 400;
      return { error: 'HTML content is required' };
    }

    try {
      await savePage(pagePath, html);
      return { success: true };
    } catch (error) {
      log.error('Save page error', { error: error.message });
      set.status = 500;
      return { error: 'Failed to save page' };
    }
  })

  /**
   * DELETE /api/pages/* - Delete a page
   */
  .delete('/pages/*', async ({ params, set }) => {
    const pagePath = params['*'];

    try {
      await deletePage(pagePath);
      return { success: true };
    } catch (error) {
      log.error('Delete page error', { error: error.message });
      set.status = 500;
      return { error: 'Failed to delete page' };
    }
  });

export default apiRoutes;
