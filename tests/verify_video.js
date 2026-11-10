const path = require('path');
const CdpBrowser = require('./cdp_browser');

async function testVideo() {
  const browser = new CdpBrowser({ port: 9272, userDataDir: path.resolve(__dirname, '..', '.chrome_video_test') });
  await browser.launch();
  await browser.navigate('http://localhost:3000/media/rainy-evening-minecraft.opt.mp4');
  await new Promise(r => setTimeout(r, 1000));
  const dur1 = await browser.evaluate("document.querySelector('video') ? document.querySelector('video').duration : -1");
  console.log('rainy-evening-minecraft.opt.mp4 in Chrome duration:', dur1);

  await browser.navigate('http://localhost:3000/media/sakura-forest-minecraft.opt.mp4');
  await new Promise(r => setTimeout(r, 1000));
  const dur2 = await browser.evaluate("document.querySelector('video') ? document.querySelector('video').duration : -1");
  console.log('sakura-forest-minecraft.opt.mp4 in Chrome duration:', dur2);
  await browser.close();
}
testVideo().catch(console.error);
