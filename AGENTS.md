# CraftIndex — Agent Operating Standards (AGENTS.md)

**Product:** CraftIndex  
**Authoritative Maintainer:** Arata Inlooker ([aratainlooker@gmail.com](mailto:aratainlooker@gmail.com) / [https://inlooker.top](https://inlooker.top))  
**Repository:** [https://github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)  
**Primary Domain:** [https://craftindex.inlooker.top](https://craftindex.inlooker.top)  
**Specification Version:** 2.6.1  
**Status:** Mandatory Operating Standard for Human Developers & AI Agents  
**Last Updated:** 2026-11-10

---

## 0. Mandatory Instructions for AI Agents (READ FIRST)

Any AI Agent working on CraftIndex **MUST** strictly adhere to the following rules. These rules supersede all other sections when there is a conflict.

1. **Read `docs/AI_CONTEXT.md` before making any changes.** This document is the single source of truth for project memory, architecture, and conventions. It contains verified facts, confirmed decisions, outstanding tasks, and known defects. Treat it as project context, not unquestionable truth — always verify against the actual repository.

2. **Inspect the actual repository before relying on historical notes.** The repository is the source of truth. Historical reports, prior session notes, and this file may be outdated. Always verify current file contents, git status, and test results before making changes.

3. **Preserve all existing functionality and user data.** Do not rebuild working components from scratch. Do not delete or reset IndexedDB (`CraftIndexDB`) or LocalStorage (`cv_*` keys) data without explicit user consent.

4. **Preserve the vanilla JavaScript, HTML, and CSS architecture.** Do not introduce React, Vue, Angular, Svelte, Tailwind runtime, or similar dependencies. Do not add unnecessary npm packages to `package.json` for client features achievable with standard web APIs.

5. **Do not rewrite working functionality just to make it look different.** Refactor only when there is a demonstrated defect or performance issue.

6. **Do not weaken security, validation, provider protections, or resource URL handling.** The `functions/api/fetch.js` proxy uses a strict domain whitelist. Do not weaken or bypass it.

7. **Do not introduce code that exposes or logs secrets and keys.** Never commit secrets, API keys, or environment variables to the repository.

8. **Do not force-push or rewrite Git history.** Do not create empty commits.

9. **Do not commit, push, or deploy without explicit authorization.** Local commits are permitted only when explicitly requested by the user.

10. **Never claim a task is complete without verification.** Every change must be verified by running the appropriate test suite (`npm test`) and confirming the specific behavior works.

11. **Update `docs/AI_CONTEXT.md` when making changes.** Whenever an architectural decision, feature addition, bug fix, or workflow change occurs, update the project memory document accordingly.

12. **Never silently reintroduce previously rejected approaches.** Check `docs/AI_CONTEXT.md` section 16.1 (Rejected Approaches) before proposing changes.

---

## 1. Project Overview & Mission

CraftIndex is an ultra-fast, client-centric Minecraft resource discovery engine, Pack Studio, and multi-resource bulk packager. It integrates catalog APIs across Modrinth, CurseForge, PlanetMinecraft, and community sources, empowering players and server administrators to discover, curate, inspect, and package mods, plugins, resource packs, shaders, datapacks, modpacks, worlds, server softwares, modloaders, and launchers into clean, standard-compliant archives with automatic dependency resolution.

## 2. Technology Stack & Runtime Environment

- **Frontend Core:** Vanilla ECMAScript 2022+ (Native ES Classes, Async/Await, Web Crypto, IndexedDB API, Fetch API, DOM Level 3). Zero heavy frontend frameworks (no React, Vue, Angular, or Svelte overhead).
- **Client Bundling & Packaging:** JSZip v3.10.1 (bundled locally in `js/vendor/jszip.min.js`).
- **Styling Architecture:** Modern pure CSS3 with native CSS Custom Properties, CSS Grid, Flexbox, and CSS `@media` responsive queries. No CSS-in-JS runtimes or Sass dependencies.
- **Backend / Development Server:** Node.js v18+ (tested through v27+), using native `http`, `https`, `zlib`, `crypto`, `fs`, and `path`.
- **Standalone Distribution Compiler:** Single-file offline bundler (`sync_standalone.js`) producing `dist/index.standalone.html`.
- **Testing & Verification Harness:** Headless Google Chrome automation over Chrome DevTools Protocol (`tests/cdp_browser.js`).

---

## 3. Repository Structure & Entry Points

```
CraftIndex/
├── index.html                   # Primary SPA HTML host
├── server.js                    # Node.js dev/production server, API proxy, asset router
├── sync_standalone.js           # Single-file standalone HTML distribution compiler
├── build_pages.js               # Static pre-renderer for 18 route documents
├── build_sitemap.js             # Resource sitemap generator (607 URLs)
├── route_metadata.js            # Route configuration, SEO metadata, subtabs pre-rendering
├── config.json                  # Authoritative default application configuration
├── package.json                 # Project manifest & metadata (v2.6.1)
├── package-lock.json            # Lockfile
├── README.md                    # Public developer & project documentation
├── DESIGN.md                    # Authoritative design system & visual specification
├── AGENTS.md                    # Mandatory engineering standards for agents (this file)
├── CRAFTINDEX_AUDIT_HANDOFF.md  # Upstream audit brief (in repository root)
├── sitemap.xml                  # Canonical XML sitemap (18 routes)
├── sitemap-resources.xml        # Resource sitemap (600 resources across 7 categories)
├── robots.txt                   # Search crawler directives
├── _redirects                   # Cloudflare Pages / Netlify SPA rewrite configuration
├── _routes.json                 # Cloudflare Pages routing rules
├── css/
│   ├── tokens.css               # Centralized design tokens (~445 lines)
│   └── styles.css               # Central stylesheet (~10,000 lines)
├── js/
│   ├── app.js                   # Main application controller (~10,000 lines)
│   ├── pack_studio.js           # Pack Studio engine (~1,550 lines)
│   ├── about_docs.js            # Official documentation content & modal content (~779 lines)
│   └── vendor/
│       └── jszip.min.js         # Localized JSZip v3.10.1 (~28 KB)
├── fonts/
│   └── inter/                   # Localized Inter font files (woff2, ~48 KB each)
├── images/                      # Official brand logos, favicons, social previews
│   ├── craftindex-logo.png      # Authoritative official CraftIndex logo
│   ├── craftindex-logo.webp
│   └── bigger-image.png         # Authoritative social preview banner (1672×941)
├── media/                       # Ambient background video assets
│   ├── rainy-evening-minecraft.mp4     # Original 1080p dark theme (~9.7 MB)
│   ├── rainy-evening-minecraft.opt.mp4 # Optimized 720p 24fps derivative (~2.03 MB)
│   ├── sakura-forest-minecraft.mp4     # Original 1080p light theme (~14.2 MB)
│   └── sakura-forest-minecraft.opt.mp4 # Optimized 720p 24fps derivative (~3.41 MB)
├── functions/                   # Cloudflare Pages Functions (edge SSR)
│   ├── [[route]].js             # Dynamic resource route handler (SSR)
│   ├── api/
│   │   ├── fetch.js             # SSRF-protected API proxy (domain whitelist)
│   │   ├── github/              # GitHub API proxy
│   │   │   └── [[path]].js      # Catch-all GitHub API route
│   │   ├── sponge/              # Sponge/Ore API proxy (session auth)
│   │   ├── hangar/              # Hangar (PaperMC) API proxy
│   │   ├── spiget/              # Spiget (SpigotMC) API proxy
│   │   ├── polymart/            # Polymart API proxy
│   │   └── smithed/             # Smithed API v2 proxy
│   └── lib/
│       └── resource_render.js   # Server-side resource HTML generator (~494 lines)
├── dist/                        # Build output
│   ├── index.standalone.html    # Standalone offline-capable single-file distribution (~797 KB)
│   └── pages/                   # 18 pre-rendered static route HTML documents
│       ├── index.html
│       ├── mods/index.html
│       ├── mods/fabric/index.html
│       ├── mods/forge/index.html
│       ├── mods/neoforge/index.html
│       ├── mods/quilt/index.html
│       ├── plugins/index.html
│       ├── resourcepacks/index.html
│       ├── shaders/index.html
│       ├── datapacks/index.html
│       ├── modpacks/index.html
│       ├── worlds/index.html
│       ├── serversoftwares/index.html
│       ├── modloaders/index.html
│       ├── launchers/index.html
│       ├── studio/index.html
│       ├── docs/index.html
│       ├── socials/index.html
│       ├── sitemap.xml
│       ├── sitemap-resources.xml
│       ├── 404.html
│       ├── _routes.json
│       └── _redirects
├── tests/                       # Automated test & verification harnesses
│   ├── cdp_browser.js           # Chrome DevTools Protocol automation driver
│   ├── run_all_tests.js         # Master test runner (13 suites)
│   ├── test_pages_function.js   # SSRF/CORS/proxy security tests (11 tests)
│   ├── verify_breadcrumbs.js    # Breadcrumb structured-data regression guard (6 checks)
│   ├── verify_pages_deployment.js # 187-assertion preflight deployment audit
│   ├── verify_zip_roundtrip.js   # Cryptographic ZIP round-trip verification
│   ├── verify_binary_persistence.js    # IndexedDB binary survival across browser relaunch
│   ├── verify_browser_routing.js       # 14-route SPA navigation & history back/forward test
│   ├── verify_header_logo_and_favicon.js # Logo/favicon integrity audit (39 checks)
│   ├── audit_light_theme_contrast.js   # WCAG 2.2 AA contrast audit (84 component states)
│   ├── test_scroll_isolation.js        # Dialog scroll containment & lock verifier
│   ├── release_gate_routing.js           # 6-scenario browser history & routing test
│   ├── capture_remediation_screenshots.js      # Visual QA screenshot generator
│   ├── package_release_evidence.js         # Evidence ZIP archive compiler
│   ├── verify_all_responsive.js         # 8-viewport responsive overflow audit
│   ├── verify_genuine_zoom.js              # Page-scale zoom (100%/150%/200%) verifier
│   ├── measure_cls.js                  # Mobile CLS measurement harness
│   ├── recalculate_contrast.js         # Alpha-composited contrast verifier
│   ├── test_both_themes.js             # Cross-theme visual regression auditor
│   ├── verify_mobile_interactions.js   # Mobile drawer/modal/touch target tests
│   ├── verify_video.js                 # Video playback verifier
│   ├── scan_console_errors.js          # Multi-route console error scanner
│   ├── profile_browser_runtime.js      # JavaScript runtime profiler
│   └── check_generated_output.js       # Static build output integrity checker
├── docs/
│   ├── AI_CONTEXT.md            # Project memory for AI agents (single source of truth)
│   └── CRAFTINDEX_DOCUMENTATION.md  # Official documentation (23 sections)
├── information/                 # Architecture docs & audit reports
│   ├── ARCHITECTURE.md
│   ├── BUILD_TEST_DEPLOYMENT.md
│   ├── DATA_AND_API_REFERENCE.md
    │   ├── DESIGN_AUDIT.md
│   ├── DESIGN_SYSTEM.md
│   ├── FEATURE_INVENTORY.md
│   ├── FINAL_RELEASE_READINESS_REPORT.md
│   ├── KNOWN_ISSUES_AND_ROADMAP.md
│   ├── LIGHT_THEME_UI_AUDIT_REPORT.md
│   ├── MASTER_CONTEXT.md
│   ├── NEXT_AGENT_INSTRUCTIONS.md
│   ├── OVERHAUL_COMPLETION_REPORT.md
│   ├── OVERHAUL_EXECUTION_REPORT.md
│   ├── PERFORMANCE_AND_STABILITY_REPORT.md
│   ├── PERFORMANCE_AUDIT.md
│   ├── PRE_COMMIT_CHANGESET_MANIFEST.md
│   ├── PRODUCT_ARCHITECTURE_AUDIT.md
│   ├── PROJECT_HISTORY.md
│   ├── RAW_LIGHT_THEME_CONTRAST_AUDIT.json
│   ├── REPOSITORY_MAP.md
│   ├── RESOURCE_PAGES_AUDIT.md
│   ├── SCROLLING_AND_INTERACTION_AUDIT.md
│   ├── SECURITY_AND_PRIVACY.md
│   ├── SEO_AND_ROUTING.md
│   ├── SEO_AUDIT.md
│   ├── VERIFIED_COMMANDS.md
│   └── VISUAL_CONSISTENCY_AND_INTERACTION_REPORT.md
└── information/craftindex_v261_release_evidence.zip (11.49 MB, GitHub Release asset)
```

---

## 4. Architectural Entry Points & Component Responsibilities

### `index.html`
The HTML host. Houses SEO meta tags, Open Graph, Twitter cards, JSON-LD schemas, ambient video player, header, drawer containers, modal dialogs, and the inline configuration script (`#cfg`).

### `server.js`
Production Node.js server, API proxy, and asset router. Serves static assets with strict Gzip compression and multi-tier Cache-Control headers. Enforces clean SPA routing for valid paths while strictly returning HTTP 404 for non-existent resources. Houses the `/api/fetch` proxy with a strict domain whitelist to prevent SSRF.

### `js/app.js`
Main application controller (~10,000 lines). Manages state: active search query, selected category tab, mod loader filters, pagination, and collection cart. Manages routing via HTML5 History API (`pushState` and `popstate`). Renders resource cards, category landing grids, settings modal, and cart drawer. Exposes critical window globals (`window.cart`, `window.sv`, `window.upd`, `window.draw`). Contains `migrateLegacyStorage()` (legacy `ci_*` → `cv_*` migration) and `CraftIndexScrollLock` (reference-counted body scroll lock).

### `js/pack_studio.js`
Pack Studio engine (~1,550 lines). Manages client-side binary persistence using IndexedDB (`CraftIndexDB`, Version 1). Implements recursive ZIP inspection for mods, plugins, resource packs, shaders, and datapacks. Builds and extracts `craftindex_manifest.json` (schema 1.1.0). Exports collection archives with standardized directory structures (`mods/`, `resourcepacks/`, `plugins/`, etc.).

### `js/about_docs.js`
Authoritative source for documentation articles rendered in the About Center modal (~779 lines, 23 sections).

---

## 5. Storage Architecture & Schemas

### 5.1 LocalStorage Schema (all keys use `cv_` prefix)
- `cv_cart`: JSON array of collection items currently queued.
- `cv_hist`: JSON array of previously searched terms or visited resources.
- `cv_source_prefs`: User source prioritization (Modrinth vs CurseForge).
- `cv_mode`: Theme preference (`"dark"` or `"light"`).
- `cv_ambient_video`: Ambient video background toggle (`"on"` or `"off"`).
- `cv_pack_name`: Custom pack name used during Pack Studio exports.
- `cv_pack_desc`: Custom pack description used during Pack Studio exports.

### 5.2 IndexedDB Schema (`CraftIndexDB`, Version 1)
- **Database Name:** `CraftIndexDB` (Version: `1`)
- **Object Store:** `binaries` — Primary Key: `id` (String)
- **Object Store:** `pack_config` — Primary Key: `id` (String)

**Stored Binary Interface:**
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
6. **CSS Token Discipline:** All component styles must consume semantic tokens from `css/tokens.css`. Never introduce hardcoded hex colors in component styles. Use existing semantic variables (`--colors-text-primary`, `--colors-background`, etc.).
7. **Lazy Loading Preservation:** `js/pack_studio.js` and `js/about_docs.js` must remain lazy-loaded. Do not reintroduce eager loading without measured justification.

---

## 8. Mandatory Agent Operating Rules

Any AI Agent working on CraftIndex **MUST** strictly adhere to the following rules:

1. **Read `docs/AI_CONTEXT.md` before making any changes.** This document is the single source of truth for project memory, architecture, and conventions. It contains verified facts, confirmed decisions, outstanding tasks, and known defects. Treat it as project context, not unquestionable truth — always verify against the actual repository.

2. **Inspect the actual repository before relying on historical notes.** The repository is the source of truth. Historical reports, prior session notes, and this file may be outdated. Always verify current file contents, git status, and test results before making changes.

3. **Preserve all existing functionality and user data.** Do not rebuild working components from scratch. Do not delete or reset IndexedDB (`CraftIndexDB`) or LocalStorage (`cv_*` keys) data without explicit user consent.

4. **Preserve the vanilla JavaScript, HTML, and CSS architecture.** Do not introduce React, Vue, Angular, Svelte, Tailwind runtime, or similar dependencies. Do not add unnecessary npm packages to `package.json` for client features achievable with standard web APIs.

5. **Do not rewrite working functionality just to make it look different.** Refactor only when there is a demonstrated defect or performance issue.

6. **Do not weaken security, validation, provider protections, or resource URL handling.** The `functions/api/fetch.js` proxy uses a strict domain whitelist. Do not weaken or bypass it.

7. **Do not introduce code that exposes or logs secrets and keys.** Never commit secrets, API keys, or environment variables to the repository.

8. **Do not force-push or rewrite Git history.** Do not create empty commits.

9. **Do not commit, push, or deploy without explicit authorization.** Local commits are permitted only when explicitly requested by the user.

10. **Never claim a task is complete without verification.** Every change must be verified by running the appropriate test suite (`npm test`) and confirming the specific behavior works.

11. **Update `docs/AI_CONTEXT.md` when making changes.** Whenever an architectural decision, feature addition, bug fix, or workflow change occurs, update the project memory document accordingly.

12. **Never silently reintroduce previously rejected approaches.** Check `docs/AI_CONTEXT.md` section 16.1 (Rejected Approaches) before proposing changes.

---

## 9. Build, Test & Verification Procedures

### 8.1 Standalone Distribution Compilation
```bash
node sync_standalone.js
```
*Expected Output:* `✅ dist/index.standalone.html synchronized successfully! File size: ~797 KB`.

### 8.2 Persistent Binary Storage Audit
```bash
node tests/verify_binary_persistence.js
```
*Verification criteria:* Confirms IndexedDB stores raw binary Blobs and survives in-browser reload as well as complete Chrome process termination and profile relaunch with 100% cryptographic SHA-256 identity.

### 8.3 ZIP Round-Trip Verification
```bash
node tests/verify_zip_roundtrip.js
```
*Verification criteria:* Exports collection ZIP, verifies `craftindex_manifest.json` and directory structure with external JSZip, clears state, re-imports, and confirms 100% hash match.

### 8.4 Clean Browser Routing Verification
```bash
node tests/verify_browser_routing.js
```
*Verification criteria:* Confirms all 18 canonical routes load correctly in Chrome, history back/forward functions cleanly, hard refresh retains state, and invalid paths return HTTP 404. (Note: Tests cover 14 direct routes; the 4 loader-specific mod routes — `/mods/fabric/`, `/mods/forge/`, `/mods/neoforge/`, `/mods/quilt/` — are also part of the 18 route-config entries.)

### 8.5 Mobile CLS Verification
```bash
node tests/measure_cls.js
```
*Verification criteria:* Mobile CLS < 0.10 on all routes under Slow 4G / 4× CPU throttling (390×844 viewport).

### 8.6 Full Master Test Suite
```bash
npm test
```
*Verification criteria:* All 13 test suites pass (187 preflight assertions in `verify_pages_deployment.js`). Exit code 0.

---

## 9. Release Checklist (Before Any Commit)

- [ ] All 13 test suites pass (`npm test`)
- **`npm run build`** passes (18 static routes, 607 sitemap URLs)
- **`node sync_standalone.js`** passes (standalone HTML synchronized)
- **`tests/audit_light_theme_contrast.js`** passes (84/84 elements ≥ 4.5:1)
- **`tests/test_scroll_isolation.js`** passes (0px background scroll leakage)
- **`tests/release_gate_routing.js`** passes (6/6 scenarios)
- **`tests/verify_all_responsive.js`** passes (34/34 viewport checks)
- **`tests/verify_genuine_zoom.js`** passes (0px variance at 100%/150%/200%)
- **`docs/AI_CONTEXT.md`** updated with all architectural decisions, feature changes, and bug fixes
- No secrets, API keys, or environment variables committed
- No deprecated or rejected approaches reintroduced
- No user data (IndexedDB or LocalStorage) deleted or reset
- No changes to `images/bigger-image.png` or `images/craftindex-logo.png`

---

## 10. Known Issues & Limitations (as of v2.6.1)

| Issue | Severity | Status |
|---|---|---|
| Physical device testing not yet performed | Low | Outstanding |
| Post-deployment CrUX / Search Console field data not yet observed | Low | Requires production traffic |
| Large video files committed to Git (9.7 MB + 14.2 MB originals) | Low | Repository bloat; consider Git LFS or external storage |
| Monolithic `js/app.js` (~10,000 lines) | Low | Maintainability concern; do not split without updating build scripts |
| CurseForge requires API key (`CF_KEY` env var) | Low | Graceful degradation (empty array) when key absent |

---

*This file is the single source of truth for AI agents working on CraftIndex. It must be read before making any changes and updated whenever architectural decisions, features, bug fixes, or workflow changes occur. For detailed architectural context, see `docs/AI_CONTEXT.md`.*