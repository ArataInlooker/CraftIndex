const cp = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

class CdpBrowser {
  constructor(options = {}) {
    this.port = options.port || 9222;
    this.userDataDir = options.userDataDir || path.resolve(__dirname, '..', '.test_profile');
    this.chromePath = options.chromePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    this.proc = null;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  async launch() {
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    const args = [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--disable-gpu',
      'about:blank'
    ];

    this.proc = cp.spawn(this.chromePath, args, { stdio: 'ignore' });

    // Wait for debugging port to respond
    let target = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const json = await this._httpGet(`http://127.0.0.1:${this.port}/json/list`);
        const list = JSON.parse(json);
        target = list.find(t => t.type === 'page');
        if (target && target.webSocketDebuggerUrl) break;
      } catch (_) {}
    }

    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome debugging endpoint');
    }

    // Connect WebSocket
    this.ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        } else if (data.method && this.eventListeners.has(data.method)) {
          for (const cb of this.eventListeners.get(data.method)) {
            try { cb(data.params); } catch (_) {}
          }
        }
      } catch (_) {}
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setCacheDisabled', { cacheDisabled: true });
  }

  on(method, callback) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, new Set());
    }
    this.eventListeners.get(method).add(callback);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url) {
    const res = await this.send('Page.navigate', { url });
    // Wait for load
    await new Promise(r => setTimeout(r, 600));
    return res;
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception.description || 'Evaluation exception');
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(outPath, options = {}) {
    const res = await this.send('Page.captureScreenshot', {
      format: options.format || 'png',
      quality: options.quality,
      clip: options.clip
    });
    const buf = Buffer.from(res.data, 'base64');
    if (outPath) {
      fs.writeFileSync(outPath, buf);
    }
    return buf;
  }

  async setViewport({ width, height, deviceScaleFactor = 1, isMobile = false }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: isMobile
    });
  }

  async close() {
    try {
      if (this.ws && this.ws.readyState === 1) {
        await this.send('Browser.close');
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (_) {}
    try {
      if (this.ws) this.ws.close();
    } catch (_) {}
    if (this.proc && this.proc.pid) {
      try {
        if (process.platform === 'win32') {
          cp.execSync(`taskkill /F /T /PID ${this.proc.pid}`, { stdio: 'ignore' });
        } else {
          this.proc.kill('SIGKILL');
        }
      } catch (_) {}
      this.proc = null;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  _httpGet(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }
}

module.exports = CdpBrowser;
