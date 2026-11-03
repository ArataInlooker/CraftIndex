/**
 * Cloudflare Pages Function: /api/hangar/*
 * Reverse Proxy for PaperMC Hangar (hangar.papermc.io)
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...SECURITY_HEADERS, 'Access-Control-Max-Age': '86400' }
    });
  }

  const reqUrl = new URL(request.url);
  const targetPath = '/api/v1' + reqUrl.pathname.replace('/api/hangar', '') + reqUrl.search;
  const upstreamUrl = `https://hangar.papermc.io${targetPath}`;

  try {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    headers.set('User-Agent', 'CraftIndex');

    const upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.clone().arrayBuffer() : undefined
    });

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
    return new Response(JSON.stringify({ error: 'Hangar proxy error: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
    });
  }
}
