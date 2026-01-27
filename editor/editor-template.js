/**
 * Capuzzella Editor - HTML Template
 */

window.CapuzzellaTemplate = {
  /**
   * Generate the editor HTML template
   * @param {string} PAGE_PATH - The current page path being edited
   * @returns {string} HTML template string
   */
  getEditorHTML: function (PAGE_PATH) {
    return `
      <div class="capuzzella-header">
        <div class="capuzzella-header-actions">
          <div class="capuzzella-dropdown">
            <button id="capuzzella-options-btn" class="capuzzella-options-btn">
              Options
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                <path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" fill-rule="evenodd" />
              </svg>
            </button>

            <div id="capuzzella-dropdown-menu" class="capuzzella-dropdown-menu">
              <div class="capuzzella-menu-section">
                <button id="capuzzella-refresh-btn" class="capuzzella-menu-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                    <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-11.23-3.424a.75.75 0 0 1 .449-.962 5.502 5.502 0 0 1 9.201-2.466l.312.311H11.61a.75.75 0 0 0 0 1.5h4.242a.75.75 0 0 0 .75-.75V1.39a.75.75 0 0 0-1.5 0v2.43l-.31-.31A7 7 0 0 0 3.08 6.648a.75.75 0 0 0 .962.449Z" clip-rule="evenodd" />
                  </svg>
                  Refresh Content
                </button>
                <button id="capuzzella-publish-btn" class="capuzzella-menu-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd" />
                  </svg>
                  <span id="capuzzella-publish-text">Publish</span>
                </button>
                <button id="capuzzella-unpublish-btn" style="display: none;" class="capuzzella-menu-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
                  </svg>
                  <span id="capuzzella-unpublish-text">Unpublish</span>
                </button>
              </div>
              <div class="capuzzella-menu-section">
                <a href="/pages" class="capuzzella-menu-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                    <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h6.5A2.25 2.25 0 0 1 13 4.25V5.5H9.25A3.75 3.75 0 0 0 5.5 9.25V13H4.25A2.25 2.25 0 0 1 2 10.75v-6.5Z" />
                    <path d="M9.25 7A2.25 2.25 0 0 0 7 9.25v6.5A2.25 2.25 0 0 0 9.25 18h6.5A2.25 2.25 0 0 0 18 15.75v-6.5A2.25 2.25 0 0 0 15.75 7h-6.5Z" />
                  </svg>
                  All Pages
                </a>
                <a href="/settings" class="capuzzella-menu-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                    <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                  </svg>
                  Settings
                </a>
                <button id="capuzzella-exit-btn" class="capuzzella-menu-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="20" height="20">
                    <path fill-rule="evenodd" d="M17 4.25A2.25 2.25 0 0 0 14.75 2h-5.5A2.25 2.25 0 0 0 7 4.25v2a.75.75 0 0 0 1.5 0v-2a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 .75.75v11.5a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-2a.75.75 0 0 0-1.5 0v2A2.25 2.25 0 0 0 9.25 18h5.5A2.25 2.25 0 0 0 17 15.75V4.25Z" clip-rule="evenodd" />
                    <path fill-rule="evenodd" d="M14 10a.75.75 0 0 0-.75-.75H3.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 14 10Z" clip-rule="evenodd" />
                  </svg>
                  Exit Edit Mode
                </button>
              </div>
            </div>
          </div>
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
        <textarea
          class="capuzzella-input"
          id="capuzzella-input"
          placeholder="e.g., Change the heading to 'Welcome to My Site'"
          rows="1"
        ></textarea>
        <div class="capuzzella-input-footer">
          <button class="capuzzella-send-btn" id="capuzzella-send-btn">Build page</button>
        </div>
      </div>
    `;
  }
};
