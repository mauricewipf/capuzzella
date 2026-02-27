import Anthropic from '@anthropic-ai/sdk';
import { AI_TOOLS, fallbackResult, formatComponentResult, parseToolCall } from './prompts.js';
import { loadComponents } from '../components.js';

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function createRequest(model, systemPrompt, messages) {
  return getClient().messages.create({
    model,
    max_tokens: 16000,
    temperature: 0.2,
    system: systemPrompt,
    tools: AI_TOOLS.anthropic,
    tool_choice: { type: 'any' },
    messages
  });
}

/**
 * Extract the first tool use block from an Anthropic response, or null.
 */
function extractToolCall(response) {
  if (response.stop_reason === 'max_tokens') {
    throw new Error('AI response was truncated due to length limits. Please try a simpler request.');
  }

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (toolUse) {
    return { content: response.content, toolCall: { id: toolUse.id, name: toolUse.name, args: toolUse.input } };
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return { content: response.content, toolCall: null, text: textBlock?.text };
}

/**
 * Process a message using Anthropic with tool use.
 *
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} conversationMessages
 */
export async function processWithAnthropic(systemPrompt, conversationMessages) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  const messages = [...conversationMessages];

  const response = await createRequest(model, systemPrompt, messages);
  const { content, toolCall, text } = extractToolCall(response);

  if (!toolCall) return fallbackResult(text);

  if (toolCall.name === 'get_components') {
    const components = await loadComponents(toolCall.args.names || []);

    messages.push({ role: 'assistant', content });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: formatComponentResult(components) }]
    });

    const followUp = await createRequest(model, systemPrompt, messages);
    const { toolCall: followUpCall, text: followUpText } = extractToolCall(followUp);

    return followUpCall
      ? parseToolCall(followUpCall.name, followUpCall.args)
      : fallbackResult(followUpText);
  }

  return parseToolCall(toolCall.name, toolCall.args);
}
