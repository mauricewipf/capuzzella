import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.js';
import { listPages } from '../services/pages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const DRAFTS_DIR = path.join(__dirname, '../../drafts');
const PUBLIC_DIR = path.join(__dirname, '../../public');

// All publish routes require authentication and password to be changed
router.use(requireAuth);
router.use(requirePasswordChanged);

/**
 * POST /publish - Publish all drafts to public directory
 */
router.post('/', async (req, res) => {
  try {
    const pages = await listPages();
    
    if (pages.length === 0) {
      return res.status(400).json({ error: 'No pages to publish' });
    }
    
    // Ensure public directory exists
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    
    const published = [];
    const errors = [];
    
    for (const pagePath of pages) {
      try {
        const sourcePath = path.join(DRAFTS_DIR, pagePath);
        const destPath = path.join(PUBLIC_DIR, pagePath);
        
        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        
        // Copy file
        await fs.copyFile(sourcePath, destPath);
        published.push(pagePath);
      } catch (error) {
        console.error(`Failed to publish ${pagePath}:`, error);
        errors.push({ path: pagePath, error: error.message });
      }
    }
    
    res.json({
      success: true,
      published,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Failed to publish pages' });
  }
});

/**
 * GET /publish/status/:pagePath - Check if a specific page is published
 */
router.get('/status/*', async (req, res) => {
  const pagePath = req.params[0];
  
  try {
    const draftPath = path.join(DRAFTS_DIR, pagePath);
    const publicPath = path.join(PUBLIC_DIR, pagePath);
    
    // Check if draft exists
    let draftExists = false;
    try {
      await fs.access(draftPath);
      draftExists = true;
    } catch {
      draftExists = false;
    }
    
    if (!draftExists) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Check if published version exists
    let isPublished = false;
    try {
      await fs.access(publicPath);
      isPublished = true;
    } catch {
      isPublished = false;
    }
    
    // If published, check if draft has unpublished changes
    let hasUnpublishedChanges = false;
    if (isPublished) {
      const [draftStat, publicStat] = await Promise.all([
        fs.stat(draftPath),
        fs.stat(publicPath)
      ]);
      hasUnpublishedChanges = draftStat.mtime > publicStat.mtime;
    }
    
    res.json({
      pagePath,
      isPublished,
      hasUnpublishedChanges
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check publish status' });
  }
});

/**
 * POST /publish/:pagePath - Publish a specific page
 */
router.post('/*', async (req, res) => {
  const pagePath = req.params[0];
  
  try {
    const sourcePath = path.join(DRAFTS_DIR, pagePath);
    const destPath = path.join(PUBLIC_DIR, pagePath);
    
    // Check if source exists
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(404).json({ error: 'Page not found in drafts' });
    }
    
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    // Copy file
    await fs.copyFile(sourcePath, destPath);
    
    res.json({
      success: true,
      published: pagePath
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Failed to publish page' });
  }
});

/**
 * DELETE /publish/:pagePath - Unpublish a specific page
 */
router.delete('/*', async (req, res) => {
  const pagePath = req.params[0];
  
  try {
    const publicPath = path.join(PUBLIC_DIR, pagePath);
    
    // Check if published version exists
    try {
      await fs.access(publicPath);
    } catch {
      return res.status(404).json({ error: 'Page is not published' });
    }
    
    // Remove the published file
    await fs.unlink(publicPath);
    
    res.json({
      success: true,
      unpublished: pagePath
    });
  } catch (error) {
    console.error('Unpublish error:', error);
    res.status(500).json({ error: 'Failed to unpublish page' });
  }
});

export default router;
