const path = require('path');
const CdpBrowser = require('./cdp_browser');

const VIEWPORTS = [320, 360, 390, 430, 768, 1024, 1280, 1440];
const ROUTES = ['/', '/mods/', '/studio/', '/docs/'];

async function runResponsiveAudit() {
  console.log('================================================================');
  console.log('COMPREHENSIVE MULTI-ROUTE RESPONSIVE OVERFLOW AUDIT');
  console.log('Checking 8 viewports across 4 key application routes');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9295, userDataDir: path.resolve(__dirname, '..', '.chrome_resp_qa') });
  await browser.launch();

  let totalChecks = 0;
  let passedChecks = 0;

  for (const route of ROUTES) {
    console.log(`\n--- Auditing Route: ${route} ---`);
    for (const w of VIEWPORTS) {
      totalChecks++;
      await browser.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: w <= 768 });
      await browser.navigate('http://localhost:3000' + route);
      await new Promise(r => setTimeout(r, 600));

      const res = await browser.evaluate(`(() => {
        const docW = document.documentElement.offsetWidth;
        const scrollW = document.documentElement.scrollWidth;
        const hasOverflow = scrollW > docW;

        const header = document.querySelector('header');
        const headerW = header ? header.offsetWidth : 0;
        const headerScrollW = header ? header.scrollWidth : 0;
        const headerOverflow = headerScrollW > headerW;

        // Check search if present
        const q = document.getElementById('q');
        const qOverflow = q ? (q.getBoundingClientRect().right > docW) : false;

        // Check grid if present (with 2px subpixel rounding tolerance)
        const gr = document.getElementById('g');
        const grOverflow = gr ? (gr.scrollWidth > gr.offsetWidth + 2) : false;

        return {
          docW,
          scrollW,
          hasOverflow,
          headerW,
          headerScrollW,
          headerOverflow,
          qOverflow,
          grOverflow
        };
      })()`);

      const pass = !res.hasOverflow && !res.headerOverflow && !res.qOverflow && !res.grOverflow;
      if (pass) passedChecks++;
      console.log(`  [${String(w).padStart(4)}px] ${pass ? '✅ PASS' : '❌ FAIL'}: Doc: ${res.docW}/${res.scrollW} | Header: ${res.headerW}/${res.headerScrollW} | Q-overflow: ${res.qOverflow}`);
    }
  }

  // Also audit drawer and settings modal responsiveness on 320px
  console.log('\n--- Auditing Overlays at 320px Viewport ---');
  await browser.setViewport({ width: 320, height: 700, deviceScaleFactor: 1, isMobile: true });
  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 1000));

  // Drawer
  totalChecks++;
  const drawerCheck = await browser.evaluate(`(async () => {
    if (typeof dr === 'function') dr(1);
    await new Promise(r => setTimeout(r, 400));
    const drawerEl = document.getElementById('dr');
    const docW = document.documentElement.offsetWidth;
    const scrollW = document.documentElement.scrollWidth;
    const dW = drawerEl ? drawerEl.offsetWidth : 0;
    const dScrollW = drawerEl ? drawerEl.scrollWidth : 0;
    if (typeof dr === 'function') dr(0);
    return { docW, scrollW, dW, dScrollW, overflow: dScrollW > dW || scrollW > docW };
  })()`);
  if (!drawerCheck.overflow) passedChecks++;
  console.log(`  Cart Drawer at 320px: ${!drawerCheck.overflow ? '✅ PASS' : '❌ FAIL'} (Drawer: ${drawerCheck.dW}/${drawerCheck.dScrollW}, Doc: ${drawerCheck.docW}/${drawerCheck.scrollW})`);

  // Settings Modal
  totalChecks++;
  const settingsCheck = await browser.evaluate(`(async () => {
    if (typeof openSettingsModal === 'function') openSettingsModal();
    await new Promise(r => setTimeout(r, 500));
    const modalEl = document.querySelector('.mx.settings-mode');
    const docW = document.documentElement.offsetWidth;
    const scrollW = document.documentElement.scrollWidth;
    const mW = modalEl ? modalEl.offsetWidth : 0;
    const mScrollW = modalEl ? modalEl.scrollWidth : 0;
    if (typeof closeSettingsModal === 'function') closeSettingsModal();
    return { docW, scrollW, mW, mScrollW, overflow: mScrollW > mW || scrollW > docW };
  })()`);
  if (!settingsCheck.overflow) passedChecks++;
  console.log(`  Settings Modal at 320px: ${!settingsCheck.overflow ? '✅ PASS' : '❌ FAIL'} (Modal: ${settingsCheck.mW}/${settingsCheck.mScrollW}, Doc: ${settingsCheck.docW}/${settingsCheck.scrollW})`);

  console.log(`\n================================================================`);
  console.log(`RESPONSIVE AUDIT SUMMARY: ${passedChecks} / ${totalChecks} PASSED (${passedChecks === totalChecks ? 'ALL PASSED ✅' : 'FAILURES DETECTED ❌'})`);
  console.log(`================================================================\n`);

  await browser.close();
}

runResponsiveAudit().catch(console.error);
