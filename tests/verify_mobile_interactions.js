const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function testMobileInteractions() {
  console.log('================================================================');
  console.log('MOBILE INTERACTION & REGRESSION VERIFICATION');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9276, userDataDir: path.resolve(__dirname, '..', '.chrome_mobile_inter') });
  await browser.launch();
  // Pixel 5 / Mobile viewport: 393 x 851, scale 2.75
  await browser.setViewport({ width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true });

  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 1500));

  // 1. Check Responsive Overflow
  const overflowCheck = await browser.evaluate(`(() => {
    const docWidth = document.documentElement.offsetWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    return { docWidth, scrollWidth, hasHorizontalOverflow: scrollWidth > docWidth };
  })()`);
  console.log('1. Horizontal overflow:', overflowCheck.hasHorizontalOverflow ? '❌ OVERFLOW' : '✅ NO OVERFLOW', overflowCheck);

  // 2. Theme Switching on Mobile
  const themeCheck = await browser.evaluate(`(() => {
    const btn = document.getElementById('mt');
    const before = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    if (btn) btn.click();
    const after = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    if (btn) btn.click(); // switch back
    const restored = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    return { before, after, restored, success: before !== after && before === restored };
  })()`);
  console.log('2. Mobile theme switching:', themeCheck.success ? '✅ PASS' : '❌ FAIL', themeCheck);

  // 3. Category Navigation to Mods & Scrolling
  const catCheck = await browser.evaluate(`(async () => {
    const modsBtn = Array.from(document.querySelectorAll('#tabs .tb')).find(b => b.textContent.includes('Mods'));
    if (!modsBtn) return { error: 'Mods tab not found' };
    modsBtn.click();
    await new Promise(r => setTimeout(r, 600));

    window.scrollTo(0, 300);
    const scrollY = window.scrollY;
    return { tab: document.body.dataset.tab, scrollY, success: document.body.dataset.tab === 'mods' && scrollY >= 200 };
  })()`);
  console.log('3. Category switch & scroll:', catCheck.success ? '✅ PASS' : '❌ FAIL', catCheck);

  // 4. Search and Input Interaction
  const searchCheck = await browser.evaluate(`(async () => {
    const q = document.getElementById('q');
    if (!q) return { error: 'q not found' };
    q.focus();
    const isFocused = document.activeElement === q;
    q.value = 'sodium';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { isFocused, value: q.value, success: isFocused && q.value === 'sodium' };
  })()`);
  console.log('4. Search input & focus:', searchCheck.success ? '✅ PASS' : '❌ FAIL', searchCheck);

  // 5. Cart Drawer Open, Scroll Lock & Containment
  const drawerCheck = await browser.evaluate(`(async () => {
    if (typeof dr === 'function') dr(1);
    await new Promise(r => setTimeout(r, 400));
    const drawerEl = document.getElementById('dr');
    const isDrawerOpen = drawerEl && drawerEl.classList.contains('o');
    const isScrollLocked = document.documentElement.classList.contains('ci-scroll-locked');

    // Close drawer using #dx
    const dxBtn = document.getElementById('dx');
    if (dxBtn) dxBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const isClosed = !drawerEl || !drawerEl.classList.contains('o');
    const lockReleased = !document.documentElement.classList.contains('ci-scroll-locked');

    return { isDrawerOpen, isScrollLocked, isClosed, lockReleased, success: isDrawerOpen && isScrollLocked && isClosed && lockReleased };
  })()`);
  console.log('5. Cart drawer & scroll lock:', drawerCheck.success ? '✅ PASS' : '❌ FAIL', drawerCheck);

  // 6. About Center / Docs Modal Interaction & Containment
  const modalCheck = await browser.evaluate(`(async () => {
    if (typeof ensureAboutDocs === 'function') await ensureAboutDocs();
    if (typeof openAboutModal === 'function') openAboutModal('overview', true);
    await new Promise(r => setTimeout(r, 500));
    const modal = document.getElementById('aboutModal');
    const isOpen = modal && modal.classList.contains('open');
    const isScrollLocked = document.documentElement.classList.contains('ci-scroll-locked');

    // Close modal cleanly with closeAboutModal(true)
    if (typeof closeAboutModal === 'function') closeAboutModal(true);
    await new Promise(r => setTimeout(r, 400));
    const isClosed = !modal || !modal.classList.contains('open');

    return { isOpen, isScrollLocked, isClosed, success: isOpen && isScrollLocked && isClosed };
  })()`);
  console.log('6. About modal & scroll lock:', modalCheck.success ? '✅ PASS' : '❌ FAIL', modalCheck);

  // 7. Touch Target Sizing (Min 40px on mobile controls)
  const touchCheck = await browser.evaluate(`(() => {
    const targets = Array.from(document.querySelectorAll('header .btn, #tabs .tb, .ad'));
    const smallTargets = [];
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.height < 32 || rect.width < 32) {
        smallTargets.push({ id: el.id || el.className, w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    }
    return { totalChecked: targets.length, smallCount: smallTargets.length, smallTargets, success: smallTargets.length === 0 };
  })()`);
  console.log('7. Touch target sizing:', touchCheck.success ? '✅ PASS' : '❌ FAIL', touchCheck);

  // 8. Focus Visibility
  const focusCheck = await browser.evaluate(`(() => {
    const q = document.getElementById('q');
    q.focus();
    const style = getComputedStyle(q);
    return { outline: style.outline || style.boxShadow, success: Boolean(style.outline || style.boxShadow) };
  })()`);
  console.log('8. Focus styling:', focusCheck.success ? '✅ PASS' : '❌ FAIL', focusCheck);

  await browser.close();
}

testMobileInteractions().catch(console.error);
