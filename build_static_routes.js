/**
 * CraftIndex Static Route Pre-renderer
 * Generates pre-rendered HTML files for all 18 authoritative routes
 * for deployment to static web hosts (Cloudflare Pages, Netlify, Vercel, S3).
 */

const fs = require('fs');
const path = require('path');
const { ROUTE_CONFIG, injectRouteHtml } = require('./route_metadata');

const ROOT_DIR = __dirname;
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'static_routes');

function buildStaticRoutes() {
  console.log('🚀 Building static pre-rendered routes...');
  const rawHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  let count = 0;
  for (const [routeKey, cfg] of Object.entries(ROUTE_CONFIG)) {
    const cleanPath = cfg.canonicalPath; // e.g. '/', '/studio/', '/mods/fabric/'
    const renderedHtml = injectRouteHtml(rawHtml, cleanPath);

    // Determine target file path
    let targetFile;
    if (cleanPath === '/') {
      targetFile = path.join(DIST_DIR, 'index.html');
    } else {
      const relPath = cleanPath.replace(/^\/+|\/+$/g, '');
      const targetDir = path.join(DIST_DIR, relPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      targetFile = path.join(targetDir, 'index.html');
    }

    fs.writeFileSync(targetFile, renderedHtml, 'utf-8');
    console.log(`  ✓ Pre-rendered: ${cleanPath.padEnd(20)} -> ${path.relative(ROOT_DIR, targetFile)} (${(renderedHtml.length / 1024).toFixed(1)} KB)`);
    count++;
  }

  console.log(`✅ Pre-rendered all ${count} authoritative routes into dist/static_routes/ successfully!\n`);
}

if (require.main === module) {
  buildStaticRoutes();
}

module.exports = { buildStaticRoutes };
