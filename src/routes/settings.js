import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { updatePassword } from '../services/auth.js';

const router = express.Router();

// All settings routes require authentication
router.use(requireAuth);

/**
 * GET /settings - Render settings page
 */
router.get('/', (req, res) => {
  const message = req.query.message;
  const error = req.query.error;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Settings - Capuzzella</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen">
      <div class="max-w-2xl mx-auto py-12 px-4">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900">Settings</h1>
          <a href="/" class="text-indigo-600 hover:text-indigo-800">← Back to site</a>
        </div>

        ${message ? `
          <div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            ${escapeHtml(message)}
          </div>
        ` : ''}

        ${error ? `
          <div class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            ${escapeHtml(error)}
          </div>
        ` : ''}

        <!-- User Info -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
          <div class="text-gray-600">
            <p><span class="font-medium">Username:</span> ${escapeHtml(req.session.username)}</p>
          </div>
        </div>

        <!-- Change Password -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
          <form method="POST" action="/settings/password" class="space-y-4">
            <div>
              <label for="currentPassword" class="block text-sm font-medium text-gray-700">Current Password</label>
              <input type="password" name="currentPassword" id="currentPassword" required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            </div>
            <div>
              <label for="newPassword" class="block text-sm font-medium text-gray-700">New Password</label>
              <input type="password" name="newPassword" id="newPassword" required minlength="6"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
              <p class="mt-1 text-sm text-gray-500">Minimum 6 characters</p>
            </div>
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input type="password" name="confirmPassword" id="confirmPassword" required minlength="6"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            </div>
            <button type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Update Password
            </button>
          </form>
        </div>

        <!-- Logout -->
        <div class="mt-6 text-center">
          <a href="/auth/logout" class="text-red-600 hover:text-red-800">Sign out</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * POST /settings/password - Handle password change
 */
router.post('/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.redirect('/settings?error=' + encodeURIComponent('All fields are required'));
  }

  if (newPassword !== confirmPassword) {
    return res.redirect('/settings?error=' + encodeURIComponent('New passwords do not match'));
  }

  try {
    const result = await updatePassword(req.session.userId, currentPassword, newPassword);

    if (result.success) {
      // Clear the mustChangePassword flag from session
      req.session.mustChangePassword = false;
      return res.redirect('/settings?message=' + encodeURIComponent('Password updated successfully'));
    } else {
      return res.redirect('/settings?error=' + encodeURIComponent(result.error));
    }
  } catch (error) {
    console.error('Password update error:', error);
    return res.redirect('/settings?error=' + encodeURIComponent('Failed to update password'));
  }
});

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;
