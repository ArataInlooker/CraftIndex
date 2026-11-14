/**
 * Cloudflare Pages Function: /api/fetch
 * Strict Whitelisted Proxy Endpoint with SSRF Protection
 */

const WHITELISTED_HOSTS = new Set([
  'api.modrinth.com',
  'cdn.modrinth.com',
  'api.curseforge.com',
  'mediafilez.forgecdn.net',
  'edge.forgecdn.net',
  'media.forgecdn.net',
  'hangar.papermc.io',
  'api.spiget.org',
  'api.polymart.org',
  'api.smithed.dev',
  'api.github.com',
  'raw.githubusercontent.com',
  'ore.spongepowered.org',
  'www.planetminecraft.com'
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
  'Content-Security-Policy': "default-src 'none';"
};

// Strip sensitive implementation details from error messages before
// returning them to clients. Prevents leakage of internal host names,
// stack traces, and connection specifics.
function sanitizeError(err) {
  const msg = String(err && err.message ? err.message : err || 'Unknown error');
  return msg
    .replace(/ECONNREFUSED[^)]*\)/g, 'connection refused')
    .replace(/ENOTFOUND[^)]*\)/g, 'host not found')
    .replace(/ETIMEDOUT[^)]*\)/g, 'connection timed out')
    .replace(/ECONNRESET[^)]*\)/g, 'connection reset')
    .replace(/EHOSTUNREACH[^)]*\)/g, 'host unreachable')
    .replace(/EACCES[^)]*\)/g, 'access denied')
    .replace(/[0-9]{1,3}(\.[0-9]{1,3}){3}/g, '[redacted-ip]')
    .replace(/localhost/g, '[redacted-host]')
    .replace(/127\.0\.0\.1/g, '[redacted-host]')
    .replace(/::1/g, '[redacted-host]')
    .replace(/169\.254\.169\.254/g, '[redacted-host]')
    .replace(/https?:\/\/[^/\s]+/g, '[redacted-url]');
}

const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50 MB
const TIMEOUT_MS = 10000; // 10 seconds

/* ---------------------------------------------------------------
 * Rate Limiting (fixed-window, IP-based, in-memory)
 * ---------------------------------------------------------------
 * CraftIndex runs on Cloudflare Pages at the edge, where each edge
 * node maintains its own in-memory state. A process-local Map is the
 * only locally-verifiable implementation available without production
 * Cloudflare KV/Durable Objects bindings. Counter resets every
 * WINDOW_MS. Limits are generous enough to never block normal
 * browsing but low enough to prevent provider quota exhaustion.
 */
const RATE_WINDOW_MS = 60 * 1000; // 1 minute fixed window
const rateLimiters = new Map(); // key: `${ip}:${endpoint}` => { count, resetAt }

function getClientIp(request) {
  // Cloudflare Pages Functions: prefer CF-Connecting-IP, which Cloudflare
  // sets itself and overwrites client-provided values. Validate format.
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp)) {
    return cfIp;
  }
  // Fallback: do not trust X-Forwarded-For (client-supplied, spoofable).
  return 'unknown';
}

function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (!trimmed) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    return trimmed.split('.').every((octet) => {
      const n = parseInt(octet, 10);
      return n >= 0 && n <= 255;
    });
  }
  if (/^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(':')) {
    return true;
  }
  return false;
}

function endpointKey(request) {
  const url = request.url || '';
  if (url.includes('/api/fetch')) return '/api/fetch';
  return null;
}

// Endpoint-specific limits: requests per window per IP.
const RATE_LIMITS = {
  '/api/fetch': 60
};

function checkRateLimit(ip, endpoint) {
  const limit = RATE_LIMITS[endpoint] || 60;
  const now = Date.now();
  const key = `${ip}:${endpoint}`;
  let entry = rateLimiters.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimiters.set(key, entry);
  }
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return { allowed: entry.count <= limit, limit, remaining, retryAfter };
}

function sendRateLimitResponse(retryAfter) {
  return new Response(JSON.stringify({ error: 'Too many requests. Please slow down and try again later.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(retryAfter),
      ...SECURITY_HEADERS
    }
  });
}

function isPrivateIpOrHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '169.254.169.254') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Rate limiting for API proxy endpoints.
  const ep = endpointKey(request);
  let rlInfo = null;
  if (ep) {
    const ip = getClientIp(request);
    rlInfo = checkRateLimit(ip, ep);
    if (!rlInfo.allowed) {
      return sendRateLimitResponse(rlInfo.retryAfter);
    }
  }

  // Build rate-limit info headers for all API responses.
  function rateLimitHeaders() {
    if (!rlInfo) return {};
    return {
      'X-RateLimit-Limit': String(rlInfo.limit),
      'X-RateLimit-Remaining': String(rlInfo.remaining),
      'X-RateLimit-Reset': String(Math.ceil(rlInfo.retryAfter))
    };
  }

  // Handle CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...SECURITY_HEADERS,
        'Access-Control-Max-Age': '86400',
        ...rateLimitHeaders()
      }
    });
  }

  try {
    const reqUrl = new URL(request.url);
    const targetParam = reqUrl.searchParams.get('url');
    if (!targetParam) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetParam);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Invalid destination URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    // Protocol Validation: Only HTTP(S) protocols are permitted
    if (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') {
      return new Response(JSON.stringify({ error: `Forbidden: Protocol '${parsedTarget.protocol}' is not allowed.` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    // SSRF & Allowlist Validation
    const targetHost = parsedTarget.hostname.toLowerCase();
    if (isPrivateIpOrHost(targetHost) || !WHITELISTED_HOSTS.has(targetHost)) {
      return new Response(JSON.stringify({ error: `Forbidden: Host '${targetHost}' is not in the CraftIndex API whitelist.` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...rateLimitHeaders() }
      });
    }

    // Request Headers
    const reqHeaders = new Headers();
    reqHeaders.set('User-Agent', 'CraftIndex/2.6.0 (https://craftindex.inlooker.top)');
    if (request.headers.get('accept')) {
      reqHeaders.set('Accept', request.headers.get('accept'));
    }
    const apiKey = request.headers.get('x-api-key') || env.CF_KEY || env.CURSEFORGE_API_KEY;
    if (apiKey) {
      reqHeaders.set('x-api-key', apiKey);
    }

    // Fetch upstream with manual redirect inspection
    let currentUrl = parsedTarget;
    let redirectCount = 0;
    let upstreamRes = null;

    while (redirectCount <= 3) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        upstreamRes = await fetch(currentUrl.toString(), {
          method: request.method,
          headers: reqHeaders,
          body: request.method === 'POST' ? await request.clone().arrayBuffer() : undefined,
          redirect: 'manual',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Check if redirect
      if ([301, 302, 307, 308].includes(upstreamRes.status)) {
        const location = upstreamRes.headers.get('location');
        if (!location) break;

        const nextUrl = new URL(location, currentUrl);
        const nextHost = nextUrl.hostname.toLowerCase();

        // Validate redirect host
        if (isPrivateIpOrHost(nextHost) || !WHITELISTED_HOSTS.has(nextHost)) {
return new Response(JSON.stringify({ error: `Forbidden: Redirect destination '${nextHost}' is not whitelisted.` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...rateLimitHeaders() }
      });
        }

        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      break;
    }

    if (!upstreamRes) {
      return new Response(JSON.stringify({ error: 'Failed to receive response from upstream provider' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...rateLimitHeaders() }
      });
    }

    // Enforce size limit
    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return new Response(JSON.stringify({ error: 'Response payload exceeded size limit (50 MB)' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...rateLimitHeaders() }
      });
    }

    // Build response headers
    const resHeaders = new Headers(upstreamRes.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      resHeaders.set(k, v);
    }
    for (const [k, v] of Object.entries(rateLimitHeaders())) {
      resHeaders.set(k, v);
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders
    });

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return new Response(JSON.stringify({
      error: isTimeout ? 'Upstream request timed out (10s)' : 'Internal proxy error: ' + sanitizeError(err)
    }), {
      status: isTimeout ? 504 : 502,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...rateLimitHeaders() }
    });
  }
}
