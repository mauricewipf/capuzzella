import express from 'express';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { getPage, savePage, listPages, deletePage } from '../services/pages.js';
import { processChat } from '../services/ai/index.js';

const router = express.Router();

// All API routes require authentication and password to be changed
router.use(requireAuth);
router.use(requirePasswordChanged);

/**
 * POST /api/chat - Process AI chat message for page editing
 */
router.post('/chat', async (req, res) => {
  const { message, pagePath } = req.body;
  
  if (!message || !pagePath) {
    return res.status(400).json({ error: 'Message and pagePath are required' });
  }
  
  try {
    const currentHtml = await getPage(pagePath);
    
    if (!currentHtml) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    const result = await processChat(message, currentHtml, pagePath);
    
    if (result.updatedHtml) {
      await savePage(pagePath, result.updatedHtml);
    }
    
    res.json({
      success: true,
      message: result.assistantMessage,
      updatedHtml: result.updatedHtml
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
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
