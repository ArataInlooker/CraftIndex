const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require(path.resolve(__dirname, '..', 'js', 'vendor', 'jszip.min.js'));
const CdpBrowser = require('./cdp_browser');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function createFixtures() {
  const modZip = new JSZip();
  modZip.file('fabric.mod.json', JSON.stringify({
    schemaVersion: 1,
    id: 'roundtrip_test_mod',
    version: '3.1.4',
    name: 'RoundTrip Test Mod',
    description: 'Roundtrip export-import verification mod'
  }));
  modZip.file('assets/rt_mod/lang/en_us.json', JSON.stringify({ 'item.rt_mod.gem': 'Cosmic Amethyst' }));
  const modBuf = await modZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  const rpZip = new JSZip();
  rpZip.file('pack.mcmeta', JSON.stringify({
    pack: { pack_format: 18, description: 'Roundtrip Verification Resource Pack' }
  }));
  rpZip.file('assets/minecraft/textures/item/amethyst_shard.png', Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x01, 0x02, 0x03, 0x04]));
  const rpBuf = await rpZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return {
    mod: {
      name: 'roundtrip_test_mod-3.1.4.jar',
      buffer: modBuf,
      hash: sha256(modBuf),
      size: modBuf.length
    },
    resourcePack: {
      name: 'RoundTripRP-18.zip',
      buffer: rpBuf,
      hash: sha256(rpBuf),
      size: rpBuf.length
    }
  };
}

(async () => {
  console.log('================================================================');
  console.log('AUDIT: APPLICATION-LEVEL ZIP ROUND-TRIP VERIFICATION');
  console.log('================================================================\n');

  const fixtures = await createFixtures();
  console.log('[Step 1: Test Fixtures]');
  console.log(` - Mod Fixture: ${fixtures.mod.name} (${fixtures.mod.size} B)`);
  console.log(`   Expected SHA-256: ${fixtures.mod.hash}`);
  console.log(` - Pack Fixture: ${fixtures.resourcePack.name} (${fixtures.resourcePack.size} B)`);
  console.log(`   Expected SHA-256: ${fixtures.resourcePack.hash}\n`);

  const profileDir = path.resolve(__dirname, 'chrome_roundtrip_profile');
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = new CdpBrowser({ port: 9223, userDataDir: profileDir });
  await browser.launch();
  await browser.navigate('http://localhost:3000/studio/');
  await new Promise(r => setTimeout(r, 1200));

  console.log('[Step 2: Browser Launch & Navigation]');
  const isLoaded = await browser.evaluate('Boolean(window.CraftVaultStudio)');
  console.log(' - CraftVaultStudio available:', isLoaded);
  if (!isLoaded) throw new Error('CraftVaultStudio failed to initialize in browser');

  // Convert fixtures to base64
  const modB64 = fixtures.mod.buffer.toString('base64');
  const rpB64 = fixtures.resourcePack.buffer.toString('base64');

  console.log('\n[Step 3: Initial Import into CraftIndex]');
  const initialImport = await browser.evaluate(`(async () => {
    function b64ToBlob(b64, type) {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type });
    }

    const modBlob = b64ToBlob("${modB64}", "application/java-archive");
    modBlob.name = "${fixtures.mod.name}";
    const rpBlob = b64ToBlob("${rpB64}", "application/zip");
    rpBlob.name = "${fixtures.resourcePack.name}";

    const resMod = await window.CraftVaultStudio.importZipArchive(modBlob);
    const resRp = await window.CraftVaultStudio.importZipArchive(rpBlob);

    return {
      modAdded: resMod.addedItems.length,
      rpAdded: resRp.addedItems.length,
      cartSize: window.cart ? window.cart.size : 0
    };
  })()`);
  console.log(' - Initial Import Cart Size:', initialImport.cartSize);

  console.log('\n[Step 4: Export Collection Archive from CraftIndex]');
  const exportResult = await browser.evaluate(`(async () => {
    const res = await window.CraftVaultStudio.exportCollectionZip({
      packName: 'RoundTrip-Verification-Pack',
      packDesc: 'Automated Roundtrip Audit Pack',
      mcVersion: '1.20.1',
      modLoader: 'fabric'
    });

    const ab = await res.blob.arrayBuffer();
    // Convert arrayBuffer to base64 for transfer
    let binary = '';
    const bytes = new Uint8Array(ab);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return {
      fileName: res.fileName,
      size: res.size,
      exportedCount: res.exportedCount,
      b64: btoa(binary)
    };
  })()`);

  console.log(` - Exported File: ${exportResult.fileName}`);
  console.log(` - Exported Size: ${exportResult.size} bytes`);
  console.log(` - Exported Count: ${exportResult.exportedCount} items`);

  const exportedZipBuffer = Buffer.from(exportResult.b64, 'base64');
  const exportedZip = await JSZip.loadAsync(exportedZipBuffer);

  console.log('\n[Step 5: Inspect Exported ZIP with Independent JSZip]');
  const manifestFile = exportedZip.file('craftindex_manifest.json');
  console.log(' - craftindex_manifest.json present:', Boolean(manifestFile));
  if (!manifestFile) throw new Error('Exported ZIP missing craftindex_manifest.json');

  const manifestData = JSON.parse(await manifestFile.async('string'));
  console.log(' - Manifest Schema Version:', manifestData.schema_version);
  console.log(' - Manifest Creator:', manifestData.creator);
  console.log(' - Manifest Resource Count:', manifestData.resource_count);
  console.log(' - Manifest Resources:');
  for (const r of manifestData.resources) {
    console.log(`    * [${r.name}] category: ${r.category} | path: ${r.archive_path} | hash: ${r.sha256}`);
  }

  // Verify extracted binaries match original hashes directly
  const exportedModFile = exportedZip.file(manifestData.resources.find(r => r.category === 'mods').archive_path);
  const exportedRpFile = exportedZip.file(manifestData.resources.find(r => r.category === 'resourcepacks').archive_path);

  const exportedModBuf = await exportedModFile.async('nodebuffer');
  const exportedRpBuf = await exportedRpFile.async('nodebuffer');

  const exportedModHash = sha256(exportedModBuf);
  const exportedRpHash = sha256(exportedRpBuf);

  console.log(` - Mod Hash in Exported ZIP: ${exportedModHash} (Match: ${exportedModHash === fixtures.mod.hash ? '✅' : '❌'})`);
  console.log(` - RP Hash in Exported ZIP:  ${exportedRpHash} (Match: ${exportedRpHash === fixtures.resourcePack.hash ? '✅' : '❌'})`);

  console.log('\n[Step 6: Clear CraftIndex Browser State]');
  await browser.evaluate(`(async () => {
    if (window.cart) window.cart.clear();
    localStorage.removeItem('cv_cart');
    const dbs = await window.CraftVaultStudio.idbGetAllBinaries();
    for (const b of dbs) {
      await window.CraftVaultStudio.idbDeleteBinary(b.id);
    }
  })()`);

  const postClearStatus = await browser.evaluate(`(async () => {
    const list = await window.CraftVaultStudio.idbGetAllBinaries();
    return {
      cartSize: window.cart ? window.cart.size : 0,
      idbCount: list.length
    };
  })()`);
  console.log(` - State Cleared: Cart=${postClearStatus.cartSize}, IDB=${postClearStatus.idbCount}`);

  console.log('\n[Step 7: Re-import Exported Collection ZIP into CraftIndex]');
  const reimportResult = await browser.evaluate(`(async () => {
    function b64ToBlob(b64, type) {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type });
    }

    const colBlob = b64ToBlob("${exportResult.b64}", "application/zip");
    colBlob.name = "${exportResult.fileName}";

    const res = await window.CraftVaultStudio.importZipArchive(colBlob);
    return res;
  })()`);

  console.log(' - Re-import Summary:');
  console.log(`    Total Files: ${reimportResult.totalFiles}`);
  console.log(`    Identified Mods: ${reimportResult.identifiedMods}`);
  console.log(`    Identified Resource Packs: ${reimportResult.identifiedResourcePacks}`);
  console.log(`    Added Items Count: ${reimportResult.addedItems.length}`);
  console.log(`    Manifest Detected: ${Boolean(reimportResult.craftvaultManifest)}`);

  console.log('\n[Step 8: Retrieve Re-imported Binaries from IndexedDB]');
  const reimportedDb = await browser.evaluate(`(async () => {
    const list = await window.CraftVaultStudio.idbGetAllBinaries();
    const items = [];
    for (const b of list) {
      const arr = await b.blob.arrayBuffer();
      const hash = await window.CraftVaultStudio.calculateSha256(arr);
      items.push({
        name: b.name,
        category: b.category,
        size: b.size,
        hash: hash
      });
    }
    return items;
  })()`);

  for (const b of reimportedDb) {
    console.log(` - IDB Stored: [${b.name}] (${b.size} B) | Hash: ${b.hash}`);
  }

  const modMatched = reimportedDb.some(b => b.hash === fixtures.mod.hash);
  const rpMatched = reimportedDb.some(b => b.hash === fixtures.resourcePack.hash);

  console.log('\n================================================================');
  console.log('ZIP ROUND-TRIP VERIFICATION VERDICT:');
  console.log(' - Export Manifest Validation:              ', manifestFile ? '✅ PASS' : '❌ FAIL');
  console.log(' - Export Directory Architecture:          ', (exportedModFile && exportedRpFile) ? '✅ PASS' : '❌ FAIL');
  console.log(' - Bit-for-Bit Hash Match in Export Archive: ', (exportedModHash === fixtures.mod.hash && exportedRpHash === fixtures.resourcePack.hash) ? '✅ PASS' : '❌ FAIL');
  console.log(' - Re-import Manifest Recognition:          ', reimportResult.craftvaultManifest ? '✅ PASS' : '❌ FAIL');
  console.log(' - Post Re-import IndexedDB Binary Integrity:', (modMatched && rpMatched) ? '✅ PASS' : '❌ FAIL');
  console.log('================================================================');

  await browser.close();
  const allPass = manifestFile && exportedModFile && exportedRpFile &&
    exportedModHash === fixtures.mod.hash && exportedRpHash === fixtures.resourcePack.hash &&
    reimportResult.craftvaultManifest && modMatched && rpMatched;
  process.exit(allPass ? 0 : 1);
})().catch(err => {
  console.error('Round-trip verification error:', err);
  process.exit(1);
});
