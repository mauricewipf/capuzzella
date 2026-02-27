import { Elysia } from 'elysia';
import { getCsrfToken } from '../middleware/csrf.js';
import { createSessionCookie, saveSession } from '../middleware/session.js';
import { loadAllComponents } from '../services/components.js';

/**
 * Design system routes plugin for Elysia
 */
export const designSystemRoutes = new Elysia({ prefix: '/design-system' })
  /**
   * GET /design-system - Render design system page (auth-protected)
   */
  .get('/', async ({ session, set }) => {
    if (!session.userId) {
      session.returnTo = '/design-system';
      saveSession(session._sessionId, session._getData());
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/auth/login',
          'Set-Cookie': createSessionCookie(session._sessionId)
        }
      });
    }

    const csrfToken = getCsrfToken(session);
    const components = await loadAllComponents();

    const sidebarLinks = components
      .map(c => `<a href="#${c.name}" class="nav-link text-secondary small border-start border-2 border-transparent rounded-0 px-3 py-2">${capitalize(c.name)}</a>`)
      .join('\n');

    const componentHtml = components
      .map(c => c.html.replace('<section', `<section id="${c.name}"`))
      .join('\n');

    set.headers['Content-Type'] = 'text/html';
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Design System - Capuzzella</title>
        <link rel="stylesheet" href="/assets/css/bootstrap.min.css?source=draft">
        <link rel="stylesheet" href="/assets/css/theme.css?source=draft">
        <script src="/assets/js/bootstrap.bundle.min.js?source=draft" defer></script>
        <style>
          #ds-nav .nav-link.active { color: var(--bs-primary) !important; border-left-color: var(--bs-primary) !important; font-weight: 500; }
        </style>
      </head>
      <body class="bg-body-tertiary" data-bs-spy="scroll" data-bs-target="#ds-nav">
        <div class="container">
          <div class="row py-5">
            <div class="col-12">
              <div class="d-flex justify-content-between align-items-center">
                <h1 class="h3 mb-0">Design System</h1>
                <nav class="d-flex gap-3">
                  <a href="/pages" class="text-secondary text-decoration-none">Pages</a>
                  <a href="/settings" class="text-secondary text-decoration-none">Settings</a>
                  <form method="POST" action="/auth/logout" style="display:inline">
                    <input type="hidden" name="_csrf" value="${csrfToken}">
                    <button type="submit" class="btn btn-outline-secondary btn-sm">Sign out</button>
                  </form>
                </nav>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col-3">
              <nav id="ds-nav" class="nav flex-column sticky-top overflow-auto" style="top: 1.5rem; max-height: calc(100vh - 3rem);">
                ${sidebarLinks}
              </nav>
            </div>
            <div class="col-9">
              ${componentHtml}
            </div>
          </div>
        </div>

        <script>
          document.addEventListener('DOMContentLoaded', () => {
            bootstrap.ScrollSpy.getOrCreateInstance(document.body, {
              target: '#ds-nav',
              offset: 80,
              smoothScroll: true
            });

            document.querySelectorAll('#ds-nav a').forEach(link => {
              link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  history.replaceState(null, '', link.getAttribute('href'));
                }
              });
            });
          });
        </script>
      </body>
      </html>
    `;
  });

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default designSystemRoutes;
