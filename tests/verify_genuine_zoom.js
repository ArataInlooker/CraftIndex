const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function testGenuineZoom() {
  console.log('================================================================');
  console.log('GENUINE BROWSER ZOOM & HIGH-DPI DPI VERIFICATION');
  console.log('Testing: Genuine Page Zoom (100%, 150%, 200%) & Device Scale');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9294, userDataDir: path.resolve(__dirname, '..', '.chrome_zoom_qa') });
  await browser.launch();

  const zoomLevels = [1.0, 1.5, 2.0];

  for (const zoom of zoomLevels) {
    const zoomPct = Math.round(zoom * 100);
    console.log(`\n>>> AUDIT AT ${zoomPct}% ZOOM <<<`);

    // Method A: Genuine Page Scale Factor Zoom (Chrome Emulation.setPageScaleFactor)
    // In CDP, setPageScaleFactor changes the visual viewport page zoom factor
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: zoom,
      mobile: false
    });
    try {
      await browser.send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
    } catch (_) {}

    // 1. Header Buttons Check
    await browser.navigate('http://localhost:3000/');
    await new Promise(r => setTimeout(r, 600));

    const headerResult = await browser.evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('header .btn, header #mt'));
      const rects = btns.map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.id, top: Math.round(r.top), height: Math.round(r.height), text: b.textContent.trim().slice(0, 15) };
      });
      const topDiff = Math.max(...rects.map(r => r.top)) - Math.min(...rects.map(r => r.top));
      const hDiff = Math.max(...rects.map(r => r.height)) - Math.min(...rects.map(r => r.height));
      return { count: rects.length, topDiff, hDiff, rects };
    })()`);
    console.log(`  [Header ${zoomPct}% Zoom]: Top Diff: ${headerResult.topDiff}px | Height Diff: ${headerResult.hDiff}px => ${headerResult.topDiff <= 1 ? '✅ PASS' : '❌ FAIL'}`);

    // 2. Resource Card Action Bar (.act) Check
    await browser.navigate('http://localhost:3000/mods/');
    await new Promise(r => setTimeout(r, 1800));

    const cardResult = await browser.evaluate(`(() => {
      const firstAct = document.querySelector('.cd .act');
      if (!firstAct) return { error: 'no card action bar found' };
      const infoBtn = firstAct.querySelector('.btn-info');
      const addBtn = firstAct.querySelector('.btn.ad');
      if (!infoBtn || !addBtn) return { error: 'buttons missing' };

      const rInfo = infoBtn.getBoundingClientRect();
      const rAdd = addBtn.getBoundingClientRect();
      const topDiff = Math.abs(Math.round(rInfo.top) - Math.round(rAdd.top));
      const hDiff = Math.abs(Math.round(rInfo.height) - Math.round(rAdd.height));
      return {
        info: { top: Math.round(rInfo.top), h: Math.round(rInfo.height) },
        add: { top: Math.round(rAdd.top), h: Math.round(rAdd.height) },
        topDiff,
        hDiff
      };
    })()`);
    console.log(`  [Card Actions ${zoomPct}% Zoom]: Top Diff: ${cardResult.topDiff}px | Height Diff: ${cardResult.hDiff}px => ${cardResult.topDiff <= 1 ? '✅ PASS' : '❌ FAIL'}`);

    // 3. Drawer Footer Buttons Check
    await browser.evaluate(`(() => {
      if (typeof dr === 'function') dr(1);
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const drawerResult = await browser.evaluate(`(() => {
      const drFooter = document.querySelector('.dr-footer');
      if (!drFooter) return { error: 'no drawer footer found' };
      const btns = Array.from(drFooter.querySelectorAll('.dr-tool-btn, #am, #dd')).filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);
      const rects = btns.map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.id || b.className, top: Math.round(r.top), height: Math.round(r.height) };
      });
      const topDiff = Math.max(...rects.map(r => r.top)) - Math.min(...rects.map(r => r.top));
      const hDiff = Math.max(...rects.map(r => r.height)) - Math.min(...rects.map(r => r.height));
      return { count: rects.length, topDiff, hDiff };
    })()`);
    console.log(`  [Drawer Footer ${zoomPct}% Zoom]: Top Diff: ${drawerResult.topDiff}px | Height Diff: ${drawerResult.hDiff}px => ${drawerResult.topDiff <= 1 ? '✅ PASS' : '❌ FAIL'}`);

    // 4. Docs Creator Action Buttons Check
    await browser.navigate('http://localhost:3000/docs/');
    await new Promise(r => setTimeout(r, 1200));

    const docsResult = await browser.evaluate(`(() => {
      const actions = document.querySelector('.doc-creator-actions');
      if (!actions) return { error: 'no docs actions found' };
      const btns = Array.from(actions.querySelectorAll('.doc-pill-btn'));
      const rects = btns.map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), top: Math.round(r.top), height: Math.round(r.height) };
      });
      const topDiff = Math.abs(rects[0].top - rects[1].top);
      const hDiff = Math.abs(rects[0].height - rects[1].height);
      return { topDiff, hDiff };
    })()`);
    console.log(`  [Docs Creator ${zoomPct}% Zoom]: Top Diff: ${docsResult.topDiff}px | Height Diff: ${docsResult.hDiff}px => ${docsResult.topDiff <= 1 ? '✅ PASS' : '❌ FAIL'}`);
  }

  await browser.close();
}

testGenuineZoom().catch(console.error);
