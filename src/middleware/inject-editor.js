import { escapeHtml } from '../lib/escape-html.js';

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
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit: ${escapeHtml(pagePath)}</title>
  <link href="/static/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="h-100 overflow-hidden">
  <div class="d-flex vh-100 vw-100">
    <iframe id="capuzzella-iframe" class="flex-grow-1 border-0 h-100 min-vw-0" srcdoc="${escapedHtml}"></iframe>
    <div id="capuzzella-editor" class="d-flex flex-column flex-shrink-0 h-100 bg-dark border-start border-secondary overflow-hidden" style="width: 400px;" data-page-path="${escapeHtml(pagePath)}">
      <!-- Editor UI will be initialized by editor.js -->
    </div>
  </div>
  
  <script src="/static/js/bootstrap.bundle.min.js"></script>
  <script src="/editor/editor-template.js?v=${Date.now()}" defer></script>
  <script src="/editor/editor.js?v=${Date.now()}" defer></script>
</body>
</html>`;
}
