/**
 * Inject the Capuzzella editor UI into an HTML page
 * Creates a split-pane layout with content on the left and chat sidebar on the right
 * 
 * @param {string} html - The original HTML content
 * @param {string} pagePath - The path to the current page
 * @returns {string} - Modified HTML with editor injected
 */
export function injectEditor(html, pagePath) {
  // CSS for the editor layout
  const editorStyles = `
    <style id="capuzzella-styles">
      /* Editor layout */
      body.capuzzella-edit-mode {
        margin-right: 400px !important;
      }
      
      #capuzzella-editor {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        background: #1f2937;
        border-left: 1px solid #374151;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 99999;
      }
      
      #capuzzella-editor * {
        box-sizing: border-box;
      }
    </style>
  `;
  
  // Editor container HTML
  const editorHtml = `
    <div id="capuzzella-editor">
      <!-- Editor UI will be initialized by editor.js -->
    </div>
    <script>
      window.CAPUZZELLA_PAGE_PATH = '${pagePath}';
    </script>
    <link rel="stylesheet" href="/editor/editor.css">
    <script src="/editor/editor.js" defer></script>
  `;
  
  // Script to add edit-mode class to body
  const bodyScript = `
    <script>
      document.body.classList.add('capuzzella-edit-mode');
    </script>
  `;
  
  // Inject styles into <head>
  let modifiedHtml = html;
  
  if (modifiedHtml.includes('</head>')) {
    modifiedHtml = modifiedHtml.replace('</head>', `${editorStyles}</head>`);
  } else {
    // No head tag, prepend styles
    modifiedHtml = editorStyles + modifiedHtml;
  }
  
  // Inject editor and body script before </body>
  if (modifiedHtml.includes('</body>')) {
    modifiedHtml = modifiedHtml.replace('</body>', `${bodyScript}${editorHtml}</body>`);
  } else {
    // No body tag, append at end
    modifiedHtml = modifiedHtml + bodyScript + editorHtml;
  }
  
  return modifiedHtml;
}
