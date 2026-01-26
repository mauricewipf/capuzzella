import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { injectEditor } from '../middleware/inject-editor.js';
import { getPage } from '../services/pages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Handle draft preview mode requests (URLs with ?draft=true or ?drafts=true)
 * Serves draft HTML without the editor UI
 */
router.get('*', async (req, res, next) => {
  // Only handle requests with ?draft=true or ?drafts=true
  if (req.query.draft !== 'true' && req.query.drafts !== 'true') {
    return next();
  }

  // Require authentication for draft mode
  if (!req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  // Determine the page path from the URL
  let pagePath = req.path;

  // Default to index.html for root or directory paths
  if (pagePath === '/' || pagePath.endsWith('/')) {
    pagePath = pagePath + 'index.html';
  }

  // Ensure .html extension
  if (!pagePath.endsWith('.html')) {
    pagePath = pagePath + '.html';
  }

  // Remove leading slash for file operations
  pagePath = pagePath.replace(/^\//, '');

  try {
    const html = await getPage(pagePath);

    if (!html) {
      return res.status(404).send('Page not found in drafts');
    }

    // Serve the draft HTML without the editor
    res.type('html').send(html);
  } catch (error) {
    console.error('Draft preview error:', error);
    res.status(500).send('Failed to load draft');
  }
});

/**
 * Handle preview mode requests (URLs with ?edit=true)
 * Serves draft HTML with injected editor UI
 */
router.get('*', async (req, res, next) => {
  // Only handle requests with ?edit=true
  if (req.query.edit !== 'true') {
    return next();
  }

  // Require authentication for edit mode
  if (!req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  // Determine the page path from the URL
  let pagePath = req.path;

  // Default to index.html for root or directory paths
  if (pagePath === '/' || pagePath.endsWith('/')) {
    pagePath = pagePath + 'index.html';
  }

  // Ensure .html extension
  if (!pagePath.endsWith('.html')) {
    pagePath = pagePath + '.html';
  }

  // Remove leading slash for file operations
  pagePath = pagePath.replace(/^\//, '');

  try {
    const html = await getPage(pagePath);

    if (!html) {
      return res.status(404).send('Page not found in drafts');
    }

    // Inject the editor UI into the HTML
    const modifiedHtml = injectEditor(html, pagePath);

    res.type('html').send(modifiedHtml);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).send('Failed to load preview');
  }
});

export default router;
