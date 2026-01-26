/**
 * Capuzzella Editor - Chat UI for AI-powered page editing
 */

(function () {
  'use strict';

  const PAGE_PATH = window.CAPUZZELLA_PAGE_PATH || 'index.html';
  const API_BASE = '/api';

  let messages = [];
  let isLoading = false;
  let publishStatus = {
    isPublished: false,
    hasUnpublishedChanges: false
  };

  /**
   * Initialize the editor UI
   */
  function init() {
    const container = document.getElementById('capuzzella-editor');
    if (!container) return;

    container.innerHTML = `
      <div class="capuzzella-header">
        <div class="capuzzella-header-actions">
          <a href="/settings" class="capuzzella-btn capuzzella-btn-secondary">Settings</a>
          <button class="capuzzella-btn capuzzella-btn-secondary" onclick="window.location.href='/${PAGE_PATH}'">
            Exit Edit
          </button>
          <button class="capuzzella-btn capuzzella-btn-danger" id="capuzzella-unpublish-btn" style="display: none;">
            Unpublish
          </button>
          <button class="capuzzella-btn capuzzella-btn-primary" id="capuzzella-publish-btn">
            Publish
          </button>
        </div>
      </div>
      
      <div class="capuzzella-page-info">
        <div class="capuzzella-page-details">
          <span>Editing:</span>
          <span class="capuzzella-page-path">${PAGE_PATH}</span>
        </div>
        <div class="capuzzella-publish-status" id="capuzzella-publish-status">
          <span class="capuzzella-status-badge capuzzella-status-loading">Loading...</span>
        </div>
      </div>
      
      <div class="capuzzella-messages" id="capuzzella-messages">
        <div class="capuzzella-message capuzzella-message-system">
          Describe what changes you'd like to make to this page.
        </div>
      </div>
      
      <div class="capuzzella-input-area">
        <div class="capuzzella-input-wrapper">
          <textarea
            class="capuzzella-input"
            id="capuzzella-input"
            placeholder="e.g., Change the heading to 'Welcome to My Site'"
            rows="1"
          ></textarea>
          <button class="capuzzella-send-btn" id="capuzzella-send-btn">
            Send
          </button>
        </div>
      </div>
    `;

    // Attach event listeners
    const input = document.getElementById('capuzzella-input');
    const sendBtn = document.getElementById('capuzzella-send-btn');
    const publishBtn = document.getElementById('capuzzella-publish-btn');
    const unpublishBtn = document.getElementById('capuzzella-unpublish-btn');

    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('input', autoResize);
    sendBtn.addEventListener('click', sendMessage);
    publishBtn.addEventListener('click', publishPage);
    unpublishBtn.addEventListener('click', unpublishPage);

    // Fetch initial publish status
    fetchPublishStatus();
  }

  /**
   * Fetch and display the current publish status
   */
  async function fetchPublishStatus() {
    try {
      const response = await fetch(`/publish/status/${PAGE_PATH}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      publishStatus = {
        isPublished: data.isPublished,
        hasUnpublishedChanges: data.hasUnpublishedChanges
      };

      updateStatusUI();
    } catch (error) {
      console.error('Status fetch error:', error);
      // Show error state in status
      const statusEl = document.getElementById('capuzzella-publish-status');
      if (statusEl) {
        statusEl.innerHTML = '<span class="capuzzella-status-badge capuzzella-status-error">Status unavailable</span>';
      }
    }
  }

  /**
   * Update the UI based on publish status
   */
  function updateStatusUI() {
    const statusEl = document.getElementById('capuzzella-publish-status');
    const publishBtn = document.getElementById('capuzzella-publish-btn');
    const unpublishBtn = document.getElementById('capuzzella-unpublish-btn');

    if (!statusEl) return;

    let statusHtml = '';

    if (publishStatus.isPublished) {
      if (publishStatus.hasUnpublishedChanges) {
        // Has unpublished changes - show Publish button
        statusHtml = `
          <span class="capuzzella-status-badge capuzzella-status-modified">
            <span class="capuzzella-status-dot"></span>
            Unpublished changes
          </span>
        `;
        publishBtn.textContent = 'Publish Changes';
        publishBtn.style.display = 'block';
        unpublishBtn.style.display = 'none';
      } else {
        // Published and up to date - show Unpublish button
        statusHtml = `
          <span class="capuzzella-status-badge capuzzella-status-published">
            <span class="capuzzella-status-dot"></span>
            Published
          </span>
        `;
        publishBtn.style.display = 'none';
        unpublishBtn.style.display = 'block';
      }
    } else {
      // Draft - show Publish button
      statusHtml = `
        <span class="capuzzella-status-badge capuzzella-status-draft">
          <span class="capuzzella-status-dot"></span>
          Draft
        </span>
      `;
      publishBtn.textContent = 'Publish';
      publishBtn.style.display = 'block';
      unpublishBtn.style.display = 'none';
    }

    statusEl.innerHTML = statusHtml;
  }

  /**
   * Handle keyboard input
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /**
   * Auto-resize textarea based on content
   */
  function autoResize(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  /**
   * Send a chat message to the AI
   */
  async function sendMessage() {
    const input = document.getElementById('capuzzella-input');
    const message = input.value.trim();

    if (!message || isLoading) return;

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Add user message to UI
    addMessage('user', message);

    // Show loading indicator
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          pagePath: PAGE_PATH
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process message');
      }

      const data = await response.json();

      // Add assistant message
      addMessage('assistant', data.message);

      // Reload the page if HTML was updated
      if (data.updatedHtml) {
        addMessage('system', 'Page updated. Reloading...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

    } catch (error) {
      console.error('Chat error:', error);
      addMessage('system', 'Error: Failed to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Add a message to the chat UI
   */
  function addMessage(type, content) {
    const messagesContainer = document.getElementById('capuzzella-messages');

    const messageEl = document.createElement('div');
    messageEl.className = `capuzzella-message capuzzella-message-${type}`;
    messageEl.textContent = content;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    messages.push({ type, content });
  }

  /**
   * Set loading state
   */
  function setLoading(loading) {
    isLoading = loading;

    const sendBtn = document.getElementById('capuzzella-send-btn');
    const messagesContainer = document.getElementById('capuzzella-messages');

    sendBtn.disabled = loading;

    // Remove existing loading indicator
    const existingLoader = document.getElementById('capuzzella-loader');
    if (existingLoader) {
      existingLoader.remove();
    }

    if (loading) {
      const loaderEl = document.createElement('div');
      loaderEl.id = 'capuzzella-loader';
      loaderEl.className = 'capuzzella-loading';
      loaderEl.innerHTML = `
        <div class="capuzzella-loading-dots">
          <div class="capuzzella-loading-dot"></div>
          <div class="capuzzella-loading-dot"></div>
          <div class="capuzzella-loading-dot"></div>
        </div>
        <span>Thinking...</span>
      `;
      messagesContainer.appendChild(loaderEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Publish the current page
   */
  async function publishPage() {
    const publishBtn = document.getElementById('capuzzella-publish-btn');
    const originalText = publishBtn.textContent;
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';

    try {
      const response = await fetch(`/publish/${PAGE_PATH}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to publish');
      }

      addMessage('system', 'Page published successfully!');

      // Refresh the publish status
      await fetchPublishStatus();

    } catch (error) {
      console.error('Publish error:', error);
      addMessage('system', 'Error: Failed to publish page.');
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = originalText;
    }
  }

  /**
   * Unpublish the current page
   */
  async function unpublishPage() {
    const unpublishBtn = document.getElementById('capuzzella-unpublish-btn');
    unpublishBtn.disabled = true;
    unpublishBtn.textContent = 'Unpublishing...';

    try {
      const response = await fetch(`/publish/${PAGE_PATH}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to unpublish');
      }

      addMessage('system', 'Page unpublished. It is now only visible in edit mode.');

      // Refresh the publish status
      await fetchPublishStatus();

    } catch (error) {
      console.error('Unpublish error:', error);
      addMessage('system', 'Error: Failed to unpublish page.');
    } finally {
      unpublishBtn.disabled = false;
      unpublishBtn.textContent = 'Unpublish';
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
