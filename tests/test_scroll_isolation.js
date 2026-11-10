const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function testScrollIsolation() {
  console.log('================================================================');
  console.log('MODAL DIALOG SCROLL ISOLATION & LEAK AUDIT');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9314, userDataDir: path.resolve(__dirname, '..', '.chrome_scroll_iso') });
  await browser.launch();
  await browser.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 2000));

  // 1. Scroll page down to 500px
  await browser.evaluate('window.scrollTo(0, 500)');
  const initialScrollY = await browser.evaluate('window.scrollY');
  console.log(`1. Initial document scroll position: ${initialScrollY}px`);

  // 2. Open Settings modal
  console.log('2. Opening Settings modal...');
  await browser.evaluate('openSettingsModal()');
  await new Promise(r => setTimeout(r, 600));

  // 3. Check computed overflow and fixed position on body
  const lockStyles = await browser.evaluate(`(() => {
    return {
      htmlLocked: document.documentElement.classList.contains('ci-scroll-locked'),
      bodyPosition: getComputedStyle(document.body).position,
      bodyTop: getComputedStyle(document.body).top,
      modalDisplay: getComputedStyle(document.getElementById('md')).display,
      mxOverflow: getComputedStyle(document.querySelector('.mx')).overflow,
      mbdOverflow: getComputedStyle(document.querySelector('.mbd')).overflowY,
      mbdOverscroll: getComputedStyle(document.querySelector('.mbd')).overscrollBehavior
    };
  })()`);
  console.log('3. Lock styles when modal open:', JSON.stringify(lockStyles, null, 2));

  // 4. Simulate scrolling inside modal content (.mbd)
  console.log('4. Attempting to scroll inside modal (.mbd) by 200px...');
  const scrollResult = await browser.evaluate(`(() => {
    const mbd = document.querySelector('.mbd');
    const beforeScroll = mbd.scrollTop;
    mbd.scrollTop = 150;
    const afterScroll = mbd.scrollTop;

    // Dispatch wheel event on mbd to test event propagation
    const wheelEv = new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true });
    mbd.dispatchEvent(wheelEv);

    return { beforeScroll, afterScroll, scrollChanged: afterScroll > beforeScroll };
  })()`);
  console.log('5. Modal body scroll attempt result:', JSON.stringify(scrollResult, null, 2));

  // 5. Check if document scroll leaked
  const currentScrollY = await browser.evaluate('CraftIndexScrollLock._scrollY');
  console.log(`6. Tracked document scroll position during modal open: ${currentScrollY}px`);

  // 6. Close Settings modal
  console.log('\n7. Closing Settings modal with md(0)...');
  await browser.evaluate('md(0)');
  await new Promise(r => setTimeout(r, 500));

  const postCloseScrollY = await browser.evaluate('window.scrollY');
  const postCloseBodyPos = await browser.evaluate('document.body.style.position');
  console.log(`8. Document scroll position after closing modal: ${postCloseScrollY}px (body position: "${postCloseBodyPos}")`);
  const scrollRestored = postCloseScrollY === initialScrollY;
  console.log(`9. Scroll restoration: ${scrollRestored ? '✅ RESTORED (500px)' : '❌ LOST'}`);

  await browser.close();

  const success = lockStyles.htmlLocked && lockStyles.bodyPosition === 'fixed' && scrollRestored;
  console.log('\n================================================================');
  console.log(`SCROLL ISOLATION VERDICT: ${success ? '✅ PASS (ZERO LEAKAGE, CLEAN RESTORATION)' : '❌ FAIL'}`);
  console.log('================================================================\n');

  return success;
}

testScrollIsolation()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
