import { Elysia } from 'elysia';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { processChat } from '../services/ai/index.js';
import { deletePage, getPage, listPages, savePage } from '../services/pages.js';

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
    const { message, pagePath } = body;

    if (!message || !pagePath) {
      set.status = 400;
      return { error: 'Message and pagePath are required' };
    }

    try {
      // Get current page content (may be null if page doesn't exist)
      const currentHtml = await getPage(pagePath);

      const result = await processChat(message, currentHtml, pagePath);

      // Handle different actions
      if (result.action === 'create' && result.newPagePath && result.updatedHtml) {
        // Create a new page
        await savePage(result.newPagePath, result.updatedHtml);

        return {
          success: true,
          action: 'create',
          message: result.assistantMessage,
          updatedHtml: result.updatedHtml,
          newPagePath: result.newPagePath
        };
      } else if (result.action === 'edit' && result.updatedHtml) {
        // Edit the current page
        await savePage(pagePath, result.updatedHtml);

        return {
          success: true,
          action: 'edit',
          message: result.assistantMessage,
          updatedHtml: result.updatedHtml
        };
      } else {
        // Just a response, no page changes
        return {
          success: true,
          action: 'respond',
          message: result.assistantMessage,
          updatedHtml: null
        };
      }
    } catch (error) {
      console.error('Chat error:', error);

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
      console.error('List pages error:', error);
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
      console.error('Get page error:', error);
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
      console.error('Save page error:', error);
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
      console.error('Delete page error:', error);
      set.status = 500;
      return { error: 'Failed to delete page' };
    }
  });

export default apiRoutes;
