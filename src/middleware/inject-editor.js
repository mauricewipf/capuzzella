/**
 * Inject the Capuzzella editor UI into an HTML page
 * Creates a split-pane layout with iframe content on the left and chat sidebar on the right
 * 
 * @param {string} html - The original HTML content
 * @param {string} pagePath - The path to the current page
 * @returns {string} - Modified HTML with editor shell (iframe-based)
 */
export function injectEditor(html, pagePath) {
  // Escape HTML for use in srcdoc attribute
  const escapedHtml = html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');

  // Create a complete editor shell page with iframe
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit: ${pagePath}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .capuzzella-layout {
      display: flex;
      height: 100vh;
      width: 100vw;
    }
    
    #capuzzella-iframe {
      flex: 1;
      border: none;
      height: 100%;
      background: white;
    }
    
    #capuzzella-editor {
      width: 400px;
      height: 100vh;
      background: #1f2937;
      border-left: 1px solid #374151;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    
    #capuzzella-editor * {
      box-sizing: border-box;
    }
  </style>
  <link rel="stylesheet" href="/editor/editor.css">
</head>
<body>
  <div class="capuzzella-layout">
    <iframe id="capuzzella-iframe" srcdoc="${escapedHtml}"></iframe>
    <div id="capuzzella-editor">
      <!-- Editor UI will be initialized by editor.js -->
    </div>
  </div>
  
  <script>
    window.CAPUZZELLA_PAGE_PATH = '${pagePath}';
    window.CAPUZZELLA_INITIAL_HTML = ${JSON.stringify(html)};
  </script>
  <script src="/editor/editor-template.js" defer></script>
  <script src="/editor/editor.js" defer></script>
</body>
</html>`;
}
