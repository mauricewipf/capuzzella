import Anthropic from '@anthropic-ai/sdk';
import { AI_TOOLS } from './prompts.js';

let anthropicClient = null;

/**
 * Get or create Anthropic client
 * @returns {Anthropic}
 */
function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropicClient;
}

/**
 * Process a message using Anthropic with tool use
 * 
 * @param {string} systemPrompt - System prompt with context
 * @param {Array<{role: string, content: string}>} conversationMessages - Full conversation history
 * @returns {Promise<{action: string, assistantMessage: string, changes: Array|null, updatedHtml: string|null, newPagePath: string|null}>}
 */
export async function processWithAnthropic(systemPrompt, conversationMessages) {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    temperature: 0.2,
    system: systemPrompt,
    tools: AI_TOOLS.anthropic,
    tool_choice: { type: 'any' },
    messages: conversationMessages
  });

  // Check for truncation
  if (response.stop_reason === 'max_tokens') {
    throw new Error('AI response was truncated due to length limits. Please try a simpler request.');
  }

  // Find tool use in response
  const toolUse = response.content.find(block => block.type === 'tool_use');

  if (toolUse) {
    return parseToolCall(toolUse.name, toolUse.input);
  }

  // Fallback to text response (shouldn't happen with tool_choice: any)
  const textBlock = response.content.find(block => block.type === 'text');
  return {
    action: 'respond',
    assistantMessage: textBlock?.text || 'I could not process your request.',
    changes: null,
    updatedHtml: null,
    newPagePath: null
  };
}

/**
 * Parse a tool call into a standardized response format
 * 
 * @param {string} toolName - Name of the called tool
 * @param {object} input - Tool input
 * @returns {{action: string, assistantMessage: string, changes: Array|null, updatedHtml: string|null, newPagePath: string|null}}
 */
function parseToolCall(toolName, input) {
  switch (toolName) {
    case 'edit_page':
      return {
        action: 'edit',
        assistantMessage: input.explanation,
        changes: input.changes,
        updatedHtml: null,
        newPagePath: null
      };

    case 'create_page':
      return {
        action: 'create',
        assistantMessage: input.explanation,
        changes: null,
        updatedHtml: input.html,
        newPagePath: input.path
      };

    case 'respond':
    default:
      return {
        action: 'respond',
        assistantMessage: input.message || input.explanation || '',
        changes: null,
        updatedHtml: null,
        newPagePath: null
      };
  }
}
