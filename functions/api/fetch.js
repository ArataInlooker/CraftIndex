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
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
};

const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50 MB
const TIMEOUT_MS = 10000; // 10 seconds

function isPrivateIpOrHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '169.254.169.254') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...SECURITY_HEADERS,
        'Access-Control-Max-Age': '86400'
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

    // SSRF & Allowlist Validation
    const targetHost = parsedTarget.hostname.toLowerCase();
    if (isPrivateIpOrHost(targetHost) || !WHITELISTED_HOSTS.has(targetHost)) {
      return new Response(JSON.stringify({ error: `Forbidden: Host '${targetHost}' is not in the CraftIndex API whitelist.` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    // Request Headers
    const reqHeaders = new Headers();
    reqHeaders.set('User-Agent', 'CraftIndex/2.6.0 (https://craftvault.inlooker.top)');
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
            headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
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
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    // Enforce size limit
    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return new Response(JSON.stringify({ error: 'Response payload exceeded size limit (50 MB)' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    // Build response headers
    const resHeaders = new Headers(upstreamRes.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
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
      error: isTimeout ? 'Upstream request timed out (10s)' : 'Internal proxy error: ' + err.message
    }), {
      status: isTimeout ? 504 : 502,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
    });
  }
}
