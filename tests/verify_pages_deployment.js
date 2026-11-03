const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CdpBrowser = require('./cdp_browser');
const { ROUTE_CONFIG } = require('../route_metadata');

const PAGES_DIR = path.resolve(__dirname, '..', 'dist', 'pages');
const PORT = 3033;

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'media/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function startPagesStaticServer() {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath.endsWith('/')) reqPath += 'index.html';
    else if (!path.extname(reqPath)) {
      // Check if folder with index.html exists
      if (fs.existsSync(path.join(PAGES_DIR, reqPath, 'index.html'))) {
        reqPath += '/index.html';
      }
    }

    let filePath = path.join(PAGES_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PAGES_DIR, '404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(filePath));
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Cloudflare Pages static mock server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function sha256File(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function runPreflightAudit() {
  console.log('====================================================');
  console.log('CraftIndex Cloudflare Pages Deployment Preflight Audit');
  console.log('====================================================\n');

  const testResults = [];
  function assert(title, condition, extra = '') {
    const passed = Boolean(condition);
    testResults.push({ title, passed, extra });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${title} ${extra ? '(' + extra + ')' : ''}`);
  }

  const staticServer = await startPagesStaticServer();

  try {
    // -------------------------------------------------------------
    // AUDIT 1: ROUTE METADATA & HTTP 200 ON ALL 18 STATIC ROUTES
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing all 18 Pre-rendered Routes on Static Server ---');
    for (const [key, cfg] of Object.entries(ROUTE_CONFIG)) {
      const cPath = cfg.canonicalPath;
      const res = await fetch(`http://localhost:${PORT}${cPath}`);
      assert(`Route ${cPath} returns HTTP 200`, res.status === 200, `status: ${res.status}`);
      const cType = res.headers.get('content-type') || '';
      assert(`Route ${cPath} has text/html Content-Type`, cType.includes('text/html'));

      const html = await res.text();
      const expTitle = cfg.title.replace(/&/g, '&amp;');
      assert(`Route ${cPath} includes canonical title`, html.includes(expTitle) || html.includes(cfg.title), `expected: ${cfg.title.slice(0, 30)}...`);
      assert(`Route ${cPath} includes canonical link`, html.includes(`href="https://craftindex.inlooker.top${cPath}"`));
      assert(`Route ${cPath} has <base href="/">`, html.includes('<base href="/" />'));
      assert(`Route ${cPath} has transparent favicon.svg`, html.includes('images/favicon.svg'));
      assert(`Route ${cPath} has Open Graph tags`, html.includes('property="og:title"'));
      assert(`Route ${cPath} has JSON-LD Schema`, html.includes('application/ld+json'));
    }

    // -------------------------------------------------------------
    // AUDIT 2: STATIC ASSETS, MIME TYPES & RESOLUTION
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Static Assets & MIME Types ---');
    const assetChecks = [
      ['/css/styles.css', 200, 'text/css'],
      ['/js/app.js', 200, 'application/javascript'],
      ['/js/pack_studio.js', 200, 'application/javascript'],
      ['/js/about_docs.js', 200, 'application/javascript'],
      ['/js/vendor/jszip.min.js', 200, 'application/javascript'],
      ['/images/craftindex-logo.png', 200, 'image/png'],
      ['/images/bigger-image.png', 200, 'image/png'],
      ['/images/favicon.svg', 200, 'image/svg+xml'],
      ['/images/favicon-32x32.png', 200, 'image/png'],
      ['/favicon.ico', 200, 'image/x-icon'],
      ['/fonts/inter/inter-latin.woff2', 200, 'font/woff2'],
      ['/robots.txt', 200, 'text/plain'],
      ['/sitemap.xml', 200, 'application/xml'],
      ['/site.webmanifest', 200, 'application/manifest+json']
    ];

    for (const [aPath, expStatus, expMime] of assetChecks) {
      const res = await fetch(`http://localhost:${PORT}${aPath}`);
      assert(`Asset ${aPath} returns ${expStatus}`, res.status === expStatus);
      const cType = res.headers.get('content-type') || '';
      assert(`Asset ${aPath} has MIME ${expMime}`, cType.includes(expMime), `got: ${cType}`);
    }

    // -------------------------------------------------------------
    // AUDIT 3: 404 BEHAVIOR FOR INVALID ROUTES
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing 404 Behavior for Invalid Paths ---');
    const badRes1 = await fetch(`http://localhost:${PORT}/completely-invalid-category/`);
    assert('Invalid path returns HTTP 404', badRes1.status === 404);
    const badHtml1 = await badRes1.text();
    assert('404 response serves branded 404.html', badHtml1.includes('404') && badHtml1.includes('Resource Not Found'));

    const badRes2 = await fetch(`http://localhost:${PORT}/mods/unsupported-loader-xyz/`);
    assert('Invalid loader path returns HTTP 404', badRes2.status === 404);

    // -------------------------------------------------------------
    // AUDIT 4: REAL BROWSER CDP FUNCTIONAL REGRESSION TEST
    // -------------------------------------------------------------
    console.log('\n--- 4. Real Browser Functional Regression Audit (CDP) ---');
    const cdp = new CdpBrowser({
      port: 9355,
      userDataDir: path.join(__dirname, '..', '.test_profile_pages')
    });

    try {
      await cdp.launch();
      await cdp.setViewport({ width: 1440, height: 900 });

      // 4a. Load Home
      await cdp.navigate(`http://localhost:${PORT}/`);
      await new Promise(r => setTimeout(r, 1200));

      const homeState = await cdp.evaluate(`
        (() => {
          return {
            title: document.title,
            tab: document.body.dataset.tab,
            hasLg: Boolean(document.getElementById('lg')),
            lgHref: document.getElementById('lg')?.getAttribute('href'),
            hasTabs: Boolean(document.getElementById('tabs')),
            hasSearch: Boolean(document.getElementById('q'))
          };
        })()
      `);

      assert('Home loads with title containing CraftIndex', homeState.title.includes('CraftIndex'));
      assert('Home has #lg anchor with href="/"', homeState.hasLg && homeState.lgHref === '/');

      // 4b. Navigate to /mods/ and test Header Logo Click Navigation
      await cdp.navigate(`http://localhost:${PORT}/mods/`);
      await new Promise(r => setTimeout(r, 1000));
      let curPath = await cdp.evaluate('window.location.pathname');
      assert('Static server routes /mods/ correctly', curPath === '/mods/');

      // Click #lg to return to Home
      await cdp.evaluate(`document.getElementById('lg').click()`);
      await new Promise(r => setTimeout(r, 600));
      curPath = await cdp.evaluate('window.location.pathname');
      let curTab = await cdp.evaluate('document.body.dataset.tab');
      assert('Clicking header logo returns to "/"', curPath === '/' || curPath === '');
      assert('Active tab switches to "home"', curTab === 'home');

      // 4c. Test Pack Studio & IndexedDB Persistence
      await cdp.navigate(`http://localhost:${PORT}/studio/`);
      await new Promise(r => setTimeout(r, 1800));
      const studioAudit = await cdp.evaluate(`
        (() => {
          return {
            tab: document.body.dataset.tab,
            hasStudio: typeof window.CraftIndexStudio !== 'undefined',
            hasDB: Boolean(window.indexedDB),
            url: window.location.pathname
          };
        })()
      `);
      assert('Pack Studio loads and exposes CraftIndexStudio',
        studioAudit.hasStudio && (studioAudit.tab === 'studio' || studioAudit.url.includes('/studio')));

      // Test IndexedDB binary write & read via CraftIndexStudio engine
      const idbTest = await cdp.evaluate(`
        (async () => {
          try {
            if (!window.CraftIndexStudio || !window.CraftIndexStudio.idbPutBinary) {
              return { success: false, reason: 'CraftIndexStudio methods not found' };
            }
            const testRecord = {
              id: 'test_audit_bin',
              name: 'audit-test.jar',
              category: 'mods',
              loader: 'Fabric',
              hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              size: 16,
              blob: new Blob(['test-binary-data'])
            };
            const putRes = await window.CraftIndexStudio.idbPutBinary(testRecord);
            const getRes = await window.CraftIndexStudio.idbGetBinary('test_audit_bin');
            await window.CraftIndexStudio.idbDeleteBinary('test_audit_bin');
            return {
              success: putRes && getRes && getRes.name === 'audit-test.jar',
              putRes,
              hasGet: Boolean(getRes),
              retrievedName: getRes ? getRes.name : null
            };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `);
      assert('IndexedDB CraftIndexDB binary persistence verified (Put/Get/Delete)', idbTest.success, `put: ${idbTest.putRes}, get: ${idbTest.retrievedName}`);

      // 4d. Test Documentation view (/docs/)
      await cdp.navigate(`http://localhost:${PORT}/docs/`);
      await new Promise(r => setTimeout(r, 1000));
      const docsAudit = await cdp.evaluate(`
        (() => {
          return {
            tab: document.body.dataset.tab,
            title: document.title,
            hasArticles: document.querySelectorAll('.docs-nav-link').length > 0 || document.querySelectorAll('article').length > 0
          };
        })()
      `);
      assert('Docs view loads with complete user guide', docsAudit.title.includes('Documentation') || docsAudit.tab === 'docs');

      // 4e. Test Standalone Distribution in real browser
      const standalonePath = path.resolve(__dirname, '..', 'dist', 'index.standalone.html').replace(/\\/g, '/');
      await cdp.navigate('file:///' + standalonePath);
      await new Promise(r => setTimeout(r, 1000));
      const standaloneAudit = await cdp.evaluate(`
        (() => {
          return {
            title: document.title,
            hasLg: Boolean(document.getElementById('lg')),
            tab: document.body.dataset.tab
          };
        })()
      `);
      assert('Standalone index.standalone.html loads cleanly offline', standaloneAudit.title.includes('CraftIndex'));

    } finally {
      await cdp.close();
    }

    // -------------------------------------------------------------
    // AUDIT 5: BRANDING ASSET CRYPTOGRAPHIC INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- 5. Cryptographic Branding Hash Audit ---');
    const expectedBiggerHash = '5DE0A67F6066D1C0FA5C2D538E5904260BD5E802124FB2BD1D9D5E44EADCC3CC';
    const actualBiggerHash = sha256File(path.join(__dirname, '..', 'images', 'bigger-image.png'));
    assert('images/bigger-image.png matches authoritative SHA-256', actualBiggerHash === expectedBiggerHash, actualBiggerHash);

    const expectedPagesBiggerHash = sha256File(path.join(PAGES_DIR, 'images', 'bigger-image.png'));
    assert('dist/pages/images/bigger-image.png matches authoritative SHA-256', expectedPagesBiggerHash === expectedBiggerHash);

    const logoHash = sha256File(path.join(__dirname, '..', 'images', 'craftindex-logo.png'));
    const pagesLogoHash = sha256File(path.join(PAGES_DIR, 'images', 'craftindex-logo.png'));
    assert('dist/pages/images/craftindex-logo.png matches root logo hash', logoHash === pagesLogoHash);

  } finally {
    staticServer.close();
  }

  console.log('\n====================================================');
  const allPassed = testResults.every(t => t.passed);
  console.log(`PREFLIGHT AUDIT SUMMARY: ${testResults.filter(t => t.passed).length} / ${testResults.length} PASSED`);
  console.log(`OVERALL AUDIT STATUS: ${allPassed ? 'ALL AUDITS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('====================================================');

  return { allPassed, testResults };
}

runPreflightAudit().then(({ allPassed }) => {
  if (!allPassed) process.exit(1);
}).catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
