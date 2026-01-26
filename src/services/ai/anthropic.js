import Anthropic from '@anthropic-ai/sdk';

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
 * Process a message using Anthropic
 * 
 * @param {string} systemPrompt - System prompt with context
 * @param {string} userMessage - User's message
 * @returns {Promise<{assistantMessage: string, updatedHtml: string | null}>}
 */
export async function processWithAnthropic(systemPrompt, userMessage) {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  });
  
  const content = response.content[0]?.type === 'text' 
    ? response.content[0].text 
    : '';
  
  return parseAIResponse(content);
}

/**
 * Parse the AI response to extract explanation and HTML
 * 
 * @param {string} content - Raw AI response
 * @returns {{assistantMessage: string, updatedHtml: string | null}}
 */
function parseAIResponse(content) {
  // Extract explanation
  const explanationMatch = content.match(/EXPLANATION:\s*([\s\S]*?)(?=HTML:|$)/i);
  const explanation = explanationMatch?.[1]?.trim() || content;
  
  // Extract HTML
  const htmlMatch = content.match(/```html\s*([\s\S]*?)```/);
  const updatedHtml = htmlMatch?.[1]?.trim() || null;
  
  return {
    assistantMessage: explanation,
    updatedHtml
  };
}
