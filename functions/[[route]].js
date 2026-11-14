/**
 * CraftIndex Cloudflare Pages catch-all Function: functions/[[route]].js
 * ---------------------------------------------------------------------
 * Serves standalone resource pages (/<category>/<slug>/) with full
 * server-rendered SEO content for crawler/direct navigation.
 *
 * Behaviour:
 *  - Non-matching paths (category roots, loader prerendered routes, assets,
 *    docs, studio, etc.) are transparently forwarded to the static asset
 *    server, so prerendered behavior is unchanged.
 *  - Resolution chain + SSR lives in ./lib/resource_render.js.
 *  - Successful pages are edge-cached for ~1 day via caches.default.
 *  - Unknown/deleted resources return the real 404.html with status 404
 *    (no soft-404s).
 */

import { CATEGORY_MAP, RESERVED_MOD_LOADER_SLUGS, resolveResource, relatedModrinth, injectResourcePage } from './lib/resource_render.js';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';"
};

function isResourceRoute(pathname) {
  const path = pathname.toLowerCase().replace(/\/+$/, '');
  const seg = path.split('/').filter(Boolean);
  if (seg.length !== 2) return null;
  const [cat, slug] = seg;
  if (!CATEGORY_MAP[cat]) return null;
  if (cat === 'mods' && RESERVED_MOD_LOADER_SLUGS.has(slug)) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) return null;
  return { category: cat, slug };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return env.ASSETS.fetch(request);
  }

  const url = new URL(request.url);
  const route = isResourceRoute(url.pathname);
  if (!route) {
    // Straight pass-through: static asset routes keep their original
    // delivery path (headers come straight from the asset server).
    return env.ASSETS.fetch(request);
  }

  // Edge cache around fully-rendered resource pages.
  const cacheKey = new Request(url.toString().replace(/\/+$/, '') + '/', { method: 'GET' });
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  let resource = null;
  try {
    resource = await resolveResource(route.category, route.slug, env);
  } catch (err) {
    // Upstream provider outage: degrade to the static category page so the
    // UX stays functional rather than erroring the whole route.
    try {
      const fallback = await env.ASSETS.fetch(new Request(url.origin + '/' + route.category + '/'));
      return new Response(fallback.body, fallback);
    } catch (_) {
      const nf = await env.ASSETS.fetch(new Request(url.origin + '/404.html'));
      return new Response(nf.body, { status: nf.status, headers: HTML_HEADERS });
    }
  }

  if (!resource) {
    const nf = await env.ASSETS.fetch(new Request(url.origin + '/404.html'));
    return new Response(nf.body, {
      status: 404,
      headers: { ...HTML_HEADERS, 'cache-control': 'public, max-age=600' }
    });
  }

  // Related resources (Modrinth categories only, graceful empty fallback).
  let related = [];
  if (resource.source === 'modrinth') {
    related = await relatedModrinth(resource.category, resource.id, 6);
  }

  // Template: the prerendered category page from the asset server.
  const templateRes = await env.ASSETS.fetch(new Request(url.origin + '/' + route.category + '/'));
  if (!templateRes.ok) {
    return env.ASSETS.fetch(request);
  }
  const templateHtml = await templateRes.text();
  const html = injectResourcePage(templateHtml, resource, related, route.slug);

  const res = new Response(html, {
    status: 200,
    headers: {
      ...HTML_HEADERS,
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'x-craftindex-ssr': 'resource-page'
    }
  });
  try {
    await caches.default.put(cacheKey, res.clone());
  } catch (_) {}
  return res;
}
