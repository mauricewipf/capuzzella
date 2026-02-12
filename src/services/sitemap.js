import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';

const log = logger.child('sitemap');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../../public');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');

/**
 * List all published HTML pages in the public directory
 * 
 * @param {string} dir - Directory to scan (relative to public)
 * @returns {Promise<Array<{path: string, lastmod: string}>>} - Array of page info
 */
async function listPublishedPages(dir = '') {
  const fullDir = path.join(PUBLIC_DIR, dir);
  const pages = [];

  try {
    const entries = await fs.readdir(fullDir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = dir ? `${dir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subPages = await listPublishedPages(relativePath);
        pages.push(...subPages);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        // Get file stats for lastmod
        const filePath = path.join(fullDir, entry.name);
        const stats = await fs.stat(filePath);
        
        pages.push({
          path: relativePath,
          lastmod: stats.mtime.toISOString().split('T')[0] // YYYY-MM-DD format
        });
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
 * Convert a page path to a URL path
 * - index.html -> /
 * - about.html -> /about
 * - about/team.html -> /about/team
 * - about/index.html -> /about/
 * 
 * @param {string} pagePath - The file path (e.g., 'about/team.html')
 * @returns {string} - The URL path (e.g., '/about/team')
 */
function pagePathToUrlPath(pagePath) {
  // Remove .html extension
  let urlPath = pagePath.replace(/\.html$/, '');
  
  // Handle index files
  if (urlPath === 'index') {
    return '/';
  }
  
  if (urlPath.endsWith('/index')) {
    return '/' + urlPath.slice(0, -6) + '/';
  }
  
  return '/' + urlPath;
}

/**
 * Generate sitemap XML content
 * 
 * @param {Array<{path: string, lastmod: string}>} pages - Array of page info
 * @param {string} baseUrl - Base URL of the site
 * @returns {string} - Sitemap XML content
 */
function generateSitemapXml(pages, baseUrl) {
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  const urlEntries = pages.map(page => {
    const urlPath = pagePathToUrlPath(page.path);
    const loc = cleanBaseUrl + urlPath;
    
    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${page.lastmod}</lastmod>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}

/**
 * Escape special XML characters
 * 
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate and save the sitemap.xml file
 * 
 * @returns {Promise<{success: boolean, pageCount: number, path: string}>}
 */
export async function generateSitemap() {
  const baseUrl = process.env.SITE_URL || 'http://localhost:3000';
  
  try {
    // Ensure public directory exists
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    
    // Get all published pages
    const pages = await listPublishedPages();
    
    // Generate sitemap XML
    const sitemapXml = generateSitemapXml(pages, baseUrl);
    
    // Write sitemap to file
    await fs.writeFile(SITEMAP_PATH, sitemapXml, 'utf-8');
    
    log.info(`Sitemap generated with ${pages.length} pages`);
    
    return {
      success: true,
      pageCount: pages.length,
      path: 'sitemap.xml'
    };
  } catch (error) {
    log.error('Failed to generate sitemap', { error: error.message });
    throw error;
  }
}

/**
 * Delete the sitemap.xml file (e.g., when all pages are unpublished)
 * 
 * @returns {Promise<boolean>} - True if deleted, false if didn't exist
 */
export async function deleteSitemap() {
  try {
    await fs.unlink(SITEMAP_PATH);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
