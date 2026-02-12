import { Elysia } from 'elysia';
import { createSessionCookie, saveSession } from '../middleware/session.js';

/**
 * Design system routes plugin for Elysia
 */
export const designSystemRoutes = new Elysia({ prefix: '/design-system' })
  /**
   * GET /design-system - Render design system page (auth-protected)
   */
  .get('/', ({ session, set }) => {
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
      </head>
      <body class="bg-body-tertiary">
        <div class="container py-5" style="max-width: 900px;">
          <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3 mb-0">Design System</h1>
            <nav class="d-flex gap-3">
              <a href="/pages" class="text-secondary text-decoration-none">Pages</a>
              <a href="/settings" class="text-secondary text-decoration-none">Settings</a>
              <form method="POST" action="/auth/logout" style="display:inline"><button type="submit" class="btn btn-outline-secondary btn-sm">Sign out</button></form>
            </nav>
          </div>

          <div class="row mb-5">
            <div class="col-md-6">
              <div class="card mb-4 shadow-sm">
                <img src="https://placehold.co/600x200" class="card-img-top" alt="Card Example">
                <div class="card-body">
                  <h5 class="card-title">Bootstrap Card Example</h5>
                  <p class="card-text">
                    This is a sample card using Bootstrap classes. It demonstrates usage of <code>.card</code>, <code>.card-body</code>, and related utilities.
                  </p>
                  <a href="#" class="btn btn-primary">Go somewhere</a>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <h2>Buttons</h2>
            <button type="button" class="btn btn-secondary">Button 2</button>
            <button type="button" class="btn btn-success">Button 3</button>
            <button type="button" class="btn btn-info">Button 4</button>
            <button type="button" class="btn btn-warning">Button 5</button>
            <button type="button" class="btn btn-danger">Button 6</button>
            <button type="button" class="btn btn-link">Button 7</button>
            <button type="button" class="btn btn-outline-primary">Button 8</button>
            <button type="button" class="btn btn-primary">★ Button 9</button>
            <button type="button" class="btn btn-outline-secondary" aria-label="Icon only">⚙</button>
            <div class="btn-group mt-3">
              <button type="button" class="btn btn-secondary">Button 2</button>
              <button type="button" class="btn btn-success">Button 3</button>
              <button type="button" class="btn btn-info">Button 4</button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  });

export default designSystemRoutes;
