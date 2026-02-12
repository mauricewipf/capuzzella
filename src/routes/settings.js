import { Elysia } from 'elysia';
import { escapeHtml } from '../lib/escape-html.js';
import { logger } from '../lib/logger.js';
import { createSessionCookie, saveSession } from '../middleware/session.js';
import { updatePassword } from '../services/auth.js';

const log = logger.child('settings');

/**
 * Settings routes plugin for Elysia
 */
export const settingsRoutes = new Elysia({ prefix: '/settings' })
  /**
   * GET /settings - Render settings page
   */
  .get('/', ({ query, session, set }) => {
    // Auth check
    if (!session.userId) {
      session.returnTo = '/settings';
      // Manually save session and return redirect with cookie
      saveSession(session._sessionId, session._getData());
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/auth/login',
          'Set-Cookie': createSessionCookie(session._sessionId)
        }
      });
    }

    const message = query.message;
    const error = query.error;

    // AI provider configuration status
    const aiProvider = process.env.AI_PROVIDER || 'openai';
    const providers = [
      {
        name: 'OpenAI',
        id: 'openai',
        configured: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'),
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        active: aiProvider === 'openai',
      },
      {
        name: 'Anthropic',
        id: 'anthropic',
        configured: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-'),
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        active: aiProvider === 'anthropic',
      },
    ];

    set.headers['Content-Type'] = 'text/html';
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Settings - Capuzzella</title>
        <link rel="stylesheet" href="/static/css/bootstrap.min.css">
        <script src="/static/js/bootstrap.bundle.min.js"></script>
      </head>
      <body class="bg-body-tertiary">
        <div class="container py-5" style="max-width: 900px;">
          <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3 mb-0">Settings</h1>
            <nav class="d-flex gap-3">
              <a href="/pages" class="text-secondary text-decoration-none">Pages</a>
              <a href="/design-system" class="text-secondary text-decoration-none">Design System</a>
                <form method="POST" action="/auth/logout" style="display:inline"><button type="submit" class="btn btn-outline-secondary btn-sm">Sign out</button></form>
            </nav>
          </div>

          ${message ? `
            <div class="alert alert-success" role="alert">
              ${escapeHtml(message)}
            </div>
          ` : ''}

          ${error ? `
            <div class="alert alert-danger" role="alert">
              ${escapeHtml(error)}
            </div>
          ` : ''}

          <div class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title mb-3">Account Information</h2>
              <p class="text-body-secondary mb-0"><span class="fw-medium">Username:</span> ${escapeHtml(session.username)}</p>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title mb-3">AI Providers</h2>
              ${providers.map((p, i) => `
                <div class="d-flex justify-content-between align-items-center py-2${i < providers.length - 1 ? ' border-bottom' : ''}">
                  <div>
                    <span class="fw-medium">${escapeHtml(p.name)}</span>
                    ${p.active ? '<span class="badge bg-primary ms-2">Active</span>' : ''}
                  </div>
                  <div>
                    <span class="text-body-secondary me-3">${escapeHtml(p.model)}</span>
                    ${p.configured
        ? '<span class="badge bg-success">Configured</span>'
        : '<span class="badge bg-danger">No API key configured</span>'}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <h2 class="h5 card-title mb-3">Change Password</h2>
              <form method="POST" action="/settings/password">
                <div class="mb-3">
                  <label for="currentPassword" class="form-label">Current Password</label>
                  <input type="password" name="currentPassword" id="currentPassword" required class="form-control">
                </div>
                <div class="mb-3">
                  <label for="newPassword" class="form-label">New Password</label>
                  <input type="password" name="newPassword" id="newPassword" required minlength="6" class="form-control">
                  <div class="form-text">Minimum 6 characters</div>
                </div>
                <div class="mb-3">
                  <label for="confirmPassword" class="form-label">Confirm New Password</label>
                  <input type="password" name="confirmPassword" id="confirmPassword" required minlength="6" class="form-control">
                </div>
                <button type="submit" class="btn btn-primary w-100">Update Password</button>
              </form>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  })

  /**
   * POST /settings/password - Handle password change
   */
  .post('/password', async ({ body, session }) => {
    // Auth check
    if (!session.userId) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/auth/login' }
      });
    }

    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/settings?error=' + encodeURIComponent('All fields are required') }
      });
    }

    if (newPassword !== confirmPassword) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/settings?error=' + encodeURIComponent('New passwords do not match') }
      });
    }

    try {
      const result = await updatePassword(session.userId, currentPassword, newPassword);

      if (result.success) {
        session.mustChangePassword = false;
        // Save session with updated flag and redirect
        saveSession(session._sessionId, session._getData());
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/settings?message=' + encodeURIComponent('Password updated successfully'),
            'Set-Cookie': createSessionCookie(session._sessionId)
          }
        });
      } else {
        return new Response(null, {
          status: 302,
          headers: { 'Location': '/settings?error=' + encodeURIComponent(result.error) }
        });
      }
    } catch (error) {
      log.error('Password update error', { error: error.message });
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/settings?error=' + encodeURIComponent('Failed to update password') }
      });
    }
  });

export default settingsRoutes;
