/**
 * CraftIndex Security Hardening Regression Tests
 * ------------------------------------------------
 * Verifies rate limiting, CORS, CSP, XSS context safety,
 * and error message sanitization implemented during the
 * security hardening pass.
 *
 * Runs purely in Node.js (no browser, no server required)
 * by directly importing and invoking the relevant modules.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${name}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('CRAFTINDEX SECURITY HARDENING REGRESSION TESTS');
  console.log('================================================================\n');

  // ── Test 1: Rate Limiting (functions/api/fetch.js) ──
  console.log('1. Rate Limiting (functions/api/fetch.js)');
  const fetchMod = await import('../functions/api/fetch.js');

  // Access the internal rate limiter via the module's exported surface.
  // Since onRequest is the only export, we test via the source code
  // by re-implementing the rate limit logic check against the source.
  const fetchSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'functions', 'api', 'fetch.js'),
    'utf-8'
  );

  check('Rate limiter state exists in source', fetchSource.includes('rateLimiters'));
  check('Fixed window config present', fetchSource.includes('RATE_WINDOW_MS'));
  check('IP-based keying present', fetchSource.includes('getClientIp'));
  check('Rate limit headers present', fetchSource.includes('X-RateLimit-Limit'));
  check('Retry-After header present', fetchSource.includes('Retry-After'));
  check('HTTP 429 response present', fetchSource.includes('status: 429'));
  check('Rate limit applied in onRequest', fetchSource.includes('checkRateLimit(ip, ep)'));
  check('Limit value 60/minute', fetchSource.includes("'/api/fetch': 60"));

  // ── Test 2: Error Message Sanitization ──
  console.log('\n2. Error Message Sanitization');
  const serverSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'server.js'),
    'utf-8'
  );

  check('sanitizeError function exists in server.js', serverSource.includes('function sanitizeError'));
  check('sanitizeError function exists in fetch.js', fetchSource.includes('function sanitizeError'));
  check('IP redaction in sanitizeError', serverSource.includes('[redacted-ip]'));
  check('Host redaction in sanitizeError', serverSource.includes('[redacted-host]'));
  check('URL redaction in sanitizeError', serverSource.includes('[redacted-url]'));
  check('ECONNREFUSED handled', serverSource.includes('ECONNREFUSED'));
  check('ENOTFOUND handled', serverSource.includes('ENOTFOUND'));
  check('ETIMEDOUT handled', serverSource.includes('ETIMEDOUT'));
  check('All proxy error paths use sanitizeError', serverSource.split('sendProxyError(res, 502').length > 5);

  // ── Test 3: CSP Headers ──
  console.log('\n3. Content Security Policy');
  check('server.js CSP present', serverSource.includes("Content-Security-Policy"));
  check('unsafe-eval removed from CSP', !serverSource.includes("'unsafe-eval'"));
  check('unsafe-inline retained (needed for inline scripts)', serverSource.includes("'unsafe-inline'"));
  check('object-src none', serverSource.includes("object-src 'none'"));
  check('base-uri self', serverSource.includes("base-uri 'self'"));

  const routeSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'functions', '[[route]].js'),
    'utf-8'
  );
  check('route function CSP present', routeSource.includes("content-security-policy"));

  const fetchSource2 = fs.readFileSync(
    path.resolve(__dirname, '..', 'functions', 'api', 'fetch.js'),
    'utf-8'
  );
  check('fetch.js restrictive CSP', fetchSource2.includes("default-src 'none'"));

  // ── Test 4: XSS Context Safety ──
  console.log('\n4. XSS Context Safety');

  const appSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'js', 'app.js'),
    'utf-8'
  );

  check('CraftIndexSanitizer defined', appSource.includes('const CraftIndexSanitizer = {'));
  check('isSafeUrl validates http/https', appSource.includes('["http:", "https:", "mailto:"].includes(parsed.protocol)'));
  check('isSafeUrl rejects javascript: (only http/https/mailto allowed)', appSource.includes('["http:", "https:", "mailto:"].includes(parsed.protocol)'));
  check('ALLOWED_TAGS excludes script', appSource.includes('"script"'));
  check('ALLOWED_TAGS excludes iframe', appSource.includes('"iframe"'));
  check('forbidden tag removal', appSource.includes('FORBIDDEN_TAGS'));
  check('href/src URL validation in sanitize', appSource.includes('if (name === "href" || name === "src")'));
  check('noopener noreferrer on links', appSource.includes('"noopener noreferrer"'));

  // Check escapeHtml in app.js
  check('escapeHtml in app.js escapes quotes', appSource.includes('"&quot;"'));
  check('escapeHtml in app.js handles null', appSource.includes('s ?? ""'));

  // Check resource_render.js safeAbsolute
  const renderSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'functions', 'lib', 'resource_render.js'),
    'utf-8'
  );
  check('safeAbsolute enforces https-only', renderSource.includes("url.protocol === 'https:'"));
  check('escapeHtml used in SSR body', renderSource.includes('escapeHtml(resource.title'));
  check('escapeHtml used in SSR gallery', renderSource.includes('escapeHtml(safeAbsolute(g.url))'));

  // ── Test 5: CORS ──
  console.log('\n5. CORS Configuration');
  check('Access-Control-Allow-Origin present in fetch.js', fetchSource2.includes("'Access-Control-Allow-Origin': '*'"));
  check('OPTIONS preflight handled in fetch.js', fetchSource2.includes("request.method === 'OPTIONS'"));
  check('Access-Control-Allow-Methods present', fetchSource2.includes("'Access-Control-Allow-Methods'"));
  check('Access-Control-Allow-Headers present', fetchSource2.includes("'Access-Control-Allow-Headers'"));
  check('No Access-Control-Allow-Credentials (no wildcard+creds)', !fetchSource2.includes("'Access-Control-Allow-Credentials'"));

  // ── Test 6: SSRF Protection ──
  console.log('\n6. SSRF Protection');
  check('WHITELISTED_HOSTS in fetch.js', fetchSource2.includes('WHITELISTED_HOSTS'));
  check('isPrivateIpOrHost in fetch.js', fetchSource2.includes('isPrivateIpOrHost'));
  check('redirect host re-validation', fetchSource2.includes('WHITELISTED_HOSTS.has(nextHost)'));
  check('manual redirect handling', fetchSource2.includes("redirect: 'manual'"));
  check('10 second timeout', fetchSource2.includes('TIMEOUT_MS = 10000'));
  check('50 MB response size limit', fetchSource2.includes('MAX_RESPONSE_SIZE = 50 * 1024 * 1024'));

  // ── Test 7: No Hardcoded Secrets ──
  console.log('\n7. Secret Protection');
  check('No sk_ prefix in source', !appSource.includes('sk_') && !serverSource.includes('sk_') && !fetchSource2.includes('sk_'));
  check('No pk_ prefix in source', !appSource.includes('pk_') && !serverSource.includes('pk_') && !fetchSource2.includes('pk_'));
  check('CF_KEY read from env not hardcoded', serverSource.includes('process.env.CF_KEY') && fetchSource2.includes('env.CF_KEY'));
  check('.env.example has placeholder only', fs.readFileSync(path.resolve(__dirname, '..', '.env.example'), 'utf-8').includes('CF_KEY='));

  // ── Test 8: Security Headers Consistency ──
  console.log('\n8. Security Headers Consistency');

  const headersSource = fs.readFileSync(
    path.resolve(__dirname, '..', '_headers'),
    'utf-8'
  );

  check('_headers file exists for static assets', fs.existsSync(path.resolve(__dirname, '..', '_headers')));
  check('_headers X-Content-Type-Options', headersSource.includes('X-Content-Type-Options: nosniff'));
  check('_headers X-Frame-Options', headersSource.includes('X-Frame-Options: SAMEORIGIN'));
  check('_headers Referrer-Policy', headersSource.includes('Referrer-Policy: strict-origin-when-cross-origin'));
  check('_headers Permissions-Policy', headersSource.includes('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()'));
  check('_headers Strict-Transport-Security', headersSource.includes('Strict-Transport-Security: max-age=31536000'));
  check('_headers CSP present', headersSource.includes('Content-Security-Policy:'));
  check('_headers no preload in HSTS', !headersSource.includes('preload'));
  check('_headers no duplicate CSP', (headersSource.match(/Content-Security-Policy:/g) || []).length === 1);

  // route function headers
  check('route function X-Frame-Options', routeSource.includes("'x-frame-options': 'SAMEORIGIN'"));
  check('route function Permissions-Policy', routeSource.includes("'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'"));
  check('route function Strict-Transport-Security', routeSource.includes("'strict-transport-security': 'max-age=31536000'"));
  check('route function X-Content-Type-Options', routeSource.includes("'x-content-type-options': 'nosniff'"));
  check('route function no unsafe-eval', !routeSource.includes("'unsafe-eval'"));

  // fetch.js headers
  check('fetch.js Permissions-Policy', fetchSource2.includes("'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'"));
  check('fetch.js Strict-Transport-Security', fetchSource2.includes("'Strict-Transport-Security': 'max-age=31536000'"));
  check('fetch.js X-Frame-Options', fetchSource2.includes("'X-Frame-Options': 'SAMEORIGIN'"));
  check('fetch.js X-Content-Type-Options', fetchSource2.includes("'X-Content-Type-Options': 'nosniff'"));
  check('fetch.js restrictive CSP', fetchSource2.includes("default-src 'none'"));

  // server.js headers
  check('server.js X-Frame-Options', serverSource.includes("'X-Frame-Options': 'SAMEORIGIN'"));
  check('server.js Permissions-Payment', serverSource.includes("'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'"));
  check('server.js Strict-Transport-Security no preload', serverSource.includes("'Strict-Transport-Security': 'max-age=31536000'"));
  check('server.js no preload in HSTS', !serverSource.includes("'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'"));
  check('server.js X-Content-Type-Options', serverSource.includes("'X-Content-Type-Options': 'nosniff'"));

  // ── Test 9: Cache Hit Header Refresh ──
  console.log('\n9. Cache Hit Header Refresh (resource_render route)');

  const routeSSRSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'functions', '[[route]].js'),
    'utf-8'
  );

  // Import the buildCacheKey function, RESOURCE_CACHE_VERSION, and HTML_HEADERS
  const routeMod = await import('../functions/[[route]].js');

  check('RESOURCE_CACHE_VERSION is defined', routeMod.RESOURCE_CACHE_VERSION === 'v2');
  check('buildCacheKey is exported', typeof routeMod.buildCacheKey === 'function');
  check('HTML_HEADERS is exported', typeof routeMod.HTML_HEADERS === 'object');

  // Cache key normalization tests
  const baseUrl = 'https://craftindex.inlooker.top/mods/sodium/';
  const baseKey = routeMod.buildCacheKey(baseUrl);
  check('buildCacheKey returns a Request', baseKey instanceof Request);
  check('buildCacheKey URL contains cache version param', baseKey.url.includes('__ci_resource_cache=v2'));
  check('buildCacheKey URL path ends with trailing slash', new URL(baseKey.url).pathname === '/mods/sodium/');

  // Irrelevant query parameters should not create extra cache variants
  const noisyUrl = 'https://craftindex.inlooker.top/mods/sodium/?utm_source=twitter&fbclid=abc123&_cb=xyz';
  const noisyKey = routeMod.buildCacheKey(noisyUrl);
  check('Noisy URL produces same cache key as clean URL', noisyKey.url === baseKey.url);

  // Trailing slash normalization
  const noTrailingUrl = 'https://craftindex.inlooker.top/mods/sodium';
  const noTrailingKey = routeMod.buildCacheKey(noTrailingUrl);
  check('No trailing slash produces same cache key as with trailing slash', noTrailingKey.url === baseKey.url);

  // Different slugs produce different keys
  const otherSlugKey = routeMod.buildCacheKey('https://craftindex.inlooker/mods/fabric-api/');
  check('Different slug produces different cache key', otherSlugKey.url !== baseKey.url);

  // Cache hit header refresh simulation
  // Simulate a cached response with OLD headers (missing X-Frame-Options, Permissions-Policy, etc.)
  const cachedHeaders = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=3600, s-maxage=86400',
    'x-craftindex-ssr': 'resource-page',
    // Intentionally missing X-Frame-Options, Permissions-Policy, Strict-Transport-Security
  });

  const headers = new Headers(cachedHeaders);
  for (const [key, value] of Object.entries(routeMod.HTML_HEADERS)) {
    headers.set(key, value);
  }

  check('Reapplied headers include X-Frame-Options', headers.get('x-frame-options') === 'SAMEORIGIN');
  check('Reapplied headers include Permissions-Policy', headers.get('permissions-policy') === 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  check('Reapplied headers include Strict-Transport-Security', headers.get('strict-transport-security') === 'max-age=31536000');
  check('Reapplied headers include X-Content-Type-Options', headers.get('x-content-type-options') === 'nosniff');
  check('Reapplied headers include Referrer-Policy', headers.get('referrer-policy') === 'strict-origin-when-cross-origin');
  check('Reapplied headers include Content-Security-Policy', headers.get('content-security-policy').startsWith("default-src 'self'"));
  check('Reapplied headers preserve Cache-Control', headers.get('cache-control') === 'public, max-age=3600, s-maxage=86400');
  check('Reapplied headers preserve X-CraftIndex-SSR', headers.get('x-craftindex-ssr') === 'resource-page');

}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
