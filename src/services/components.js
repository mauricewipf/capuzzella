import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_DIR = path.join(__dirname, '../../components');

/**
 * List all available component names (file basenames without .html extension).
 *
 * @returns {Promise<string[]>} Sorted array of component names, e.g. ['button', 'card']
 */
export async function listComponentNames() {
  try {
    const files = await readdir(COMPONENTS_DIR);
    return files
      .filter(f => f.endsWith('.html'))
      .map(f => f.replace('.html', ''))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Load the HTML content of specific components by name.
 *
 * @param {string[]} names - Component names to load (e.g. ['card', 'button'])
 * @returns {Promise<Array<{ name: string, html: string }>>} Loaded components (skips missing ones)
 */
export async function loadComponents(names) {
  const results = [];

  for (const name of names) {
    const safeName = path.basename(name).replace(/[^a-z0-9-]/gi, '');
    const file = Bun.file(path.join(COMPONENTS_DIR, `${safeName}.html`));
    if (await file.exists()) {
      results.push({ name: safeName, html: await file.text() });
    }
  }

  return results;
}

/**
 * Load all component files from the components directory.
 *
 * @returns {Promise<Array<{ name: string, html: string }>>}
 */
export async function loadAllComponents() {
  const names = await listComponentNames();
  return loadComponents(names);
}
