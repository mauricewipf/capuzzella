import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger.js';
import { processWithAnthropic } from './anthropic.js';
import { processWithOpenAI } from './openai.js';
import { buildSystemPrompt } from './prompts.js';

const log = logger.child('ai');

/**
 * @typedef {Object} ChatResult
 * @property {string} action - The action type: 'edit', 'create', or 'respond'
 * @property {string} assistantMessage - Message from the AI
 * @property {string|null} updatedHtml - Updated or new HTML content
 * @property {string|null} newPagePath - Path for new page (only for 'create' action)
 * @property {string} conversationId - The conversation ID for maintaining history
 */

// ─── Conversation History Store ──────────────────────────────────────────────

/** Maximum number of message pairs (user + assistant) to keep per conversation */
const MAX_HISTORY_PAIRS = 10;

/** Conversations expire after 30 minutes of inactivity */
const CONVERSATION_TTL_MS = 30 * 60 * 1000;

/**
 * In-memory conversation store.
 * Key: conversationId, Value: { messages: Array<{role, content}>, lastAccess: number }
 */
const conversations = new Map();

/**
 * Clean up expired conversations
 */
function cleanupExpiredConversations() {
  const now = Date.now();
  for (const [id, convo] of conversations) {
    if (now - convo.lastAccess > CONVERSATION_TTL_MS) {
      conversations.delete(id);
    }
  }
}

/**
 * Get or create a conversation
 * 
 * @param {string|null} conversationId - Existing conversation ID, or null to create new
 * @returns {{ id: string, messages: Array<{role: string, content: string}> }}
 */
function getConversation(conversationId) {
  // Periodically clean up
  if (Math.random() < 0.1) {
    cleanupExpiredConversations();
  }

  if (conversationId && conversations.has(conversationId)) {
    const convo = conversations.get(conversationId);
    convo.lastAccess = Date.now();
    return { id: conversationId, messages: convo.messages };
  }

  // Create new conversation
  const id = conversationId || randomUUID();
  const convo = { messages: [], lastAccess: Date.now() };
  conversations.set(id, convo);
  return { id, messages: convo.messages };
}

/**
 * Append messages to a conversation and trim to max history
 * 
 * @param {string} conversationId
 * @param {Array<{role: string, content: string}>} newMessages
 */
function appendToConversation(conversationId, newMessages) {
  const convo = conversations.get(conversationId);
  if (!convo) return;

  convo.messages.push(...newMessages);
  convo.lastAccess = Date.now();

  // Trim to keep only the last N message pairs (user + assistant = 2 messages per pair)
  const maxMessages = MAX_HISTORY_PAIRS * 2;
  if (convo.messages.length > maxMessages) {
    convo.messages = convo.messages.slice(-maxMessages);
  }
}

// ─── Diff Application ────────────────────────────────────────────────────────

/**
 * Apply search-and-replace changes to HTML content.
 * 
 * For each change, tries an exact match first. If that fails, retries with
 * flexible whitespace matching (allowing different amounts of whitespace) as
 * a fallback.
 * 
 * @param {string} html - The current HTML content
 * @param {Array<{search: string, replace: string}>} changes - Ordered list of changes
 * @returns {{ html: string, appliedCount: number, failedSearches: string[] }}
 */
export function applyDiffs(html, changes) {
  let result = html;
  let appliedCount = 0;
  const failedSearches = [];

  for (const change of changes) {
    const { search, replace } = change;

    if (!search && search !== '') {
      log.warn('Skipping change with missing search field');
      continue;
    }

    // Try exact match first
    if (result.includes(search)) {
      result = result.replace(search, replace);
      appliedCount++;
      continue;
    }

    // Fallback: try matching with flexible whitespace via regex
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flexPattern = escaped.replace(/\\s|\s+/g, '\\s+');

    try {
      const flexRegex = new RegExp(flexPattern);
      const match = result.match(flexRegex);

      if (match) {
        result = result.replace(flexRegex, replace);
        appliedCount++;
        log.debug('Applied change with whitespace-tolerant matching', {
          searchPreview: search.substring(0, 80)
        });
        continue;
      }
    } catch {
      // Regex construction failed, fall through
    }

    // If we still can't find it, log and continue
    log.warn('Could not find search string in HTML', {
      searchPreview: search.substring(0, 120)
    });
    failedSearches.push(search.substring(0, 120));
  }

  return { html: result, appliedCount, failedSearches };
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Process a chat message and return AI response with potential page changes
 * 
 * @param {string} message - User's chat message
 * @param {string|null} currentHtml - Current HTML of the page (null if creating new page without context)
 * @param {string} pagePath - Path to the current page
 * @param {string|null} conversationId - Existing conversation ID for history, or null
 * @returns {Promise<ChatResult>}
 */
export async function processChat(message, currentHtml, pagePath, conversationId = null) {
  const provider = process.env.AI_PROVIDER || 'openai';

  // Build the system prompt
  const systemPrompt = buildSystemPrompt();

  // Get or create conversation
  const conversation = getConversation(conversationId);

  // Build the new user message with current HTML context
  const userMessageContent = buildUserMessage(message, currentHtml, pagePath);

  // Prepare messages: conversation history + new user message
  const conversationMessages = [
    ...conversation.messages,
    { role: 'user', content: userMessageContent }
  ];

  let result;

  if (provider === 'anthropic') {
    result = await processWithAnthropic(systemPrompt, conversationMessages);
  } else {
    result = await processWithOpenAI(systemPrompt, conversationMessages);
  }

  // If it was an edit action, apply diffs to produce the final HTML
  if (result.action === 'edit' && result.changes && currentHtml) {
    const { html: updatedHtml, appliedCount, failedSearches } = applyDiffs(currentHtml, result.changes);

    if (appliedCount === 0) {
      // None of the changes could be applied
      log.warn('No changes could be applied', { failedSearches });
      return {
        action: 'respond',
        assistantMessage: 'I was unable to apply the requested changes — the HTML content may have changed. Please try again.',
        updatedHtml: null,
        newPagePath: null,
        conversationId: conversation.id
      };
    }

    if (failedSearches.length > 0) {
      result.assistantMessage += ` (Note: ${failedSearches.length} of ${result.changes.length} changes could not be matched and were skipped.)`;
    }

    result.updatedHtml = updatedHtml;
  }

  // Store the conversation turn (user message + summarized assistant response)
  appendToConversation(conversation.id, [
    { role: 'user', content: userMessageContent },
    { role: 'assistant', content: result.assistantMessage }
  ]);

  // Attach conversation ID to result
  result.conversationId = conversation.id;

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
    ? `Current HTML:\n\`\`\`html\n${currentHtml}\n\`\`\``
    : 'No current page content (this may be a request to create a new page).';

  return `
Current page: ${pagePath}

${htmlContext}

User request: ${message}

Use the appropriate tool to respond:
- Use edit_page if modifying the current page (provide search/replace changes)
- Use create_page if creating a new page (provide a path and complete HTML)
- Use respond if no page changes are needed
`.trim();
}
