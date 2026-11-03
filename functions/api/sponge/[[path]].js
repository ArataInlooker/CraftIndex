/**
 * Cloudflare Pages Function: /api/sponge/*
 * Reverse Proxy for Sponge Ore API v2 (ore.spongepowered.org)
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

let spongeSession = null;
let spongeExpires = 0;

async function getSpongeSession() {
  if (spongeSession && Date.now() < spongeExpires) {
    return spongeSession;
  }
  const authRes = await fetch('https://ore.spongepowered.org/api/v2/authenticate', {
    method: 'POST',
    headers: { 'User-Agent': 'CraftIndex' }
  });
  if (!authRes.ok) throw new Error('Sponge auth failed: ' + authRes.status);
  const data = await authRes.json();
  if (data.session) {
    spongeSession = data.session;
    spongeExpires = Date.now() + (data.expiresIn ? data.expiresIn * 1000 - 60000 : 3600000);
    return spongeSession;
  }
  throw new Error('No session returned from Sponge');
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...SECURITY_HEADERS, 'Access-Control-Max-Age': '86400' }
    });
  }

  const reqUrl = new URL(request.url);
  const targetPath = '/api/v2' + reqUrl.pathname.replace('/api/sponge', '') + reqUrl.search;
  const upstreamUrl = `https://ore.spongepowered.org${targetPath}`;

  try {
    const sessionToken = await getSpongeSession();
    const headers = new Headers();
    headers.set('Authorization', 'OreApi session=' + sessionToken);
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
    return new Response(JSON.stringify({ error: 'Sponge proxy error: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
    });
  }
}
