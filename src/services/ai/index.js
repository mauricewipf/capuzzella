import { processWithOpenAI } from './openai.js';
import { processWithAnthropic } from './anthropic.js';
import { loadComponents, buildSystemPrompt } from './prompts.js';

/**
 * Process a chat message and return AI response with updated HTML
 * 
 * @param {string} message - User's chat message
 * @param {string} currentHtml - Current HTML of the page
 * @param {string} pagePath - Path to the current page
 * @returns {Promise<{assistantMessage: string, updatedHtml: string | null}>}
 */
export async function processChat(message, currentHtml, pagePath) {
  const provider = process.env.AI_PROVIDER || 'openai';
  
  // Load available components for context
  const components = await loadComponents();
  
  // Build the system prompt with component library
  const systemPrompt = buildSystemPrompt(components);
  
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
 * @param {string} currentHtml - Current HTML content
 * @param {string} pagePath - Path to the page
 * @returns {string}
 */
function buildUserMessage(message, currentHtml, pagePath) {
  return `
Current page: ${pagePath}

Current HTML:
\`\`\`html
${currentHtml}
\`\`\`

User request: ${message}

Please respond with:
1. A brief explanation of what changes you'll make
2. The complete updated HTML (if changes are needed)

Format your response as:
EXPLANATION:
[Your explanation here]

HTML:
\`\`\`html
[Complete updated HTML here]
\`\`\`

If no changes are needed, omit the HTML section.
`.trim();
}
