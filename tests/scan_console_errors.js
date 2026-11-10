const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function testConsoleErrors() {
  console.log('SCANNING FOR CONSOLE ERRORS ACROSS ROUTES IN CHROME...');
  const browser = new CdpBrowser({ port: 9298, userDataDir: path.resolve(__dirname, '..', '.chrome_err_scan') });
  await browser.launch();

  const errors = [];
  browser.on('Runtime.exceptionThrown', (p) => {
    errors.push({ type: 'exception', text: p.exceptionDetails.text, desc: p.exceptionDetails.exception ? p.exceptionDetails.exception.description : '' });
  });

  browser.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') {
      errors.push({ type: 'console.error', text: p.args.map(a => a.value || a.description).join(' ') });
    }
  });

  const routes = ['/', '/mods/', '/studio/', '/docs/', '/mods/sodium/'];
  for (const r of routes) {
    await browser.navigate('http://localhost:3000' + r);
    await new Promise(res => setTimeout(res, 1200));
  }

  console.log(`\nScan finished. Total console errors detected: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Errors:', JSON.stringify(errors, null, 2));
  } else {
    console.log('✅ ZERO console errors across all routes!');
  }

  await browser.close();
}

testConsoleErrors().catch(console.error);
