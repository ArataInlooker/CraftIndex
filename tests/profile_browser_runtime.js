const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function profile() {
  console.log('================================================================');
  console.log('REAL BROWSER JAVASCRIPT RUNTIME PROFILING AUDIT');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9270, userDataDir: path.resolve(__dirname, '..', '.chrome_profile_run') });
  await browser.launch();
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 1. Initial Load & Long Tasks Collector
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__longTasks = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__longTasks.push({
              name: entry.name,
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration)
            });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch (e) {}
    `
  });

  console.log('--- 1. Initial Application Load ---');
  const t0 = Date.now();
  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 2000));
  const loadDuration = Date.now() - t0;
  const initialLongTasks = await browser.evaluate('window.__longTasks');
  console.log(`Initial navigation total wall time: ${loadDuration}ms`);
  console.log(`Initial load long tasks count: ${initialLongTasks.length}`);
  if (initialLongTasks.length) {
    console.log(`Initial long tasks details:`, JSON.stringify(initialLongTasks));
  }

  // 2 & 3. Search Input & Filtering / Sorting
  console.log('\n--- 2 & 3. Search Input, Filtering & Sorting ---');
  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 2000));
  const searchProfile = await browser.evaluate(`(async () => {
    const qInput = document.getElementById('q');
    if (!qInput) return { error: 'Search input #q not found' };

    // Measure rapid input simulation and debounce handling
    const startInput = performance.now();
    qInput.value = 'opti';
    qInput.dispatchEvent(new Event('input', { bubbles: true }));
    const inputDispatchTime = +(performance.now() - startInput).toFixed(2);

    // Measure synchronous catalog filtering and sorting directly on 100 items
    const startSort = performance.now();
    let sortedCount = 0;
    if (window.hits && window.hits.length > 0) {
      const copy = [...window.hits];
      copy.sort((a, b) => (b.dl || 0) - (a.dl || 0));
      sortedCount = copy.length;
    }
    const sortTime = +(performance.now() - startSort).toFixed(2);

    return { inputDispatchTime, sortTime, sortedCount, currentHits: (window.hits || []).length };
  })()`);
  console.log('Search & Sort profile:', JSON.stringify(searchProfile));

  // 4 & 5. Category Navigation & Grid Rendering
  console.log('\n--- 4 & 5. Category Navigation & Grid Rendering ---');
  const navProfile = await browser.evaluate(`(async () => {
    const results = [];
    const tabButtons = Array.from(document.querySelectorAll('#tabs .tb'));
    for (const btn of tabButtons.slice(1, 4)) {
      const name = btn.textContent.trim();
      const start = performance.now();
      btn.click();
      const switchDuration = +(performance.now() - start).toFixed(2);
      results.push({ name, switchDuration });
      await new Promise(r => setTimeout(r, 600));
    }
    return results;
  })()`);
  console.log('Category Navigation times:', JSON.stringify(navProfile));

  // 6. Resource-Card Interactions (Add to cart, toggle)
  console.log('\n--- 6. Resource-Card Interactions ---');
  const cardInteractionProfile = await browser.evaluate(`(() => {
    const start = performance.now();
    const firstAddBtn = document.querySelector('.cd .ad');
    let clicked = false;
    if (firstAddBtn) {
      firstAddBtn.click();
      clicked = true;
    }
    const clickDuration = +(performance.now() - start).toFixed(2);
    const cartSize = window.cart ? window.cart.size : 0;
    return { clicked, clickDuration, cartSize };
  })()`);
  console.log('Card interaction time:', JSON.stringify(cardInteractionProfile));

  // 7 & 8. Pack Studio Opening, Import, & Export
  console.log('\n--- 7 & 8. Pack Studio Opening, Import & Export ---');
  const studioProfile = await browser.evaluate(`(async () => {
    const openStart = performance.now();
    if (typeof window.ensurePackStudio === 'function') {
      await window.ensurePackStudio();
    }
    const openTime = +(performance.now() - openStart).toFixed(2);
    const studioAvailable = Boolean(window.CraftIndexStudio);

    let exportTime = null;
    let exportSize = 0;
    if (window.CraftIndexStudio && window.CraftIndexStudio.exportCollectionZip) {
      const tExpStart = performance.now();
      try {
        const zipBlob = await window.CraftIndexStudio.exportCollectionZip(true);
        exportTime = +(performance.now() - tExpStart).toFixed(2);
        exportSize = zipBlob ? zipBlob.size : 0;
      } catch (err) {
        exportTime = err.message;
      }
    }

    return { openTime, studioAvailable, exportTime, exportSize };
  })()`);
  console.log('Pack Studio profile:', JSON.stringify(studioProfile));

  // 9. IndexedDB Reads & Writes
  console.log('\n--- 9. IndexedDB Reads & Writes ---');
  const idbProfile = await browser.evaluate(`(async () => {
    if (!window.CraftIndexStudio || !window.CraftIndexStudio.idbPutBinary) {
      return { error: 'CraftIndexStudio binary API not available' };
    }
    const testBytes = new Uint8Array(1024 * 64); // 64 KB test blob
    for (let i = 0; i < testBytes.length; i++) testBytes[i] = (i % 256);
    const blob = new Blob([testBytes], { type: 'application/java-archive' });

    // Write timing
    const tWriteStart = performance.now();
    const id = 'perf_test_blob_' + Date.now();
    await window.CraftIndexStudio.idbPutBinary(id, {
      id,
      name: 'perf_test.jar',
      category: 'mods',
      loader: 'Fabric',
      hash: 'perf_hash_123',
      size: testBytes.length,
      mime: 'application/java-archive',
      blob,
      timestamp: Date.now()
    });
    const writeTime = +(performance.now() - tWriteStart).toFixed(2);

    // Read timing
    const tReadStart = performance.now();
    const retrieved = await window.CraftIndexStudio.idbGetBinary(id);
    const readTime = +(performance.now() - tReadStart).toFixed(2);

    // Delete timing
    const tDelStart = performance.now();
    await window.CraftIndexStudio.idbDeleteBinary(id);
    const deleteTime = +(performance.now() - tDelStart).toFixed(2);

    return { writeTime, readTime, deleteTime, verified: Boolean(retrieved && retrieved.size === testBytes.length) };
  })()`);
  console.log('IndexedDB timing:', JSON.stringify(idbProfile));

  // 10. Documentation Modal Opening & Section Navigation
  console.log('\n--- 10. Documentation Modal & Navigation ---');
  const docsProfile = await browser.evaluate(`(async () => {
    const tDocsStart = performance.now();
    if (typeof window.ensureAboutDocs === 'function') {
      await window.ensureAboutDocs();
    }
    const loadTime = +(performance.now() - tDocsStart).toFixed(2);

    const tOpenStart = performance.now();
    if (typeof window.openAboutModal === 'function') {
      window.openAboutModal('overview', true);
    }
    const openTime = +(performance.now() - tOpenStart).toFixed(2);

    const tNavStart = performance.now();
    if (typeof window.showAboutCategory === 'function') {
      window.showAboutCategory('05-resource-categories');
    }
    const switchTabTime = +(performance.now() - tNavStart).toFixed(2);

    if (typeof window.closeAboutModal === 'function') {
      window.closeAboutModal(true);
    }

    return { loadTime, openTime, switchTabTime };
  })()`);
  console.log('Docs profile:', JSON.stringify(docsProfile));

  // Final check on Long Tasks accumulated during all actions
  const allLongTasks = await browser.evaluate('window.__longTasks');
  console.log(`\nTotal cumulative Long Tasks across entire session: ${allLongTasks.length}`);
  if (allLongTasks.length > 0) {
    console.log('Long tasks:', JSON.stringify(allLongTasks));
  }

  await browser.close();
}

profile().catch(e => { console.error('FATAL', e); process.exit(1); });
