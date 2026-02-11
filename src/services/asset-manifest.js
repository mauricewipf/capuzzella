import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_PATH = path.join(__dirname, '../../public/assets/manifest.json');

/**
 * In-memory asset manifest: maps original relative paths to fingerprinted paths.
 * e.g. { "css/bootstrap.min.css": "css/bootstrap.min.d41d8cd98f00b204.css" }
 */
let manifest = {};

/**
 * Load (or reload) the asset manifest from disk into memory.
 * Call on server startup and after each publish.
 */
export async function loadManifest() {
  try {
    const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      manifest = {};
    } else {
      console.error('Failed to load asset manifest:', err);
      manifest = {};
    }
  }
}

/**
 * Get the current in-memory manifest object.
 */
export function getManifest() {
  return manifest;
}

/**
 * Rewrite asset paths in an HTML string using the manifest.
 * Replaces occurrences of "assets/<original>" with "assets/<fingerprinted>".
 */
export function rewriteAssetPaths(html) {
  if (!html || Object.keys(manifest).length === 0) return html;

  let result = html;
  for (const [original, fingerprinted] of Object.entries(manifest)) {
    // Replace both relative ("assets/css/...") and absolute ("/assets/css/...") references
    result = result.replaceAll(`assets/${original}`, `assets/${fingerprinted}`);
  }
  return result;
}
