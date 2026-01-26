import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRAFTS_DIR = path.join(__dirname, '../../drafts');

/**
 * Ensure the drafts directory exists
 */
async function ensureDraftsDir() {
  await fs.mkdir(DRAFTS_DIR, { recursive: true });
}

/**
 * Get the content of a page from drafts
 * 
 * @param {string} pagePath - Relative path to the page (e.g., 'index.html' or 'about/team.html')
 * @returns {Promise<string | null>} - HTML content or null if not found
 */
export async function getPage(pagePath) {
  try {
    const fullPath = path.join(DRAFTS_DIR, pagePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Save a page to drafts
 * 
 * @param {string} pagePath - Relative path to the page
 * @param {string} html - HTML content to save
 */
export async function savePage(pagePath, html) {
  await ensureDraftsDir();
  
  const fullPath = path.join(DRAFTS_DIR, pagePath);
  
  // Ensure parent directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  
  await fs.writeFile(fullPath, html, 'utf-8');
}

/**
 * Delete a page from drafts
 * 
 * @param {string} pagePath - Relative path to the page
 */
export async function deletePage(pagePath) {
  const fullPath = path.join(DRAFTS_DIR, pagePath);
  
  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * List all HTML pages in drafts
 * 
 * @param {string} dir - Directory to scan (relative to drafts)
 * @returns {Promise<string[]>} - Array of page paths relative to drafts
 */
export async function listPages(dir = '') {
  await ensureDraftsDir();
  
  const fullDir = path.join(DRAFTS_DIR, dir);
  const pages = [];
  
  try {
    const entries = await fs.readdir(fullDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subPages = await listPages(relativePath);
        pages.push(...subPages);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        pages.push(relativePath);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  return pages;
}

/**
 * Create a backup of a page before editing
 * 
 * @param {string} pagePath - Relative path to the page
 * @returns {Promise<string | null>} - Backup path or null if original doesn't exist
 */
export async function backupPage(pagePath) {
  const content = await getPage(pagePath);
  
  if (!content) {
    return null;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = pagePath.replace('.html', `.backup-${timestamp}.html`);
  
  await savePage(backupPath, content);
  
  return backupPath;
}
