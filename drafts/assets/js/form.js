/**
 * Generic contact form handler.
 *
 * Usage: add `data-contact` to any <form> element. The script will:
 *   1. Find every <input>, <textarea>, and <select> with a `name` attribute inside the form.
 *   2. Collect their values into a key/value object.
 *   3. POST the object as JSON to /api/contact.
 *   4. Show a Bootstrap alert above the form with success or error feedback.
 *
 * Include the script once before </body>. It initialises all
 * `form[data-contact]` elements on the page and listens for
 * DOMContentLoaded as a fallback.
 */
(function () {
  'use strict';

  async function fetchCsrfToken() {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (!res.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    const data = await res.json();
    if (!data?.csrfToken) {
      throw new Error('Missing CSRF token');
    }
    return data.csrfToken;
  }

  function initContactForm(form) {
    if (form.dataset.formInit) return;
    form.dataset.formInit = '1';

    // Create the alert element once and prepend it to the form
    const alertEl = document.createElement('div');
    alertEl.className = 'd-none';
    alertEl.setAttribute('role', 'alert');
    form.prepend(alertEl);

    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Collect all named fields
      const fields = {};
      const elements = form.querySelectorAll('input[name], textarea[name], select[name]');
      let hasEmpty = false;

      elements.forEach(function (el) {
        const value = el.value.trim();
        fields[el.name] = value;
        if (el.hasAttribute('required') && !value) {
          hasEmpty = true;
        }
      });

      if (hasEmpty) {
        showAlert('Please fill in all required fields.', 'warning');
        return;
      }

      if (Object.keys(fields).length === 0) {
        showAlert('The form has no fields to submit.', 'warning');
        return;
      }

      // Disable button while sending
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending\u2026';
      }
      alertEl.className = 'd-none';

      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch('/api/form', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify(fields),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          showAlert('Message sent successfully! We\u2019ll get back to you soon.', 'success');
          form.reset();
        } else {
          showAlert(data.error || 'Something went wrong. Please try again.', 'danger');
        }
      } catch (_err) {
        showAlert('Network error. Please check your connection and try again.', 'danger');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });

    function showAlert(msg, type) {
      alertEl.className = 'alert alert-' + type;
      alertEl.textContent = msg;
    }
  }

  // Initialise immediately for forms already in the DOM
  document.querySelectorAll('form[data-contact]').forEach(initContactForm);

  // Fallback: also initialise on DOMContentLoaded for any forms parsed later
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('form[data-contact]').forEach(function (form) {
        if (!form.dataset.formInit) initContactForm(form);
      });
    });
  }
})();
