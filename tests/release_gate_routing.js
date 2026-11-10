const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function runRoutingReleaseGate() {
  console.log('================================================================');
  console.log('CRAFTINDEX v2.6.1 RELEASE GATE: BROWSER HISTORY & ROUTING AUDIT');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9330, userDataDir: path.resolve(__dirname, '..', '.chrome_rg_routing') });
  await browser.launch();
  await browser.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const scenarios = [];

  function record(name, pass, evidence) {
    scenarios.push({ name, pass, evidence });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`);
    console.log(`       Evidence: ${evidence}\n`);
  }

  // --- Scenario 1: Open Settings from Homepage & Dismiss ---
  console.log('--- Scenario 1: Settings on Homepage ---');
  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 1200));

  await browser.evaluate("document.getElementById('setb').click()");
  await new Promise(r => setTimeout(r, 400));
  const s1Open = await browser.evaluate("document.documentElement.classList.contains('ci-scroll-locked') && document.body.style.position === 'fixed'");

  // Dismiss with Escape key
  await browser.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise(r => setTimeout(r, 400));

  const s1Dismiss = await browser.evaluate(`(() => {
    return {
      pathname: window.location.pathname,
      bodyPos: document.body.style.position,
      locked: document.documentElement.classList.contains('ci-scroll-locked'),
      bodyTab: document.body.dataset.tab,
      scrollY: window.scrollY
    };
  })()`);
  record(
    'Scenario 1: Open Settings on Homepage & dismiss with Escape',
    s1Open && s1Dismiss.pathname === '/' && s1Dismiss.bodyPos === '' && !s1Dismiss.locked && s1Dismiss.bodyTab === 'home',
    `Modal locked body: ${s1Open}, Pathname: "${s1Dismiss.pathname}", Body position: "${s1Dismiss.bodyPos}", Tab: "${s1Dismiss.bodyTab}", ScrollY: ${s1Dismiss.scrollY}`
  );

  // --- Scenario 2: Open Settings from Resource Detail Route & Dismiss ---
  console.log('--- Scenario 2: Settings on Resource Route ---');
  await browser.navigate('http://localhost:3000/mods/sodium/');
  await new Promise(r => setTimeout(r, 2000));
  await browser.evaluate('window.scrollTo(0, 350)');
  const s2InitialScroll = await browser.evaluate('window.scrollY');

  await browser.evaluate("document.getElementById('setb').click()");
  await new Promise(r => setTimeout(r, 400));
  const s2Open = await browser.evaluate("document.body.style.position === 'fixed' && CraftIndexScrollLock._scrollY === 350");

  // Dismiss with Cancel button
  await browser.evaluate("document.getElementById('set-cancel-btn').click()");
  await new Promise(r => setTimeout(r, 400));

  const s2Dismiss = await browser.evaluate(`(() => {
    const view = document.getElementById('standaloneResourceView');
    return {
      pathname: window.location.pathname,
      bodyPos: document.body.style.position,
      locked: document.documentElement.classList.contains('ci-scroll-locked'),
      viewActive: view && view.offsetHeight > 0,
      scrollY: window.scrollY
    };
  })()`);
  record(
    'Scenario 2: Open Settings on /mods/sodium/ & dismiss with Cancel button',
    s2Open && s2Dismiss.pathname === '/mods/sodium/' && s2Dismiss.viewActive && s2Dismiss.scrollY === 350 && s2Dismiss.bodyPos === '',
    `Path preserved: "${s2Dismiss.pathname}", View active: ${s2Dismiss.viewActive}, Scroll preserved: ${s2Dismiss.scrollY}px (expected 350px), Lock released: ${!s2Dismiss.locked}`
  );

  // --- Scenario 3: Browser Back & Forward after Modal Dismissal ---
  console.log('--- Scenario 3: History Back/Forward after Modal Dismissal ---');
  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 800));
  await browser.evaluate("switchTab(T('mods'))");
  await new Promise(r => setTimeout(r, 600));
  await browser.evaluate("switchTab(T('plugins'))");
  await new Promise(r => setTimeout(r, 600));

  // Open & dismiss Settings modal on /plugins/
  await browser.evaluate("document.getElementById('setb').click()");
  await new Promise(r => setTimeout(r, 300));
  await browser.evaluate('md(0)');
  await new Promise(r => setTimeout(r, 300));

  // Hit Browser Back
  await browser.evaluate('window.history.back()');
  await new Promise(r => setTimeout(r, 600));
  const s3BackPath = await browser.evaluate('window.location.pathname');
  const s3BackTab = await browser.evaluate('document.body.dataset.tab');

  // Hit Browser Forward
  await browser.evaluate('window.history.forward()');
  await new Promise(r => setTimeout(r, 600));
  const s3FwdPath = await browser.evaluate('window.location.pathname');
  const s3FwdTab = await browser.evaluate('document.body.dataset.tab');

  record(
    'Scenario 3: History Back/Forward traversal after modal dismissal',
    s3BackPath === '/mods/' && s3BackTab === 'mods' && s3FwdPath === '/plugins/' && s3FwdTab === 'plugins',
    `Back navigated to: "${s3BackPath}" (tab: ${s3BackTab}), Forward navigated to: "${s3FwdPath}" (tab: ${s3FwdTab})`
  );

  // --- Scenario 4: Hard Refresh on Nested Resource Routes ---
  console.log('--- Scenario 4: Hard Refresh on Subpaths ---');
  await browser.navigate('http://localhost:3000/mods/fabric/');
  await new Promise(r => setTimeout(r, 1200));
  await browser.evaluate('window.location.reload()');
  await new Promise(r => setTimeout(r, 1500));

  const s4Refresh = await browser.evaluate(`(() => {
    return {
      pathname: window.location.pathname,
      bodyTab: document.body.dataset.tab,
      loaderValue: document.getElementById('fl') ? document.getElementById('fl').value : null,
      cardsCount: document.querySelectorAll('.cd').length
    };
  })()`);
  record(
    'Scenario 4: Hard refresh on nested route /mods/fabric/',
    s4Refresh.pathname === '/mods/fabric/' && s4Refresh.bodyTab === 'mods' && s4Refresh.loaderValue === 'fabric' && s4Refresh.cardsCount > 0,
    `Path: "${s4Refresh.pathname}", Tab: "${s4Refresh.bodyTab}", Loader: "${s4Refresh.loaderValue}", Cards rendered: ${s4Refresh.cardsCount}`
  );

  // --- Scenario 5: Direct Navigation to Static & Dynamic Routes ---
  console.log('--- Scenario 5: Direct Navigation Integrity ---');
  await browser.navigate('http://localhost:3000/resourcepacks/');
  await new Promise(r => setTimeout(r, 1200));
  const s5Static = await browser.evaluate(`({ title: document.title, tab: document.body.dataset.tab, cards: document.querySelectorAll('.cd').length })`);

  await browser.navigate('http://localhost:3000/mods/iris/');
  await new Promise(r => setTimeout(r, 2000));
  const s5Dynamic = await browser.evaluate(`({ title: document.title, hasView: Boolean(document.getElementById('standaloneResourceView')), crumb: document.querySelector('.rp-breadcrumb') ? document.querySelector('.rp-breadcrumb').textContent.trim() : null })`);

  record(
    'Scenario 5: Direct URL navigation (static /resourcepacks/ and dynamic /mods/iris/)',
    s5Static.tab === 'resourcepacks' && s5Static.cards > 0 && s5Dynamic.hasView && s5Dynamic.crumb.toLowerCase().includes('iris'),
    `Static tab: "${s5Static.tab}" (${s5Static.cards} cards) | Dynamic title: "${s5Dynamic.title}", Crumb: "${s5Dynamic.crumb.replace(/\s+/g, ' ')}"`
  );

  // --- Scenario 6: Nested Overlays Dismissed in Reverse & Mixed Orders ---
  console.log('--- Scenario 6: Nested Overlay Order Matrix ---');
  // Order A: Drawer -> Settings -> Close Settings -> Close Drawer
  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 1000));
  await browser.evaluate('window.scrollTo(0, 450)');

  await browser.evaluate('dr(1)'); // Lock 1
  await new Promise(r => setTimeout(r, 200));
  await browser.evaluate("document.getElementById('setb').click()"); // Lock 2
  await new Promise(r => setTimeout(r, 200));

  const s6Count2 = await browser.evaluate('CraftIndexScrollLock._count');
  await browser.evaluate('md(0)'); // Release Lock 2
  await new Promise(r => setTimeout(r, 200));
  const s6Count1 = await browser.evaluate('CraftIndexScrollLock._count');
  const s6MidPos = await browser.evaluate('document.body.style.position');

  await browser.evaluate('dr(0)'); // Release Lock 1
  await new Promise(r => setTimeout(r, 300));
  const s6Count0 = await browser.evaluate('CraftIndexScrollLock._count');
  const s6FinalPos = await browser.evaluate('document.body.style.position');
  const s6FinalScroll = await browser.evaluate('window.scrollY');

  record(
    'Scenario 6: Nested overlays (Drawer + Settings) reference-count locking',
    s6Count2 === 2 && s6Count1 === 1 && s6MidPos === 'fixed' && s6Count0 === 0 && s6FinalPos === '' && s6FinalScroll === 450,
    `Count progression: 2 -> 1 (body still "${s6MidPos}") -> 0 (body restored to "${s6FinalPos}"), Scroll restored to: ${s6FinalScroll}px`
  );

  await browser.close();

  const allPass = scenarios.every(s => s.pass);
  console.log('================================================================');
  console.log(`ROUTING & HISTORY AUDIT VERDICT: ${allPass ? '✅ 100% PASS' : '❌ FAILURES DETECTED'}`);
  console.log('================================================================\n');

  return { allPass, scenarios };
}

runRoutingReleaseGate()
  .then(({ allPass }) => process.exit(allPass ? 0 : 1))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
