/**
 * Cloudflare Pages Function: /api/curseforge/*
 * Reverse Proxy for api.curseforge.com with secret injection
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
};

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...SECURITY_HEADERS, 'Access-Control-Max-Age': '86400' }
    });
  }

  const reqUrl = new URL(request.url);
  const targetPath = reqUrl.pathname.replace('/api/curseforge', '') + reqUrl.search;
  const activeKey = request.headers.get('x-api-key') || env.CF_KEY || env.CURSEFORGE_API_KEY;

  if (!activeKey) {
    return new Response(JSON.stringify({
      data: [],
      pagination: { totalCount: 0, index: 0, pageSize: 0, resultCount: 0 }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
    });
  }

  const upstreamUrl = `https://api.curseforge.com${targetPath}`;
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('User-Agent', 'CraftIndex/2.6.1');
  headers.set('x-api-key', activeKey);

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.clone().arrayBuffer() : undefined,
      redirect: 'follow'
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
    return new Response(JSON.stringify({ error: 'CurseForge proxy error: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
    });
  }
}
