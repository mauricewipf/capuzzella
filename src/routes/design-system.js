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
        <link rel="stylesheet" href="/assets/css/main.css">
      </head>
      <body>
        <div id="main" class="pad">
          <header class="margin-block-end-double">
            <h1 class="txt-x-large txt-align-start margin-none">Design System</h1>
          </header>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Buttons</h2>
              <div class="flex flex-wrap gap">
                <button type="button" class="btn">Default</button>
                <button type="button" class="btn" disabled>Disabled</button>
              </div>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn, .btn disabled</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Plain</h2>
              <button type="button" class="btn btn--plain">Plain button</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--plain</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Link style</h2>
              <button type="button" class="btn btn--link">Link button</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--link</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Circle</h2>
              <button type="button" class="btn btn--circle" aria-label="Add">+</button>
              <button type="button" class="btn btn--circle" aria-label="Close">×</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--circle (with aria-label)</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Circle on mobile</h2>
              <button type="button" class="btn btn--circle-mobile"><span class="icon icon--add icon--mobile-only" aria-hidden="true"></span><span>Add</span></button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--circle-mobile (icon + text; circle below 640px)</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Negative</h2>
              <button type="button" class="btn btn--negative">Delete</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--negative</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Positive</h2>
              <button type="button" class="btn btn--positive">Confirm</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--positive</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Success (animation)</h2>
              <button type="button" class="btn btn--success">Saved</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--success</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Placeholder</h2>
              <button type="button" class="btn">Left</button>
              <button type="button" class="btn btn--placeholder" aria-hidden="true">Placeholder</button>
              <button type="button" class="btn">Right</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--placeholder (invisible, for spacing)</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Remove</h2>
              <button type="button" class="btn btn--remove" aria-label="Remove">× Remove</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--remove</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Reversed</h2>
              <button type="button" class="btn btn--reversed">Reversed</button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--reversed</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Toggleable</h2>
              <label class="btn">
                <input type="checkbox" name="toggle" value="1">
                <span class="checked">On</span>
                <span>Off</span>
              </label>
              <label class="btn">
                <input type="radio" name="choice" value="a">
                <span class="checked">A</span>
                <span>Option A</span>
              </label>
              <label class="btn">
                <input type="radio" name="choice" value="b">
                <span class="checked">B</span>
                <span>Option B</span>
              </label>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn with input[type=checkbox] or input[type=radio], .checked</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Back</h2>
              <button type="button" class="btn btn--back"><span class="icon icon--arrow-left" aria-hidden="true"></span><strong>Back</strong> <kbd>Esc</kbd></button>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn .btn--back</p>
          </section>

          <section class="margin-block-end-double">
            <div class="flex flex-wrap gap align-center">
              <h2 class="txt-large txt-align-start margin-none">Button group</h2>
              <div class="btn__group flex">
                <span><button type="button" class="btn">One</button></span>
                <span><button type="button" class="btn">Two</button></span>
                <span><button type="button" class="btn">Three</button></span>
              </div>
            </div>
            <p class="txt-small txt-subtle margin-none margin-block-start-half">.btn__group with .btn</p>
          </section>
        </div>
      </body>
      </html>
    `;
  });

export default designSystemRoutes;
