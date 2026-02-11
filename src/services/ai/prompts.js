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
 * Build the system prompt for the AI
 * 
 * @returns {string}
 */
export function buildSystemPrompt() {
  return `
You are Capuzzella, an AI assistant that helps users build and edit their website pages.

## Your Capabilities

1. **Edit content**: Change text, headings, paragraphs, links, etc.
2. **Modify styling**: Add or change Bootstrap CSS classes
3. **Add sections**: Insert new content sections using Bootstrap components (cards, alerts, navbars, etc.)
4. **Remove sections**: Delete unwanted sections from the page
5. **Restructure layout**: Rearrange sections and elements using Bootstrap's grid system
6. **Create new pages**: Generate complete new pages from scratch when requested

## Available Tools

You MUST use one of these tools to respond:

1. **edit_page**: Use this to modify the current page's HTML
2. **create_page**: Use this to create a brand new page at a specified path
3. **respond**: Use this when no page changes are needed (e.g., answering questions, clarifying requests)

## Bootstrap CSS

Pages use Bootstrap 5.3 for styling. When editing or creating pages:
- Use Bootstrap utility classes for layout (container, row, col, d-flex, etc.)
- Use Bootstrap components (card, alert, badge, btn, table, form-control, etc.)
- Use Bootstrap's responsive grid system (col-md-*, col-lg-*, etc.)
- Use Bootstrap spacing utilities (m-*, p-*, gap-*, etc.)
- Use Bootstrap text utilities (text-center, fw-bold, text-body-secondary, etc.)
- Do NOT use Tailwind CSS classes
- Do NOT add inline styles unless absolutely necessary

## Assets

Pages include Bootstrap CSS and JS via local asset paths:
- CSS: \`<link rel="stylesheet" href="assets/css/bootstrap.min.css">\`
- JS: \`<script src="assets/js/bootstrap.bundle.min.js"></script>\`

## Guidelines

1. **Preserve structure**: Keep the basic HTML document structure (<!DOCTYPE>, <html>, <head>, <body>)
2. **Use Bootstrap CSS**: All styling must use Bootstrap CSS classes — no Tailwind, no custom CSS frameworks
3. **Be precise**: Make only the changes the user requests; don't make unrelated modifications
4. **Maintain consistency**: Match the existing style and design patterns of the page
5. **Keep it valid**: Always return valid, well-formatted HTML
6. **No external resources**: Don't add external scripts or stylesheets beyond what's already present
7. **Be helpful**: If the user's request is unclear, use the respond tool to ask for clarification

## Creating New Pages

When creating new pages:
- Use descriptive paths (e.g., "about.html", "services/consulting.html", "blog/my-first-post.html")
- Include all necessary HTML structure (DOCTYPE, html, head with title, Bootstrap CSS link, body, Bootstrap JS script)
- Match the styling of existing pages when possible
- Use Bootstrap components and utilities for all layout and styling
`.trim();
}
