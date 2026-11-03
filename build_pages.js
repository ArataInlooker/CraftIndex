/**
 * CraftIndex Cloudflare Pages Deployment Compiler
 * Compiles a self-contained, production-ready static output into dist/pages/
 * containing all 18 pre-rendered routes, static assets, 404 handler, and configuration.
 */

const fs = require('fs');
const path = require('path');
const { ROUTE_CONFIG, injectRouteHtml } = require('./route_metadata');

const ROOT_DIR = __dirname;
const PAGES_DIR = path.join(ROOT_DIR, 'dist', 'pages');
const STATIC_ROUTES_DIR = path.join(ROOT_DIR, 'dist', 'static_routes');
const RAW_INDEX_PATH = path.join(ROOT_DIR, 'index.html');

const IGNORE_PATTERNS = ['.bak', '.tmp', '.old', '.DS_Store', 'Thumbs.db', 'desktop.ini'];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const baseName = path.basename(src);
  if (IGNORE_PATTERNS.some(p => baseName.endsWith(p))) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      if (IGNORE_PATTERNS.some(p => file.endsWith(p))) continue;
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function buildPages() {
  console.log('====================================================');
  console.log('Building Cloudflare Pages Static Deployment Output');
  console.log('====================================================\n');

  // 1. Prepare dist/pages directory
  if (fs.existsSync(PAGES_DIR)) {
    fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PAGES_DIR, { recursive: true });

  const rawHtml = fs.readFileSync(RAW_INDEX_PATH, 'utf-8');

  // 2. Pre-render all 18 authoritative routes
  console.log('1. Pre-rendering all 18 authoritative routes...');
  let routeCount = 0;
  for (const [routeKey, cfg] of Object.entries(ROUTE_CONFIG)) {
    const cleanPath = cfg.canonicalPath;
    const renderedHtml = injectRouteHtml(rawHtml, cleanPath);

    let targetFile;
    if (cleanPath === '/') {
      targetFile = path.join(PAGES_DIR, 'index.html');
    } else {
      const relPath = cleanPath.replace(/^\/+|\/+$/g, '');
      const targetDir = path.join(PAGES_DIR, relPath);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      targetFile = path.join(targetDir, 'index.html');
    }

    fs.writeFileSync(targetFile, renderedHtml, 'utf-8');
    routeCount++;
  }
  console.log(`   ✓ Pre-rendered ${routeCount} HTML route documents.`);

  // 3. Copy production asset trees
  console.log('2. Copying static asset trees...');
  const ASSET_DIRS = ['css', 'js', 'fonts', 'images', 'media'];
  for (const d of ASSET_DIRS) {
    const srcPath = path.join(ROOT_DIR, d);
    const destPath = path.join(PAGES_DIR, d);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      console.log(`   ✓ Copied ${d}/`);
    } else {
      console.warn(`   ⚠️ Warning: Asset directory ${d}/ not found!`);
    }
  }

  // 4. Copy root static configuration files
  console.log('3. Copying root configuration & branding assets...');
  const ROOT_FILES = [
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
    '_redirects',
    '_routes.json',
    '404.html'
  ];

  for (const f of ROOT_FILES) {
    const srcFile = path.join(ROOT_DIR, f);
    const destFile = path.join(PAGES_DIR, f);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`   ✓ Copied ${f}`);
    } else {
      console.warn(`   ⚠️ Warning: Root file ${f} not found!`);
    }
  }

  // 5. Also synchronize legacy dist/static_routes for backwards compatibility
  if (fs.existsSync(STATIC_ROUTES_DIR)) {
    fs.rmSync(STATIC_ROUTES_DIR, { recursive: true, force: true });
  }
  copyRecursive(PAGES_DIR, STATIC_ROUTES_DIR);

  console.log('\n====================================================');
  console.log(`✅ Cloudflare Pages output ready at: dist/pages/`);
  console.log(`   Total pre-rendered routes: ${routeCount}`);
  console.log('====================================================\n');
}

if (require.main === module) {
  buildPages();
}

module.exports = { buildPages };
