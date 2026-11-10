// --- CraftIndex Safe Storage Migration Layer ---
(function migrateLegacyStorage() {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem("cv_migrated") === "1") return;

    const migrationMap = {
      ci_settings: "cv_settings",
      ci_cart: "cv_cart",
      ci_source_prefs: "cv_source_prefs",
      ci_primary_source: "cv_primary_source",
      ci_secondary_source: "cv_secondary_source",
      ci_auto_source: "cv_auto_source",
      ci_hist: "cv_hist",
      ci_ambient_video: "cv_ambient_video",
      ci_mode: "cv_mode"
    };

    for (const [oldKey, newKey] of Object.entries(migrationMap)) {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null) {
        if (localStorage.getItem(newKey) === null) {
          if (oldKey === "ci_settings" || oldKey === "ci_cart" || oldKey === "ci_source_prefs" || oldKey === "ci_hist") {
            try {
              JSON.parse(oldVal);
              localStorage.setItem(newKey, oldVal);
              localStorage.removeItem(oldKey);
            } catch (jsonErr) {
              console.warn("[CraftIndex Storage Migration] Corrupted JSON in " + oldKey + ", retaining data:", jsonErr);
              localStorage.setItem(newKey, oldVal);
            }
          } else {
            localStorage.setItem(newKey, oldVal);
            localStorage.removeItem(oldKey);
          }
        } else {
          localStorage.removeItem(oldKey);
        }
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ci_gh_")) {
        const newK = "cv_gh_" + k.slice(6);
        if (localStorage.getItem(newK) === null) {
          localStorage.setItem(newK, localStorage.getItem(k));
        }
        localStorage.removeItem(k);
      }
    }

    localStorage.setItem("cv_migrated", "1");
  } catch (err) {
    console.warn("[CraftIndex Storage Migration] Migration error:", err);
  }
})();

// --- CraftIndex Safe Storage Access Utility ---
const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }
};

/* --- Centralized overlay scroll-lock manager (Phase 5) ------------------
   Any overlay (modal, dashboard, drawer, lightbox) acquires the lock on
   open and releases it on close. A reference counter keeps the document
   locked while nested overlays are open, so individual overlays can open
   and close independently without ever accidentally unlocking the page.
   Scroll position is preserved (overflow hidden keeps scrollTop) and the
   document offset is re-asserted after unlock in case the UA reset it. */
const CraftIndexScrollLock = {
  _count: 0,
  _scrollY: 0,
  acquire(id) {
    if (document.documentElement.__ciLockOwners === undefined) {
      document.documentElement.__ciLockOwners = new Set();
    }
    const owners = document.documentElement.__ciLockOwners;
    if (owners.has(id)) return; // idempotent re-open
    owners.add(id);
    if (this._count === 0) {
      this._scrollY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add("ci-scroll-locked");
      document.body.style.top = `-${this._scrollY}px`;
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    }
    this._count++;
  },
  release(id) {
    const owners = document.documentElement.__ciLockOwners;
    if (!owners || !owners.has(id)) return;
    owners.delete(id);
    this._count = Math.max(0, this._count - 1);
    if (this._count === 0) {
      document.documentElement.classList.remove("ci-scroll-locked");
      const scrollY = this._scrollY;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
      this._scrollY = 0;
    }
  },
  has(id) {
    const owners = document.documentElement.__ciLockOwners;
    return Boolean(owners && owners.has(id));
  }
};
window.CraftIndexScrollLock = CraftIndexScrollLock;

/* --- Lazy JSZip loader (Phase 2) ----------------------------------------
   The vendor bundle is no longer render-blocking in <head>. It is fetched
   on demand the first time a ZIP operation actually runs (bulk archive,
   Pack Studio import/export). Standalone dist pages sit one level deeper,
   so both relative bases are attempted. */
let _jsZipPromise = null;
function ensureJSZip() {
  if (typeof JSZip !== "undefined") return Promise.resolve(window.JSZip);
  if (_jsZipPromise) return _jsZipPromise;
  const bases = ["js/vendor/jszip.min.js", "../js/vendor/jszip.min.js"];
  _jsZipPromise = new Promise((resolve, reject) => {
    let i = 0;
    (function tryNext() {
      if (i >= bases.length) {
        _jsZipPromise = null;
        reject(new Error("JSZip failed to load"));
        return;
      }
      const s = document.createElement("script");
      s.src = bases[i++];
      s.async = true;
      s.onload = () => (typeof JSZip !== "undefined" ? resolve(window.JSZip) : tryNext());
      s.onerror = () => {
        s.remove();
        tryNext();
      };
      document.head.appendChild(s);
    })();
  });
  return _jsZipPromise;
}
window.ensureJSZip = ensureJSZip;

/* --- Lazy feature-script loaders (Phase 2) -------------------------------
   Pack Studio (pack_studio.js, ~60 KB) and the About/Docs center
   (about_docs.js, ~41 KB) are heavy, self-contained modules whose globals
   (window.CraftIndexStudio, ABOUT_DOCS) are referenced everywhere through
   guarded `typeof` checks. Loading them on first need (Studio tab, Docs
   route/modal) removes ~100 KB of script parsing from the initial page
   load. In the standalone dist, these globals are already inlined, so the
   loaders resolve immediately without any network fetch. */
let _aboutDocsPromise = null;
function ensureAboutDocs() {
  if (typeof ABOUT_DOCS !== "undefined") return Promise.resolve(window.ABOUT_DOCS || ABOUT_DOCS);
  if (_aboutDocsPromise) return _aboutDocsPromise;
  const bases = ["/js/about_docs.js", "js/about_docs.js", "../js/about_docs.js"];
  _aboutDocsPromise = new Promise((resolve, reject) => {
    let i = 0;
    (function tryNext() {
      if (i >= bases.length) { _aboutDocsPromise = null; reject(new Error("about_docs.js failed to load")); return; }
      const s = document.createElement("script");
      s.src = bases[i++];
      s.async = true;
      s.onload = () => (typeof ABOUT_DOCS !== "undefined" ? resolve() : tryNext());
      s.onerror = () => { s.remove(); tryNext(); };
      document.body.appendChild(s);
    })();
  });
  return _aboutDocsPromise;
}
window.ensureAboutDocs = ensureAboutDocs;

let _packStudioPromise = null;
function ensurePackStudio() {
  if (window.CraftIndexStudio) return Promise.resolve(window.CraftIndexStudio);
  if (_packStudioPromise) return _packStudioPromise;
  const bases = ["/js/pack_studio.js", "js/pack_studio.js", "../js/pack_studio.js"];
  _packStudioPromise = new Promise((resolve, reject) => {
    let i = 0;
    (function tryNext() {
      if (i >= bases.length) { _packStudioPromise = null; reject(new Error("pack_studio.js failed to load")); return; }
      const s = document.createElement("script");
      s.src = bases[i++];
      s.async = true;
      s.onload = () => (window.CraftIndexStudio ? resolve(window.CraftIndexStudio) : tryNext());
      s.onerror = () => { s.remove(); tryNext(); };
      document.body.appendChild(s);
    })();
  });
  return _packStudioPromise;
}
window.ensurePackStudio = ensurePackStudio;

// --- CraftIndex Independent Sanitization & Markdown Engine ---
const CraftIndexSanitizer = {
  ALLOWED_TAGS: new Set([
    "p", "span", "div", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "b", "strong", "i", "em", "u", "s", "strike", "code", "pre", "kbd", "samp", "sub", "sup",
    "ul", "ol", "li", "blockquote",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "img", "a", "details", "summary", "section", "article", "figure", "figcaption"
  ]),

  FORBIDDEN_TAGS: new Set([
    "script", "iframe", "object", "embed", "applet", "form", "input", "button",
    "select", "textarea", "style", "link", "meta", "base", "template", "svg", "math"
  ]),

  ALLOWED_ATTRS: {
    a: ["href", "title", "target", "rel", "class", "id"],
    img: ["src", "alt", "title", "width", "height", "loading", "class", "id"],
    th: ["colspan", "rowspan", "align", "class", "id"],
    td: ["colspan", "rowspan", "align", "class", "id"],
    details: ["open", "class", "id"],
    code: ["class", "id"],
    pre: ["class", "id"],
    h1: ["class", "id"],
    h2: ["class", "id"],
    h3: ["class", "id"],
    h4: ["class", "id"],
    h5: ["class", "id"],
    h6: ["class", "id"],
    p: ["class", "id", "style"],
    span: ["class", "id", "style"],
    div: ["class", "id", "style"],
    "*": ["class", "id", "title", "dir", "lang"]
  },

  isSafeUrl(url) {
    if (!url) return false;
    const trimmed = String(url).trim().replace(/[\x00-\x1f\x7f-\x9f]/g, "");
    if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./")) {
      return true;
    }
    try {
      const parsed = new URL(trimmed, window.location.origin || "https://craftindex.inlooker.top");
      if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
        return true;
      }
      if (parsed.protocol === "data:" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(trimmed)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  sanitize(dirtyHtml) {
    if (!dirtyHtml || typeof dirtyHtml !== "string") return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${dirtyHtml}</body>`, "text/html");
    const body = doc.body;

    // Remove explicitly forbidden tags and their descendants
    const forbiddenElements = body.querySelectorAll(Array.from(this.FORBIDDEN_TAGS).join(","));
    forbiddenElements.forEach((el) => el.remove());

    // Recursively process and sanitize remaining elements
    const allElements = Array.from(body.querySelectorAll("*"));
    for (const el of allElements) {
      const tag = el.tagName.toLowerCase();
      if (!this.ALLOWED_TAGS.has(tag)) {
        while (el.firstChild) {
          el.parentNode.insertBefore(el.firstChild, el);
        }
        el.remove();
        continue;
      }

      const allowedForTag = new Set([...(this.ALLOWED_ATTRS[tag] || []), ...this.ALLOWED_ATTRS["*"]]);
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const val = attr.value;

        if (name.startsWith("on") || !allowedForTag.has(name)) {
          el.removeAttribute(name);
          continue;
        }

        if (name === "href" || name === "src") {
          if (!this.isSafeUrl(val)) {
            el.removeAttribute(name);
          }
        }
      }

      if (tag === "a") {
        el.setAttribute("rel", "noopener noreferrer");
        if (!el.getAttribute("target")) {
          el.setAttribute("target", "_blank");
        }
      }
    }

    return body.innerHTML;
  }
};

const CraftIndexMarkdown = {
  escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  renderInline(text) {
    if (!text) return "";
    let out = this.escapeHtml(text);

    // Code: `code`
    out = out.replace(/`([^`]+)`/g, '<code class="craftindex-inline-code">$1</code>');

    // Bold + Italic: ***text***
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");

    // Bold: **text** or __text__
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    // Italic: *text* or _text_
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/(^|[^a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, "$1<em>$2</em>");

    // Strikethrough: ~~text~~
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    // Images: ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, url) => {
      const safe = CraftIndexSanitizer.isSafeUrl(url) ? url : "";
      return safe ? `<img src="${safe}" alt="${alt}" loading="lazy" class="craftindex-md-img">` : "";
    });

    // Links: [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
      const safe = CraftIndexSanitizer.isSafeUrl(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    return out;
  },

  render(markdownText) {
    if (!markdownText) return "";
    const lines = String(markdownText).replace(/\r\n/g, "\n").split("\n");
    const htmlBlocks = [];
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeBuffer = [];
    let listType = null;
    let inBlockquote = false;
    let blockquoteBuffer = [];

    const closeList = () => {
      if (listType) {
        htmlBlocks.push(`</${listType}>`);
        listType = null;
      }
    };

    const closeBlockquote = () => {
      if (inBlockquote) {
        htmlBlocks.push(`<blockquote>${this.render(blockquoteBuffer.join("\n"))}</blockquote>`);
        inBlockquote = false;
        blockquoteBuffer = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced Code Blocks (```)
      if (line.trim().startsWith("```")) {
        closeList();
        closeBlockquote();
        if (inCodeBlock) {
          const escapedCode = this.escapeHtml(codeBuffer.join("\n"));
          const langClass = codeLanguage ? ` class="language-${this.escapeHtml(codeLanguage)}"` : "";
          htmlBlocks.push(`<pre class="craftindex-code-block"><code${langClass}>${escapedCode}</code></pre>`);
          inCodeBlock = false;
          codeBuffer = [];
          codeLanguage = "";
        } else {
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
          codeBuffer = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Blockquotes (> text)
      if (line.trim().startsWith(">")) {
        closeList();
        inBlockquote = true;
        blockquoteBuffer.push(line.replace(/^>\s?/, ""));
        continue;
      } else if (inBlockquote) {
        closeBlockquote();
      }

      // Horizontal Rule (---, ***, ___)
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        closeList();
        htmlBlocks.push('<hr class="craftindex-divider" />');
        continue;
      }

      // Headings (# Heading)
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        const headingText = this.renderInline(headingMatch[2].trim());
        htmlBlocks.push(`<h${level} class="craftindex-heading h${level}">${headingText}</h${level}>`);
        continue;
      }

      // Unordered Lists (*, -, +)
      const ulMatch = line.match(/^(\s*)([*+-])\s+(.*)$/);
      if (ulMatch) {
        if (listType !== "ul") {
          closeList();
          htmlBlocks.push('<ul class="craftindex-list craftindex-ul">');
          listType = "ul";
        }
        htmlBlocks.push(`<li>${this.renderInline(ulMatch[3])}</li>`);
        continue;
      }

      // Ordered Lists (1. Item)
      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (olMatch) {
        if (listType !== "ol") {
          closeList();
          htmlBlocks.push('<ol class="craftindex-list craftindex-ol">');
          listType = "ol";
        }
        htmlBlocks.push(`<li>${this.renderInline(olMatch[3])}</li>`);
        continue;
      }

      // Empty Lines
      if (!line.trim()) {
        closeList();
        continue;
      }

      // Standard Paragraph
      closeList();
      htmlBlocks.push(`<p>${this.renderInline(line)}</p>`);
    }

    closeList();
    closeBlockquote();

    if (inCodeBlock) {
      const escapedCode = this.escapeHtml(codeBuffer.join("\n"));
      htmlBlocks.push(`<pre class="craftindex-code-block"><code>${escapedCode}</code></pre>`);
    }

    return CraftIndexSanitizer.sanitize(htmlBlocks.join("\n"));
  }
};

// Aliases for architecture preservation and seamless inter-module coordination
function MD(markdownText) {
  return CraftIndexMarkdown.render(markdownText);
}

function SAN(htmlText) {
  return CraftIndexSanitizer.sanitize(htmlText);
}

window.CraftIndexSanitizer = CraftIndexSanitizer;
window.CraftIndexMarkdown = CraftIndexMarkdown;
window.MD = MD;
window.SAN = SAN;
const C = JSON.parse(document.getElementById("cfg").textContent);
try {
  const customSettings = JSON.parse(safeStorage.getItem("cv_settings") || "{}");
  // Safely merge only non-structural keys from stored settings.
  // Structural keys (tabs, logo, title, fab, etc.) must never be overwritten
  // with null/invalid values from localStorage, as it would halt script
  // initialization and produce a blank page on reload.
  const PROTECTED_KEYS = new Set(["tabs", "logo", "title", "sub", "fav", "fab", "hlinks"]);
  for (const [key, value] of Object.entries(customSettings)) {
    if (PROTECTED_KEYS.has(key)) {
      if (key === "tabs") {
        if (Array.isArray(value) && value.length > 0 && value.every(t => t && typeof t === "object" && typeof t.id === "string" && t.id.trim())) {
          C.tabs = value;
        }
      } else if (value != null && typeof value === typeof C[key]) {
        C[key] = value;
      }
    } else {
      C[key] = value;
    }
  }
} catch (e) {}
const A = "https://api.modrinth.com/v2",
  $ = (i) => document.getElementById(i),
  E = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const PL = {
    paper: ["paper", "spigot", "bukkit"],
    purpur: ["purpur", "paper", "spigot", "bukkit"],
    spigot: ["spigot", "bukkit"],
    bukkit: ["bukkit"],
    folia: ["folia"],
    sponge: ["sponge"],
    velocity: ["velocity"],
    bungeecord: ["bungeecord"],
    waterfall: ["waterfall", "bungeecord"],
    leaves: ["leaves", "folia", "paper", "spigot", "bukkit"],
    pufferfish: ["pufferfish", "paper", "spigot", "bukkit"],
    glowstone: ["glowstone", "bukkit"],
    geyser: ["geyser", "paper", "spigot", "bukkit"],
  },
  ML = ["fabric", "neoforge", "forge", "quilt"];
{
  const DT = {
    tSearch: "Search...",
    tSel: "Cart",
    tHist: "History",
    tReview: "🛒 Review Cart",
    tClear: "🗑 Clear all",
    tAdd: "+ Add",
    tAdded: "✓ Added",
    tDl: "⬇ Download",
    tMore: "Load more",
    tEmpty: "Nothing found.",
    hlinks: "",
  };
  for (const k in DT) if (C[k] == null) C[k] = DT[k];
}
$("st").textContent =
  `:root{--b:${C.brand};--b2:${C.brand2};--bg:${C.bg};--r:${C.card};--t:${C.text};--font:'${C.font}';--rad:${C.radius}px;--dw:420px}main{max-width:${C.maxw}px!important}.gr{gap:${C.gap}px!important;${C.layout === "grid" ? (C.cols > 0 ? `grid-template-columns:repeat(${C.cols},1fr)!important;` : "") : `display:block!important;${C.cols > 0 ? `column-count:${C.cols}` : "column-width:340px"};column-gap:${C.gap}px;`}}.gr{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(360px,1fr))!important;align-items:stretch!important;}.gr .cd{align-self:stretch;height:100%;display:grid;grid-template-columns:84px 1fr;grid-template-rows:1fr auto;gap:16px;${C.layout === "grid" ? "" : `break-inside:avoid;margin-bottom:${C.gap}px;`}}.gr .em{column-span:all}.tabs,.fl{justify-content:${{ left: "flex-start", center: "center", right: "flex-end" }[C.align] || "flex-start"}!important}${FX()}${C.css || ""}`;
if (C.fav) {
  $("ic").href =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="26" font-size="26">${C.fav}</text></svg>`,
    );
}
if ($("lg")) {
  if (!$("lg").getAttribute("href")) $("lg").setAttribute("href", "/");
  if (!$("lg").getAttribute("aria-label")) $("lg").setAttribute("aria-label", "CraftIndex Home");
  if (!$("lg").children.length || C.sub) {
    $("lg").innerHTML =
      (C.logo ? `<img src="${E(C.logo)}" alt="${E(C.title)} Logo" width="36" height="36">` : C.fav) +
      `<span>${E(C.title)}${C.sub ? ` <small>${E(C.sub)}</small>` : ""}</span>`;
  }
}
if ($("ft") && !$("ft").children.length) {
  $("ft").className = "site-footer";
  $("ft").innerHTML = `
    <div class="site-footer-brand">
      <img src="images/craftindex-logo.png" alt="CraftIndex Logo" class="site-footer-logo" width="28" height="28">
      <span class="site-footer-name">CraftIndex</span>
    </div>
    <div class="site-footer-author">
      Engineered by <strong>Arata Inlooker</strong> &middot; 
      <a href="https://inlooker.top" target="_blank" rel="noopener noreferrer">Portfolio</a> &middot; 
      <a href="/socials/" id="footerSocialsLink" onclick="event.preventDefault(); if (typeof openSocialsModal === 'function') openSocialsModal();">Socials (DMs Open)</a> &middot; 
      <a href="https://github.com/ArataInlooker/CraftIndex" target="_blank" rel="noopener noreferrer">GitHub</a> &middot; 
      <a href="mailto:aratainlooker@gmail.com">aratainlooker@gmail.com</a>
    </div>
    <div class="site-footer-nav">
      <a href="/docs/">Documentation</a>
      <a href="/studio/">Pack Studio</a>
      <a href="/mods/">Mods</a>
      <a href="/plugins/">Plugins</a>
      <a href="/resourcepacks/">Resource Packs</a>
      <a href="/shaders/">Shaders</a>
      <a href="/datapacks/">Datapacks</a>
    </div>
    <div class="site-footer-disclaimer">
      CraftIndex is an independent, community-driven resource discovery platform and is not affiliated with, endorsed by, or associated with Mojang Studios, Microsoft, Modrinth, or CurseForge. Minecraft is a registered trademark of Mojang Studios / Microsoft. All mods, plugins, resource packs, shaders, and datapacks are copyright and intellectual property of their respective creators.
    </div>
    <div class="site-footer-privacy">
      Privacy-first architecture: All collections, preferences, and binary archives are persisted strictly inside your browser (IndexedDB & LocalStorage). Zero telemetry, zero tracking.
    </div>
  `;
}
$("fd").textContent = C.fab;
$("q").placeholder = C.tSearch;
$("hb").textContent = C.tHist;
$("fr").textContent = C.tReview;
$("fc").textContent = C.tClear;
$("mo").textContent = C.tMore;
$("cb").firstChild.textContent = C.tSel + " ";
$("hl").innerHTML =
  (C.hlinks || "")
    .split("\n")
    .filter((x) => /\|\s*https?:/i.test(x))
    .map((x) => {
      const [a, ...b] = x.split("|");
      return `<a class="btn" style="text-decoration:none" href="${E(b.join("|").trim())}" target="_blank" rel="noopener">${E(a.trim())}</a>`;
    })
    .join(" ") + " ";
$("so").value = C.sort;
// Guard: ensure C.tabs is a valid non-empty array with valid tab objects; if corrupted/null/malformed, restore from config element
if (!Array.isArray(C.tabs) || C.tabs.length === 0 || C.tabs.some(t => !t || typeof t !== "object" || typeof t.id !== "string" || !t.id.trim())) {
  console.warn("[CraftIndex] C.tabs was invalid or corrupted; restoring from config element.");
  try {
    const freshCfg = JSON.parse(document.getElementById("cfg").textContent);
    if (Array.isArray(freshCfg.tabs) && freshCfg.tabs.length > 0) {
      C.tabs = freshCfg.tabs;
    }
  } catch (_) {}
}
if (!Array.isArray(C.tabs) || C.tabs.length === 0 || C.tabs.some(t => !t || typeof t !== "object" || typeof t.id !== "string" || !t.id.trim())) {
  C.tabs = [{ id: "home", name: "Home", emoji: "\uD83C\uDFE0", kind: "home", cfClass: 0, ptype: "home", mode: "home", loaders: [], dir: "Home", sources: [] }];
}
let tab = C.tabs.find(t => t && typeof t === "object" && typeof t.id === "string" && t.id.trim()) || C.tabs[0],
  hits = [],
  off = 0,
  tot = 0,
  tk = 0,
  GV = [],
  cart = new Map(),
  cfg = { mc: "", ml: "fabric", pl: "paper", deps: C.deps },
  res = [],
  busy = 0;
function safeCartJsonReplacer(key, value) {
  if (key === "rawItem") return undefined;
  return value;
}

try {
  const savedCart = safeStorage.getItem("cv_cart") || "[]";
  JSON.parse(savedCart).forEach((p) => {
    if (p && p.sources && Array.isArray(p.sources)) {
      p.sources.forEach((s) => {
        delete s.rawItem;
      });
    }
    cart.set(p.k, p);
  });
} catch (e) {}
window.cart = cart;
const sv = () => {
    try {
      const list = [...cart.values()].map((p) => {
        if (p && p.sources && Array.isArray(p.sources)) {
          p.sources.forEach((s) => {
            delete s.rawItem;
          });
        }
        return p;
      });
      localStorage.setItem("cv_cart", JSON.stringify(list, safeCartJsonReplacer));
    } catch (e) {
      console.warn("Could not save cart:", e);
    }
  };
window.sv = sv;
const T = (id) => C.tabs.find((t) => t.id === id) || {},
  getCatLabel = (id) => {
    const map = {
      mods: "MOD",
      plugins: "PLUGIN",
      resourcepacks: "RESOURCE PACK",
      shaders: "SHADER",
      datapacks: "DATA PACK",
      modpacks: "MODPACK",
      worlds: "WORLD",
      home: "HOME",
      serversoftwares: "SERVER SOFTWARE",
      modloaders: "MOD LOADER",
      launchers: "LAUNCHER",
      dependencies: "DEPENDENCY",
    };
    return map[id] || (T(id).name ? T(id).name.toUpperCase() : String(id || "").toUpperCase());
  };
const _apiCache = new Map();
const api = async (p, signal) => {
    if (!signal && _apiCache.has(p)) {
      const cached = _apiCache.get(p);
      if (Date.now() - cached.time < 60000) {
        return cached.data;
      }
    }
    const r = await fetch(A + p, signal ? { signal } : {});
    if (!r.ok) throw Error("API " + r.status);
    const data = await r.json();
    if (!signal) {
      if (_apiCache.size > 100) _apiCache.clear();
      _apiCache.set(p, { time: Date.now(), data });
    }
    return data;
  };
const toast = (m) => {
  $("tt").textContent = m;
  $("tt").style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($("tt").style.display = "none"), 2400);
};
window.toast = toast;
// --- CraftIndex Formatter & Visual Component Helpers ---
const CraftIndexFormatter = {
  formatMetric(num) {
    if (num == null) return "0";
    try {
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(num) || 0);
    } catch {
      return String(num);
    }
  },

  renderResourceIcon(resource) {
    if (!resource) return '<div class="ic craftindex-card-icon" aria-hidden="true">?</div>';
    const title = resource.title || resource.name || "Resource Icon";
    const initial = (title || "?").trim().charAt(0).toUpperCase() || "?";
    const iconUrl = resource.icon || (resource.sources && resource.sources[0] && resource.sources[0].icon);

    if (iconUrl) {
      return `<img class="ic craftindex-card-icon" src="${E(iconUrl)}" alt="${E(title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'ic craftindex-card-icon\\' aria-hidden=\\'true\\'>${E(initial)}</div>'">`;
    }
    return `<div class="ic craftindex-card-icon" aria-hidden="true">${E(initial)}</div>`;
  }
};

const fmt = (n) => CraftIndexFormatter.formatMetric(n);
const ico = (p) => CraftIndexFormatter.renderResourceIcon(p);
window.CraftIndexFormatter = CraftIndexFormatter;
window.fmt = fmt;
window.ico = ico;
const NAV_GROUPS = [
  {
    id: "home",
    name: "Home",
    emoji: "",
    defaultTab: "home",
    subTabs: []
  },
  {
    id: "studio",
    name: "Pack Studio",
    emoji: "",
    defaultTab: "studio",
    subTabs: []
  },
  {
    id: "mods_group",
    name: "Mods",
    emoji: "",
    defaultTab: "mods",
    subTabs: [
      { id: "mods", name: "Mods", emoji: "" },
      { id: "modpacks", name: "Modpacks", emoji: "" },
      { id: "modloaders", name: "Mod Loader", emoji: "" },
      { id: "launchers", name: "Minecraft Launchers", emoji: "" }
    ]
  },
  {
    id: "resourcepacks",
    name: "Resource Packs",
    emoji: "",
    defaultTab: "resourcepacks",
    subTabs: []
  },
  {
    id: "shaders",
    name: "Shaders",
    emoji: "",
    defaultTab: "shaders",
    subTabs: []
  },
  {
    id: "worlds_group",
    name: "Worlds",
    emoji: "",
    defaultTab: "worlds",
    subTabs: [
      { id: "worlds", name: "Worlds", emoji: "" },
      { id: "datapacks", name: "Data Packs", emoji: "" }
    ]
  },
  {
    id: "server_group",
    name: "Server",
    emoji: "",
    defaultTab: "plugins",
    subTabs: [
      { id: "plugins", name: "Plugins", emoji: "" },
      { id: "serversoftwares", name: "Server Softwares", emoji: "" }
    ]
  }
];

function getActiveNavGroup() {
  const currentId = tab ? tab.id : "home";
  for (const g of NAV_GROUPS) {
    if (g.defaultTab === currentId || g.id === currentId) return g;
    if (g.subTabs && g.subTabs.some((st) => st.id === currentId)) return g;
  }
  return NAV_GROUPS[0];
}

function getPathForCurrentState() {
  if (!tab || tab.id === "home") return "/";
  if (tab.id === "studio") return "/studio/";
  if (tab.id === "mods") {
    const loader = $("fl") ? $("fl").value : "";
    if (loader && ["fabric", "forge", "neoforge", "quilt"].includes(loader.toLowerCase())) {
      return `/mods/${loader.toLowerCase()}/`;
    }
    return "/mods/";
  }
  return `/${tab.id}/`;
}

let activeToolbarModal = null; // 'presets' | 'history' | 'settings' | 'docs' | 'collection'

function recordCurrentBrowseUrl() {
  try {
    const curPath = window.location.pathname;
    if (curPath && !curPath.startsWith("/docs") && !curPath.startsWith("/socials")) {
      sessionStorage.setItem("cv_last_browse_url", curPath + window.location.search + window.location.hash);
    } else if (typeof getPathForCurrentState === "function") {
      const statePath = getPathForCurrentState();
      if (statePath && !statePath.startsWith("/docs") && !statePath.startsWith("/socials")) {
        sessionStorage.setItem("cv_last_browse_url", statePath);
      }
    }
  } catch (_) {}
}

function returnToLastUrlAndReload() {
  let lastUrl = "/";
  try {
    lastUrl = sessionStorage.getItem("cv_last_browse_url") || "/";
  } catch (_) {}

  if (lastUrl.startsWith("/docs") || lastUrl.startsWith("/socials")) {
    lastUrl = "/";
  }

  if (window.location.protocol === "file:") {
    window.location.reload();
    return;
  }

  const currentPathWithSearch = window.location.pathname + window.location.search;
  const targetClean = lastUrl.split("#")[0];

  if (currentPathWithSearch !== targetClean) {
    window.location.href = lastUrl;
  } else {
    window.location.reload();
  }
}

function updateBrowserTitle(customContext = null) {
  try {
    if (customContext) {
      document.title = customContext;
      return;
    }
    // 1. Check open modals
    if ($("md") && $("md").classList.contains("o")) {
      if (activeToolbarModal === "settings") {
        document.title = "Settings | CraftIndex";
        return;
      }
      if (activeToolbarModal === "presets") {
        document.title = "Presets | CraftIndex";
        return;
      }
      if (activeToolbarModal === "history") {
        document.title = "History | CraftIndex";
        return;
      }
    }
    if ($("settingsModal") && $("settingsModal").classList.contains("open")) {
      document.title = "Settings | CraftIndex";
      return;
    }
    if ($("presetsModal") && $("presetsModal").classList.contains("open")) {
      document.title = "Presets | CraftIndex";
      return;
    }
    if ($("histModal") && $("histModal").classList.contains("open")) {
      document.title = "History | CraftIndex";
      return;
    }
    if ($("aboutModal") && $("aboutModal").classList.contains("open")) {
      document.title = "About Center | CraftIndex";
      return;
    }
    if ($("socialsModal") && $("socialsModal").classList.contains("open")) {
      document.title = "Official Socials & Creator Contact | CraftIndex";
      return;
    }
    if ($("dashModal") && $("dashModal").classList.contains("open") && typeof currentDashItem !== "undefined" && currentDashItem) {
      const dashTitle = currentDashItem.title || currentDashItem.name || "Resource";
      document.title = `${dashTitle} | CraftIndex`;
      return;
    }
    if ($("dashModal") && $("dashModal").classList.contains("inline") && typeof currentDashItem !== "undefined" && currentDashItem && typeof rpTitle === "function") {
      document.title = rpTitle(currentDashItem);
      return;
    }
    if ($("dr") && $("dr").classList.contains("o")) {
      const count = (window.cart && window.cart.size !== undefined ? window.cart.size : (window.cart && window.cart.length ? window.cart.length : 0));
      document.title = `Collection (${count}) | CraftIndex`;
      return;
    }
    if (document.body.dataset.tab === "docs" || window.location.pathname.startsWith("/docs")) {
      document.title = "CraftIndex Documentation | Complete User Guide & Technical Reference";
      return;
    }
    if (document.body.dataset.tab === "socials" || window.location.pathname.startsWith("/socials")) {
      document.title = "Official Socials & Creator Contact | CraftIndex";
      return;
    }

    // 2. Check search query
    const qVal = ($("q") && $("q").value ? $("q").value.trim() : "");
    if (qVal) {
      const catName = tab && tab.name && tab.id !== "home" ? tab.name : "";
      if (catName) {
        document.title = `Search: "${qVal}" in ${catName} | CraftIndex`;
      } else {
        document.title = `Search: "${qVal}" | CraftIndex`;
      }
      return;
    }

    // 3. Tab & loader check
    if (!tab || tab.id === "home") {
      document.title = "CraftIndex | Minecraft Resource Discovery & Modpack Builder";
      return;
    }
    if (tab.id === "studio") {
      document.title = "Pack Studio | CraftIndex";
      return;
    }

    const loaderVal = ($("fl") && $("fl").value) || "";
    if (loaderVal && loaderVal !== "all" && tab.id === "mods") {
      const loaderFormatted = loaderVal.charAt(0).toUpperCase() + loaderVal.slice(1);
      document.title = `${loaderFormatted} Mods | CraftIndex`;
      return;
    }
    if (loaderVal && loaderVal !== "all" && tab.id === "plugins") {
      const loaderFormatted = loaderVal.charAt(0).toUpperCase() + loaderVal.slice(1);
      document.title = `${loaderFormatted} Plugins | CraftIndex`;
      return;
    }

    // Standard category titles aligned with ROUTE_CONFIG
    const routeTitles = {
      mods: "Minecraft Mods | CraftIndex",
      plugins: "Minecraft Plugins | CraftIndex",
      resourcepacks: "Minecraft Resource Packs | CraftIndex",
      shaders: "Minecraft Shaders | CraftIndex",
      datapacks: "Minecraft Datapacks | CraftIndex",
      modpacks: "Minecraft Modpacks | CraftIndex",
      worlds: "Minecraft Worlds | CraftIndex",
      serversoftwares: "Minecraft Server Software | CraftIndex",
      modloaders: "Minecraft Mod Loaders | CraftIndex",
      launchers: "Minecraft Launchers | CraftIndex"
    };

    if (routeTitles[tab.id]) {
      document.title = routeTitles[tab.id];
      return;
    }

    document.title = `${tab.name || "Resources"} | CraftIndex`;
  } catch (err) {
    console.warn("Title update error:", err);
  }
}
window.updateBrowserTitle = updateBrowserTitle;

function renderStandaloneDocsView() {
  if ($("standaloneDocsView")) return;
  const docsList = (typeof ABOUT_DOCS !== "undefined" && Array.isArray(ABOUT_DOCS)) ? ABOUT_DOCS : [];
  
  const tocItems = docsList.map((doc, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const docId = `${num}-${doc.id.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")}`;
    return `<li><a href="/docs/#${docId}">${doc.icon ? doc.icon + " " : ""}${num}. ${E(doc.title)}</a></li>`;
  }).join("\n");

  const articles = docsList.map((doc, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const docId = `${num}-${doc.id.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")}`;
    return `<section id="${docId}" class="doc-section-block">
      <div id="${doc.id}"></div>
      <div class="doc-section-header">
        <span class="doc-section-icon">${doc.icon || "📄"}</span>
        <h2 class="doc-section-title">${num}. ${E(doc.title)}</h2>
      </div>
      <div class="doc-section-body">
        ${doc.html || ""}
      </div>
    </section>`;
  }).join("\n<hr class=\"doc-divider\" />\n");

  const docsHtml = `
    <div class="standalone-docs-container" id="standaloneDocsView">
      <div class="doc-header-banner">
        <div class="doc-header-badge">⚡ OFFICIAL DOCUMENTATION &amp; ARCHITECTURE</div>
        <h1 class="doc-main-title">CraftIndex Documentation</h1>
        <p class="doc-main-subtitle">Comprehensive guide to Minecraft resource discovery, Pack Studio workflows, persistent IndexedDB binary storage, and manifest schemas.</p>
        
        <div class="doc-creator-pill-card">
          <div class="doc-creator-avatar">AI</div>
          <div class="doc-creator-info">
            <div class="doc-creator-name">Arata Inlooker <span class="doc-creator-tag">Authoritative Maintainer</span></div>
            <div class="doc-creator-desc">Independent developer working across software systems, web engineering, and networking infrastructure.</div>
          </div>
          <div class="doc-creator-actions">
            <a href="https://inlooker.top" target="_blank" rel="noopener noreferrer" class="doc-pill-btn">Portfolio ↗</a>
            <a href="https://github.com/ArataInlooker/CraftIndex" target="_blank" rel="noopener noreferrer" class="doc-pill-btn secondary">GitHub ↗</a>
          </div>
        </div>
      </div>

      <div class="doc-layout-grid">
        <nav class="doc-toc-sidebar" aria-label="Documentation table of contents">
          <h2 class="doc-toc-title">Table of Contents</h2>
          <ul class="doc-toc-list">
            ${tocItems}
          </ul>
        </nav>

        <article class="doc-article-content">
          ${articles}
        </article>
      </div>
    </div>
  `;

  if ($("g")) {
    const temp = document.createElement("div");
    temp.innerHTML = docsHtml;
    const view = temp.firstElementChild;
    $("g").parentNode.insertBefore(view, $("g"));
  }
}

function updateBrowserUrl(replace = false) {
  try {
    const targetPath = getPathForCurrentState();
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ tabId: tab ? tab.id : "home" }, "", targetPath);
      } else {
        window.history.pushState({ tabId: tab ? tab.id : "home" }, "", targetPath);
      }
    }
  } catch (_) {}
}

function switchTab(tObj, skipUrlUpdate = false) {
  if (!tObj || !tObj.id) return;
  tab = tObj;
  document.body.dataset.tab = tab.id;
  tabs();
  lf();
  go(1);
  if (!skipUrlUpdate) {
    updateBrowserUrl(false);
  }
  recordCurrentBrowseUrl();
  updateBrowserTitle();
}

/* ========================================================
   STANDALONE RESOURCE PAGES (Phase 1)
  Permanent URLs: /<category>/<slug>/ for provider-resolvable
   resources. The existing Resource Detail Dashboard window is
   re-parented into #standaloneResourceView (inline mode) instead
   of being a modal, so direct navigation, refresh, sharing and
   crawling all work against real URLs.
   ======================================================== */
const RP_CATS = new Set([
  "mods", "plugins", "resourcepacks", "shaders", "datapacks", "modpacks", "worlds",
]);
const RP_LINKABLE_SOURCES = new Set(["modrinth", "curseforge", "bukkit", "hangar", "github"]);
const RP_GITHUB_SEP = "--";
// Search-result hits handed to openStandaloneResource without a re-resolve.
const _pendingResourceHits = new Map();
let _rpNavToken = 0; // invalidates stale async resolution when the user navigates on
let dashInline = null; // non-null while the dashboard window is hosted on a resource page

function rpResourceUrl(tabId, slug) {
  return "/" + tabId + "/" + String(slug).toLowerCase() + "/";
}

function rpParseResourceRoute(pathname) {
  const m = pathname.match(
    /^\/(mods|plugins|resourcepacks|shaders|datapacks|modpacks|worlds)\/([a-z0-9][a-z0-9_-]*)$/,
  );
  if (!m) return null;
  // /mods/<loader>/ is the loader-filter route, never a resource page
  // (fabric, neoforge, forge, quilt are reserved under /mods/).
  if (m[1] === "mods" && ML.includes(m[2])) return null;
  return { tabId: m[1], slug: m[2] };
}

// A search hit can be linked to a standalone page when its identity can be
// re-resolved against a provider from URL alone. GitHub hits use owner--repo.
function rpCardHref(h) {
  if (!h || !h.tab || !RP_CATS.has(h.tab)) return null;
  if (h.tab === "mods" && ML.includes(String(h.slug || ""))) return null;
  if (h.source === "github") {
    if (!h.id || !String(h.id).includes("/")) return null;
    return rpResourceUrl(h.tab, String(h.id).replace("/", RP_GITHUB_SEP));
  }
  if (!RP_LINKABLE_SOURCES.has(h.source)) return null;
  const slug = String(h.slug || "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug)) return null;
  return rpResourceUrl(h.tab, slug);
}

function rpTitle(h) {
  const cat = (T(h.tab) && T(h.tab).name) || h.tab || "Resource";
  return `${h.title || "Resource"} — ${cat} | CraftIndex`;
}

function rpBreadcrumb(h) {
  const cat = (T(h.tab) && T(h.tab).name) || h.tab;
  return `
    <nav class="rp-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a><span class="rp-crumb-sep">›</span>
      <a href="/${E(h.tab)}/">${E(cat)}</a><span class="rp-crumb-sep">›</span>
      <span aria-current="page">${E(h.title || h.slug)}</span>
    </nav>`;
}

function rpNotFoundShell(tabId, slug, notes) {
  const cat = (T(tabId) && T(tabId).name) || tabId;
  return `
    <div class="rp-notfound" role="alert">
      <div style="font-size:38px;margin-bottom:10px;">🗂️</div>
      <h1>Resource not found</h1>
      <p>No <b>${E(cat)}</b> resource matching <code>${E(slug)}</code> could be
      resolved on the supported providers. The resource may have been renamed,
      delisted, or the URL may contain a typo.</p>
      <a class="btn p" href="/${E(tabId)}/">Browse all ${E(cat)}</a>
      <span class="rp-provider-status">${E(notes || "")}</span>
    </div>`;
}

// Resolution chain for a URL slug against live provider APIs.
// Chain: Modrinth slug → CurseForge exact-slug (needs server key) → GitHub owner--repo.
// Providers requiring per-resource numeric lookup or missing keys degrade to null;
// the page then shows an honest not-found state (no fabricated metadata).
async function rpResolveResource(tabId, slug) {
  const t = T(tabId) || {};

  // 1. Modrinth: /project/{slug} accepts the canonical project slug.
  try {
    const d = await api("/project/" + encodeURIComponent(slug));
    if (d && d.id) {
      const hit = {
        k: "mr:" + d.id,
        id: d.id,
        tab: tabId,
        source: "modrinth",
        sourceName: "Modrinth",
        websiteUrl: `https://modrinth.com/${d.project_type || t.ptype || "mod"}/${d.slug || d.id}`,
        title: d.title || slug,
        icon: d.icon_url,
        author: d.organization || "",
        desc: d.description || "",
        dl: d.downloads,
        fo: d.followers,
        slug: d.slug || slug,
        pt: d.project_type || t.ptype,
        tags: (d.categories || []).slice(0, 2),
        cf: 0,
        _rpProj: d, // already fetched — the dashboard reuses it
      };
      return hit;
    }
  } catch (e) { /* fall through to next provider */ }

  // 2. CurseForge: search by the slug and require an exact-slug match.
  if (t.cfClass) {
    try {
      const d = await cfa(
        "/v1/mods/search?gameId=432&classId=" + encodeURIComponent(t.cfClass) +
        "&pageSize=8&searchFilter=" + encodeURIComponent(slug),
      );
      const exact = (d.data || []).find((m) => m.slug === slug);
      if (exact) {
        const catSlug =
          tabId === "mods" ? "mc-mods"
          : tabId === "resourcepacks" ? "texture-packs"
          : tabId === "shaders" ? "shaders"
          : tabId === "datapacks" ? "data-packs"
          : tabId === "modpacks" ? "modpacks"
          : tabId === "worlds" ? "worlds"
          : "bukkit-plugins";
        return {
          k: "cf:" + exact.id,
          id: exact.id,
          tab: tabId,
          source: "curseforge",
          sourceName: "CurseForge",
          websiteUrl: (exact.links && exact.links.websiteUrl)
            ? exact.links.websiteUrl
            : `https://www.curseforge.com/minecraft/${catSlug}/${exact.slug || exact.id}`,
          title: exact.name,
          icon: exact.logo ? exact.logo.thumbnailUrl || exact.logo.url : null,
          author: exact.authors && exact.authors[0] ? exact.authors[0].name : "",
          desc: exact.summary,
          dl: exact.downloadCount,
          fo: exact.thumbsUpCount || 0,
          slug: exact.slug,
          pt: t.ptype,
          tags: (exact.categories || []).slice(0, 2).map((c) => c.name),
          cf: 1,
        };
      }
    } catch (e) { /* fall through to next provider */ }
  }

  // 3. GitHub: owner--repo identity.
  if (slug.indexOf(RP_GITHUB_SEP) !== -1) {
    const seg = slug.split(RP_GITHUB_SEP);
    if (seg.length === 2 && seg[0] && seg[1]) {
      try {
        const baseUrl = window.location.protocol.startsWith("http")
          ? "/api/github"
          : "https://api.github.com";
        const r = await fetch(baseUrl + "/repos/" + seg[0] + "/" + seg[1], {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (r.ok) {
          const repo = await r.json();
          return {
            k: "gh:" + repo.full_name,
            id: repo.full_name,
            tab: tabId,
            source: "github",
            sourceName: "GitHub",
            websiteUrl: repo.html_url || `https://github.com/${seg[0]}/${seg[1]}`,
            title: repo.name || slug,
            icon: (repo.owner && repo.owner.avatar_url) || null,
            author: (repo.owner && repo.owner.login) || "",
            desc: repo.description || "",
            dl: null,
            fo: repo.stargazers_count || 0,
            slug: slug,
            pt: t.ptype,
            tags: (repo.topics || []).slice(0, 2),
            cf: 0,
          };
        }
      } catch (e) { /* fall through */ }
    }
  }

  return null;
}

function rpCloseToCategory() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.assign("/" + (currentDashItem && currentDashItem.tab ? currentDashItem.tab : "") + "/");
  }
}

// Move the dashboard window back into #dashModal and clear the page host.
function restoreInlineDashHost() {
  const host = $("standaloneResourceView");
  const modal = $("dashModal");
  // Rescue the dashboard window out of the page host BEFORE wiping the host,
  // otherwise the window (with its content) is destroyed along with it.
  const orphan = host && host.querySelector(".dash-window");
  if (orphan && modal && !modal.contains(orphan)) modal.appendChild(orphan);
  if (host) {
    host.classList.remove("active");
    host.innerHTML = "";
  }
  _pendingResourceHits.clear();
}

// Render + hydrate a standalone resource page at /<category>/<slug>/.
async function openStandaloneResource(tabId, slug, opts = {}) {
  const token = ++_rpNavToken;
  const host = $("standaloneResourceView");
  if (!host) return;

  document.body.dataset.tab = tabId;
  if (typeof tabs === "function") tabs();
  if (typeof lf === "function") lf();
  if ($("fl") && $("fl").parentElement) $("fl").parentElement.style.display = "none";
  if ($("mo-wrap")) $("mo-wrap").style.display = "none";
  if ($("fabs")) $("fabs").classList.add("h");
  if ($("g")) $("g").style.display = "none";
  if ($("standaloneDocsView")) $("standaloneDocsView").style.display = "none";
  if ($("standaloneSocialsView")) $("standaloneSocialsView").style.display = "none";

  host.classList.add("active");
  const catLabel = (T(tabId) && T(tabId).name) || tabId;
  host.innerHTML = `
    <div class="rp-shell">
      <nav class="rp-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span class="rp-crumb-sep">›</span>
        <a href="/${E(tabId)}/">${E(catLabel)}</a><span class="rp-crumb-sep">›</span>
        <span aria-current="page">${E(slug)}</span>
      </nav>
      <div class="rp-loading">
        <div class="cyber-spinner" style="margin: 0 auto 14px;"></div>
        <div style="color: var(--colors-text-muted); font-size: 14px;">Resolving “${E(slug)}” on ${E(catLabel)} providers…</div>
      </div>
    </div>`;
  document.title = `Loading ${E(slug)} | CraftIndex`;

  // Fast path: a search hit rendered moments ago can skip provider resolution.
  const key = rpResourceUrl(tabId, slug);
  const hit = _pendingResourceHits.get(key) || _pendingResourceHits.get(key.replace(/\/$/, ""));
  if (hit) {
    _pendingResourceHits.delete(key);
    _pendingResourceHits.delete(key.replace(/\/$/, ""));
  }

  // SSR fast path: the dynamic server embeds the resolved identity in
  // data-rp on #g content — reuse it and preserve a single upstream fetch.
  let ssrPayload = null;
  try {
    const el = document.querySelector("#g .rp-ssr[data-rp]");
    if (el) ssrPayload = JSON.parse(decodeURIComponent(el.getAttribute("data-rp")));
  } catch (e) {
    ssrPayload = null;
  }

  let resolved = hit || ssrPayload;
  if (!resolved) {
    try {
      resolved = await rpResolveResource(tabId, slug);
    } catch (e) {
      resolved = null;
    }
  }
  if (token !== _rpNavToken) return; // a newer navigation superseded this one

  if (!resolved) {
    let notes = "";
    if (!T(tabId).cfClass) notes = "Note: CurseForge resolution is unavailable for this category in this browser session.";
    host.innerHTML = `<div class="rp-shell">${rpBreadcrumb({ tab: tabId, title: slug })}${rpNotFoundShell(tabId, slug, notes)}</div>`;
    document.title = `Not found: ${E(slug)} | CraftIndex`;
    return;
  }

  currentDashItem = resolved;
  currentDashData = null;
  currentDashVersions = [];
  currentDashTab = "docs";
  dashVerFilter = "";
  dashLoaderFilter = "";
  await openResourceDash(resolved, { inline: true });
}

function handleRouteFromUrl(isPopState = false) {
  try {
    let path = window.location.pathname.toLowerCase().replace(/\/+$/, "");
    if (!path) path = "";

    // 1. Documentation route: /docs or /docs/
    if (path === "/docs" || path.startsWith("/docs/")) {
      const hash = (window.location.hash || "").replace("#", "");
      if (typeof tabs === "function") tabs();
      document.body.dataset.tab = "docs";
      if ($("fl") && $("fl").parentElement) {
        $("fl").parentElement.style.display = "none";
      }
      if ($("mo-wrap")) $("mo-wrap").style.display = "none";
      if ($("fabs")) $("fabs").classList.add("h");
      if ($("g")) $("g").style.display = "none";
      if ($("standaloneSocialsView")) $("standaloneSocialsView").style.display = "none";
      // Leave any inline resource page cleanly (window restored, locks released)
      if (typeof closeDashModal === "function" && $("dashModal") && $("dashModal").classList.contains("inline")) {
        closeDashModal();
      }
      ensureAboutDocs().then(() => {
        if (!$("standaloneDocsView")) {
          renderStandaloneDocsView();
        }
        if ($("standaloneDocsView")) {
          $("standaloneDocsView").style.display = "block";
          if (hash) {
            const targetEl = document.getElementById(hash) || document.getElementById(hash.replace(/^\d+-/, "")) || document.getElementById("0" + hash);
            if (targetEl) targetEl.scrollIntoView({ behavior: "smooth" });
          }
        }
        updateBrowserTitle();
      }).catch(() => {
        if (!$("standaloneDocsView")) renderStandaloneDocsView();
        updateBrowserTitle();
      });
      return;
    }

    // 1b. Socials route: /socials or /socials/
    if (path === "/socials" || path.startsWith("/socials/")) {
      if (typeof tabs === "function") tabs();
      document.body.dataset.tab = "socials";
      if ($("fl") && $("fl").parentElement) {
        $("fl").parentElement.style.display = "none";
      }
      if ($("mo-wrap")) $("mo-wrap").style.display = "none";
      if ($("fabs")) $("fabs").classList.add("h");
      if ($("g")) $("g").style.display = "none";
      if ($("standaloneDocsView")) $("standaloneDocsView").style.display = "none";
      if (typeof closeDashModal === "function" && $("dashModal") && $("dashModal").classList.contains("inline")) {
        closeDashModal();
      }
      if ($("standaloneSocialsView")) {
        $("standaloneSocialsView").style.display = "block";
      } else if (typeof openSocialsModal === "function") {
        openSocialsModal(true);
      }
      updateBrowserTitle();
      return;
    }

    // Ensure main grid and filters are restored on regular tabs
    if ($("g")) $("g").style.display = "";
    if ($("fl") && $("fl").parentElement) {
      $("fl").parentElement.style.display = "";
    }
    if ($("mo-wrap")) $("mo-wrap").style.display = "";
    if ($("standaloneDocsView")) $("standaloneDocsView").style.display = "none";
    if ($("standaloneSocialsView")) $("standaloneSocialsView").style.display = "none";
    if (typeof closeAboutModal === "function" && $("aboutModal") && $("aboutModal").classList.contains("open")) {
      closeAboutModal(true);
    }
    if (typeof closeSocialsModal === "function" && $("socialsModal") && $("socialsModal").classList.contains("open")) {
      closeSocialsModal(true);
    }
    if (typeof closeDashModal === "function" && $("dashModal") && ($("dashModal").classList.contains("open") || $("dashModal").classList.contains("inline"))) {
      closeDashModal();
    }
    if (typeof closeSettingsModal === "function" && $("settingsModal") && $("settingsModal").classList.contains("open")) {
      closeSettingsModal();
    }
    if ($("dr") && $("dr").classList.contains("o")) {
      dr(0);
    }
    recordCurrentBrowseUrl();

    // 2. Pack Studio route: /studio or /studio/
    if (path === "/studio") {
      const studioTab = T("studio");
      if (studioTab && studioTab.id) {
        switchTab(studioTab, true);
        updateBrowserTitle();
        return;
      }
    }

    // 3. Subloader route: e.g. /mods/fabric/ — reserved loader names only,
    //    so resource slugs like /mods/sodium/ fall through to case 3b.
    const modsMatch = path.match(/^\/mods\/([a-z0-9_-]+)$/);
    if (modsMatch && ML.includes(modsMatch[1])) {
      const loader = modsMatch[1];
      const modsTab = T("mods");
      if (modsTab && modsTab.id) {
        tab = modsTab;
        document.body.dataset.tab = "mods";
        tabs();
        lf();
        if ($("fl")) {
          $("fl").value = loader;
        }
        go(1);
        updateBrowserTitle();
        return;
      }
    }

    // 3b. Standalone resource page route: e.g. /mods/sodium/
    // (loader names are reserved under /mods/ and handled above)
    const rpRoute = rpParseResourceRoute(path);
    if (rpRoute) {
      openStandaloneResource(rpRoute.tabId, rpRoute.slug);
      return;
    }

    // 4. Resource tab route: /mods, /plugins, /resourcepacks, /shaders, /worlds, etc.
    const cleanId = path.replace(/^\//, "");
    if (cleanId) {
      const matchedTab = T(cleanId);
      if (matchedTab && matchedTab.id) {
        switchTab(matchedTab, true);
        updateBrowserTitle();
        return;
      }
    }

    // 5. Default route: Home
    const homeTab = T("home");
    if (homeTab && homeTab.id) {
      switchTab(homeTab, true);
      updateBrowserTitle();
    }
  } catch (err) {
    console.error("Routing error:", err);
  }
}

window.addEventListener("popstate", () => {
  handleRouteFromUrl(true);
});

function tabs() {
  document.body.dataset.tab = tab ? tab.id : "";
  const activeGroup = getActiveNavGroup();

  // 1. Render Main Navigation Tabs
  $("tabs").innerHTML = NAV_GROUPS.map((g) => {
    const isGroupActive = activeGroup.id === g.id;
    const hasSubs = g.subTabs && g.subTabs.length > 0;

    let dropdownHtml = "";
    if (hasSubs) {
      dropdownHtml = `
        <div class="tb-dropdown">
          ${g.subTabs
            .map((st) => {
              const isSubActive = tab && tab.id === st.id;
              return `<div class="tb-dropdown-item ${isSubActive ? "on" : ""}" data-subid="${st.id}">
                ${st.emoji ? `<span>${st.emoji}</span>` : ""}
                <span>${E(st.name)}</span>
              </div>`;
            })
            .join("")}
        </div>
      `;
    }

    return `
      <div class="tb-wrapper" data-group="${g.id}">
        <button class="tb ${isGroupActive ? "on" : ""}" data-i="${g.defaultTab}" data-group="${g.id}" role="tab" aria-selected="${isGroupActive ? "true" : "false"}">
          ${g.emoji ? `${g.emoji} ` : ""}${E(g.name)}${hasSubs ? '<span class="tb-arr">▾</span>' : ""}
        </button>
        ${dropdownHtml}
      </div>
    `;
  }).join("");

  // Handle tab wrappers hover with strict mutual exclusion
  const allTabWrappers = $("tabs").querySelectorAll(".tb-wrapper");
  allTabWrappers.forEach((wrap) => {
    wrap.onmouseenter = () => {
      // 1. Immediately close ALL other tab wrappers and cancel their leave timers
      allTabWrappers.forEach((other) => {
        if (other !== wrap) {
          if (other._leaveTimer) {
            clearTimeout(other._leaveTimer);
            other._leaveTimer = null;
          }
          other.classList.remove("hover-open");
        }
      });

      // 2. Clear this wrapper's leave timer if active
      if (wrap._leaveTimer) {
        clearTimeout(wrap._leaveTimer);
        wrap._leaveTimer = null;
      }

      // 3. Open this wrapper's subcategory dropdown if it has one
      if (wrap.querySelector(".tb-dropdown")) {
        wrap.classList.add("hover-open");
      }
    };

    wrap.onmouseleave = (e) => {
      // If moving directly into another tab wrapper or navigation area, close immediately with zero delay!
      const related = e.relatedTarget;
      if (related && related.closest && related.closest(".tb-wrapper")) {
        if (wrap._leaveTimer) {
          clearTimeout(wrap._leaveTimer);
          wrap._leaveTimer = null;
        }
        wrap.classList.remove("hover-open");
        return;
      }

      // If leaving navigation bar downwards towards page content, small 150ms grace period
      if (wrap._leaveTimer) clearTimeout(wrap._leaveTimer);
      wrap._leaveTimer = setTimeout(() => {
        wrap.classList.remove("hover-open");
        wrap._leaveTimer = null;
      }, 150);
    };
  });

  // Global mouseleave guard on navigation bar: if cursor leaves #tabs container entirely, close all immediately
  const tabsContainer = $("tabs");
  if (tabsContainer) {
    tabsContainer.onmouseleave = () => {
      allTabWrappers.forEach((wrap) => {
        if (wrap._leaveTimer) {
          clearTimeout(wrap._leaveTimer);
          wrap._leaveTimer = null;
        }
        wrap.classList.remove("hover-open");
      });
    };
  }

  // Attach click handlers to main tabs
  $("tabs").querySelectorAll(".tb").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".tb-wrapper");
      if (wrap) wrap.classList.remove("hover-open");
      const targetTabId = btn.dataset.i;
      const tObj = T(targetTabId);
      switchTab(tObj);
    };
  });

  // Attach click handlers to dropdown items
  $("tabs").querySelectorAll(".tb-dropdown-item").forEach((item) => {
    item.onclick = (e) => {
      e.stopPropagation();
      const wrap = item.closest(".tb-wrapper");
      if (wrap) wrap.classList.remove("hover-open");
      const subId = item.dataset.subid;
      const tObj = T(subId);
      switchTab(tObj);
    };
  });

  // 2. Render Subtabs Bar if active group has subcategories
  const subBar = $("subtabsBar");
  if (subBar) {
    if (activeGroup.subTabs && activeGroup.subTabs.length > 0 && tab.id !== "home") {
      subBar.style.display = "flex";
      subBar.innerHTML = activeGroup.subTabs.map((st) => {
        const isSubActive = tab && tab.id === st.id;
        return `
          <button class="subtab-btn ${isSubActive ? "on" : ""}" data-subid="${st.id}" role="tab" aria-selected="${isSubActive ? "true" : "false"}">
            ${st.emoji ? `<span>${st.emoji}</span>` : ""}
            <span>${E(st.name)}</span>
          </button>
        `;
      }).join("");

      subBar.querySelectorAll(".subtab-btn").forEach((btn) => {
        btn.onclick = () => {
          const subId = btn.dataset.subid;
          const tObj = T(subId);
          switchTab(tObj);
        };
      });
    } else {
      subBar.style.display = "none";
      subBar.innerHTML = "";
    }
  }
}

function setFilterVis(id, visible) {
  const sel = $(id);
  const wrap = document.querySelector(`.glass-select-wrap[data-for="${id}"]`);
  if (sel) {
    sel.dataset.visible = visible ? "1" : "0";
    sel.hidden = true;
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    sel.style.setProperty("display", "none", "important");
  }
  if (wrap) {
    wrap.style.display = visible ? "" : "none";
  }
}

function lf() {
  const isPlugins = tab.id === "plugins";
  const isLaunchers = tab.id === "launchers";
  const isHome = tab.id === "home";
  const isStudio = tab.id === "studio";

  const fbar = document.querySelector(".fl");
  if (fbar) {
    fbar.style.display = (isHome || isStudio) ? "none" : "";
  }
  const hasLoaders = Boolean(tab.loaders && tab.loaders.length);
  const isGithub = tab.kind === "github";

  const defaultLoaderText = isLaunchers
    ? "All Launchers"
    : isPlugins
      ? "Any software"
      : "Any loader";
  const softwareDisplayNames = {
    premium: "Premium Launchers (Official / MS)",
    cracked: "Cracked Launchers (Free / Offline)",
    paper: "Paper",
    spigot: "Spigot",
    bukkit: "Bukkit",
    purpur: "Purpur",
    folia: "Folia",
    sponge: "Sponge",
    velocity: "Velocity",
    bungeecord: "BungeeCord",
    waterfall: "Waterfall",
    leaves: "Leaves",
    pufferfish: "Pufferfish",
    glowstone: "Glowstone",
    geyser: "Geyser",
    fabric: "Fabric",
    forge: "Forge",
    neoforge: "NeoForge",
    quilt: "Quilt",
    liteloader: "LiteLoader",
    rift: "Rift",
    modloader: "ModLoader",
    babric: "Babric",
    "bta-babric": "BTA Babric",
    "legacy-fabric": "Legacy Fabric",
    ornithe: "Ornithe",
    nilloader: "NilLoader",
    cleanroom: "Cleanroom",
    cauldron: "Cauldron",
    iris: "Iris",
    optifine: "OptiFine",
  };
  const cap = (s) => (s ? softwareDisplayNames[s.toLowerCase()] || (s.charAt(0).toUpperCase() + s.slice(1)) : "");

  // Populate loaders / software in native select so glass dropdown syncs from it
  $("fl").innerHTML =
    `<option value="">${defaultLoaderText}</option>` +
    (tab.loaders || [])
      .map((l) => `<option value="${E(l)}">${E(cap(l))}</option>`)
      .join("");

  if ($("src-filter")) {
    const curVal = $("src-filter").value;
    const sources = tab.sources && tab.sources.length ? tab.sources : [
      { id: "modrinth", name: "Modrinth" },
      { id: "curseforge", name: "CurseForge" },
      { id: "planetminecraft", name: "PlanetMinecraft" }
    ];

    $("src-filter").innerHTML =
      '<option value="all">All Sources</option>' +
      sources.map((s) => `<option value="${E(s.id)}">${E(s.name)}</option>`).join("");

    const valid = ["all", ...sources.map((s) => s.id)];
    $("src-filter").value = valid.includes(curVal) ? curVal : "all";
  }

  if (isHome) {
    setFilterVis("src-filter", false);
    setFilterVis("fl", false);
    setFilterVis("fv", false);
    setFilterVis("so", false);
  } else if (isLaunchers) {
    setFilterVis("src-filter", true);
    setFilterVis("fl", true);
    setFilterVis("fv", false);
    setFilterVis("so", false);
  } else {
    setFilterVis("src-filter", !isGithub);
    setFilterVis("fl", hasLoaders && !isGithub);
    setFilterVis("fv", !isGithub);
    setFilterVis("so", !isGithub);
  }

  $("rf").style.display = isGithub ? "" : "none";

  // Ensure all glass selects are initialized and synced immediately
  initAllGlassSelects();
  ["fl", "src-filter", "fv", "so"].forEach((id) => {
    const wrap = document.querySelector(`.glass-select-wrap[data-for="${id}"]`);
    if (wrap && wrap._sync) wrap._sync();
  });
}
async function fetchCustomTabSources(forceRefresh) {
  const aggregatedResults = [];
  let failedSourcesCount = 0;

  for (const sourceUrl of (tab && tab.sources) || []) {
    const cacheKey = "cv_gh_" + sourceUrl;
    let sourceData = null;

    try {
      if (!forceRefresh) {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached && Date.now() - cached.t < 3600000) {
          sourceData = cached.d;
        }
      }

      if (!sourceData) {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error("HTTP " + response.status);
        sourceData = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d: sourceData }));
      }
    } catch {
      try {
        const fallback = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (fallback && fallback.d) sourceData = fallback.d;
        else failedSourcesCount++;
      } catch {
        failedSourcesCount++;
      }
    }

    const itemsList = Array.isArray(sourceData) ? sourceData : (sourceData && sourceData.items) || [];
    for (const item of itemsList) {
      aggregatedResults.push({
        k: tab.id + ":" + (item.id || item.name),
        tab: tab.id,
        title: item.name || item.title,
        icon: item.icon,
        author: item.author || "",
        desc: item.description || item.desc || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        ver: item.version || item.ver || "",
        url: item.download || item.url,
        g: 1,
        pop: item.popup || "",
        links: Array.isArray(item.links) ? item.links : [],
      });
    }
  }

  if (failedSourcesCount > 0) {
    toast(`Could not load ${failedSourcesCount} custom source(s)`);
  }
  return aggregatedResults;
}

const gh = (f) => fetchCustomTabSources(f);
window.fetchCustomTabSources = fetchCustomTabSources;
window.gh = gh;

let isLoadingMore = false;
let autoLoadFailed = false;
let autoObserver = null;

function isLowNetwork() {
  if (navigator.connection) {
    if (navigator.connection.saveData) return true;
    const type = navigator.connection.effectiveType;
    if (type === "slow-2g" || type === "2g") return true;
  }
  return false;
}

async function triggerLoadMore() {
  if (
    isLoadingMore ||
    off >= tot ||
    tab.kind === "github" ||
    tab.id === "home" ||
    tab.id === "launchers" ||
    tab.id === "modloaders" ||
    tab.id === "serversoftwares"
  )
    return;
  isLoadingMore = true;

  const mo = $("mo");
  const loader = $("auto-loader");

  if (loader) loader.style.display = "";
  if (mo) {
    mo.style.display = "none";
    mo.classList.add("hidden");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 9000); // 9-second timeout threshold for slow network

  try {
    await go(0, false, controller.signal);
    clearTimeout(timeoutId);
    autoLoadFailed = false;
    if (loader) loader.style.display = "none";
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Load more failed or network timed out:", err);
    autoLoadFailed = true;
    if (loader) loader.style.display = "none";
    if (mo && tab.id !== "modloaders" && tab.id !== "serversoftwares") {
      mo.style.display = "";
      mo.classList.remove("hidden");
      mo.classList.add("retry-btn");
      mo.innerHTML = "⚠️ Slow Connection — Click to Load More";
    }
  } finally {
    isLoadingMore = false;
  }
}

function setupInfiniteScroll() {
  const wrap = $("mo-wrap");
  if (!wrap || !("IntersectionObserver" in window)) return;
  if (autoObserver) autoObserver.disconnect();

  if (tab.id === "home" || tab.id === "launchers" || tab.id === "modloaders" || tab.id === "serversoftwares") {
    wrap.style.display = "none";
    if ($("mo")) $("mo").style.display = "none";
    if ($("auto-loader")) $("auto-loader").style.display = "none";
    return;
  }

  wrap.style.display = "";

  autoObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        if (
          off < tot &&
          tab.kind !== "github" &&
          tab.id !== "modloaders" &&
          tab.id !== "serversoftwares" &&
          !isLoadingMore &&
          !autoLoadFailed &&
          !isLowNetwork()
        ) {
          triggerLoadMore();
        }
      }
    },
    { rootMargin: "350px 0px" },
  );

  autoObserver.observe(wrap);
}

const MINECRAFT_MAPS = [
  {
    id: "diversity-3",
    title: "Diversity 3",
    author: "qmagnet & Team",
    desc: "The monumental finale of the Diversity CTM map series featuring 10 unique branches: Escape, Trivia, Survival, Puzzle, Parkour, Dropper, and Boss Battle.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/compass.png",
    websiteUrl: "https://www.minecraftmaps.com/c-t-m-maps/diversity-3",
    ver: "1.14.4 - 1.21+",
    tags: ["CTM", "Multiplayer", "Adventure"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 4800000,
    fo: 95000,
    downloadUrl: "https://files.minecraftmaps.com/maps/diversity-3.zip",
    supportedVersions: ["1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  },
  {
    id: "the-dropper-2",
    title: "The Dropper 2: Newton VS Bennu",
    author: "Bigre",
    desc: "The iconic, legendary freefall dropper map featuring 32 mind-bending vertical drop levels through intricate visual and mechanical wonders.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/feather.png",
    websiteUrl: "https://www.minecraftmaps.com/dropper-maps/the-dropper-2",
    ver: "1.12 - 1.21+",
    tags: ["Dropper", "Classic", "Mini-Game"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 6200000,
    fo: 110000,
    downloadUrl: "https://files.minecraftmaps.com/maps/the-dropper-2.zip",
    supportedVersions: ["1.12", "1.14", "1.16", "1.18", "1.20", "1.21"],
  },
  {
    id: "parkour-spiral",
    title: "Parkour Spiral",
    author: "Hielke Maps",
    desc: "A colossal swirling spiral tower full of unique themed parkour environments, custom obstacles, and automatic checkpoints.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rabbit-foot.png",
    websiteUrl: "https://www.minecraftmaps.com/parkour-maps/parkour-spiral",
    ver: "1.16 - 1.21+",
    tags: ["Parkour", "Spiral", "Challenge"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 5100000,
    fo: 88000,
    downloadUrl: "https://files.minecraftmaps.com/maps/parkour-spiral.zip",
    supportedVersions: ["1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  },
  {
    id: "herobrines-mansion",
    title: "Herobrine's Mansion (Remastered)",
    author: "Hypixel",
    desc: "The iconic classic adventure map completely remastered with modern mechanics, custom bosses, weapon shops, and deep lore.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/diamond-sword.png",
    websiteUrl: "https://www.minecraftmaps.com/adventure-maps/herobrines-mansion",
    ver: "1.19 - 1.21+",
    tags: ["Adventure", "RPG", "Boss Fights"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 8900000,
    fo: 145000,
    downloadUrl: "https://files.minecraftmaps.com/maps/herobrines-mansion-remastered.zip",
    supportedVersions: ["1.19", "1.20", "1.21"],
  },
  {
    id: "skyblock-classic",
    title: "SkyBlock 2.1 (Classic Edition)",
    author: "Noobcrew",
    desc: "The world-famous survival challenge: a floating L-shaped island with a single tree and a chest containing ice and lava.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lava-bucket.png",
    websiteUrl: "https://www.minecraftmaps.com/survival-maps/skyblock",
    ver: "All Versions",
    tags: ["Survival", "SkyBlock", "Classic"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 15000000,
    fo: 250000,
    downloadUrl: "https://files.minecraftmaps.com/maps/skyblock-2.1.zip",
    supportedVersions: ["All Versions", "1.12", "1.16", "1.18", "1.20", "1.21"],
  },
  {
    id: "escape-the-prison",
    title: "Escape the Prison: Ultimate Jailbreak",
    author: "McMakistein",
    desc: "An intensely immersive story-driven puzzle escape map featuring custom tools, security cameras, and intricate stealth gameplay.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-bars.png",
    websiteUrl: "https://www.minecraftmaps.com/puzzle-maps/escape-the-prison",
    ver: "1.20 - 1.21+",
    tags: ["Puzzle", "Escape", "Stealth"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 3100000,
    fo: 62000,
    downloadUrl: "https://files.minecraftmaps.com/maps/escape-the-prison.zip",
    supportedVersions: ["1.20", "1.21"],
  },
  {
    id: "castaway-island",
    title: "Castaway - Island Survival",
    author: "SuperCraftKid",
    desc: "Shipwrecked on a dangerous archipelago with custom quests, buried treasure ruins, and volcanic cave systems to explore.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/map.png",
    websiteUrl: "https://www.minecraftmaps.com/survival-maps/castaway",
    ver: "1.20 - 1.21+",
    tags: ["Survival", "Quests", "Islands"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 2400000,
    fo: 47000,
    downloadUrl: "https://files.minecraftmaps.com/maps/castaway-island.zip",
    supportedVersions: ["1.20", "1.21"],
  },
  {
    id: "super-parkour-100",
    title: "The Super Parkour 100",
    author: "Vertex Creations",
    desc: "100 handcrafted stages of dynamic jumping challenges with automated timers and replay ghost runners.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/golden-boots.png",
    websiteUrl: "https://www.minecraftmaps.com/parkour-maps/the-super-parkour-100",
    ver: "1.20 - 1.21+",
    tags: ["Parkour", "100 Stages", "Speedrun"],
    source: "minecraftmaps",
    sourceName: "MinecraftMaps",
    dl: 1900000,
    fo: 39000,
    downloadUrl: "https://files.minecraftmaps.com/maps/super-parkour-100.zip",
    supportedVersions: ["1.20", "1.21"],
  }
];

const PLANET_MINECRAFT_CATALOG = {
  mods: [
    {
      id: "lucky-block",
      title: "Lucky Block Mod",
      author: "PlayerInDistress",
      desc: "Adds the iconic gold Lucky Block with a question mark. Break it to trigger hundreds of completely random, hilarious, or devastating outcomes.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/gold-block.png",
      websiteUrl: "https://www.planetminecraft.com/mod/lucky-block/",
      ver: "1.20 - 1.21+",
      tags: ["Lucky Block", "Fun", "Popular"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 14500000,
      fo: 210000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/lucky-block.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "twilight-forest",
      title: "The Twilight Forest",
      author: "Benimatic",
      desc: "An enchanting dimension mod creating a twilight realm filled with towering hollow trees, labyrinthine dungeons, and legendary boss creatures.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oak-sapling.png",
      websiteUrl: "https://www.planetminecraft.com/mod/the-twilight-forest/",
      ver: "1.18 - 1.21+",
      tags: ["Dimension", "Adventure", "Bosses"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 11200000,
      fo: 175000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/twilight-forest.jar",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "morph-mod",
      title: "Morph Mod",
      author: "iChun",
      desc: "Acquire the shape and unique abilities of any mob or player you slay. Fly like a bat, breathe underwater like a squid, or blend in with the herd.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ghast-tear.png",
      websiteUrl: "https://www.planetminecraft.com/mod/morph-mod/",
      ver: "1.16 - 1.21+",
      tags: ["Morph", "Abilities", "Fun"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 8900000,
      fo: 142000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/morph-mod.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "pixelmon",
      title: "Pixelmon Mod",
      author: "Pixelmon Team",
      desc: "Massive Pokemon overhaul for Minecraft. Catch, train, breed, and battle hundreds of creatures with authentic turn-based battle mechanics.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
      websiteUrl: "https://www.planetminecraft.com/mod/pixelmon-mod/",
      ver: "1.16 - 1.20+",
      tags: ["Pokemon", "RPG", "Adventure"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 16000000,
      fo: 280000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/pixelmon.jar",
      supportedVersions: ["1.16", "1.18", "1.20"],
    },
    {
      id: "mrcrayfish-furniture",
      title: "MrCrayfish's Furniture Mod",
      author: "MrCrayfish",
      desc: "Adds over eighty unique furniture pieces to decorate your home, including couches, TVs, kitchen counters, lamps, blenders, and computer desks.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/furnace.png",
      websiteUrl: "https://www.planetminecraft.com/mod/mrcrayfish-s-furniture-mod/",
      ver: "1.18 - 1.21+",
      tags: ["Decoration", "Furniture", "Modern"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 13400000,
      fo: 198000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/furniture-mod.jar",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "physics-mod",
      title: "Physics Mod",
      author: "Haubna",
      desc: "Revolutionary ragdoll and block fracture physics. Shatter blocks into individual physics-enabled debris and realistic ocean fluid simulation.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tnt.png",
      websiteUrl: "https://www.planetminecraft.com/mod/physics-mod/",
      ver: "1.19 - 1.21+",
      tags: ["Physics", "Ragdoll", "Realistic"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 5200000,
      fo: 89000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/physics-mod.jar",
      supportedVersions: ["1.19", "1.20", "1.21"],
    },
    {
      id: "securitycraft",
      title: "SecurityCraft",
      author: "Geforce",
      desc: "Protect your base from griefers with laser tripwires, retinal scanners, keypad locks, security cameras, landmines, and unbreakable reinforced blocks.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-door.png",
      websiteUrl: "https://www.planetminecraft.com/mod/securitycraft/",
      ver: "1.18 - 1.21+",
      tags: ["Security", "Defense", "Tech"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 7800000,
      fo: 115000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/securitycraft.jar",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "worldedit",
      title: "WorldEdit",
      author: "EngineHub",
      desc: "The ultimate Minecraft map editor. Select regions, generate complex geometric shapes, copy & paste builds, and terraform landscapes in seconds.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wooden-axe.png",
      websiteUrl: "https://www.planetminecraft.com/mod/worldedit/",
      ver: "1.16 - 1.21+",
      tags: ["Building", "Tools", "Editing"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 22000000,
      fo: 340000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/worldedit.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "fabric-api",
      title: "Fabric API",
      author: "FabricMC Team",
      desc: "Core library inter-mod API layer required for most Fabric mods on Minecraft. Provides essential hooks, events, and rendering bridges.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/nether-star.png",
      websiteUrl: "https://www.planetminecraft.com/mod/fabric-api/",
      ver: "1.19 - 1.21+",
      tags: ["Library", "Fabric", "Essential"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 35000000,
      fo: 480000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/fabric-api.jar",
      supportedVersions: ["1.19", "1.20", "1.21"],
    },
    {
      id: "sodium",
      title: "Sodium",
      author: "JellySquid",
      desc: "State-of-the-art open-source rendering engine replacement that dramatically boosts framerates and eliminates micro-stuttering.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/blaze-powder.png",
      websiteUrl: "https://www.planetminecraft.com/mod/sodium/",
      ver: "1.19 - 1.21+",
      tags: ["Optimization", "FPS Boost", "Performance"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 28000000,
      fo: 390000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/mods/sodium.jar",
      supportedVersions: ["1.19", "1.20", "1.21"],
    }
  ],
  plugins: [
    {
      id: "worldedit",
      title: "WorldEdit Plugin",
      author: "EngineHub",
      desc: "The premier in-game Minecraft world editor plugin for Bukkit, Spigot, Paper, Purpur, and Folia servers.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/wooden-axe.png",
      websiteUrl: "https://www.planetminecraft.com/mod/worldedit/",
      ver: "1.16 - 1.21+",
      tags: ["Building", "Administration", "World"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 24000000,
      fo: 370000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/worldedit.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "essentialsx",
      title: "EssentialsX",
      author: "EssentialsX Team",
      desc: "The essential suite for Spigot and Paper servers providing player homes, warps, kits, economy bridges, teleports, and moderation commands.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/compass.png",
      websiteUrl: "https://www.planetminecraft.com/resources/bukkit-plugins/essentialsx/",
      ver: "1.16 - 1.21+",
      tags: ["Server", "Economy", "Commands"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 19000000,
      fo: 290000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/essentialsx.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "vault",
      title: "Vault",
      author: "MilkBowl",
      desc: "Universal economy, permission, and chat permissions abstraction layer connecting economy plugins and permission systems.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/gold-ingot.png",
      websiteUrl: "https://www.planetminecraft.com/resources/bukkit-plugins/vault/",
      ver: "1.14 - 1.21+",
      tags: ["Library", "Economy", "Permissions"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 18500000,
      fo: 260000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/vault.jar",
      supportedVersions: ["1.14", "1.16", "1.18", "1.20", "1.21"],
    },
    {
      id: "luckperms",
      title: "LuckPerms",
      author: "Luck",
      desc: "Fast, comprehensive permissions plugin supporting web editor, MySQL/MariaDB storage, group inheritance, and fine-grained player permissions.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/emerald.png",
      websiteUrl: "https://www.planetminecraft.com/resources/bukkit-plugins/luckperms/",
      ver: "1.16 - 1.21+",
      tags: ["Permissions", "Administration", "Management"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 16000000,
      fo: 245000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/luckperms.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "clearlag",
      title: "ClearLag",
      author: "bobacadodl",
      desc: "Reduce server tick lag and RAM usage by purging redundant dropped items, excessive mob clusters, and monitoring server entity health.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/clock.png",
      websiteUrl: "https://www.planetminecraft.com/resources/bukkit-plugins/clearlag/",
      ver: "1.16 - 1.21+",
      tags: ["Performance", "Lag Clear", "Optimization"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 12000000,
      fo: 180000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/clearlag.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "multiverse-core",
      title: "Multiverse-Core",
      author: "Multiverse Team",
      desc: "The original world management plugin for Bukkit and Spigot servers. Create, manage, import, and teleport between separate custom worlds.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ender-pearl.png",
      websiteUrl: "https://www.planetminecraft.com/resources/bukkit-plugins/multiverse-core/",
      ver: "1.16 - 1.21+",
      tags: ["Multiworld", "Worlds", "Server"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 14000000,
      fo: 215000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/multiverse-core.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "chunky",
      title: "Chunky",
      author: "pop4959",
      desc: "Extremely fast, asynchronous pre-generation plugin for Paper and Spigot to pre-generate chunks without lag spikes.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/map.png",
      websiteUrl: "https://www.planetminecraft.com/resources/bukkit-plugins/chunky/",
      ver: "1.18 - 1.21+",
      tags: ["World Generation", "Pre-generator", "Optimization"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 8500000,
      fo: 130000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/plugins/chunky.jar",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    }
  ],
  resourcepacks: [
    {
      id: "faithful-32x",
      title: "Faithful 32x",
      author: "Faithful Team",
      desc: "Double resolution 32x32 textures that stay 100% faithful to vanilla Minecraft's iconic visual style, crisp and beautiful.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/diamond.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/faithful-32x/",
      ver: "1.16 - 1.21+",
      tags: ["Faithful", "Vanilla+", "32x"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 15000000,
      fo: 230000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/texture-packs/faithful-32x.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "bare-bones",
      title: "Bare Bones",
      author: "RobotPantheon",
      desc: "Simplistic texture pack designed to make Minecraft look like the official promotional trailers with vibrant colors and clean faces.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/apple.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/bare-bones/",
      ver: "1.16 - 1.21+",
      tags: ["Simplified", "Trailer Style", "Clean"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 9200000,
      fo: 165000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/texture-packs/bare-bones.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "sphax-purebdcraft",
      title: "Sphax PureBDcraft",
      author: "BDcraft",
      desc: "Comic-book styled high-definition texture pack transforming blocks into hand-drawn vector art with crisp cel-shaded lines.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/golden-apple.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/sphax-purebdcraft/",
      ver: "1.16 - 1.21+",
      tags: ["Comic Book", "HD", "Cartoon"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 18000000,
      fo: 290000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/texture-packs/sphax-purebdcraft.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "john-smith-legacy",
      title: "John Smith Legacy",
      author: "JimStoneCraft",
      desc: "The quintessential 32x medieval fantasy texture pack with rustic stone walls, warm wooden timbers, and ornate ironwork.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/cobblestone.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/john-smith-legacy/",
      ver: "1.16 - 1.21+",
      tags: ["Medieval", "Rustic", "Fantasy"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 8700000,
      fo: 145000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/texture-packs/john-smith-legacy.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "fresh-animations",
      title: "Fresh Animations",
      author: "FreshLX",
      desc: "Adds dynamic expressions, breathing, eye movements, walking cycles, and physics to every mob in Minecraft via OptiFine/Entity Model Features.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/creeper-head.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/fresh-animations/",
      ver: "1.18 - 1.21+",
      tags: ["Animations", "Expressions", "Mobs"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 12500000,
      fo: 210000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/texture-packs/fresh-animations.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    }
  ],
  shaders: [
    {
      id: "bsl-shaders",
      title: "BSL Shaders",
      author: "Capt Tatsu",
      desc: "Warm realistic lighting, soft volumetric shadows, subtle depth of field, real-time ambient occlusion, and customizable water reflections.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/glowstone-dust.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/bsl-shaders/",
      ver: "1.16 - 1.21+",
      tags: ["Warm Light", "Volumetric", "Performance"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 22000000,
      fo: 330000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/shaders/bsl-shaders.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "complementary-shaders",
      title: "Complementary Shaders - Reimagined",
      author: "EminGT",
      desc: "Tailored to enhance vanilla Minecraft with gorgeous lighting, block-integrated light sources, glowing ores, and unprecedented performance.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sun-stone.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/complementary-shaders/",
      ver: "1.18 - 1.21+",
      tags: ["Reimagined", "Vanilla+", "Glowing Ores"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 19000000,
      fo: 295000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/shaders/complementary-reimagined.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "seus-renewed",
      title: "SEUS Renewed",
      author: "sonicether",
      desc: "Sonic Ether's legendary shaderpack reimagined. Stunning atmospheric sunlight, cinematic cloud coverage, realistic wet ground, and soft shadows.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/prismarine-crystals.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/sonic-ethers-unbelievable-shaders/",
      ver: "1.16 - 1.21+",
      tags: ["Cinematic", "Realistic Water", "Classic"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 25000000,
      fo: 380000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/shaders/seus-renewed.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "sildurs-vibrant-shaders",
      title: "Sildur's Vibrant Shaders",
      author: "Sildur",
      desc: "Adds vibrant volumetric lighting, waving leaves, ray-traced reflections, and runs smoothly on everything from integrated GPUs to RTX rigs.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lantern.png",
      websiteUrl: "https://www.planetminecraft.com/texture-pack/sildurs-vibrant-shaders/",
      ver: "1.16 - 1.21+",
      tags: ["Vibrant", "Fast", "Waving Plants"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 21000000,
      fo: 310000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/shaders/sildurs-vibrant.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    }
  ],
  datapacks: [
    {
      id: "terralith",
      title: "Terralith 2.0 - Overworld Overhaul",
      author: "Stardust Labs",
      desc: "Reinvents overworld terrain generation with over 100 breathtaking biomes, huge canyons, volcanic peaks, and alpine valleys using 100% vanilla blocks.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/grass.png",
      websiteUrl: "https://www.planetminecraft.com/data-pack/terralith/",
      ver: "1.18 - 1.21+",
      tags: ["Biomes", "Worldgen", "No Mods"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 8500000,
      fo: 140000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/datapacks/terralith.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "incendium",
      title: "Incendium - Nether Overhaul",
      author: "Stardust Labs",
      desc: "Complete Nether overhaul featuring 8 new custom biomes, custom Nether castles, sanctums, and unique boss encounters.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/magma-cream.png",
      websiteUrl: "https://www.planetminecraft.com/data-pack/incendium/",
      ver: "1.18 - 1.21+",
      tags: ["Nether", "Dungeons", "Bosses"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 6200000,
      fo: 95000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/datapacks/incendium.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "nullscape",
      title: "Nullscape - End Overhaul",
      author: "Stardust Labs",
      desc: "Transforms the End dimension from a barren wasteland into a vertical realm with towering void spires, crystalline peaks, and ethereal biomes.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/end-stone.png",
      websiteUrl: "https://www.planetminecraft.com/data-pack/nullscape/",
      ver: "1.18 - 1.21+",
      tags: ["The End", "Dimension", "Exploration"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 5800000,
      fo: 88000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/datapacks/nullscape.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "timber-treecapitator",
      title: "Timber! (TreeCapitator)",
      author: "TheNuclearNexus",
      desc: "Chop the bottom log of any tree with an axe to fell the entire tree instantly with natural leaf decay. Saves tons of woodcutting time.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-axe.png",
      websiteUrl: "https://www.planetminecraft.com/data-pack/timber/",
      ver: "1.16 - 1.21+",
      tags: ["Quality of Life", "Trees", "Farming"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 7400000,
      fo: 112000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/datapacks/timber.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    }
  ],
  modpacks: [
    {
      id: "rlcraft",
      title: "RLCraft",
      author: "Shivaxi",
      desc: "The legendary, brutally challenging survival modpack featuring dragons, temperature mechanics, thirst, custom dungeons, and RPG skill progression.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png",
      websiteUrl: "https://www.planetminecraft.com/modpack/rlcraft/",
      ver: "1.12 - 1.20+",
      tags: ["Hardcore", "RPG", "Dragons"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 15000000,
      fo: 240000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/modpacks/rlcraft.zip",
      supportedVersions: ["1.12", "1.16", "1.20"],
    },
    {
      id: "better-mc",
      title: "Better MC",
      author: "SHAPSCAPE",
      desc: "The definitive Vanilla+ modpack that expands Minecraft with hundreds of bosses, new dimensions, overhauled worldgen, and quality-of-life additions.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/netherite-sword.png",
      websiteUrl: "https://www.planetminecraft.com/modpack/better-mc/",
      ver: "1.19 - 1.21+",
      tags: ["Vanilla+", "Adventure", "Quests"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 9800000,
      fo: 165000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/modpacks/better-mc.zip",
      supportedVersions: ["1.19", "1.20", "1.21"],
    },
    {
      id: "all-the-mods-9",
      title: "All the Mods 9 (ATM9)",
      author: "ATM Team",
      desc: "Huge kitchen-sink modpack featuring the best tech, magic, dimension, and automation mods with a custom endgame ATM Star questline.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/beacon.png",
      websiteUrl: "https://www.planetminecraft.com/modpack/all-the-mods-9/",
      ver: "1.20 - 1.21+",
      tags: ["Kitchen Sink", "Tech", "Magic"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 8400000,
      fo: 142000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/modpacks/atm9.zip",
      supportedVersions: ["1.20", "1.21"],
    }
  ],
  worlds: [
    {
      id: "greenfield-city",
      title: "Greenfield - The Largest City in Minecraft",
      author: "Greenfield Team",
      desc: "A monumental 1:1 scale hyper-realistic modern city project spanning thousands of fully furnished skyscrapers, suburbs, highways, and subways.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/minecart.png",
      websiteUrl: "https://www.planetminecraft.com/project/greenfield---new-life-size-city-project/",
      ver: "1.14 - 1.21+",
      tags: ["Mega Build", "City", "Modern"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 7800000,
      fo: 180000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/greenfield-city.zip",
      supportedVersions: ["1.14", "1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "kingdom-of-galekin",
      title: "Kingdom of Galekin",
      author: "Linard",
      desc: "A legendary fantasy kingdom with majestic castles, sprawling medieval towns, winding mountain passes, and hidden dungeons.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shield.png",
      websiteUrl: "https://www.planetminecraft.com/project/kingdom-of-galekin-1803290/",
      ver: "1.12 - 1.21+",
      tags: ["Medieval", "Fantasy", "Kingdom"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 5600000,
      fo: 125000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/kingdom-of-galekin.zip",
      supportedVersions: ["1.12", "1.14", "1.16", "1.18", "1.20", "1.21"],
    },
    {
      id: "novigrad-witcher",
      title: "Novigrad - The Witcher 3 in Minecraft",
      author: "ElysiumFire",
      desc: "Breathtaking cinematic recreation of the grand free city of Novigrad from The Witcher 3, built block-by-block with astounding detail.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-sword.png",
      websiteUrl: "https://www.planetminecraft.com/project/novigrad---the-witcher-3/",
      ver: "1.16 - 1.21+",
      tags: ["Recreation", "Witcher", "Cinematic"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 4200000,
      fo: 94000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/novigrad-witcher.zip",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "tirun-castle",
      title: "Tirun Castle - Fantasy Medieval Citadel",
      author: "Bramboss",
      desc: "Stunning high-fantasy mountain fortress featuring grand cathedrals, detailed interiors, watchtowers, and defensible drawbridges.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/stone-brick.png",
      websiteUrl: "https://www.planetminecraft.com/project/tirun-castle/",
      ver: "1.18 - 1.21+",
      tags: ["Castle", "Fortress", "Medieval"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 3800000,
      fo: 76000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/tirun-castle.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "lost-island-survival",
      title: "The Lost Island - Custom Survival World",
      author: "McMeddon",
      desc: "A 4k x 4k WorldMachine masterpiece featuring custom biomes, realistic alpine mountains, tropical coastlines, and custom ores.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/grass-block.png",
      websiteUrl: "https://www.planetminecraft.com/project/the-lost-island-survival-map/",
      ver: "1.19 - 1.21+",
      tags: ["Terrain", "Custom Biomes", "Survival"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 3300000,
      fo: 68000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/the-lost-island.zip",
      supportedVersions: ["1.19", "1.20", "1.21"],
    },
    {
      id: "cyberpunk-city-2077",
      title: "Cyberpunk City 2077",
      author: "ElysiumFire",
      desc: "A futuristic neon-drenched metropolis with towering mega-structures, flying vehicle lanes, holographic billboards, and underground slums.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/redstone.png",
      websiteUrl: "https://www.planetminecraft.com/project/cyberpunk-city-elysiumfire/",
      ver: "1.16 - 1.21+",
      tags: ["Cyberpunk", "Sci-Fi", "Mega Build"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 4900000,
      fo: 112000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/cyberpunk-city-2077.zip",
      supportedVersions: ["1.16", "1.18", "1.20", "1.21"],
    },
    {
      id: "atlantis-sunken-empire",
      title: "Atlantis - The Sunken Empire",
      author: "GeminiTay",
      desc: "A grand underwater utopia enclosed in custom glass domes with coral architecture, sunken temples, and sea creature statues.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/prismarine-shard.png",
      websiteUrl: "https://www.planetminecraft.com/project/atlantis-underwater-kingdom/",
      ver: "1.18 - 1.21+",
      tags: ["Underwater", "Temple", "Adventure"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 2900000,
      fo: 59000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/atlantis-sunken-empire.zip",
      supportedVersions: ["1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "eldoria-open-world",
      title: "Eldoria - MMORPG Open World Map",
      author: "BlockShot",
      desc: "An expansive fantasy world tailored for server gameplay, with 6 distinct regions, lore monuments, dungeons, and harbor cities.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/emerald.png",
      websiteUrl: "https://www.planetminecraft.com/project/eldoria-open-world/",
      ver: "1.20 - 1.21+",
      tags: ["RPG", "Open World", "Server Ready"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 2100000,
      fo: 43000,
      downloadUrl: "https://media.planetminecraft.com/files/resource_media/projects/eldoria-open-world.zip",
      supportedVersions: ["1.20", "1.21"],
    }
  ],
  serversoftwares: [
    {
      id: "paper",
      title: "Paper (PaperMC)",
      author: "PaperMC Team",
      desc: "High-performance Minecraft server software aiming to fix gameplay and mechanics inconsistencies while improving server performance.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/paper.png",
      websiteUrl: "https://www.planetminecraft.com/",
      ver: "1.21.3",
      tags: ["Server Software", "PaperMC", "High Performance"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 18000000,
      fo: 280000,
      downloadUrl: "https://api.papermc.io/v2/projects/paper/versions/1.21.3/builds/83/downloads/paper-1.21.3-83.jar",
      supportedVersions: ["1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "purpur",
      title: "Purpur",
      author: "PurpurMC",
      desc: "Drop-in replacement for Paper servers designed for configurability, new fun gameplay features, and performance enhancements.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/purpur-block.png",
      websiteUrl: "https://www.planetminecraft.com/",
      ver: "1.21.3",
      tags: ["Server Software", "Purpur", "Configurable"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 8500000,
      fo: 140000,
      downloadUrl: "https://api.purpurmc.org/v2/purpur/1.21.3/latest/download",
      supportedVersions: ["1.19", "1.20", "1.21"],
    }
  ],
  modloaders: [
    {
      id: "fabric",
      title: "Fabric Loader",
      author: "FabricMC Team",
      desc: "Lightweight, modular, and extremely fast modding toolchain for modern Minecraft versions (1.14 - 1.21+). Universal installer for client and server.",
      icon: "https://raw.githubusercontent.com/FabricMC/fabric-website/master/assets/logo.png",
      websiteUrl: "https://www.planetminecraft.com/",
      ver: "0.16.9",
      tags: ["Mod Loader", "Fabric", "Fast"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 32000000,
      fo: 420000,
      downloadUrl: "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar",
      supportedVersions: ["1.14", "1.16", "1.18", "1.19", "1.20", "1.21"],
    },
    {
      id: "forge",
      title: "Minecraft Forge",
      author: "Forge Development LLC",
      desc: "The classic modding API platform powering thousands of popular Minecraft mods. Stable compatibility layer with event bus and mod configs.",
      icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/anvil.png",
      websiteUrl: "https://www.planetminecraft.com/",
      ver: "53.0.7",
      tags: ["Mod Loader", "Forge", "Classic"],
      source: "planetminecraft",
      sourceName: "PlanetMinecraft",
      dl: 45000000,
      fo: 580000,
      downloadUrl: "https://maven.minecraftforge.net/net/minecraftforge/forge/1.21.1-52.0.17/forge-1.21.1-52.0.17-installer.jar",
      supportedVersions: ["1.7", "1.12", "1.16", "1.18", "1.19", "1.20", "1.21"],
    }
  ]
};

const MOD_LOADERS = [
  {
    id: "fabric",
    title: "Fabric Loader",
    author: "FabricMC Team",
    desc: "Lightweight, modular, and extremely fast modding toolchain for modern Minecraft versions (1.14 - 1.21+). Universal installer for client and server.",
    icon: "https://raw.githubusercontent.com/FabricMC/fabric-website/master/assets/logo.png",
    websiteUrl: "https://fabricmc.net/use/installer/",
    ver: "1.0.1 (Installer)",
    tags: ["Universal", "Client/Server", "Lightweight"],
    source: "official",
    sourceName: "FabricMC",
    dl: 185000000,
    fo: 295000,
    downloadUrl: "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar",
    supportedVersions: ["1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  },
  {
    id: "forge",
    title: "Minecraft Forge",
    author: "LexManos & Forge Team",
    desc: "The classic, powerhouse modding API and loader powering tens of thousands of complex Minecraft mods across almost all versions (1.1 - 1.21+).",
    icon: "https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.20.x/src/main/resources/forge_logo.png",
    websiteUrl: "https://files.minecraftforge.net/",
    ver: "Latest Recommended",
    tags: ["Classic", "Forge API", "Client/Server"],
    source: "official",
    sourceName: "MinecraftForge",
    dl: 450000000,
    fo: 580000,
    downloadUrl: "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.3.0/forge-1.20.1-47.3.0-installer.jar",
    supportedVersions: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13", "1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  },
  {
    id: "neoforge",
    title: "NeoForge",
    author: "NeoForged Team",
    desc: "Modern, community-driven continuation and evolution of Minecraft Forge for 1.20.2+ with cleaner APIs, high stability, and modern toolchains.",
    icon: "https://raw.githubusercontent.com/neoforged/NeoForge/main/icon.png",
    websiteUrl: "https://neoforged.net/",
    ver: "21.1.86",
    tags: ["Modern", "Next-Gen", "Forge Evolution"],
    source: "official",
    sourceName: "NeoForged",
    dl: 72000000,
    fo: 142000,
    downloadUrl: "https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.86/neoforge-21.1.86-installer.jar",
    supportedVersions: ["1.20.2", "1.20.3", "1.20.4", "1.20.5", "1.20.6", "1.21", "1.21.1", "1.21.2", "1.21.3", "1.21.4"],
  },
  {
    id: "quilt",
    title: "Quilt Loader",
    author: "The Quilt Project",
    desc: "Community-driven modular mod loader backward-compatible with almost all Fabric mods while offering a modern standard library and developer APIs.",
    icon: "https://raw.githubusercontent.com/QuiltMC/art/master/brand/svg/quilt_logo_light.svg",
    websiteUrl: "https://quiltmc.org/en/install/",
    ver: "0.11.2 (Installer)",
    tags: ["Fabric Compatible", "Modular", "Open Source"],
    source: "official",
    sourceName: "QuiltMC",
    dl: 28000000,
    fo: 65000,
    downloadUrl: "https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/0.11.2/quilt-installer-0.11.2.jar",
    supportedVersions: ["1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"],
  },
  {
    id: "cleanroom",
    title: "Cleanroom (CleanroomMC)",
    author: "CleanroomMC Team",
    desc: "High-performance modern fork of Minecraft Forge 1.12.2 running on modern Java 21+ with massive memory, multithreading, and startup optimizations.",
    icon: "https://avatars.githubusercontent.com/u/41551670?s=200&v=4",
    websiteUrl: "https://github.com/CleanroomMC/Cleanroom",
    ver: "Latest Java 21+",
    tags: ["Java 21+", "Forge 1.12.2", "Extreme Performance"],
    source: "github",
    sourceName: "GitHub",
    dl: 1450000,
    fo: 18200,
    downloadUrl: "https://github.com/CleanroomMC/Cleanroom/releases/latest/download/cleanroom-installer.jar",
    supportedVersions: ["1.12.2"],
  },
  {
    id: "liteloader",
    title: "LiteLoader",
    author: "Mumfrey",
    desc: "Lightweight client-side mod loader specifically designed for mods that don't need to change game mechanics (Macro/Keybind, WorldEdit CUI, VoxelMap).",
    icon: "http://www.liteloader.com/images/icon.png",
    websiteUrl: "http://www.liteloader.com/",
    ver: "1.12.2",
    tags: ["Client Only", "HUD/Macro", "Lightweight"],
    source: "official",
    sourceName: "LiteLoader",
    dl: 65000000,
    fo: 48000,
    downloadUrl: "http://repo.mumfrey.com/content/repositories/snapshots/com/mumfrey/liteloader/1.12.2-SNAPSHOT/liteloader-1.12.2-20180427.180231-1.jar",
    supportedVersions: ["1.5.2", "1.6.4", "1.7.2", "1.7.10", "1.8", "1.8.9", "1.9.4", "1.10.2", "1.11.2", "1.12.2"],
  },
  {
    id: "legacy-fabric",
    title: "Legacy Fabric",
    author: "Legacy Fabric Project",
    desc: "Backport of the modern Fabric loader and API toolchain to legacy Minecraft versions from 1.3 up to 1.13.2.",
    icon: "https://avatars.githubusercontent.com/u/84687258?s=200&v=4",
    websiteUrl: "https://legacyfabric.net/",
    ver: "Universal Installer",
    tags: ["Historic", "Fabric Backport", "Lightweight"],
    source: "github",
    sourceName: "GitHub",
    dl: 890000,
    fo: 12400,
    downloadUrl: "https://github.com/Legacy-Fabric/fabric-installer/releases/latest/download/fabric-installer.jar",
    supportedVersions: ["1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13"],
  },
  {
    id: "rift",
    title: "Rift Loader",
    author: "Chocohead",
    desc: "Experimental lightweight mod loader developed for Minecraft 1.13 and 1.13.2 during the Forge update gap.",
    icon: "https://avatars.githubusercontent.com/u/41595156?s=200&v=4",
    websiteUrl: "https://github.com/Chocohead/Rift",
    ver: "1.0.4",
    tags: ["Minecraft 1.13", "Experimental", "Historic"],
    source: "github",
    sourceName: "GitHub",
    dl: 3200000,
    fo: 15300,
    downloadUrl: "https://github.com/Chocohead/Rift/releases/download/v1.0.4/rift-1.0.4-1.13.2.jar",
    supportedVersions: ["1.13", "1.13.2"],
  },
  {
    id: "modloader",
    title: "Risugami's ModLoader",
    author: "Risugami",
    desc: "The legendary grandfather of all Minecraft mod loaders. Required for classic vintage mods from Beta 1.7.3 through Release 1.5.2.",
    icon: "https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.20.x/src/main/resources/forge_logo.png",
    websiteUrl: "https://mcarchive.net/mods/modloader",
    ver: "1.5.2 Classic",
    tags: ["Vintage", "Beta Era", "Original"],
    source: "official",
    sourceName: "MCArchive",
    dl: 22000000,
    fo: 31000,
    downloadUrl: "https://archive.org/download/minecraft-modloader-archive/ModLoader_1.5.2.zip",
    supportedVersions: ["Beta 1.7.3", "1.0.0", "1.1", "1.2.5", "1.3.2", "1.4.7", "1.5.2"],
  },
  {
    id: "babric",
    title: "Babric (Beta Fabric)",
    author: "Babric Project",
    desc: "Fabric mod loader port and toolchain specifically crafted for the thriving Minecraft Beta 1.7.3 retro modding community.",
    icon: "https://avatars.githubusercontent.com/u/87063138?s=200&v=4",
    websiteUrl: "https://github.com/Babric",
    ver: "Beta 1.7.3",
    tags: ["Beta 1.7.3", "Retro Modding", "Fabric Toolchain"],
    source: "github",
    sourceName: "GitHub",
    dl: 510000,
    fo: 8900,
    downloadUrl: "https://github.com/Babric/fabric-installer/releases/latest/download/fabric-installer.jar",
    supportedVersions: ["Beta 1.7.3"],
  },
  {
    id: "bta-babric",
    title: "BTA Babric (Better Than Adventure)",
    author: "BTA Team & Babric",
    desc: "Custom mod loader tailored for Better Than Adventure (BTA) — the expansive alternate-timeline Minecraft Beta overhaul.",
    icon: "https://avatars.githubusercontent.com/u/87063138?s=200&v=4",
    websiteUrl: "https://bta-wiki.org/wiki/Modding",
    ver: "7.1 Custom",
    tags: ["BTA Overhaul", "Custom Loader", "Beta Alternate"],
    source: "github",
    sourceName: "GitHub",
    dl: 420000,
    fo: 7600,
    downloadUrl: "https://github.com/Babric/fabric-installer/releases/latest/download/fabric-installer.jar",
    supportedVersions: ["BTA 7.1", "Beta 1.7.3"],
  },
  {
    id: "ornithe",
    title: "Ornithe Loader",
    author: "Ornithe Project",
    desc: "Modding toolchain bringing Fabric-style mapping and loader APIs to all historical Minecraft releases and development snapshots.",
    icon: "https://avatars.githubusercontent.com/u/83818961?s=200&v=4",
    websiteUrl: "https://ornithe.dev/",
    ver: "Universal",
    tags: ["Snapshots", "Every Version", "Historic Toolchain"],
    source: "official",
    sourceName: "Ornithe Maven",
    dl: 310000,
    fo: 5200,
    downloadUrl: "https://maven.ornithe.dev/releases/net/ornithe/ornithe-installer/latest/ornithe-installer.jar",
    supportedVersions: ["Alpha", "Beta", "Snapshots", "1.0 - 1.20"],
  },
  {
    id: "nilloader",
    title: "NilLoader",
    author: "Lexis Other",
    desc: "Ultra-minimalist zero-overhead mod loader for running bytecode patches and lightweight runtime hooks in Minecraft.",
    icon: "https://avatars.githubusercontent.com/u/98335805?s=200&v=4",
    websiteUrl: "https://github.com/lexisother/NilLoader",
    ver: "Latest",
    tags: ["Minimalist", "Zero Overhead", "Bytecode Hooks"],
    source: "github",
    sourceName: "GitHub",
    dl: 180000,
    fo: 3400,
    downloadUrl: "https://github.com/lexisother/NilLoader/releases/latest/download/nilloader.jar",
    supportedVersions: ["1.8", "1.12.2", "1.16.5", "1.20"],
  },
  {
    id: "cauldron",
    title: "Cauldron / MCPC+",
    author: "Cauldron Development",
    desc: "High-performance hybrid server software combining Minecraft Forge mods with Bukkit/Spigot plugins simultaneously.",
    icon: "https://avatars.githubusercontent.com/u/3815049?s=200&v=4",
    websiteUrl: "https://cauldron.minecraftforge.net/",
    ver: "1.7.10 Hybrid",
    tags: ["Forge + Bukkit", "Server Hybrid", "Legacy"],
    source: "github",
    sourceName: "GitHub",
    dl: 9800000,
    fo: 21000,
    downloadUrl: "https://github.com/CauldronDevelopmentMC/Cauldron-Server/releases/latest/download/cauldron-1.7.10-installer.jar",
    supportedVersions: ["1.6.4", "1.7.10"],
  }
];

const SERVER_SOFTWARES = [
  {
    id: "paper",
    title: "Paper (PaperMC)",
    author: "PaperMC Team",
    desc: "The next generation of Minecraft server software, providing unprecedented performance, game bug fixes, and rich Bukkit/Spigot plugin API support.",
    icon: "https://avatars.githubusercontent.com/u/7608950?s=200&v=4",
    websiteUrl: "https://papermc.io/software/paper",
    ver: "1.21.3",
    tags: ["High Performance", "Spigot/Bukkit", "Industry Standard"],
    source: "official",
    sourceName: "PaperMC",
    dl: 280000000,
    fo: 310000,
    downloadUrl: "https://api.papermc.io/v2/projects/paper/versions/1.21.3/builds/65/downloads/paper-1.21.3-65.jar",
    supportedVersions: ["1.8.8", "1.12.2", "1.16.5", "1.18.2", "1.19.4", "1.20.4", "1.21", "1.21.1", "1.21.3"],
  },
  {
    id: "purpur",
    title: "Purpur Server",
    author: "PurpurMC Team",
    desc: "Drop-in replacement for Paper servers designed for configurability, new fun gameplay mechanics, and ridiculous performance optimizations.",
    icon: "https://avatars.githubusercontent.com/u/62335191?s=200&v=4",
    websiteUrl: "https://purpurmc.org/",
    ver: "Latest Build",
    tags: ["Configurable", "Paper Fork", "Fun Mechanics"],
    source: "official",
    sourceName: "PurpurMC",
    dl: 95000000,
    fo: 145000,
    downloadUrl: "https://api.purpurmc.org/v2/purpur/1.21.3/latest/download",
    supportedVersions: ["1.16.5", "1.17.1", "1.18.2", "1.19.4", "1.20.4", "1.21", "1.21.1", "1.21.3"],
  },
  {
    id: "folia",
    title: "Folia (PaperMC)",
    author: "PaperMC Team",
    desc: "Revolutionary multithreaded server software by PaperMC that groups nearby chunks into independent regions ticked concurrently across CPU cores.",
    icon: "https://avatars.githubusercontent.com/u/7608950?s=200&v=4",
    websiteUrl: "https://papermc.io/software/folia",
    ver: "Regionized Multi-Thread",
    tags: ["Multithreaded", "High Concurrency", "Revolutionary"],
    source: "official",
    sourceName: "PaperMC",
    dl: 42000000,
    fo: 88000,
    downloadUrl: "https://api.papermc.io/v2/projects/folia/versions/1.21.3/builds/21/downloads/folia-1.21.3-21.jar",
    supportedVersions: ["1.19.4", "1.20.1", "1.20.2", "1.20.4", "1.20.6", "1.21", "1.21.1", "1.21.3"],
  },
  {
    id: "velocity",
    title: "Velocity Proxy",
    author: "PaperMC Team",
    desc: "The modern, ultra-high performance Minecraft proxy server. Designed with security, performance, and flexibility in mind as a successor to BungeeCord.",
    icon: "https://avatars.githubusercontent.com/u/7608950?s=200&v=4",
    websiteUrl: "https://papermc.io/software/velocity",
    ver: "3.3.0",
    tags: ["Proxy Server", "Multi-Server", "Ultra Fast"],
    source: "official",
    sourceName: "PaperMC",
    dl: 68000000,
    fo: 120000,
    downloadUrl: "https://api.papermc.io/v2/projects/velocity/versions/3.3.0-SNAPSHOT/builds/440/downloads/velocity-3.3.0-SNAPSHOT-440.jar",
    supportedVersions: ["1.7.2 - 1.21.x"],
  },
  {
    id: "waterfall",
    title: "Waterfall Proxy",
    author: "PaperMC Team",
    desc: "The battle-tested BungeeCord fork designed for rock-solid stability, performance, and multi-version proxy networks.",
    icon: "https://avatars.githubusercontent.com/u/7608950?s=200&v=4",
    websiteUrl: "https://papermc.io/software/waterfall",
    ver: "Classic Bungee",
    tags: ["Proxy Server", "BungeeCord Fork", "Multi-Server"],
    source: "official",
    sourceName: "PaperMC",
    dl: 110000000,
    fo: 75000,
    downloadUrl: "https://api.papermc.io/v2/projects/waterfall/versions/1.20/builds/548/downloads/waterfall-1.20-548.jar",
    supportedVersions: ["1.8 - 1.20.x"],
  },
  {
    id: "spigot",
    title: "Spigot",
    author: "SpigotMC Team",
    desc: "The classic, ubiquitous Minecraft server software providing the foundational Spigot and Bukkit plugin APIs powering the entire plugin ecosystem.",
    icon: "https://static.spigotmc.org/img/spigot.png",
    websiteUrl: "https://www.spigotmc.org/",
    ver: "BuildTools",
    tags: ["Foundational", "Bukkit API", "Classic"],
    source: "official",
    sourceName: "SpigotMC",
    dl: 380000000,
    fo: 410000,
    downloadUrl: "https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar",
    supportedVersions: ["1.8 - 1.21.x"],
  },
  {
    id: "sponge",
    title: "Sponge Server",
    author: "SpongePowered Team",
    desc: "Comprehensive open-source plugin platform with powerful permissions, events, and world generation management (SpongeVanilla and SpongeForge).",
    icon: "https://spongepowered.org/assets/img/icons/spongie-mark.svg",
    websiteUrl: "https://spongepowered.org/",
    ver: "SpongeAPI 10/11",
    tags: ["Sponge API", "Forge/Vanilla", "Modern Platform"],
    source: "sponge",
    sourceName: "Sponge",
    dl: 52000000,
    fo: 64000,
    downloadUrl: "https://spongepowered.org/downloads",
    supportedVersions: ["1.12.2", "1.16.5", "1.19.4", "1.20.2", "1.21"],
  },
  {
    id: "leaves",
    title: "Leaves Server",
    author: "LeavesMC Team",
    desc: "High performance Paper fork focused on fixing issues and restoring technical vanilla Minecraft behaviors without sacrificing paper performance.",
    icon: "https://avatars.githubusercontent.com/u/105492471?s=200&v=4",
    websiteUrl: "https://leavesmc.top/",
    ver: "Latest Build",
    tags: ["Vanilla Mechanics", "Paper Fork", "Technical Servers"],
    source: "github",
    sourceName: "GitHub",
    dl: 14000000,
    fo: 38000,
    downloadUrl: "https://github.com/LeavesMC/Leaves/releases/latest/download/Leaves-latest.jar",
    supportedVersions: ["1.19.4", "1.20.4", "1.20.6", "1.21.1", "1.21.3"],
  },
  {
    id: "geyser",
    title: "Geyser Standalone",
    author: "GeyserMC Team",
    desc: "Proxy bridging Bedrock Edition players to your Java Edition Minecraft server, enabling true cross-platform multiplayer gameplay.",
    icon: "https://avatars.githubusercontent.com/u/52631977?s=200&v=4",
    websiteUrl: "https://geysermc.org/",
    ver: "Latest Standalone",
    tags: ["Bedrock Bridge", "Cross-Platform", "Standalone"],
    source: "official",
    sourceName: "GeyserMC",
    dl: 125000000,
    fo: 240000,
    downloadUrl: "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/standalone",
    supportedVersions: ["All Java Versions", "All Bedrock Versions"],
  }
];


const HOME_CATEGORIES = [
  {
    id: "mods",
    title: "Mods",
    emoji: "🧩",
    count: "100,000+ Items",
    desc: "Transform your game with gameplay overhauls, new dimensions, magical systems, tech progression, and performance boosters.",
    chips: ["Fabric", "Forge", "NeoForge", "Quilt"],
  },
  {
    id: "modpacks",
    title: "Modpacks",
    emoji: "📦",
    count: "15,000+ Items",
    desc: "Curated collections and themed quests bundling hundreds of mods, optimized configs, custom recipes, and unified gameplay.",
    chips: ["All the Mods", "Better MC", "RLCraft", "SkyFactory", "Quests"],
  },
  {
    id: "modloaders",
    title: "Mod Loaders",
    emoji: "⚙️",
    count: "12+ Loaders",
    desc: "Official installers and core toolchains required to inject, run, and manage client and server mods across all Minecraft releases.",
    chips: ["Fabric", "Forge", "NeoForge", "Quilt", "Babric", "Cleanroom"],
  },
  {
    id: "launchers",
    emoji: "🚀",
    title: "Minecraft Launchers",
    count: "29 Launchers",
    desc: "Download official, performance, PvP, and custom launchers. Choose between Premium (Microsoft auth) and Cracked (free offline play) with Fast Client, Prism, Lunar, and more.",
    chips: ["Fast Client", "Prism", "Modrinth", "Lunar", "Feather", "MultiMC", "SKlauncher", "HMCL"],
  },
  {
    id: "resourcepacks",
    title: "Resource Packs",
    emoji: "🎨",
    count: "40,000+ Items",
    desc: "Revamp visuals with stunning high-definition textures, 3D block models, custom UI interfaces, and immersive soundscapes.",
    chips: ["Faithful", "Bare Bones", "16x - 512x", "Connected Textures"],
  },
  {
    id: "shaders",
    title: "Shaderpacks",
    emoji: "✨",
    count: "1,500+ Items",
    desc: "Experience breathtaking cinematic graphics with volumetric clouds, realistic water reflections, sun rays, and bloom lighting.",
    chips: ["Iris", "Oculus", "OptiFine", "BSL", "Complementary"],
  },
  {
    id: "worlds",
    title: "Worlds & Custom Maps",
    emoji: "🌍",
    count: "30,000+ Items",
    desc: "Epic adventure maps, intricate puzzle challenges, intense parkour courses, survival spawns, and breathtaking architectural builds.",
    chips: ["PlanetMinecraft", "MinecraftMaps", "CTM", "Parkour", "Adventure"],
  },
  {
    id: "datapacks",
    title: "Data Packs",
    emoji: "📦",
    count: "25,000+ Items",
    desc: "Vanilla-compatible enhancements adding custom recipes, dynamic world generation, custom advancements, structures, and loot tables.",
    chips: ["Vanilla Compatible", "WorldGen", "Structures", "No Client Mod Required"],
  },
  {
    id: "plugins",
    title: "Server Plugins",
    emoji: "🔌",
    count: "50,000+ Items",
    desc: "Supercharge your multiplayer server with economy bridges, permission management, minigames, anti-cheat, and protection.",
    chips: ["Paper", "Purpur", "Spigot", "Velocity", "Folia"],
  },
  {
    id: "serversoftwares",
    title: "Server Softwares",
    emoji: "🖥️",
    count: "15+ Softwares",
    desc: "High-performance multiplayer server engines and proxies designed for extreme scalability, multithreading, and plugin support.",
    chips: ["Paper", "Purpur", "Spigot", "Folia", "Leaves", "Velocity"],
  },
];

function switchToTab(catId) {
  const target = T(catId);
  if (!target || !target.id) return;
  tab = target;
  document.body.dataset.tab = tab.id;
  tabs();
  lf();
  go(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openAdvertiseModal() {
  md(1);
  const mx = $("md") ? $("md").querySelector(".mx") : null;
  if (mx) mx.classList.add("ad-mode");
  $("mh").textContent = "Advertise on CraftIndex";
  $("mb").innerHTML = `
    <div class="ad-modal-content">
      <div class="ad-special-banner">
        <span class="ad-special-banner-lead">Reach a wider audience of Minecraft players through CraftIndex. Increase your project's visibility among players discovering Minecraft servers, mods, plugins, maps, resource packs, shaders, and more.</span>
        <div class="ad-special-rate-row">
          <span class="ad-special-badge">Special Rate</span>
          <span class="ad-special-rate-text">Starts at just $1/week</span>
        </div>
      </div>

      <div>
        <h3 class="ad-section-heading">What You Can Promote</h3>
        <div class="ad-promote-grid">
          <div class="ad-promote-card">Minecraft Servers</div>
          <div class="ad-promote-card">Mods, Plugins & Modpacks</div>
          <div class="ad-promote-card">YouTube / Twitch Channels</div>
          <div class="ad-promote-card">Custom Maps & Worlds</div>
          <div class="ad-promote-card">Resource Packs & Shaders</div>
          <div class="ad-promote-card">Server Tools & Utilities</div>
          <div class="ad-promote-card">Minecraft Merchandise & Stores</div>
          <div class="ad-promote-card">Tutorials & Guides</div>
          <div class="ad-promote-card">Discord Communities</div>
          <div class="ad-promote-card">Premium Accounts & Launchers</div>
        </div>
      </div>

      <div>
        <h3 class="ad-section-heading">Placement Options</h3>
        <ul class="ad-placement-list">
          <li><b>Affordable Pricing:</b> Starts at just $1/week with flexible weekly and monthly campaigns.</li>
          <li><b>Home Spotlight Banner:</b> High-visibility featured banner on the main landing hub.</li>
          <li><b>Category Pinned Card:</b> Pinned top spot in Mods, Plugins, Worlds, or Launchers.</li>
          <li><b>Verified Creator Badge:</b> Custom link to your store, Patreon, or Discord server.</li>
        </ul>
      </div>

      <div class="ad-apply-card">
        <div class="ad-apply-title">How to Apply</div>
        <div class="ad-apply-desc">
          Send your project details, banner artwork (600×300 or 1200×400), and link to our team:
          <div class="ad-apply-actions">
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=aratainlooker%40gmail.com" target="_blank" rel="noopener noreferrer" class="btn p">aratainlooker@gmail.com</a>
            <button type="button" class="btn" id="openSocialsFromAdBtn" onclick="openSocialsModal();">Socials (Accepted DMs)</button>
          </div>
        </div>
      </div>
    </div>
  `;
  mf('<button class="btn p" id="adModalClose">Close</button>');
  $("adModalClose").onclick = () => {
    if (mx) mx.classList.remove("ad-mode");
    md(0);
  };
}

function renderHomeView(query) {
  const cats = HOME_CATEGORIES;

  const html = `
    <div class="home-portal-container">
      <div class="home-hero-row">
        <div class="home-hero">
          <div>
            <div class="home-hero-badge">✦ MINECRAFT RESOURCE PLATFORM</div>
            <h1 class="home-hero-title" style="margin-top:10px;">Welcome to CraftIndex</h1>
            <p class="home-hero-desc" style="margin-top:10px;">
              Search, curate, and bulk-download Minecraft addons across <b>Modrinth</b>, <b>CurseForge</b>, <b>PlanetMinecraft</b>, <b>MinecraftMaps</b>, and <b>Official Repositories</b>. Package your selections with 1-click cart export, automatic dependency resolution, and full offline standalone compatibility.
            </p>
          </div>
          <div class="home-stats-strip">
            <span class="home-stat-chip"><b>10</b> Categories</span>
            <span class="home-stat-chip"><b>5</b> Integrated Sources</span>
            <span class="home-stat-chip"><b>1-Click</b> Multi-Folder ZIP Export</span>
            <span class="home-stat-chip"><b>Automated</b> Dependency Resolution</span>
            <span class="home-stat-chip"><b>Offline</b> Standalone Support</span>
          </div>
        </div>

        <div class="home-ad-card" onclick="openAdvertiseModal()">
          <div>
            <div class="home-ad-badge-row">
              <span class="home-ad-badge">PARTNERSHIP & SPONSORSHIP</span>
              <span class="home-ad-price-pill">⚡ Starts at just $1/week</span>
            </div>
            <h2 class="home-ad-title" style="margin-top:10px;">Promote Your Project</h2>
            <p class="home-ad-desc" style="margin-top:8px;">
              Reach a wider audience of Minecraft players through CraftIndex. Increase your project's visibility among players discovering Minecraft servers, mods, plugins, maps, resource packs, shaders, and more.
            </p>
          </div>
          <div class="home-ad-perks">
            <div class="home-ad-perk"><span>🔥</span> Prime spotlight on CraftIndex's discovery portal</div>
            <div class="home-ad-perk"><span>🎯</span> Direct link to your store, Discord, or website</div>
            <div class="home-ad-perk"><span>⚡</span> Targeted reach with enthusiastic Minecraft creators</div>
          </div>
          <div class="home-ad-footer">
            <button type="button" class="btn p home-ad-btn" onclick="event.stopPropagation(); openAdvertiseModal()">
              <span>Promote Your Project</span>
              <span class="arr">→</span>
            </button>
          </div>
        </div>
      </div>

      <div class="home-section-head">
        <h2>Explore Resource Categories</h2>
        <span>Select any category below to browse items, filter by software or version, or add directly to your bulk download cart</span>
      </div>

      <div class="home-portal-grid">
        ${cats
          .map(
            (c) => `
            <div class="home-cat-card" onclick="switchToTab('${E(c.id)}')">
              <div>
                <div class="home-cat-top">
                  <div class="home-cat-icon">${E(c.emoji)}</div>
                  <span class="home-cat-count">${E(c.count)}</span>
                </div>
                <h3 class="home-cat-title" style="margin-top:12px">${E(c.title)}</h3>
                <p class="home-cat-desc" style="margin-top:8px">${E(c.desc)}</p>
              </div>

              <div>
                <div class="home-cat-chips">
                  <span class="home-chip-label">Supported:</span>
                  ${c.chips.map((ch) => `<span class="home-chip">${E(ch)}</span>`).join("")}
                </div>
                <div class="home-cat-footer" style="margin-top:16px">
                  <button type="button" class="btn p home-cat-btn" onclick="event.stopPropagation(); switchToTab('${E(c.id)}')">
                    <span>Explore Category</span>
                    <span class="arr">→</span>
                  </button>
                </div>
              </div>
            </div>
          `
          )
          .join("")}
      </div>
    </div>
  `;

  $("g").innerHTML = html;
  if ($("mo-wrap")) $("mo-wrap").style.display = "none";
  if ($("mo")) $("mo").style.display = "none";
  if ($("auto-loader")) $("auto-loader").style.display = "none";
}

const LAUNCHERS_CATALOG = [
  // --- PREMIUM LAUNCHERS ---
  {
    id: "prism-launcher",
    title: "Prism Launcher",
    author: "PrismLauncher Team",
    desc: "An advanced, open source Minecraft launcher with ability to manage multiple instances, mods, and modpacks with ease.",
    icon: "https://raw.githubusercontent.com/PrismLauncher/PrismLauncher/develop/launcher/resources/multimc/scalable/apps/org.prismlauncher.PrismLauncher.svg",
    websiteUrl: "https://prismlauncher.org/",
    ver: "9.2",
    tags: ["Open Source", "Multi-Instance", "Modrinth/CurseForge Native"],
    source: "official",
    sourceName: "PrismLauncher",
    dl: 12500000,
    fo: 145000,
    downloadUrl: "https://github.com/PrismLauncher/PrismLauncher/releases/latest/download/PrismLauncher-Windows-MSVC-Setup-9.2.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux", "Steam Deck"],
    features: ["Multi-instance isolation", "Modrinth & CurseForge search inside launcher", "Native Fabric, Forge, NeoForge, Quilt installs", "Zero bloat"],
  },
  {
    id: "modrinth-app",
    title: "Modrinth App",
    author: "Modrinth Team",
    desc: "Official open-source launcher from Modrinth featuring fast downloads, instant mod updates, and seamless content discovery.",
    icon: "https://avatars.githubusercontent.com/u/73905587",
    websiteUrl: "https://modrinth.com/app",
    ver: "0.9.3",
    tags: ["Official", "Fast Downloads", "Instant Sync"],
    source: "official",
    sourceName: "Modrinth",
    dl: 28000000,
    fo: 380000,
    downloadUrl: "https://launcher-files.modrinth.com/versions/0.9.3/windows/Modrinth%20App_0.9.3_x64_en-US.msi",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Full Modrinth catalog integration", "Automatic dependency resolution", "Profile sharing via links", "Modern cyber UI"],
  },
  {
    id: "lunar-client",
    title: "Lunar Client",
    author: "Moonsworth",
    desc: "All-in-one PvP and performance client for modern and legacy Minecraft versions with built-in mods and cosmetics.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/moon-stone.png",
    websiteUrl: "https://www.lunarclient.com/",
    ver: "v3.2.19",
    tags: ["High FPS", "PvP Mods", "Modern & Legacy"],
    source: "official",
    sourceName: "LunarClient",
    dl: 95000000,
    fo: 890000,
    downloadUrl: "https://launcherupdates.lunarclientcdn.com/Lunar%20Client%20v3.2.19.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Massive FPS boost", "Built-in 60+ PvP mods", "Cosmetics store", "OptiFine & Sodium built-in"],
  },
  {
    id: "feather-client",
    title: "Feather Client",
    author: "FeatherMC",
    desc: "Modern Minecraft client built for high FPS, built-in voice chat, party system, and vast mod support.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/feather.png",
    websiteUrl: "https://feathermc.com/",
    ver: "Latest",
    tags: ["Voice Chat", "High FPS", "Fabric/Forge"],
    source: "official",
    sourceName: "FeatherMC",
    dl: 32000000,
    fo: 410000,
    downloadUrl: "https://feathermc.com/download/windows",
    subType: "premium",
    platforms: ["Windows", "macOS"],
    features: ["Proximity voice chat", "Real-time party system", "Custom mod support", "FPS booster"],
  },
  {
    id: "badlion-client",
    title: "Badlion Client",
    author: "Badlion ESL",
    desc: "Feature-packed PvP client with built-in anti-cheat, client-side mods, FPS booster, and cosmetics.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/iron-sword.png",
    websiteUrl: "https://client.badlion.net/",
    ver: "4.4.2",
    tags: ["BAC Anti-Cheat", "PvP Mods", "FPS Booster"],
    source: "official",
    sourceName: "Badlion",
    dl: 85000000,
    fo: 720000,
    downloadUrl: "https://client.badlion.net/download",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Over 100 built-in mods", "Badlion Anticheat", "Replay mod integration", "Cross-version support"],
  },
  {
    id: "curseforge-app",
    title: "CurseForge App",
    author: "Overwolf",
    desc: "The official Overwolf launcher for browsing, installing, and updating thousands of CurseForge modpacks and mods.",
    icon: "https://static.curseforge.com/cf-core/v1.0.0/images/favicon.ico",
    websiteUrl: "https://www.curseforge.com/download/app",
    ver: "Standalone",
    tags: ["Official", "CurseForge Catalog", "Modpacks"],
    source: "official",
    sourceName: "CurseForge",
    dl: 140000000,
    fo: 950000,
    downloadUrl: "https://curseforge.overwolf.com/downloads/curseforge-installer.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Complete CurseForge library", "1-click modpack installs", "Automated updates", "Standalone without Overwolf available"],
  },
  {
    id: "atlauncher",
    title: "ATLauncher",
    author: "ATLauncher Team",
    desc: "A simple and easy-to-use Minecraft launcher which allows you to easily download and play modpacks from CurseForge, Modrinth, and ATLauncher.",
    icon: "https://atlauncher.com/assets/images/logo.svg",
    websiteUrl: "https://atlauncher.com/",
    ver: "3.4.37.1",
    tags: ["Multi-Platform", "Fast", "Modrinth/CF"],
    source: "official",
    sourceName: "ATLauncher",
    dl: 22000000,
    fo: 180000,
    downloadUrl: "https://atlauncher.com/download/exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Multi-platform packs", "Backup management", "Custom skins and cape viewer", "Automated Java installer"],
  },
  {
    id: "gdlauncher",
    title: "GDLauncher",
    author: "Gorilla Devs",
    desc: "A beautiful, easy to use, and feature-packed Minecraft custom launcher with automated Java management and modpack installers.",
    icon: "https://avatars.githubusercontent.com/u/52219973",
    websiteUrl: "https://gdlauncher.com/",
    ver: "Carbon v1.2",
    tags: ["Modern UI", "Automatic Java", "Instance Manager"],
    source: "official",
    sourceName: "GDLauncher",
    dl: 19000000,
    fo: 165000,
    downloadUrl: "https://github.com/gorilla-devs/GDLauncher/releases/latest/download/GDLauncher-win.setup.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Electron/Carbon modern UI", "Automatic Java version setup", "CurseForge & Modrinth integration", "Instance duplicator"],
  },
  {
    id: "minecraft-official-launcher",
    title: "Official Minecraft Launcher",
    author: "Mojang Studios / Microsoft",
    desc: "The standard official launcher from Mojang Studios supporting Vanilla, snapshots, and custom Java/Bedrock profiles.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/grass.png",
    websiteUrl: "https://www.minecraft.net/en-us/download",
    ver: "Official Mojang",
    tags: ["Standard", "Official", "Java & Bedrock"],
    source: "official",
    sourceName: "Mojang",
    dl: 600000000,
    fo: 1200000,
    downloadUrl: "https://launcher.mojang.com/download/MinecraftInstaller.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Official Mojang release channel", "Microsoft account security", "Bedrock & Java switchable", "Snapshot testing"],
  },
  {
    id: "meteor-client",
    title: "Meteor Client Launcher",
    author: "Meteor Development",
    desc: "The most advanced utility client and launcher integration for Fabric Minecraft with hundreds of features.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-stone.png",
    websiteUrl: "https://meteorclient.com/",
    ver: "0.5.8",
    tags: ["Utility", "Fabric Only", "Advanced HUD"],
    source: "official",
    sourceName: "MeteorDev",
    dl: 14000000,
    fo: 210000,
    downloadUrl: "https://meteorclient.com/",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Custom GUI with theme editor", "Macro system", "Custom waypoint engine", "High performance on Fabric"],
  },
  {
    id: "labymod-launcher",
    title: "LabyMod Launcher",
    author: "LabyMedia GmbH",
    desc: "All-in-one Minecraft client and launcher offering high customization, voice chat, server browser, and PvP HUDs.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heart-scale.png",
    websiteUrl: "https://www.labymod.net/",
    ver: "LabyMod 4",
    tags: ["All-in-one", "Voice Chat", "LabyMod 4"],
    source: "official",
    sourceName: "LabyMod",
    dl: 48000000,
    fo: 390000,
    downloadUrl: "https://www.labymod.net/download",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Custom HUD editor", "Integrated voice chat", "Multiplayer server address book", "Cross-version modding"],
  },

    {
    id: "multimc",
    title: "MultiMC",
    author: "MultiMC Contributors",
    desc: "The legendary, ultra-lightweight open-source Minecraft launcher designed for power users. Effortlessly manage multiple clean, isolated instances with custom Java arguments.",
    icon: "https://raw.githubusercontent.com/MultiMC/Launcher/develop/launcher/resources/multimc/scalable/apps/multimc.svg",
    websiteUrl: "https://multimc.org/",
    ver: "0.7.0",
    tags: ["Legendary", "Open Source", "Ultra-Lightweight"],
    source: "official",
    sourceName: "MultiMC",
    dl: 38000000,
    fo: 310000,
    downloadUrl: "https://files.multimc.org/downloads/mmc-stable-win32.zip",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Instant multi-instance isolation", "Export and import instance zip archives", "Advanced JVM memory and garbage collection tuning", "Zero bloatware"],
  },
  {
    id: "ftb-app",
    title: "FTB App (Feed The Beast)",
    author: "Feed The Beast Team",
    desc: "The official, dedicated desktop client for Feed The Beast (FTB) modpacks. Access world-famous modpack releases, instant updates, and CurseForge/Modrinth pack discovery.",
    icon: "https://avatars.githubusercontent.com/u/10899268",
    websiteUrl: "https://www.feed-the-beast.com/app",
    ver: "v1.27.4",
    tags: ["Official FTB", "Exclusive Packs", "Auto-Updating"],
    source: "official",
    sourceName: "FeedTheBeast",
    dl: 42000000,
    fo: 490000,
    downloadUrl: "https://apps.modpacks.ch/FTBApp/release/FTBA_windows-x64_latest.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Official FTB modpack ecosystem", "Exclusive pre-release access", "One-click server installation files", "Seamless Microsoft login"],
  },
  {
    id: "technic-launcher",
    title: "Technic Launcher",
    author: "Syndicate LLC",
    desc: "The classic launcher behind legendary modpacks like Tekkit, Attack of the B-Team, Hexxit, and Voltz. Explore over 10,000+ community created modpacks with 1 click.",
    icon: "https://avatars.githubusercontent.com/u/1473138",
    websiteUrl: "https://www.technicpack.net/",
    ver: "v4.804",
    tags: ["Classic Legend", "Tekkit & Hexxit", "10,000+ Packs"],
    source: "official",
    sourceName: "Technic",
    dl: 78000000,
    fo: 650000,
    downloadUrl: "https://launcher.technicpack.net/launcher4/804/TechnicLauncher.exe",
    subType: "premium",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["One-click Tekkit, Hexxit, and B-Team", "Public Platform API with 10,000+ packs", "Custom modpack publishing", "Automatic asset caching"],
  },
  {
    id: "bedrock-launcher",
    title: "Bedrock Launcher",
    author: "Bedrock Launcher Team",
    desc: "Comprehensive unofficial version-manager and launcher for Minecraft: Bedrock Edition on PC. Install, archive, and run any historical or modern Bedrock build independently.",
    icon: "https://raw.githubusercontent.com/BedrockLauncher/BedrockLauncher/master/BedrockLauncher/Resources/Images/AppIcon.ico",
    websiteUrl: "https://bedrocklauncher.github.io/",
    ver: "v2024.11",
    tags: ["Bedrock Edition", "Version Archival", "Open Source"],
    source: "github",
    sourceName: "GitHub",
    dl: 9200000,
    fo: 110000,
    downloadUrl: "https://github.com/BedrockLauncher/BedrockLauncher/releases/latest/download/BedrockLauncher-Setup.exe",
    subType: "premium",
    platforms: ["Windows 10/11"],
    features: ["Run any Minecraft Bedrock version side-by-side", "Custom isolate directories for worlds and packs", "Historical version preservation", "No registry overwrite"],
  },
  {
    id: "pojav-launcher",
    title: "PojavLauncher",
    author: "PojavLauncher Team",
    desc: "Incredible cross-platform Java Edition launcher allowing you to play full Minecraft: Java Edition on mobile devices and desktop systems with full Fabric and Forge support.",
    icon: "https://avatars.githubusercontent.com/u/64295844",
    websiteUrl: "https://pojavlauncherteam.github.io/",
    ver: "v3.3.1.1",
    tags: ["Cross-Platform", "Mobile & PC", "Open Source"],
    source: "github",
    sourceName: "GitHub",
    dl: 31000000,
    fo: 420000,
    downloadUrl: "https://github.com/PojavLauncherTeam/PojavLauncher/releases/latest",
    subType: "premium",
    platforms: ["Windows", "Linux", "macOS", "Android", "iOS"],
    features: ["Play true Java Minecraft from 1.0 to 1.21+", "Support for Fabric, Forge, OptiFine, and NeoForge", "Custom on-screen and controller touch controls", "Multi-architecture JRE runtime"],
  },
  // --- CRACKED / OFFLINE LAUNCHERS ---
  {
    id: "fast-client",
    title: "Fast Client",
    author: "FastClient Team",
    desc: "Lightweight, ultra-fast Minecraft client & launcher engineered for maximum FPS on low-end and budget PCs. Bundles Fabric optimizations, custom cosmetics, and lag reduction.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/thunder-stone.png",
    websiteUrl: "https://fastclient.net",
    ver: "v2.5",
    tags: ["Fast Client", "Max FPS Boost", "Free / Offline & Online"],
    source: "community",
    sourceName: "FastClient",
    dl: 16500000,
    fo: 210000,
    downloadUrl: "https://fastclient.net",
    subType: "cracked",
    platforms: ["Windows", "Linux"],
    features: [
      "Significant frame-rate increase for low-end hardware",
      "Pre-packaged Fabric performance stack (Sodium, Lithium, Iris)",
      "Free custom skin, cape, and cosmetic rendering system",
      "Instant offline/cracked login with Microsoft account fallback"
    ],
  },
  {
    id: "hmcl",
    title: "HMCL (Hello Minecraft! Launcher)",
    author: "HMCL Team",
    desc: "One of the most acclaimed, blazing-fast open-source Minecraft launchers (27,000+ GitHub stars). Lightning-fast downloads, CurseForge/Modrinth pack imports, and offline accounts.",
    icon: "https://avatars.githubusercontent.com/u/74642231",
    websiteUrl: "https://hmcl.huangyuhui.net/",
    ver: "v3.5.9",
    tags: ["Open Source", "27k+ Stars", "High Performance"],
    source: "github",
    sourceName: "GitHub",
    dl: 52000000,
    fo: 680000,
    downloadUrl: "https://github.com/HMCL-dev/HMCL/releases/latest/download/HMCL-3.5.9.exe",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["CurseForge and Modrinth integrated mod & pack downloader", "Automated OptiFine, Fabric, Forge, and NeoForge installer", "Full offline/cracked player authentication", "Extremely low RAM & CPU footprint"],
  },
  {
    id: "pcl2",
    title: "PCL2 (Plain Craft Launcher 2)",
    author: "Hex-Dragon",
    desc: "Visually stunning, high-performance launcher with fluid animations, custom dynamic themes, multi-source high-speed game downloads, and offline/Microsoft login.",
    icon: "https://avatars.githubusercontent.com/u/55294520",
    websiteUrl: "https://github.com/Hex-Dragon/PCL2",
    ver: "v2.8.6",
    tags: ["Cyber Animation UI", "Offline & Online", "Auto Installer"],
    source: "github",
    sourceName: "GitHub",
    dl: 39000000,
    fo: 450000,
    downloadUrl: "https://github.com/Hex-Dragon/PCL2/releases/latest/download/Plain.Craft.Launcher.2.exe",
    subType: "cracked",
    platforms: ["Windows"],
    features: ["Buttery smooth WPF animations and custom themes", "Integrated multi-threaded game and asset downloader", "One-click mod and shader installer", "Complete offline and Microsoft login modes"],
  },
  {
    id: "crystal-launcher",
    title: "Crystal Launcher",
    author: "Crystal Team",
    desc: "Modern and intuitive launcher supporting offline accounts, automated custom modpack installation, server lists, and profile isolation.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oval-stone.png",
    websiteUrl: "https://crystal-launcher.net/",
    ver: "v4.0.1",
    tags: ["Modpack Manager", "Free / Offline", "Server Browser"],
    source: "community",
    sourceName: "CrystalLauncher",
    dl: 11200000,
    fo: 135000,
    downloadUrl: "https://crystal-launcher.net/download",
    subType: "cracked",
    platforms: ["Windows", "Linux"],
    features: ["Dedicated community modpack repository", "Independent Java sandbox and memory management", "Skin and cape support for offline users", "Fast game launcher daemon"],
  },
  {
    id: "shiginima-launcher",
    title: "Shiginima Launcher",
    author: "Shiginima Team",
    desc: "The classic, lightweight offline launcher used by millions of players worldwide. Features zero bloat, instant startup, and full version selector from early Alpha to 1.21+.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-stone.png",
    websiteUrl: "https://teamshiginima.com/",
    ver: "v4.400",
    tags: ["Classic Offline", "Zero Setup", "Historical Versions"],
    source: "community",
    sourceName: "Shiginima",
    dl: 89000000,
    fo: 720000,
    downloadUrl: "https://teamshiginima.com/update/ShiginimaSE.exe",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Requires no installation (standalone portable executable)", "Play every Minecraft version from classic to 1.21+", "Zero telemetry or background resource usage", "Fast one-click name changer"],
  },
  {
    id: "bakaxl",
    title: "BakaXL Launcher",
    author: "TTB-Network",
    desc: "Feature-rich anime and visual-themed launcher with automatic Java runtime environment detection, cloud sync, voice feedback, and dual offline/online account switching.",
    icon: "https://avatars.githubusercontent.com/u/15049386",
    websiteUrl: "https://www.bakaxl.com/",
    ver: "v3.3.4",
    tags: ["Visual Themes", "Dual Account", "Auto Java"],
    source: "community",
    sourceName: "BakaXL",
    dl: 24000000,
    fo: 330000,
    downloadUrl: "https://www.bakaxl.com/download.html",
    subType: "cracked",
    platforms: ["Windows"],
    features: ["Automatic Java detection and 1-click JRE download", "Interactive assistant with voice and anime art", "Full offline cracked and Microsoft authentication", "Built-in mod and resource pack browser"],
  },
  {
    id: "sklauncher",
    title: "SKlauncher",
    author: "SKMedix",
    desc: "Clean, modern, and beautiful Minecraft launcher supporting both offline/cracked accounts and official Microsoft logins with full custom skins.",
    icon: "https://avatars.githubusercontent.com/u/53350172",
    websiteUrl: "https://skmedix.pl/",
    ver: "3.2.14",
    tags: ["Free/Cracked", "Custom Skins", "Microsoft Auth Support"],
    source: "community",
    sourceName: "SKlauncher",
    dl: 45000000,
    fo: 520000,
    downloadUrl: "https://github.com/SKMedix/SKlauncher/releases/latest/download/SKlauncher-3.2.14.exe",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Offline cracked accounts + Microsoft login", "Custom skin and cape system for offline users", "Fabric/Forge/OptiFine one-click install", "Clean dark cyber UI"],
  },
  {
    id: "dawn-client",
    title: "Dawn Client",
    author: "Dawn Launcher Team",
    desc: "Lightweight, beautiful cracked and offline Minecraft launcher with built-in FPS optimization and instant version switching.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sun-stone.png",
    websiteUrl: "https://dawnclient.net/",
    ver: "v2.1",
    tags: ["Cracked", "FPS Optimized", "Lightweight"],
    source: "community",
    sourceName: "DawnClient",
    dl: 8500000,
    fo: 95000,
    downloadUrl: "https://github.com/Dawn-Launcher/DawnLauncher/releases/latest/download/DawnLauncher-Setup.exe",
    subType: "cracked",
    platforms: ["Windows", "Linux"],
    features: ["No Microsoft account required", "Built-in FPS optimizer and fast boot", "Custom user profiles", "Lightweight RAM footprint"],
  },
  {
    id: "tlauncher",
    title: "TLauncher",
    author: "TLauncher Inc",
    desc: "Popular offline Minecraft launcher supporting all versions, forge/optifine installs, skins, and modpacks.",
    icon: "https://tlauncher.org/favicon.ico",
    websiteUrl: "https://tlauncher.org/",
    ver: "2.895",
    tags: ["Popular", "Offline/Cracked", "Built-in Skins"],
    source: "community",
    sourceName: "TLauncher",
    dl: 190000000,
    fo: 850000,
    downloadUrl: "https://tlauncher.org/installer",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["All Minecraft versions 1.0 to 1.21+", "One-click OptiFine and Forge install", "Custom HD skin system", "TL Modpacks browser"],
  },
  {
    id: "salwyrr-launcher",
    title: "Salwyrr Launcher",
    author: "Salwyrr Team",
    desc: "Top-tier cracked PvP client and launcher featuring integrated FPS boost, motion blur, keystrokes, and custom capes.",
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-scale.png",
    websiteUrl: "https://salwyrr.com/",
    ver: "v4",
    tags: ["Cracked PvP", "Motion Blur", "FPS Boost"],
    source: "community",
    sourceName: "Salwyrr",
    dl: 38000000,
    fo: 340000,
    downloadUrl: "https://salwyrr.com/download",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Cracked and offline multiplayer access", "PvP mods (keystrokes, CPS, armor HUD)", "Motion blur & cosmetic capes", "Ultra low latency"],
  },
  {
    id: "tlegacy",
    title: "TLegacy (Original TLauncher)",
    author: "Turikhay / TLegacy Team",
    desc: "Clean, classic, lightweight open-source fork of the original TLauncher without telemetry or bloatware.",
    icon: "https://avatars.githubusercontent.com/u/38890787",
    websiteUrl: "https://tlaun.ch/",
    ver: "1.171",
    tags: ["Open Source", "No Bloat", "Classic Offline"],
    source: "community",
    sourceName: "TLegacy",
    dl: 26000000,
    fo: 290000,
    downloadUrl: "https://tlaun.ch/download",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["Original clean codebase", "Zero adware or telemetry", "Skin system (Ely.by & custom)", "Supports custom auth servers"],
  },
  {
    id: "pollymc",
    title: "PollyMC",
    author: "PollyMC Team",
    desc: "Open-source fork of Prism Launcher allowing offline/cracked accounts, third-party auth, and custom skins without Microsoft account restrictions.",
    icon: "https://avatars.githubusercontent.com/u/108920197",
    websiteUrl: "https://github.com/PollyMC/PollyMC",
    ver: "7.2",
    tags: ["Prism Fork", "Offline Mode", "Multi-Instance"],
    source: "community",
    sourceName: "PollyMC",
    dl: 11000000,
    fo: 140000,
    downloadUrl: "https://github.com/PollyMC/PollyMC/releases/latest/download/PollyMC-Windows-Setup.exe",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux", "Steam Deck"],
    features: ["All Prism Launcher features unlocked", "Offline account management", "Ely.by skin support", "Native CurseForge/Modrinth downloads"],
  },
  {
    id: "ultimmc",
    title: "UltimMC",
    author: "UltimMC Team",
    desc: "Fork of MultiMC with cracked / offline mode support, full instance isolation, and offline account management.",
    icon: "https://avatars.githubusercontent.com/u/98126749",
    websiteUrl: "https://github.com/UltimMC/Launcher",
    ver: "0.6.16",
    tags: ["MultiMC Fork", "Offline Auth", "Lightweight"],
    source: "community",
    sourceName: "UltimMC",
    dl: 15000000,
    fo: 175000,
    downloadUrl: "https://github.com/UltimMC/Launcher/releases/latest/download/UltimMC-Setup.exe",
    subType: "cracked",
    platforms: ["Windows", "macOS", "Linux"],
    features: ["MultiMC lightweight performance", "Offline account creation", "Separate game folders per instance", "Direct jar modding support"],
  },
];

async function go(reset, force, signal) {
  $("g").dataset.anim = reset ? "1" : "";
  if (tab && tab.id !== "studio" && $("g")) {
    $("g").classList.remove("studio-mode");
  }
  if (reset) {
    autoLoadFailed = false;
    off = 0;
    hits = [];
  }
  const t = ++tk;

  const queryText = ($("q").value || "").trim();
  const sortVal = $("so") ? $("so").value : "relevance";
  const loaderVal = $("fl") ? $("fl").value : "";
  const versionVal = $("fv") ? $("fv").value : "";

  document.body.dataset.tab = tab ? tab.id : "";

  if (tab.id === "home") {
    hits = [];
    tot = off = 0;
    if ($("mo-wrap")) $("mo-wrap").style.display = "none";
    if ($("mo")) $("mo").style.display = "none";
    if ($("auto-loader")) $("auto-loader").style.display = "none";
    renderHomeView(queryText);
    return;
  }

  if (tab.id === "studio") {
    hits = [];
    tot = off = 0;
    if ($("g")) $("g").classList.add("studio-mode");
    if ($("mo-wrap")) $("mo-wrap").style.display = "none";
    if ($("mo")) $("mo").style.display = "none";
    if ($("auto-loader")) $("auto-loader").style.display = "none";
    ensurePackStudio().then(() => {
      // Re-check the target container and tab so a fast switch away from
      // Studio does not paint a stale studio view into a hidden grid.
      if (window.CraftIndexStudio && window.CraftIndexStudio.renderStudioView && $("g") && document.body.dataset.tab === "studio") {
        window.CraftIndexStudio.renderStudioView($("g"));
      }
    }).catch(() => {});
    return;
  }

  if (tab.id === "launchers") {
    const q = queryText.toLowerCase();
    let list = LAUNCHERS_CATALOG.map((l) => ({
      k: "launcher:" + l.id,
      id: l.id,
      tab: "launchers",
      source: l.source || "official",
      sourceName: l.sourceName || "Official",
      websiteUrl: l.websiteUrl,
      title: l.title,
      icon: l.icon,
      author: l.author,
      desc: l.desc,
      dl: l.dl,
      fo: l.fo,
      slug: l.id,
      pt: "launcher",
      ver: l.ver,
      tags: l.tags,
      url: l.downloadUrl,
      g: 1,
      cf: 0,
      subType: l.subType,
      platforms: l.platforms,
      features: l.features,
    }));

    if (loaderVal) {
      list = list.filter((l) => l.subType.toLowerCase() === loaderVal.toLowerCase());
    }

    if (q) {
      list = list.filter((l) =>
        (l.title + " " + l.desc + " " + (l.tags || []).join(" ") + " " + l.author + " " + (l.features || []).join(" ")).toLowerCase().includes(q)
      );
    }

    hits = list;
    tot = off = list.length;
    if ($("mo-wrap")) $("mo-wrap").style.display = "none";
    if ($("mo")) $("mo").style.display = "none";
    if ($("auto-loader")) $("auto-loader").style.display = "none";
    return draw();
  }

  if (tab.id === "modloaders") {
    const q = queryText.toLowerCase();
    let list = MOD_LOADERS.map((ml) => {
      let itemVer = ml.ver;
      let itemUrl = ml.downloadUrl;
      let isSupported = true;

      if (versionVal) {
        const vPrefix = versionVal.split(".").slice(0, 2).join(".");
        isSupported = (ml.supportedVersions || []).some(
          (sv) => sv === versionVal || sv === vPrefix || sv.includes("All") || sv.includes("-")
        );
        if (ml.id === "forge") {
          itemVer = versionVal;
          itemUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${versionVal}-recommended/forge-${versionVal}-recommended-installer.jar`;
        } else if (ml.id === "fabric") {
          itemVer = "1.0.1 (MC " + versionVal + ")";
        }
      }

      return {
        k: "ml:" + ml.id,
        id: ml.id,
        tab: "modloaders",
        source: ml.source || "official",
        sourceName: ml.sourceName || "Official",
        websiteUrl: ml.websiteUrl,
        title: ml.title,
        icon: ml.icon,
        author: ml.author,
        desc: ml.desc,
        dl: ml.dl,
        fo: ml.fo,
        slug: ml.id,
        pt: "modloader",
        ver: itemVer,
        tags: ml.tags,
        url: itemUrl,
        g: 1,
        cf: 0,
        supportedVersions: ml.supportedVersions,
        isSupported,
      };
    });

    if (versionVal) {
      list = list.filter((l) => l.isSupported);
    }

    if (q) {
      list = list.filter((l) =>
        (l.title + " " + l.desc + " " + (l.tags || []).join(" ") + " " + l.author).toLowerCase().includes(q)
      );
    }

    if (loaderVal) {
      list = list.filter((l) => l.id.toLowerCase().includes(loaderVal.toLowerCase()));
    }

    hits = list;
    tot = off = list.length;
    if ($("mo-wrap")) $("mo-wrap").style.display = "none";
    if ($("mo")) $("mo").style.display = "none";
    if ($("auto-loader")) $("auto-loader").style.display = "none";
    return draw();
  }

  if (tab.id === "serversoftwares") {
    const q = queryText.toLowerCase();
    let list = SERVER_SOFTWARES.map((ss) => {
      let isSupported = true;
      if (versionVal) {
        const vPrefix = versionVal.split(".").slice(0, 2).join(".");
        isSupported = (ss.supportedVersions || []).some(
          (sv) => sv === versionVal || sv === vPrefix || sv.includes("All") || sv.includes("-")
        );
      }
      return {
        k: "ss:" + ss.id,
        id: ss.id,
        tab: "serversoftwares",
        source: ss.source || "official",
        sourceName: ss.sourceName || "Official",
        websiteUrl: ss.websiteUrl,
        title: ss.title,
        icon: ss.icon,
        author: ss.author,
        desc: ss.desc,
        dl: ss.dl,
        fo: ss.fo,
        slug: ss.id,
        pt: "serversoftware",
        ver: ss.ver,
        tags: ss.tags,
        url: ss.downloadUrl,
        g: 1,
        cf: 0,
        supportedVersions: ss.supportedVersions,
        isSupported,
      };
    });

    if (versionVal) {
      list = list.filter((l) => l.isSupported);
    }

    if (q) {
      list = list.filter((l) =>
        (l.title + " " + l.desc + " " + (l.tags || []).join(" ") + " " + l.author).toLowerCase().includes(q)
      );
    }

    if (loaderVal) {
      list = list.filter((l) => l.id.toLowerCase().includes(loaderVal.toLowerCase()));
    }

    hits = list;
    tot = off = list.length;
    if ($("mo-wrap")) $("mo-wrap").style.display = "none";
    if ($("mo")) $("mo").style.display = "none";
    if ($("auto-loader")) $("auto-loader").style.display = "none";
    return draw();
  }

  if (tab.kind === "github") {
    renderGridSkeleton($("g"));
    hits = await gh(force);
    const q = $("q").value.toLowerCase();
    hits = hits.filter(
      (h) => !q || (h.title + h.desc + h.tags.join()).toLowerCase().includes(q),
    );
    tot = off = hits.length;
    return draw();
  }

  const isPlugins = tab.id === "plugins";
  const srcFilterVal = $("src-filter") ? $("src-filter").value : "all";

  const SF_CF = {
    relevance: 1,
    downloads: 6,
    follows: 2,
    newest: 11,
    updated: 3,
  };
  const CF_LOADER_MAP = {
    forge: 1,
    fabric: 4,
    quilt: 5,
    neoforge: 6,
  };

  if (reset) renderGridSkeleton($("g"));

  const searchModrinth = async (limit, offset) => {
    const f = [];
    if (tab.id === "worlds") {
      f.push(["project_type:mod"]);
      f.push(["categories:world"]);
    } else if (tab.id === "serversoftwares") {
      f.push(["project_type:minecraft_java_server"]);
    } else {
      f.push(["project_type:" + tab.ptype]);
    }
    if (loaderVal) {
      const mrCategoryMap = {
        leaves: "paper",
        pufferfish: "paper",
        glowstone: "bukkit",
      };
      const cat = mrCategoryMap[loaderVal.toLowerCase()] || loaderVal.toLowerCase();
      f.push(["categories:" + cat]);
    }
    if (versionVal) f.push(["versions:" + versionVal]);
    const d = await api(
      "/search?" +
        new URLSearchParams({
          query: queryText,
          facets: JSON.stringify(f),
          index: sortVal,
          limit: limit,
          offset: offset,
        }),
      signal,
    );
    return {
      hits: (d.hits || []).map((h) => ({
        k: "mr:" + h.project_id,
        id: h.project_id,
        tab: tab.id,
        source: "modrinth",
        sourceName: "Modrinth",
        websiteUrl: `https://modrinth.com/${h.project_type || tab.ptype}/${h.slug || h.project_id}`,
        title: h.title,
        icon: h.icon_url,
        author: h.author,
        desc: h.description,
        dl: h.downloads,
        fo: h.follows,
        slug: h.slug,
        pt: tab.ptype,
        tags: (h.display_categories || []).slice(0, 2),
        cf: 0,
      })),
      total: d.total_hits || 0,
    };
  };

  const searchCurseForge = async (limit, offset, forcedSource) => {
    if (!tab.cfClass) return { hits: [], total: 0 };
    const params = new URLSearchParams({
      gameId: 432,
      classId: tab.cfClass,
      searchFilter: queryText,
      pageSize: limit,
      index: offset,
      sortField: SF_CF[sortVal] || 1,
      sortOrder: "desc",
    });
    if (versionVal) params.set("gameVersion", versionVal);
    if (!isPlugins && loaderVal && CF_LOADER_MAP[loaderVal]) {
      params.set("modLoaderType", CF_LOADER_MAP[loaderVal]);
    }

    const d = await cfa("/v1/mods/search?" + params, signal);
    const catSlug =
      tab.id === "mods"
        ? "mc-mods"
        : tab.id === "resourcepacks"
          ? "texture-packs"
          : tab.id === "shaders"
            ? "shaders"
            : tab.id === "datapacks"
              ? "data-packs"
              : tab.id === "modpacks"
                ? "modpacks"
                : tab.id === "worlds"
                  ? "worlds"
                  : tab.id === "serversoftwares"
                    ? "mc-mods"
                    : tab.id === "modloaders"
                      ? "mc-mods"
                      : "bukkit-plugins";

    return {
      hits: (d.data || []).map((m) => {
        const isBk = isPlugins && forcedSource === "bukkit";
        const sName = isBk ? "Bukkit" : "CurseForge";
        const sKey = isBk ? "bukkit" : "curseforge";
        const wUrl = isBk
          ? (m.slug ? `https://dev.bukkit.org/projects/${m.slug}` : "https://dev.bukkit.org/")
          : (m.links && m.links.websiteUrl
              ? m.links.websiteUrl
              : `https://www.curseforge.com/minecraft/${catSlug}/${m.slug || m.id}`);

        return {
          k: (isBk ? "bk:" : "cf:") + m.id,
          id: m.id,
          tab: tab.id,
          source: sKey,
          sourceName: sName,
          websiteUrl: wUrl,
          title: m.name,
          icon: m.logo ? m.logo.thumbnailUrl || m.logo.url : null,
          author: m.authors && m.authors[0] ? m.authors[0].name : "",
          desc: m.summary,
          dl: m.downloadCount,
          fo: m.thumbsUpCount || 0,
          slug: m.slug,
          pt: tab.ptype,
          tags: (m.categories || []).slice(0, 2).map((c) => c.name),
          cf: 1,
        };
      }),
      total: (d.pagination && d.pagination.totalCount) || 0,
    };
  };

  const searchMinecraftMaps = async (limit, offset) => {
    let list = MINECRAFT_MAPS.map((m) => {
      let isSupported = true;
      if (versionVal) {
        const vPrefix = versionVal.split(".").slice(0, 2).join(".");
        isSupported = (m.supportedVersions || []).some(
          (sv) => sv === versionVal || sv === vPrefix || sv.includes("All") || sv.includes("-")
        );
      }
      return {
        k: "mm:" + m.id,
        id: m.id,
        tab: "worlds",
        source: "minecraftmaps",
        sourceName: "MinecraftMaps",
        websiteUrl: m.websiteUrl,
        title: m.title,
        icon: m.icon,
        author: m.author,
        desc: m.desc,
        dl: m.dl,
        fo: m.fo,
        slug: m.id,
        pt: "world",
        ver: m.ver,
        tags: m.tags,
        url: m.downloadUrl,
        g: 1,
        cf: 0,
        supportedVersions: m.supportedVersions,
        isSupported,
      };
    });

    if (versionVal) list = list.filter((l) => l.isSupported);
    if (queryText) {
      const q = queryText.toLowerCase();
      list = list.filter((l) =>
        (l.title + " " + l.desc + " " + (l.tags || []).join(" ") + " " + l.author).toLowerCase().includes(q)
      );
    }
    return {
      hits: list.slice(offset, offset + limit),
      total: list.length,
    };
  };

  const searchPlanetMinecraft = async (catIdOrLimit, limitOrOffset, maybeOffset) => {
    let catId = tab.id;
    let limit = C.per;
    let offset = 0;

    if (typeof catIdOrLimit === "string") {
      catId = catIdOrLimit;
      limit = typeof limitOrOffset === "number" ? limitOrOffset : C.per;
      offset = typeof maybeOffset === "number" ? maybeOffset : 0;
    } else if (typeof catIdOrLimit === "number") {
      limit = catIdOrLimit;
      offset = typeof limitOrOffset === "number" ? limitOrOffset : 0;
    }

    const catalog = PLANET_MINECRAFT_CATALOG[catId] || PLANET_MINECRAFT_CATALOG["worlds"] || [];
    let list = catalog.map((m) => {
      let isSupported = true;
      if (versionVal) {
        const vPrefix = versionVal.split(".").slice(0, 2).join(".");
        isSupported = (m.supportedVersions || []).some(
          (sv) => sv === versionVal || sv === vPrefix || sv.includes("All") || sv.includes("-")
        );
      }
      return {
        k: "pm:" + catId + ":" + m.id,
        id: m.id,
        tab: catId,
        source: "planetminecraft",
        sourceName: "PlanetMinecraft",
        websiteUrl: m.websiteUrl,
        title: m.title,
        icon: m.icon,
        author: m.author,
        desc: m.desc,
        dl: m.dl,
        fo: m.fo,
        slug: m.id,
        pt: catId,
        ver: m.ver,
        tags: m.tags,
        url: m.downloadUrl,
        g: 1,
        cf: 0,
        supportedVersions: m.supportedVersions,
        isSupported,
      };
    });

    if (versionVal) list = list.filter((l) => l.isSupported);
    if (queryText) {
      const q = queryText.toLowerCase();
      list = list.filter((l) =>
        (l.title + " " + l.desc + " " + (l.tags || []).join(" ") + " " + l.author).toLowerCase().includes(q)
      );
    }
    return {
      hits: list.slice(offset, offset + limit),
      total: list.length,
    };
  };

  const searchHangar = async (limit, offset) => {
    try {
      const params = new URLSearchParams({
        limit: limit,
        offset: offset,
        sort: sortVal === "downloads" ? "-downloads" : sortVal === "newest" ? "-created_at" : sortVal === "updated" ? "-updated_at" : "-stars",
      });
      if (queryText) params.set("q", queryText);
      if (versionVal) params.set("version", versionVal);
      if (loaderVal) {
        const hangarPlatformMap = {
          paper: "PAPER",
          purpur: "PAPER",
          spigot: "PAPER",
          bukkit: "PAPER",
          leaves: "PAPER",
          pufferfish: "PAPER",
          folia: "PAPER",
          velocity: "VELOCITY",
          waterfall: "WATERFALL",
          bungeecord: "WATERFALL",
          geyser: "PAPER",
        };
        const hPlat = hangarPlatformMap[loaderVal.toLowerCase()];
        if (hPlat) params.set("platform", hPlat);
      }

      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/hangar"
        : "https://hangar.papermc.io/api/v1";
      const d = await fetch(baseUrl + "/projects?" + params, { signal }).then((r) => r.json());
      return {
        hits: (d.result || []).map((p) => ({
          k: "hg:" + p.namespace.slug,
          id: p.namespace.slug,
          owner: p.namespace.owner,
          tab: tab.id,
          source: "hangar",
          sourceName: "Hangar/PaperMC",
          websiteUrl: `https://hangar.papermc.io/${p.namespace.owner}/${p.namespace.slug}`,
          title: p.name,
          icon: p.avatarUrl,
          author: p.namespace.owner,
          desc: p.description,
          dl: p.stats ? p.stats.downloads : 0,
          fo: p.stats ? p.stats.stars : 0,
          slug: p.namespace.slug,
          pt: "plugin",
          tags: p.category ? [p.category] : ["paper"],
          cf: 0,
        })),
        total: (d.pagination && d.pagination.count) || 0,
      };
    } catch (e) {
      console.warn("Hangar search failed:", e);
      return { hits: [], total: 0 };
    }
  };

  const searchSpigotMC = async (limit, offset) => {
    try {
      const page = Math.floor(offset / limit) + 1;
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/spiget"
        : "https://api.spiget.org/v2";
      let url;
      const q = [queryText, loaderVal && !["spigot", "bukkit", "paper"].includes(loaderVal.toLowerCase()) ? loaderVal : ""].filter(Boolean).join(" ");
      if (q) {
        url = baseUrl + `/search/resources/${encodeURIComponent(q)}?size=${limit}&page=${page}&sort=-downloads`;
      } else {
        url = baseUrl + `/resources?size=${limit}&page=${page}&sort=-downloads`;
      }
      const list = await fetch(url, { signal }).then((r) => r.json());
      return {
        hits: (Array.isArray(list) ? list : []).map((r) => ({
          k: "sp:" + r.id,
          id: r.id,
          tab: tab.id,
          source: "spigotmc",
          sourceName: "SpigotMC",
          websiteUrl: `https://www.spigotmc.org/resources/${r.id}/`,
          title: r.name,
          icon: r.icon && r.icon.data
            ? `data:image/png;base64,${r.icon.data}`
            : `/api/spiget/resources/${r.id}/icon`,
          author: r.author ? String(r.author.id || "") : "",
          desc: r.tag,
          dl: r.downloads || 0,
          fo: r.rating ? r.rating.count : 0,
          slug: String(r.id),
          pt: "plugin",
          tags: ["spigot"],
          cf: 0,
        })),
        total: 1000,
      };
    } catch (e) {
      console.warn("Spigot search failed:", e);
      return { hits: [], total: 0 };
    }
  };

  const searchSponge = async (limit, offset) => {
    try {
      const baseUrl = "/api/sponge";
      const params = new URLSearchParams({
        limit: limit,
        offset: offset,
      });
      if (queryText) params.set("q", queryText);
      const d = await fetch(baseUrl + "/projects?" + params, { signal }).then((r) => r.json());
      return {
        hits: (d.result || []).map((p) => ({
          k: "spg:" + p.plugin_id,
          id: p.plugin_id,
          owner: p.namespace ? p.namespace.owner : "",
          slug: p.namespace ? p.namespace.slug : p.plugin_id,
          tab: tab.id,
          source: "sponge",
          sourceName: "Sponge",
          websiteUrl: `https://ore.spongepowered.org/${p.namespace ? p.namespace.owner : ""}/${p.namespace ? p.namespace.slug : p.plugin_id}`,
          title: p.name,
          // Ore API returns http:// icon URLs which violate the CSP (img-src
          // https:) — upgrade the scheme so cards render instead of erroring.
          icon: p.icon_url ? String(p.icon_url).replace(/^http:\/\//i, "https://") : null,
          author: p.namespace ? p.namespace.owner : "",
          desc: p.description,
          dl: p.stats ? p.stats.downloads : 0,
          fo: p.stats ? p.stats.stars : 0,
          slug: p.plugin_id,
          pt: "plugin",
          tags: ["sponge", p.category || "plugin"],
          cf: 0,
        })),
        total: (d.pagination && d.pagination.count) || 0,
      };
    } catch (e) {
      console.warn("Sponge search failed:", e);
      return { hits: [], total: 0 };
    }
  };

  const searchPolymart = async (limit, offset) => {
    try {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/polymart"
        : "https://api.polymart.org/v1";
      const params = new URLSearchParams({
        limit: limit,
        start: offset,
      });
      const q = [queryText, loaderVal && !["paper", "spigot", "bukkit"].includes(loaderVal.toLowerCase()) ? loaderVal : ""].filter(Boolean).join(" ");
      if (q) params.set("query", q);

      const d = await fetch(baseUrl + "/search?" + params, { signal }).then((r) => r.json());
      const list = (d.response && d.response.result) || [];
      return {
        hits: list.map((p) => ({
          k: "pm:" + p.id,
          id: p.id,
          tab: tab.id,
          source: "polymart",
          sourceName: "Polymart",
          websiteUrl: p.url || `https://polymart.org/resource/${p.id}`,
          title: p.title,
          icon: p.thumbnailURL,
          author: (p.owner && p.owner.name) || "",
          desc: p.subtitle || "",
          dl: p.downloads || 0,
          fo: 0,
          slug: String(p.id),
          pt: "plugin",
          tags: ["polymart", "plugin"],
          cf: 0,
        })),
        total: (d.response && d.response.total) || 500,
      };
    } catch (e) {
      console.warn("Polymart search failed:", e);
      return { hits: [], total: 0 };
    }
  };

  const searchSmithed = async (limit, offset) => {
    try {
      const page = Math.floor(offset / limit) + 1;
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/smithed"
        : "https://api.smithed.dev/v2";
      const params = new URLSearchParams({
        limit: limit,
        page: page,
      });
      if (queryText) params.set("search", queryText);

      const packs = await fetch(baseUrl + "/packs?" + params, { signal }).then((r) => r.json());
      if (!Array.isArray(packs)) return { hits: [], total: 0 };

      // Fetch pack details in parallel to obtain description, icon, versions
      const detailsList = await Promise.all(
        packs.map((p) =>
          fetch(baseUrl + "/packs/" + encodeURIComponent(p.id), { signal })
            .then((r) => r.json())
            .catch(() => null),
        ),
      );

      const validHits = [];
      for (let i = 0; i < packs.length; i++) {
        const p = packs[i];
        const det = detailsList[i] || {};
        const disp = det.display || {};
        validHits.push({
          k: "sm:" + p.id,
          id: det.id || p.id,
          tab: tab.id,
          source: "smithed",
          sourceName: "Smithed",
          websiteUrl: disp.webPage || `https://smithed.net/packs/${det.id || p.id}`,
          title: disp.name || p.displayName || p.id,
          icon: disp.icon || "",
          author: "Smithed",
          desc: disp.description || "",
          dl: 0,
          fo: 0,
          slug: det.id || p.id,
          pt: "datapack",
          tags: ["smithed", "datapack"],
          cf: 0,
        });
      }

      return {
        hits: validHits,
        total: 500,
      };
    } catch (e) {
      console.warn("Smithed search failed:", e);
      return { hits: [], total: 0 };
    }
  };

  const searchGitHub = async (limit, offset) => {
    try {
      const page = Math.floor(offset / limit) + 1;
      const topicMap = {
        mods: "minecraft-mod",
        resourcepacks: "minecraft-resourcepack",
        shaders: "minecraft-shader",
        datapacks: "minecraft-datapack",
      };
      const topic = topicMap[tab.id] || "minecraft";
      const parts = [`topic:${topic}`];
      if (queryText) parts.push(queryText);
      if (loaderVal) parts.push(loaderVal);
      const q = parts.join("+");

      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/github"
        : "https://api.github.com";

      const sortParam = sortVal === "newest" ? "&sort=updated&order=desc" : "&sort=stars&order=desc";
      const url = `${baseUrl}/search/repositories?q=${q}&per_page=${limit}&page=${page}${sortParam}`;
      const d = await fetch(url, { signal, headers: { Accept: "application/vnd.github.v3+json" } }).then((r) => r.json());
      const items = d.items || [];
      return {
        hits: items.map((r) => ({
          k: "gh:" + r.full_name,
          id: r.full_name,
          tab: tab.id,
          source: "github",
          sourceName: "GitHub",
          websiteUrl: r.html_url,
          title: r.name,
          icon: (r.owner && r.owner.avatar_url) || (C.logo || "images/craftindex-icon.png"),
          author: (r.owner && r.owner.login) || "",
          desc: r.description || "Open-source Minecraft project on GitHub",
          dl: r.stargazers_count || 0,
          fo: r.forks_count || 0,
          slug: r.name,
          pt: tab.ptype,
          tags: ["github", tab.id],
          cf: 0,
          defaultBranch: r.default_branch || "main",
        })),
        total: Math.min(d.total_count || 0, 1000),
      };
    } catch (e) {
      console.warn("GitHub search failed:", e);
      return { hits: [], total: 0 };
    }
  };

  try {
    if (!isPlugins) {
      if (tab.id === "datapacks") {
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "smithed") {
          const res = await searchSmithed(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "github") {
          const res = await searchGitHub(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("datapacks", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          // "all" Sources for Data Packs: Modrinth, CurseForge, Smithed, GitHub, PlanetMinecraft
          const perSource = Math.max(3, Math.floor(C.per / 5));
          const [mrRes, cfRes, smRes, ghRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchSmithed(perSource, hits.filter((h) => h.source === "smithed").length),
            searchGitHub(perSource, hits.filter((h) => h.source === "github").length),
            searchPlanetMinecraft("datapacks", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, cfRes, smRes, ghRes, pmRes].map((r) =>
            r.status === "fulfilled" ? r.value.hits : [],
          );
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, cfRes, smRes, ghRes, pmRes].reduce(
            (acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0),
            0,
          );
          off = hits.length;
        }
      } else if (tab.id === "mods") {
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "sponge") {
          const res = await searchSponge(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "github") {
          const res = await searchGitHub(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("mods", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          // "all" Sources for Mods: Modrinth, CurseForge, Sponge, GitHub, PlanetMinecraft
          const perSource = Math.max(3, Math.floor(C.per / 5));
          const [mrRes, cfRes, spRes, ghRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchSponge(perSource, hits.filter((h) => h.source === "sponge").length),
            searchGitHub(perSource, hits.filter((h) => h.source === "github").length),
            searchPlanetMinecraft("mods", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, cfRes, spRes, ghRes, pmRes].map((r) =>
            r.status === "fulfilled" ? r.value.hits : [],
          );
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, cfRes, spRes, ghRes, pmRes].reduce(
            (acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0),
            0,
          );
          off = hits.length;
        }
      } else if (tab.id === "resourcepacks") {
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "smithed") {
          const res = await searchSmithed(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "github") {
          const res = await searchGitHub(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("resourcepacks", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          // "all" Sources for Resource Packs: Modrinth, CurseForge, Smithed, GitHub, PlanetMinecraft
          const perSource = Math.max(3, Math.floor(C.per / 5));
          const [mrRes, cfRes, smRes, ghRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchSmithed(perSource, hits.filter((h) => h.source === "smithed").length),
            searchGitHub(perSource, hits.filter((h) => h.source === "github").length),
            searchPlanetMinecraft("resourcepacks", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, cfRes, smRes, ghRes, pmRes].map((r) =>
            r.status === "fulfilled" ? r.value.hits : [],
          );
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, cfRes, smRes, ghRes, pmRes].reduce(
            (acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0),
            0,
          );
          off = hits.length;
        }
      } else if (tab.id === "shaders") {
        // Shaders tab: Modrinth, CurseForge, GitHub
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "github") {
          const res = await searchGitHub(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("shaders", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          // "all" Sources for Shaders: Modrinth, CurseForge, GitHub, PlanetMinecraft
          const perSource = Math.max(3, Math.floor(C.per / 4));
          const [mrRes, cfRes, ghRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchGitHub(perSource, hits.filter((h) => h.source === "github").length),
            searchPlanetMinecraft("shaders", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, cfRes, ghRes, pmRes].map((r) =>
            r.status === "fulfilled" ? r.value.hits : [],
          );
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, cfRes, ghRes, pmRes].reduce(
            (acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0),
            0,
          );
          off = hits.length;
        }
      } else if (tab.id === "modpacks") {
        // Modpacks tab: Modrinth, CurseForge
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("modpacks", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          const perSource = Math.max(4, Math.floor(C.per / 3));
          const [mrRes, cfRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchPlanetMinecraft("modpacks", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, cfRes, pmRes].map((r) => (r.status === "fulfilled" ? r.value.hits : []));
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, cfRes, pmRes].reduce((acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0), 0);
          off = hits.length;
        }
      } else if (tab.id === "worlds") {
        // Worlds tab: CurseForge, Modrinth, MinecraftMaps, PlanetMinecraft
        if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "minecraftmaps") {
          const res = await searchMinecraftMaps(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          const perSource = Math.max(3, Math.floor(C.per / 4));
          const [cfRes, mrRes, mmRes, pmRes] = await Promise.allSettled([
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchMinecraftMaps(perSource, hits.filter((h) => h.source === "minecraftmaps").length),
            searchPlanetMinecraft(perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [cfRes, mrRes, mmRes, pmRes].map((r) => (r.status === "fulfilled" ? r.value.hits : []));
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [cfRes, mrRes, mmRes, pmRes].reduce((acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0), 0);
          off = hits.length;
        }
      } else if (tab.id === "serversoftwares") {
        // Server Softwares tab: Modrinth, Hangar, Sponge, GitHub
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "hangar") {
          const res = await searchHangar(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "sponge") {
          const res = await searchSponge(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "github") {
          const res = await searchGitHub(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("serversoftwares", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          const perSource = Math.max(3, Math.floor(C.per / 5));
          const [mrRes, hgRes, spRes, ghRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchHangar(perSource, hits.filter((h) => h.source === "hangar").length),
            searchSponge(perSource, hits.filter((h) => h.source === "sponge").length),
            searchGitHub(perSource, hits.filter((h) => h.source === "github").length),
            searchPlanetMinecraft("serversoftwares", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, hgRes, spRes, ghRes, pmRes].map((r) => (r.status === "fulfilled" ? r.value.hits : []));
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, hgRes, spRes, ghRes, pmRes].reduce((acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0), 0);
          off = hits.length;
        }
      } else {
        // Mod Loaders: Modrinth, CurseForge, GitHub
        if (srcFilterVal === "modrinth") {
          const res = await searchModrinth(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "curseforge") {
          const res = await searchCurseForge(C.per, off, "curseforge");
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "github") {
          const res = await searchGitHub(C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else if (srcFilterVal === "planetminecraft") {
          const res = await searchPlanetMinecraft("modloaders", C.per, off);
          if (t !== tk) return;
          hits = hits.concat(res.hits);
          tot = res.total;
          off += res.hits.length;
        } else {
          const perSource = Math.max(3, Math.floor(C.per / 4));
          const [mrRes, cfRes, ghRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchGitHub(perSource, hits.filter((h) => h.source === "github").length),
            searchPlanetMinecraft("modloaders", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, cfRes, ghRes, pmRes].map((r) => (r.status === "fulfilled" ? r.value.hits : []));
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, cfRes, ghRes, pmRes].reduce((acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0), 0);
          off = hits.length;
        }
      }
    } else {
      // Plugins tab: Modrinth, Hangar, SpigotMC, Bukkit, CurseForge, Sponge, Polymart
      if (srcFilterVal === "modrinth") {
        const res = await searchModrinth(C.per, off);
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else if (srcFilterVal === "hangar") {
        const res = await searchHangar(C.per, off);
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else if (srcFilterVal === "spigotmc") {
        const res = await searchSpigotMC(C.per, off);
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else if (srcFilterVal === "bukkit") {
        const res = await searchCurseForge(C.per, off, "bukkit");
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else if (srcFilterVal === "curseforge") {
        const res = await searchCurseForge(C.per, off, "curseforge");
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else if (srcFilterVal === "sponge") {
        const res = await searchSponge(C.per, off);
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else if (srcFilterVal === "polymart") {
        const res = await searchPolymart(C.per, off);
        if (t !== tk) return;
        hits = hits.concat(res.hits);
        tot = res.total;
        off += res.hits.length;
      } else {
        // "all" Sources for Plugins:
        if (loaderVal === "sponge") {
          const sOff = hits.filter((h) => h.source === "sponge").length;
          const mOff = hits.filter((h) => h.source === "modrinth").length;
          const half = Math.ceil(C.per / 2);
          const [sRes, mRes] = await Promise.allSettled([
            searchSponge(half, sOff),
            searchModrinth(half, mOff),
          ]);
          if (t !== tk) return;
          const sData = sRes.status === "fulfilled" ? sRes.value : { hits: [], total: 0 };
          const mData = mRes.status === "fulfilled" ? mRes.value : { hits: [], total: 0 };
          const merged = [];
          const maxLen = Math.max(sData.hits.length, mData.hits.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < sData.hits.length) merged.push(sData.hits[i]);
            if (i < mData.hits.length) merged.push(mData.hits[i]);
          }
          hits = hits.concat(merged);
          tot = sData.total + mData.total;
          off = hits.length;
        } else {
          const perSource = Math.max(4, Math.floor(C.per / 6));
          const [mrRes, hgRes, spRes, bkRes, cfRes, polyRes, pmRes] = await Promise.allSettled([
            searchModrinth(perSource, hits.filter((h) => h.source === "modrinth").length),
            searchHangar(perSource, hits.filter((h) => h.source === "hangar").length),
            searchSpigotMC(perSource, hits.filter((h) => h.source === "spigotmc").length),
            searchCurseForge(perSource, hits.filter((h) => h.source === "bukkit").length, "bukkit"),
            searchCurseForge(perSource, hits.filter((h) => h.source === "curseforge").length, "curseforge"),
            searchPolymart(perSource, hits.filter((h) => h.source === "polymart").length),
            searchPlanetMinecraft("plugins", perSource, hits.filter((h) => h.source === "planetminecraft").length),
          ]);
          if (t !== tk) return;
          const lists = [mrRes, hgRes, spRes, bkRes, cfRes, polyRes, pmRes].map((r) =>
            r.status === "fulfilled" ? r.value.hits : [],
          );
          const maxLen = Math.max(...lists.map((l) => l.length));
          const merged = [];
          for (let i = 0; i < maxLen; i++) {
            for (let s = 0; s < lists.length; s++) {
              if (lists[s][i]) merged.push(lists[s][i]);
            }
          }
          hits = hits.concat(merged);
          tot = [mrRes, hgRes, spRes, bkRes, cfRes, polyRes, pmRes].reduce(
            (acc, r) => acc + (r.status === "fulfilled" ? r.value.total : 0),
            0,
          );
          off = hits.length;
        }
      }
    }
    hits = mergeHits(hits);
    draw();
  } catch (e) {
    if (reset) {
      $("g").innerHTML = `<div class="em">Could not fetch resources (${E(e.message)}). Please check your connection.</div>`;
    }
    throw e;
  }
}


function normalizeMatchKey(it) {
  let title = (it.title || "").toLowerCase();
  title = title.replace(/\(.*?\)|\[.*?\]/g, "");
  title = title.replace(/\b(mod|plugin|datapack|data pack|resource pack|texture pack|shaders?|pack|world)\b/g, "");
  title = title.replace(/[^a-z0-9]/g, "");

  let slug = (it.slug || it.id || "").toLowerCase();
  slug = slug.replace(/\(.*?\)|\[.*?\]/g, "");
  slug = slug.replace(/[^a-z0-9]/g, "");

  const key = slug && slug.length >= 3 && !['mod','plugin','pack','world','minecraft'].includes(slug) ? slug : title;
  return (it.tab || "default") + ":" + key;
}

function mergeHits(rawHits) {
  const mergedMap = new Map();
  const output = [];

  for (const it of rawHits) {
    const key = normalizeMatchKey(it);

    const thisSource = {
      id: it.source || "modrinth",
      name: it.sourceName || it.source || "Modrinth",
      url: it.websiteUrl || it.url || "",
      downloadUrl: it.url || it.downloadUrl || "",
      ver: it.ver || "",
      dl: it.dl,
      fo: it.fo,
      icon: it.icon,
      author: it.author,
      g: it.g,
      cf: it.cf,
      pt: it.pt,
      tags: it.tags || [],
      supportedVersions: it.supportedVersions || [],
      rawKey: it.k
    };

    if (!mergedMap.has(key)) {
      it.sources = [thisSource];
      mergedMap.set(key, it);
      output.push(it);
    } else {
      const existing = mergedMap.get(key);
      if (!existing.sources) {
        existing.sources = [{
          id: existing.source || "modrinth",
          name: existing.sourceName || existing.source || "Modrinth",
          url: existing.websiteUrl || existing.url || "",
          downloadUrl: existing.url || existing.downloadUrl || "",
          ver: existing.ver || "",
          dl: existing.dl,
          fo: existing.fo,
          icon: existing.icon,
          author: existing.author,
          g: existing.g,
          cf: existing.cf,
          pt: existing.pt,
          tags: existing.tags || [],
          supportedVersions: existing.supportedVersions || [],
          rawKey: existing.k
        }];
      }

      if (!existing.sources.some((s) => s.id === thisSource.id)) {
        existing.sources.push(thisSource);
      }

      if ((!existing.desc || existing.desc.length < 25) && it.desc && it.desc.length > 25) {
        existing.desc = it.desc;
      }
      if (!existing.icon && it.icon) existing.icon = it.icon;
      if (it.dl && (!existing.dl || it.dl > existing.dl)) existing.dl = it.dl;
      if (it.fo && (!existing.fo || it.fo > existing.fo)) existing.fo = it.fo;
      if (it.tags && it.tags.length) {
        existing.tags = Array.from(new Set([...(existing.tags || []), ...it.tags]));
      }
      if (it.supportedVersions && it.supportedVersions.length) {
        existing.supportedVersions = Array.from(new Set([...(existing.supportedVersions || []), ...it.supportedVersions]));
      }
    }
  }

  return output;
}

function applyChosenSource(h, chosen) {
  h.source = chosen.id;
  h.sourceName = chosen.name;
  if (chosen.url) h.websiteUrl = chosen.url;
  if (chosen.downloadUrl) h.url = chosen.downloadUrl;
  if (chosen.ver) h.ver = chosen.ver;
  h.selectedSource = chosen.id;
}

const ALL_SOURCES = [
  { id: "modrinth", name: "Modrinth" },
  { id: "curseforge", name: "CurseForge" },
  { id: "planetminecraft", name: "PlanetMinecraft" },
  { id: "hangar", name: "Hangar/PaperMC" },
  { id: "spigotmc", name: "SpigotMC" },
  { id: "bukkit", name: "Bukkit" },
  { id: "sponge", name: "Sponge" },
  { id: "polymart", name: "Polymart" },
  { id: "github", name: "GitHub" },
  { id: "minecraftmaps", name: "MinecraftMaps" },
  { id: "smithed", name: "Smithed" },
  { id: "official", name: "Official Sites" },
];

const SOURCE_CATEGORIES = [
  { id: "mods", name: "Mods", emoji: "🧩" },
  { id: "plugins", name: "Plugins", emoji: "🔌" },
  { id: "resourcepacks", name: "Resource Packs", emoji: "🎨" },
  { id: "shaders", name: "Shaders", emoji: "✨" },
  { id: "datapacks", name: "Data Packs", emoji: "📦" },
  { id: "modpacks", name: "Modpacks", emoji: "🎒" },
  { id: "worlds", name: "Worlds", emoji: "🌍" },
  { id: "serversoftwares", name: "Server Softwares", emoji: "⚙️" },
  { id: "modloaders", name: "Mod Loaders", emoji: "🔧" },
  { id: "launchers", name: "Minecraft Launchers", emoji: "🚀" },
];

const DEFAULT_CATEGORY_SOURCES = {
  mods: { primary: "modrinth", secondary: "curseforge" },
  plugins: { primary: "hangar", secondary: "spigotmc" },
  resourcepacks: { primary: "modrinth", secondary: "planetminecraft" },
  shaders: { primary: "modrinth", secondary: "curseforge" },
  datapacks: { primary: "planetminecraft", secondary: "modrinth" },
  modpacks: { primary: "modrinth", secondary: "curseforge" },
  worlds: { primary: "minecraftmaps", secondary: "planetminecraft" },
  serversoftwares: { primary: "modrinth", secondary: "hangar" },
  modloaders: { primary: "modrinth", secondary: "github" },
  launchers: { primary: "official", secondary: "github" },
};

function getCategorySources(catId) {
  const tab = C.tabs.find((t) => t.id === catId);
  if (tab && tab.sources && tab.sources.length) {
    return tab.sources;
  }
  return ALL_SOURCES;
}

function getFriendlySourceName(id) {
  if (!id) return "Unknown";
  const s = ALL_SOURCES.find((x) => x.id === id);
  return s ? s.name : id.charAt(0).toUpperCase() + id.slice(1);
}

function getSourcePrefs(catId) {
  let prefs = {};
  try {
    prefs = JSON.parse(safeStorage.getItem("cv_source_prefs") || "{}");
  } catch (e) {}

  const cat = catId || "mods";
  const def = DEFAULT_CATEGORY_SOURCES[cat] || { primary: "modrinth", secondary: "curseforge" };
  const legacyPrim = localStorage.getItem("cv_primary_source");
  const legacySec = localStorage.getItem("cv_secondary_source");

  const catPref = prefs[cat] || {};
  const primary = catPref.primary || (cat === "mods" && legacyPrim ? legacyPrim : def.primary);
  const secondary = catPref.secondary || (cat === "mods" && legacySec ? legacySec : def.secondary);

  return { primary, secondary };
}

function saveSourcePrefs(catId, primary, secondary) {
  let prefs = {};
  try {
    prefs = JSON.parse(safeStorage.getItem("cv_source_prefs") || "{}");
  } catch (e) {}

  const cat = catId || "mods";
  prefs[cat] = { primary, secondary };
  localStorage.setItem("cv_source_prefs", JSON.stringify(prefs));

  if (cat === "mods") {
    localStorage.setItem("cv_primary_source", primary);
    localStorage.setItem("cv_secondary_source", secondary);
  }
}

function openSourceSelectorModal(h, onComplete) {
  md(1);
  $("mh").textContent = "Select Download Source";

  const catId = h.tab || "mods";
  const catObj = SOURCE_CATEGORIES.find((c) => c.id === catId) || { id: catId, name: getCatLabel(catId), emoji: "📦" };
  const { primary: primaryPref, secondary: secondaryPref } = getSourcePrefs(catId);
  const autoPref = safeStorage.getItem("cv_auto_source") !== "0";

  const sourcesList = h.sources && h.sources.length ? h.sources : [
    {
      id: h.source || "modrinth",
      name: h.sourceName || h.source || "Modrinth",
      url: h.websiteUrl || "",
      downloadUrl: h.url || "",
      ver: h.ver || "",
      dl: h.dl,
      fo: h.fo
    }
  ];

  let defaultSelectId = sourcesList[0].id;
  let fallbackNote = "";

  const hasPrimary = primaryPref !== "ask" && sourcesList.some((s) => s.id === primaryPref);
  const hasSecondary = secondaryPref !== "none" && sourcesList.some((s) => s.id === secondaryPref);

  if (hasPrimary) {
    defaultSelectId = primaryPref;
  } else if (hasSecondary) {
    defaultSelectId = secondaryPref;
    if (primaryPref !== "ask") {
      fallbackNote = `Primary source (<b>${getFriendlySourceName(primaryPref)}</b>) is not available for this ${catObj.name}. Automatically fell back to your secondary source (<b>${getFriendlySourceName(secondaryPref)}</b>).`;
    }
  } else {
    defaultSelectId = sourcesList[0].id;
    if (primaryPref !== "ask") {
      if (secondaryPref !== "none") {
        fallbackNote = `Neither primary (<b>${getFriendlySourceName(primaryPref)}</b>) nor secondary source (<b>${getFriendlySourceName(secondaryPref)}</b>) is available for this ${catObj.name}. Please pick where to download it:`;
      } else {
        fallbackNote = `Primary source (<b>${getFriendlySourceName(primaryPref)}</b>) is not available for this ${catObj.name}. Please pick where to download it:`;
      }
    }
  }

  const catSources = getCategorySources(catId);

  $("mb").innerHTML = `
    <div class="src-dialog-wrap">
      <div class="src-dialog-header">
        ${ico(h)}
        <div>
          <div class="src-dialog-title">${E(h.title)}</div>
          <div class="src-dialog-sub">This ${E(catObj.name.toLowerCase())} is hosted on multiple sources. Choose where to download it from:</div>
        </div>
      </div>

      ${fallbackNote ? `
        <div class="src-fallback-banner">
          <span class="src-fallback-ico">⚠️</span>
          <span>${fallbackNote}</span>
        </div>
      ` : ""}

      <div class="src-dialog-label">Available Sources for this Resource:</div>
      <div class="src-cards-list">
        ${sourcesList
          .map(
            (s) => `
          <label class="src-card-choice ${s.id === defaultSelectId ? "active" : ""}" data-src="${E(s.id)}">
            <input type="radio" name="selected_src" value="${E(s.id)}" ${s.id === defaultSelectId ? "checked" : ""} />
            <div class="src-card-dot"></div>
            <div class="src-card-body">
              <div class="src-card-top">
                <span class="source-link ${E(s.id)}"><span class="source-dot"></span><span>${E(s.name)}</span></span>
                ${s.ver ? `<span class="src-card-ver">v${E(s.ver)}</span>` : ""}
                ${s.dl ? `<span class="src-card-dl">⬇ ${fmt(s.dl)}</span>` : ""}
              </div>
              <a href="${E(s.url || h.websiteUrl)}" target="_blank" rel="noopener" class="src-card-link" onclick="event.stopPropagation()">View official page ↗</a>
            </div>
          </label>
        `,
          )
          .join("")}
      </div>

      <div class="src-perm-container">
        <div class="src-perm-head">
          <span class="src-perm-ico">${catObj.emoji}</span>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <b>Permanent Preferences for ${E(catObj.name)}</b>
              <button type="button" class="src-cat-manage-link" id="src-open-all-cats">⚙️ All Categories...</button>
            </div>
            <span>Configure automatic cascading source selection for future ${E(catObj.name)} adds</span>
          </div>
        </div>

        <div class="src-perm-grid">
          <div class="src-perm-field">
            <label for="perm-primary">1. ${E(catObj.name)} Primary Default Source</label>
            <select id="perm-primary" class="src-perm-dropdown">
              <option value="ask" ${primaryPref === "ask" ? "selected" : ""}>Always Ask (Show Source Selector Dialog)</option>
              ${catSources
                .map(
                  (o) =>
                    `<option value="${o.id}" ${primaryPref === o.id ? "selected" : ""}>${o.name}</option>`,
                )
                .join("")}
            </select>
          </div>

          <div class="src-perm-field">
            <label for="perm-secondary">2. ${E(catObj.name)} Secondary Default Source</label>
            <select id="perm-secondary" class="src-perm-dropdown">
              <option value="none" ${secondaryPref === "none" ? "selected" : ""}>None (Ask if primary is unavailable)</option>
              ${catSources
                .map(
                  (o) =>
                    `<option value="${o.id}" ${secondaryPref === o.id ? "selected" : ""}>${o.name}</option>`,
                )
                .join("")}
            </select>
          </div>
        </div>

        <label class="src-perm-check">
          <input type="checkbox" id="perm-remember" ${autoPref ? "checked" : ""} />
          <span>Save these preferences and automatically pick default sources for future adds</span>
        </label>
      </div>
    </div>
  `;

  // Attach card selection handlers
  $("mb").querySelectorAll(".src-card-choice").forEach((card) => {
    card.onclick = () => {
      $("mb")
        .querySelectorAll(".src-card-choice")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const r = card.querySelector("input[type=radio]");
      if (r) r.checked = true;
    };
  });

  const primSel = $("perm-primary");
  if (primSel) {
    primSel.onchange = () => {
      const v = primSel.value;
      if (v !== "ask" && sourcesList.some((s) => s.id === v)) {
        $("mb").querySelectorAll(".src-card-choice").forEach((c) => {
          if (c.dataset.src === v) c.click();
        });
      }
    };
  }

  const allCatsBtn = $("src-open-all-cats");
  if (allCatsBtn) {
    allCatsBtn.onclick = () => {
      openSourcePreferencesModal(catId);
    };
  }

  mf(`
    <button class="btn" id="src-btn-cancel">Cancel</button>
    <button class="btn p" id="src-btn-add">Add to Cart</button>
  `);

  $("src-btn-cancel").onclick = () => md(0);

  $("src-btn-add").onclick = () => {
    const selectedRadio = $("mb").querySelector("input[name=selected_src]:checked");
    const chosenSrcId = selectedRadio ? selectedRadio.value : sourcesList[0].id;
    const chosen = sourcesList.find((s) => s.id === chosenSrcId) || sourcesList[0];

    const prim = $("perm-primary").value;
    const sec = $("perm-secondary").value;
    const rem = $("perm-remember").checked;

    saveSourcePrefs(catId, prim, sec);
    localStorage.setItem("cv_auto_source", rem ? "1" : "0");

    applyChosenSource(h, chosen);

    cart.set(h.k, h);
    sv();
    upd();
    draw();
    md(0);
    toast(`Added ${h.title} from ${chosen.name}!`);
    if (typeof onComplete === "function") onComplete(chosen);
  };
}

function openSourcePreferencesModal(initialCatId) {
  md(1);
  const mx = $("md").querySelector(".mx");
  if (mx) mx.classList.add("sources-mode");
  $("mh").textContent = "Download Source Preferences by Category";

  let activeCat = initialCatId && SOURCE_CATEGORIES.some((c) => c.id === initialCatId) ? initialCatId : "mods";
  const autoPref = safeStorage.getItem("cv_auto_source") !== "0";

  const draft = {};
  SOURCE_CATEGORIES.forEach((c) => {
    draft[c.id] = { ...getSourcePrefs(c.id) };
  });

  function renderCategoryPanel() {
    const cat = SOURCE_CATEGORIES.find((c) => c.id === activeCat) || SOURCE_CATEGORIES[0];
    const catSources = getCategorySources(cat.id);
    const currPref = draft[cat.id] || { primary: "modrinth", secondary: "curseforge" };

    const cardsHtml = SOURCE_CATEGORIES.map((c) => {
      const p = draft[c.id] || { primary: "modrinth", secondary: "curseforge" };
      const friendlyPrim = getFriendlySourceName(p.primary);
      return `
        <button type="button" class="src-cat-card ${c.id === activeCat ? "active" : ""}" data-cat="${c.id}" title="${E(c.name)}: Primary source is ${friendlyPrim}">
          <span class="src-card-ico">${c.emoji}</span>
          <span class="src-card-name">${E(c.name)}</span>
          <span class="src-card-badge">${friendlyPrim}</span>
        </button>
      `;
    }).join("");

    $("mb").innerHTML = `
      <div class="src-dialog-wrap">
        <div class="src-dialog-sub" style="font-size:12.5px;line-height:1.45;margin-bottom:10px;">
          Select any resource category below to customize its preferred primary source and secondary fallback mirror:
        </div>

        <div class="src-cat-grid" id="srcCatNav">
          ${cardsHtml}
        </div>

        <div class="src-perm-container" style="margin-top:0;">
          <div class="src-cat-panel-head">
            <div class="src-cat-panel-title">
              <span>${cat.emoji}</span>
              <span>${E(cat.name)} Download Sources</span>
            </div>
            <button type="button" class="src-cat-manage-link" id="src-copy-to-all" title="Apply these sources to all other categories">Apply to all categories</button>
          </div>

          <div class="src-perm-grid">
            <div class="src-perm-field">
              <label for="cat-perm-primary">1. ${E(cat.name)} Primary Default Source</label>
              <select id="cat-perm-primary" class="src-perm-dropdown">
                <option value="ask" ${currPref.primary === "ask" ? "selected" : ""}>Always Ask (Show Source Selector Dialog)</option>
                ${catSources
                  .map(
                    (o) =>
                      `<option value="${o.id}" ${currPref.primary === o.id ? "selected" : ""}>${o.name}</option>`,
                  )
                  .join("")}
              </select>
            </div>

            <div class="src-perm-field">
              <label for="cat-perm-secondary">2. ${E(cat.name)} Secondary Default Source</label>
              <select id="cat-perm-secondary" class="src-perm-dropdown">
                <option value="none" ${currPref.secondary === "none" ? "selected" : ""}>None (Ask if primary is unavailable)</option>
                ${catSources
                  .map(
                    (o) =>
                      `<option value="${o.id}" ${currPref.secondary === o.id ? "selected" : ""}>${o.name}</option>`,
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <div class="src-flow-steps" style="margin: 6px 0 0;">
            <div class="src-flow-step">
              <span class="src-flow-num">1</span>
              <span><b>Primary:</b> Downloads from this source first if available for ${E(cat.name.toLowerCase())}.</span>
            </div>
            <div class="src-flow-step">
              <span class="src-flow-num">2</span>
              <span><b>Secondary:</b> Automatic backup mirror if primary doesn't host the item.</span>
            </div>
            <div class="src-flow-step">
              <span class="src-flow-num">3</span>
              <span><b>Safety Prompt:</b> Asks you to choose if neither source hosts the item.</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 10px;">
          <label class="src-perm-check">
            <input type="checkbox" id="global-perm-auto" ${autoPref ? "checked" : ""} />
            <span>Enable automatic cascading downloads (uncheck to always confirm before adding)</span>
          </label>
        </div>
      </div>
    `;

    // Category cards click handlers
    $("srcCatNav").querySelectorAll(".src-cat-card, .src-cat-pill").forEach((card) => {
      card.onclick = () => {
        if ($("cat-perm-primary") && $("cat-perm-secondary")) {
          draft[activeCat] = {
            primary: $("cat-perm-primary").value,
            secondary: $("cat-perm-secondary").value
          };
        }
        activeCat = card.dataset.cat;
        renderCategoryPanel();
      };
    });

    const copyBtn = $("src-copy-to-all");
    if (copyBtn) {
      copyBtn.onclick = () => {
        const p = $("cat-perm-primary").value;
        const s = $("cat-perm-secondary").value;
        SOURCE_CATEGORIES.forEach((c) => {
          draft[c.id] = { primary: p, secondary: s };
        });
        toast(`Applied ${getFriendlySourceName(p)} / ${getFriendlySourceName(s)} across all categories!`);
      };
    }
  }

  renderCategoryPanel();

  mf(`
    <button class="btn" id="src-pref-reset" title="Reset all categories to recommended platform defaults">Reset Defaults</button>
    <div style="flex:1;"></div>
    <button class="btn" id="src-pref-cancel">Cancel</button>
    <button class="btn p" id="src-pref-save">Save All Preferences</button>
  `);

  $("src-pref-cancel").onclick = () => md(0);

  $("src-pref-reset").onclick = () => {
    SOURCE_CATEGORIES.forEach((c) => {
      const def = DEFAULT_CATEGORY_SOURCES[c.id] || { primary: "modrinth", secondary: "curseforge" };
      draft[c.id] = { ...def };
    });
    renderCategoryPanel();
    toast("Reset all categories to recommended defaults!");
  };

  $("src-pref-save").onclick = () => {
    if ($("cat-perm-primary") && $("cat-perm-secondary")) {
      draft[activeCat] = {
        primary: $("cat-perm-primary").value,
        secondary: $("cat-perm-secondary").value
      };
    }

    const auto = $("global-perm-auto").checked;
    localStorage.setItem("cv_source_prefs", JSON.stringify(draft));
    localStorage.setItem("cv_auto_source", auto ? "1" : "0");

    if (draft["mods"]) {
      localStorage.setItem("cv_primary_source", draft["mods"].primary);
      localStorage.setItem("cv_secondary_source", draft["mods"].secondary);
    }

    md(0);
    toast("Download source preferences saved for all categories!");
  };
}


// --- CraftIndex Semantic Resource Catalog Grid Renderer ---
function renderCatalogGrid(itemsList, container) {
  const target = container || $("g");
  if (!target) return;

  if (!itemsList || itemsList.length === 0) {
    target.innerHTML = `<div class="em craftindex-empty-catalog">${E(C.tEmpty)}</div>`;
    return;
  }

  target.innerHTML = itemsList
    .map((h, i) => {
      const isSelected = cart.has(h.k) || (h.sources && h.sources.some((src) => cart.has(src.rawKey || (src.rawItem && src.rawItem.k))));
      const catLabel = getCatLabel(h.tab);
      const authorText = C.author && h.author ? `<span class="by craftindex-card-author">by ${E(h.author)}</span>` : "";

      return `
      <article class="cd craftindex-card ${isSelected ? "sel is-selected" : ""}" data-index="${i}" data-key="${E(h.k)}">
        ${ico(h)}
        <div class="craftindex-card-content">
          <div class="card-top-row craftindex-card-badges">
            <span class="card-cat-badge cat-${E(h.tab)}">${E(catLabel)}</span>
            ${h.subType ? `<span class="card-cat-badge launcher-type ${E(h.subType)}">${h.subType === "premium" ? "PREMIUM" : "CRACKED"}</span>` : ""}
            ${h.isDependency ? `<span class="card-cat-badge cat-dependencies">DEPENDENCY</span>` : ""}
          </div>
          <h3 class="craftindex-card-title">
            <a href="${E(h.websiteUrl)}" target="_blank" rel="noopener noreferrer">${E(h.title)}</a>
            ${authorText}
          </h3>
          <div class="ds craftindex-card-desc">${E(h.desc)}</div>
          <div class="mt craftindex-card-meta">
            ${C.stats && h.dl != null ? `<span title="Downloads">⬇ ${fmt(h.dl)}</span>` : ""}
            ${C.stats && h.fo != null ? `<span title="Followers">♥ ${fmt(h.fo)}</span>` : ""}
            ${h.ver ? `<span class="craftindex-version">v${E(h.ver)}</span>` : ""}
            ${(h.tags || []).map((c) => `<span class="tg craftindex-tag">${E(c)}</span>`).join("")}
          </div>
        </div>
        <div class="act craftindex-card-actions">
          ${
            rpCardHref(h)
              ? `<a class="btn-info craftindex-btn-info" href="${E(rpCardHref(h))}" data-info="${i}" title="Open the full resource page for ${E(h.title)}" aria-label="Open full resource page for ${E(h.title)}">ℹ</a>`
              : `<button class="btn-info craftindex-btn-info" data-info="${i}" title="View documentation, screenshots, and single downloads" aria-label="View details for ${E(h.title)}">ℹ</button>`
          }
          ${
            h.sources && h.sources.length > 1
              ? `<div class="source-badge multi-source">
                   <span class="source-multi-tag">${h.sources.length} Sources:</span>
                   <div class="source-pill-row">
                     ${h.sources
                       .map(
                         (s) =>
                           `<a href="${E(s.url || h.websiteUrl)}" target="_blank" rel="noopener noreferrer" class="source-link ${E(s.id)}" title="${E(s.name)} - Click to visit" onclick="event.stopPropagation()"><span class="source-dot"></span><span>${E(s.name)}</span><span class="ext-icon">↗</span></a>`,
                       )
                       .join("")}
                   </div>
                 </div>`
              : `<div class="source-badge">Source: <a href="${E(h.websiteUrl)}" target="_blank" rel="noopener noreferrer" class="source-link ${E(h.source)}"><span class="source-dot"></span><span>${E(h.sourceName)}</span> <span class="ext-icon">↗</span></a></div>`
          }
          <div class="act-right craftindex-actions-right">
            <button class="btn ad craftindex-btn-add ${isSelected ? "" : "p"}" data-i="${i}" aria-label="${isSelected ? 'Remove from Cart' : 'Add to Cart'}">${isSelected ? E(C.tAdded) : E(C.tAdd)}</button>
          </div>
        </div>
      </article>`;
    })
    .join("");

  target.querySelectorAll(".ad").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        const h = hits[b.dataset.i];
        const isAdded = cart.has(h.k) || (h.sources && h.sources.some((src) => cart.has(src.rawKey || (src.rawItem && src.rawItem.k))));
        if (isAdded) {
          cart.delete(h.k);
          if (h.sources) {
            h.sources.forEach((src) => {
              if (src.rawKey) cart.delete(src.rawKey);
              if (src.rawItem && src.rawItem.k) cart.delete(src.rawItem.k);
            });
          }
          sv();
          upd();
          draw();
          return;
        }

        if (C.max && cart.size >= C.max)
          return toast("Limit: " + C.max + " items");

        if (h.sources && h.sources.length > 1) {
          const catId = h.tab || "mods";
          const { primary: prim, secondary: sec } = getSourcePrefs(catId);
          const auto = safeStorage.getItem("cv_auto_source") !== "0";

          if (auto && prim !== "ask") {
            const primMatch = h.sources.find((s) => s.id === prim);
            if (primMatch) {
              applyChosenSource(h, primMatch);
              cart.set(h.k, h);
              sv();
              upd();
              draw();
              toast(`Added ${h.title} from ${primMatch.name}!`);
              return;
            }

            if (sec !== "none") {
              const secMatch = h.sources.find((s) => s.id === sec);
              if (secMatch) {
                applyChosenSource(h, secMatch);
                cart.set(h.k, h);
                sv();
                upd();
                draw();
                toast(`Added ${h.title} from ${secMatch.name} (Secondary fallback)!`);
                return;
              }
            }

            openSourceSelectorModal(h);
            return;
          }

          openSourceSelectorModal(h);
        } else {
          cart.set(h.k, h);
          sv();
          upd();
          draw();
        }
      }),
  );

  target.querySelectorAll(".btn-info").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        const hit = hits[b.dataset.info];
        if (!hit) return;
        const href = rpCardHref(hit);
        if (href) {
          // Real navigation to the permanent resource page. The hit object is
          // stashed so the route reuses it instead of re-resolving.
          e.preventDefault();
          _pendingResourceHits.set(href, hit);
          window.history.pushState({}, "", href);
          handleRouteFromUrl(false);
        } else {
          openResourceDash(hit);
        }
      }),
  );

  target.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => openItem(hits[b.dataset.dl])));

  const isStaticTab = tab.id === "modloaders" || tab.id === "serversoftwares" || tab.id === "launchers" || tab.id === "home";
  const hasMore = !isStaticTab && off < tot && tab.kind !== "github";
  const mo = $("mo");
  const loader = $("auto-loader");
  const moWrap = $("mo-wrap");

  if (isStaticTab) {
    if (moWrap) moWrap.style.display = "none";
    if (mo) {
      mo.style.display = "none";
      mo.classList.add("hidden");
    }
    if (loader) loader.style.display = "none";
  } else {
    if (moWrap) moWrap.style.display = "";
    if (!hasMore) {
      if (mo) {
        mo.style.display = "none";
        mo.classList.add("hidden");
      }
      if (loader) loader.style.display = "none";
    } else {
      if (autoLoadFailed || isLowNetwork()) {
        if (loader) loader.style.display = "none";
        if (mo) {
          mo.style.display = "";
          mo.classList.remove("hidden");
          mo.classList.add("retry-btn");
          mo.innerHTML = autoLoadFailed
            ? "⚠️ Slow Connection — Click to Load More"
            : C.tMore || "Load more";
        }
      } else {
        if (mo) {
          mo.style.display = "none";
          mo.classList.add("hidden");
          mo.classList.remove("retry-btn");
        }
        if (loader) loader.style.display = "none";
      }
    }
    setupInfiniteScroll();
  }

  setTimeout(() => {
    $("g").dataset.anim = "";
  }, 1100);
}

// Render a skeleton card grid mirroring the real card geometry so the
// container reserves its final height before async results arrive.
// This prevents CLS: skeleton cells use the same .cd grid tracks and
// stretch to the same row height as the cards they stand in for.
function renderGridSkeleton(target) {
  const el = target || $("g");
  if (!el) return;
  const n = C && C.per && C.per > 0 ? Math.min(C.per, 24) : 12;
  let html = "";
  for (let i = 0; i < n; i++) {
    html += `
      <article class="cd craftindex-card skel-card" aria-hidden="true">
        <div class="craftindex-card-icon skel skel-ic"></div>
        <div class="craftindex-card-content">
          <div class="card-top-row craftindex-card-badges"><span class="skel skel-badge"></span></div>
          <div class="skel skel-title"></div>
          <div class="skel skel-line"></div>
          <div class="skel skel-line short"></div>
          <div class="skel skel-line"></div>
          <div class="card-top-row craftindex-card-badges skel-actions"><span class="skel skel-btn"></span><span class="skel skel-btn"></span></div>
        </div>
      </article>`;
  }
  el.innerHTML = html;
}

function draw() {
  return renderCatalogGrid(hits, $("g"));
}

window.renderCatalogGrid = renderCatalogGrid;
window.draw = draw;
window.draw = draw;
function upd() {
  const n = cart.size;
  $("cc").textContent = n;
  $("fabs").classList.toggle("h", !n);

  if (!n) {
    $("dl").innerHTML = `<div class="dr-empty">
         <div class="dr-empty-icon">🛒</div>
         <div class="dr-empty-title">Your cart is empty</div>
         <div class="dr-empty-sub">Explore mods, plugins, shaders, and packs to build your collection.</div>
       </div>`;
    return;
  }

  // Auto-detect if user manually added an item that is an explicit dependency of another item in cart
  const allItems = [...cart.values()];
  allItems.forEach((it) => {
    if (!it.isDependency) {
      for (const parent of allItems) {
        if (parent !== it && (parent.tab === "mods" || parent.tab === "plugins")) {
          const titleLower = (it.title || "").toLowerCase();
          if (
            titleLower.includes("fabric api") ||
            titleLower.includes("cloth config") ||
            titleLower.includes("architectury") ||
            titleLower.includes("indium") ||
            titleLower.includes("protocollib") ||
            titleLower.includes("vault") ||
            titleLower.includes("placeholderapi")
          ) {
            it.isDependency = true;
            it.depParent = parent.title;
            break;
          }
        }
      }
    }
  });

  // Partition into category groups
  const depsItems = [];
  const catItemsMap = new Map();

  allItems.forEach((p) => {
    if (p.isDependency) {
      depsItems.push(p);
    } else {
      const cId = p.tab || "mods";
      if (!catItemsMap.has(cId)) catItemsMap.set(cId, []);
      catItemsMap.get(cId).push(p);
    }
  });

  // Ordering logic:
  // 1 is for the selected resource and 2nd is for the dependencies (if any Mod or Plugin is Selected)
  // The Dependencies category will appear at the bottom if no Mod or Plugin is selected.
  const hasModsOrPlugins = catItemsMap.has("mods") || catItemsMap.has("plugins");
  const orderedSections = [];

  if (hasModsOrPlugins) {
    // 1st: The primary category with mods or plugins
    const primaryCat = catItemsMap.has("mods") ? "mods" : "plugins";
    orderedSections.push({
      id: primaryCat,
      name: T(primaryCat).name || getCatLabel(primaryCat),
      items: catItemsMap.get(primaryCat),
    });
    catItemsMap.delete(primaryCat);

    // 2nd: The Dependencies category
    if (depsItems.length > 0) {
      orderedSections.push({
        id: "dependencies",
        name: "Dependencies",
        items: depsItems,
      });
    }

    // Followed by any remaining categories
    for (const [cId, items] of catItemsMap.entries()) {
      orderedSections.push({
        id: cId,
        name: T(cId).name || getCatLabel(cId),
        items,
      });
    }
  } else {
    // No mods or plugins: all categories first, Dependencies at bottom
    for (const [cId, items] of catItemsMap.entries()) {
      orderedSections.push({
        id: cId,
        name: T(cId).name || getCatLabel(cId),
        items,
      });
    }
    if (depsItems.length > 0) {
      orderedSections.push({
        id: "dependencies",
        name: "Dependencies",
        items: depsItems,
      });
    }
  }

  // Render categorized sections inside Cart Drawer
  $("dl").innerHTML = orderedSections
    .map(
      (sec) => `
        <div class="cart-cat-section" data-cat="${E(sec.id)}">
          <div class="cart-cat-header">
            <span class="cart-cat-badge ${E(sec.id)}">${E(sec.name.toUpperCase())}</span>
            <span class="cart-cat-count">${sec.items.length} ${sec.items.length === 1 ? "item" : "items"}</span>
          </div>
          <div class="cart-cat-items">
            ${sec.items
              .map(
                (p) => `
                <div class="rw" data-k="${E(p.k)}">
                  ${ico(p)}
                  <div class="t" style="cursor:pointer" title="View details">
                    <b>${E(p.title)}</b>
                    <div class="rw-sub">
                      <span class="rw-cat-pill ${p.isDependency ? "dependencies" : p.tab}">
                        ${p.isDependency ? "Dependency" : (T(p.tab).name || p.tab)}
                      </span>
                      <span class="source-link ${p.source} rw-source-badge"><span class="source-dot"></span><span>${E(p.sourceName || p.source)}</span></span>
                      ${p.sources && p.sources.length > 1 ? `<button class="btn-change-source" data-change-k="${E(p.k)}" title="Switch download source">Switch Source</button>` : ""}
                      ${p.depParent ? `<span class="rw-parent">Required by: ${E(p.depParent)}</span>` : ""}
                    </div>
                  </div>
                  <button class="x" data-k="${E(p.k)}" title="Remove item">✕</button>
                </div>
              `,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");

  $("dl")
    .querySelectorAll(".rw .t, .rw .ic")
    .forEach((el) => {
      el.onclick = () => {
        const k = el.closest(".rw")?.dataset?.k;
        const it = cart.get(k);
        if (it) openResourceDash(it);
      };
    });

  $("dl")
    .querySelectorAll(".btn-change-source")
    .forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const k = btn.dataset.changeK;
        const it = cart.get(k);
        if (it) {
          openSourceSelectorModal(it, () => {
            upd();
            draw();
          });
        }
      };
    });

  $("dl")
    .querySelectorAll(".x")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const it = cart.get(b.dataset.k);
          cart.delete(b.dataset.k);
          sv();
          upd();
          draw();
          toast("Removed. Click here to undo");
          $("tt").onclick = () => {
            cart.set(it.k, it);
            sv();
            upd();
            draw();
            $("tt").style.display = "none";
            $("tt").onclick = null;
          };
        }),
    );
}

// --- CraftIndex Collection Drawer Controller ---
const CraftIndexDrawer = {
  toggle(isOpen) {
    document
      .querySelectorAll(".glass-select-menu.open")
      .forEach((m) => m.classList.remove("open"));
    document
      .querySelectorAll(".glass-select-trigger.active")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".glass-select-wrap.open")
      .forEach((w) => w.classList.remove("open"));

    const drawerEl = $("dr");
    const scrimEl = $("sc");
    if (drawerEl) {
      drawerEl.classList.toggle("o", Boolean(isOpen));
      drawerEl.classList.toggle("is-open", Boolean(isOpen));
      drawerEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (isOpen) CraftIndexScrollLock.acquire("drawer");
      else CraftIndexScrollLock.release("drawer");
    }
    if (scrimEl) {
      scrimEl.classList.toggle("o", Boolean(isOpen));
      scrimEl.classList.toggle("is-open", Boolean(isOpen));
    }
    updateBrowserTitle();

    if (!isOpen && activeToolbarModal === "collection") {
      activeToolbarModal = null;
      returnToLastUrlAndReload();
    }
  },

  open() {
    this.toggle(true);
  },

  close() {
    this.toggle(false);
  }
};

const dr = (o) => CraftIndexDrawer.toggle(o);
window.CraftIndexDrawer = CraftIndexDrawer;
window.dr = dr;

function openCartWithDepCheck() {
  recordCurrentBrowseUrl();
  activeToolbarModal = "collection";
  if (!cart.size) {
    dr(1);
    return;
  }

  const cartItems = [...cart.values()];
  const modsInCart = cartItems.filter(
    (it) => it.tab === "mods" && !it.isDependency,
  );
  const pluginsInCart = cartItems.filter(
    (it) => it.tab === "plugins" && !it.isDependency,
  );
  const datapacksInCart = cartItems.filter(
    (it) => it.tab === "datapacks" && !it.isDependency,
  );
  const existingDeps = cartItems.filter((it) => it.isDependency);

  const hasEligible =
    modsInCart.length > 0 ||
    pluginsInCart.length > 0 ||
    datapacksInCart.length > 0 ||
    existingDeps.length > 0;

  const modal = $("depModal");
  if (!hasEligible || !modal) {
    dr(1);
    return;
  }

  const hasFabricApi = cartItems.some(
    (ci) =>
      ci.id === "fabric-api" ||
      ci.id === "P7dR8mSH" ||
      ci.k === "mr:P7dR8mSH" ||
      ci.id == 306612 ||
      (ci.slug && ci.slug.toLowerCase() === "fabric-api") ||
      (ci.title && ci.title.toLowerCase().includes("fabric api"))
  );

  let checksHtml = "";
  if (modsInCart.length > 0) {
    checksHtml += `
      <label class="dep-checkbox-item">
        <input type="checkbox" id="depChkMods" checked />
        <span class="dep-cb-label">Include Dependencies for <b>Mods</b></span>
        <span class="dep-cb-count">${modsInCart.length} in cart</span>
      </label>
    `;
  }
  if (pluginsInCart.length > 0) {
    checksHtml += `
      <label class="dep-checkbox-item">
        <input type="checkbox" id="depChkPlugins" checked />
        <span class="dep-cb-label">Include Dependencies for <b>Plugins</b></span>
        <span class="dep-cb-count">${pluginsInCart.length} in cart</span>
      </label>
    `;
  }
  if (datapacksInCart.length > 0) {
    checksHtml += `
      <label class="dep-checkbox-item">
        <input type="checkbox" id="depChkDatapacks" checked />
        <span class="dep-cb-label">Include Dependencies for <b>Data Packs</b></span>
        <span class="dep-cb-count">${datapacksInCart.length} in cart</span>
      </label>
    `;
  }

  $("depBody").innerHTML = `
    <div class="dep-intro-text">
      Check the resource categories you want CraftIndex to auto-detect and include required dependencies for:
    </div>
    ${checksHtml}

    <div class="dep-info-callout">
      <span class="dep-callout-icon">🧩</span>
      <div class="dep-callout-text">
        <b>Fabric API:</b> ${hasFabricApi ? '<span class="dep-callout-success">✓ Already in cart</span>' : '<span class="dep-callout-highlight">Will be automatically included</span> as the core dependency of all Fabric mods.'}
      </div>
    </div>

    ${existingDeps.length > 0 ? `
      <div class="dep-count-summary">
        <span>⚡</span> Currently <b>${existingDeps.length}</b> ${existingDeps.length === 1 ? 'dependency is' : 'dependencies are'} active in your cart.
      </div>
    ` : ''}
  `;

  CraftIndexScrollLock.acquire("dep");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

async function resolveCartDependencies(options) {
  const items = [...cart.values()];
  const toCheck = items.filter((it) => {
    if (it.isDependency) return false;
    if (it.tab === "mods" && options.mods) return true;
    if (it.tab === "plugins" && options.plugins) return true;
    if (it.tab === "datapacks" && options.datapacks) return true;
    return false;
  });

  const newDeps = [];

  // Helper to check if project is already in cart or in newDeps
  const isAlreadyInCart = (id, slug, title) => {
    const normTitle = (title || "").toLowerCase().trim();
    const normSlug = (slug || "").toLowerCase().trim();
    return items.concat(newDeps).some((ci) => {
      if (ci.id && (ci.id === id || ci.id === slug)) return true;
      if (ci.k && (ci.k === "mr:" + id || ci.k === "cf:" + id || ci.k === "mr:" + slug)) return true;
      if (normSlug && ci.slug && ci.slug.toLowerCase() === normSlug) return true;
      if (normTitle && ci.title && ci.title.toLowerCase().trim() === normTitle) return true;
      return false;
    });
  };

  // 1. GUARANTEED CORE FABRIC API AUTO-INCLUSION FOR MODS:
  // "make sure that Fabric API will be auto added in dependencies, cuz its the dependencies of all Fabric Mods"
  if (options.mods) {
    const hasModsInCart = items.some((it) => it.tab === "mods");
    if (hasModsInCart) {
      const hasFabricApi = isAlreadyInCart("P7dR8mSH", "fabric-api", "Fabric API");
      if (!hasFabricApi) {
        newDeps.push({
          k: "mr:P7dR8mSH",
          id: "P7dR8mSH",
          tab: "mods",
          source: "modrinth",
          sourceName: "Modrinth",
          websiteUrl: "https://modrinth.com/mod/fabric-api",
          title: "Fabric API",
          icon: "https://cdn.modrinth.com/data/P7dR8mSH/icon.png",
          author: "modmuss50",
          desc: "Essential core hooks and inter-compatibility library for all Fabric and Quilt mods. Mandatory base dependency for Minecraft Fabric modding.",
          isDependency: true,
          depParent: "All Fabric Mods",
          slug: "fabric-api",
          dl: 155000000,
          fo: 1250000,
          pt: "mod",
          cf: 0,
        });
      }
    }
  }

  // 2. RESOLVE MANIFEST DEPENDENCIES FROM PLATFORMS (MODRINTH & CURSEFORGE)
  for (const it of toCheck) {
    try {
      // MODRINTH DEPENDENCIES
      if (it.source === "modrinth" || (it.id && typeof it.id === "string" && !it.cf && it.source !== "curseforge")) {
        const projId = it.slug || it.id;
        try {
          const vers = await api("/project/" + encodeURIComponent(projId) + "/version");
          if (Array.isArray(vers) && vers.length > 0) {
            const filtered = cfg.mc
              ? vers.filter((x) => x.game_versions && x.game_versions.includes(cfg.mc))
              : [];
            const v = (filtered.length ? (typeof best === "function" ? best(filtered) : filtered[0]) : null) || vers[0];

            if (v && Array.isArray(v.dependencies) && v.dependencies.length > 0) {
              for (const dep of v.dependencies) {
                // Dependency must be required
                if (dep.dependency_type === "required") {
                  let targetProjId = dep.project_id;
                  if (!targetProjId && dep.version_id) {
                    try {
                      const vObj = await api("/version/" + encodeURIComponent(dep.version_id));
                      if (vObj && vObj.project_id) targetProjId = vObj.project_id;
                    } catch (e) {}
                  }

                  if (targetProjId) {
                    const existingInCart = items.find(
                      (ci) => ci.id === targetProjId || ci.k === "mr:" + targetProjId || ci.slug === targetProjId
                    );
                    if (existingInCart) {
                      existingInCart.isDependency = true;
                      if (!existingInCart.depParent) existingInCart.depParent = it.title;
                    } else if (!isAlreadyInCart(targetProjId)) {
                      try {
                        const p = await api("/project/" + encodeURIComponent(targetProjId));
                        if (p && p.id) {
                          newDeps.push({
                            k: "mr:" + p.id,
                            id: p.id,
                            tab: it.tab,
                            source: "modrinth",
                            sourceName: "Modrinth",
                            websiteUrl: `https://modrinth.com/${p.project_type || it.tab}/${p.slug || p.id}`,
                            title: p.title,
                            icon: p.icon_url,
                            author: "",
                            desc: p.description,
                            isDependency: true,
                            depParent: it.title,
                            slug: p.slug,
                            dl: p.downloads,
                            fo: p.follows,
                            pt: p.project_type || "mod",
                            cf: 0,
                          });
                        }
                      } catch (e) {
                        console.warn("Could not fetch Modrinth dep project:", targetProjId, e);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("Could not fetch Modrinth versions for:", projId, e);
        }
      }
      // CURSEFORGE DEPENDENCIES
      else if (it.cf || it.source === "curseforge") {
        try {
          const modData = await cfa("/v1/mods/" + it.id);
          const files = (modData && modData.data && modData.data.latestFilesIndexes) || [];
          const fileId = files[0] ? files[0].fileId : null;
          if (fileId) {
            const fileInfo = await cfa(`/v1/mods/${it.id}/files/${fileId}`);
            const deps = (fileInfo && fileInfo.data && fileInfo.data.dependencies) || [];
            for (const d of deps) {
              if (d.relationType === 3) {
                // 3 = RequiredDependency
                const existingInCart = items.find(
                  (ci) => ci.id == d.modId || ci.k === "cf:" + d.modId
                );
                if (existingInCart) {
                  existingInCart.isDependency = true;
                  if (!existingInCart.depParent) existingInCart.depParent = it.title;
                } else if (!isAlreadyInCart(d.modId)) {
                  try {
                    const depMod = await cfa("/v1/mods/" + d.modId);
                    if (depMod && depMod.data) {
                      const dm = depMod.data;
                      newDeps.push({
                        k: "cf:" + dm.id,
                        id: dm.id,
                        tab: it.tab,
                        source: "curseforge",
                        sourceName: "CurseForge",
                        websiteUrl: dm.links ? dm.links.websiteUrl : `https://www.curseforge.com/minecraft/mc-mods/${dm.slug || dm.id}`,
                        title: dm.name,
                        icon: dm.logo ? dm.logo.thumbnailUrl || dm.logo.url : null,
                        author: dm.authors && dm.authors[0] ? dm.authors[0].name : "",
                        desc: dm.summary,
                        isDependency: true,
                        depParent: it.title,
                        cf: 1,
                        dl: dm.downloadCount,
                        pt: "mod",
                      });
                    }
                  } catch (e) {
                    console.warn("Could not fetch CurseForge dep mod:", d.modId, e);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("Could not fetch CurseForge deps for:", it.id, e);
        }
      }
    } catch (e) {
      console.warn("Could not check deps for", it.title, e);
    }
  }

  // 3. ADD NEW DEPENDENCIES TO CART
  for (const nd of newDeps) {
    cart.set(nd.k, nd);
  }

  return newDeps;
}

if ($("depSkipBtn")) {
  $("depSkipBtn").onclick = () => {
    const modal = $("depModal");
    if (modal) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      CraftIndexScrollLock.release("dep");
    }
    dr(1);
  };
}
if ($("depCloseBtn")) {
  $("depCloseBtn").onclick =
  $("depBackdrop").onclick =
    () => {
      const modal = $("depModal");
      if (modal) {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        CraftIndexScrollLock.release("dep");
      }
      if (activeToolbarModal === "collection") {
        activeToolbarModal = null;
        returnToLastUrlAndReload();
      }
    };
}

if ($("depConfirmBtn")) {
  $("depConfirmBtn").onclick = async () => {
    const chkMods = $("depChkMods") ? $("depChkMods").checked : false;
    const chkPlugins = $("depChkPlugins") ? $("depChkPlugins").checked : false;
    const chkDp = $("depChkDatapacks") ? $("depChkDatapacks").checked : false;

    const bodyEl = $("depBody");
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="text-align:center; padding: 22px 0;">
          <div class="cyber-spinner" style="width: 28px; height: 28px; margin: 0 auto 12px; border-width: 3px;"></div>
          <div style="font-weight:600; font-size:15px; color:var(--colors-text-primary, #fff);">Resolving Required Dependencies...</div>
          <div style="font-size:12px; color:var(--colors-text-secondary, rgba(232,224,245,0.7)); margin-top:6px;">Auto-including Fabric API and analyzing mod manifests</div>
        </div>
      `;
    }
    $("depConfirmBtn").disabled = true;
    $("depSkipBtn").disabled = true;

    let addedDeps = [];
    try {
      addedDeps = await resolveCartDependencies({
        mods: chkMods,
        plugins: chkPlugins,
        datapacks: chkDp,
      });
    } catch (err) {
      console.error("Dependency resolution error:", err);
    }

    const modal = $("depModal");
    if (modal) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      CraftIndexScrollLock.release("dep");
    }
    $("depConfirmBtn").disabled = false;
    $("depSkipBtn").disabled = false;

    sv();
    upd();
    draw();
    dr(1);

    if (addedDeps && addedDeps.length > 0) {
      const hasFabric = addedDeps.some(d => d.id === "P7dR8mSH" || d.slug === "fabric-api" || (d.title && d.title.includes("Fabric API")));
      toast(`Added ${addedDeps.length} required ${addedDeps.length === 1 ? "dependency" : "dependencies"} ${hasFabric ? "(including Fabric API)" : ""}! ⚡`);
    } else {
      toast("Dependencies verified — all required files are in your cart! ✓");
    }
  };
}
window.upd = upd;

function clr() {
  if (cart.size && confirm("Clear all " + cart.size + " items?")) {
    cart.clear();
        sv();
    upd();
    draw();
    dr(0);
  }
}
$("cb").onclick = $("fr").onclick = () => openCartWithDepCheck();
$("dx").onclick = $("sc").onclick = () => dr(0);
$("dc").onclick = $("fc").onclick = clr;
$("am").onclick = () => {
  activeToolbarModal = null;
  dr(0);
  scrollTo(0, 0);
  $("q").focus();
};
$("dd").onclick = $("fd").onclick = () => {
  activeToolbarModal = null;
  dr(0);
  const studioTab = T("studio");
  if (studioTab && studioTab.id) {
    switchTab(studioTab);
  } else {
    cart.size && setup();
  }
};
let db;
$("q").oninput = () => {
  clearTimeout(db);
  db = setTimeout(() => {
    go(1);
    updateBrowserTitle();
  }, C.deb);
};
["src-filter", "fl", "fv", "so"].forEach((i) => {
  if ($(i)) {
    $(i).onchange = () => {
      updateBrowserUrl(false);
      updateBrowserTitle();
      go(1);
    };
  }
});
$("mo").onclick = () => {
  autoLoadFailed = false;
  $("mo").style.display = "none";
  $("mo").classList.add("hidden");
  $("mo").classList.remove("retry-btn");
  if ($("auto-loader")) $("auto-loader").style.display = "";
  triggerLoadMore();
};
$("rf").onclick = () => go(1, 1);
const CF = () => {
    if (C.cfProxy) return C.cfProxy.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
      return window.location.origin + "/api/curseforge";
    }
    return "https://api.curseforge.com";
  },
  cfa = async (p, signal) => {
    const base = CF();
    let r;
    try {
      r = await fetch(base + p, {
        headers: C.cfKey ? { "x-api-key": C.cfKey } : {},
        ...(signal ? { signal } : {}),
      });
    } catch (err) {
      if (base !== "https://api.curseforge.com") {
        r = await fetch("https://api.curseforge.com" + p, {
          headers: C.cfKey ? { "x-api-key": C.cfKey } : {},
          ...(signal ? { signal } : {}),
        });
      } else {
        throw err;
      }
    }
    if (!r.ok) throw Error("HTTP " + r.status);
    return r.json();
  },
  CT = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const H = () => {
    try {
      const savedHist = safeStorage.getItem("cv_hist") || "[]";
      return JSON.parse(savedHist);
    } catch (e) {
      return [];
    }
  },
  HS = (h) => {
    try {
      localStorage.setItem("cv_hist", JSON.stringify(h));
    } catch (e) {}
  };
function hist(g, nm, n, items) {
  HS([{ t: Date.now(), g, nm, n, mc: cfg.mc, items }, ...H()].slice(0, 200));
}
function showHist() {
  recordCurrentBrowseUrl();
  activeToolbarModal = "history";
  md(1);
  updateBrowserTitle();
  $("mh").textContent = "Download history";
  const h = H(),
    gs = [...new Set(h.map((x) => x.g))];
  $("mb").innerHTML = gs.length
    ? gs
        .map(
          (g) =>
            `<div><div style="display:flex;align-items:center;margin-bottom:6px"><b style="color:var(--w);flex:1">${E(g)}</b><button class="btn d" data-g="${E(g)}">Clear</button></div>${h
              .filter((x) => x.g === g)
              .map(
                (x) =>
                  `<div class="rw"><div class="t"><b>${E(x.nm)}</b><span>${new Date(x.t).toLocaleString()} · MC ${E(x.mc)} · ${x.n} files</span><span>${E((x.items || []).join(", "))}</span></div></div>`,
              )
              .join("")}</div>`,
        )
        .join("")
    : '<div class="em">No downloads yet.</div>';
  $("mb")
    .querySelectorAll("[data-g]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          HS(H().filter((x) => x.g !== b.dataset.g));
          showHist();
        }),
    );
  mf(
    '<button class="btn d" id="ha">Clear all history</button><button class="btn p" id="hc">Close</button>',
  );
  $("ha").onclick = () => {
    HS([]);
    showHist();
  };
  $("hc").onclick = () => md(0);
}
$("hb").onclick = showHist;

function openSettingsModal() {
  recordCurrentBrowseUrl();
  activeToolbarModal = "settings";
  md(1);
  updateBrowserTitle();
  const mx = $("md").querySelector(".mx");
  if (mx) mx.classList.add("settings-mode");

  const origAmbientVideo = safeStorage.getItem("cv_ambient_video");
  const origMode = safeStorage.getItem("cv_mode");

  $("mh").innerHTML = `
    <div class="settings-modal-header">
      <div class="smh-left">
        <span class="smh-icon">⚙️</span>
        <span class="smh-title">CraftIndex Settings</span>
        <span class="smh-badge">v2.6.0</span>
      </div>
    </div>
  `;

  let activeTab = "appearance";

  const draft = {
    per: Number(C.per || 24),
    deb: Number(C.deb || 350),
    sort: C.sort || "relevance",
    stats: C.stats !== false,
    author: C.author !== false,
    snaps: !!C.snaps,
    deps: C.deps !== false,
    sep: C.sep !== false,
    readme: C.readme !== false,
    zipName: C.zipName || "CraftIndex.inlooker.top-Collection.zip",
    defMc: C.defMc || "",
    defMl: C.defMl || "fabric",
    ambientVideo: safeStorage.getItem("cv_ambient_video") !== "0",
    autoSource: safeStorage.getItem("cv_auto_source") !== "0"
  };

  function renderSettingsBody() {
    let curMode = safeStorage.getItem("cv_mode") || C.mode || "dark";

    const navHtml = `
      <div class="settings-nav">
        <button type="button" class="settings-nav-btn ${activeTab === "appearance" ? "active" : ""}" data-stab="appearance">🎨 Appearance</button>
        <button type="button" class="settings-nav-btn ${activeTab === "search" ? "active" : ""}" data-stab="search">⚡ Search & Discovery</button>
        <button type="button" class="settings-nav-btn ${activeTab === "downloads" ? "active" : ""}" data-stab="downloads">📦 Downloads & ZIP</button>
        <button type="button" class="settings-nav-btn ${activeTab === "sources" ? "active" : ""}" data-stab="sources">🌐 Source Mirrors</button>
        <button type="button" class="settings-nav-btn ${activeTab === "data" ? "active" : ""}" data-stab="data">💾 Data & Cache</button>
      </div>
    `;

    let contentHtml = "";

    if (activeTab === "appearance") {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-title"><span>🎨</span> Theme & Visual Style</div>
          <div class="settings-theme-grid">
            <div class="settings-theme-card ${curMode !== "light" ? "active" : ""}" id="set-theme-dark">
              <div class="stc-icon">🌙</div>
              <div class="stc-info">
                <div class="stc-title">Night Mode (Dark)</div>
                <div class="stc-sub">Cyber-Glass cosmic purple backdrop</div>
              </div>
            </div>
            <div class="settings-theme-card ${curMode === "light" ? "active" : ""}" id="set-theme-light">
              <div class="stc-icon">☀️</div>
              <div class="stc-info">
                <div class="stc-title">Daylight Mode (Light)</div>
                <div class="stc-sub">High-contrast clean amethyst theme</div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title"><span>✨</span> Visual Elements & Performance</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Live Ambient Background Video</div>
              <div class="settings-desc">Cinematic looping Minecraft visuals. Turn off for minimal GPU/battery usage.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-ambient-video" ${draft.ambientVideo ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Download & Popularity Statistics</div>
              <div class="settings-desc">Display download counts, follower badges, and metrics on resource cards.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-stats" ${draft.stats ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Creator Attribution</div>
              <div class="settings-desc">Display project author and creator details on resource tiles.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-author" ${draft.author ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
        </div>
      `;
    } else if (activeTab === "search") {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-title"><span>🔍</span> Query & Pagination Options</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Results Per Page</div>
              <div class="settings-desc">Maximum number of items loaded per scroll batch.</div>
            </div>
            <select class="settings-select" id="set-per" style="width:150px">
              <option value="12" ${draft.per === 12 ? "selected" : ""}>12 items</option>
              <option value="24" ${draft.per === 24 ? "selected" : ""}>24 items (Default)</option>
              <option value="36" ${draft.per === 36 ? "selected" : ""}>36 items</option>
              <option value="48" ${draft.per === 48 ? "selected" : ""}>48 items</option>
              <option value="60" ${draft.per === 60 ? "selected" : ""}>60 items</option>
            </select>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Search Input Debounce Latency</div>
              <div class="settings-desc">Delay after typing before sending search queries to Modrinth/CurseForge.</div>
            </div>
            <select class="settings-select" id="set-deb" style="width:185px">
              <option value="180" ${draft.deb === 180 ? "selected" : ""}>180ms - Ultra Fast</option>
              <option value="350" ${draft.deb === 350 ? "selected" : ""}>350ms - Balanced</option>
              <option value="500" ${draft.deb === 500 ? "selected" : ""}>500ms - Relaxed (Low API)</option>
            </select>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Default Sorting Algorithm</div>
              <div class="settings-desc">Default ordering for search results when browsing categories.</div>
            </div>
            <select class="settings-select" id="set-sort" style="width:165px">
              <option value="relevance" ${draft.sort === "relevance" ? "selected" : ""}>Relevance</option>
              <option value="downloads" ${draft.sort === "downloads" ? "selected" : ""}>Most Downloads</option>
              <option value="follows" ${draft.sort === "follows" ? "selected" : ""}>Most Followed</option>
              <option value="newest" ${draft.sort === "newest" ? "selected" : ""}>Newest</option>
              <option value="updated" ${draft.sort === "updated" ? "selected" : ""}>Recently Updated</option>
            </select>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Include Snapshot & Alpha Versions</div>
              <div class="settings-desc">Allow filtering for Minecraft pre-releases, snapshots, and experimental versions.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-snaps" ${draft.snaps ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
        </div>
      `;
    } else if (activeTab === "downloads") {
      const relVersions = GV.filter(v => v.version_type === "release").map(v => v.version);
      const vList = relVersions.length ? relVersions : [
        "1.21.4", "1.21.3", "1.21.1", "1.21",
        "1.20.6", "1.20.4", "1.20.2", "1.20.1",
        "1.19.4", "1.19.2", "1.18.2", "1.16.5", "1.12.2"
      ];
      const vOptions = vList.map(v => `<option value="${v}" ${draft.defMc === v ? "selected" : ""}>${v}</option>`).join("");

      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-title"><span>📦</span> Default Compatibility</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Default Target Minecraft Version</div>
              <div class="settings-desc">Automatically pre-selects this version for all batch downloads.</div>
            </div>
            <select class="settings-select" id="set-defmc" style="width:185px">
              <option value="">Latest Release (Auto)</option>
              ${vOptions}
            </select>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Default Mod Loader</div>
              <div class="settings-desc">Pre-selected loader when downloading mods and modpacks.</div>
            </div>
            <select class="settings-select" id="set-defml" style="width:150px">
              ${ML.map(l => `<option value="${l}" ${draft.defMl === l ? "selected" : ""}>${l[0].toUpperCase() + l.slice(1)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title"><span>🗂️</span> Archive & Packaging Settings</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Automatic Dependency Resolution</div>
              <div class="settings-desc">Automatically inspect and bundle required libraries (e.g., Fabric API).</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-deps" ${draft.deps ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Organize ZIP by Subfolders</div>
              <div class="settings-desc">Place mods in /mods, resource packs in /resourcepacks, shaders in /shaderpacks.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-sep" ${draft.sep ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Include CraftIndex Readme & Manifest</div>
              <div class="settings-desc">Add a formatted README.txt and manifest list inside the downloaded ZIP.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-readme" ${draft.readme ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Default Archive Filename</div>
              <div class="settings-desc">Name of the generated ZIP file downloaded from your cart.</div>
            </div>
            <input type="text" class="in" id="set-zipname" value="${E(draft.zipName)}" style="width:230px;" />
          </div>
        </div>
      `;
    } else if (activeTab === "sources") {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-title"><span>🌐</span> Multi-Source Routing & Fallback</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Automatic Cascading Downloads</div>
              <div class="settings-desc">Automatically download from the Primary source, falling back to the Secondary mirror without popping up a source dialog.</div>
            </div>
            <label class="settings-switch">
              <input type="checkbox" id="set-auto-source" ${draft.autoSource ? "checked" : ""}>
              <span class="settings-slider"></span>
            </label>
          </div>
          <div style="padding-top: 10px;">
            <div class="settings-helper-text">
              CraftIndex supports distinct Primary & Secondary download sources per category (Mods, Plugins, Resource Packs, Shaders, Modpacks, Worlds, Server Software, etc.).
            </div>
            <button type="button" class="btn p" id="set-open-sources-btn" style="width:100%;justify-content:center;padding:11px 16px;font-size:13.5px;">
              Open Category Download Sources Matrix
            </button>
          </div>
        </div>
      `;
    } else if (activeTab === "data") {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-title"><span>💾</span> Local Cart & History Storage</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Cart Items (${cart.size} in Cart)</div>
              <div class="settings-desc">Remove all current items and reset your cart session.</div>
            </div>
            <button type="button" class="btn d" id="set-btn-clr-cart" ${cart.size === 0 ? "disabled" : ""}>Clear Cart</button>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Download History (${H().length} entries)</div>
              <div class="settings-desc">Clear your local download history and search logs.</div>
            </div>
            <button type="button" class="btn d" id="set-btn-clr-hist" ${H().length === 0 ? "disabled" : ""}>Clear History</button>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title"><span>⚙️</span> Backup & Restore Preferences</div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Export Preferences</div>
              <div class="settings-desc">Download your customized CraftIndex configuration as a JSON file.</div>
            </div>
            <button type="button" class="btn" id="set-btn-export-cfg">📥 Export JSON</button>
          </div>
          <div class="settings-row">
            <div class="settings-label-wrap">
              <div class="settings-label">Import Preferences</div>
              <div class="settings-desc">Load and apply previously exported CraftIndex configuration JSON.</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="file" id="set-file-import" accept=".json" style="display:none;" />
              <button type="button" class="btn" id="set-btn-import-cfg">📤 Import JSON</button>
            </div>
          </div>
          <div class="settings-row" style="margin-top:4px;">
            <div class="settings-label-wrap">
              <div class="settings-label" style="color:#ef4444;">Reset All Settings</div>
              <div class="settings-desc">Restore all settings, sources, and filters to CraftIndex defaults.</div>
            </div>
            <button type="button" class="btn d" id="set-btn-reset-all">⚠️ Reset to Defaults</button>
          </div>
        </div>
      `;
    }

    $("mb").innerHTML = `
      <div class="settings-panel">
        ${navHtml}
        <div id="settingsContentArea">
          ${contentHtml}
        </div>
      </div>
    `;

    bindSettingsEvents();
  }

  function syncDraftFromUi() {
    if ($("set-ambient-video")) draft.ambientVideo = $("set-ambient-video").checked;
    if ($("set-stats")) draft.stats = $("set-stats").checked;
    if ($("set-author")) draft.author = $("set-author").checked;
    if ($("set-per")) draft.per = Number($("set-per").value);
    if ($("set-deb")) draft.deb = Number($("set-deb").value);
    if ($("set-sort")) draft.sort = $("set-sort").value;
    if ($("set-snaps")) draft.snaps = $("set-snaps").checked;
    if ($("set-defmc")) draft.defMc = $("set-defmc").value;
    if ($("set-defml")) draft.defMl = $("set-defml").value;
    if ($("set-deps")) draft.deps = $("set-deps").checked;
    if ($("set-sep")) draft.sep = $("set-sep").checked;
    if ($("set-readme")) draft.readme = $("set-readme").checked;
    if ($("set-zipname")) draft.zipName = $("set-zipname").value.trim() || "CraftIndex.inlooker.top-Collection.zip";
    if ($("set-auto-source")) draft.autoSource = $("set-auto-source").checked;
  }

  function bindSettingsEvents() {
    $("mb").querySelectorAll(".settings-nav-btn").forEach((btn) => {
      btn.onclick = () => {
        syncDraftFromUi();
        activeTab = btn.dataset.stab;
        renderSettingsBody();
      };
    });

    if ($("set-theme-dark")) {
      $("set-theme-dark").onclick = () => {
        applyAppMode("dark");
        renderSettingsBody();
      };
    }
    if ($("set-theme-light")) {
      $("set-theme-light").onclick = () => {
        applyAppMode("light");
        renderSettingsBody();
      };
    }

    if ($("set-ambient-video")) {
      $("set-ambient-video").onchange = () => {
        draft.ambientVideo = $("set-ambient-video").checked;
      };
    }

    if ($("set-open-sources-btn")) {
      $("set-open-sources-btn").onclick = () => {
        saveAndApply(false);
        openSourcePreferencesModal();
      };
    }

    if ($("set-btn-clr-cart")) {
      $("set-btn-clr-cart").onclick = () => {
        if (confirm("Clear all items from your cart?")) {
          cart.clear();
          sv();
          upd();
          draw();
          toast("Cart cleared!");
          renderSettingsBody();
        }
      };
    }

    if ($("set-btn-clr-hist")) {
      $("set-btn-clr-hist").onclick = () => {
        if (confirm("Clear all download history?")) {
          HS([]);
          toast("Download history cleared!");
          renderSettingsBody();
        }
      };
    }

    if ($("set-btn-export-cfg")) {
      $("set-btn-export-cfg").onclick = () => {
        syncDraftFromUi();
        const exportObj = {
          craftindex_version: "2.6",
          exported_at: new Date().toISOString(),
          settings: { ...draft },
          sources: JSON.parse(safeStorage.getItem("cv_source_prefs") || "{}")
        };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "CraftIndex.inlooker.top-settings.json";
        a.click();
        URL.revokeObjectURL(a.href);
        toast("✓ Settings exported to CraftIndex.inlooker.top-settings.json!");
      };
    }

    if ($("set-btn-import-cfg") && $("set-file-import")) {
      $("set-btn-import-cfg").onclick = () => $("set-file-import").click();
      $("set-file-import").onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data || typeof data !== "object") throw new Error("Invalid format");
            const hasValidSchema = data.craftindex_version || data.settings || Object.keys(data).some(k => k.endsWith("_version"));
            if (!hasValidSchema) {
              throw new Error("Unrecognized configuration schema");
            }
            if (data.settings) {
              Object.assign(draft, data.settings);
            }
            if (data.sources) {
              localStorage.setItem("cv_source_prefs", JSON.stringify(data.sources));
            }
            toast("✓ Settings imported successfully!");
            renderSettingsBody();
          } catch (err) {
            toast("Failed to parse settings JSON: " + err.message);
          }
        };
        reader.readAsText(file);
      };
    }

    if ($("set-btn-reset-all")) {
      $("set-btn-reset-all").onclick = () => {
        if (confirm("Reset all settings to default values?")) {
          localStorage.removeItem("cv_settings"); localStorage.removeItem("ci_settings");
          localStorage.removeItem("cv_ambient_video"); localStorage.removeItem("ci_ambient_video");
          localStorage.removeItem("cv_auto_source"); localStorage.removeItem("ci_auto_source");
          localStorage.removeItem("cv_source_prefs"); localStorage.removeItem("ci_source_prefs");
          draft.per = 24;
          draft.deb = 350;
          draft.sort = "relevance";
          draft.stats = true;
          draft.author = true;
          draft.snaps = false;
          draft.deps = true;
          draft.sep = true;
          draft.readme = true;
          draft.zipName = "CraftIndex.inlooker.top-Collection.zip";
          draft.defMc = "";
          draft.defMl = "fabric";
          draft.ambientVideo = true;
          draft.autoSource = true;
          Object.assign(C, {
            per: 24,
            deb: 350,
            sort: "relevance",
            stats: true,
            author: true,
            snaps: false,
            deps: true,
            sep: true,
            readme: true,
            zipName: "CraftIndex.inlooker.top-Collection.zip",
            defMc: "",
            defMl: "fabric"
          });
          applyAppMode("dark");
          toast("Settings reset to defaults!");
          renderSettingsBody();
        }
      };
    }
  }

  function saveAndApply(closeModal = true) {
    syncDraftFromUi();
    const customSettings = {
      per: draft.per,
      deb: draft.deb,
      sort: draft.sort,
      stats: draft.stats,
      author: draft.author,
      snaps: draft.snaps,
      deps: draft.deps,
      sep: draft.sep,
      readme: draft.readme,
      zipName: draft.zipName,
      defMc: draft.defMc,
      defMl: draft.defMl
    };
    Object.assign(C, customSettings);
    try {
      localStorage.setItem("cv_settings", JSON.stringify(customSettings));
      localStorage.setItem("cv_ambient_video", draft.ambientVideo ? "1" : "0");
      localStorage.setItem("cv_auto_source", draft.autoSource ? "1" : "0");
    } catch (e) {}

    if ($("so") && C.sort) $("so").value = C.sort;
    applyAppMode();

    if (closeModal) {
      md(0);
      toast("✓ Settings saved and applied successfully!");
    }

    try {
      go(1);
    } catch (e) {}
  }

  renderSettingsBody();

  mf(`
    <div class="settings-action-bar" style="width:100%;justify-content:flex-end;">
      <button class="btn" id="set-cancel-btn">Cancel</button>
      <button class="btn p" id="set-save-btn">Save & Apply</button>
    </div>
  `);

  $("set-cancel-btn").onclick = () => {
    if (safeStorage.getItem("cv_mode") !== origMode) {
      if (origMode === null) localStorage.removeItem("cv_mode");
      else localStorage.setItem("cv_mode", origMode);
      applyAppMode();
    }
    md(0);
  };
  $("set-save-btn").onclick = () => saveAndApply(true);
}
if ($("setb")) $("setb").onclick = openSettingsModal;
function openPage(i) {
  const p = C.pages[i];
  md(1);
  $("mh").textContent = (p.emoji || "") + " " + p.name;
  $("mb").innerHTML =
    '<div class="pgc">' +
    SAN(p.mode === "md" ? MD(p.content) : p.content) +
    "</div>";
  mf('<button class="btn p" id="pc">Close</button>');
  $("pc").onclick = () => md(0);
}
$("pgb").innerHTML = (C.pages || [])
  .map(
    (p, i) =>
      `<button class="btn" data-pg="${i}">${E(p.emoji || "")} ${E(p.name)}</button>`,
  )
  .join(" ");
$("pgb")
  .querySelectorAll("[data-pg]")
  .forEach((b) => (b.onclick = () => openPage(+b.dataset.pg)));
addEventListener("message", (e) => {
  const d = e.data;
  if (!d || d.t !== "hl" || window.parent === window) return;
  document.querySelectorAll(".hl").forEach((x) => x.classList.remove("hl"));
  if (!d.sel) return;
  try {
    const l = [...document.querySelectorAll(d.sel)].slice(0, 8);
    l.forEach((x) => x.classList.add("hl"));
    if (l[0]) l[0].scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (x) {}
});
let lastFocusedBeforeAbout = null;

function openAboutModal(targetCatId = "overview", skipUrlUpdate = false) {
  if (targetCatId && DOC_ANCHOR_ALIASES[targetCatId]) {
    targetCatId = DOC_ANCHOR_ALIASES[targetCatId];
  }
  recordCurrentBrowseUrl();
  activeToolbarModal = "docs";
  const modal = $("aboutModal");
  if (!modal) return;
  lastFocusedBeforeAbout = document.activeElement;
  // Ensure the heavy Docs module is loaded before rendering its sidebar/content,
  // so the modal never opens blank on a cold page load.
  ensureAboutDocs().finally(() => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    CraftIndexScrollLock.acquire("about");
    renderAboutSidebar(targetCatId);
    showAboutCategory(targetCatId);
    updateBrowserTitle();
    const closeBtn = $("aboutCloseBtn");
    if (closeBtn) closeBtn.focus();
    if (!skipUrlUpdate) {
      const targetUrl = targetCatId && targetCatId !== "overview" ? `/docs/#${targetCatId}` : "/docs/";
      if (window.location.pathname !== "/docs" && window.location.pathname !== "/docs/") {
        try {
          window.history.pushState({ modal: "docs", docId: targetCatId }, "", targetUrl);
        } catch (_) {}
      }
    }
  });
}

function closeAboutModal(skipUrlUpdate = false) {
  const isSkip = skipUrlUpdate === true;
  const modal = $("aboutModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  CraftIndexScrollLock.release("about");
  updateBrowserTitle();
  const sidebar = $("aboutSidebar");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (lastFocusedBeforeAbout && typeof lastFocusedBeforeAbout.focus === "function") {
    lastFocusedBeforeAbout.focus();
  }
  if (activeToolbarModal === "docs" && !isSkip) {
    activeToolbarModal = null;
    returnToLastUrlAndReload();
    return;
  }
  if (!isSkip) {
    updateBrowserUrl(false);
  }
}

function renderAboutSidebar(activeId) {
  const listEl = $("aboutSidebarList");
  if (!listEl || typeof ABOUT_DOCS === "undefined") return;
  listEl.innerHTML = ABOUT_DOCS.map((doc) => {
    const isActive = doc.id === activeId;
    return `
      <button class="about-nav-item ${isActive ? "active" : ""}" data-id="${doc.id}" role="tab" aria-selected="${isActive ? "true" : "false"}">
        <span>${doc.icon}</span>
        <span>${E(doc.title)}</span>
      </button>
    `;
  }).join("");

  listEl.querySelectorAll(".about-nav-item").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      listEl.querySelectorAll(".about-nav-item").forEach((b) => {
        const isCurrent = b === btn;
        b.classList.toggle("active", isCurrent);
        b.setAttribute("aria-selected", isCurrent ? "true" : "false");
      });
      showAboutCategory(id);
      try {
        window.history.replaceState({ modal: "docs", docId: id }, "", id === "overview" ? "/docs/" : `/docs/#${id}`);
      } catch (_) {}
      const sidebar = $("aboutSidebar");
      if (sidebar && sidebar.classList.contains("mobile-open")) {
        sidebar.classList.remove("mobile-open");
      }
    };
  });
}

const DOC_ANCHOR_ALIASES = {};

function showAboutCategory(id) {
  const contentEl = $("aboutContent");
  if (!contentEl || typeof ABOUT_DOCS === "undefined") return;
  if (id && DOC_ANCHOR_ALIASES[id]) {
    id = DOC_ANCHOR_ALIASES[id];
  }
  const doc = ABOUT_DOCS.find((d) => d.id === id) || ABOUT_DOCS[0];
  if (doc) {
    contentEl.innerHTML = doc.html;
    contentEl.scrollTop = 0;
  }
}

if ($("ab")) $("ab").onclick = () => openAboutModal("overview");
if ($("aboutCloseBtn")) $("aboutCloseBtn").onclick = () => closeAboutModal(false);
if ($("aboutBackdrop")) $("aboutBackdrop").onclick = () => closeAboutModal(false);
if ($("aboutMobileNavToggle")) {
  $("aboutMobileNavToggle").onclick = () => {
    const sidebar = $("aboutSidebar");
    if (sidebar) sidebar.classList.toggle("mobile-open");
  };
}

/* ========================================================
   CRAFTINDEX SOCIALS & DIRECT CHANNELS (ARATA INLOOKER)
   ======================================================== */
const SOCIAL_CONFIG = {
  creator: "Arata Inlooker",
  portfolioUrl: "https://inlooker.top",
  email: "aratainlooker@gmail.com",
  emailComposeUrl: "https://mail.google.com/mail/?view=cm&fs=1&to=aratainlooker%40gmail.com",
  discord: {
    username: "arata_inlooker",
    destinationUrl: "https://discord.com/app",
    badge: "Accepted DMs"
  },
  x: {
    handle: "@arata_inlooker",
    url: "https://x.com/arata_inlooker"
  },
  instagram: {
    handle: "@arata_inlooker",
    url: "https://instagram.com/arata_inlooker"
  }
};

let lastFocusedBeforeSocials = null;

function copyDiscordUsername(btn) {
  const username = SOCIAL_CONFIG.discord.username;
  const originalHtml = btn ? btn.innerHTML : "Copy Discord ↗";
  
  const performCopy = () => {
    if (btn) {
      btn.innerHTML = "✓ Copied!";
      btn.classList.add("btn-success");
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove("btn-success");
      }, 2400);
    }
    if (typeof showToast === "function") {
      showToast("Discord username copied: " + username);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(username).then(performCopy).catch(() => {
      fallbackCopyText(username, performCopy);
    });
  } else {
    fallbackCopyText(username, performCopy);
  }
}

function fallbackCopyText(text, callback) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (callback) callback();
  } catch (e) {
    console.error("Clipboard copy failed:", e);
  }
}

function renderSocialsContent() {
  const bodyEl = $("socialsBody");
  if (!bodyEl) return;
  bodyEl.innerHTML = `
    <div class="creator-card socials-creator-card">
      <div class="creator-top-row">
        <div class="creator-avatar" aria-hidden="true">AI</div>
        <div class="creator-info">
          <h3 class="creator-name" style="margin:0; font-size:17px; font-weight:600;">Arata Inlooker</h3>
          <span class="creator-role" style="font-size:12.5px;">Creator &amp; Maintainer &bull; CraftIndex</span>
        </div>
        <a href="${SOCIAL_CONFIG.portfolioUrl}" target="_blank" rel="noopener noreferrer" class="creator-portfolio-btn" title="Open Arata Inlooker's Portfolio in a new tab">
          Visit Portfolio ↗
        </a>
      </div>
      <p class="creator-bio" style="margin:12px 0 0; font-size:13px; line-height:1.55;">
        Independent developer building performant Minecraft tooling and systems architecture. Direct messages, questions, and sponsorship inquiries are accepted across the official accounts below.
      </p>
      <div class="socials-dm-status">
        <span class="status-dot"></span> <strong>Direct Messages (DMs) Accepted</strong>
      </div>
    </div>

    <!-- 4 Official Social Cards (Zero GitHub, Zero LinkedIn) -->
    <div class="socials-cards-grid">
      <!-- 1. Discord -->
      <div class="social-card discord-card">
        <div class="social-card-top">
          <div class="social-icon-box discord">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h4 class="social-platform-title" style="margin:0; font-size:15px; font-weight:600;">Discord</h4>
              <span class="social-pill-badge dm-badge">${SOCIAL_CONFIG.discord.badge}</span>
            </div>
            <div class="social-username" id="discordUserText" style="font-size:13px; font-weight:600; font-family:monospace;">${SOCIAL_CONFIG.discord.username}</div>
          </div>
        </div>
        <p class="social-card-desc" style="margin:0; font-size:12.5px; line-height:1.5;">Send direct messages for inquiries, sponsorship, or feedback on CraftIndex.</p>
        <div class="social-card-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn p copy-discord-btn" onclick="copyDiscordUsername(this)" aria-label="Copy Discord username arata_inlooker">
            Copy Discord ↗
          </button>
          <a href="${SOCIAL_CONFIG.discord.destinationUrl}" target="_blank" rel="noopener noreferrer" class="btn" aria-label="Go to Discord web app">
            Go to Discord ↗
          </a>
        </div>
      </div>

      <!-- 2. X (Twitter) -->
      <div class="social-card x-card">
        <div class="social-card-top">
          <div class="social-icon-box x">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h4 class="social-platform-title" style="margin:0; font-size:15px; font-weight:600;">X (Twitter)</h4>
              <span class="social-pill-badge">Official</span>
            </div>
            <div class="social-username" style="font-size:13px; font-weight:600;">${SOCIAL_CONFIG.x.handle}</div>
          </div>
        </div>
        <p class="social-card-desc" style="margin:0; font-size:12.5px; line-height:1.5;">Follow project updates, engineering announcements, and Minecraft tooling releases.</p>
        <div class="social-card-actions">
          <a href="${SOCIAL_CONFIG.x.url}" target="_blank" rel="noopener noreferrer" class="btn p" aria-label="Visit X profile @arata_inlooker">
            Visit X ↗
          </a>
        </div>
      </div>

      <!-- 3. Instagram -->
      <div class="social-card insta-card">
        <div class="social-card-top">
          <div class="social-icon-box instagram">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h4 class="social-platform-title" style="margin:0; font-size:15px; font-weight:600;">Instagram</h4>
              <span class="social-pill-badge">Official</span>
            </div>
            <div class="social-username" style="font-size:13px; font-weight:600;">${SOCIAL_CONFIG.instagram.handle}</div>
          </div>
        </div>
        <p class="social-card-desc" style="margin:0; font-size:12.5px; line-height:1.5;">Visual development snapshots, UI/UX design experiments, and creator updates.</p>
        <div class="social-card-actions">
          <a href="${SOCIAL_CONFIG.instagram.url}" target="_blank" rel="noopener noreferrer" class="btn p" aria-label="Visit Instagram profile @arata_inlooker">
            Visit Instagram ↗
          </a>
        </div>
      </div>

      <!-- 4. Email -->
      <div class="social-card email-card">
        <div class="social-card-top">
          <div class="social-icon-box email">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h4 class="social-platform-title" style="margin:0; font-size:15px; font-weight:600;">Email</h4>
              <span class="social-pill-badge">Direct</span>
            </div>
            <div class="social-username" style="font-size:13px; font-weight:600;">${SOCIAL_CONFIG.email}</div>
          </div>
        </div>
        <p class="social-card-desc" style="margin:0; font-size:12.5px; line-height:1.5;">For formal partnerships, bug bounties, technical inquiries, or platform discussions.</p>
        <div class="social-card-actions">
          <a href="${SOCIAL_CONFIG.emailComposeUrl}" target="_blank" rel="noopener noreferrer" class="btn p" aria-label="Send email to aratainlooker@gmail.com via Gmail">
            Send an Email ↗
          </a>
        </div>
      </div>
    </div>
  `;
}

function openSocialsModal(skipUrlUpdate = false) {
  if (typeof md === "function") md(0);
  if (typeof closeAboutModal === "function") closeAboutModal(true);
  const modal = $("socialsModal");
  if (!modal) return;
  lastFocusedBeforeSocials = document.activeElement;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  CraftIndexScrollLock.acquire("socials");
  renderSocialsContent();
  const closeBtn = $("socialsCloseBtn");
  if (closeBtn) closeBtn.focus();
  if (!skipUrlUpdate) {
    if (window.location.pathname !== "/socials" && window.location.pathname !== "/socials/") {
      try {
        window.history.pushState({ modal: "socials" }, "", "/socials/");
      } catch (_) {}
    }
  }
}

function closeSocialsModal(skipUrlUpdate = false) {
  const modal = $("socialsModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  CraftIndexScrollLock.release("socials");
  updateBrowserTitle();
  if (lastFocusedBeforeSocials && typeof lastFocusedBeforeSocials.focus === "function") {
    lastFocusedBeforeSocials.focus();
  }
  if (!skipUrlUpdate) {
    if (window.location.pathname === "/socials" || window.location.pathname === "/socials/") {
      updateBrowserUrl(false);
    }
  }
}

if ($("socialsCloseBtn")) $("socialsCloseBtn").onclick = () => closeSocialsModal();
if ($("socialsBackdrop")) $("socialsBackdrop").onclick = () => closeSocialsModal();

window.openSocialsModal = openSocialsModal;
window.closeSocialsModal = closeSocialsModal;
window.copyDiscordUsername = copyDiscordUsername;
window.SOCIAL_CONFIG = SOCIAL_CONFIG;

if ($("spb")) $("spb").onclick = openSourcePreferencesModal;
$("pb").style.display = "";
$("pb").onclick = () => {
  recordCurrentBrowseUrl();
  activeToolbarModal = "presets";
  md(1);
  updateBrowserTitle();
  $("mh").textContent = "Presets";
  $("mb").innerHTML = `
    <div class="presets-coming-soon">
      <div class="pcs-icon-wrap">
        <span class="pcs-icon">🚀</span>
      </div>
      <div class="pcs-badge">Under Construction</div>
      <div class="pcs-title">Coming Soon!</div>
      <div class="pcs-desc">
        Curated one-click modpack bundles, performance stacks, and server presets are on the way. Stay tuned for upcoming releases!
      </div>
    </div>
  `;
  mf('<button class="btn p" id="pcl">Close</button>');
  $("pcl").onclick = () => md(0);
};
/* ========================================================
   CART EXPORT, IMPORT & UNIVERSAL SHARING ENGINE
   ======================================================== */
function exportCartJson() {
  if (!cart.size) {
    return toast("Cart is empty — add items first!");
  }
  try {
    const items = [...cart.values()].map((it) => {
      const clone = { ...it };
      if (clone.sources && Array.isArray(clone.sources)) {
        clone.sources = clone.sources.map((s) => {
          const sCopy = { ...s };
          delete sCopy.rawItem;
          return sCopy;
        });
      }
      delete clone.rawItem;
      return clone;
    });
    const jsonStr = JSON.stringify(items, safeCartJsonReplacer, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const zipInput = $("drZipName");
    const rawName = zipInput && zipInput.value ? zipInput.value.trim() : "";
    const cleanName = rawName ? rawName.replace(/\.zip$/i, "") : "craftindex-cart";
    a.download = `${cleanName}.json`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);
    toast(`Exported ${items.length} items to ${a.download}! ⤓`);
  } catch (err) {
    console.error("Export error:", err);
    toast("Failed to export cart: " + err.message);
  }
}

function triggerImportCart() {
  const fileInput = $("cif");
  if (!fileInput) return;
  fileInput.value = "";
  fileInput.click();
}

async function handleImportCartFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      return toast("Invalid JSON file!");
    }

    const items = Array.isArray(data)
      ? data
      : (data.items && Array.isArray(data.items) ? data.items : (data.cart && Array.isArray(data.cart) ? data.cart : null));

    if (!items || !items.length) {
      return toast("No cart items found in file!");
    }

    let addedCount = 0;
    items.forEach((p) => {
      if (p && (p.k || p.id)) {
        const itemKey = p.k || (p.tab ? `${p.tab}:${p.id}` : String(p.id));
        const itemTab = p.tab || (p.isDependency ? "dependencies" : "mods");
        const importedItem = {
          ...p,
          k: itemKey,
          id: p.id || itemKey,
          tab: itemTab,
          title: p.title || p.name || "Imported Item",
          source: p.source || "official",
          sourceName: p.sourceName || (p.source ? p.source.toUpperCase() : "Official"),
          author: p.author || "",
          desc: p.desc || p.description || "",
        };
        cart.set(itemKey, importedItem);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      sv();
      upd();
      draw();
      dr(1);
      toast(`Successfully imported ${addedCount} items into cart! ⤒`);
    } else {
      toast("No compatible items found to import.");
    }
  } catch (err) {
    console.error("Import error:", err);
    toast("Error importing cart: " + err.message);
  } finally {
    e.target.value = "";
  }
}

async function exportCartMrpack() {
  if (!cart.size) {
    return toast("Cart is empty — add items first!");
  }
  if (typeof JSZip === "undefined") {
    return toast("JSZip is not available!");
  }

  const zipInput = $("drZipName");
  const rawName = zipInput && zipInput.value ? zipInput.value.trim() : "";
  const cleanName = rawName ? rawName.replace(/\.(zip|mrpack|json)$/i, "") : "craftindex-modpack";

  toast("Preparing Modrinth modpack (.mrpack)... 📦");

  try {
    const items = [...cart.values()];
    const mrpackFiles = [];
    const usedPaths = new Set();

    const itemsExport = items.map((it) => {
      const clone = { ...it };
      if (clone.sources && Array.isArray(clone.sources)) {
        clone.sources = clone.sources.map((s) => {
          const sCopy = { ...s };
          delete sCopy.rawItem;
          return sCopy;
        });
      }
      delete clone.rawItem;
      return clone;
    });

    const targetMc = cfg.mc || (GV.find((v) => v.version_type === "release")?.version) || "1.21.1";
    const modLoader = (cfg.ml || "fabric").toLowerCase();

    let loaderKey = "fabric-loader";
    let loaderVer = ">=0.15.0";
    if (modLoader === "forge") {
      loaderKey = "forge";
      loaderVer = ">=47.0.0";
    } else if (modLoader === "neoforge") {
      loaderKey = "neoforge";
      loaderVer = ">=21.0.0";
    } else if (modLoader === "quilt") {
      loaderKey = "quilt-loader";
      loaderVer = ">=0.20.0";
    }

    for (const it of items) {
      let resolvedFile = null;
      let hashes = {};
      let fileSize = 0;
      let downloadUrl = "";
      let filename = "";

      // 1. Check if cached in res
      const cached = res.find((r) => r.it && (r.it.k === it.k || r.it.id === it.id) && r.f);
      if (cached && cached.f) {
        resolvedFile = cached.f;
        hashes = (cached.v?.files?.find((f) => f.url === cached.f.url)?.hashes) || cached.f.hashes || {};
        fileSize = cached.f.size || 0;
        downloadUrl = cached.f.url;
        filename = cached.f.filename;
      }

      // 2. Resolve on the fly if needed
      if (!resolvedFile) {
        try {
          if (it.source === "modrinth" || !it.source || it.source === "official") {
            const versions = await vs(it, targetMc);
            const v = best(versions) || (versions && versions[0]);
            if (v && v.files && v.files.length) {
              const primaryFile = pf(v);
              if (primaryFile) {
                resolvedFile = primaryFile;
                hashes = primaryFile.hashes || {};
                fileSize = primaryFile.size || 0;
                downloadUrl = primaryFile.url;
                filename = primaryFile.filename;
              }
            }
          } else {
            const oneRes = await one(it);
            if (oneRes && oneRes.f) {
              resolvedFile = oneRes.f;
              downloadUrl = oneRes.f.url;
              filename = oneRes.f.filename;
              hashes = (oneRes.v?.files?.find((f) => f.url === oneRes.f.url)?.hashes) || oneRes.f.hashes || {};
              fileSize = oneRes.f.size || 0;
            }
          }
        } catch (resolveErr) {
          console.warn("Could not resolve version for .mrpack item:", it.title, resolveErr);
        }
      }

      // 3. Fallbacks
      if (!filename) {
        filename = (it.title || "item").replace(/[^a-zA-Z0-9._-]/g, "_") + (it.tab === "mods" ? ".jar" : ".zip");
      }
      if (!downloadUrl && it.url) {
        downloadUrl = it.url;
      }

      let folder = "mods";
      if (it.tab === "resourcepacks") folder = "resourcepacks";
      else if (it.tab === "shaders") folder = "shaderpacks";
      else if (it.tab === "datapacks") folder = "datapacks";
      else if (it.tab === "plugins") folder = "plugins";

      let filePath = `${folder}/${filename}`;
      let k = 1;
      while (usedPaths.has(filePath)) {
        filePath = `${folder}/${filename.replace(/(\.[^.]+)?$/, `_${k++}$1`)}`;
      }
      usedPaths.add(filePath);

      const fileEntry = {
        path: filePath,
        hashes: (hashes && (hashes.sha1 || hashes.sha512)) ? hashes : {},
        env: {
          client: it.client_side === "unsupported" ? "unsupported" : (it.client_side === "optional" ? "optional" : "required"),
          server: it.server_side === "unsupported" ? "unsupported" : (it.server_side === "optional" ? "optional" : "required")
        },
        downloads: downloadUrl ? [downloadUrl] : [],
        fileSize: fileSize || 0
      };

      mrpackFiles.push(fileEntry);
    }

    const indexJson = {
      formatVersion: 1,
      game: "minecraft",
      versionId: "1.0.0",
      name: cleanName,
      summary: "CraftIndex Modpack Collection",
      files: mrpackFiles,
      dependencies: {
        "minecraft": targetMc,
        [loaderKey]: loaderVer
      }
    };

    const z = new JSZip();
    z.file("modrinth.index.json", JSON.stringify(indexJson, null, 2));
    z.file("overrides/craftindex_manifest.json", JSON.stringify(itemsExport, safeCartJsonReplacer, 2));
    z.file("overrides/README.txt", `Pack: ${cleanName}\nExported by CraftIndex (https://craftindex.inlooker.top)\nItems: ${mrpackFiles.length}\nMinecraft: ${targetMc}\nLoader: ${modLoader}\nGenerated: ${new Date().toISOString()}\n`);

    const blob = await z.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cleanName}.mrpack`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);

    toast(`Exported ${mrpackFiles.length} items to ${a.download}! 📦`);
  } catch (err) {
    console.error("mrpack export error:", err);
    toast("Failed to export .mrpack: " + err.message);
  }
}

function triggerImportMrpack() {
  const fileInput = $("cifMrpack");
  if (!fileInput) return;
  fileInput.value = "";
  fileInput.click();
}

async function handleImportMrpackFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (typeof JSZip === "undefined") {
    return toast("JSZip is not available to read .mrpack!");
  }

  toast(`Reading ${file.name}... 📦`);

  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // 1. Check if it was exported with a CraftIndex manifest
    let manifestFile = zip.file("overrides/craftindex_manifest.json") || zip.file("craftindex_manifest.json");
    if (!manifestFile) {
      // Generic discovery of valid manifests inside overrides/
      for (const relativePath in zip.files) {
        if (/^overrides\/[a-z0-9_-]+_manifest\.json$/i.test(relativePath)) {
          manifestFile = zip.files[relativePath];
          break;
        }
      }
    }
    if (manifestFile) {
      try {
        const text = await manifestFile.async("text");
        const items = JSON.parse(text);
        if (Array.isArray(items) && items.length > 0) {
          let count = 0;
          items.forEach((p) => {
            if (p && (p.k || p.id)) {
              const itemKey = p.k || (p.tab ? `${p.tab}:${p.id}` : String(p.id));
              cart.set(itemKey, {
                ...p,
                k: itemKey,
                id: p.id || itemKey,
                tab: p.tab || "mods",
                title: p.title || p.name || "Imported Item"
              });
              count++;
            }
          });
          sv();
          upd();
          draw();
          dr(1);
          return toast(`Successfully imported ${count} items from ${file.name}! 📦`);
        }
      } catch (manifestErr) {
        console.warn("Could not parse modpack manifest, falling back to standard .mrpack index", manifestErr);
      }
    }

    // 2. Standard Modrinth .mrpack parsing
    const indexFile = zip.file("modrinth.index.json");
    if (!indexFile) {
      return toast("Invalid .mrpack file: modrinth.index.json not found!");
    }

    const indexText = await indexFile.async("text");
    const indexJson = JSON.parse(indexText);
    const files = indexJson.files || [];

    if (!files.length) {
      return toast("No files found in .mrpack modpack!");
    }

    let addedCount = 0;
    const sha1List = [];

    files.forEach((f) => {
      const pathStr = f.path || "";
      const filename = pathStr.split("/").pop() || "unknown.jar";
      const cleanName = filename
        .replace(/\.(jar|zip|mrpack)$/i, "")
        .replace(/[-_]/g, " ")
        .replace(/\+.*$/, "")
        .trim();

      let detectedTab = "mods";
      if (pathStr.startsWith("resourcepacks/")) detectedTab = "resourcepacks";
      else if (pathStr.startsWith("shaderpacks/")) detectedTab = "shaders";
      else if (pathStr.startsWith("datapacks/")) detectedTab = "datapacks";
      else if (pathStr.startsWith("plugins/")) detectedTab = "plugins";

      let projectId = "";
      if (f.downloads && f.downloads.length) {
        const dl = f.downloads[0];
        const m = dl.match(/cdn\.modrinth\.com\/data\/([^/]+)/);
        if (m && m[1]) projectId = m[1];
      }

      const itemKey = projectId ? `${detectedTab}:${projectId}` : `mrpack:${filename}`;
      const item = {
        k: itemKey,
        id: projectId || itemKey,
        tab: detectedTab,
        title: cleanName || filename,
        source: "modrinth",
        sourceName: "Modrinth",
        desc: `From .mrpack: ${indexJson.name || file.name}`,
        url: (f.downloads && f.downloads[0]) || "",
        env: f.env,
        hashes: f.hashes
      };

      cart.set(itemKey, item);
      addedCount++;

      if (f.hashes && f.hashes.sha1) {
        sha1List.push(f.hashes.sha1);
      }
    });

    sv();
    upd();
    draw();
    dr(1);
    toast(`Imported ${addedCount} items from ${file.name}! 📦`);

    // 3. Asynchronously enrich items with Modrinth project metadata if possible
    if (sha1List.length > 0) {
      (async () => {
        try {
          const resMap = await fetch("https://api.modrinth.com/v2/version_files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hashes: sha1List.slice(0, 50), algorithm: "sha1" })
          }).then((r) => r.json());

          if (resMap && typeof resMap === "object") {
            const projectIds = [...new Set(Object.values(resMap).map((v) => v.project_id).filter(Boolean))];
            if (projectIds.length) {
              const projects = await api("/projects?ids=" + encodeURIComponent(JSON.stringify(projectIds)));
              if (Array.isArray(projects)) {
                projects.forEach((proj) => {
                  for (const [k, cItem] of cart.entries()) {
                    if (cItem.id === proj.id || cItem.id === proj.slug || cItem.k.includes(proj.id)) {
                      cItem.title = proj.title || cItem.title;
                      cItem.icon = proj.icon_url || cItem.icon;
                      cItem.desc = proj.description || cItem.desc;
                      cItem.author = proj.author || cItem.author;
                    }
                  }
                });
                sv();
                draw();
              }
            }
          }
        } catch (enrichErr) {
          console.warn("Optional .mrpack metadata enrichment failed:", enrichErr);
        }
      })();
    }
  } catch (err) {
    console.error("mrpack import error:", err);
    toast("Failed to import .mrpack: " + err.message);
  } finally {
    e.target.value = "";
  }
}

function setupCartPopovers() {
  const exportWrap = $("exportWrap");
  const importWrap = $("importWrap");
  const exportMenu = $("exportMenu");
  const importMenu = $("importMenu");
  const ce = $("ce");
  const ci = $("ci");

  let exportTimer = null;
  let importTimer = null;

  if (exportWrap && exportMenu) {
    exportWrap.addEventListener("mouseenter", () => {
      clearTimeout(exportTimer);
      clearTimeout(importTimer);
      if (importMenu) {
        importMenu.classList.remove("open");
        if (importWrap) importWrap.classList.remove("hover-open");
      }
      if (ci) ci.setAttribute("aria-expanded", "false");
      exportMenu.classList.add("open");
      exportWrap.classList.add("hover-open");
      if (ce) ce.setAttribute("aria-expanded", "true");
    });
    exportWrap.addEventListener("mouseleave", (e) => {
      const rel = e.relatedTarget;
      if (rel && rel.closest && rel.closest(".dr-footer")) {
        clearTimeout(exportTimer);
        exportMenu.classList.remove("open");
        exportWrap.classList.remove("hover-open");
        if (ce) ce.setAttribute("aria-expanded", "false");
        return;
      }
      exportTimer = setTimeout(() => {
        exportMenu.classList.remove("open");
        exportWrap.classList.remove("hover-open");
        if (ce) ce.setAttribute("aria-expanded", "false");
      }, 150);
    });
  }

  if (importWrap && importMenu) {
    importWrap.addEventListener("mouseenter", () => {
      clearTimeout(importTimer);
      clearTimeout(exportTimer);
      if (exportMenu) {
        exportMenu.classList.remove("open");
        if (exportWrap) exportWrap.classList.remove("hover-open");
      }
      if (ce) ce.setAttribute("aria-expanded", "false");
      importMenu.classList.add("open");
      importWrap.classList.add("hover-open");
      if (ci) ci.setAttribute("aria-expanded", "true");
    });
    importWrap.addEventListener("mouseleave", (e) => {
      const rel = e.relatedTarget;
      if (rel && rel.closest && rel.closest(".dr-footer")) {
        clearTimeout(importTimer);
        importMenu.classList.remove("open");
        importWrap.classList.remove("hover-open");
        if (ci) ci.setAttribute("aria-expanded", "false");
        return;
      }
      importTimer = setTimeout(() => {
        importMenu.classList.remove("open");
        importWrap.classList.remove("hover-open");
        if (ci) ci.setAttribute("aria-expanded", "false");
      }, 150);
    });
  }

  // Hovering other buttons in the drawer footer closes both popovers immediately
  ["cs", "am", "dd"].forEach((btnId) => {
    const b = $(btnId);
    if (b) {
      b.addEventListener("mouseenter", () => {
        clearTimeout(exportTimer);
        clearTimeout(importTimer);
        if (exportMenu) exportMenu.classList.remove("open");
        if (exportWrap) exportWrap.classList.remove("hover-open");
        if (importMenu) importMenu.classList.remove("open");
        if (importWrap) importWrap.classList.remove("hover-open");
        if (ce) ce.setAttribute("aria-expanded", "false");
        if (ci) ci.setAttribute("aria-expanded", "false");
      });
    }
  });

  // Footer mouseleave guard
  const drFooter = document.querySelector(".dr-footer");
  if (drFooter) {
    drFooter.addEventListener("mouseleave", () => {
      clearTimeout(exportTimer);
      clearTimeout(importTimer);
      if (exportMenu) exportMenu.classList.remove("open");
      if (exportWrap) exportWrap.classList.remove("hover-open");
      if (importMenu) importMenu.classList.remove("open");
      if (importWrap) importWrap.classList.remove("hover-open");
      if (ce) ce.setAttribute("aria-expanded", "false");
      if (ci) ci.setAttribute("aria-expanded", "false");
    });
  }

  // Click toggle on buttons
  if (ce) {
    ce.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (importMenu) importMenu.classList.remove("open");
      const isOpen = exportMenu.classList.toggle("open");
      ce.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  if (ci) {
    ci.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (exportMenu) exportMenu.classList.remove("open");
      const isOpen = importMenu.classList.toggle("open");
      ci.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // Export options
  const optExpJson = $("opt-export-json");
  if (optExpJson) {
    optExpJson.addEventListener("click", (e) => {
      e.stopPropagation();
      if (exportMenu) exportMenu.classList.remove("open");
      if (ce) ce.setAttribute("aria-expanded", "false");
      exportCartJson();
    });
  }

  const optExpMrpack = $("opt-export-mrpack");
  if (optExpMrpack) {
    optExpMrpack.addEventListener("click", (e) => {
      e.stopPropagation();
      if (exportMenu) exportMenu.classList.remove("open");
      if (ce) ce.setAttribute("aria-expanded", "false");
      exportCartMrpack();
    });
  }

  // Import options
  const optImpJson = $("opt-import-json");
  if (optImpJson) {
    optImpJson.addEventListener("click", (e) => {
      e.stopPropagation();
      if (importMenu) importMenu.classList.remove("open");
      if (ci) ci.setAttribute("aria-expanded", "false");
      triggerImportCart();
    });
  }

  const optImpMrpack = $("opt-import-mrpack");
  if (optImpMrpack) {
    optImpMrpack.addEventListener("click", (e) => {
      e.stopPropagation();
      if (importMenu) importMenu.classList.remove("open");
      if (ci) ci.setAttribute("aria-expanded", "false");
      triggerImportMrpack();
    });
  }

  // Close menus when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#exportWrap")) {
      if (exportMenu) exportMenu.classList.remove("open");
      if (ce) ce.setAttribute("aria-expanded", "false");
    }
    if (!e.target.closest("#importWrap")) {
      if (importMenu) importMenu.classList.remove("open");
      if (ci) ci.setAttribute("aria-expanded", "false");
    }
  });
}

async function copyTextToClipboard(text) {
  let success = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch (e) {
      success = false;
    }
  }

  if (!success) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.left = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      success = document.execCommand("copy");
      ta.remove();
    } catch (e) {
      success = false;
    }
  }

  return success;
}

async function handleShareCart() {
  if (!cart.size) {
    return toast("Cart is empty — add items first!");
  }

  try {
    const shareItems = [...cart.values()].map((p) => ({
      k: p.k,
      id: p.id,
      tab: p.tab || "mods",
      title: p.title || "",
      icon: p.icon || "",
      author: p.author || "",
      desc: p.desc || "",
      ver: p.ver || "",
      url: p.url || "",
      source: p.source || "official",
      sourceName: p.sourceName || "",
      subType: p.subType || "",
      isDependency: !!p.isDependency,
      depParent: p.depParent || "",
      g: p.g ? 1 : 0,
      cf: p.cf ? 1 : 0,
    }));

    const jsonStr = JSON.stringify(shareItems);
    let encoded = "";
    try {
      encoded = btoa(
        encodeURIComponent(jsonStr).replace(
          /%([0-9A-F]{2})/g,
          (match, p1) => String.fromCharCode("0x" + p1),
        ),
      );
    } catch (e) {
      encoded = encodeURIComponent(jsonStr);
    }

    const shareUrl = location.href.split("#")[0] + "#share=" + encoded;

    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      toast(`Copied share link for ${cart.size} items to clipboard! 🔗`);
    } else {
      window.prompt("Copy your CraftIndex cart share link:", shareUrl);
    }
  } catch (err) {
    console.error("Share error:", err);
    toast("Failed to generate share link: " + err.message);
  }
}

async function loadSharedCartFromUrl() {
  const hash = location.hash;
  if (!hash) return;

  const shareMatch = hash.match(/(?:cart|share)=([^&]+)/);
  if (!shareMatch) return;

  const rawPayload = shareMatch[1];

  // 1. Universal Base64 / JSON cart
  try {
    let jsonStr = "";
    try {
      jsonStr = decodeURIComponent(
        Array.prototype.map
          .call(atob(rawPayload), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
    } catch (e) {
      jsonStr = decodeURIComponent(rawPayload);
    }
    const items = JSON.parse(jsonStr);
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((p) => {
        if (p && (p.k || p.id)) {
          cart.set(p.k || p.id, p);
        }
      });
      sv();
      upd();
      draw();
      dr(1);
      toast(`Loaded ${items.length} items from shared link! 🔗`);
      return;
    }
  } catch (err) {}

  // 2. Legacy Modrinth project IDs
  try {
    const pr = decodeURIComponent(rawPayload)
      .split(",")
      .map((x) => x.split(":"));
    const ids = pr.filter((x) => x[1]).map((x) => x[1]);
    if (ids.length) {
      const ps = await api("/projects?ids=" + encodeURIComponent(JSON.stringify(ids)));
      ps.forEach((p) => {
        const itemTab = (pr.find((x) => x[1] === p.id) || [])[0] || p.project_type || "mods";
        cart.set(p.id, {
          k: p.id,
          id: p.id,
          tab: itemTab,
          title: p.title,
          icon: p.icon_url,
          author: "",
          desc: p.description,
          pt: p.project_type,
        });
      });
      sv();
      upd();
      draw();
      dr(1);
      toast(`Loaded ${ps.length} items from shared link! 🔗`);
    }
  } catch (e) {
    console.warn("Could not load legacy cart:", e);
  }
}

if ($("cif")) $("cif").onchange = handleImportCartFile;
if ($("cifMrpack")) $("cifMrpack").onchange = handleImportMrpackFile;
if ($("cs")) $("cs").onclick = handleShareCart;
setupCartPopovers();

document.addEventListener("click", (e) => {
  const btnShare = e.target.closest("#cs");
  if (btnShare) {
    e.preventDefault();
    handleShareCart();
    return;
  }
});

window.addEventListener("hashchange", loadSharedCartFromUrl);
loadSharedCartFromUrl();
addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const socialsModal = $("socialsModal");
    const aboutModal = $("aboutModal");
    const depModal = $("depModal");
    if (socialsModal && socialsModal.classList.contains("open")) {
      closeSocialsModal();
    } else if (aboutModal && aboutModal.classList.contains("open")) {
      closeAboutModal();
    } else if (depModal && depModal.classList.contains("open")) {
      depModal.classList.remove("open");
      depModal.setAttribute("aria-hidden", "true");
      CraftIndexScrollLock.release("dep");
      if (activeToolbarModal === "collection") {
        activeToolbarModal = null;
        returnToLastUrlAndReload();
      }
    } else if ($("md").classList.contains("o") && !busy) {
      md(0);
    } else {
      dr(0);
    }
  } else if (
    e.key === "/" &&
    !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $("q").focus();
  }
});
function applyAppMode(targetMode) {
  let m = targetMode || safeStorage.getItem("cv_mode") || C.mode || "dark";
  if (targetMode) {
    try {
      localStorage.setItem("cv_mode", m);
    } catch (e) {}
  }
  const l =
    m === "light" ||
    (m === "auto" && matchMedia("(prefers-color-scheme:light)").matches);
  document.body.classList.toggle("light-mode", l);
  // Keep the pre-CSS theme hint attribute in sync so tokens.css matches
  // the body class mechanism exactly (no double source of truth).
  if (l) document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  if ($("mt")) {
    $("mt").title = l ? "Switch to Night Mode (Dark) 🌙" : "Switch to Day Mode (Light) ☀️";
    $("mt").setAttribute("aria-label", $("mt").title);
  }
  $("lm").textContent = l
    ? ":root{--bg:#f8f4fc;--r:rgba(255,255,255,0.65);--t:#3d2b56;--w:#180c2e;--bd:rgba(225,210,240,0.7);--r2:rgba(255,255,255,0.85);--b:#9333ea;--b2:#c084fc;--g:linear-gradient(135deg,#9333ea,#c084fc);--on:#ffffff}"
    : "";
  const vDark = $("bgVideoDark");
  const vLight = $("bgVideoLight");
  const overlay = $("bgOverlay");
  const isVideoEnabled = safeStorage.getItem("cv_ambient_video") !== "0";
  // Performance gate: no ambient download on Save-Data connections or for
  // users who prefer reduced motion. The static gradient fallback renders
  // instead and the identity stays intact.
  const prefersReducedMotion =
    matchMedia("(prefers-reduced-motion: reduce)").matches || false;
  let dataSaver = false;
  try {
    const conn = navigator.connection || {};
    dataSaver = Boolean(conn.saveData) || /2g/.test(conn.effectiveType || "");
  } catch (e) {}
  const shouldLoadVideo = isVideoEnabled && !prefersReducedMotion && !dataSaver;

  if (vDark && vLight && overlay) {
    if (!isVideoEnabled) {
      vDark.classList.remove("active");
      vLight.classList.remove("active");
      try { vDark.pause(); } catch (e) {}
      try { vLight.pause(); } catch (e) {}
      overlay.className = l ? "bg-overlay light no-video" : "bg-overlay dark no-video";
    } else {
      // Load-at-most-one: only the active theme's video receives a source
      // (both <video> elements ship with preload="none" and no <source>).
      const active = l ? vLight : vDark;
      const idle = l ? vDark : vLight;
      overlay.className = l ? "bg-overlay light" : "bg-overlay dark";
      if (shouldLoadVideo && !active.dataset.loaded) {
        active.dataset.loaded = "1";
        // Keep preload="none" until the browser is idle so the ~10 MB video
        // fetch never competes with initial HTML/CSS/JS parsing for LCP/FCP.
        const startVideo = () => {
          active.preload = "auto";
          active.innerHTML =
            '<source src="' + (active.dataset.src || "") + '" type="video/mp4" />';
          active.load();
          active.classList.add("active");
          active.play().catch(() => {});
        };
        const defer = (typeof requestIdleCallback === "function" ? requestIdleCallback : (cb) => setTimeout(cb, 0));
        defer(() => {
          // Do not start playback if the overlay was turned off meanwhile.
          if (safeStorage.getItem("cv_ambient_video") !== "0") startVideo();
        }, { timeout: 1500 });
      } else if (!shouldLoadVideo) {
        active.classList.remove("active");
        try { active.pause(); } catch (e) {}
        overlay.className = l ? "bg-overlay light no-video" : "bg-overlay dark no-video";
      } else {
        // Video already attached — resume the active theme's playback
        // (e.g. after a theme re-toggle), never double-fetch.
        active.classList.add("active");
        try { active.play().catch(() => {}); } catch (e) {}
      }
    }
  }
  return m;
}
applyAppMode();
if ($("mt")) {
  $("mt").onclick = () => {
    const cur = safeStorage.getItem("cv_mode") || C.mode || "dark";
    applyAppMode(cur === "light" ? "dark" : "light");
  };
}
// Pause ambient video when the tab is hidden / page is being unloaded to save
// bandwidth and avoid background decode work; resume only on visible.
const _pauseAmbient = () => {
  const vD = $("bgVideoDark"), vL = $("bgVideoLight");
  try { if (vD) vD.pause(); } catch (e) {}
  try { if (vL) vL.pause(); } catch (e) {}
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") _pauseAmbient();
});
window.addEventListener("pagehide", _pauseAmbient);
async function getFile(url, label, h) {
  const fn = decodeURIComponent(url.split("/").pop().split("?")[0]) || label;
  try {
    const r = await fetch(url);
    if (!r.ok) throw 0;
    const b = await r.blob(),
      a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = fn;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3e4);
  } catch (e) {
    window.open(url, "_blank", "noopener");
  }
  HS(
    [
      {
        t: Date.now(),
        g: T(h.tab).dir || "files",
        nm: fn,
        n: 1,
        mc: "-",
        items: [h.title],
      },
      ...H(),
    ].slice(0, 200),
  );
}
function openItem(h) {
  const t = T(h.tab),
    rep = (s) =>
      String(s || "").replace(
        /\{(name|description|version|author)\}/g,
        (m, k) =>
          ({
            name: h.title,
            description: h.desc,
            version: h.ver,
            author: h.author,
          })[k] || "",
      ),
    ok = (u) => /^https?:/i.test(u || ""),
    links = [
      ...(ok(h.url) ? [{ label: t.dlLabel || "Download", url: h.url }] : []),
      ...(h.links || []).filter((l) => ok(l.url)),
    ];
  md(1);
  $("mh").textContent = rep(t.popTitle || "{name}");
  $("mb").innerHTML =
    `<div style="display:flex;gap:12px;align-items:center">${ico(h)}<div><b style="color:var(--w);font-size:18px">${E(h.title)}</b><div style="font-size:13px">${E(h.author)}${h.ver ? " · v" + E(h.ver) : ""}</div></div></div><div class="pgc">${SAN(MD(rep(h.pop || t.popBody) || h.desc || ""))}</div>` +
    (links.length
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${links.map((l, i) => `<button class="btn p" data-u="${i}">⬇ ${E(l.label || "Download")}</button>`).join("")}</div>`
      : "");
  $("mb")
    .querySelectorAll("[data-u]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const l = links[b.dataset.u];
          getFile(l.url, l.label, h);
        }),
    );
  mf(
    `<button class="btn" id="pa">${cart.has(h.k) ? "Remove from cart" : "Add to cart"}</button><button class="btn p" id="pc">Close</button>`,
  );
  $("pa").onclick = () => {
    if (cart.has(h.k)) cart.delete(h.k);
    else cart.set(h.k, h);
    sv();
    upd();
    draw();
    md(0);
  };
  $("pc").onclick = () => md(0);
}
function FX() {
  const p = C.preset || "medium";
  const base = `:root{--sp:cubic-bezier(.34,1.56,.64,1)}@supports (transition-timing-function:linear(0,1)){:root{--sp:linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077,1.121,1.149 24.3%,1.159,1.163,1.161,1.154 29.9%,1.129 32.8%,1.051 39.6%,1.017 43.1%,1.003 49.2%,.995 55%,.998 70%,1)}}@keyframes pop{from{transform:translateY(20px) scale(.92)}}@keyframes fl{to{transform:translate(8vmax,-6vmax) scale(1.15)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`;
  if (p === "performance")
    return (
      base +
      `body *,body *::before,body *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important;transition:none!important;box-shadow:none!important}body .cd:hover{transform:none}body .cd{content-visibility:auto;contain-intrinsic-size:auto 110px}`
    );
  if (p === "medium")
    return (
      base +
      `body header{backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);background:color-mix(in srgb,var(--r),transparent 22%)}body .btn,body .tb,body .cd,body .in{transition:transform .45s var(--sp),box-shadow .25s,border-color .2s,filter .2s}body .btn:hover,body .tb:hover{transform:scale(1.04)}body .btn:active,body .tb:active{transform:scale(.94)}body .cd{box-shadow:0 6px 18px rgba(0,0,0,.22)}body .cd:hover{transform:translateY(-3px)}body .mx{animation:pop .45s var(--sp)}`
    );
  const bl =
      "backdrop-filter:blur(28px) saturate(190%);-webkit-backdrop-filter:blur(28px) saturate(190%)",
    hi =
      "inset 0 1px 0 rgba(255,255,255,.4),inset 0 -1px 0 rgba(255,255,255,.07)";
  return (
    base +
    `body{background:radial-gradient(1100px 650px at 10% -8%,color-mix(in srgb,var(--b2),transparent 60%),transparent 62%),radial-gradient(900px 600px at 100% 8%,color-mix(in srgb,var(--b),transparent 65%),transparent 62%),var(--bg) fixed;overflow-x:hidden}
body::before,body::after{content:'';position:fixed;z-index:-1;width:44vmax;height:44vmax;border-radius:50%;filter:blur(80px);opacity:.4;animation:fl 24s ease-in-out infinite alternate;pointer-events:none}
body::before{background:var(--b2);left:-14vmax;top:34vh}body::after{background:var(--b);right:-16vmax;bottom:-12vmax;animation-delay:-9s}
body header,body .cd,body .mx,body .rw{background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.04)),color-mix(in srgb,var(--r),transparent 55%)!important;${bl};box-shadow:${hi},0 12px 36px rgba(0,0,0,.3);border-color:rgba(255,255,255,.2)}
body header{border-bottom:1px solid rgba(255,255,255,.2)}body .dr{border-left:1px solid rgba(179,136,255,.25)!important;background:rgba(14,10,26,.985)!important}body .cd{border:2px solid rgba(255,255,255,.16)}body .cd.sel{border-color:var(--b)}body .cd{backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%)}
body .cd::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.12),transparent 40%);pointer-events:none}
body .in,body .tb{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);${bl};box-shadow:${hi}}
body .tb.on{background:color-mix(in srgb,var(--b),transparent 80%);box-shadow:${hi},0 0 18px color-mix(in srgb,var(--b),transparent 60%)}
body .btn:not(.p){background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:${hi}}
body .btn.p{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 8px 24px color-mix(in srgb,var(--b),transparent 55%)}
body .btn,body .tb,body .cd,body .fabs .btn,body .in{transition:transform .6s var(--sp),box-shadow .3s,background .3s,border-color .3s}
body .btn:hover,body .tb:hover{transform:scale(1.07)}body .btn:active,body .tb:active{transform:scale(.88);transition-duration:.15s}
body .cd:hover{transform:translateY(-6px) scale(1.02)}body .cd:active{transform:scale(.97)}
body [data-anim] .cd{animation:pop .75s var(--sp) both}${[...Array(12)].map((_, i) => `body [data-anim] .cd:nth-child(${i + 1}){animation-delay:${i * 45}ms}`).join("")}
body .dr{transition:transform .65s cubic-bezier(.32,.72,0,1)}body .sc,body .md{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
body .fabs:not(.h) .big{animation:pop .7s var(--sp)}body .pg i{box-shadow:0 0 12px var(--b)}`
  );
}
// --- CraftIndex Core Modal Dialog Controller ---
const CraftIndexModal = {
  toggle(isOpen) {
    const modalEl = $("md");
    if (!modalEl) return;
    modalEl.classList.toggle("o", Boolean(isOpen));
    modalEl.classList.toggle("is-open", Boolean(isOpen));
    modalEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (isOpen) CraftIndexScrollLock.acquire("md");
    else CraftIndexScrollLock.release("md");

    if (!isOpen) {
      const mx = modalEl.querySelector(".mx");
      if (mx) mx.classList.remove("settings-mode", "sources-mode", "ad-mode");
      if (activeToolbarModal === "settings" || activeToolbarModal === "presets" || activeToolbarModal === "history") {
        activeToolbarModal = null;
        try {
          const lastUrl = sessionStorage.getItem("cv_last_browse_url") || "/";
          if (window.location.pathname !== lastUrl && !lastUrl.startsWith("/docs") && !lastUrl.startsWith("/socials")) {
            window.history.pushState({}, "", lastUrl);
          }
        } catch (_) {}
      }
    }
    updateBrowserTitle();
  },

  open() {
    this.toggle(true);
  },

  close() {
    this.toggle(false);
  },

  setHeader(content) {
    const el = $("mh");
    if (el) el.textContent = content;
  },

  setBody(htmlContent) {
    const el = $("mb");
    if (el) el.innerHTML = htmlContent;
  },

  setFooter(htmlContent) {
    const el = $("mf");
    if (el) el.innerHTML = htmlContent;
  }
};

const md = (o) => CraftIndexModal.toggle(o);
const mf = (h) => CraftIndexModal.setFooter(h);
const mb = (h) => CraftIndexModal.setBody(h);
const mh = (h) => CraftIndexModal.setHeader(h);

window.CraftIndexModal = CraftIndexModal;
window.md = md;
window.mf = mf;
window.mb = mb;
window.mh = mh;
function setup() {
  dr(0);
  md(1);
  const ms = [...cart.values()].map((p) => T(p.tab).mode),
    rel = GV.filter(
      (v) =>
        v.version_type === "release" ||
        (C.snaps && v.version_type === "snapshot"),
    );
  $("mh").textContent = "Download";
  $("mb").innerHTML =
    `<label>Minecraft version<br><select class="in" id="sm" style="width:100%">${rel.map((v) => `<option ${v.version === cfg.mc ? "selected" : ""}>${v.version}</option>`).join("")}</select></label>${ms.includes("mod") ? `<label>Mod loader<br><select class="in" id="sl" style="width:100%">${ML.map((l) => `<option ${l === cfg.ml ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}${
      ms.includes("plugin")
        ? `<label>Server platform<br><select class="in" id="sp" style="width:100%">${Object.keys(
            PL,
          )
            .map(
              (l) => `<option ${l === cfg.pl ? "selected" : ""}>${l}</option>`,
            )
            .join("")}</select></label>`
        : ""
    }<label><input type="checkbox" id="sd" ${cfg.deps ? "checked" : ""}> Include required dependencies</label><div style="font-size:13px">${cart.size} in cart. ${C.sep ? "One ZIP per tab." : "One ZIP."}</div>`;
  setTimeout(() => initAllGlassSelects($("mb")), 0);
  mf(
    '<button class="btn" id="c1">Cancel</button><button class="btn p" id="c2">Check availability</button>',
  );
  $("c1").onclick = () => md(0);
  $("c2").onclick = () => {
    cfg.mc = $("sm").value;
    if ($("sl")) cfg.ml = $("sl").value;
    if ($("sp")) cfg.pl = $("sp").value;
    cfg.deps = $("sd").checked;
    resolve();
  };
}
const lo = (it) => {
    const m = T(it.tab).mode;
    return m === "mod"
      ? cfg.ml === "quilt"
        ? ["quilt", "fabric"]
        : [cfg.ml]
      : m === "plugin"
        ? PL[cfg.pl]
        : m === "datapack"
          ? ["datapack"]
          : m === "resourcepack"
            ? ["minecraft"]
            : null;
  },
  vs = (it, g) => {
    const q = new URLSearchParams(),
      l = lo(it);
    if (l) q.set("loaders", JSON.stringify(l));
    if (g) q.set("game_versions", JSON.stringify([g]));
    return api("/project/" + it.id + "/version?" + q);
  },
  best = (l) =>
    ["release", "beta", "alpha"]
      .map((t) => l.find((x) => x.version_type === t))
      .find(Boolean),
  pf = (v) => v.files.find((f) => f.primary) || v.files[0];
async function one(it) {
  const r = { it, f: null, v: null, o: null };
  if (it.cf || it.source === "curseforge" || it.source === "bukkit") {
    try {
      const q = new URLSearchParams({ pageSize: 50 });
      if (cfg.mc) q.set("gameVersion", cfg.mc);
      const l = lo(it);
      if (l && CT[l[0]]) q.set("modLoaderType", CT[l[0]]);
      const d = await cfa("/v1/mods/" + it.id + "/files?" + q);
      let f = (d.data || []).find((x) => x.downloadUrl);
      if (!f && d.data && d.data.length > 0) {
        f = d.data[0];
        f.downloadUrl =
          f.downloadUrl ||
          `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${f.fileName}`;
      }
      if (f) {
        r.f = { url: f.downloadUrl, filename: f.fileName };
        r.s = f.releaseType === 1 ? "ok" : "w";
      } else r.s = "b";
    } catch (e) {
      r.s = "b";
    }
    return r;
  }
  if (it.source === "hangar") {
    try {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/hangar"
        : "https://hangar.papermc.io/api/v1";
      const vers = await fetch(baseUrl + "/projects/" + encodeURIComponent(it.id) + "/versions?limit=1").then(r => r.json());
      const v = vers.result && vers.result[0];
      if (v) {
        const plat = Object.keys(v.downloads || {})[0];
        const dlInfo = plat && v.downloads[plat];
        if (dlInfo && (dlInfo.downloadUrl || dlInfo.externalUrl)) {
          r.f = {
            url: dlInfo.downloadUrl || dlInfo.externalUrl,
            filename: (dlInfo.fileInfo && dlInfo.fileInfo.name) || (it.title + ".jar"),
          };
          r.s = "ok";
          return r;
        }
      }
    } catch (e) {}
    r.s = "b";
    return r;
  }
  if (it.source === "spigotmc") {
    const baseUrl = window.location.protocol.startsWith("http")
      ? "/api/spiget"
      : "https://api.spiget.org/v2";
    r.f = {
      url: `${baseUrl}/resources/${it.id}/download`,
      filename: it.title.replace(/[^a-zA-Z0-9._-]/g, "_") + ".jar",
    };
    r.s = "ok";
    return r;
  }
  if (it.source === "sponge") {
    r.f = {
      url: `/api/sponge/projects/${it.id}/versions/latest/download`,
      filename: it.title.replace(/[^a-zA-Z0-9._-]/g, "_") + ".jar",
    };
    r.s = "ok";
    return r;
  }
  if (it.source === "polymart") {
    r.f = {
      url: `/api/polymart/download?resource_id=${it.id}`,
      filename: it.title.replace(/[^a-zA-Z0-9._-]/g, "_") + ".jar",
    };
    r.s = "ok";
    return r;
  }
  if (it.source === "smithed") {
    try {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/smithed"
        : "https://api.smithed.dev/v2";
      const pack = await fetch(baseUrl + "/packs/" + encodeURIComponent(it.id)).then((r) => r.json());
      const versions = pack.versions || [];
      let match = null;
      if (cfg.mc && versions.length > 0) {
        match = versions.find((v) => (v.supports || []).includes(cfg.mc));
      }
      if (!match && versions.length > 0) {
        match = versions[0];
      }
      const dlUrl = match && match.downloads && (match.downloads.datapack || match.downloads.resourcepack);
      if (dlUrl) {
        r.f = {
          url: dlUrl,
          filename: it.title.replace(/[^a-zA-Z0-9._-]/g, "_") + ".zip",
        };
        r.s = "ok";
        return r;
      }
    } catch (e) {}
    r.s = "b";
    return r;
  }
  if (it.source === "github") {
    try {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/github"
        : "https://api.github.com";
      const rels = await fetch(`${baseUrl}/repos/${it.id}/releases?per_page=5`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      }).then((r) => r.json());
      if (Array.isArray(rels) && rels.length > 0) {
        for (const rel of rels) {
          const assets = rel.assets || [];
          const targetExt = it.tab === "mods" ? ".jar" : ".zip";
          const matchAsset =
            assets.find((a) => a.name.toLowerCase().endsWith(targetExt)) ||
            assets[0];
          if (matchAsset) {
            r.f = {
              url: matchAsset.browser_download_url,
              filename: matchAsset.name,
            };
            r.s = "ok";
            return r;
          }
        }
      }
      r.f = {
        url: `https://github.com/${it.id}/archive/refs/heads/${it.defaultBranch || "main"}.zip`,
        filename: `${it.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.zip`,
      };
      r.s = "ok";
      return r;
    } catch (e) {}
    r.s = "b";
    return r;
  }
  if (it.g) {
    let fn =
      decodeURIComponent((it.url || "").split("/").pop().split("?")[0]) ||
      it.title.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!fn.includes(".")) {
      fn +=
        it.tab === "modloaders" ||
        it.tab === "serversoftwares" ||
        it.tab === "mods" ||
        it.tab === "plugins"
          ? ".jar"
          : ".zip";
    }
    r.f = {
      url: it.url,
      filename: fn,
    };
    r.s = "ok";
    return r;
  }
  try {
    const v = best(await vs(it, cfg.mc));
    if (v) {
      r.v = v;
      r.f = pf(v);
      r.s = v.version_type === "release" ? "ok" : "w";
    } else {
      r.s = "m";
      const all = await vs(it, null),
        m = new Map();
      all.forEach((v) =>
        v.game_versions.forEach((g) => m.has(g) || m.set(g, v)),
      );
      const od = new Map(GV.map((g, i) => [g.version, i]));
      r.o = [...m.keys()]
        .sort((a, b) => (od.get(a) ?? 9e3) - (od.get(b) ?? 9e3))
        .map((g) => ({
          g,
          v: best(all.filter((x) => x.game_versions.includes(g))),
        }));
    }
  } catch (e) {
    r.s = "b";
  }
  return r;
}
async function resolve() {
  busy = 1;
  $("mh").textContent = "Checking...";
  $("mb").innerHTML =
    '<div id="pp">Starting...</div><div class="pg"><i id="pb"></i></div>';
  mf("");
  const its = [...cart.values()],
    q = its.slice();
  res = [];
  let n = 0;
  await Promise.all(
    [0, 1, 2, 3, 4].map(async () => {
      while (q.length) {
        res.push(await one(q.shift()));
        n++;
        $("pp").textContent = n + " / " + its.length;
        $("pb").style.width = (n / its.length) * 100 + "%";
      }
    }),
  );
  res.sort((a, b) => its.indexOf(a.it) - its.indexOf(b.it));
  if (cfg.deps) {
    try {
      const ids = new Set(its.map((i) => i.k)),
        want = new Set();
      res.forEach(
        (r) =>
          r.v &&
          r.v.dependencies.forEach(
            (d) =>
              d.dependency_type === "required" &&
              d.project_id &&
              !ids.has(d.project_id) &&
              want.add(d.project_id),
          ),
      );
      if (want.size) {
        const ps = await api(
          "/projects?ids=" + encodeURIComponent(JSON.stringify([...want])),
        );
        for (const p of ps) {
          const r = await one({
            k: p.id,
            id: p.id,
            tab: res.find(
              (x) => x.v && x.v.dependencies.some((d) => d.project_id === p.id),
            ).it.tab,
            title: p.title,
            icon: p.icon_url,
          });
          if (r.s === "ok" || r.s === "w") {
            r.dep = 1;
            res.push(r);
          }
        }
      }
    } catch (e) {}
  }
  busy = 0;
  show();
}
function show() {
  $("mh").textContent = "Minecraft " + cfg.mc;
  const need = res.filter(
      (r) => r.s === "m" && !r.f && r.ch !== "skip" && r.o && r.o.length,
    ).length,
    n = res.filter((r) => r.f).length;
  $("mb").innerHTML =
    `<div style="font-size:13px">${need ? need + " not available for " + E(cfg.mc) + ". Pick a version or skip." : "All set: " + n + " file(s) ready."}</div>` +
    res
      .map(
        (r, i) =>
          `<div class="rw">${ico(r.it)}<div class="t"><b>${E(r.it.title)}</b><span>${E(T(r.it.tab).name)}${r.dep ? " · dependency" : ""}</span></div>${r.s === "ok" || r.s === "w" ? `<span class="s ${r.s}">${r.v ? E(r.v.version_number) : "ready"}</span>` : r.s === "m" ? (r.ch === "skip" ? '<span class="s">Skipped</span>' : `<select class="in" data-i="${i}" style="max-width:190px;padding:5px"><option value="">Pick version</option>${(r.o || []).map((o) => `<option ${r.ch === o.g ? "selected" : ""}>${E(o.g)}</option>`).join("")}<option value="skip">Skip</option></select>`) : '<span class="s b">Error</span>'}</div>`,
      )
      .join("");
  $("mb")
    .querySelectorAll("select[data-i]")
    .forEach(
      (s) =>
        (s.onchange = () => {
          const r = res[s.dataset.i];
          if (s.value === "skip") {
            r.ch = "skip";
            r.f = null;
          } else if (s.value) {
            const o = r.o.find((x) => x.g === s.value);
            r.ch = o.g;
            r.v = o.v;
            r.f = pf(o.v);
          } else {
            r.ch = "";
            r.f = null;
          }
          show();
        }),
    );
  mf(
    `<button class="btn" id="b1">Back</button><button class="btn p" id="b2" ${need || !n ? "disabled" : ""}>⬇ Download (${n})</button>`,
  );
  $("b1").onclick = setup;
  $("b2").onclick = zip;
}
async function zip() {
  try {
    await ensureJSZip();
  } catch (err) {
    return toast("JSZip failed to load");
  }
  busy = 1;
  const rs = res.filter((r) => r.f);
  if (!rs.length) {
    busy = 0;
    return toast("No files ready to download");
  }

  $("mh").textContent = "Building ZIP Archive...";
  $("mb").innerHTML =
    '<div id="pp"></div><div class="pg"><i id="pb"></i></div><div id="er" style="color:var(--red);font-size:13px"></div>';
  mf("");

  const z = new JSZip();
  const used = new Set();
  const fail = [];
  let d = 0;
  const q = rs.slice();

  await Promise.all(
    [0, 1, 2, 3].map(async () => {
      while (q.length) {
        const r = q.shift();
        try {
          const x = await fetch(r.f.url);
          if (!x.ok) throw 0;
          const b = await x.blob();
          const folderName = (r.it.isDependency || r.dep)
            ? "Dependencies"
            : (T(r.it.tab).dir || T(r.it.tab).name || "Files");
          const targetFolder = z.folder(folderName);
          let nm = r.f.filename;
          let k = 1;
          while (used.has(folderName + "/" + nm)) {
            nm = r.f.filename.replace(/(\.[^.]+)?$/, "_" + k++ + "$1");
          }
          used.add(folderName + "/" + nm);
          targetFolder.file(nm, b);
        } catch (e) {
          fail.push(r.it.title);
        }
        d++;
        $("pp").textContent = d + " / " + rs.length;
        $("pb").style.width = (d / rs.length) * 100 + "%";
      }
    }),
  );

  if (C.readme) {
    const categoriesMap = {};
    rs.forEach((r) => {
      const fName = (r.it.isDependency || r.dep)
        ? "Dependencies"
        : (T(r.it.tab).name || "Files");
      categoriesMap[fName] = categoriesMap[fName] || [];
      categoriesMap[fName].push(
        r.it.title + " - " + (r.v ? r.v.version_number : r.it.ver || "latest"),
      );
    });
    let readmeText =
      C.title +
      " - Bulk Download Package\nMinecraft " +
      (cfg.mc || "All Versions") +
      "\nGenerated on " +
      new Date().toLocaleString() +
      "\n\n";
    for (const cat in categoriesMap) {
      readmeText +=
        "=== " + cat.toUpperCase() + " ===\n" + categoriesMap[cat].join("\n") + "\n\n";
    }
    z.file("README.txt", readmeText);
  }

  const blob = await z.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });

  let customZipName =
    ($("drZipName") && $("drZipName").value.trim()) ||
    C.zipName ||
    "CraftIndex.inlooker.top-Collection.zip";
  if (!customZipName.toLowerCase().endsWith(".zip")) customZipName += ".zip";

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = customZipName;
  document.body.append(a);
  a.click();
  a.remove();

  hist(
    "All Categories",
    customZipName,
    rs.length,
    rs.map((r) => r.it.title),
  );

  busy = 0;
  $("mh").textContent = "Done";
  $("mb").innerHTML =
    "<div>Downloaded: <b>" +
    E(customZipName) +
    "</b> (" +
    rs.length +
    " file(s) in organized category folders)<br><br>" +
    rs
      .map(
        (r) =>
          `• [${E((r.it.isDependency || r.dep) ? "Dependencies" : T(r.it.tab).name || "Files")}] ${E(r.it.title)}`,
      )
      .join("<br>") +
    "</div>" +
    (fail.length
      ? '<div style="color:var(--red);margin-top:10px">Failed to download: ' +
        fail.map(E).join(", ") +
        "</div>"
      : "");
  mf('<button class="btn p" id="b1">Close</button>');
  $("b1").onclick = () => md(0);
}
$("md").onclick = (e) => {
  if (e.target === $("md") && !busy) md(0);
};
(async () => {
  // Canonical Route Dispatcher from Initial Browser URL:
  // Must execute immediately to hydrate the exact requested route first,
  // preventing home-mode flicker, filter bar collapse, and layout shift.
  handleRouteFromUrl(false);
  upd();

  // Load game versions asynchronously in background without blocking initial route rendering
  api("/tag/game_version")
    .then((gv) => {
      GV = gv || [];
      const rel = GV.filter(
        (v) =>
          v.version_type === "release" ||
          (C.snaps && v.version_type === "snapshot"),
      );
      if (GV.length) {
        cfg.mc =
          C.defMc && GV.some((v) => v.version === C.defMc)
            ? C.defMc
            : (GV.find((v) => v.version_type === "release") || {}).version || "";
        if ($("fv")) {
          $("fv").innerHTML =
            '<option value="">Any version</option>' +
            rel.map((v) => `<option>${v.version}</option>`).join("");
        }
      }
    })
    .catch(() => {});

  // Dismiss the boot loading screen now that the app is fully hydrated.
  // No simulated progress or artificial delay: the bar completes and the
  // screen exits immediately when initialization actually finishes.
  (function dismissBootScreen() {
    const boot = document.getElementById("ci-boot-screen");
    if (!boot) return;
    const fill = boot.querySelector(".ci-boot-bar-fill");
    if (fill) fill.style.cssText = "width:100%;transition:width 0.15s ease;";
    const bar = boot.querySelector(".ci-boot-bar");
    if (bar) bar.setAttribute("aria-valuenow", "100");
    const statusText = document.getElementById("ciBootStatusText");
    if (statusText) statusText.textContent = "Ready";
    boot.classList.add("ci-boot-hide");
    setTimeout(() => {
      boot.style.display = "none";
      if (boot.parentNode) boot.parentNode.removeChild(boot);
      const bootStyle = document.getElementById("ci-boot-style");
      if (bootStyle) bootStyle.remove();
    }, 400);
  })();
})();

/* ========================================================
   RESOURCE DETAIL DASHBOARD & SINGLE DOWNLOAD ENGINE
   ======================================================== */
let currentDashItem = null;
let currentDashData = null;
let currentDashVersions = [];
let currentDashTab = "docs";
let dashVerFilter = "";
let dashLoaderFilter = "";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Unknown size";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function triggerDirectDownload(url, filename) {
  if (!url) {
    return toast("Download link not available directly. Check official site.");
  }
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Downloading " + (filename || "file") + "...");
}

function closeDashModal() {
  const modal = $("dashModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.classList.remove("inline");
  modal.setAttribute("aria-hidden", "true");
  if (dashInline) {
    restoreInlineDashHost();
    dashInline = null;
  }
  CraftIndexScrollLock.release("dash");
  updateBrowserTitle();
}

function openLightbox(url, caption) {
  const box = $("dashLightbox");
  if (!box) return;
  $("dashLightboxImg").src = url;
  $("dashLightboxCaption").textContent = caption || "";
  box.classList.add("open");
  box.setAttribute("aria-hidden", "false");
  CraftIndexScrollLock.acquire("dash-lightbox");
}

function closeLightbox() {
  const box = $("dashLightbox");
  if (!box) return;
  box.classList.remove("open");
  box.setAttribute("aria-hidden", "true");
  $("dashLightboxImg").src = "";
  CraftIndexScrollLock.release("dash-lightbox");
}

function renderDashHeader(h) {
  const s = cart.has(h.k);
  const iconHtml = h.icon
    ? `<img class="dash-icon" src="${E(h.icon)}" alt="${E(h.title || 'Resource Icon')}" onerror="this.outerHTML='<div class=dash-icon>${E((h.title || "?")[0])}</div>'">`
    : `<div class="dash-icon">${E((h.title || "?")[0])}</div>`;

  $("dashHeader").innerHTML = `
    ${iconHtml}
    <div class="dash-title-wrap">
      <h2 class="dash-title">
        <a href="${E(h.websiteUrl)}" target="_blank" rel="noopener">${E(h.title)}</a>
        <a href="${E(h.websiteUrl)}" target="_blank" rel="noopener" class="source-link ${h.source}"><span class="source-dot"></span><span>${E(h.sourceName)}</span> <span class="ext-icon">↗</span></a>
      </h2>
      <div class="dash-author">
        ${h.author ? `by <b style="color:var(--w);">${E(h.author)}</b>` : ""} 
        <span style="opacity:0.5;margin:0 6px;">•</span>
        <span style="text-transform: capitalize;">${E(T(h.tab).name || h.tab)}</span>
      </div>
    </div>
    <div class="dash-header-actions">
      <button class="btn ${s ? "" : "p"}" id="dashCartBtn">${s ? E(C.tAdded) : E(C.tAdd)}</button>
      <button class="dash-close" id="dashCloseBtn" title="Close (Esc)">✕</button>
    </div>
  `;

  $("dashCartBtn").onclick = () => {
    if (cart.has(h.k)) {
      cart.delete(h.k);
      sv();
      upd();
      draw();
      renderDashHeader(h);
    } else {
      if (C.max && cart.size >= C.max) return toast("Limit: " + C.max + " items");

      if (h.sources && h.sources.length > 1) {
        const catId = h.tab || "mods";
        const { primary: prim, secondary: sec } = getSourcePrefs(catId);
        const auto = safeStorage.getItem("cv_auto_source") !== "0";

        if (auto && prim !== "ask") {
          const primMatch = h.sources.find((s) => s.id === prim);
          if (primMatch) {
            applyChosenSource(h, primMatch);
            cart.set(h.k, h);
            sv();
            upd();
            draw();
            renderDashHeader(h);
            toast(`Added ${h.title} from ${primMatch.name}!`);
            return;
          }

          if (sec !== "none") {
            const secMatch = h.sources.find((s) => s.id === sec);
            if (secMatch) {
              applyChosenSource(h, secMatch);
              cart.set(h.k, h);
              sv();
              upd();
              draw();
              renderDashHeader(h);
              toast(`Added ${h.title} from ${secMatch.name} (Secondary fallback)!`);
              return;
            }
          }

          openSourceSelectorModal(h, () => {
            renderDashHeader(h);
          });
          return;
        }

        openSourceSelectorModal(h, () => {
          renderDashHeader(h);
        });
      } else {
        cart.set(h.k, h);
        sv();
        upd();
        draw();
        renderDashHeader(h);
      }
    }
  };

  $("dashCloseBtn").onclick = closeDashModal;
}

function renderDashMetrics(h, data) {
  const dl = (data && (data.downloads || data.downloadCount)) || h.dl;
  const fo = (data && (data.followers || data.thumbsUpCount)) || h.fo;
  const licenseName =
    data && data.license
      ? typeof data.license === "object"
        ? data.license.id || data.license.name
        : data.license
      : null;

  const dateMod = data
    ? data.updated || data.dateModified || data.published
    : null;
  const dateFormatted = dateMod
    ? new Date(dateMod).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const tags =
    h.tags && h.tags.length
      ? h.tags
      : data && data.categories
        ? data.categories.map((c) => (typeof c === "string" ? c : c.name))
        : [];

  $("dashMetrics").innerHTML = `
    ${dl != null ? `<div class="dash-metric-item"><span>⬇</span> <b>${fmt(dl)}</b> downloads</div>` : ""}
    ${fo != null ? `<div class="dash-metric-item"><span>♥</span> <b>${fmt(fo)}</b> ${h.source === "modrinth" ? "followers" : "likes"}</div>` : ""}
    ${dateFormatted ? `<div class="dash-metric-item"><span>📅</span> Updated <b>${E(dateFormatted)}</b></div>` : ""}
    ${licenseName ? `<div class="dash-metric-item"><span>📜</span> <b>${E(licenseName)}</b></div>` : ""}
    ${tags.slice(0, 3).map((tg) => `<div class="dash-metric-item" style="opacity:0.85">🏷️ ${E(tg)}</div>`).join("")}
  `;
}

function renderDashNav() {
  const tabs = [
    { id: "docs", label: "📖 Documentation" },
    { id: "versions", label: "⚡ Versions & Single Download" },
    { id: "gallery", label: "🖼️ Screenshots" },
    { id: "links", label: "🌐 External Links & Reviews" },
  ];

  $("dashNav").innerHTML = tabs
    .map(
      (t) =>
        `<button class="dash-tab ${t.id === currentDashTab ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`,
    )
    .join("");

  $("dashNav")
    .querySelectorAll(".dash-tab")
    .forEach((btn) => {
      btn.onclick = () => {
        currentDashTab = btn.dataset.tab;
        $("dashNav")
          .querySelectorAll(".dash-tab")
          .forEach((b) => b.classList.toggle("active", b === btn));
        renderDashTabContent();
      };
    });
}

function renderDashTabContent() {
  const container = $("dashContent");
  if (!container || !currentDashItem) return;

  if (currentDashTab === "docs") {
    let bodyContent = "";
    if (
      currentDashItem.source === "modrinth" ||
      currentDashItem.source === "minecraftmaps" ||
      currentDashItem.source === "planetminecraft" ||
      currentDashItem.tab === "modloaders" ||
      currentDashItem.tab === "serversoftwares"
    ) {
      const raw = currentDashData.body || currentDashItem.desc || "";
      bodyContent = MD(raw);
    } else {
      const rawHtml =
        currentDashData.descriptionHtml || currentDashData.summary || "";
      bodyContent = SAN(rawHtml);
    }

    if (!bodyContent.trim()) {
      bodyContent = `<p class="dash-empty-state">No official documentation provided for this resource.</p>`;
    }

    container.innerHTML = `
      <div class="dash-readme">
        ${bodyContent}
      </div>
    `;
    return;
  }

  if (currentDashTab === "versions") {
    // Extract unique game versions & loaders for filters
    const allMcVers = new Set();
    const allLoaders = new Set();

    currentDashVersions.forEach((v) => {
      (v.gameVersions || []).forEach((gv) => {
        if (/^\d+\.\d+(\.\d+)?$/.test(gv)) allMcVers.add(gv);
      });
      (v.loaders || []).forEach((l) => allLoaders.add(l.toLowerCase()));
    });

    const sortedMc = [...allMcVers].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const sortedLoaders = [...allLoaders].sort();

    const filtered = currentDashVersions.filter((v) => {
      if (dashVerFilter && !(v.gameVersions || []).includes(dashVerFilter)) return false;
      if (dashLoaderFilter && !(v.loaders || []).map((l) => l.toLowerCase()).includes(dashLoaderFilter.toLowerCase())) return false;
      return true;
    });

    container.innerHTML = `
      <div class="dash-versions-wrap">
        <div class="dash-versions-filter-bar">
          <label class="dash-filter-label">Filter Game Version:</label>
          <select class="in" id="dashVerSelect" style="padding:6px 12px;font-size:13px;">
            <option value="">All Game Versions (${currentDashVersions.length})</option>
            ${sortedMc.map((v) => `<option value="${E(v)}" ${dashVerFilter === v ? "selected" : ""}>Minecraft ${E(v)}</option>`).join("")}
          </select>

          <label class="dash-filter-label" style="margin-left:12px;">Loader:</label>
          <select class="in" id="dashLoaderSelect" style="padding:6px 12px;font-size:13px;">
            <option value="">All Loaders</option>
            ${sortedLoaders.map((l) => `<option value="${E(l)}" ${dashLoaderFilter === l ? "selected" : ""}>${E(l)}</option>`).join("")}
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
          ${
            filtered.length
              ? filtered
                  .map(
                    (v) => `
            <div class="dash-version-card">
              <div class="dash-version-info">
                <div class="dash-version-title">
                  <span>${E(v.name || v.versionNumber)}</span>
                  <span class="release-badge ${v.type}">${E(v.type)}</span>
                </div>
                <div class="dash-version-meta">
                  ${v.date ? `<span>📅 ${E(v.date)}</span>` : ""}
                  ${v.fileSize ? `<span>💾 ${E(v.fileSize)}</span>` : ""}
                  ${
                    v.gameVersions && v.gameVersions.length
                      ? `<span>🎮 ${v.gameVersions.slice(0, 4).map(E).join(", ")}${v.gameVersions.length > 4 ? "..." : ""}</span>`
                      : ""
                  }
                  ${
                    v.loaders && v.loaders.length
                      ? `<span>⚙️ ${v.loaders.map(E).join(", ")}</span>`
                      : ""
                  }
                </div>
              </div>
              <button class="btn-single-dl" data-url="${E(v.downloadUrl)}" data-fn="${E(v.fileName)}">
                ⬇ Download ${v.fileName ? E(v.fileName) : (currentDashItem.tab === "worlds" ? ".zip" : ".jar")}
              </button>
            </div>
          `,
                  )
                  .join("")
              : `<div class="dash-empty-state" style="padding:50px;">No versions match your current filters.</div>`
          }
        </div>
      </div>
    `;

    const vSel = $("dashVerSelect");
    if (vSel) {
      vSel.onchange = () => {
        dashVerFilter = vSel.value;
        renderDashTabContent();
      };
    }
    const lSel = $("dashLoaderSelect");
    if (lSel) {
      lSel.onchange = () => {
        dashLoaderFilter = lSel.value;
        renderDashTabContent();
      };
    }

    initAllGlassSelects(container);

    container.querySelectorAll(".btn-single-dl").forEach((btn) => {
      btn.onclick = () => {
        triggerDirectDownload(btn.dataset.url, btn.dataset.fn);
      };
    });
    return;
  }

  if (currentDashTab === "gallery") {
    let images = [];
    if (currentDashItem.source === "modrinth") {
      images = (currentDashData.gallery || []).map((g) => ({
        url: g.url,
        thumb: g.url,
        title: g.title || g.description || "Screenshot",
      }));
    } else {
      images = (currentDashData.screenshots || []).map((s) => ({
        url: s.url,
        thumb: s.thumbnailUrl || s.url,
        title: s.title || s.description || "Screenshot",
      }));
    }

    if (!images.length) {
      container.innerHTML = `
        <div class="dash-empty-state" style="padding: 60px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">🖼️</div>
          <div style="font-size: 16px; font-weight: 600;">No screenshots uploaded for this resource</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="dash-gallery-grid">
        ${images
          .map(
            (img) => `
          <div class="dash-gallery-card" data-url="${E(img.url)}" data-title="${E(img.title)}">
            <img src="${E(img.thumb)}" alt="${E(img.title)}" loading="lazy" />
            <div class="dash-gallery-title">${E(img.title)}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;

    container.querySelectorAll(".dash-gallery-card").forEach((card) => {
      card.onclick = () => {
        openLightbox(card.dataset.url, card.dataset.title);
      };
    });
    return;
  }

  if (currentDashTab === "links") {
    const isMr = currentDashItem.source === "modrinth";
    const links = [];

    // Official Resource Page & Reviews
    if (currentDashItem.source === "hangar") {
      links.push({
        icon: "📄",
        title: "Hangar/PaperMC Official Project",
        sub: "Official PaperMC ecosystem project page",
        url: currentDashItem.websiteUrl,
      });
      links.push({
        icon: "🌐",
        title: "PaperMC Community",
        sub: "Browse official PaperMC plugin repository",
        url: "https://hangar.papermc.io/",
      });
    } else if (currentDashItem.source === "spigotmc") {
      links.push({
        icon: "🥕",
        title: "SpigotMC Official Resource Thread",
        sub: "SpigotMC forum thread, reviews and discussions",
        url: currentDashItem.websiteUrl,
      });
      links.push({
        icon: "🌐",
        title: "SpigotMC Forums",
        sub: "Browse the SpigotMC resources community",
        url: "https://www.spigotmc.org/",
      });
    } else if (currentDashItem.source === "sponge") {
      links.push({
        icon: "🧽",
        title: "Sponge Ore Project Page",
        sub: "Official SpongePowered project page & reviews",
        url: currentDashItem.websiteUrl,
      });
      links.push({
        icon: "🌐",
        title: "SpongePowered Community",
        sub: "Explore Sponge server software & ecosystem",
        url: "https://spongepowered.org/",
      });
    } else if (currentDashItem.source === "bukkit") {
      links.push({
        icon: "🪣",
        title: "dev.bukkit.org Project Page",
        sub: "Official Bukkit Dev plugin page, reviews, and community threads",
        url: currentDashItem.websiteUrl,
      });
      links.push({
        icon: "🌐",
        title: "dev.bukkit.org Catalog",
        sub: "Browse official Bukkit Dev directory on dev.bukkit.org",
        url: "https://dev.bukkit.org/",
      });
    } else {
      links.push({
        icon: "⭐",
        title: "Official Page & User Reviews",
        sub: `View ratings, discussions and user reviews on ${currentDashItem.sourceName}`,
        url: currentDashItem.websiteUrl,
      });
    }

    const sourceUrl = isMr
      ? currentDashData.source_url
      : currentDashData.links && currentDashData.links.sourceUrl;
    if (sourceUrl) {
      links.push({
        icon: "🐙",
        title: "Source Code Repository",
        sub: "GitHub / GitLab repository source code",
        url: sourceUrl,
      });
    }

    const issuesUrl = isMr
      ? currentDashData.issues_url
      : currentDashData.links && currentDashData.links.issuesUrl;
    if (issuesUrl) {
      links.push({
        icon: "🐛",
        title: "Issue Tracker & Bug Reports",
        sub: "Report bugs, track fixes or suggest features",
        url: issuesUrl,
      });
    }

    const wikiUrl = isMr
      ? currentDashData.wiki_url
      : currentDashData.links && currentDashData.links.wikiUrl;
    if (wikiUrl) {
      links.push({
        icon: "📚",
        title: "Project Wiki & Documentation",
        sub: "Guides, tutorials, and configuration reference",
        url: wikiUrl,
      });
    }

    if (isMr && currentDashData.discord_url) {
      links.push({
        icon: "💬",
        title: "Discord Community",
        sub: "Join the author's community chat and support",
        url: currentDashData.discord_url,
      });
    }

    if (isMr && currentDashData.donation_urls && currentDashData.donation_urls.length) {
      const d = currentDashData.donation_urls[0];
      links.push({
        icon: "💖",
        title: "Donate & Support Creator",
        sub: d.platform ? `Support on ${d.platform}` : "Support the mod author",
        url: d.url,
      });
    }

    container.innerHTML = `
      <div class="dash-links-grid">
        ${links
          .map(
            (l) => `
          <a href="${E(l.url)}" target="_blank" rel="noopener" class="dash-link-card">
            <div class="dash-link-icon">${l.icon}</div>
            <div>
              <div class="dash-link-title">${E(l.title)} <span class="ext-icon" style="font-size:11px;opacity:0.7">↗</span></div>
              <div class="dash-link-sub">${E(l.sub)}</div>
            </div>
          </a>
        `,
          )
          .join("")}
      </div>
    `;
  }
}

async function openResourceDash(h, opts = {}) {
  const inline = Boolean(opts.inline);
  currentDashItem = h;
  currentDashTab = "docs";
  dashVerFilter = "";
  dashLoaderFilter = "";

  const modal = $("dashModal");
  if (!modal) return;

  if (inline && !$("standaloneResourceView")) {
    // No page host available (e.g. very old markup) — degrade to modal.
    inline = false;
  }

  if (inline) {
    dashInline = { url: window.location.pathname, tab: h.tab, slug: h.slug };
    modal.classList.add("inline");
    const host = $("standaloneResourceView");
    host.innerHTML = `
      <div class="rp-shell">
        ${rpBreadcrumb(h)}
        <div class="rp-dash-mount"></div>
      </div>`;
    const win = modal.querySelector(".dash-window");
    const mount = host.querySelector(".rp-dash-mount");
    if (win && mount && !mount.contains(win)) mount.appendChild(win);
    // The window leaves `.open` modal flow: remove modal display state so
    // backdrop/pointer-events stay inert while inline.
    modal.classList.remove("open");
  } else {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    CraftIndexScrollLock.acquire("dash");
  }

  updateBrowserTitle();
  if (inline) document.title = rpTitle(h);

  renderDashHeader(h);
  renderDashMetrics(h, null);
  renderDashNav();

  if (inline) {
    // Rebind the header close button to a real history back-navigation so the
    // browser restores the previous scroll position cleanly.
    const closeBtn = $("dashCloseBtn");
    if (closeBtn) {
      closeBtn.title = "Back";
      closeBtn.setAttribute("aria-label", "Back to " + ((T(h.tab) && T(h.tab).name) || h.tab));
      closeBtn.onclick = (e) => {
        e.preventDefault();
        rpCloseToCategory();
      };
    }
  }

  $("dashContent").innerHTML = `
    <div style="text-align: center; padding: 70px 20px;">
      <div class="cyber-spinner" style="margin: 0 auto 16px;"></div>
      <div style="font-weight: 700; color: var(--b); font-size: 15px;">Loading resource documentation & version files...</div>
    </div>
  `;

  try {
    if (h.tab === "launchers") {
      const typeLabel = h.subType === "premium" ? "Premium (Microsoft Account)" : "Cracked / Offline (Free / Custom Auth)";
      currentDashData = {
        body: `### ${h.title}\n\n${h.desc}\n\n**Official Website:** [${h.websiteUrl}](${h.websiteUrl})\n\n**Developer / Team:** ${h.author}\n\n**Category:** Minecraft Launcher (${typeLabel})\n\n**Supported Operating Systems:** ${(h.platforms || ["Windows", "macOS", "Linux"]).join(", ")}\n\n**Key Features:**\n${(h.features || []).map((f) => `- ${f}`).join("\n")}\n\n#### Installation & Setup Instructions\n1. Click **⬇ Download** above or choose from the installer downloads below.\n2. Run the downloaded installer package or executable.\n3. Follow the on-screen setup wizard to install the launcher to your preferred directory.\n4. Launch **${h.title}**, add your ${h.subType === "premium" ? "Microsoft Account" : "Username or Offline Account"}, choose your desired Minecraft version or modpack, and start playing!`,
        license: h.subType === "premium" ? "Official / Open Source / Commercial" : "Open Source / Community Free",
        source_url: h.websiteUrl,
        updated: new Date().toISOString(),
      };
      currentDashVersions = [
        {
          id: "launcher-setup",
          name: h.title + " Official Setup / Installer",
          versionNumber: h.ver || "Latest",
          type: "release",
          gameVersions: ["All Minecraft Versions (1.0 - 1.21+)"],
          loaders: ["Vanilla", "Fabric", "Forge", "NeoForge", "Quilt"],
          date: "Latest Release",
          downloads: h.dl || 5000000,
          fileName:
            decodeURIComponent((h.url || "").split("/").pop().split("?")[0]) ||
            h.slug + "-setup.exe",
          fileSize: "Executable / Installer",
          downloadUrl: h.url,
        },
      ];
      renderDashMetrics(h, currentDashData);
      renderDashTabContent();
      return;
    }
    if (h.tab === "modloaders" || h.tab === "serversoftwares") {
      currentDashData = {
        body: `### ${h.title}\n\n${h.desc}\n\n**Official Website:** [${h.websiteUrl}](${h.websiteUrl})\n\n**Developer / Maintainer:** ${h.author}\n\n**Category:** ${getCatLabel(h.tab)}\n\n#### Installation Instructions\n1. Click **⬇ Download** on the top right or the installer list below.\n2. Run the downloaded installer file (double-click the \`.jar\` file or execute \`java -jar <filename>.jar\` in terminal).\n3. Choose **Install Client** (or **Install Server** for multiplayer) and click **OK**.\n4. Open your Minecraft Launcher, choose the **${h.title}** profile, and enjoy modding!`,
        license: "Official / Open Source",
        source_url: h.websiteUrl,
        updated: new Date().toISOString(),
      };
      currentDashVersions = [
        {
          id: "installer",
          name: h.title + " Official Installer",
          versionNumber: h.ver || "Universal",
          type: "release",
          gameVersions: h.supportedVersions || ["All Supported Versions"],
          loaders: [h.id],
          date: "Latest Release",
          downloads: h.dl || 1000000,
          fileName:
            decodeURIComponent((h.url || "").split("/").pop().split("?")[0]) ||
            h.slug + "-installer.jar",
          fileSize: "Universal .jar",
          downloadUrl: h.url,
        },
      ];
      renderDashMetrics(h, currentDashData);
      renderDashTabContent();
      return;
    }
    if (h.source === "minecraftmaps" || h.source === "planetminecraft") {
      const platformName = h.source === "minecraftmaps" ? "MinecraftMaps" : "PlanetMinecraft";
      currentDashData = {
        body: `### ${h.title}\n\n${h.desc}\n\n**Official Map Page:** [${h.websiteUrl}](${h.websiteUrl})\n\n**Creator / Architect:** ${h.author}\n\n**Source:** ${platformName}\n\n**Category:** Minecraft World / Map\n\n#### Installation Instructions\n1. Download the World \`.zip\` archive by clicking **⬇ Download** above or from the version list below.\n2. Extract the \`.zip\` file.\n3. Move the unzipped world folder into your Minecraft \`saves/\` directory (\`%appdata%\\.minecraft\\saves\` on Windows, or \`~/.minecraft/saves\` on macOS/Linux).\n4. Launch Minecraft, click **Singleplayer**, and load into your newly installed world!`,
        license: `${platformName} Community Map`,
        source_url: h.websiteUrl,
        updated: new Date().toISOString(),
      };
      currentDashVersions = [
        {
          id: "world-zip",
          name: h.title + " (World Save Archive)",
          versionNumber: h.ver || "World Save",
          type: "release",
          gameVersions: h.supportedVersions || ["All Minecraft Versions"],
          loaders: ["Vanilla", "Fabric", "Forge", "Paper", "Spigot"],
          date: "Latest Release",
          downloads: h.dl || 1000000,
          fileName:
            decodeURIComponent((h.url || "").split("/").pop().split("?")[0]) ||
            h.slug + ".zip",
          fileSize: "World Archive .zip",
          downloadUrl: h.url,
        },
      ];
      renderDashMetrics(h, currentDashData);
      renderDashTabContent();
      return;
    }
    if (h.source === "modrinth") {
      const [proj, vers] = await Promise.all([
        api("/project/" + h.id),
        api("/project/" + h.id + "/version"),
      ]);
      currentDashData = proj;
      currentDashVersions = (vers || []).map((v) => {
        const file = pf(v);
        return {
          id: v.id,
          name: v.name || v.version_number,
          versionNumber: v.version_number,
          type: v.version_type || "release",
          gameVersions: v.game_versions || [],
          loaders: v.loaders || [],
          date: v.date_published
            ? new Date(v.date_published).toLocaleDateString()
            : "",
          downloads: v.downloads,
          fileName: file ? file.filename : "",
          fileSize: file ? formatBytes(file.size) : "",
          downloadUrl: file ? file.url : "",
        };
      });
      renderDashMetrics(h, proj);
      renderDashTabContent();
    } else if (h.source === "hangar") {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/hangar"
        : "https://hangar.papermc.io/api/v1";
      const [proj, vers] = await Promise.all([
        fetch(baseUrl + "/projects/" + encodeURIComponent(h.id)).then((r) => r.json()),
        fetch(baseUrl + "/projects/" + encodeURIComponent(h.id) + "/versions?limit=50").then((r) => r.json()),
      ]);
      currentDashData = proj;
      currentDashVersions = (vers.result || []).map((v) => {
        const plat = Object.keys(v.downloads || {})[0];
        const dlInfo = plat && v.downloads[plat];
        const fileInfo = dlInfo ? dlInfo.fileInfo : null;
        return {
          id: v.id || v.name,
          name: v.name,
          versionNumber: v.name,
          type: "release",
          gameVersions: (v.platformDependenciesFormatted && v.platformDependenciesFormatted[plat]) || [],
          loaders: Object.keys(v.platformDependenciesFormatted || {}).map((p) => p.toLowerCase()),
          date: v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "",
          downloads: v.stats ? v.stats.totalDownloads : 0,
          fileName: fileInfo ? fileInfo.name : v.name + ".jar",
          fileSize: fileInfo ? formatBytes(fileInfo.sizeBytes) : "",
          downloadUrl: dlInfo ? (dlInfo.downloadUrl || dlInfo.externalUrl) : "",
        };
      });
      renderDashMetrics(h, {
        downloads: proj.stats ? proj.stats.downloads : h.dl,
        followers: proj.stats ? proj.stats.stars : h.fo,
        updated: proj.lastUpdated || proj.createdAt,
        license: proj.settings ? proj.settings.license : null,
      });
      renderDashTabContent();
    } else if (h.source === "spigotmc") {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/spiget"
        : "https://api.spiget.org/v2";
      const [res, vers] = await Promise.all([
        fetch(baseUrl + "/resources/" + h.id).then((r) => r.json()),
        fetch(baseUrl + "/resources/" + h.id + "/versions?size=50").then((r) => r.json()),
      ]);
      let descHtml = res.tag || "";
      if (res.description) {
        try {
          descHtml = atob(res.description);
        } catch (e) {
          descHtml = res.description;
        }
      }
      currentDashData = {
        ...res,
        descriptionHtml: descHtml,
      };
      currentDashVersions = (Array.isArray(vers) ? vers : []).map((v) => ({
        id: v.id || v.name,
        name: v.name || "Version " + v.id,
        versionNumber: v.name || String(v.id),
        type: "release",
        gameVersions: res.testedVersions || [],
        loaders: ["spigot", "paper", "bukkit"],
        date: v.releaseDate ? new Date(v.releaseDate * 1000).toLocaleDateString() : "",
        downloads: v.downloads || 0,
        fileName: h.title + ".jar",
        fileSize: "",
        downloadUrl: `${baseUrl}/resources/${h.id}/download`,
      }));
      renderDashMetrics(h, {
        downloads: res.downloads || h.dl,
        followers: res.rating ? res.rating.count : h.fo,
        updated: res.updateDate ? res.updateDate * 1000 : null,
      });
      renderDashTabContent();
    } else if (h.source === "sponge") {
      const [proj, vers] = await Promise.all([
        fetch("/api/sponge/projects/" + encodeURIComponent(h.id)).then((r) => r.json()),
        fetch("/api/sponge/projects/" + encodeURIComponent(h.id) + "/versions?limit=50").then((r) => r.json()),
      ]);
      currentDashData = {
        ...proj,
        descriptionHtml: `<p>${E(proj.description || "")}</p>`,
      };
      currentDashVersions = (vers.result || []).map((v) => ({
        id: v.name,
        name: v.name,
        versionNumber: v.name,
        type: "release",
        gameVersions: [],
        loaders: ["sponge"],
        date: v.created_at ? new Date(v.created_at).toLocaleDateString() : "",
        downloads: v.stats ? v.stats.downloads : 0,
        fileName: h.title + "-" + v.name + ".jar",
        fileSize: v.file_info ? formatBytes(v.file_info.size_bytes) : "",
        downloadUrl: `https://ore.spongepowered.org/api/v2/projects/${h.id}/versions/${v.name}/download`,
      }));
      renderDashMetrics(h, {
        downloads: proj.stats ? proj.stats.downloads : h.dl,
        followers: proj.stats ? proj.stats.stars : h.fo,
        updated: proj.last_updated || proj.created_at,
        license: proj.settings ? proj.settings.license : null,
      });
      renderDashTabContent();
    } else if (h.source === "polymart") {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/polymart"
        : "https://api.polymart.org/v1";
      const infoRes = await fetch(baseUrl + "/getResourceInfo?resource_id=" + encodeURIComponent(h.id)).then((r) => r.json());
      const res = (infoRes.response && infoRes.response.resource) || {};
      const updates = res.updates || {};
      const latestUpdate = updates.latest || {};
      const descHtml = latestUpdate.description || res.description || `<p>${E(h.desc || res.subtitle || "")}</p>`;
      currentDashData = {
        ...res,
        descriptionHtml: descHtml,
      };
      const latestVer = latestUpdate.version || res.version || "1.0.0";
      currentDashVersions = [{
        id: latestUpdate.id || h.id,
        name: latestUpdate.title || `Version ${latestVer}`,
        versionNumber: latestVer,
        type: "release",
        gameVersions: (res.supportedMinecraftVersions || "").split(",").map((s) => s.trim()).filter(Boolean),
        loaders: ["paper", "spigot", "bukkit", "purpur"],
        date: latestUpdate.time ? new Date(latestUpdate.time * 1000).toLocaleDateString() : "",
        downloads: res.downloads || h.dl || 0,
        fileName: h.title.replace(/[^a-zA-Z0-9._-]/g, "_") + ".jar",
        fileSize: "",
        downloadUrl: `https://api.polymart.org/v1/download?resource_id=${h.id}`,
      }];
      renderDashMetrics(h, {
        downloads: res.downloads || h.dl,
        followers: h.fo || 0,
        updated: latestUpdate.time ? latestUpdate.time * 1000 : null,
      });
      renderDashTabContent();
    } else if (h.source === "smithed") {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/smithed"
        : "https://api.smithed.dev/v2";
      const pack = await fetch(baseUrl + "/packs/" + encodeURIComponent(h.id)).then((r) => r.json());
      const disp = pack.display || {};
      currentDashData = {
        ...pack,
        descriptionHtml: `<p style="font-size:15px;line-height:1.7;">${E(disp.description || h.desc || "")}</p>`,
      };
      currentDashVersions = (pack.versions || []).map((v) => {
        const dlUrl = v.downloads && (v.downloads.datapack || v.downloads.resourcepack);
        return {
          id: v.name,
          name: v.name,
          versionNumber: v.name,
          type: "release",
          gameVersions: v.supports || [],
          loaders: ["datapack"],
          date: "",
          downloads: 0,
          fileName: `${h.title.replace(/[^a-zA-Z0-9._-]/g, "_")}-${v.name}.zip`,
          fileSize: "",
          downloadUrl: dlUrl || "",
        };
      });
      renderDashMetrics(h, {
        downloads: h.dl || 0,
        followers: h.fo || 0,
        updated: null,
      });
      renderDashTabContent();
    } else if (h.source === "github") {
      const baseUrl = window.location.protocol.startsWith("http")
        ? "/api/github"
        : "https://api.github.com";
      const [repoData, relsData] = await Promise.all([
        fetch(`${baseUrl}/repos/${h.id}`, { headers: { Accept: "application/vnd.github.v3+json" } }).then((r) => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/repos/${h.id}/releases?per_page=15`, { headers: { Accept: "application/vnd.github.v3+json" } }).then((r) => r.json()).catch(() => []),
      ]);
      const repo = repoData || {};
      const rels = Array.isArray(relsData) ? relsData : [];
      currentDashData = {
        ...repo,
        descriptionHtml: `<p style="font-size:15px;line-height:1.7;">${E(repo.description || h.desc || "")}</p><p style="margin-top:14px;"><a href="${E(repo.html_url || h.websiteUrl)}" target="_blank" rel="noopener" style="color:var(--b);font-weight:700;text-decoration:none;">🔗 View Repository on GitHub ↗</a></p>`,
      };
      const allVers = [];
      rels.forEach((rel) => {
        const assets = rel.assets || [];
        assets.forEach((asset) => {
          allVers.push({
            id: String(asset.id || rel.tag_name),
            name: `${rel.name || rel.tag_name} (${asset.name})`,
            versionNumber: rel.tag_name || "1.0.0",
            type: rel.prerelease ? "beta" : "release",
            gameVersions: [],
            loaders: [h.tab],
            date: rel.published_at ? new Date(rel.published_at).toLocaleDateString() : "",
            downloads: asset.download_count || 0,
            fileName: asset.name,
            fileSize: asset.size ? formatBytes(asset.size) : "",
            downloadUrl: asset.browser_download_url,
          });
        });
      });
      if (allVers.length === 0) {
        allVers.push({
          id: repo.default_branch || "main",
          name: `${h.title} (Source Code .zip)`,
          versionNumber: repo.default_branch || "main",
          type: "release",
          gameVersions: [],
          loaders: [h.tab],
          date: repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "",
          downloads: repo.stargazers_count || 0,
          fileName: `${h.title}.zip`,
          fileSize: "",
          downloadUrl: `https://github.com/${h.id}/archive/refs/heads/${repo.default_branch || "main"}.zip`,
        });
      }
      currentDashVersions = allVers;
      renderDashMetrics(h, {
        downloads: repo.stargazers_count || h.dl,
        followers: repo.forks_count || h.fo,
        updated: repo.updated_at || null,
        license: repo.license ? repo.license.name : null,
      });
      renderDashTabContent();
    } else {
      // CurseForge / Bukkit
      const [modData, descData, filesData] = await Promise.all([
        cfa("/v1/mods/" + h.id),
        cfa("/v1/mods/" + h.id + "/description"),
        cfa("/v1/mods/" + h.id + "/files?pageSize=50"),
      ]);
      const mod = modData.data || {};
      currentDashData = {
        ...mod,
        descriptionHtml: descData.data || mod.summary || "",
      };
      const catSlug =
        h.tab === "mods"
          ? "mc-mods"
          : h.tab === "resourcepacks"
            ? "texture-packs"
            : h.tab === "shaders"
              ? "shaders"
              : h.tab === "datapacks"
                ? "data-packs"
                : h.tab === "modpacks"
                  ? "modpacks"
                  : h.tab === "worlds"
                    ? "worlds"
                    : h.tab === "serversoftwares"
                      ? "mc-mods"
                      : h.tab === "modloaders"
                        ? "mc-mods"
                        : "bukkit-plugins";

      currentDashVersions = (filesData.data || []).map((f) => {
        const typeMap = { 1: "release", 2: "beta", 3: "alpha" };
        const gVers = (f.gameVersions || []).filter(
          (v) =>
            /^\d+\.\d+(\.\d+)?$/.test(v) ||
            ["Fabric", "Forge", "NeoForge", "Quilt", "Paper", "Spigot", "Purpur", "Folia", "Bukkit"].includes(v),
        );
        const dlUrl =
          f.downloadUrl ||
          (h.source === "bukkit"
            ? `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${f.fileName}`
            : mod.slug
              ? `https://www.curseforge.com/minecraft/${catSlug}/${mod.slug}/download/${f.id}`
              : `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${f.fileName}`);

        return {
          id: f.id,
          name: f.displayName || f.fileName,
          versionNumber: f.displayName || f.fileName,
          type: typeMap[f.releaseType] || "release",
          gameVersions: gVers,
          loaders: (f.gameVersions || []).filter((v) =>
            ["Fabric", "Forge", "NeoForge", "Quilt"].includes(v),
          ),
          date: f.fileDate ? new Date(f.fileDate).toLocaleDateString() : "",
          downloads: f.downloadCount,
          fileName: f.fileName,
          fileSize: formatBytes(f.fileLength),
          downloadUrl: dlUrl,
        };
      });
      renderDashMetrics(h, mod);
      renderDashTabContent();
    }
  } catch (err) {
    console.error("Failed to load resource dashboard:", err);
    $("dashContent").innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
        <div style="font-weight: 700; color: var(--red); font-size: 16px;">Failed to load resource details</div>
        <p style="color: rgba(232, 224, 245, 0.7); max-width: 500px; margin: 8px auto 20px;">${E(err.message)}</p>
        <a href="${E(h.websiteUrl)}" target="_blank" rel="noopener" class="btn p">Open on Official ${E(h.sourceName)} Site ↗</a>
      </div>
    `;
  }
}

// Lightbox & Modal Click Listeners
if ($("dashBackdrop")) $("dashBackdrop").onclick = closeDashModal;
if ($("dashLightboxBackdrop")) $("dashLightboxBackdrop").onclick = closeLightbox;
if ($("dashLightboxClose")) $("dashLightboxClose").onclick = closeLightbox;

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const socialsModal = $("socialsModal");
    const aboutModal = $("aboutModal");
    if (socialsModal && socialsModal.classList.contains("open")) {
      closeSocialsModal();
    } else if (aboutModal && aboutModal.classList.contains("open")) {
      closeAboutModal();
    } else if ($("dashLightbox") && $("dashLightbox").classList.contains("open")) {
      closeLightbox();
    } else if ($("dashModal") && $("dashModal").classList.contains("open")) {
      closeDashModal();
    } else if ($("dashModal") && $("dashModal").classList.contains("inline") && typeof rpCloseToCategory === "function") {
      // Inline resource page: Escape goes back like the header ✕ button does.
      rpCloseToCategory();
    }
  }
});

/* ========================================================
   FUTURISTIC GLASS SELECT DROPDOWN COMPONENT ENGINE
   ======================================================== */
function initGlassSelect(sel) {
  if (!sel) return;
  if (sel.dataset.glassInited) {
    const existing = sel.id
      ? document.querySelector(`.glass-select-wrap[data-for="${sel.id}"]`)
      : sel.nextElementSibling && sel.nextElementSibling.classList.contains("glass-select-wrap")
        ? sel.nextElementSibling
        : null;
    if (existing && existing._sync) existing._sync();
    return;
  }
  sel.dataset.glassInited = "1";
  sel.classList.add("glass-replaced");
  sel.hidden = true;
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");

  // Always hide the native select permanently
  sel.style.setProperty("display", "none", "important");
  sel.style.setProperty("visibility", "hidden", "important");
  sel.style.setProperty("position", "absolute", "important");
  sel.style.setProperty("width", "0", "important");
  sel.style.setProperty("height", "0", "important");
  sel.style.setProperty("opacity", "0", "important");
  sel.style.setProperty("pointer-events", "none", "important");

  const wrap = document.createElement("div");
  wrap.className = "glass-select-wrap";
  if (sel.id) wrap.dataset.for = sel.id;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "glass-select-trigger in";

  const label = document.createElement("span");
  label.className = "glass-select-label";

  const arrow = document.createElement("span");
  arrow.className = "glass-select-arrow";
  arrow.innerHTML = `<svg viewBox="0 0 10 6" width="10" height="6"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

  trigger.appendChild(label);
  trigger.appendChild(arrow);

  const menu = document.createElement("div");
  menu.className = "glass-select-menu";

  wrap.appendChild(trigger);
  wrap.appendChild(menu);

  sel.parentNode.insertBefore(wrap, sel.nextSibling);

  function syncFromSelect() {
    menu.innerHTML = "";
    const options = [...sel.options];
    let selectedText = "";

    options.forEach((opt, idx) => {
      const isSelected =
        opt.selected || opt.value === sel.value || (idx === 0 && !sel.value);
      if (isSelected && !selectedText) {
        selectedText = opt.text || opt.value;
      }

      const item = document.createElement("div");
      item.className = "glass-select-option" + (isSelected ? " selected" : "");
      item.textContent = opt.text || opt.value;
      item.dataset.value = opt.value;

      item.onclick = (e) => {
        e.stopPropagation();
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        justPicked = true;
        closeMenu();
        syncFromSelect();
        setTimeout(() => {
          justPicked = false;
        }, 300);
      };

      menu.appendChild(item);
    });

    label.textContent = selectedText || (options[0] ? options[0].text : "");
    if (sel.dataset.visible === "0") {
      wrap.style.display = "none";
    } else if (sel.dataset.visible === "1") {
      wrap.style.display = "";
    }
  }

  wrap._sync = syncFromSelect;

  let closeTimer = null;
  let justPicked = false;

  function openMenu() {
    if (justPicked) return;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    document
      .querySelectorAll(".glass-select-menu.open")
      .forEach((m) => {
        if (m !== menu) m.classList.remove("open");
      });
    document
      .querySelectorAll(".glass-select-trigger.active")
      .forEach((t) => {
        if (t !== trigger) t.classList.remove("active");
      });
    document
      .querySelectorAll(".glass-select-wrap.open")
      .forEach((w) => {
        if (w !== wrap) w.classList.remove("open");
      });

    menu.classList.add("open");
    trigger.classList.add("active");
    wrap.classList.add("open");
  }

  function scheduleClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      closeMenu();
    }, 240);
  }

  function closeMenu() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    menu.classList.remove("open");
    trigger.classList.remove("active");
    wrap.classList.remove("open");
  }

  function toggleMenu(e) {
    if (e) e.stopPropagation();
    if (menu.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // Hover to reveal options immediately
  wrap.addEventListener("mouseenter", () => {
    openMenu();
  });

  wrap.addEventListener("mouseleave", (e) => {
    const related = e.relatedTarget;
    // If moving directly to another select, search box, or tabs, close immediately!
    if (related && related.closest && (related.closest(".glass-select-wrap") || related.closest(".sb") || related.closest("#tabs") || related.closest(".tb-wrapper"))) {
      closeMenu();
      return;
    }
    scheduleClose();
  });

  trigger.onclick = toggleMenu;

  syncFromSelect();

  const observer = new MutationObserver(() => {
    syncFromSelect();
  });

  observer.observe(sel, { childList: true, subtree: true });
  sel.addEventListener("change", syncFromSelect);
}

function initAllGlassSelects(container) {
  const root = container || document;
  root.querySelectorAll("select.in:not(.src-perm-dropdown), select:not(.src-perm-dropdown)").forEach((sel) => {
    if (!sel.closest(".glass-select-wrap") && !sel.dataset.glassInited) {
      initGlassSelect(sel);
    }
  });

  const flBar = document.querySelector(".fl");
  if (flBar && !flBar.dataset.leaveGuarded) {
    flBar.dataset.leaveGuarded = "1";
    flBar.addEventListener("mouseleave", () => {
      document.querySelectorAll(".glass-select-menu.open").forEach((m) => m.classList.remove("open"));
      document.querySelectorAll(".glass-select-trigger.active").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".glass-select-wrap.open").forEach((w) => w.classList.remove("open"));
    });
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".glass-select-wrap")) {
    document
      .querySelectorAll(".glass-select-menu.open")
      .forEach((m) => m.classList.remove("open"));
    document
      .querySelectorAll(".glass-select-trigger.active")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".glass-select-wrap.open")
      .forEach((w) => w.classList.remove("open"));
  }
});

// SPA Internal Link Interceptor for clean client-side routing
document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("http:") || href.startsWith("https:") || href.startsWith("//") || a.target === "_blank" || href.startsWith("mailto:") || href.startsWith("javascript:")) return;
  if (a.id === "lg" || a.classList.contains("lg")) {
    e.preventDefault();
    if (window.location.protocol === "file:") {
      if (typeof switchTab === "function" && typeof T === "function") {
        switchTab(T("home"), true);
      }
    } else {
      window.history.pushState({}, "", "/");
      handleRouteFromUrl(false);
    }
    return;
  }
  if (href.startsWith("/")) {
    if (window.location.protocol === "file:") return;
    e.preventDefault();
    window.history.pushState({}, "", href);
    handleRouteFromUrl(false);
  }
});

initAllGlassSelects();
