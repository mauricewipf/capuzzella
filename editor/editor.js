/**
 * Capuzzella Editor - Chat UI for AI-powered page editing
 */

(function () {
  'use strict';

  // Read page path from data attribute (more reliable than window variable)
  const editorContainer = document.getElementById('capuzzella-editor');
  const PAGE_PATH = editorContainer?.dataset.pagePath || window.CAPUZZELLA_PAGE_PATH || 'index.html';
  const API_BASE = '/api';
  const STORAGE_KEY = `capuzzella_chat_${PAGE_PATH}`;

  let messages = [];
  let isLoading = false;
  let conversationId = null;
  let publishStatus = {
    isPublished: false,
    hasUnpublishedChanges: false
  };

  /**
   * Save chat messages to sessionStorage
   */
  function saveMessages() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat messages:', e);
    }
  }

  /**
   * Restore chat messages from sessionStorage
   */
  function restoreMessages() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedMessages = JSON.parse(saved);
        const messagesContainer = document.getElementById('capuzzella-messages');

        // Restore each message to the UI
        savedMessages.forEach(msg => {
          const messageEl = document.createElement('div');
          messageEl.className = getMessageClasses(msg.type);
          messageEl.textContent = msg.content;
          messagesContainer.appendChild(messageEl);
          messages.push(msg);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Clear storage after restore
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to restore chat messages:', e);
    }
  }

  /**
   * Update page content by updating the iframe's srcdoc
   * This provides complete isolation and handles scripts/styles automatically
   * 
   * @param {string} newHtml - The complete new HTML document
   */
  function updatePageContent(newHtml) {
    const iframe = document.getElementById('capuzzella-iframe');
    if (!iframe) {
      console.error('Content iframe not found');
      return;
    }

    // Update iframe content - scripts and styles are handled automatically
    iframe.srcdoc = newHtml;

    // Update the page title in the editor window
    const parser = new DOMParser();
    const doc = parser.parseFromString(newHtml, 'text/html');
    const newTitle = doc.querySelector('title');
    if (newTitle) {
      document.title = `Edit: ${newTitle.textContent}`;
    }

    console.log('Page content updated in iframe');
  }

  /**
   * Refresh page content from the server without browser reload
   * Fetches the latest content and updates dynamically
   */
  async function refreshPageContent() {
    try {
      addMessage('system', 'Refreshing content...');

      const response = await fetch(`${API_BASE}/pages/${PAGE_PATH}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch page');
      }

      const data = await response.json();
      updatePageContent(data.html);

      // Also refresh publish status
      fetchPublishStatus();
    } catch (error) {
      console.error('Refresh error:', error);
      addMessage('system', 'Error: Failed to refresh content.');
    }
  }

  /**
   * Initialize the editor UI
   */
  function init() {
    const container = document.getElementById('capuzzella-editor');
    if (!container) return;


    container.innerHTML = window.CapuzzellaTemplate.getEditorHTML(PAGE_PATH);

    // Attach event listeners
    const input = document.getElementById('capuzzella-input');
    const sendBtn = document.getElementById('capuzzella-send-btn');
    const publishBtn = document.getElementById('capuzzella-publish-btn');
    const unpublishBtn = document.getElementById('capuzzella-unpublish-btn');
    const refreshBtn = document.getElementById('capuzzella-refresh-btn');
    const exitBtn = document.getElementById('capuzzella-exit-btn');

    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('input', autoResize);
    sendBtn.addEventListener('click', sendMessage);

    // Initialize textarea height on load
    autoResize();
    publishBtn.addEventListener('click', publishPage);
    unpublishBtn.addEventListener('click', unpublishPage);
    refreshBtn.addEventListener('click', refreshPageContent);
    exitBtn.addEventListener('click', exitEditMode);

    // Restore any saved chat messages from previous session
    restoreMessages();

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
        statusEl.innerHTML = '<span class="badge text-bg-danger">Status unavailable</span>';
      }
    }
  }

  /**
   * Update the UI based on publish status
   */
  function updateStatusUI() {
    const statusEl = document.getElementById('capuzzella-publish-status');
    const publishBtn = document.getElementById('capuzzella-publish-btn');
    const publishText = document.getElementById('capuzzella-publish-text');
    const unpublishBtn = document.getElementById('capuzzella-unpublish-btn');

    if (!statusEl) return;

    let statusHtml = '';

    if (publishStatus.isPublished) {
      if (publishStatus.hasUnpublishedChanges) {
        // Has unpublished changes - show Publish button
        statusHtml = '<span class="badge text-bg-warning">Unpublished changes</span>';
        if (publishText) publishText.textContent = 'Publish Changes';
        publishBtn.style.display = 'flex';
        unpublishBtn.style.display = 'none';
      } else {
        // Published and up to date - show Unpublish button
        statusHtml = '<span class="badge text-bg-success">Published</span>';
        publishBtn.style.display = 'none';
        unpublishBtn.style.display = 'flex';
      }
    } else {
      // Draft - show Publish button
      statusHtml = '<span class="badge text-bg-secondary">Draft</span>';
      if (publishText) publishText.textContent = 'Publish';
      publishBtn.style.display = 'flex';
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
    const textarea = e ? e.target : document.getElementById('capuzzella-input');
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = newHeight + 'px';

    // Toggle scrollbar when content exceeds max height
    if (textarea.scrollHeight > 200) {
      textarea.classList.remove('overflow-hidden');
      textarea.classList.add('overflow-auto');
    } else {
      textarea.classList.remove('overflow-auto');
      textarea.classList.add('overflow-hidden');
    }
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
      const requestBody = {
        message,
        pagePath: PAGE_PATH
      };
      if (conversationId) {
        requestBody.conversationId = conversationId;
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      // Store conversation ID for subsequent requests
      if (data.conversationId) {
        conversationId = data.conversationId;
      }

      if (!response.ok) {
        const errorMessage = data.error || 'Unknown server error';
        console.error('Chat API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          response: data
        });
        throw new Error(errorMessage);
      }

      // Add assistant message
      addMessage('assistant', data.message);

      // Handle different actions
      if (data.action === 'create' && data.newPagePath) {
        // New page was created - offer to navigate
        addMessage('system', `New page created: ${data.newPagePath}`);

        // Save current chat messages before navigation
        saveMessages();

        // Create a clickable link to navigate to the new page
        const messagesContainer = document.getElementById('capuzzella-messages');
        const linkEl = document.createElement('div');
        linkEl.className = getMessageClasses('system');
        linkEl.innerHTML = `<a href="/${data.newPagePath}?edit=true" class="btn btn-sm btn-outline-primary">Open new page &rarr;</a>`;
        messagesContainer.appendChild(linkEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

      } else if (data.updatedHtml) {
        // Current page was updated
        updatePageContent(data.updatedHtml);
        addMessage('system', 'Page updated!');
        // Refresh publish status since content changed
        fetchPublishStatus();
      }

    } catch (error) {
      console.error('Chat error:', error.message, error);
      addMessage('system', `Error: ${error.message || 'Failed to process your request. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Get Bootstrap-based CSS classes for a message type
   */
  function getMessageClasses(type) {
    const base = 'p-2 rounded small mb-1';
    switch (type) {
      case 'user':
        return `${base} bg-primary text-white align-self-end`;
      case 'assistant':
        return `${base} bg-secondary text-light align-self-start`;
      case 'system':
        return `${base} text-secondary text-center align-self-center`;
      default:
        return base;
    }
  }

  /**
   * Add a message to the chat UI
   */
  function addMessage(type, content) {
    const messagesContainer = document.getElementById('capuzzella-messages');

    const messageEl = document.createElement('div');
    messageEl.className = getMessageClasses(type);
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
      loaderEl.className = 'd-flex align-items-center gap-2 p-2 text-secondary small';
      loaderEl.innerHTML = `
        <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
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
    const publishText = document.getElementById('capuzzella-publish-text');
    const originalText = publishText ? publishText.textContent : 'Publish';
    publishBtn.disabled = true;
    if (publishText) publishText.textContent = 'Publishing...';

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
      if (publishText) publishText.textContent = originalText;
    }
  }

  /**
   * Unpublish the current page
   */
  async function unpublishPage() {
    const unpublishBtn = document.getElementById('capuzzella-unpublish-btn');
    const unpublishText = document.getElementById('capuzzella-unpublish-text');
    unpublishBtn.disabled = true;
    if (unpublishText) unpublishText.textContent = 'Unpublishing...';

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
      if (unpublishText) unpublishText.textContent = 'Unpublish';
    }
  }

  /**
   * Exit edit mode and navigate to the published page or fallback to index
   */
  function exitEditMode() {
    // If the page is published, go to the published version
    // Otherwise, open with ?draft=true to view the draft
    if (publishStatus.isPublished) {
      window.location.href = `/${PAGE_PATH}`;
    } else {
      window.location.href = `/${PAGE_PATH}?draft=true`;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
