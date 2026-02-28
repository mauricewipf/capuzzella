# Capuzzella Security Audit (External Attack Simulation)

Date: 2026-02-12  
Target: `http://localhost:3000`  
Source reviewed: [mauricewipf/capuzzella](https://github.com/mauricewipf/capuzzella)

## Scope and Method

- Simulated an external attacker with only URL access.
- Performed black-box probing against public routes.
- Correlated behavior with source-code review.

## Executive Summary

The app has a generally solid authentication boundary, but one high-impact data exposure was confirmed: draft assets can be fetched without authentication through `?source=draft`. Additional medium risks were identified around session persistence strategy, CSRF defense depth, and production hardening.

Severity counts:

- High: 1
- Medium: 4
- Low: 2

## Findings

### 1) Unauthenticated Draft Asset Exposure (High)

Affected area:

- `src/server.js` (`tryServeStatic`, `source=draft` branch)

What happens:

- Requests to `/assets/...` with `?source=draft` read from `drafts/assets/` without checking authentication.

Reproduction:

```bash
curl -i "http://localhost:3000/assets/css/theme.css?source=draft"
```

Observed:

- `HTTP/1.1 200 OK`
- Draft CSS content returned without login.

Impact:

- Unpublished draft assets are publicly readable.
- Potential accidental sensitive file disclosure if draft assets are misused.

Fix:

- Enforce authentication before serving draft assets.
- Prefer removing public `source=draft` behavior entirely and serving draft files only through authenticated preview/edit code paths.
- Add strict extension allowlist for files under draft assets.

---

### 2) Anonymous Session Persistence Can Be Abused (Medium)

Affected area:

- `src/middleware/session.js`

What happens:

- First-time anonymous requests get server-side sessions persisted in DB (plus cookie issuance).

Reproduction:

```bash
curl -i "http://localhost:3000/health"
```

Observed:

- `Set-Cookie: capuzzella.sid=...` returned for anonymous health check.

Impact:

- Session table growth from unauthenticated traffic.
- Increased DB write load and storage pressure under bot traffic.

Fix:

- Use lazy session writes (persist only when session is modified).
- Avoid setting session cookie for purely anonymous/static requests.
- Add upstream rate limiting.

---

### 3) Missing CSP Header (Medium)

Affected area:

- Global response headers in `src/server.js`

What happens:

- Important hardening headers exist, but no `Content-Security-Policy`.

Impact:

- Weaker defense-in-depth against XSS and script injection.

Fix:

- Add a restrictive baseline CSP and tune for editor requirements:
  - `default-src 'self'`
  - `script-src 'self'`
  - `object-src 'none'`
  - `base-uri 'none'`
  - `frame-ancestors 'none'`

---

### 4) CSRF Defense Relies Primarily on Cookie Policy (Medium)

Affected area:

- State-changing endpoints (`/publish`, `/settings/password`, `/api/*`, `/auth/logout`)

What happens:

- No anti-CSRF token mechanism is implemented.

Impact:

- Current `SameSite=Strict` helps significantly, but CSRF token checks are still recommended for robust defense and future safety.

Fix:

- Add CSRF tokens (synchronizer token or double-submit token pattern) on all state-changing routes.

---

### 5) In-Memory Rate Limiting Is Not Durable/Shared (Medium)

Affected area:

- `src/routes/auth.js`, `src/routes/forms.js`

What happens:

- Limits are stored in process memory (`Map`), reset on restart, and not shared across instances.

Observed:

- Login route correctly throttles in a single process (attempt 6 returned `429`).

Impact:

- Weaker protection in horizontal scaling or after restarts.

Fix:

- Use centralized counters (Redis or gateway/WAF-level rate limits).
- Keep per-IP and per-account controls.

---

### 6) Trusted Proxy Misconfiguration Risk (Low)

Affected area:

- `src/lib/get-client-ip.js`

What happens:

- With `TRUSTED_PROXY=true`, IP identity depends on forwarding headers.

Impact:

- If edge proxy does not sanitize headers correctly, IP-based controls can be bypassed.

Fix:

- Only trust forwarding headers from known proxy hops.
- Ensure proxy overwrites inbound `X-Forwarded-For`/`X-Real-IP`.
- Document hardened proxy setup.

---

### 7) Editor Iframe Lacks Sandbox (Low, Defense in Depth)

Affected area:

- `src/middleware/inject-editor.js`

What happens:

- Draft HTML is loaded in `<iframe srcdoc="...">` without `sandbox`.

Impact:

- Active draft scripts run with stronger privileges than a sandboxed frame would allow.

Fix:

- Evaluate applying an iframe sandbox policy compatible with required editor behavior.

## Positive Security Notes

- Session IDs are high entropy and are regenerated on login.
- Password handling uses bcrypt via Bun APIs.
- Sensitive file APIs apply `safePath` checks.
- Login brute-force protection exists.
- Baseline security headers are set (`X-Frame-Options`, `X-Content-Type-Options`, HSTS in production).

## Recommended Priority Order

1. Lock down unauthenticated `?source=draft` access.
2. Implement lazy session persistence for anonymous traffic.
3. Add CSRF token protection for state changes.
4. Add CSP and validate behavior.
5. Move rate limiting to shared storage/gateway.

