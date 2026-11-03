const path = require('path');
const http = require('http');
const CdpBrowser = require('./cdp_browser');

function httpGetStatus(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      resolve(res.statusCode);
    }).on('error', reject);
  });
}

(async () => {
  console.log('================================================================');
  console.log('AUDIT: REAL BROWSER ROUTING & INTERACTION VERIFICATION');
  console.log('================================================================\n');

  const profileDir = path.resolve(__dirname, 'chrome_routing_profile');
  const browser = new CdpBrowser({ port: 9224, userDataDir: profileDir });
  await browser.launch();

  const testRoutes = [
    { path: '/mods/', expectedTab: 'mods', check: async () => true },
    { path: '/mods/fabric/', expectedTab: 'mods', check: async () => {
      return await browser.evaluate(`document.getElementById('fl') ? document.getElementById('fl').value === 'fabric' : false`);
    }, note: 'Loader filter value === fabric' },
    { path: '/plugins/', expectedTab: 'plugins', check: async () => true },
    { path: '/resourcepacks/', expectedTab: 'resourcepacks', check: async () => true },
    { path: '/shaders/', expectedTab: 'shaders', check: async () => true },
    { path: '/datapacks/', expectedTab: 'datapacks', check: async () => true },
    { path: '/modpacks/', expectedTab: 'modpacks', check: async () => true },
    { path: '/worlds/', expectedTab: 'worlds', check: async () => true },
    { path: '/serversoftwares/', expectedTab: 'serversoftwares', check: async () => true },
    { path: '/modloaders/', expectedTab: 'modloaders', check: async () => true },
    { path: '/launchers/', expectedTab: 'launchers', check: async () => true },
    { path: '/studio/', expectedTab: 'studio', check: async () => {
      return await browser.evaluate(`Boolean(window.CraftVaultStudio)`);
    }, note: 'CraftVaultStudio available' },
    { path: '/docs/', check: async () => {
      return await browser.evaluate(`Boolean(document.getElementById('aboutModal') && document.getElementById('aboutModal').classList.contains('open'))`);
    }, note: 'About/Docs modal opened' },
    { path: '/docs/api-backend', check: async () => {
      return await browser.evaluate(`Boolean(document.getElementById('aboutModal') && document.getElementById('aboutModal').classList.contains('open') && document.querySelector('.about-nav-item.active') && document.querySelector('.about-nav-item.active').dataset.id === 'api-backend')`);
    }, note: 'Docs opened directly to API & Backend section' }
  ];

  console.log('[Phase 1: Direct Clean URL Route Navigation]');
  let directNavAllPass = true;

  for (const r of testRoutes) {
    await browser.navigate(`http://localhost:3000${r.path}`);
    await new Promise(res => setTimeout(res, 800));

    const state = await browser.evaluate(`({
      bodyTab: document.body.dataset.tab,
      title: document.title,
      url: window.location.pathname
    })`);

    let pass = true;
    if (r.expectedTab && state.bodyTab !== r.expectedTab) pass = false;
    const customPass = await r.check();
    if (!customPass) pass = false;

    if (!pass) directNavAllPass = false;
    console.log(` - Route [${r.path.padEnd(16)}] -> Body Tab: ${state.bodyTab || 'N/A'}, Path: ${state.url} | Custom Check: ${customPass ? 'OK' : 'FAIL'} => ${pass ? '✅ PASS' : '❌ FAIL'}`);
  }

  console.log(`\nPhase 1 Direct Route Navigation Verdict: ${directNavAllPass ? '✅ ALL PASS' : '❌ FAIL'}`);

  console.log('\n[Phase 2: History PushState, Back & Forward Interaction]');
  // 1. Navigate to /plugins/
  await browser.navigate('http://localhost:3000/plugins/');
  await new Promise(res => setTimeout(res, 600));

  // 2. Click / switch to /shaders/
  await browser.evaluate(`switchTab(T('shaders'))`);
  await new Promise(res => setTimeout(res, 600));

  const afterSwitch = await browser.evaluate(`({ tab: document.body.dataset.tab, path: window.location.pathname })`);
  console.log(' - Switched tab to shaders:', afterSwitch);

  // 3. Trigger history.back()
  await browser.evaluate(`window.history.back()`);
  await new Promise(res => setTimeout(res, 800));
  const afterBack = await browser.evaluate(`({ tab: document.body.dataset.tab, path: window.location.pathname })`);
  console.log(' - History Back (expected plugins):', afterBack);
  const backPass = afterBack.tab === 'plugins' && afterBack.path === '/plugins/';

  // 4. Trigger history.forward()
  await browser.evaluate(`window.history.forward()`);
  await new Promise(res => setTimeout(res, 800));
  const afterForward = await browser.evaluate(`({ tab: document.body.dataset.tab, path: window.location.pathname })`);
  console.log(' - History Forward (expected shaders):', afterForward);
  const forwardPass = afterForward.tab === 'shaders' && afterForward.path === '/shaders/';

  console.log(`Phase 2 History Navigation Verdict: ${(backPass && forwardPass) ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n[Phase 3: Browser Refresh on Subpath /mods/fabric/]');
  await browser.navigate('http://localhost:3000/mods/fabric/');
  await new Promise(res => setTimeout(res, 800));
  await browser.send('Page.reload');
  await new Promise(res => setTimeout(res, 1200));

  const afterReload = await browser.evaluate(`({
    tab: document.body.dataset.tab,
    path: window.location.pathname,
    loaderVal: document.getElementById('fl') ? document.getElementById('fl').value : null
  })`);
  console.log(' - State after hard reload:', afterReload);
  const refreshPass = afterReload.tab === 'mods' && afterReload.loaderVal === 'fabric';
  console.log(`Phase 3 Subpath Refresh Verdict: ${refreshPass ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n[Phase 4: Non-existent URL Fallback / 404 Check]');
  const invalidStatus1 = await httpGetStatus('/nonexistent-route-xyz-404');
  const invalidStatus2 = await httpGetStatus('/api/unknown/service');
  console.log(` - GET /nonexistent-route-xyz-404 -> Status ${invalidStatus1} (Expected 404)`);
  console.log(` - GET /api/unknown/service      -> Status ${invalidStatus2} (Expected 404)`);
  const status404Pass = invalidStatus1 === 404 && invalidStatus2 === 404;
  console.log(`Phase 4 404 Handling Verdict: ${status404Pass ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n================================================================');
  console.log('ROUTING VERIFICATION FINAL SUMMARY:');
  console.log(' - Direct Clean Route Navigation: ', directNavAllPass ? '✅ PASS' : '❌ FAIL');
  console.log(' - History Back/Forward Control: ', (backPass && forwardPass) ? '✅ PASS' : '❌ FAIL');
  console.log(' - Subpath Refresh Persistence:   ', refreshPass ? '✅ PASS' : '❌ FAIL');
  console.log(' - Server 404 Non-SPA Fallback:   ', status404Pass ? '✅ PASS' : '❌ FAIL');
  console.log('================================================================');

  await browser.close();
  const overall = directNavAllPass && backPass && forwardPass && refreshPass && status404Pass;
  process.exit(overall ? 0 : 1);
})().catch(err => {
  console.error('Routing audit error:', err);
  process.exit(1);
});
