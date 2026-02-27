import OpenAI from 'openai';
import { AI_TOOLS, fallbackResult, formatComponentResult, parseToolCall } from './prompts.js';
import { loadComponents } from '../components.js';

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function createRequest(model, messages) {
  return getClient().chat.completions.create({
    model,
    messages,
    tools: AI_TOOLS.openai,
    tool_choice: 'required',
    temperature: 0.2,
    max_tokens: 16000
  });
}

/**
 * Extract the first tool call name + args from an OpenAI response, or null.
 */
function extractToolCall(response) {
  if (response.choices[0]?.finish_reason === 'length') {
    throw new Error('AI response was truncated due to length limits. Please try a simpler request.');
  }

  const message = response.choices[0]?.message;
  if (!message?.tool_calls?.length) return { message, toolCall: null };

  const toolCall = message.tool_calls[0];
  return {
    message,
    toolCall: {
      id: toolCall.id,
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments)
    }
  };
}

/**
 * Process a message using OpenAI with function calling.
 *
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} conversationMessages
 */
export async function processWithOpenAI(systemPrompt, conversationMessages) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const messages = [{ role: 'system', content: systemPrompt }, ...conversationMessages];

  const response = await createRequest(model, messages);
  const { message, toolCall } = extractToolCall(response);

  if (!toolCall) return fallbackResult(message?.content);

  if (toolCall.name === 'get_components') {
    const components = await loadComponents(toolCall.args.names || []);

    messages.push(message);
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: formatComponentResult(components) });

    const followUp = await createRequest(model, messages);
    const { message: followUpMsg, toolCall: followUpCall } = extractToolCall(followUp);

    return followUpCall
      ? parseToolCall(followUpCall.name, followUpCall.args)
      : fallbackResult(followUpMsg?.content);
  }

  return parseToolCall(toolCall.name, toolCall.args);
}
