# Capuzzella Security Audit Report

**Date:** February 12, 2026
**Target:** Capuzzella (AI-Powered Website Builder)
**Scope:** Black-box penetration test with public source code review ([GitHub](https://github.com/mauricewipf/capuzzella))
**Application URL:** http://localhost:3000

---

## Executive Summary

16 vulnerabilities were identified across the application, including 2 critical path traversal issues, 4 high-severity XSS/brute-force flaws, and 5 medium-severity misconfigurations. The authentication guards and SQL injection protections are solid, but the lack of input sanitization on file paths and HTML output in the editor represent the highest risk.

| Severity | Count |
| -------- | ----- |
| Critical | 2     |
| High     | 4     |
| Medium   | 5     |
| Low      | 5     |
| **Total**| **16**|

---

## Findings

### CRITICAL

#### 1. Path Traversal in Page API (Authenticated)

**Files:** `src/services/pages.js`, `src/routes/api.js`

The `getPage()`, `savePage()`, and `deletePage()` functions join user-supplied paths directly with `path.join(DRAFTS_DIR, pagePath)` without any path sanitization. The API routes pass `params['*']` directly to these functions.

```js
// src/services/pages.js — No validation
export async function getPage(pagePath) {
    const fullPath = path.join(DRAFTS_DIR, pagePath);
    const content = await fs.readFile(fullPath, 'utf-8');
}
```

An authenticated user could potentially:

- **Read** any file: `GET /api/pages/../../.env` (leaking API keys, secrets)
- **Write** any file: `PUT /api/pages/../../evil.js` (remote code execution)
- **Delete** any file: `DELETE /api/pages/../../data/capuzzella.db` (destroy the database)

> **Note:** Elysia appears to normalize `..` in URL paths before they reach the handler, which provides some incidental protection. However, the code has **zero defensive checks** — if the framework behavior changes or there is an encoding bypass, this becomes immediately exploitable. The same issue exists in `src/routes/publish.js` for publish/unpublish operations.

**Recommendation:** Validate that the resolved path starts with the expected directory (e.g. `resolvedPath.startsWith(DRAFTS_DIR)`). Reject any path containing `..` segments.

---

#### 2. Path Traversal via AI Prompt Injection

**Files:** `src/routes/api.js`, `src/services/ai/index.js`

The `create_page` AI tool returns a `newPagePath` that goes directly to `savePage()`:

```js
// src/routes/api.js
await savePage(result.newPagePath, result.updatedHtml);
```

A malicious user could craft a chat prompt that tricks the AI into calling `create_page` with a path like `../../etc/cron.d/malicious`, writing arbitrary files to the server.

**Recommendation:** Apply the same path validation to AI-generated paths before saving.

---

### HIGH

#### 3. No Rate Limiting on Login (Brute Force)

**File:** `src/routes/auth.js`

**Verified live.** 20 sequential login attempts with incorrect passwords were sent — none were rate-limited. While bcrypt adds ~6 seconds per attempt as a natural throttle, a distributed attacker running parallel requests from multiple IPs could brute-force weak passwords.

**Recommendation:** Add rate limiting per IP (e.g. 5 attempts per 15 minutes) and consider account lockout after repeated failures.

---

#### 4. Reflected XSS in Editor Title

**File:** `src/middleware/inject-editor.js`

The `pagePath` is inserted directly into the HTML `<title>` tag without any escaping:

```js
return `...<title>Edit: ${pagePath}</title>...`;
```

A crafted URL like `http://localhost:3000/</title><script>alert(1)</script>?edit=true` would close the title tag and inject JavaScript. Requires the victim to be authenticated — an attacker would send a phishing link to an admin.

**Recommendation:** HTML-escape the `pagePath` before inserting it into the template. Also escape it in the `data-page-path` attribute (see #5).

---

#### 5. Attribute Injection / XSS in Editor Container

**File:** `src/middleware/inject-editor.js`

The `pagePath` is also inserted unescaped into an HTML attribute:

```js
return `...<div id="capuzzella-editor" data-page-path="${pagePath}">...`;
```

A page path containing `"` breaks out of the attribute, enabling injection of arbitrary HTML attributes or elements (e.g. event handlers).

**Recommendation:** HTML-entity-encode `pagePath` (at minimum `"`, `<`, `>`, `&`) before inserting into any attribute or tag content.

---

#### 6. DOM XSS via innerHTML in Editor

**File:** `editor/editor.js`

When the AI creates a new page, the `newPagePath` from the API response is inserted into `innerHTML`:

```js
linkEl.innerHTML = `<a href="/${data.newPagePath}?edit=true"...>Open new page</a>`;
```

If the AI returns a malicious `newPagePath` (via prompt injection), this executes arbitrary JavaScript in the admin's browser.

**Recommendation:** Use `textContent` for the link label and set `href` via `setAttribute()` instead of string interpolation into `innerHTML`.

---

### MEDIUM

#### 7. Missing Security Headers

**Verified live.** The server returns no security headers:

| Missing Header                          | Risk                   |
| --------------------------------------- | ---------------------- |
| `X-Frame-Options` / CSP `frame-ancestors` | Clickjacking attacks   |
| `Content-Security-Policy`               | XSS mitigation         |
| `X-Content-Type-Options`                | MIME sniffing          |
| `Strict-Transport-Security`             | Downgrade attacks      |
| `Referrer-Policy`                       | Information leakage    |
| `Permissions-Policy`                    | Feature abuse          |

**Recommendation:** Add a middleware that sets all standard security headers on every response.

---

#### 8. CSRF via GET Logout

**File:** `src/routes/auth.js`

**Verified live.** Logout is accessible via GET request (`GET /auth/logout`). Since `SameSite=Lax` allows cookies on top-level GET navigations, an attacker can force-logout any authenticated user by embedding:

```html
<img src="http://your-capuzzella.com/auth/logout" />
```

**Recommendation:** Remove the GET logout route. Only allow logout via POST with a CSRF token.

---

#### 9. Rate Limiter Bypass via X-Forwarded-For Spoofing

**File:** `src/routes/forms.js`

**Verified live.** The contact form rate limiter uses `X-Forwarded-For` to identify clients:

```js
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ...
```

After being rate-limited from the real IP (HTTP 429), the limit was bypassed with a spoofed header:

```bash
curl -H "X-Forwarded-For: 1.2.3.4" -X POST http://localhost:3000/api/form ...
# -> {"success":true}  — Rate limit bypassed
```

**Recommendation:** Only trust `X-Forwarded-For` when behind a known reverse proxy. Use the socket/connection IP as fallback, or configure a trusted proxy list.

---

#### 10. Session Fixation

**Files:** `src/routes/auth.js`, `src/middleware/session.js`

The session ID is not regenerated after login. The same session ID assigned to an unauthenticated visitor persists after successful authentication. If an attacker can set a known session cookie in a victim's browser, they gain access after the victim logs in.

**Recommendation:** Regenerate the session ID (create new session, copy data, destroy old) upon successful authentication.

---

#### 11. No CSRF Tokens

**Files:** Multiple route files

While `SameSite=Lax` provides partial CSRF protection for POST requests, there are no CSRF tokens. Combined with the missing `X-Frame-Options` header, this creates a wider attack surface. Any future API changes that accept GET requests for state-changing operations would be immediately vulnerable.

**Recommendation:** Implement anti-CSRF tokens for all state-changing operations, or at minimum add `X-Frame-Options: DENY` and tighten SameSite to `Strict`.

---

### LOW

#### 12. Secure Cookie Flag Conditional on NODE_ENV

**File:** `src/middleware/session.js`

The `Secure` cookie flag is only set when `NODE_ENV === 'production'`:

```js
const secure = process.env.NODE_ENV === 'production';
```

If the production deployment does not set `NODE_ENV=production`, cookies will be transmitted over unencrypted HTTP.

**Recommendation:** Ensure deployment documentation and scripts always set `NODE_ENV=production`. Consider defaulting to secure and only disabling in development.

---

#### 13. Information Disclosure — Stack Traces

**File:** `src/routes/api.js`

Error stack traces are included in API responses when `NODE_ENV !== 'production'`:

```js
...(process.env.NODE_ENV !== 'production' && {
    stack: error.stack,
    name: error.name
})
```

**Recommendation:** Never expose stack traces in production. Verify `NODE_ENV` is always set in deployment.

---

#### 14. Information Disclosure — AI Provider Configuration

**File:** `src/routes/settings.js`

The settings page reveals which AI provider is active, the model name, and whether API keys are configured. While behind authentication, this helps an attacker who gains access target the specific AI provider integration.

**Recommendation:** Consider whether exposing the configured model and key status is necessary for users.

---

#### 15. Public Asset Manifest

**Verified live.** `http://localhost:3000/assets/manifest.json` is publicly accessible and reveals all asset file names and their fingerprinted versions. Minor information disclosure.

**Recommendation:** Restrict access or move the manifest out of the public directory.

---

#### 16. Email Header Injection (Potential)

**File:** `src/services/email.js`

The email subject line includes user-controlled data without sanitization:

```js
subject: `New contact form message from ${senderName}`,
```

If the Resend library does not sanitize CRLF characters, an attacker could inject additional email headers (e.g. BCC to exfiltrate data).

**Recommendation:** Strip newline characters (`\r`, `\n`) from all user-supplied values used in email headers.

---

## What's Done Well

- **SQL injection** is not possible — parameterized queries are used consistently
- **Password hashing** uses bcrypt with a reasonable cost factor (10 rounds)
- **Username enumeration** is prevented — consistent error messages for valid/invalid usernames
- **Authentication guards** on all protected routes work correctly (verified live)
- **Session cookies** have `HttpOnly` and `SameSite=Lax` flags
- **HTML escaping** is applied correctly in the pages list and settings page (`escapeHtml()`)
- **Sensitive files** (`.env`, `package.json`, database) are not served by the static file handler
