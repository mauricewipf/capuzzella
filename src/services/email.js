import { Resend } from 'resend';
import { escapeHtml } from '../lib/escape-html.js';
import { logger } from '../lib/logger.js';

const log = logger.child('email');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a contact form email to the admin.
 *
 * Accepts an arbitrary set of key/value fields collected from the form.
 * If a field named "email" exists it is used as the reply-to address.
 * If a field named "name" exists it is included in the subject line.
 *
 * @param {Record<string, string>} fields
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendContactEmail(fields) {
  if (!process.env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM environment variable is not set');
  }

  const to = process.env.CONTACT_EMAIL;

  if (!to) {
    log.error('CONTACT_EMAIL is not configured');
    return { success: false, error: 'Email recipient is not configured' };
  }

  const senderName = fields.name || 'Someone';
  const senderEmail = fields.email || undefined;

  // Build an HTML table from all submitted fields
  const rows = Object.entries(fields)
    .map(([key, value]) => {
      const label = escapeHtml(formatLabel(key));
      const val = escapeHtml(String(value)).replace(/\n/g, '<br>');
      return `<tr><td style="padding:6px 12px;font-weight:bold;vertical-align:top;">${label}</td><td style="padding:6px 12px;">${val}</td></tr>`;
    })
    .join('');

  const html = `
    <h2>New Contact Form Submission</h2>
    <table style="border-collapse:collapse;">${rows}</table>
  `;

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject: `New contact form message from ${senderName}`,
      ...(senderEmail && { replyTo: senderEmail }),
      html,
    });

    if (error) {
      log.error('Resend API error', { error: error.message });
      return { success: false, error: error.message };
    }

    log.info('Contact email sent', { to, from: senderEmail, name: senderName });
    return { success: true };
  } catch (err) {
    log.error('Failed to send contact email', { error: err.message, stack: err.stack });
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Turn a field name like "first_name" or "firstName" into "First Name".
 */
function formatLabel(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase -> separate words
    .replace(/[_-]/g, ' ')                   // snake_case / kebab-case
    .replace(/\b\w/g, (c) => c.toUpperCase()); // capitalise first letters
}

