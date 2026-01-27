import express from 'express';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { processChat } from '../services/ai/index.js';
import { deletePage, getPage, listPages, savePage } from '../services/pages.js';

const router = express.Router();

// All API routes require authentication and password to be changed
router.use(requireAuth);
router.use(requirePasswordChanged);

/**
 * POST /api/chat - Process AI chat message for page editing or creation
 */
router.post('/chat', async (req, res) => {
  const { message, pagePath } = req.body;

  if (!message || !pagePath) {
    return res.status(400).json({ error: 'Message and pagePath are required' });
  }

  try {
    // Get current page content (may be null if page doesn't exist)
    const currentHtml = await getPage(pagePath);

    const result = await processChat(message, currentHtml, pagePath);

    // Handle different actions
    if (result.action === 'create' && result.newPagePath && result.updatedHtml) {
      // Create a new page
      await savePage(result.newPagePath, result.updatedHtml);
      
      res.json({
        success: true,
        action: 'create',
        message: result.assistantMessage,
        updatedHtml: result.updatedHtml,
        newPagePath: result.newPagePath
      });
    } else if (result.action === 'edit' && result.updatedHtml) {
      // Edit the current page
      await savePage(pagePath, result.updatedHtml);
      
      res.json({
        success: true,
        action: 'edit',
        message: result.assistantMessage,
        updatedHtml: result.updatedHtml
      });
    } else {
      // Just a response, no page changes
      res.json({
        success: true,
        action: 'respond',
        message: result.assistantMessage,
        updatedHtml: null
      });
    }
  } catch (error) {
    console.error('Chat error:', error);

    // Include more details in the error response for debugging
    const errorDetails = {
      error: 'Failed to process chat message',
      message: error.message,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error.stack,
        name: error.name
      })
    };

    res.status(500).json(errorDetails);
  }
});

/**
 * GET /api/pages - List all pages in drafts
 */
router.get('/pages', async (req, res) => {
  try {
    const pages = await listPages();
    res.json({ pages });
  } catch (error) {
    console.error('List pages error:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
});

/**
 * GET /api/pages/:pagePath - Get a specific page
 */
router.get('/pages/*', async (req, res) => {
  const pagePath = req.params[0];

  try {
    const html = await getPage(pagePath);

    if (!html) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ html });
  } catch (error) {
    console.error('Get page error:', error);
    res.status(500).json({ error: 'Failed to get page' });
  }
});

/**
 * PUT /api/pages/:pagePath - Save/update a page
 */
router.put('/pages/*', async (req, res) => {
  const pagePath = req.params[0];
  const { html } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  try {
    await savePage(pagePath, html);
    res.json({ success: true });
  } catch (error) {
    console.error('Save page error:', error);
    res.status(500).json({ error: 'Failed to save page' });
  }
});

/**
 * DELETE /api/pages/:pagePath - Delete a page
 */
router.delete('/pages/*', async (req, res) => {
  const pagePath = req.params[0];

  try {
    await deletePage(pagePath);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete page error:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

export default router;
