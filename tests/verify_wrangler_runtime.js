/**
 * CraftIndex Final Cloudflare Pages Runtime Integration & Release Gate Test Suite
 * Tests against real Wrangler Pages dev server on http://127.0.0.1:8788 and Chrome CDP
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CdpBrowser = require('./cdp_browser');

const WRANGLER_PORT = 8788;
const BASE_URL = `http://127.0.0.1:${WRANGLER_PORT}`;
const PAGES_DIR = path.join(__dirname, '..', 'dist', 'pages');

const AUTH_BIGGER_IMAGE_HASH = '5DE0A67F6066D1C0FA5C2D538E5904260BD5E802124FB2BD1D9D5E44EADCC3CC';
const AUTH_LOGO_HASH = '9EE52C8624532B8992F0C63A248516EBA60290B4DC7763E5A48A79C88C0BA22D';

let passed = 0;
let failed = 0;
const results = [];

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${description} ${details}`);
    results.push({ test: description, status: 'PASS', details });
  } else {
    failed++;
    console.error(`❌ FAIL: ${description} ${details}`);
    results.push({ test: description, status: 'FAIL', details });
  }
}

function noteBlocked(description, reason) {
  console.log(`⚠️ BLOCKED: ${description} (${reason})`);
  results.push({ test: description, status: 'BLOCKED', details: reason });
}

function computeSha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function runSuite() {
  console.log('====================================================');
  console.log('CraftIndex Cloudflare Pages Runtime Integration Gate');
  console.log('Target Server:', BASE_URL);
  console.log('====================================================\n');

  // -----------------------------------------------------------------
  // 1. Verify Cloudflare Pages Function Invocation Rules (_routes.json)
  // -----------------------------------------------------------------
  console.log('--- 1. Function Invocation Rules (_routes.json) ---');
  const routesJsonPath = path.join(PAGES_DIR, '_routes.json');
  assert('dist/pages/_routes.json exists', fs.existsSync(routesJsonPath));
  if (fs.existsSync(routesJsonPath)) {
    const rCfg = JSON.parse(fs.readFileSync(routesJsonPath, 'utf-8'));
    assert('_routes.json has version: 1', rCfg.version === 1);
    assert('_routes.json include array contains only "/api/*"', Array.isArray(rCfg.include) && rCfg.include.length === 1 && rCfg.include[0] === '/api/*');
    assert('_routes.json exclude array is empty', Array.isArray(rCfg.exclude) && rCfg.exclude.length === 0);
  }

  // -----------------------------------------------------------------
  // 2. Static Routes & Asset Routing through Wrangler Pages
  // -----------------------------------------------------------------
  console.log('\n--- 2. Static Routes & Asset Routing (Wrangler Runtime) ---');
  const staticRouteChecks = [
    { path: '/', titlePart: 'CraftIndex | Minecraft Resource Discovery' },
    { path: '/mods/', titlePart: 'Minecraft Mods' },
    { path: '/mods/fabric/', titlePart: 'Fabric Mods' },
    { path: '/studio/', titlePart: 'Pack Studio' },
    { path: '/docs/', titlePart: 'CraftIndex Documentation' }
  ];

  for (const s of staticRouteChecks) {
    const res = await fetch(`${BASE_URL}${s.path}`);
    const html = await res.text();
    assert(`Static route ${s.path} returns HTTP 200`, res.status === 200);
    assert(`Static route ${s.path} has text/html Content-Type`, (res.headers.get('content-type') || '').includes('text/html'));
    assert(`Static route ${s.path} contains correct title`, html.includes(s.titlePart), `(found: ${html.match(/<title>(.*?)<\/title>/)?.[1] || ''})`);
    assert(`Static route ${s.path} has <base href="/">`, html.includes('<base href="/" />') || html.includes('<base href="/">'));
  }

  // Assets
  const assetChecks = [
    { path: '/css/styles.css', mime: 'text/css' },
    { path: '/js/app.js', mime: 'application/javascript' },
    { path: '/images/favicon.svg', mime: 'image/svg+xml' },
    { path: '/images/favicon-32x32.png', mime: 'image/png' },
    { path: '/favicon.ico', mime: 'image/' },
    { path: '/images/bigger-image.png', mime: 'image/png', expectedHash: AUTH_BIGGER_IMAGE_HASH },
    { path: '/images/craftindex-logo.png', mime: 'image/png', expectedHash: AUTH_LOGO_HASH }
  ];

  for (const a of assetChecks) {
    const res = await fetch(`${BASE_URL}${a.path}`);
    assert(`Asset ${a.path} returns HTTP 200`, res.status === 200);
    const ct = res.headers.get('content-type') || '';
    assert(`Asset ${a.path} matches MIME type ${a.mime}`, ct.includes(a.mime), `(got: ${ct})`);
    if (a.expectedHash) {
      const buf = Buffer.from(await res.arrayBuffer());
      const hash = computeSha256(buf);
      assert(`Asset ${a.path} cryptographic SHA-256 match`, hash === a.expectedHash, `(got: ${hash.slice(0, 16)}...)`);
    }
  }

  // Redirects
  console.log('\n--- 3. Canonical Redirects (_redirects) ---');
  const redirectChecks = ['/presets', '/history', '/settings'];
  for (const r of redirectChecks) {
    const res = await fetch(`${BASE_URL}${r}`, { redirect: 'manual' });
    assert(`Redirect ${r} returns HTTP 301`, res.status === 301);
    assert(`Redirect ${r} points to Location: /`, res.headers.get('location') === '/');
  }

  // 404 Response
  console.log('\n--- 4. Custom Branded 404 Behavior ---');
  const missingRes = await fetch(`${BASE_URL}/non-existent-test-path-12345`);
  const missingHtml = await missingRes.text();
  assert('Non-existent route returns HTTP 404', missingRes.status === 404);
  assert('404 response serves custom branded 404.html', missingHtml.includes('404 &mdash; Resource Not Found') || missingHtml.includes('Page Not Found'));

  // -----------------------------------------------------------------
  // 5. Pages Function Integrations & Discrepancy Audits
  // -----------------------------------------------------------------
  console.log('\n--- 5. Pages Functions Runtime & Security Audit ---');

  // /api/fetch Security & Proxy
  const modrinthRes = await fetch(`${BASE_URL}/api/fetch?url=${encodeURIComponent('https://api.modrinth.com/v2/search?query=sodium&limit=1')}`);
  assert('/api/fetch proxies whitelisted api.modrinth.com with HTTP 200', modrinthRes.status === 200);
  const modrinthData = await modrinthRes.json();
  assert('/api/fetch returns valid JSON payload from Modrinth', Array.isArray(modrinthData.hits));

  const evilRes = await fetch(`${BASE_URL}/api/fetch?url=${encodeURIComponent('https://unauthorized-evil-domain.com/data')}`);
  assert('/api/fetch strictly rejects non-whitelisted domain with HTTP 403', evilRes.status === 403);

  const ssrfRes1 = await fetch(`${BASE_URL}/api/fetch?url=${encodeURIComponent('http://127.0.0.1:3000/server.js')}`);
  assert('/api/fetch rejects loopback IPv4 (127.0.0.1) with HTTP 403', ssrfRes1.status === 403);

  const ssrfRes2 = await fetch(`${BASE_URL}/api/fetch?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data')}`);
  assert('/api/fetch rejects AWS metadata IP (169.254.169.254) with HTTP 403', ssrfRes2.status === 403);

  // Sponge Ore API (Discrepancy Resolution: ore.spongepowered.org vs api.spongepowered.org)
  const spongeRes = await fetch(`${BASE_URL}/api/sponge/projects?limit=1`);
  assert('/api/sponge/projects proxies to verified ore.spongepowered.org with HTTP 200', spongeRes.status === 200);
  const spongeData = await spongeRes.json();
  assert('/api/sponge returns valid projects list from Ore API v2', Array.isArray(spongeData.result));

  // PaperMC Hangar API
  const hangarRes = await fetch(`${BASE_URL}/api/hangar/projects?limit=1`);
  assert('/api/hangar/projects proxies to hangar.papermc.io with HTTP 200', hangarRes.status === 200);
  const hangarData = await hangarRes.json();
  assert('/api/hangar returns valid projects list', Array.isArray(hangarData.result));

  // Spiget API
  const spigetRes = await fetch(`${BASE_URL}/api/spiget/resources?size=1`);
  assert('/api/spiget/resources proxies to api.spiget.org with HTTP 200', spigetRes.status === 200);
  const spigetData = await spigetRes.json();
  assert('/api/spiget returns valid resources list', Array.isArray(spigetData));

  // Polymart API
  const polymartRes = await fetch(`${BASE_URL}/api/polymart/search?limit=1`);
  assert('/api/polymart/search proxies to api.polymart.org with HTTP 200', polymartRes.status === 200);
  const polymartData = await polymartRes.json();
  assert('/api/polymart returns valid search response', polymartData.response && Array.isArray(polymartData.response.result));

  // Smithed API
  const smithedRes = await fetch(`${BASE_URL}/api/smithed/packs?limit=1`);
  assert('/api/smithed/packs proxies to api.smithed.dev with HTTP 200', smithedRes.status === 200);
  const smithedData = await smithedRes.json();
  assert('/api/smithed returns valid pack array', Array.isArray(smithedData));

  // GitHub Proxy
  const githubUserRes = await fetch(`${BASE_URL}/api/github/users/ArataInlooker`);
  assert('/api/github/users/ArataInlooker proxies to api.github.com with HTTP 200', githubUserRes.status === 200);
  const ghUser = await githubUserRes.json();
  assert('/api/github returns valid GitHub user metadata', ghUser.login === 'ArataInlooker');

  // CurseForge Proxy
  const cfRes = await fetch(`${BASE_URL}/api/curseforge/v1/mods/search?gameId=432&pageSize=1`);
  assert('/api/curseforge handles request cleanly without crashing', cfRes.status === 200);
  const cfData = await cfRes.json();
  assert('/api/curseforge returns data envelope', Array.isArray(cfData.data));

  // Check credential status
  if (!process.env.CF_KEY && !process.env.CURSEFORGE_API_KEY) {
    noteBlocked('CurseForge authenticated API key live querying', 'No CF_KEY / CURSEFORGE_API_KEY provided in local environment. Production Cloudflare environment variable required.');
  }
  if (!process.env.GITHUB_TOKEN) {
    noteBlocked('GitHub authenticated API token querying', 'No GITHUB_TOKEN provided in local environment. Unauthenticated public rate limit active.');
  }

  // -----------------------------------------------------------------
  // 6. Chrome CDP Minimal Regression & User Interaction Verification
  // -----------------------------------------------------------------
  console.log('\n--- 6. Chrome CDP Real Browser Functional Verification ---');
  const cdp = new CdpBrowser({
    port: 9338,
    userDataDir: path.join(__dirname, '..', '.test_profile_wrangler')
  });

  try {
    await cdp.launch();
    await cdp.setViewport({ width: 1440, height: 900 });

    // 6a. Home Load & Header Brand Navigation
    await cdp.navigate(`${BASE_URL}/mods/fabric/`);
    await new Promise(r => setTimeout(r, 1200));

    const fabricNav = await cdp.evaluate(`
      (() => {
        return {
          pathname: window.location.pathname,
          tab: document.body.dataset.tab,
          title: document.title,
          hasLg: Boolean(document.getElementById('lg'))
        };
      })()
    `);
    assert('Chrome CDP loads /mods/fabric/ with correct title', fabricNav.title.includes('Fabric Mods'));
    assert('Header logo #lg is present', fabricNav.hasLg);

    // Click #lg to return to Home
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));

    const homeNav = await cdp.evaluate(`
      (() => {
        return {
          pathname: window.location.pathname,
          tab: document.body.dataset.tab
        };
      })()
    `);
    assert('Clicking header logo navigates back to "/"', homeNav.pathname === '/' || homeNav.pathname === '');
    assert('Active tab switches back to "home"', homeNav.tab === 'home');

    // 6b. Resource Search Execution through Pages Function on /mods/
    await cdp.navigate(`${BASE_URL}/mods/`);
    await new Promise(r => setTimeout(r, 2000));

    await cdp.evaluate(`
      (() => {
        const inp = document.getElementById('q');
        inp.value = 'sodium';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    // Wait longer for debounce (350ms) + API round-trip through Wrangler Pages proxy
    await new Promise(r => setTimeout(r, 5000));

    const searchRender = await cdp.evaluate(`
      (() => {
        const cards = document.querySelectorAll('.cd');
        return {
          count: cards.length,
          firstTitle: cards[0]?.querySelector('h3 a')?.textContent || '',
          firstAuthor: cards[0]?.querySelector('.by')?.textContent || ''
        };
      })()
    `);
    assert('Search query through Pages Function renders resource cards in DOM', searchRender.count > 0, `(rendered: ${searchRender.count} cards, first: "${searchRender.firstTitle}" ${searchRender.firstAuthor})`);

    // 6c. Pack Studio & IndexedDB Storage Verification
    await cdp.navigate(`${BASE_URL}/studio/`);
    await new Promise(r => setTimeout(r, 1200));

    const studioState = await cdp.evaluate(`
      (async () => {
        if (typeof window.ensurePackStudio === 'function') {
          try { await window.ensurePackStudio(); } catch (_) {}
        }
        return {
          tab: document.body.dataset.tab,
          hasStudio: typeof window.CraftIndexStudio !== 'undefined',
          hasJSZip: typeof window.JSZip !== 'undefined'
        };
      })()
    `);
    assert('Pack Studio view initializes and exposes CraftIndexStudio', studioState.tab === 'studio' && studioState.hasStudio);
    assert('Local JSZip vendor library is loaded and accessible', studioState.hasJSZip);

    // Test IndexedDB binary read/write & ZIP packaging round-trip
    const zipRoundtrip = await cdp.evaluate(`
      (async () => {
        try {
          const S = window.CraftIndexStudio;
          const testBin = {
            id: 'test_release_bin',
            name: 'release-test-mod.jar',
            category: 'mods',
            loader: 'Fabric',
            hash: '4a6b28373b9e4407886a1f33f99336d3393437fa05a2efb3bfb6b669e2c6cfb1',
            size: 24,
            blob: new Blob(['CraftIndex Release Test Binary Data'], { type: 'application/java-archive' })
          };

          // 1. Put in IndexedDB
          await S.idbPutBinary(testBin);
          const retrieved = await S.idbGetBinary('test_release_bin');
          if (!retrieved || retrieved.name !== 'release-test-mod.jar') {
            return { success: false, error: 'IndexedDB retrieval mismatch' };
          }

          // 2. Export Collection ZIP
          window.cart = new Map();
          window.cart.set('test_release_bin', {
            id: 'test_release_bin',
            title: 'Release Test Mod',
            tab: 'mods',
            loader: 'Fabric',
            ver: '1.0.0',
            isLocal: true,
            storedBinaryId: 'test_release_bin'
          });

          const exportResult = await S.exportCollectionZip({
            packName: 'ReleaseGatePack',
            mcVersion: '1.20.1',
            modLoader: 'fabric'
          });

          if (!exportResult || !exportResult.blob) {
            return { success: false, error: 'Export failed to produce ZIP blob' };
          }

          // 3. Inspect generated ZIP with JSZip
          const zip = await window.JSZip.loadAsync(exportResult.blob);
          const manifestFile = zip.file('craftindex_manifest.json');
          const modFile = zip.file('mods/Release_Test_Mod.jar') || zip.file('mods/release-test-mod.jar');

          if (!manifestFile || !modFile) {
            return { success: false, error: 'ZIP missing manifest or mod file' };
          }

          const manifestJson = JSON.parse(await manifestFile.async('text'));

          // Clean up test binary
          await S.idbDeleteBinary('test_release_bin');
          window.cart.clear();

          return {
            success: true,
            manifestName: manifestJson.pack_name,
            resourcesCount: manifestJson.resources ? manifestJson.resources.length : 0,
            hasModFile: Boolean(modFile),
            zipSizeBytes: exportResult.blob.size
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })()
    `);

    assert('IndexedDB binary persistence and ZIP export round-trip verified', zipRoundtrip.success, `(pack: "${zipRoundtrip.manifestName}", resources: ${zipRoundtrip.resourcesCount}, size: ${zipRoundtrip.zipSizeBytes} bytes)`);

    // 6d. About Docs Center
    await cdp.navigate(`${BASE_URL}/docs/`);
    await new Promise(r => setTimeout(r, 1200));
    const docsLoaded = await cdp.evaluate(`
      (() => {
        const standalone = document.getElementById('standaloneDocsView');
        return {
          title: document.title,
          hasStandalone: Boolean(standalone),
          isVisible: standalone ? standalone.style.display !== 'none' : false,
          length: standalone ? standalone.textContent.length : 0
        };
      })()
    `);
    assert('Docs Center renders comprehensive standalone documentation on /docs/', docsLoaded.hasStandalone && docsLoaded.isVisible && docsLoaded.length > 5000, `(chars: ${docsLoaded.length})`);

    // 6e. Test Header Docs Button Modal
    await cdp.navigate(`${BASE_URL}/`);
    await new Promise(r => setTimeout(r, 1500));
    await cdp.evaluate(`
      (() => {
        const btn = document.getElementById('ab');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));
    const modalOpened = await cdp.evaluate(`
      (() => {
        const modal = document.getElementById('aboutModal');
        return {
          hasModal: Boolean(modal),
          isOpen: modal ? modal.classList.contains('open') : false
        };
      })()
    `);
    assert('Toolbar Docs button activates About Center modal', modalOpened.hasModal && modalOpened.isOpen);

  } finally {
    await cdp.close();
  }

  // -----------------------------------------------------------------
  // Suite Completion Summary
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`INTEGRATION SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
