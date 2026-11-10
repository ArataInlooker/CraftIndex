const path = require('path');
const fs = require('fs');
const CdpBrowser = require('./cdp_browser');

async function captureAllRemediationScreenshots() {
  console.log('================================================================');
  console.log('CAPTURING VERIFIED LIGHT & DARK THEME REMEDIATION SCREENSHOTS');
  console.log('Focus: Screenshot A (Advertise Modal) & Screenshot B (Dependencies Modal)');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9342, userDataDir: path.resolve(__dirname, '..', '.chrome_shots_qa') });
  await browser.launch();
  await browser.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const outDir = path.resolve(__dirname, 'screenshots_v261');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const theme of ['light', 'dark']) {
    console.log(`\n>>> Capturing Views for Theme: ${theme.toUpperCase()} <<<`);

    // 1. Advertise Modal (Screenshot A)
    await browser.navigate('http://localhost:3000/');
    await new Promise(r => setTimeout(r, 1000));
    await browser.evaluate(`applyAppMode('${theme}')`);
    await new Promise(r => setTimeout(r, 300));
    await browser.evaluate("openAdvertiseModal()");
    await new Promise(r => setTimeout(r, 500));
    const shotAPath = path.join(outDir, `remediation_screenshot_a_advertise_${theme}.png`);
    await browser.screenshot(shotAPath);
    console.log(`  ✓ Saved ${path.basename(shotAPath)}`);
    await browser.evaluate("md(0)");
    await new Promise(r => setTimeout(r, 300));

    // 2. Dependencies Modal (Screenshot B)
    await browser.navigate('http://localhost:3000/mods/');
    await new Promise(r => setTimeout(r, 1500));
    await browser.evaluate(`applyAppMode('${theme}')`);
    await new Promise(r => setTimeout(r, 300));
    await browser.evaluate(`(() => {
      if (window.cart) {
        window.cart.set("test_mod_for_audit", {
          k: "mr:test_mod",
          id: "test_mod",
          title: "Sodium",
          tab: "mods"
        });
      }
      openCartWithDepCheck();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    const shotBPath = path.join(outDir, `remediation_screenshot_b_dependencies_${theme}.png`);
    await browser.screenshot(shotBPath);
    console.log(`  ✓ Saved ${path.basename(shotBPath)}`);
    await browser.evaluate(`(() => {
      const m = document.getElementById('depModal');
      if (m) m.classList.remove('open');
      CraftIndexScrollLock.release('dep');
    })()`);
    await new Promise(r => setTimeout(r, 300));

    // 3. Socials Modal
    await browser.evaluate("openSocialsModal(true)");
    await new Promise(r => setTimeout(r, 500));
    const shotSocialPath = path.join(outDir, `socials_modal_${theme}.png`);
    await browser.screenshot(shotSocialPath);
    console.log(`  ✓ Saved ${path.basename(shotSocialPath)}`);
    await browser.evaluate(`(() => {
      const m = document.getElementById('socialsModal');
      if (m) m.classList.remove('open');
      CraftIndexScrollLock.release('socials');
    })()`);
    await new Promise(r => setTimeout(r, 300));

    // 4. Settings Modal
    await browser.evaluate("document.getElementById('setb').click()");
    await new Promise(r => setTimeout(r, 500));
    const shotSettingsPath = path.join(outDir, `settings_modal_${theme}.png`);
    await browser.screenshot(shotSettingsPath);
    console.log(`  ✓ Saved ${path.basename(shotSettingsPath)}`);
    await browser.evaluate("md(0)");
    await new Promise(r => setTimeout(r, 300));

    // 5. Cart Drawer
    await browser.evaluate("dr(1)");
    await new Promise(r => setTimeout(r, 500));
    const shotCartPath = path.join(outDir, `cart_drawer_${theme}.png`);
    await browser.screenshot(shotCartPath);
    console.log(`  ✓ Saved ${path.basename(shotCartPath)}`);
    await browser.evaluate("dr(0)");
    await new Promise(r => setTimeout(r, 300));
  }

  // 6. Additional Key Light Views
  console.log('\n>>> Capturing Additional Key Views in Light Theme <<<');
  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 1200));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 300));
  await browser.screenshot(path.join(outDir, '08_homepage_light.png'));
  console.log('  ✓ Saved 08_homepage_light.png');

  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 1800));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 300));
  await browser.screenshot(path.join(outDir, '09_catalog_mods_light.png'));
  console.log('  ✓ Saved 09_catalog_mods_light.png');

  await browser.navigate('http://localhost:3000/mods/sodium/');
  await new Promise(r => setTimeout(r, 2000));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 300));
  await browser.screenshot(path.join(outDir, '10_resource_detail_light.png'));
  console.log('  ✓ Saved 10_resource_detail_light.png');

  await browser.navigate('http://localhost:3000/studio/');
  await new Promise(r => setTimeout(r, 1500));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 300));
  await browser.screenshot(path.join(outDir, '11_pack_studio_light.png'));
  console.log('  ✓ Saved 11_pack_studio_light.png');

  await browser.navigate('http://localhost:3000/docs/');
  await new Promise(r => setTimeout(r, 1500));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 300));
  await browser.screenshot(path.join(outDir, '12_docs_light.png'));
  console.log('  ✓ Saved 12_docs_light.png');

  await browser.close();
  console.log('\n================================================================');
  console.log('ALL REMEDIATION SCREENSHOTS CAPTURED TO tests/screenshots_v261/');
  console.log('================================================================\n');
}

captureAllRemediationScreenshots().catch(console.error);
