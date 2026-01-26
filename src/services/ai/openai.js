import OpenAI from 'openai';

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
 * Process a message using OpenAI
 * 
 * @param {string} systemPrompt - System prompt with context
 * @param {string} userMessage - User's message
 * @returns {Promise<{assistantMessage: string, updatedHtml: string | null}>}
 */
export async function processWithOpenAI(systemPrompt, userMessage) {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 16000
  });
  
  const content = response.choices[0]?.message?.content || '';
  
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
