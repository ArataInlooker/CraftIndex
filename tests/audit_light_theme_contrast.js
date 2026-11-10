const path = require('path');
const CdpBrowser = require('./cdp_browser');

// Standard WCAG 2.2 relative luminance formula
function sRgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function getLuminance(rgb) {
  return 0.2126 * sRgbToLinear(rgb.r) + 0.7152 * sRgbToLinear(rgb.g) + 0.0722 * sRgbToLinear(rgb.b);
}

function calculateWcagContrast(rgb1, rgb2) {
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const rawRatio = (lighter + 0.05) / (darker + 0.05);
  // Strictly truncate to 2 decimal places: never round a failing value upward!
  const formattedRatio = (Math.floor(rawRatio * 100) / 100).toFixed(2);
  return {
    raw: rawRatio,
    formatted: formattedRatio
  };
}

// WCAG Large Scale Text determination
// Large-scale is defined as at least 18pt (24px) regular, or at least 14pt (18.66px) bold (>=700)
function isWcagLargeScale(fontSizePx, fontWeight) {
  if (fontSizePx >= 24) return true;
  if (fontSizePx >= 18.66 && fontWeight >= 700) return true;
  return false;
}

async function runComprehensiveContrastAudit() {
  console.log('================================================================');
  console.log('COMPREHENSIVE LIGHT THEME CONTRAST & ACCESSIBILITY AUDIT (WCAG 2.2 AA)');
  console.log('Precision: Exact sRGB Luminance Truncated to 2 Decimals (No Upward Rounding)');
  console.log('Large Scale Text: Strictly >=24px or >=18.66px Bold (>=700)');
  console.log('================================================================\n');

  const browser = new CdpBrowser({ port: 9350, userDataDir: path.resolve(__dirname, '..', '.chrome_comp_contrast_qa') });
  await browser.launch();
  await browser.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const auditLedger = [];

  const extractorCode = `
    function parseRgba(str) {
      if (!str) return null;
      const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
      if (!m) return null;
      return {
        r: parseInt(m[1], 10),
        g: parseInt(m[2], 10),
        b: parseInt(m[3], 10),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1
      };
    }

    function getEffectiveOpacity(el) {
      let op = 1;
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const s = getComputedStyle(cur);
        op *= parseFloat(s.opacity || 1);
        cur = cur.parentElement;
      }
      return op;
    }

    function getCompositedBg(el, defaultBase) {
      // Primary / big buttons with solid gradients
      const s = getComputedStyle(el);
      if (s.backgroundImage && (el.classList.contains('p') || el.classList.contains('big') || el.classList.contains('ad-special-badge'))) {
        if (el.classList.contains('ad-special-badge')) return { r: 4, g: 120, b: 87, a: 1 };
        return { r: 147, g: 51, b: 234, a: 1 };
      }

      const layers = [];
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const cs = getComputedStyle(cur);
        const bg = cs.backgroundColor;
        const parsed = parseRgba(bg);
        if (parsed && parsed.a > 0) layers.unshift(parsed);
        cur = cur.parentElement;
      }
      let base = defaultBase;
      for (const l of layers) {
        base = {
          r: Math.round(l.r * l.a + base.r * (1 - l.a)),
          g: Math.round(l.g * l.a + base.g * (1 - l.a)),
          b: Math.round(l.b * l.a + base.b * (1 - l.a)),
          a: 1
        };
      }
      return base;
    }

    function auditSelectors(viewName, routeUrl, targetList) {
      const baseCanvas = { r: 248, g: 244, b: 252, a: 1 };
      const out = [];

      for (const item of targetList) {
        const elements = Array.from(document.querySelectorAll(item.sel));
        let count = 0;
        let skipped = 0;

        for (const el of elements) {
          if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) {
            skipped++;
            continue;
          }
          const text = el.textContent.trim();
          if (!text) {
            skipped++;
            continue;
          }

          const s = getComputedStyle(el);
          const rawFg = parseRgba(s.color);
          if (!rawFg) {
            skipped++;
            continue;
          }

          const bg = getCompositedBg(el, baseCanvas);
          const effectiveOp = getEffectiveOpacity(el);
          const finalAlpha = rawFg.a * effectiveOp;

          const effectiveFg = {
            r: Math.round(rawFg.r * finalAlpha + bg.r * (1 - finalAlpha)),
            g: Math.round(rawFg.g * finalAlpha + bg.g * (1 - finalAlpha)),
            b: Math.round(rawFg.b * finalAlpha + bg.b * (1 - finalAlpha)),
            a: 1
          };

          count++;
          out.push({
            view: viewName,
            route: routeUrl,
            component: item.name,
            sel: item.sel,
            textSample: text.slice(0, 40).replace(/\\s+/g, ' '),
            fg: effectiveFg,
            bg,
            effectiveOp: +effectiveOp.toFixed(3),
            fontSize: parseFloat(s.fontSize),
            fontWeight: parseInt(s.fontWeight, 10),
            tag: el.tagName.toLowerCase()
          });
          if (item.single && count >= 1) break;
        }
      }
      return out;
    }
  `;

  // Route 1: Homepage (/)
  console.log('>>> 1. Auditing Homepage (/) in Light Theme <<<');
  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 1200));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 400));

  const homeItems = await browser.evaluate(`(() => {
    ${extractorCode}
    return auditSelectors('Homepage', '/', [
      { sel: '#lg span', name: 'Header Brand Name', single: true },
      { sel: 'header .btn:not(#mt)', name: 'Header Action Button', single: true },
      { sel: '#cb', name: 'Header Collection Button', single: true },
      { sel: '.home-ad-btn', name: 'Promote Project Hero Action', single: true },
      { sel: '.home-cat-btn', name: 'Explore Category Hero Action', single: true },
      { sel: '.site-footer-author', name: 'Footer Text', single: true },
      { sel: '.site-footer-author a', name: 'Footer Link', single: true }
    ]);
  })()`);
  console.log(`  Audited ${homeItems.length} elements on Homepage.`);
  auditLedger.push(...homeItems);

  // Route 2: Mods Category (/mods/)
  console.log('>>> 2. Auditing Mods Category (/mods/) in Light Theme <<<');
  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 1500));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 400));

  const modsItems = await browser.evaluate(`(() => {
    ${extractorCode}
    return auditSelectors('Catalog Mods', '/mods/', [
      { sel: '.tb.on', name: 'Active Category Tab (Mods)', single: true },
      { sel: '.tb:not(.on)', name: 'Inactive Category Tab', single: true },
      { sel: '.subtab-btn.on', name: 'Active Subtab (Mods)', single: true },
      { sel: '.subtab-btn:not(.on)', name: 'Inactive Subtab', single: true },
      { sel: '#q', name: 'Search Input Text', single: true },
      { sel: '.cd h3 a', name: 'Mod Card Title', single: true },
      { sel: '.by', name: 'Mod Card Author', single: true },
      { sel: '.ds', name: 'Mod Card Description', single: true },
      { sel: '.cat-mods', name: 'Mods Category Chip', single: true },
      { sel: '.source-link.modrinth', name: 'Modrinth Source Link', single: true },
      { sel: '.source-link.curseforge', name: 'CurseForge Source Link', single: true },
      { sel: '.act .btn.ad', name: 'Primary Add to Collection', single: true },
      { sel: '.btn-info', name: 'Info Button', single: true }
    ]);
  })()`);
  console.log(`  Audited ${modsItems.length} elements on /mods/.`);
  auditLedger.push(...modsItems);

  // Routes 3-9: All Other Category Badges (Plugins, Shaders, Resourcepacks, Datapacks, Modpacks, Worlds, Serversoftwares)
  console.log('>>> 3. Auditing All Resource Categories Badges & Chips in Light Theme <<<');
  const catRoutes = [
    { cat: 'Plugins', path: '/plugins/', sel: '.cat-plugins', name: 'Plugins Category Chip' },
    { cat: 'Resourcepacks', path: '/resourcepacks/', sel: '.cat-resourcepacks', name: 'Resource Packs Chip' },
    { cat: 'Shaders', path: '/shaders/', sel: '.cat-shaders', name: 'Shaders Category Chip' },
    { cat: 'Datapacks', path: '/datapacks/', sel: '.cat-datapacks', name: 'Datapacks Category Chip' },
    { cat: 'Modpacks', path: '/modpacks/', sel: '.cat-modpacks', name: 'Modpacks Category Chip' },
    { cat: 'Worlds', path: '/worlds/', sel: '.cat-worlds', name: 'Worlds Category Chip' },
    { cat: 'Server Software', path: '/serversoftwares/', sel: '.cat-serversoftwares', name: 'Server Software Chip' }
  ];

  for (const cr of catRoutes) {
    await browser.navigate('http://localhost:3000' + cr.path);
    await new Promise(r => setTimeout(r, 1800));
    await browser.evaluate("applyAppMode('light')");
    await new Promise(r => setTimeout(r, 400));

    const catItem = await browser.evaluate(`(() => {
      ${extractorCode}
      return auditSelectors('${cr.cat}', '${cr.path}', [
        { sel: '${cr.sel}', name: '${cr.name}', single: true },
        { sel: '.cd h3 a', name: '${cr.cat} Resource Title', single: true }
      ]);
    })()`);
    console.log(`  Audited ${catItem.length} elements on ${cr.path}.`);
    auditLedger.push(...catItem);
  }

  // Route 10: Resource Detail Page (/mods/sodium/)
  console.log('>>> 4. Auditing Resource Detail Page (/mods/sodium/) in Light Theme <<<');
  await browser.navigate('http://localhost:3000/mods/sodium/');
  await new Promise(r => setTimeout(r, 2000));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 400));

  const resourceDetailItems = await browser.evaluate(`(() => {
    ${extractorCode}
    return auditSelectors('Resource Detail', '/mods/sodium/', [
      { sel: '.rp-breadcrumb a', name: 'Resource Breadcrumb Link', single: true },
      { sel: '.rp-breadcrumb [aria-current="page"]', name: 'Resource Breadcrumb Active Page', single: true },
      { sel: '.dash-tab.active', name: 'Dashboard Active Tab', single: true },
      { sel: '.dash-tab:not(.active)', name: 'Dashboard Inactive Tab', single: true },
      { sel: '.dash-author', name: 'Resource Author Label', single: true },
      { sel: '.dash-author b', name: 'Resource Author Name', single: true },
      { sel: '#dashCartBtn', name: 'Dashboard Add to Cart Action', single: true },
      { sel: '#dashCloseBtn', name: 'Dashboard Close Button', single: true }
    ]);
  })()`);
  console.log(`  Audited ${resourceDetailItems.length} elements on /mods/sodium/.`);
  auditLedger.push(...resourceDetailItems);

  // Route 11: Pack Studio (/studio/)
  console.log('>>> 5. Auditing Pack Studio (/studio/) in Light Theme <<<');
  await browser.navigate('http://localhost:3000/studio/');
  await new Promise(r => setTimeout(r, 1600));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 400));

  const studioItems = await browser.evaluate(`(() => {
    ${extractorCode}
    return auditSelectors('Pack Studio', '/studio/', [
      { sel: '.studio-title', name: 'Studio Main Heading', single: true },
      { sel: '.studio-subtitle', name: 'Studio Subtitle', single: true },
      { sel: '.studio-section-title', name: 'Studio Section Heading', single: true },
      { sel: '.studio-card-sub', name: 'Studio Card Subtitle', single: true },
      { sel: '#studioImportBtn', name: 'Studio Primary Import Button', single: true },
      { sel: '#studioExportBtn', name: 'Studio Secondary Export Button', single: true },
      { sel: '#studioClearBtn', name: 'Studio Destructive Clear Button', single: true }
    ]);
  })()`);
  console.log(`  Audited ${studioItems.length} elements on /studio/.`);
  auditLedger.push(...studioItems);

  // Route 12: Documentation Center (/docs/)
  console.log('>>> 6. Auditing Documentation Center (/docs/) in Light Theme <<<');
  await browser.navigate('http://localhost:3000/docs/');
  await new Promise(r => setTimeout(r, 1600));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 400));

  const docsItems = await browser.evaluate(`(() => {
    ${extractorCode}
    return auditSelectors('Documentation', '/docs/', [
      { sel: '.doc-main-title', name: 'Documentation Title', single: true },
      { sel: '.doc-tagline', name: 'Documentation Tagline', single: true },
      { sel: '.doc-lead-desc', name: 'Documentation Lead Paragraph', single: true },
      { sel: '.doc-section-h3', name: 'Article Section Heading', single: true },
      { sel: '.doc-callout-title', name: 'Documentation Callout Title', single: true },
      { sel: '.doc-pill-btn:not(.secondary)', name: 'Documentation Primary Link', single: true },
      { sel: '.doc-pill-btn.secondary', name: 'Documentation Secondary Link', single: true }
    ]);
  })()`);
  console.log(`  Audited ${docsItems.length} elements on /docs/.`);
  auditLedger.push(...docsItems);

  // Modal 1: Advertise on CraftIndex Modal (Screenshot A Reproduction)
  console.log('>>> 7. Auditing Advertise on CraftIndex Modal (Screenshot A) <<<');
  await browser.navigate('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 1000));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 300));
  await browser.evaluate("openAdvertiseModal()");
  await new Promise(r => setTimeout(r, 500));

  const adModalItems = await browser.evaluate(`(() => {
    ${extractorCode}
    const modal = document.querySelector('.mx.ad-mode');
    return auditSelectors('Advertise Modal', 'modal:ad', [
      { sel: '#mh', name: 'Modal Header Title', single: true },
      { sel: '.ad-special-banner-lead', name: 'Special Banner Lead Text', single: true },
      { sel: '.ad-special-rate-text', name: 'Special Rate Price Label', single: true },
      { sel: '.ad-special-badge', name: 'Special Rate Chip Badge', single: true },
      { sel: '.ad-section-heading', name: 'Section Heading', single: true },
      { sel: '.ad-promote-card', name: 'Promote Item Tag Card', single: true },
      { sel: '.ad-placement-list li', name: 'Placement Option Bullet', single: true },
      { sel: '.ad-placement-list b', name: 'Placement Option Bold Title', single: true },
      { sel: '.ad-apply-title', name: 'How to Apply Title', single: true },
      { sel: '.ad-apply-desc', name: 'How to Apply Description', single: true }
    ]);
  })()`);
  console.log(`  Audited ${adModalItems.length} elements in Advertise Modal.`);
  auditLedger.push(...adModalItems);
  await browser.evaluate("md(0)");
  await new Promise(r => setTimeout(r, 300));

  // Modal 2: Include Resource Dependencies Modal (Screenshot B Reproduction)
  console.log('>>> 8. Auditing Dependencies Modal (Screenshot B) <<<');
  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 1200));
  await browser.evaluate("applyAppMode('light')");
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

  const depModalItems = await browser.evaluate(`(() => {
    ${extractorCode}
    const modal = document.getElementById('depModal');
    return auditSelectors('Dependencies Modal', 'modal:dep', [
      { sel: '.dep-title', name: 'Dialog Heading Title', single: true },
      { sel: '.dep-sub', name: 'Dialog Subtitle Lead', single: true },
      { sel: '.dep-intro-text', name: 'Category Selection Lead', single: true },
      { sel: '.dep-cb-label', name: 'Checkbox Label Text', single: true },
      { sel: '.dep-cb-count', name: 'Category Count Badge', single: true },
      { sel: '.dep-callout-text', name: 'Fabric API Callout Text', single: true },
      { sel: '.dep-callout-highlight', name: 'Fabric API Auto-include Text', single: true },
      { sel: '#depSkipBtn', name: 'Skip Action Button', single: true },
      { sel: '#depConfirmBtn', name: 'Confirm Action Button', single: true }
    ]);
  })()`);
  console.log(`  Audited ${depModalItems.length} elements in Dependencies Modal.`);
  auditLedger.push(...depModalItems);
  await browser.evaluate(`(() => {
    const m = document.getElementById('depModal');
    if (m) m.classList.remove('open');
    CraftIndexScrollLock.release('dep');
  })()`);
  await new Promise(r => setTimeout(r, 300));

  // Modal 3: Socials Modal
  console.log('>>> 9. Auditing Socials Modal in Light Theme <<<');
  await browser.evaluate("openSocialsModal(true)");
  await new Promise(r => setTimeout(r, 500));

  const socialsModalItems = await browser.evaluate(`(() => {
    ${extractorCode}
    const modal = document.getElementById('socialsModal');
    return auditSelectors('Socials Modal', 'modal:socials', [
      { sel: '.creator-name', name: 'Creator Profile Name', single: true },
      { sel: '.creator-role', name: 'Creator Role Subtitle', single: true },
      { sel: '.creator-bio', name: 'Creator Bio Description', single: true },
      { sel: '.social-platform-title', name: 'Social Platform Title', single: true },
      { sel: '.social-username', name: 'Social Username Handle', single: true },
      { sel: '.social-card-desc', name: 'Social Card Description', single: true }
    ]);
  })()`);
  console.log(`  Audited ${socialsModalItems.length} elements in Socials Modal.`);
  auditLedger.push(...socialsModalItems);
  await browser.evaluate(`(() => {
    const m = document.getElementById('socialsModal');
    if (m) m.classList.remove('open');
    CraftIndexScrollLock.release('socials');
  })()`);
  await new Promise(r => setTimeout(r, 300));

  // Modal 4: Settings Modal
  console.log('>>> 10. Auditing Settings Modal in Light Theme <<<');
  await browser.evaluate("document.getElementById('setb').click()");
  await new Promise(r => setTimeout(r, 500));

  const settingsModalItems = await browser.evaluate(`(() => {
    ${extractorCode}
    const modal = document.querySelector('.mx.settings-mode');
    return auditSelectors('Settings Modal', 'modal:settings', [
      { sel: '.mh', name: 'Settings Modal Header', single: true },
      { sel: '.settings-section-title', name: 'Settings Section Title', single: true },
      { sel: '.settings-label', name: 'Option Title Label', single: true },
      { sel: '.settings-desc', name: 'Option Description Text', single: true },
      { sel: '.settings-helper-text', name: 'Sources Matrix Callout', single: true },
      { sel: '#set-cancel-btn', name: 'Settings Cancel Button', single: true },
      { sel: '#set-save-btn', name: 'Settings Save Button', single: true }
    ]);
  })()`);
  console.log(`  Audited ${settingsModalItems.length} elements in Settings Modal.`);
  auditLedger.push(...settingsModalItems);
  await browser.evaluate("md(0)");
  await new Promise(r => setTimeout(r, 300));

  // Overlay 5: Cart Drawer
  console.log('>>> 11. Auditing Cart Drawer in Light Theme <<<');
  await browser.evaluate("dr(1)");
  await new Promise(r => setTimeout(r, 500));

  const cartDrawerItems = await browser.evaluate(`(() => {
    ${extractorCode}
    const drawer = document.getElementById('dr');
    return auditSelectors('Cart Drawer', 'drawer:cart', [
      { sel: '.dr-title', name: 'Drawer Header Title', single: true },
      { sel: '.dr-tool-btn', name: 'Drawer Export Icon Button', single: true },
      { sel: '#am', name: 'Add More Secondary Action', single: true },
      { sel: '#dd', name: 'Download Primary Action', single: true }
    ]);
  })()`);
  console.log(`  Audited ${cartDrawerItems.length} elements in Cart Drawer.`);
  auditLedger.push(...cartDrawerItems);
  await browser.evaluate("dr(0)");
  await new Promise(r => setTimeout(r, 300));

  await browser.close();

  // Evaluate WCAG Ratios with Exact 2-Decimal Mathematical Truncation
  console.log('\n================================================================');
  console.log('AUDIT EVALUATION LEDGER (EXACT 2-DECIMAL PRECISION)');
  console.log('================================================================\n');

  const evaluated = [];
  const failures = [];

  for (const item of auditLedger) {
    const isLarge = isWcagLargeScale(item.fontSize, item.fontWeight);
    const minRequired = isLarge ? 3.0 : 4.5;
    const { raw, formatted } = calculateWcagContrast(item.fg, item.bg);
    const pass = raw >= minRequired && item.effectiveOp >= 0.70;

    const entry = {
      ...item,
      isLarge,
      minRequired,
      rawRatio: raw,
      formattedRatio: formatted,
      pass
    };
    evaluated.push(entry);
    if (!pass) failures.push(entry);

    const fgHex = '#' + [item.fg.r, item.fg.g, item.fg.b].map(x => x.toString(16).padStart(2, '0')).join('');
    const bgHex = '#' + [item.bg.r, item.bg.g, item.bg.b].map(x => x.toString(16).padStart(2, '0')).join('');
    console.log(`[${item.view.padEnd(18)}] ${item.component.padEnd(30)} | CR: ${formatted.padStart(5)}:1 (req: ${minRequired.toFixed(1)}) | Size: ${item.fontSize}px (w:${item.fontWeight}) [${isLarge ? 'LARGE' : 'BODY '}] | FG: ${fgHex} | BG: ${bgHex} => ${pass ? '✅ PASS' : '❌ FAIL'}`);
  }

  console.log('\n================================================================');
  console.log(`TOTAL AUDITED COMPONENT ELEMENTS: ${evaluated.length}`);
  console.log(`FAILURES DETECTED:                ${failures.length}`);
  console.log(`AUDIT VERDICT:                    ${failures.length === 0 ? '✅ 100% WCAG 2.2 AA PASS' : '❌ DEFECTS DETECTED'}`);
  console.log('================================================================\n');

  // Five Lowest Contrast Ratios
  const sorted = [...evaluated].sort((a, b) => a.rawRatio - b.rawRatio);
  console.log('FIVE LOWEST MEASURED CONTRAST RATIOS (MATHEMATICAL TRUNCATION):');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const it = sorted[i];
    const fgHex = '#' + [it.fg.r, it.fg.g, it.fg.b].map(x => x.toString(16).padStart(2, '0')).join('');
    const bgHex = '#' + [it.bg.r, it.bg.g, it.bg.b].map(x => x.toString(16).padStart(2, '0')).join('');
    console.log(`  ${i + 1}. [CR: ${it.formattedRatio}:1] (${it.pass ? 'PASS' : 'FAIL'}) ${it.component} in ${it.view} (FG: ${fgHex}, BG: ${bgHex}, Size: ${it.fontSize}px w:${it.fontWeight}, Req: ${it.minRequired.toFixed(1)}:1)`);
  }

  // Save full JSON audit data to disk for maintainer inspection
  const reportPath = path.resolve(__dirname, '..', 'information', 'RAW_LIGHT_THEME_CONTRAST_AUDIT.json');
  const summary = {
    timestamp: new Date().toISOString(),
    specification: 'WCAG 2.2 AA',
    totalAudited: evaluated.length,
    failuresCount: failures.length,
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    lowestFiveRatios: sorted.slice(0, 5).map(it => ({
      component: it.component,
      view: it.view,
      contrastRatio: it.formattedRatio,
      rawRatio: it.rawRatio,
      required: it.minRequired,
      fontSize: it.fontSize,
      fontWeight: it.fontWeight,
      isLarge: it.isLarge,
      fgHex: '#' + [it.fg.r, it.fg.g, it.fg.b].map(x => x.toString(16).padStart(2, '0')).join(''),
      bgHex: '#' + [it.bg.r, it.bg.g, it.bg.b].map(x => x.toString(16).padStart(2, '0')).join('')
    })),
    evaluated
  };
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nRaw contrast audit JSON saved to: ${reportPath}`);

  return { evaluated, failures, allPass: failures.length === 0 };
}

runComprehensiveContrastAudit()
  .then(({ allPass }) => process.exit(allPass ? 0 : 1))
  .catch((err) => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
