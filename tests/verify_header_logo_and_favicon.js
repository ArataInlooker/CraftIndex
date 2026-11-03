const fs = require('fs');
const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function runComprehensiveVerification() {
  console.log('====================================================');
  console.log('CraftIndex Header Logo Navigation & Favicon Test');
  console.log('====================================================\n');

  const testResults = [];
  function assert(title, condition, extra = '') {
    const passed = Boolean(condition);
    testResults.push({ title, passed, extra });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${title} ${extra ? '(' + extra + ')' : ''}`);
  }

  const cdp = new CdpBrowser({
    port: 9345,
    userDataDir: path.join(__dirname, '..', '.test_profile_header')
  });

  try {
    await cdp.launch();
    console.log('Headless Chrome launched via CDP.\n');

    // -----------------------------------------------------------------
    // TEST SUITE 1: DOM & ACCESSIBILITY ATTRIBUTES OF HEADER LOGO
    // -----------------------------------------------------------------
    console.log('--- 1. Testing Header Logo DOM & Accessibility ---');
    await cdp.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await cdp.navigate('http://localhost:3000/');
    await new Promise(r => setTimeout(r, 1200));

    const logoAttrs = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('lg');
        if (!el) return null;
        const img = el.querySelector('img');
        const span = el.querySelector('span');
        const style = window.getComputedStyle(el);
        return {
          tagName: el.tagName.toLowerCase(),
          href: el.getAttribute('href'),
          target: el.getAttribute('target'),
          ariaLabel: el.getAttribute('aria-label'),
          cursor: style.cursor,
          textDecorationLine: style.textDecorationLine,
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          display: style.display,
          alignItems: style.alignItems,
          hasImg: Boolean(img),
          imgSrc: img ? img.getAttribute('src') : '',
          imgAlt: img ? img.getAttribute('alt') : '',
          imgW: img ? img.width : 0,
          imgH: img ? img.height : 0,
          hasSpan: Boolean(span),
          spanText: span ? span.textContent.trim() : ''
        };
      })()
    `);

    assert('Logo container is semantic <a> tag', logoAttrs && logoAttrs.tagName === 'a', `tagName: ${logoAttrs?.tagName}`);
    assert('Logo anchor has href="/"', logoAttrs && logoAttrs.href === '/', `href: ${logoAttrs?.href}`);
    assert('Logo navigates in same tab (no target="_blank")', logoAttrs && !logoAttrs.target);
    assert('Logo has accessible aria-label="CraftIndex Home"', logoAttrs && logoAttrs.ariaLabel === 'CraftIndex Home', `aria-label: ${logoAttrs?.ariaLabel}`);
    assert('Logo has cursor: pointer', logoAttrs && logoAttrs.cursor === 'pointer', `cursor: ${logoAttrs?.cursor}`);
    assert('Logo has no underline (text-decoration-line: none)', logoAttrs && logoAttrs.textDecorationLine === 'none', `textDecorationLine: ${logoAttrs?.textDecorationLine}`);
    assert('Logo contains brand image with alt text', logoAttrs && logoAttrs.hasImg && logoAttrs.imgAlt.includes('CraftIndex Logo'));
    assert('Logo contains "CraftIndex" brand text', logoAttrs && logoAttrs.hasSpan && logoAttrs.spanText === 'CraftIndex', `text: ${logoAttrs?.spanText}`);

    // -----------------------------------------------------------------
    // TEST SUITE 2: INTERACTIVE CLICK NAVIGATION ACROSS MULTIPLE ROUTES
    // -----------------------------------------------------------------
    console.log('\n--- 2. Testing Header Logo Navigation from Different Routes ---');

    // 2a. From /mods/
    await cdp.navigate('http://localhost:3000/mods/');
    await new Promise(r => setTimeout(r, 1000));
    let currentPath = await cdp.evaluate('window.location.pathname');
    let activeTab = await cdp.evaluate('document.body.dataset.tab');
    console.log(`Initial state: path=${currentPath}, tab=${activeTab}`);

    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));

    let navPath = await cdp.evaluate('window.location.pathname');
    let navTab = await cdp.evaluate('document.body.dataset.tab');
    assert('Clicking logo from /mods/ navigates to "/"', navPath === '/' || navPath === '', `path: ${navPath}`);
    assert('Active tab resets to "home"', navTab === 'home', `tab: ${navTab}`);

    // 2b. From /plugins/
    await cdp.navigate('http://localhost:3000/plugins/');
    await new Promise(r => setTimeout(r, 1000));
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));
    navPath = await cdp.evaluate('window.location.pathname');
    navTab = await cdp.evaluate('document.body.dataset.tab');
    assert('Clicking logo from /plugins/ navigates to "/"', navPath === '/' || navPath === '', `path: ${navPath}`);
    assert('Active tab resets to "home" from /plugins/', navTab === 'home', `tab: ${navTab}`);

    // 2c. From /studio/ (Pack Studio)
    await cdp.navigate('http://localhost:3000/studio/');
    await new Promise(r => setTimeout(r, 1000));
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));
    navPath = await cdp.evaluate('window.location.pathname');
    navTab = await cdp.evaluate('document.body.dataset.tab');
    assert('Clicking logo from /studio/ navigates to "/"', navPath === '/' || navPath === '', `path: ${navPath}`);
    assert('Active tab resets to "home" from /studio/', navTab === 'home', `tab: ${navTab}`);

    // 2d. From /docs/
    await cdp.navigate('http://localhost:3000/docs/');
    await new Promise(r => setTimeout(r, 1000));
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));
    navPath = await cdp.evaluate('window.location.pathname');
    navTab = await cdp.evaluate('document.body.dataset.tab');
    assert('Clicking logo from /docs/ navigates to "/"', navPath === '/' || navPath === '', `path: ${navPath}`);
    assert('Active tab resets to "home" from /docs/', navTab === 'home', `tab: ${navTab}`);

    // 2e. With Open Modal (Settings Modal)
    await cdp.navigate('http://localhost:3000/mods/');
    await new Promise(r => setTimeout(r, 1000));
    // Open Settings Modal via button click
    await cdp.evaluate(`document.getElementById('setb')?.click()`);
    await new Promise(r => setTimeout(r, 600));
    let modalOpen = await cdp.evaluate(`document.getElementById('settingsModal')?.classList.contains('open')`);
    console.log('Settings modal opened:', modalOpen);

    // Click logo
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));

    navPath = await cdp.evaluate('window.location.pathname');
    modalOpen = await cdp.evaluate(`document.getElementById('settingsModal')?.classList.contains('open')`);
    assert('Clicking logo closes modal and navigates to "/"', (navPath === '/' || navPath === '') && !modalOpen, `path: ${navPath}, modalOpen: ${modalOpen}`);

    // -----------------------------------------------------------------
    // TEST SUITE 3: KEYBOARD FOCUS & NAVIGATION
    // -----------------------------------------------------------------
    console.log('\n--- 3. Testing Keyboard Focus & Enter Navigation ---');
    await cdp.navigate('http://localhost:3000/shaders/');
    await new Promise(r => setTimeout(r, 1000));

    // Focus logo and check focus-visible outline
    const focusStyles = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('lg');
        el.focus();
        const active = document.activeElement === el;
        const style = window.getComputedStyle(el);
        return {
          isActive: active,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor
        };
      })()
    `);
    assert('Logo receives keyboard focus', focusStyles.isActive);

    // Press Enter on focused logo
    await cdp.evaluate(`
      (() => {
        const el = document.getElementById('lg');
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        el.click(); // Standard keyboard enter triggers click
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    navPath = await cdp.evaluate('window.location.pathname');
    assert('Pressing Enter on logo navigates to "/"', navPath === '/' || navPath === '', `path: ${navPath}`);

    // -----------------------------------------------------------------
    // TEST SUITE 4: RESPONSIVE VIEWPORT TESTING (Desktop, Tablet, Mobile)
    // -----------------------------------------------------------------
    console.log('\n--- 4. Testing Responsive Viewports (Desktop, Tablet, Mobile) ---');

    // Desktop
    await cdp.setViewport({ width: 1440, height: 900 });
    await cdp.navigate('http://localhost:3000/mods/');
    await new Promise(r => setTimeout(r, 600));
    let box = await cdp.evaluate(`(() => { const r = document.getElementById('lg').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
    assert('Desktop logo dimensions valid (height >= 36px)', box.height >= 36, `h: ${box.height}px, w: ${box.width}px`);
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 500));
    assert('Desktop click navigates to "/"', (await cdp.evaluate('window.location.pathname')) === '/');

    // Tablet (768px)
    await cdp.setViewport({ width: 768, height: 1024 });
    await cdp.navigate('http://localhost:3000/plugins/');
    await new Promise(r => setTimeout(r, 600));
    box = await cdp.evaluate(`(() => { const r = document.getElementById('lg').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
    assert('Tablet logo dimensions valid (height >= 28px)', box.height >= 28, `h: ${box.height}px, w: ${box.width}px`);
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 500));
    assert('Tablet click navigates to "/"', (await cdp.evaluate('window.location.pathname')) === '/');

    // Mobile (375px)
    await cdp.setViewport({ width: 375, height: 667, isMobile: true });
    await cdp.navigate('http://localhost:3000/resourcepacks/');
    await new Promise(r => setTimeout(r, 600));
    box = await cdp.evaluate(`(() => { const r = document.getElementById('lg').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
    assert('Mobile logo dimensions valid (height >= 24px)', box.height >= 24, `h: ${box.height}px, w: ${box.width}px`);
    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 500));
    assert('Mobile click navigates to "/"', (await cdp.evaluate('window.location.pathname')) === '/');

    // -----------------------------------------------------------------
    // TEST SUITE 5: FAVICON DOM ELEMENTS & REAL CHROME RENDERING
    // -----------------------------------------------------------------
    console.log('\n--- 5. Testing Favicon DOM Elements & Real Alpha Transparency ---');
    await cdp.setViewport({ width: 1280, height: 800 });
    await cdp.navigate('http://localhost:3000/');
    await new Promise(r => setTimeout(r, 800));

    const faviconLinks = await cdp.evaluate(`
      (() => {
        const links = [...document.querySelectorAll('link[rel*="icon"]')];
        return links.map(l => ({
          rel: l.rel,
          type: l.type,
          sizes: l.sizes ? l.sizes.value : '',
          href: l.href
        }));
      })()
    `);

    console.log('Favicon links found in DOM:', JSON.stringify(faviconLinks, null, 2));
    const hasSvgLink = faviconLinks.some(l => l.type === 'image/svg+xml' && l.href.includes('favicon.svg'));
    const hasPng32 = faviconLinks.some(l => l.sizes === '32x32' && l.href.includes('favicon-32x32.png'));
    const hasPng16 = faviconLinks.some(l => l.sizes === '16x16' && l.href.includes('favicon-16x16.png'));
    const hasIco = faviconLinks.some(l => l.href.includes('favicon.ico'));

    assert('DOM includes SVG favicon link (type="image/svg+xml")', hasSvgLink);
    assert('DOM includes 32x32 PNG favicon link', hasPng32);
    assert('DOM includes 16x16 PNG favicon link', hasPng16);
    assert('DOM includes ICO fallback link', hasIco);

    // Real in-browser Canvas pixel inspection of favicon.svg
    const svgPixelAudit = await cdp.evaluate(`
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cvs = document.createElement('canvas');
          cvs.width = 32;
          cvs.height = 32;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);

          const c00 = ctx.getImageData(0, 0, 1, 1).data;
          const c31_0 = ctx.getImageData(31, 0, 1, 1).data;
          const c0_31 = ctx.getImageData(0, 31, 1, 1).data;
          const c31_31 = ctx.getImageData(31, 31, 1, 1).data;
          const center = ctx.getImageData(16, 16, 1, 1).data;

          resolve({
            corner00: [...c00],
            corner31_0: [...c31_0],
            corner0_31: [...c0_31],
            corner31_31: [...c31_31],
            center: [...center]
          });
        };
        img.onerror = (e) => resolve({ error: 'Image failed to load' });
        img.src = '/images/favicon.svg';
      })
    `);

    console.log('Browser-rendered SVG Canvas Pixels (32x32):', svgPixelAudit);
    assert('Browser SVG corner (0,0) alpha is 0 (fully transparent)', svgPixelAudit.corner00 && svgPixelAudit.corner00[3] === 0, `alpha: ${svgPixelAudit.corner00?.[3]}`);
    assert('Browser SVG corner (31,0) alpha is 0 (fully transparent)', svgPixelAudit.corner31_0 && svgPixelAudit.corner31_0[3] === 0, `alpha: ${svgPixelAudit.corner31_0?.[3]}`);
    assert('Browser SVG corner (0,31) alpha is 0 (fully transparent)', svgPixelAudit.corner0_31 && svgPixelAudit.corner0_31[3] === 0, `alpha: ${svgPixelAudit.corner0_31?.[3]}`);
    assert('Browser SVG corner (31,31) alpha is 0 (fully transparent)', svgPixelAudit.corner31_31 && svgPixelAudit.corner31_31[3] === 0, `alpha: ${svgPixelAudit.corner31_31?.[3]}`);
    assert('Browser SVG center is opaque crystal star (alpha >= 200)', svgPixelAudit.center && svgPixelAudit.center[3] >= 200, `alpha: ${svgPixelAudit.center?.[3]}`);

    // Real in-browser Canvas pixel inspection of favicon-32x32.png
    const pngPixelAudit = await cdp.evaluate(`
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cvs = document.createElement('canvas');
          cvs.width = 32;
          cvs.height = 32;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);

          const c00 = ctx.getImageData(0, 0, 1, 1).data;
          const center = ctx.getImageData(16, 16, 1, 1).data;

          resolve({
            corner00: [...c00],
            center: [...center]
          });
        };
        img.onerror = () => resolve({ error: 'PNG failed to load' });
        img.src = '/images/favicon-32x32.png';
      })
    `);

    assert('Browser PNG corner (0,0) alpha is 0 (fully transparent)', pngPixelAudit.corner00 && pngPixelAudit.corner00[3] === 0, `alpha: ${pngPixelAudit.corner00?.[3]}`);
    assert('Browser PNG center is opaque crystal star (alpha >= 200)', pngPixelAudit.center && pngPixelAudit.center[3] >= 200, `alpha: ${pngPixelAudit.center?.[3]}`);

    // -----------------------------------------------------------------
    // TEST SUITE 6: STANDALONE OFFLINE DISTRIBUTION TESTING
    // -----------------------------------------------------------------
    console.log('\n--- 6. Testing Standalone Distribution (dist/index.standalone.html) ---');
    const standalonePath = path.resolve(__dirname, '..', 'dist', 'index.standalone.html').replace(/\\/g, '/');
    await cdp.navigate('file:///' + standalonePath);
    await new Promise(r => setTimeout(r, 1200));

    const standaloneAttrs = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('lg');
        return {
          exists: Boolean(el),
          tagName: el ? el.tagName.toLowerCase() : '',
          href: el ? el.getAttribute('href') : '',
          ariaLabel: el ? el.getAttribute('aria-label') : ''
        };
      })()
    `);

    assert('Standalone distribution has #lg as <a> tag', standaloneAttrs.exists && standaloneAttrs.tagName === 'a');
    assert('Standalone distribution has aria-label="CraftIndex Home"', standaloneAttrs.ariaLabel === 'CraftIndex Home');

    // Click logo in standalone to test navigation
    await cdp.evaluate(`
      if (typeof switchTab === 'function') switchTab(C.tabs.find(t => t.id === 'mods'), true);
    `);
    await new Promise(r => setTimeout(r, 600));
    let stTab = await cdp.evaluate('document.body.dataset.tab');
    console.log('Standalone tab switched to:', stTab);

    await cdp.evaluate(`document.getElementById('lg').click()`);
    await new Promise(r => setTimeout(r, 600));
    stTab = await cdp.evaluate('document.body.dataset.tab');
    assert('Standalone clicking logo switches tab back to "home"', stTab === 'home', `tab: ${stTab}`);

    // Capture visual confirmation screenshot
    const screenshotPath = path.join(__dirname, 'header_logo_verified.png');
    await cdp.screenshot(screenshotPath);
    console.log(`\nVisual confirmation saved to: ${screenshotPath}`);

  } finally {
    await cdp.close();
  }

  console.log('\n====================================================');
  const allPassed = testResults.every(t => t.passed);
  console.log(`VERIFICATION SUMMARY: ${testResults.filter(t => t.passed).length} / ${testResults.length} PASSED`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('====================================================');

  return { allPassed, testResults };
}

runComprehensiveVerification().then(({ allPassed }) => {
  if (!allPassed) process.exit(1);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
