const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function testBothThemes() {
  console.log('Testing Both Themes for Visual Regressions...');
  const browser = new CdpBrowser({ port: 9285, userDataDir: path.resolve(__dirname, '..', '.chrome_themes_test') });
  await browser.launch();

  for (const theme of ['dark', 'light']) {
    console.log(`\n=== Testing Theme: ${theme.toUpperCase()} ===`);
    await browser.navigate('http://localhost:3000/mods/');
    await new Promise(r => setTimeout(r, 1200));

    await browser.evaluate(`applyAppMode('${theme}')`);
    await new Promise(r => setTimeout(r, 400));

    const check = await browser.evaluate(`(() => {
      const activeTab = document.querySelector('.tb.on');
      const firstCatBadge = document.querySelector('.card-cat-badge');
      const firstSourceLink = document.querySelector('.source-link');
      const firstAddBtn = document.querySelector('.act .ad');
      const firstInfoBtn = document.querySelector('.act .btn-info');

      return {
        activeTab: activeTab ? { text: activeTab.textContent.trim(), color: getComputedStyle(activeTab).color, bg: getComputedStyle(activeTab).background } : null,
        badge: firstCatBadge ? { text: firstCatBadge.textContent.trim(), color: getComputedStyle(firstCatBadge).color, bg: getComputedStyle(firstCatBadge).background } : null,
        source: firstSourceLink ? { text: firstSourceLink.textContent.trim(), color: getComputedStyle(firstSourceLink).color, bg: getComputedStyle(firstSourceLink).background } : null,
        addBtn: firstAddBtn ? { text: firstAddBtn.textContent.trim(), color: getComputedStyle(firstAddBtn).color, height: firstAddBtn.offsetHeight } : null,
        infoBtn: firstInfoBtn ? { text: firstInfoBtn.textContent.trim(), height: firstInfoBtn.offsetHeight } : null
      };
    })()`);

    console.log(`Results for ${theme}:`, JSON.stringify(check, null, 2));
  }

  await browser.close();
}
testBothThemes().catch(console.error);
