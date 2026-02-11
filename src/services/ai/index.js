import { processWithAnthropic } from './anthropic.js';
import { processWithOpenAI } from './openai.js';
import { buildSystemPrompt } from './prompts.js';

/**
 * @typedef {Object} ChatResult
 * @property {string} action - The action type: 'edit', 'create', or 'respond'
 * @property {string} assistantMessage - Message from the AI
 * @property {string|null} updatedHtml - Updated or new HTML content
 * @property {string|null} newPagePath - Path for new page (only for 'create' action)
 */

/**
 * Process a chat message and return AI response with potential page changes
 * 
 * @param {string} message - User's chat message
 * @param {string|null} currentHtml - Current HTML of the page (null if creating new page without context)
 * @param {string} pagePath - Path to the current page
 * @returns {Promise<ChatResult>}
 */
export async function processChat(message, currentHtml, pagePath) {
  const provider = process.env.AI_PROVIDER || 'openai';

  // Build the system prompt
  const systemPrompt = buildSystemPrompt();

  // Build the user message with current HTML context
  const userMessage = buildUserMessage(message, currentHtml, pagePath);

  let result;

  if (provider === 'anthropic') {
    result = await processWithAnthropic(systemPrompt, userMessage);
  } else {
    result = await processWithOpenAI(systemPrompt, userMessage);
  }

  return result;
}

/**
 * Build the user message with context
 * 
 * @param {string} message - User's message
 * @param {string|null} currentHtml - Current HTML content (can be null)
 * @param {string} pagePath - Path to the page
 * @returns {string}
 */
function buildUserMessage(message, currentHtml, pagePath) {
  const htmlContext = currentHtml
    ? `Current HTML:
\`\`\`html
${currentHtml}
\`\`\``
    : 'No current page content (this may be a request to create a new page).';

  return `
Current page: ${pagePath}

${htmlContext}

User request: ${message}

Use the appropriate tool to respond:
- Use edit_page if modifying the current page
- Use create_page if creating a new page (provide a path)
- Use respond if no page changes are needed
`.trim();
}
