# Security Audit Report for Capuzzella

## Overview

**Target:** Capuzzella Application (`http://localhost:3000`)
**Date:** 2026-02-12
**Auditor:** AI Assistant

This document outlines the findings from a security audit performed on the Capuzzella application. The audit involved code review and limited black-box testing.

## Executive Summary

The application has a generally solid foundation with some good security practices (CSRF protection, secure session defaults, use of parameterized queries). However, a few critical and medium-severity vulnerabilities were identified, primarily involving Open Redirects and Stored Cross-Site Scripting (XSS).

## Vulnerability Findings

### 1. Open Redirect via `returnTo` Parameter

**Severity:** **High**

**Description:**
The application uses a `returnTo` session variable to redirect users after a successful login. This variable is populated from the request path and query string without adequate validation. An attacker can construct a URL that, upon authentication, redirects the user to an arbitrary external domain. This can be used in phishing attacks to steal credentials or tokens.

**Evidence:**
In `src/middleware/auth.js`:
```javascript
// src/middleware/auth.js:35
session.returnTo = path + (request.url.includes('?') ? '?' + request.url.split('?')[1] : '');
```
And in `src/routes/auth.js`:
```javascript
// src/routes/auth.js:152
headers: {
  'Location': returnTo,
  // ...
}
```

**Proof of Concept:**
1.  Navigate to `http://localhost:3000//google.com?draft=true`.
2.  The application sets `returnTo` to `//google.com?draft=true` and redirects to login.
3.  After logging in, the user is redirected to `//google.com?draft=true`.

**Remediation:**
Validate the `returnTo` URL to ensure it is a relative path (starts with `/` but not `//`) or matches an allowlist of trusted domains.
```javascript
// Suggested fix
const isValidRedirect = (url) => url.startsWith('/') && !url.startsWith('//');
const safeReturnTo = isValidRedirect(returnTo) ? returnTo : '/';
```

### 2. Stored Cross-Site Scripting (XSS) in Page Content

**Severity:** **High**

**Description:**
The application allows users (specifically the AI, driven by user prompts) to generate HTML content for pages. While there is a basic `validateHtml` function, it does not sanitize the HTML for malicious scripts (e.g., `<script>`, `onload` handlers). An attacker with access to the editor (or if the AI is tricked via Prompt Injection) can insert malicious JavaScript that executes when other users view the page.

**Evidence:**
In `src/routes/api.js`, the content returned by `processChat` is validated but not sanitized:
```javascript
// src/routes/api.js:131
const validation = validateHtml(result.updatedHtml);
if (!validation.valid) { ... }
// ...
await savePage(pagePath, result.updatedHtml);
```
`validateHtml` in `src/routes/api.js` only checks for basic structure (`<!doctype>`, CSS links) but not for XSS vectors.

**Remediation:**
Implement a robust HTML sanitizer (like `dompurify` or `sanitize-html`) before saving the page content or before rendering it in the editor.
```javascript
import sanitizeHtml from 'sanitize-html';
// Configure allowing specific tags and attributes suitable for the builder
const cleanHtml = sanitizeHtml(dirtyHtml, { ... });
```

### 3. Potential Path Traversal in Static File Serving

**Severity:** **Medium** (Mitigated by framework)

**Description:**
The static file serving logic in `src/server.js` constructs file paths using user input without using the `safePath` utility found elsewhere in the application. While the Elysia framework likely normalizes paths (preventing `..` attacks), relying on implicit framework behavior is risky.

**Evidence:**
In `src/server.js`:
```javascript
// src/server.js:156
if (reqPath.startsWith('/editor/')) {
  const filepath = path.join(EDITOR_DIR, reqPath.slice(8));
  return await serveStaticFile(filepath);
}
```
And similarly for `/assets/`.

**Remediation:**
Use the `safePath` utility function to explicitly validate that the resolved path is within the intended directory.
```javascript
// Suggested fix
if (reqPath.startsWith('/editor/')) {
  try {
    const filepath = safePath(EDITOR_DIR, reqPath.slice(8));
    return await serveStaticFile(filepath);
  } catch (e) { return null; }
}
```

### 4. Weak Account Lockout Mechanism

**Severity:** **Low**

**Description:**
The login rate limiter tracks failed attempts by IP address (`src/routes/auth.js`). It does not lock the specific user account. An attacker with a botnet (multiple IPs) could brute-force the password for the `admin` account.

**Remediation:**
Implement account-based locking in addition to IP-based rate limiting. If `admin` has 10 failed attempts from any IP, lock the account for a duration.

## Other Observations

-   **Secrets Management:** The application generates a random session secret and admin password on startup if not present. Ensure `CAPUZZELLA_SESSION_SECRET` (if used) and `capuzzella.db` are persisted securely in production.
-   **Headers:** Security headers (HSTS, CSP) are correctly implemented.
-   **Dependencies:** Review dependencies regularly for vulnerabilities (`npm audit`).

## Conclusion

The "Capuzzella" application requires immediate attention to the Open Redirect and Stored XSS vulnerabilities before being considered "bulletproof" for production. Implementing the suggested fixes will significantly improve the security posture.
