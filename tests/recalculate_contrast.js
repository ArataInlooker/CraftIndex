const path = require('path');
const CdpBrowser = require('./cdp_browser');

function parseRgba(str) {
  if (!str) return null;
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return {
    r: parseInt(m[1], 10),
    g: parseInt(m[2], 10),
    b: parseInt(m[3], 10),
    a: m[4] !== undefined ? parseFloat(m[4]) : 1
  };
}

function sRgbToLinear(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getLuminance(rgb) {
  const r = sRgbToLinear(rgb.r);
  const g = sRgbToLinear(rgb.g);
  const b = sRgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const top = Math.max(l1, l2) + 0.05;
  const bot = Math.min(l1, l2) + 0.05;
  return +(top / bot).toFixed(2);
}

// Composites fgColor over bgColor with alpha
function compositeOver(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 255, g: 255, b: 255, a: 1 };
  const r = Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a);
  const g = Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a);
  const b = Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a);
  return { r, g, b, a: 1 };
}

async function auditContrast() {
  const browser = new CdpBrowser({ port: 9290, userDataDir: path.resolve(__dirname, '..', '.chrome_qa_contrast') });
  await browser.launch();
  await browser.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // Navigate to /mods/ in Light Theme
  await browser.navigate('http://localhost:3000/mods/');
  await new Promise(r => setTimeout(r, 1500));
  await browser.evaluate("applyAppMode('light')");
  await new Promise(r => setTimeout(r, 600));

  // Extract all badge elements and their composited background colors
  const items = await browser.evaluate(`(() => {
    function parseRgbaStr(str) {
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

    // Traverse ancestors and composite all background layers down to base
    function getCompositedBackground(el) {
      const layers = [];
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const style = getComputedStyle(cur);
        const bg = style.backgroundColor;
        const parsed = parseRgbaStr(bg);
        if (parsed && parsed.a > 0) {
          layers.unshift(parsed);
        }
        cur = cur.parentElement;
      }

      // Base body color for CraftIndex light mode is #f8f4fc (rgb(248, 244, 252))
      let base = { r: 248, g: 244, b: 252, a: 1 };
      for (const layer of layers) {
        base = {
          r: Math.round(layer.r * layer.a + base.r * (1 - layer.a)),
          g: Math.round(layer.g * layer.a + base.g * (1 - layer.a)),
          b: Math.round(layer.b * layer.a + base.b * (1 - layer.a)),
          a: 1
        };
      }
      return base;
    }

    const targets = [
      { id: 'activeTab', sel: '.tb.on', label: 'Active Tab' },
      { id: 'catMods', sel: '.cat-mods', label: 'Mods Badge' },
      { id: 'catPlugins', sel: '.cat-plugins', label: 'Plugins Badge' },
      { id: 'catResourcepacks', sel: '.cat-resourcepacks', label: 'Resource Packs Badge' },
      { id: 'catShaders', sel: '.cat-shaders', label: 'Shaders Badge' },
      { id: 'catDatapacks', sel: '.cat-datapacks', label: 'Datapacks Badge' },
      { id: 'catModpacks', sel: '.cat-modpacks', label: 'Modpacks Badge' },
      { id: 'catWorlds', sel: '.cat-worlds', label: 'Worlds Badge' },
      { id: 'catServersoftwares', sel: '.cat-serversoftwares', label: 'Server Software Badge' },
      { id: 'catModloaders', sel: '.cat-modloaders', label: 'Modloaders Badge' },
      { id: 'catDependencies', sel: '.cat-dependencies', label: 'Dependencies Badge' },
      { id: 'sourceModrinth', sel: '.source-link.modrinth', label: 'Modrinth Link' },
      { id: 'sourceCurseforge', sel: '.source-link.curseforge', label: 'CurseForge Link' },
      { id: 'studioActionDanger', sel: '.studio-action-tool-btn.danger', label: 'Studio Danger Action' }
    ];

    const results = [];
    // Inject mock elements if some categories are not on the current view to measure them accurately
    const mockContainer = document.createElement('div');
    mockContainer.className = 'cd';
    mockContainer.style.position = 'absolute';
    mockContainer.style.left = '-9999px';
    mockContainer.innerHTML = \`
      <span class="card-cat-badge cat-mods">Mods</span>
      <span class="card-cat-badge cat-plugins">Plugins</span>
      <span class="card-cat-badge cat-resourcepacks">Resource Packs</span>
      <span class="card-cat-badge cat-shaders">Shaders</span>
      <span class="card-cat-badge cat-datapacks">Datapacks</span>
      <span class="card-cat-badge cat-modpacks">Modpacks</span>
      <span class="card-cat-badge cat-worlds">Worlds</span>
      <span class="card-cat-badge cat-serversoftwares">Server Software</span>
      <span class="card-cat-badge cat-modloaders">Modloaders</span>
      <span class="card-cat-badge cat-dependencies">Dependencies</span>
      <a class="source-link modrinth">Modrinth</a>
      <a class="source-link curseforge">CurseForge</a>
      <button class="studio-action-tool-btn danger">Clear</button>
    \`;
    document.body.appendChild(mockContainer);

    for (const t of targets) {
      const el = document.querySelector(t.sel);
      if (el) {
        const s = getComputedStyle(el);
        const fg = parseRgbaStr(s.color);
        const bg = getCompositedBackground(el);
        results.push({
          label: t.label,
          colorRaw: s.color,
          bgRaw: s.backgroundColor,
          fg,
          bg,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight
        });
      }
    }
    mockContainer.remove();
    return results;
  })()`);

  console.log('================================================================');
  console.log('PRECISE WCAG CONTRAST AUDIT (COMPOSITED LIGHT THEME BACKGROUNDS)');
  console.log('================================================================\n');

  for (const item of items) {
    const cr = getContrastRatio(item.fg, item.bg);
    const pass = cr >= 4.5;
    const fgHex = '#' + [item.fg.r, item.fg.g, item.fg.b].map(x => x.toString(16).padStart(2, '0')).join('');
    const bgHex = '#' + [item.bg.r, item.bg.g, item.bg.b].map(x => x.toString(16).padStart(2, '0')).join('');
    console.log(`${item.label.padEnd(25)} | FG: ${fgHex} | Actual BG: ${bgHex} | CR: ${String(cr).padStart(5)}:1 | ${pass ? '✅ PASS' : '❌ FAIL (<4.5:1)'}`);
  }

  await browser.close();
}

auditContrast().catch(console.error);
