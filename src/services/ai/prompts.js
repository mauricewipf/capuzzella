/**
 * Tool definitions for AI function calling
 * These are used by both OpenAI and Anthropic
 */
/**
 * Shared schema fragments for the edit_page changes array
 */
const CHANGES_SCHEMA = {
  type: 'array',
  description: 'Ordered list of search-and-replace operations to apply to the current HTML',
  items: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'The exact HTML snippet to find in the current page (must match exactly, including whitespace and indentation)'
      },
      replace: {
        type: 'string',
        description: 'The HTML snippet to replace it with'
      }
    },
    required: ['search', 'replace']
  }
};

const GET_COMPONENTS_DESCRIPTION = 'Load HTML templates from the design system component library. Call this BEFORE edit_page or create_page when you need component markup as reference. Only request the components you actually need.';

const GET_COMPONENTS_NAMES_DESCRIPTION = 'Array of component names to load (e.g. ["card", "button"]). Only include components relevant to the current request.';

export const AI_TOOLS = {
  openai: [
    {
      type: 'function',
      function: {
        name: 'get_components',
        description: GET_COMPONENTS_DESCRIPTION,
        parameters: {
          type: 'object',
          properties: {
            names: {
              type: 'array',
              items: { type: 'string' },
              description: GET_COMPONENTS_NAMES_DESCRIPTION
            }
          },
          required: ['names']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'edit_page',
        description: 'Edit the current page by applying targeted search-and-replace changes to its HTML',
        parameters: {
          type: 'object',
          properties: {
            explanation: {
              type: 'string',
              description: 'A brief explanation of what changes were made'
            },
            changes: CHANGES_SCHEMA
          },
          required: ['explanation', 'changes']
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
      name: 'get_components',
      description: GET_COMPONENTS_DESCRIPTION,
      input_schema: {
        type: 'object',
        properties: {
          names: {
            type: 'array',
            items: { type: 'string' },
            description: GET_COMPONENTS_NAMES_DESCRIPTION
          }
        },
        required: ['names']
      }
    },
    {
      name: 'edit_page',
      description: 'Edit the current page by applying targeted search-and-replace changes to its HTML',
      input_schema: {
        type: 'object',
        properties: {
          explanation: {
            type: 'string',
            description: 'A brief explanation of what changes were made'
          },
          changes: CHANGES_SCHEMA
        },
        required: ['explanation', 'changes']
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
 * Format loaded components into a text block for tool results.
 *
 * @param {Array<{ name: string, html: string }>} components
 * @returns {string}
 */
export function formatComponentResult(components) {
  if (components.length === 0) {
    return 'No matching components found. Proceed using standard Bootstrap markup.';
  }
  return components
    .map(c => `### ${c.name}\n${c.html}`)
    .join('\n\n');
}

/**
 * Parse a tool call into a standardized result.
 *
 * @param {string} name - Tool / function name
 * @param {object} args - Tool arguments / input
 * @returns {{ action: string, assistantMessage: string, changes: Array|null, updatedHtml: string|null, newPagePath: string|null }}
 */
export function parseToolCall(name, args) {
  switch (name) {
    case 'edit_page':
      return {
        action: 'edit',
        assistantMessage: args.explanation,
        changes: args.changes,
        updatedHtml: null,
        newPagePath: null
      };

    case 'create_page':
      return {
        action: 'create',
        assistantMessage: args.explanation,
        changes: null,
        updatedHtml: args.html,
        newPagePath: args.path
      };

    case 'respond':
    default:
      return {
        action: 'respond',
        assistantMessage: args.message || args.explanation || '',
        changes: null,
        updatedHtml: null,
        newPagePath: null
      };
  }
}

const FALLBACK_RESULT = {
  action: 'respond',
  assistantMessage: 'I could not process your request.',
  changes: null,
  updatedHtml: null,
  newPagePath: null
};

/** Default result when the AI returns no actionable tool call. */
export function fallbackResult(message) {
  return { ...FALLBACK_RESULT, assistantMessage: message || FALLBACK_RESULT.assistantMessage };
}

/**
 * Build the system prompt for the AI
 * 
 * @param {string[]} componentNames - Available component names from the components/ directory
 * @returns {string}
 */
export function buildSystemPrompt(componentNames = []) {
  const componentList = componentNames.length > 0
    ? componentNames.map(n => `  - ${n}`).join('\n')
    : '  (none available)';

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

1. **get_components**: Load HTML templates from the design system. Call this FIRST when you need to add or modify components like cards, buttons, etc. Only request the components you need for the current task.
2. **edit_page**: Use this to modify the current page by providing an array of search-and-replace changes. Each change has a \`search\` string (the exact HTML to find) and a \`replace\` string (the HTML to replace it with). Changes are applied in order.
3. **create_page**: Use this to create a brand new page at a specified path. Provide the complete HTML document.
4. **respond**: Use this when no page changes are needed (e.g., answering questions, clarifying requests)

## Design System Components

A component library is available with HTML templates designed for this project. When adding or editing components on a page, use get_components to load the relevant templates and base your HTML on them. This ensures visual consistency across the site.

Available components:
${componentList}

## How edit_page Works

The edit_page tool uses a **search-and-replace** approach:
- You provide an array of \`changes\`, each with \`search\` and \`replace\` fields.
- The \`search\` field must contain an EXACT snippet from the current HTML (including whitespace and indentation).
- The \`replace\` field contains the new HTML that will replace the matched snippet.
- Only include enough context in \`search\` to uniquely identify the target location — do NOT include the entire document.
- Changes are applied sequentially in the order you provide them.
- To remove a section, set \`replace\` to an empty string.
- To add new content, find the element just before or after where you want to insert, and include it in \`search\`, then include it plus the new content in \`replace\`.

## Critical Rules

- The \`search\` field MUST match the current HTML EXACTLY, including all whitespace, indentation, and line breaks.
- Only include the minimal HTML snippet needed to uniquely locate the change. Do NOT include the entire document.
- Make ONLY the changes the user requested. Do NOT alter, reformat, or remove anything else.
- Do NOT remove or modify SVG icons, images, or their attributes unless explicitly asked.
- Do NOT change Bootstrap classes on elements you were not asked to modify.
- Do NOT remove HTML comments unless asked.
- Preserve all whitespace and formatting in unchanged sections.

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

Pages include Bootstrap CSS, a theme override, and Bootstrap JS via local asset paths:
- CSS: \`<link rel="stylesheet" href="assets/css/bootstrap.min.css">\`
- Theme: \`<link rel="stylesheet" href="assets/css/theme.css">\`
- JS: \`<script src="assets/js/bootstrap.bundle.min.js" defer></script>\`

## Contact Forms

When adding a contact form to a page:
1. Add the \`data-contact\` attribute to the \`<form>\` element (e.g. \`<form data-contact>\`)
2. Give every input/textarea/select a \`name\` attribute — the name becomes the field label in the email
3. Add \`required\` to fields that must be filled in
4. Include a submit button with \`type="submit"\`
5. Add this script tag once before \`</body>\`: \`<script src="assets/js/form.js"></script>\`
   - Only include it **once per page**, even if there are multiple forms

The script automatically discovers all \`form[data-contact]\` elements on the page, posts their fields to \`/api/form\`, and shows Bootstrap alert feedback. No inline JavaScript is needed. Example:

\`\`\`html
<form data-contact>
  <div class="mb-3">
    <label for="name" class="form-label">Name</label>
    <input type="text" name="name" id="name" class="form-control" required>
  </div>
  <div class="mb-3">
    <label for="email" class="form-label">Email</label>
    <input type="email" name="email" id="email" class="form-control" required>
  </div>
  <div class="mb-3">
    <label for="message" class="form-label">Message</label>
    <textarea name="message" id="message" rows="4" class="form-control" required></textarea>
  </div>
  <button type="submit" class="btn btn-primary">Send</button>
</form>
\`\`\`

## Guidelines

1. **Preserve structure**: Keep the basic HTML document structure (<!DOCTYPE>, <html>, <head>, <body>)
2. **Use Bootstrap CSS**: All styling must use Bootstrap CSS classes — no Tailwind, no custom CSS frameworks
3. **Be precise**: Make only the changes the user requests; don't make unrelated modifications
4. **Maintain consistency**: Match the existing style and design patterns of the page
5. **Keep it valid**: Always return valid, well-formatted HTML
6. **No external resources**: Don't add external scripts or stylesheets beyond what's already present (form.js is a local asset)
7. **Be helpful**: If the user's request is unclear, use the respond tool to ask for clarification

## Creating New Pages

When creating new pages (use the create_page tool, NOT edit_page):
- Use descriptive paths (e.g., "about.html", "services/consulting.html", "blog/my-first-post.html")
- Match the styling of existing pages when possible
- Use Bootstrap components and utilities for all layout and styling

**CRITICAL**: The \`html\` field MUST be a complete, valid HTML document. Always start with \`<!DOCTYPE html>\` and include the full structure shown below. Missing any of these elements will cause the page to be rejected.

Use this exact template as a starting point for every new page:

\`\`\`html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PAGE TITLE HERE</title>
  <link rel="stylesheet" href="assets/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/css/theme.css">
  <script src="assets/js/bootstrap.bundle.min.js" defer></script>
</head>

<body>
  PAGE CONTENT HERE (use Bootstrap components and grid system)
</body>

</html>
\`\`\`

Every new page MUST include:
1. \`<!DOCTYPE html>\` as the very first line
2. \`<html lang="en">\`
3. A \`<head>\` with charset, viewport meta tags, and a \`<title>\`
4. Bootstrap CSS link: \`<link rel="stylesheet" href="assets/css/bootstrap.min.css">\`
5. Theme CSS link: \`<link rel="stylesheet" href="assets/css/theme.css">\` (after bootstrap)
6. Bootstrap JS: \`<script src="assets/js/bootstrap.bundle.min.js" defer></script>\`
7. A \`<body>\` with the actual page content

## Example

User request: "Change the hero heading to 'Welcome to My Site'"

Correct edit_page tool call:
- explanation: "Updated the hero heading text"
- changes:
  [
    {
      "search": "<h1 class=\\"display-3 fw-bold mb-4\\">\\n            A Website Builder like it's 2026!\\n          </h1>",
      "replace": "<h1 class=\\"display-3 fw-bold mb-4\\">\\n            Welcome to My Site\\n          </h1>"
    }
  ]

Notice: only the heading element is included — not the entire section or document. The search string matches the existing HTML exactly.
`.trim();
}
