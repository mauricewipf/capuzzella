/**
 * Extract client IP address from a request.
 *
 * Proxy headers are trusted only when all of the following are true:
 * - TRUSTED_PROXY="true"
 * - request source is validated against TRUSTED_PROXY_LIST / TRUSTED_PROXIES,
 *   OR TRUSTED_PROXY_HOPS matches a structurally valid forwarding chain.
 *
 * This keeps direct-connection mode safe by default and avoids trusting spoofed
 * forwarded headers when proxy config is missing or invalid.
 *
 * @param {Request} request - The incoming HTTP request
 * @param {import('bun').Server} [server] - Bun server instance (for requestIP)
 * @returns {string} The client IP address, or "unknown"
 */
export function getClientIp(request, server) {
  const trustProxy = process.env.TRUSTED_PROXY === 'true';
  const sourceIp = getDirectConnectionIp(request, server);

  if (trustProxy) {
    const trustedProxyList = parseTrustedProxyList();
    const trustedProxyHops = parseTrustedProxyHops();
    const forwardedChain = parseForwardedChain(request.headers.get('x-forwarded-for'));
    const sourceIsValidated = validateProxySource({
      sourceIp,
      trustedProxyList,
      trustedProxyHops,
      forwardedChain
    });

    if (sourceIsValidated) {
      if (forwardedChain.length > 0) {
        if (trustedProxyHops !== null) {
          const clientIndex = forwardedChain.length - trustedProxyHops - 1;
          if (clientIndex >= 0 && forwardedChain[clientIndex]) {
            return forwardedChain[clientIndex];
          }
        } else if (forwardedChain[0]) {
          return forwardedChain[0];
        }
      }

      const realIp = normalizeIp(request.headers.get('x-real-ip'));
      if (realIp) return realIp;
    }
  }

  if (sourceIp) return sourceIp;

  return 'unknown';
}

function getDirectConnectionIp(request, server) {
  if (!server?.requestIP) return null;
  return normalizeIp(server.requestIP(request)?.address);
}

function parseTrustedProxyList() {
  const rawList = process.env.TRUSTED_PROXY_LIST || process.env.TRUSTED_PROXIES;
  if (!rawList) return [];

  return rawList
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter(Boolean);
}

function parseTrustedProxyHops() {
  const rawHops = process.env.TRUSTED_PROXY_HOPS;
  if (!rawHops) return null;

  const hops = Number.parseInt(rawHops, 10);
  if (!Number.isInteger(hops) || hops <= 0) {
    return null;
  }

  return hops;
}

function parseForwardedChain(rawHeader) {
  if (!rawHeader) return [];

  return rawHeader
    .split(',')
    .map((value) => normalizeIp(value))
    .filter(Boolean);
}

function validateProxySource({ sourceIp, trustedProxyList, trustedProxyHops, forwardedChain }) {
  if (!sourceIp) return false;

  if (trustedProxyList.length > 0) {
    return trustedProxyList.includes(sourceIp);
  }

  // Safe fallback: no trusted list and no valid hops means "don't trust headers".
  if (trustedProxyHops === null) {
    return false;
  }

  // With hop-based trust, ensure chain is long enough and nearest proxy matches source.
  if (forwardedChain.length < trustedProxyHops + 1) {
    return false;
  }

  const nearestForwarded = forwardedChain[forwardedChain.length - 1];
  return nearestForwarded === sourceIp;
}

function normalizeIp(rawIp) {
  if (!rawIp) return null;

  let ip = String(rawIp).trim();
  if (!ip) return null;

  if (ip.startsWith('[')) {
    const endBracket = ip.indexOf(']');
    if (endBracket > 0) {
      ip = ip.slice(1, endBracket);
    }
  }

  const mappedV4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedV4) return mappedV4[1];

  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1];

  const zoneIndex = ip.indexOf('%');
  if (zoneIndex > 0) {
    ip = ip.slice(0, zoneIndex);
  }

  return ip || null;
}
