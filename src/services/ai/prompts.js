import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, '../../../components');

/**
 * Tool definitions for AI function calling
 * These are used by both OpenAI and Anthropic
 */
export const AI_TOOLS = {
  openai: [
    {
      type: 'function',
      function: {
        name: 'edit_page',
        description: 'Edit the current page by updating its HTML content',
        parameters: {
          type: 'object',
          properties: {
            explanation: {
              type: 'string',
              description: 'A brief explanation of what changes were made'
            },
            html: {
              type: 'string',
              description: 'The complete updated HTML document'
            }
          },
          required: ['explanation', 'html']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_page',
        description: 'Create a new page with the specified path and HTML content',
        parameters: {
          type: 'object',
          properties: {
            explanation: {
              type: 'string',
              description: 'A brief explanation of the new page being created'
            },
            path: {
              type: 'string',
              description: 'The path for the new page (e.g., "about.html", "services/web-design.html")'
            },
            html: {
              type: 'string',
              description: 'The complete HTML document for the new page'
            }
          },
          required: ['explanation', 'path', 'html']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'respond',
        description: 'Respond to the user without making any changes to pages',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The response message to the user'
            }
          },
          required: ['message']
        }
      }
    }
  ],
  anthropic: [
    {
      name: 'edit_page',
      description: 'Edit the current page by updating its HTML content',
      input_schema: {
        type: 'object',
        properties: {
          explanation: {
            type: 'string',
            description: 'A brief explanation of what changes were made'
          },
          html: {
            type: 'string',
            description: 'The complete updated HTML document'
          }
        },
        required: ['explanation', 'html']
      }
    },
    {
      name: 'create_page',
      description: 'Create a new page with the specified path and HTML content',
      input_schema: {
        type: 'object',
        properties: {
          explanation: {
            type: 'string',
            description: 'A brief explanation of the new page being created'
          },
          path: {
            type: 'string',
            description: 'The path for the new page (e.g., "about.html", "services/web-design.html")'
          },
          html: {
            type: 'string',
            description: 'The complete HTML document for the new page'
          }
        },
        required: ['explanation', 'path', 'html']
      }
    },
    {
      name: 'respond',
      description: 'Respond to the user without making any changes to pages',
      input_schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The response message to the user'
          }
        },
        required: ['message']
      }
    }
  ]
};

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
You are Capuzzella, an AI assistant that helps users build and edit their website pages.

## Your Capabilities

1. **Edit content**: Change text, headings, paragraphs, links, etc.
2. **Modify styling**: Add or change Tailwind CSS classes
3. **Add sections**: Insert new content sections using the component library
4. **Remove sections**: Delete unwanted sections from the page
5. **Restructure layout**: Rearrange sections and elements
6. **Create new pages**: Generate complete new pages from scratch when requested

## Available Tools

You MUST use one of these tools to respond:

1. **edit_page**: Use this to modify the current page's HTML
2. **create_page**: Use this to create a brand new page at a specified path
3. **respond**: Use this when no page changes are needed (e.g., answering questions, clarifying requests)

## Guidelines

1. **Preserve structure**: Keep the basic HTML document structure (<!DOCTYPE>, <html>, <head>, <body>)
2. **Use Tailwind CSS**: All styling should use Tailwind CSS utility classes
3. **Be precise**: Make only the changes the user requests; don't make unrelated modifications
4. **Maintain consistency**: Match the existing style and design patterns of the page
5. **Keep it valid**: Always return valid, well-formatted HTML
6. **No external resources**: Don't add external scripts or stylesheets beyond what's already present
7. **Be helpful**: If the user's request is unclear, use the respond tool to ask for clarification

## Creating New Pages

When creating new pages:
- Use descriptive paths (e.g., "about.html", "services/consulting.html", "blog/my-first-post.html")
- Include all necessary HTML structure (DOCTYPE, html, head with title and Tailwind CDN, body)
- Match the styling of existing pages when possible
- Include the Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
${componentList}
`.trim();
}
