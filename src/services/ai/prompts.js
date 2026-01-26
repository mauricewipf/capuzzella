import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, '../../../components');

/**
 * Load all component templates from the components directory
 * 
 * @returns {Promise<Map<string, string>>} - Map of component name to HTML content
 */
export async function loadComponents() {
  const components = new Map();
  
  try {
    const files = await fs.readdir(COMPONENTS_DIR);
    
    for (const file of files) {
      if (file.endsWith('.html')) {
        const name = file.replace('.html', '');
        const content = await fs.readFile(path.join(COMPONENTS_DIR, file), 'utf-8');
        components.set(name, content);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading components:', error);
    }
  }
  
  return components;
}

/**
 * Build the system prompt for the AI
 * 
 * @param {Map<string, string>} components - Available component templates
 * @returns {string}
 */
export function buildSystemPrompt(components) {
  let componentList = '';
  
  if (components.size > 0) {
    componentList = `
## Available Components

You can use these pre-built components when building or editing pages:

${Array.from(components.entries()).map(([name, html]) => `
### ${name}
\`\`\`html
${html}
\`\`\`
`).join('\n')}
`;
  }
  
  return `
You are Capuzzella, an AI assistant that helps users edit their website pages. You receive the current HTML of a page and user instructions, then return the modified HTML.

## Your Capabilities

1. **Edit content**: Change text, headings, paragraphs, links, etc.
2. **Modify styling**: Add or change Tailwind CSS classes
3. **Add sections**: Insert new content sections using the component library
4. **Remove sections**: Delete unwanted sections from the page
5. **Restructure layout**: Rearrange sections and elements

## Guidelines

1. **Preserve structure**: Keep the basic HTML document structure (<!DOCTYPE>, <html>, <head>, <body>)
2. **Use Tailwind CSS**: All styling should use Tailwind CSS utility classes
3. **Be precise**: Make only the changes the user requests; don't make unrelated modifications
4. **Maintain consistency**: Match the existing style and design patterns of the page
5. **Keep it valid**: Always return valid, well-formatted HTML
6. **No external resources**: Don't add external scripts or stylesheets beyond what's already present
7. **Be helpful**: If the user's request is unclear, explain what you understood and what you changed

## Response Format

Always respond with:
1. EXPLANATION: A brief description of what changes you made
2. HTML: The complete updated HTML document (if changes were made)

If no changes are needed, explain why and omit the HTML section.
${componentList}
`.trim();
}
