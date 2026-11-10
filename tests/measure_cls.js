const path = require('path');
const CdpBrowser = require('./cdp_browser');

const ROUTES = [
  '/',
  '/mods/',
  '/plugins/',
  '/resourcepacks/',
  '/shaders/',
  '/datapacks/',
  '/docs/',
  '/studio/',
  '/mods/sodium/'
];
const BASE = 'http://localhost:3000';

const COLLECTOR = `
(() => {
  window.__perf = { lcp: null, fcp: null, cls: 0, shifts: [], longTasks: [] };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.entryType === 'largest-contentful-paint') window.__perf.lcp = Math.round(e.startTime);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.name === 'first-contentful-paint') window.__perf.fcp = Math.round(e.startTime);
      }
    }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) {
          window.__perf.cls += e.value;
          const shiftDetail = {
            v: +e.value.toFixed(4),
            t: Math.round(e.startTime),
            sources: (e.sources || []).map(s => {
              const node = s.node || s.previousElement;
              let desc = '?';
              if (node) {
                const tag = node.tagName ? node.tagName.toLowerCase() : '';
                const id = node.id ? '#' + node.id : '';
                const cls = node.className && typeof node.className === 'string' ? '.' + node.className.trim().split(/\\s+/)[0] : '';
                desc = tag + id + cls;
              }
              return {
                el: desc,
                prev: s.previousRect ? { x: Math.round(s.previousRect.x), y: Math.round(s.previousRect.y), w: Math.round(s.previousRect.width), h: Math.round(s.previousRect.height) } : null,
                curr: s.currentRect ? { x: Math.round(s.currentRect.x), y: Math.round(s.currentRect.y), w: Math.round(s.currentRect.width), h: Math.round(s.currentRect.height) } : null
              };
            })
          };
          window.__perf.shifts.push(shiftDetail);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.longTasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
})();
`;

async function main() {
  const browser = new CdpBrowser({ port: 9260, userDataDir: path.resolve(__dirname, '..', '.chrome_cls_profile') });
  await browser.launch();
  // Mobile viewport: 390x844, 4x CPU throttle, 1.6 Mbps network (Slow 4G / standard mobile audit)
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await browser.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await browser.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: COLLECTOR });

  console.log('ROUTE | CLS | SHIFTS COUNT | TOP ATTRIBUTIONS');
  for (const route of ROUTES) {
    await browser.navigate(BASE + route);
    await new Promise(r => setTimeout(r, 3500));
    const out = await browser.evaluate('(() => { var r = window.__perf; return { cls: +r.cls.toFixed(4), shifts: r.shifts, fcp: r.fcp, lcp: r.lcp }; })()');
    console.log(route.padEnd(18) + ' | CLS: ' + String(out.cls).padEnd(6) + ' | Shifts: ' + String(out.shifts.length).padEnd(3) + ' | FCP: ' + String(out.fcp).padEnd(5) + ' | LCP: ' + String(out.lcp).padEnd(5));
    if (out.shifts.length > 0) {
      console.log('   Attributions:', JSON.stringify(out.shifts));
    }
  }
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
