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
        <link rel="stylesheet" href="/assets/css/bootstrap.min.css">
      </head>
      <body>
        <div id="main">
          <header>

                    <div class="container my-5">
            <div class="row">
              <div class="col-12">
                <h1>Design System</h1>
              </div>
          </div>
          </div>

          </header>

          <main>

          <div class="container my-5">
            <div class="row">
              <div class="col-md-6">
                <div class="card mb-4 shadow-sm">
                  <img src="https://via.placeholder.com/600x200" class="card-img-top" alt="Card Example">
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
          </div>

          <div class="container">
            <div class="row">
              <div class="col-12">
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
                <div class="btn-group">
                  <button type="button" class="btn btn-secondary">Button 2</button>
                  <button type="button" class="btn btn-success">Button 3</button>
                  <button type="button" class="btn btn-info">Button 4</button>
                </div>
              </div>
              </div>
            </div>

            </main>
        </div>
      </body>
      </html>
    `;
  });

export default designSystemRoutes;
