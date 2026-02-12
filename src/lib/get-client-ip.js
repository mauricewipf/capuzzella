/**
 * Extract client IP address from a request.
 *
 * When the TRUSTED_PROXY env var is set to "true" (e.g. behind Railway, nginx,
 * or another reverse proxy), proxy headers (X-Forwarded-For, X-Real-IP) are
 * trusted. Otherwise only the direct connection IP from Bun's server is used,
 * which cannot be spoofed by the client.
 *
 * @param {Request} request - The incoming HTTP request
 * @param {import('bun').Server} [server] - Bun server instance (for requestIP)
 * @returns {string} The client IP address, or "unknown"
 */
export function getClientIp(request, server) {
  const trustProxy = process.env.TRUSTED_PROXY === 'true';

  if (trustProxy) {
    // First IP in X-Forwarded-For is the original client when the proxy is trusted
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const firstIp = forwarded.split(',')[0]?.trim();
      if (firstIp) return firstIp;
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
  }

  // Direct connection IP — safe regardless of proxy trust
  if (server?.requestIP) {
    const addr = server.requestIP(request)?.address;
    if (addr) return addr;
  }

  return 'unknown';
}
