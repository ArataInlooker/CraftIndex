# CraftIndex Engineering & Agent Operating Standards

**Product:** CraftIndex  
**Authoritative Maintainer:** Arata Inlooker ([aratainlooker@gmail.com](mailto:aratainlooker@gmail.com))  
**Repository:** [https://github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)  
**Primary Domain:** [https://craftindex.inlooker.top](https://craftindex.inlooker.top)  
**Specification Version:** 2.6.1
**Status:** Mandatory Operating Standard for Human Developers & AI Agents

---

## 1. Project Overview & Mission

CraftIndex is an ultra-fast, client-centric Minecraft resource discovery engine, Pack Studio, and multi-resource bulk packager. It integrates catalog APIs across Modrinth, CurseForge, PlanetMinecraft, and community sources, empowering players and server administrators to discover, curate, inspect, and package mods, plugins, resource packs, shaders, and datapacks into clean, standard-compliant archives with automatic dependency resolution.

---

## 2. Technology Stack & Runtime Environment

- **Frontend Core:** Vanilla ECMAScript 2022+ (Native ES Classes, Async/Await, Web Crypto, IndexedDB API, Fetch API, DOM Level 3). Zero heavy frontend frameworks (no React, Vue, Angular, or Svelte overhead).
- **Client Bundling & Packaging:** JSZip v3.10.1 (bundled locally in `js/vendor/jszip.min.js`).
- **Styling Architecture:** Modern pure CSS3 with native CSS Custom Properties, CSS Grid, Flexbox, and CSS `@media` responsive queries. No CSS-in-JS runtimes or Sass dependencies.
- **Backend / Development Server:** Node.js v18+ (tested through v27+), using native `http`, `https`, `zlib`, `crypto`, `fs`, and `path`.
- **Standalone Distribution Compiler:** Single-file offline bundler (`sync_standalone.js`) producing `dist/index.standalone.html`.
- **Testing & Verification Harness:** Headless Google Chrome automation over Chrome DevTools Protocol (`scratch/cdp_browser.js`).

---

## 3. Repository Structure & Entry Points

```text
REA/
├── index.html                   # Primary application entry point & SPA HTML host
├── server.js                    # Production Node.js server, API proxy, and asset router
├── sync_standalone.js           # Single-file standalone HTML distribution compiler
├── config.json                  # Authoritative default application configuration
├── package.json                 # Project manifest & metadata
├── README.md                    # Public developer & project documentation
├── DESIGN.md                    # Authoritative design system & visual specification
├── AGENTS.md                    # Mandatory engineering standards for agents (this file)
├── ultimate_prompt_work_report.txt # Single authoritative audit report & test ledger
├── sitemap.xml                  # Canonical XML sitemap (18 routes)
├── robots.txt                   # Search crawler directives
├── _redirects                   # Cloudflare Pages / Netlify SPA rewrite configuration
├── css/
│   └── styles.css               # Central stylesheet (layout, typography, components)
├── js/
│   ├── app.js                   # Main application controller, search, UI state, routing
│   ├── pack_studio.js           # Pack Studio engine, binary IndexedDB, ZIP parser/exporter
│   ├── about_docs.js            # Official CraftIndex documentation & modal content
│   └── vendor/
│       └── jszip.min.js         # Localized JSZip library for client-side packaging
├── fonts/
│   └── inter/                   # Localized Inter font files (woff2)
├── images/                      # Official brand logos, favicons, and social previews
│   ├── craftindex-logo.png      # Authoritative official CraftIndex logo
│   └── bigger-image.png         # Authoritative social preview banner (1672x941)
├── dist/
│   └── index.standalone.html    # Standalone offline-capable single-file distribution
└── scratch/                     # Internal test harnesses and automation drivers
```

---

## 4. Architectural Entry Points & Component Responsibilities

1. **`index.html`:** The HTML host. Houses SEO meta tags, Open Graph, Twitter cards, JSON-LD schemas, ambient video player, header, drawer containers, modal dialogs, and the inline configuration script (`#cfg`).
2. **`server.js`:**
   - Serves static assets with strict Gzip compression and multi-tier Cache-Control headers.
   - Enforces clean SPA routing for valid paths (`/mods/`, `/plugins/`, `/studio/`, `/docs/`, etc.) while strictly returning HTTP 404 for non-existent resources.
   - Houses the `/api/fetch` proxy with a strict domain whitelist to prevent Server-Side Request Forgery (SSRF).
   - Enforces directory traversal protection and modern security headers (CSP, nosniff, SAMEORIGIN).
3. **`js/app.js`:**
   - Manages state: active search query, selected category tab, mod loader filters, pagination, and collection cart.
   - Manages routing via HTML5 History API (`pushState` and `popstate`).
   - Renders resource cards, category landing grids, settings modal, and cart drawer.
   - Exposes critical window globals (`window.cart`, `window.sv`, `window.upd`, `window.draw`).
4. **`js/pack_studio.js`:**
   - Manages client-side binary persistence using IndexedDB (`CraftIndexDB`).
   - Implements recursive ZIP inspection for mods, plugins, resource packs, shaders, and datapacks.
   - Builds and extracts `craftindex_manifest.json` (schema 1.1.0).
   - Exports collection archives with standardized directory structures (`mods/`, `resourcepacks/`, `plugins/`, etc.).
5. **`js/about_docs.js`:**
   - Authoritative source for documentation articles rendered in the About Center modal.

---

## 5. Storage Architecture & Schemas

### 5.1 LocalStorage Schema
All localStorage keys must follow the standardized `cv_` prefix:
- `cv_cart`: JSON array of collection items currently queued.
- `cv_hist`: JSON array of previously searched terms or visited resources.
- `cv_source_prefs`: User source prioritization (Modrinth vs CurseForge).
- `cv_mode`: Theme preference (`"dark"` or `"light"`).
- `cv_ambient_video`: Ambient video background toggle (`"on"` or `"off"`).
- `cv_pack_name`: Custom pack name used during Pack Studio exports.
- `cv_pack_desc`: Custom pack description used during Pack Studio exports.

### 5.2 IndexedDB Schema (`CraftIndexDB`)
- **Database Name:** `CraftIndexDB` (Version: `1`)
- **Object Store:** `binaries`
- **Primary Key:** `id` (String, e.g. `jar_164bc2a9...` or `cv_90f28b...`)
- **Stored Record Interface:**
  ```typescript
  interface StoredBinary {
    id: string;               // Unique content-addressed identifier
    name: string;             // File name (e.g. "iris-1.7.0.jar")
    category: string;         // 'mods' | 'plugins' | 'resourcepacks' | 'shaders' | 'datapacks'
    loader: string;           // 'Fabric' | 'Forge' | 'NeoForge' | 'Paper' | etc.
    hash: string;             // SHA-256 hexadecimal string of raw bytes
    size: number;             // Byte length
    mime: string;             // MIME type
    blob: Blob;               // Raw binary Blob stored directly in database
    timestamp: number;        // Epoch timestamp
    metadata?: object;        // Parsed manifest data (fabric.mod.json, pack.mcmeta)
  }
  ```

---

## 6. Coding & Engineering Conventions

1. **Inspect Before Modifying:** Always inspect existing functions, styles, and configurations before writing new code. Never assume how a function works from memory.
2. **Reuse Existing Utilities:**
   - Use `$(id)` for `document.getElementById`.
   - Use `E(str)` for HTML escaping.
   - Use `window.CraftIndexStudio.calculateSha256(arrayBuffer)` for SHA-256 calculation.
   - Use `window.sv()` to save cart state to localStorage.
   - Use `window.upd()` to update cart badge counters.
3. **No Unnecessary Dependencies:** Never add third-party npm packages to `package.json` for client features that can be achieved with standard web APIs.
4. **Clean Variable Scoping:** Never leak variables to global `window` unless explicitly required for cross-module coordination (e.g. `window.cart`).
5. **Defensive DOM Operations:** Always verify DOM elements exist before attaching listeners or mutating attributes.

---

## 7. Mandatory Agent Operating Rules

Any AI Agent working on CraftIndex **MUST** strictly adhere to the following rules:

1. **Preserve Authoritative Branding & Preview Images:**
   - Do NOT modify, delete, resize, or overwrite `images/bigger-image.png`. Its authoritative CraftIndex SHA-256 hash is:
     `5DE0A67F6066D1C0FA5C2D538E5904260BD5E802124FB2BD1D9D5E44EADCC3CC` (rebranded "CraftIndex" wordmark on authentic artwork, 1672×941). Legacy CraftVault hash was: `103C47C4FA907D82EB78380F6E6F2FE3805BEB280060F3C6DE26550B389B53BD`.
   - Do NOT modify `images/craftindex-logo.png`.
2. **Zero Unauthorized Git Commands:**
   - Do NOT run `git init`, `git commit`, `git push`, or deploy commands unless explicitly instructed by the user.
3. **Preserve User Data & Working Architecture:**
   - Do NOT rebuild working components from scratch.
   - Do NOT delete existing user data or wipe storage profiles without explicit consent.
4. **No Hallucinated Testing:**
   - Never report synthetic or fabricated test results. All verification must be performed using executable scripts in `scratch/` and real Chrome browser instances.
5. **Single Source of Truth Work Report:**
   - Keep `ultimate_prompt_work_report.txt` as the single authoritative work ledger. Always append or update it rather than creating separate disjoint reports.
6. **Synchronize Standalone Distribution:**
   - Whenever changes are made to `index.html`, `css/styles.css`, `js/app.js`, `js/pack_studio.js`, or `js/about_docs.js`, always run `node sync_standalone.js` and verify `dist/index.standalone.html`.

---

## 8. Build, Test & Verification Procedures

### 8.1 Standalone Distribution Compilation
```bash
node sync_standalone.js
```
*Expected Output:* `✅ dist/index.standalone.html synchronized successfully! File size: ~644 KB`.

### 8.2 Persistent Binary Storage Audit
```bash
node scratch/verify_binary_persistence_real_browser.js
```
*Verification criteria:* Confirms IndexedDB stores raw binary Blobs and survives in-browser reload as well as complete Chrome process termination and profile relaunch with 100% cryptographic SHA-256 identity.

### 8.3 ZIP Round-Trip Verification
```bash
node scratch/verify_zip_roundtrip_app.js
```
*Verification criteria:* Exports collection ZIP, verifies `craftindex_manifest.json` and directory structure with external JSZip, clears state, re-imports, and confirms 100% hash match.

### 8.4 Clean Browser Routing Verification
```bash
node scratch/verify_browser_routing.js
```
*Verification criteria:* Confirms all 14 routes load correctly in Chrome, history back/forward functions cleanly, hard refresh retains state, and invalid paths return HTTP 404.
