import OpenAI from 'openai';
import { AI_TOOLS } from './prompts.js';

let openaiClient = null;

/**
 * Get or create OpenAI client
 * @returns {OpenAI}
 */
function getClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
}

/**
 * Process a message using OpenAI with function calling
 * 
 * @param {string} systemPrompt - System prompt with context
 * @param {Array<{role: string, content: string}>} conversationMessages - Full conversation history
 * @returns {Promise<{action: string, assistantMessage: string, changes: Array|null, updatedHtml: string|null, newPagePath: string|null}>}
 */
export async function processWithOpenAI(systemPrompt, conversationMessages) {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationMessages
    ],
    tools: AI_TOOLS.openai,
    tool_choice: 'required',
    temperature: 0.2,
    max_tokens: 16000
  });

  // Check for truncation
  const finishReason = response.choices[0]?.finish_reason;
  if (finishReason === 'length') {
    throw new Error('AI response was truncated due to length limits. Please try a simpler request.');
  }

  const message = response.choices[0]?.message;

  // Handle tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    return parseToolCall(functionName, args);
  }

  // Fallback if no tool call (shouldn't happen with tool_choice: 'required')
  return {
    action: 'respond',
    assistantMessage: message?.content || 'I could not process your request.',
    changes: null,
    updatedHtml: null,
    newPagePath: null
  };
}

/**
 * Parse a tool call into a standardized response format
 * 
 * @param {string} functionName - Name of the called function
 * @param {object} args - Function arguments
 * @returns {{action: string, assistantMessage: string, changes: Array|null, updatedHtml: string|null, newPagePath: string|null}}
 */
function parseToolCall(functionName, args) {
  switch (functionName) {
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
