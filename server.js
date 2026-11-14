const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { injectRouteHtml } = require('./route_metadata');

const PORT = process.env.PORT || 3000;
const CF_KEY = process.env.CF_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.webmanifest']);

const VALID_APP_ROUTES = new Set([
  '',
  'studio',
  'docs',
  'mods',
  'resourcepacks',
  'shaders',
  'worlds',
  'plugins',
  'datapacks',
  'modpacks',
  'modloaders',
  'launchers',
  'serversoftwares',
  'presets',
  'history',
  'settings',
  'socials'
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';"
};

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

function isPrivateIpOrHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '169.254.169.254') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}

let spongeSession = null;
let spongeExpires = 0;

function getSpongeSession() {
  if (spongeSession && Date.now() < spongeExpires) {
    return Promise.resolve(spongeSession);
  }
  return new Promise((resolve, reject) => {
    const postReq = https.request({
      hostname: 'ore.spongepowered.org',
      path: '/api/v2/authenticate',
      method: 'POST',
      headers: { 'Content-Length': 0, 'User-Agent': 'CraftIndex' }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          const auth = JSON.parse(d);
          if (auth.session) {
            spongeSession = auth.session;
            spongeExpires = Date.now() + (auth.expiresIn ? auth.expiresIn * 1000 - 60000 : 3600000);
            resolve(spongeSession);
          } else {
            reject(new Error('No session returned from Sponge'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    postReq.on('error', reject);
    postReq.end();
  });
}

function sendProxyError(res, code, message) {
  if (!res.headersSent) {
    try {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    } catch (_) {}
  }
  if (!res.writableEnded) {
    try {
      res.end(JSON.stringify({ error: message }));
    } catch (_) {}
  }
}

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

const server = http.createServer((req, res) => {
  // CORS preflight support
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
    });
    return res.end();
  }

  // Strict Whitelisted /api/fetch Proxy Endpoint
  if (req.url.startsWith('/api/fetch')) {
    try {
      const u = new URL(req.url, `http://localhost:${PORT}`);
      const targetParam = u.searchParams.get('url');
      if (!targetParam) {
        return sendProxyError(res, 400, 'Missing url parameter');
      }

      let parsedTarget;
      try {
        parsedTarget = new URL(targetParam);
      } catch (_) {
        return sendProxyError(res, 400, 'Invalid destination URL format');
      }

      const targetHost = parsedTarget.hostname.toLowerCase();
      if (isPrivateIpOrHost(targetHost) || !WHITELISTED_HOSTS.has(targetHost)) {
        res.writeHead(403, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...SECURITY_HEADERS
        });
        return res.end(JSON.stringify({ error: `Forbidden: Host '${targetHost}' is not in the CraftIndex API whitelist.` }));
      }

      const targetProtocol = parsedTarget.protocol === 'https:' ? https : http;
      const proxyReq = targetProtocol.request(parsedTarget, {
        method: req.method,
        headers: {
          'User-Agent': 'CraftIndex/2.6.0 (https://craftindex.inlooker.top)',
          'Accept': req.headers['accept'] || '*/*'
        }
      }, (proxyRes) => {
        // Redirect security check
        if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
          try {
            const redirectUrl = new URL(proxyRes.headers.location, parsedTarget);
            const redirectHost = redirectUrl.hostname.toLowerCase();
            if (isPrivateIpOrHost(redirectHost) || !WHITELISTED_HOSTS.has(redirectHost)) {
              res.writeHead(403, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
              return res.end(JSON.stringify({ error: `Forbidden: Redirect destination '${redirectHost}' is not whitelisted.` }));
            }
          } catch (_) {
            return sendProxyError(res, 400, 'Malformed redirect location header');
          }
        }

        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*',
          ...SECURITY_HEADERS
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        sendProxyError(res, 502, 'Upstream connection error: ' + sanitizeError(err));
      });

      req.pipe(proxyReq);
      return;
    } catch (err) {
      return sendProxyError(res, 500, 'Internal proxy error: ' + sanitizeError(err));
    }
  }

  // Reverse proxy for CurseForge API
  if (req.url.startsWith('/api/curseforge/')) {
    const targetPath = req.url.replace('/api/curseforge', '');
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'CraftIndex'
    };
    const activeKey = req.headers['x-api-key'] || CF_KEY;
    if (!activeKey) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
      });
      return res.end(JSON.stringify({ data: [], pagination: { totalCount: 0, index: 0, pageSize: 0, resultCount: 0 } }));
    }
    headers['x-api-key'] = activeKey;

    const proxyReq = https.request({
      hostname: 'api.curseforge.com',
      path: targetPath,
      method: req.method,
      headers: headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      sendProxyError(res, 502, 'CurseForge proxy error: ' + sanitizeError(err));
    });

    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
    });

    req.pipe(proxyReq);
    return;
  }

  // Reverse proxy for Sponge Ore API v2 (automated session authentication)
  if (req.url.startsWith('/api/sponge/')) {
    const targetPath = '/api/v2' + req.url.replace('/api/sponge', '');
    getSpongeSession().then((sessionToken) => {
      const proxyReq = https.request({
        hostname: 'ore.spongepowered.org',
        path: targetPath,
        method: req.method,
        headers: {
          'Authorization': 'OreApi session=' + sessionToken,
          'Accept': 'application/json',
          'User-Agent': 'CraftIndex'
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (err) => {
        sendProxyError(res, 502, 'Sponge proxy error: ' + sanitizeError(err));
      });
      res.on('close', () => {
        if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
      });
      req.pipe(proxyReq);
    }).catch((err) => {
      sendProxyError(res, 502, 'Sponge auth error: ' + sanitizeError(err));
    });
    return;
  }

  // Reverse proxy for Hangar (PaperMC)
  if (req.url.startsWith('/api/hangar/')) {
    const targetPath = '/api/v1' + req.url.replace('/api/hangar', '');
    const proxyReq = https.request({
      hostname: 'hangar.papermc.io',
      path: targetPath,
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CraftIndex'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      sendProxyError(res, 502, 'Hangar proxy error: ' + sanitizeError(err));
    });
    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
    });
    req.pipe(proxyReq);
    return;
  }

  // Reverse proxy for Spiget (SpigotMC)
  if (req.url.startsWith('/api/spiget/')) {
    const targetPath = '/v2' + req.url.replace('/api/spiget', '');
    const proxyReq = https.request({
      hostname: 'api.spiget.org',
      path: targetPath,
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CraftIndex'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      sendProxyError(res, 502, 'Spiget proxy error: ' + sanitizeError(err));
    });
    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
    });
    req.pipe(proxyReq);
    return;
  }

  // Reverse proxy for Polymart API (Minecraft Plugins)
  if (req.url.startsWith('/api/polymart/')) {
    const targetPath = '/v1' + req.url.replace('/api/polymart', '');
    const proxyReq = https.request({
      hostname: 'api.polymart.org',
      path: targetPath,
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CraftIndex'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      sendProxyError(res, 502, 'Polymart proxy error: ' + sanitizeError(err));
    });
    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
    });
    req.pipe(proxyReq);
    return;
  }

  // Reverse proxy for Smithed API v2 (Minecraft Data Packs)
  if (req.url.startsWith('/api/smithed/')) {
    const targetPath = '/v2' + req.url.replace('/api/smithed', '');
    const proxyReq = https.request({
      hostname: 'api.smithed.dev',
      path: targetPath,
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CraftIndex'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      sendProxyError(res, 502, 'Smithed proxy error: ' + sanitizeError(err));
    });
    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
    });
    req.pipe(proxyReq);
    return;
  }

  // Reverse proxy for GitHub API (Minecraft Mods, Resource Packs, Shaders, Data Packs)
  if (req.url.startsWith('/api/github/')) {
    const targetPath = req.url.replace('/api/github', '');
    const proxyReq = https.request({
      hostname: 'api.github.com',
      path: targetPath,
      method: req.method,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CraftIndex/2.6.0 (https://craftindex.inlooker.top; aratainlooker@gmail.com)'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      sendProxyError(res, 502, 'GitHub proxy error: ' + sanitizeError(err));
    });
    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) proxyReq.destroy();
    });
    req.pipe(proxyReq);
    return;
  }

  // 1. Strict URL decoding and directory traversal protection
  let reqPath;
  try {
    reqPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    return res.end('400 Bad Request: Malformed URI');
  }

  // Reject null bytes, backslashes, or directory traversal tokens immediately
  if (reqPath.includes('\0') || reqPath.includes('\\') || reqPath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    return res.end('403 Forbidden: Invalid path characters or directory traversal detected');
  }

  const cleanPath = reqPath.replace(/^\/+/, '');
  const lowerClean = cleanPath.toLowerCase();

  // Strict Public Asset Whitelist Architecture
  const ALLOWED_ROOT_FILES = new Set([
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
    '_redirects'
  ]);

  const ALLOWED_ASSET_DIRS = {
    'css': new Set(['.css', '.map']),
    'js': new Set(['.js', '.map']),
    'images': new Set(['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp']),
    'fonts': new Set(['.woff2', '.woff', '.ttf']),
    'media': new Set(['.mp4', '.webm']),
    'dist': new Set(['.html'])
  };

  let filePath = null;
  let isDirectFile = false;

  if (cleanPath === '' || cleanPath === 'index.html') {
    filePath = path.resolve(__dirname, 'index.html');
    isDirectFile = true;
  } else if (ALLOWED_ROOT_FILES.has(lowerClean)) {
    filePath = path.resolve(__dirname, cleanPath);
    isDirectFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } else {
    // Check allowed asset subdirectories
    const parts = cleanPath.split('/');
    const topDir = parts[0].toLowerCase();
    if (ALLOWED_ASSET_DIRS[topDir]) {
      const ext = path.extname(cleanPath).toLowerCase();
      if (ALLOWED_ASSET_DIRS[topDir].has(ext)) {
        const candidatePath = path.resolve(__dirname, cleanPath);
        const expectedPrefix = path.resolve(__dirname, topDir) + path.sep;
        if (candidatePath.startsWith(expectedPrefix) && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          filePath = candidatePath;
          isDirectFile = true;
        }
      }
    }
  }

  // If not a whitelisted direct static file, resolve valid SPA application routes
  if (!isDirectFile) {
    const ext = path.extname(cleanPath).toLowerCase();
    // Static asset requests with extensions not found in whitelist must strictly 404
    if (ext) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      return res.end('404 Not Found');
    }

    const segments = cleanPath.split('/').filter(Boolean);
    const rootSegment = (segments[0] || '').toLowerCase();
    if (cleanPath === '' || VALID_APP_ROUTES.has(rootSegment)) {
      filePath = path.resolve(__dirname, 'index.html');
      isDirectFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } else {
      // Non-existent route strictly returns HTTP 404
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      return res.end('404 Not Found');
    }
  }

  if (isDirectFile) {
    const ext = path.extname(filePath).toLowerCase();

    // Dynamic HTML Route Shell & Meta Injection for Public App Routes
    if (ext === '.html') {
      try {
        const rawHtml = fs.readFileSync(filePath, 'utf-8');
        const customHtml = injectRouteHtml(rawHtml, cleanPath);
        const htmlBuffer = Buffer.from(customHtml, 'utf-8');
        const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();

        if (acceptEncoding.includes('gzip')) {
          const gzipped = zlib.gzipSync(htmlBuffer, { level: 6 });
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Encoding': 'gzip',
            'Content-Length': gzipped.length,
            'Vary': 'Accept-Encoding',
            'Cache-Control': 'no-cache',
            ...SECURITY_HEADERS
          });
          return res.end(gzipped);
        } else if (acceptEncoding.includes('deflate')) {
          const deflated = zlib.deflateSync(htmlBuffer);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Encoding': 'deflate',
            'Content-Length': deflated.length,
            'Vary': 'Accept-Encoding',
            'Cache-Control': 'no-cache',
            ...SECURITY_HEADERS
          });
          return res.end(deflated);
        } else {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': htmlBuffer.length,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            ...SECURITY_HEADERS
          });
          return res.end(htmlBuffer);
        }
      } catch (err) {
        console.error('Error serving dynamic HTML route:', err);
      }
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine cache policy
    let cacheControl = 'no-cache';
    if (cleanPath.startsWith('fonts/') || cleanPath.startsWith('images/') || cleanPath.startsWith('js/vendor/')) {
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (ext === '.css' || ext === '.js') {
      cacheControl = 'no-cache, must-revalidate';
    }

    // HTTP 206 Partial Content support for video streaming
    if (range && (ext === '.mp4' || ext === '.webm')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}`, ...SECURITY_HEADERS });
        return res.end();
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        ...SECURITY_HEADERS
      });
      stream.pipe(res);
      return;
    }

    // Compression support for text/code assets (gzip & deflate)
    const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();
    const canCompress = COMPRESSIBLE_EXTENSIONS.has(ext);

    if (canCompress && acceptEncoding.includes('gzip')) {
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding',
        'Cache-Control': cacheControl,
        ...SECURITY_HEADERS
      });
      const rawStream = fs.createReadStream(filePath);
      const gzipStream = zlib.createGzip({ level: 6 });
      rawStream.pipe(gzipStream).pipe(res);
      return;
    } else if (canCompress && acceptEncoding.includes('deflate')) {
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Content-Encoding': 'deflate',
        'Vary': 'Accept-Encoding',
        'Cache-Control': cacheControl,
        ...SECURITY_HEADERS
      });
      const rawStream = fs.createReadStream(filePath);
      const deflateStream = zlib.createDeflate();
      rawStream.pipe(deflateStream).pipe(res);
      return;
    }

    // Standard uncompressed stream
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      ...SECURITY_HEADERS
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('404 Not Found — Resource does not exist on CraftIndex');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n🌌 CraftIndex is ALREADY running and active at: http://localhost:${PORT}`);
    console.log(`You don't need to start it again — simply refresh your browser at http://localhost:${PORT}\n`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\n🌌 CraftIndex is running at: http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop.\n`);
});
