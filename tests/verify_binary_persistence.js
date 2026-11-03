const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require(path.resolve(__dirname, '..', 'js', 'vendor', 'jszip.min.js'));
const CdpBrowser = require('./cdp_browser');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function createTestFixtures() {
  // 1. Fabric mod archive
  const fabricZip = new JSZip();
  fabricZip.file('fabric.mod.json', JSON.stringify({
    schemaVersion: 1,
    id: 'deep_verification_mod',
    version: '2.5.0',
    name: 'Deep Verification Mod',
    description: 'Hardware persistence test mod',
    depends: { 'minecraft': '>=1.20.1' }
  }));
  fabricZip.file('assets/deep_mod/icon.png', Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  const fabricBuffer = await fabricZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const fabricHash = sha256(fabricBuffer);

  // 2. Resource pack archive
  const rpZip = new JSZip();
  rpZip.file('pack.mcmeta', JSON.stringify({
    pack: { pack_format: 15, description: 'Deep Verification Resource Pack' }
  }));
  rpZip.file('assets/minecraft/textures/block/amethyst_block.png', Buffer.from([0x89, 0x50, 0x4E, 0x47]));
  const rpBuffer = await rpZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const rpHash = sha256(rpBuffer);

  return {
    fabric: { name: 'deep_verification_mod-2.5.0.jar', buffer: fabricBuffer, hash: fabricHash },
    resourcePack: { name: 'DeepVerificationRP.zip', buffer: rpBuffer, hash: rpHash }
  };
}

(async () => {
  console.log('================================================================');
  console.log('AUDIT 2: PERSISTENT BINARY STORAGE & BROWSER SHUTDOWN INTEGRITY');
  console.log('================================================================\n');

  const fixtures = await createTestFixtures();
  console.log('[Fixture 1] Fabric Mod:', fixtures.fabric.name, 'Size:', fixtures.fabric.buffer.length, 'bytes');
  console.log('            Expected SHA-256:', fixtures.fabric.hash);
  console.log('[Fixture 2] Resource Pack:', fixtures.resourcePack.name, 'Size:', fixtures.resourcePack.buffer.length, 'bytes');
  console.log('            Expected SHA-256:', fixtures.resourcePack.hash);

  const profileDir = path.resolve(__dirname, 'chrome_persistent_profile');
  // Wipe profile directory for a fresh test run
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('\n[Phase 1] Launching isolated browser session (Chrome)...');
  let browser = new CdpBrowser({ port: 9222, userDataDir: profileDir });
  await browser.launch();
  await browser.navigate('http://localhost:3000/studio/');
  await new Promise(r => setTimeout(r, 1000));

  // Confirm studio loaded
  const studioExists = await browser.evaluate('Boolean(window.CraftIndexStudio)');
  console.log('CraftIndexStudio initialized in browser:', studioExists);
  if (!studioExists) throw new Error('CraftIndexStudio missing from window');

  // Convert fixtures to base64 for injection into browser context
  const fabricB64 = fixtures.fabric.buffer.toString('base64');
  const rpB64 = fixtures.resourcePack.buffer.toString('base64');

  console.log('\n[Phase 2] Importing fixtures through CraftIndex application engine...');
  const importResult = await browser.evaluate(`(async () => {
    function b64ToBlob(b64, type) {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type });
    }

    const fabricBlob = b64ToBlob("${fabricB64}", "application/java-archive");
    fabricBlob.name = "${fixtures.fabric.name}";
    const rpBlob = b64ToBlob("${rpB64}", "application/zip");
    rpBlob.name = "${fixtures.resourcePack.name}";

    const res1 = await window.CraftIndexStudio.importZipArchive(fabricBlob);
    const res2 = await window.CraftIndexStudio.importZipArchive(rpBlob);

    return {
      res1,
      res2,
      cartSize: window.cart ? window.cart.size : -1,
      rawLs: localStorage.getItem("cv_cart")
    };
  })()`);

  console.log('Import Summary 1:', JSON.stringify(importResult.res1));
  console.log('Import Summary 2:', JSON.stringify(importResult.res2));
  console.log('Cart size immediately post-import:', importResult.cartSize);
  console.log('LocalStorage immediately post-import:', importResult.rawLs ? `${importResult.rawLs.length} chars` : 'null');

  // Query IndexedDB directly from browser context
  console.log('\n[Phase 3] Querying IndexedDB CraftIndexDB directly from browser...');
  const initialDbBinaries = await browser.evaluate(`(async () => {
    const list = await window.CraftIndexStudio.idbGetAllBinaries();
    const results = [];
    for (const b of list) {
      const arr = await b.blob.arrayBuffer();
      const hash = await window.CraftIndexStudio.calculateSha256(arr);
      results.push({
        id: b.id,
        name: b.name,
        category: b.category,
        size: b.size,
        storedHash: b.hash,
        calculatedHash: hash
      });
    }
    return results;
  })()`);

  console.log('Binaries stored in IndexedDB:', initialDbBinaries.length);
  for (const item of initialDbBinaries) {
    console.log(` - Stored: [${item.name}] | Size: ${item.size} bytes | Hash: ${item.calculatedHash}`);
  }

  const phase3Pass = initialDbBinaries.length >= 2 &&
    initialDbBinaries.some(b => b.calculatedHash === fixtures.fabric.hash) &&
    initialDbBinaries.some(b => b.calculatedHash === fixtures.resourcePack.hash);

  console.log('Phase 3 Initial IndexedDB Storage Match:', phase3Pass ? '✅ PASS' : '❌ FAIL');

  // Phase 4: Page Refresh within same context
  console.log('\n[Phase 4] Refreshing application page...');
  await browser.navigate('http://localhost:3000/studio/');
  await new Promise(r => setTimeout(r, 1000));
  const postRefreshBinaries = await browser.evaluate(`(async () => {
    const list = await window.CraftIndexStudio.idbGetAllBinaries();
    const results = [];
    for (const b of list) {
      const arr = await b.blob.arrayBuffer();
      const hash = await window.CraftIndexStudio.calculateSha256(arr);
      results.push({ id: b.id, name: b.name, size: b.size, calculatedHash: hash });
    }
    return results;
  })()`);

  console.log('Binaries after page refresh:', postRefreshBinaries.length);
  const phase4Pass = postRefreshBinaries.length >= 2 &&
    postRefreshBinaries.some(b => b.calculatedHash === fixtures.fabric.hash) &&
    postRefreshBinaries.some(b => b.calculatedHash === fixtures.resourcePack.hash);
  console.log('Phase 4 Refresh Persistence Match:', phase4Pass ? '✅ PASS' : '❌ FAIL');

  // Phase 5: Complete Browser Shutdown & Process Termination
  console.log('\n[Phase 5] Completely killing browser process & socket...');
  await browser.close();
  console.log('Browser process killed. Verifying process termination...');
  await new Promise(r => setTimeout(r, 1500));

  // Phase 6: Reopen Same Persistent Profile
  console.log('\n[Phase 6] Re-launching Chrome with EXACT SAME user-data-dir profile...');
  browser = new CdpBrowser({ port: 9222, userDataDir: profileDir });
  await browser.launch();
  await browser.navigate('http://localhost:3000/studio/');
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n[Phase 7] Reading IndexedDB binaries post-browser-shutdown...');
  const postShutdownBinaries = await browser.evaluate(`(async () => {
    const list = await window.CraftIndexStudio.idbGetAllBinaries();
    const results = [];
    for (const b of list) {
      const arr = await b.blob.arrayBuffer();
      const hash = await window.CraftIndexStudio.calculateSha256(arr);
      results.push({
        id: b.id,
        name: b.name,
        category: b.category,
        size: b.size,
        storedHash: b.hash,
        calculatedHash: hash
      });
    }
    return results;
  })()`);

  console.log('Binaries retrieved after complete browser restart:', postShutdownBinaries.length);
  for (const item of postShutdownBinaries) {
    console.log(` - Reopened: [${item.name}] | Size: ${item.size} bytes | Recalculated Hash: ${item.calculatedHash}`);
  }

  // Phase 8: Verify metadata connection
  const cartInfo = await browser.evaluate(`({
    items: Array.from((window.cart || new Map()).values()),
    rawLs: localStorage.getItem("cv_cart")
  })`);
  const cartItems = cartInfo.items;
  console.log('Cart metadata items connected:', cartItems.length);
  console.log('LocalStorage post-shutdown:', cartInfo.rawLs ? `${cartInfo.rawLs.length} chars` : 'null');
  for (const it of cartItems) {
    console.log(` - Metadata: [${it.title}] (tab: ${it.tab}) | File: ${it.filename} | Hash: ${it.hash}`);
  }

  const phase7Pass = postShutdownBinaries.length >= 2 &&
    postShutdownBinaries.some(b => b.calculatedHash === fixtures.fabric.hash) &&
    postShutdownBinaries.some(b => b.calculatedHash === fixtures.resourcePack.hash);

  const phase8Pass = cartItems.length >= 2 &&
    cartItems.some(it => it.hash === fixtures.fabric.hash) &&
    cartItems.some(it => it.hash === fixtures.resourcePack.hash);

  console.log('\n================================================================');
  console.log('AUDIT 2 FINAL VERDICT:');
  console.log(' - Binary Storage Survival Across Restart: ', phase7Pass ? '✅ PASS' : '❌ FAIL');
  console.log(' - Metadata-to-Binary Association:          ', phase8Pass ? '✅ PASS' : '❌ FAIL');
  console.log(' - Cryptographic Bit-for-Bit Identity:     ', (phase7Pass && phase8Pass) ? '✅ PASS' : '❌ FAIL');
  console.log('================================================================');

  await browser.close();
  process.exit((phase3Pass && phase4Pass && phase7Pass && phase8Pass) ? 0 : 1);
})().catch(err => {
  console.error('Audit 2 unhandled error:', err);
  process.exit(1);
});
