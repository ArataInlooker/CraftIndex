# CraftIndex Documentation

> **Official Minecraft Resource Discovery, Pack Studio & Multi-Resource Collection Platform**  
> **Creator & Maintainer:** Arata Inlooker  
> **Official Website:** [craftindex.inlooker.top](https://craftindex.inlooker.top)  
> **Creator Portfolio:** [inlooker.top](https://inlooker.top)  
> **GitHub Repository:** [github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)

---

## Table of Contents

1. [Overview](#01-overview)
2. [Introduction](#02-introduction)
3. [Why CraftIndex](#03-why-craftindex)
4. [Who It Is For](#04-who-it-is-for)
5. [Resource Categories](#05-resource-categories)
6. [How the Interface Works](#06-how-the-interface-works)
7. [Supported Sources](#07-supported-sources)
8. [Resource Discovery](#08-resource-discovery)
9. [Collections](#09-collections)
10. [Pack Studio & Collection Exports](#10-pack-studio--collection-exports)
11. [Settings & Preferences](#11-settings--preferences)
12. [Settings Import & Export](#12-settings-import--export)
13. [Modpack Import & Export](#13-modpack-import--export)
14. [Data & Browser Storage](#14-data--browser-storage)
15. [Technical Architecture](#15-technical-architecture)
16. [API & Backend](#16-api--backend)
17. [Hosting & Deployment](#17-hosting--deployment)
18. [Standalone Version](#18-standalone-version)
19. [Privacy & Security](#19-privacy--security)
20. [Compatibility](#20-compatibility)
21. [Troubleshooting](#21-troubleshooting)
22. [Frequently Asked Questions (FAQ)](#22-frequently-asked-questions-faq)
23. [Credits & Project Links](#23-credits--project-links)

---

## 01. Overview

### Creator & Maintainer Credit

```
+-----------------------------------------------------------------------------------+
|  [AI]  Arata Inlooker                                                             |
|        Creator & Maintainer                                                       |
|                                                                                   |
|  CraftIndex is independently developed and maintained by Arata Inlooker,          |
|  a student and independent developer working across software development,         |
|  systems architecture and network infrastructure.                                 |
|                                                                                   |
|  [ Visit Portfolio ↗ (https://inlooker.top) ]                                     |
+-----------------------------------------------------------------------------------+
```

### Product Identity

- **Product Name:** CraftIndex
- **Maintainer:** Arata Inlooker
- **Tagline:** Discover. Collect. Download.
- **Category:** Minecraft Resource Discovery, Modpack Builder & Pack Studio
- **Website:** [https://craftindex.inlooker.top](https://craftindex.inlooker.top)
- **Primary Color Identity:** Cosmic Purple (`#0c0915`, `#161126`, `#7c4dff`, `#b388ff`, `#d1b3ff`)

### Main Description

CraftIndex is a high-performance client-centric Minecraft resource discovery engine, Pack Studio, and multi-resource packager designed to help players and server administrators discover, curate, inspect, and package mods, plugins, resource packs, shaders, and datapacks into clean, standard-compliant archives with automatic dependency resolution. It brings resource discovery and collection workflows together in one interface, helping users find the resources they need without manually managing every download separately.

### Product Mission

CraftIndex aims to make Minecraft resource discovery and collection simpler, more organized and more efficient. Instead of repeatedly searching across different platforms and manually managing individual downloads, users can explore supported resources, collect their selections and organize downloads through one unified interface with persistent local IndexedDB storage.

### Supported Resource Categories

- **Mods:** Game modifications spanning Fabric, Forge, NeoForge, Quilt, and legacy loaders.
- **Plugins:** Server plugins covering Paper, Spigot, Purpur, Velocity, BungeeCord, and Sponge.
- **Resource Packs:** Visual textures, models, sound packs, and UI enhancements.
- **Shaders:** GLSL shader packs for Iris, Oculus, OptiFine, and Canvas rendering pipelines.
- **Datapacks:** Vanilla gameplay additions, custom dimensions, loot tables, and advancements.
- **Other Resources:** Modpacks, custom world maps, server software, mod loaders, and launcher utilities.

### Key Product Capabilities

- **Unified Multi-Source Discovery:** Search across Modrinth, CurseForge (via proxy), Hangar, Spiget, Polymart, Smithed, and GitHub without switching sites.
- **Pack Studio:** Dedicated in-browser workspace for composing custom modpacks, managing resource collections, and inspecting archives.
- **Persistent Binary Storage:** Full IndexedDB (`CraftIndexDB`) storage of raw binary Blobs with cryptographic SHA-256 validation.
- **Interactive Cart & Collection:** Select resources across completely different categories into one persistent cart.
- **Client-Side Pack Packaging:** Generate organized ZIP files in-browser via JSZip with zero server upload bottleneck.
- **Dependency Detection:** Detect required library dependencies (e.g. Fabric API, Cloth Config) prior to checkout.
- **Modpack Interoperability:** Import and export standard Modrinth `.mrpack` files, CurseForge `manifest.json`, and custom CraftIndex JSON manifests (`craftindex_manifest.json` (with backward compatibility for `craftvault_manifest.json`) schema 1.0.0).
- **Standalone Distribution:** Complete single-file offline distribution (`dist/index.standalone.html`).

---

## 02. Introduction

CraftIndex is designed for Minecraft players, server administrators, and modpack developers who need a faster, cleaner, and more organized way to acquire game resources. 

In the standard Minecraft ecosystem, acquiring resources requires opening dozens of browser tabs across conflicting repositories, clicking individual download links, waiting for timers, renaming files, and sorting them into separate folders (`mods/`, `resourcepacks/`, `shaderpacks/`, `plugins/`). 

CraftIndex streamlines this entire workflow into a single unified workspace:
1. **Explore**: Browse multiple upstream repositories through clean, unified cards.
2. **Collect**: Stage mods, shaders, and packs into a temporary session cart with a single click.
3. **Archive**: Click "Download" to automatically bundle all items into a neatly categorized ZIP archive, ready to drop straight into your `.minecraft` directory or server folder.

CraftIndex adheres to a minimalist, futuristic cyber-glass aesthetic that runs entirely client-side, respecting user privacy, browser performance, and upstream API rate limits.

---

<a id="03-why-craftvault"></a>
## 03. Why CraftIndex

Collecting Minecraft resources from multiple platforms presents repetitive hurdles:
- **Platform Fragmentation:** Some mods only exist on Modrinth; others remain exclusively on CurseForge; plugins live on SpigotMC or Hangar; datapacks live on Smithed or PlanetMinecraft.
- **Manual Repetition:** Installing a 40-mod collection requires visiting 40 pages, clicking 40 download buttons, and handling 40 separate files in your browser downloads folder.
- **Folder Disorganization:** Mod files, shaders, resource packs, and datapacks end up intermingled in default download folders, requiring manual sorting.
- **Version & Loader Mismatches:** Keeping track of compatible Minecraft versions (e.g., 1.20.1 vs 1.21) across disparate websites is error-prone.

> *"CraftIndex was created to simplify the process of finding, collecting and downloading Minecraft resources. The idea is to reduce unnecessary manual work and provide a more organized experience through a unified interface."*

By centralizing multi-source discovery, automated folder mapping, dependency awareness, and client-side ZIP packaging, CraftIndex eliminates tedious tab-juggling and allows players to get back to playing.

---

## 04. Who It Is For

| Audience | Primary Use Cases in CraftIndex |
| :--- | :--- |
| **Individual Players** | Quickly assemble custom client profiles with performance mods (Sodium, Lithium, Iris), favorite shaderpacks, and resource packs in a single archive. |
| **Server Administrators** | Discover, verify, and bundle Paper/Spigot plugins from Hangar, Spiget, and Polymart for clean server deployments. |
| **Modpack Creators** | Curate mod lists, inspect file hashes and loaders, export `.mrpack` distribution archives, and generate shareable JSON collection links. |
| **Resource Researchers** | Compare release versions, changelogs, dependencies, and author statistics across Modrinth, CurseForge, and GitHub simultaneously. |

---

## 05. Resource Categories

CraftIndex organizes resources into structured categories with tailored metadata and loader filters:

### 1. Mods (`/mods`)
- **Purpose:** Game modifications altering client or server behavior.
- **Supported Loaders:** Fabric, Forge, NeoForge, Quilt, LiteLoader, Rift, Babric, Cleanroom, Ornithe.
- **Supported Sources:** Modrinth, CurseForge (via backend proxy), PlanetMinecraft, Sponge, GitHub.
- **Folder Destination in Archive:** `mods/`

### 2. Plugins (`/plugins`)
- **Purpose:** Server-side extensions running on Bukkit-compatible software without requiring client mods.
- **Supported Platforms:** Paper, Spigot, Purpur, Velocity, BungeeCord, Sponge, Folia, Waterfall.
- **Supported Sources:** Hangar (PaperMC), Spiget (SpigotMC), Modrinth, Polymart, Bukkit.
- **Folder Destination in Archive:** `plugins/`

### 3. Resource Packs (`/resourcepacks`)
- **Purpose:** Custom textures, models, sound effects, fonts, and UI overhauls.
- **Supported Formats:** Standard Minecraft resource pack ZIP structures with `pack.mcmeta`.
- **Supported Sources:** Modrinth, CurseForge, PlanetMinecraft.
- **Folder Destination in Archive:** `resourcepacks/`

### 4. Shaders (`/shaders`)
- **Purpose:** GLSL post-processing pipelines providing realistic lighting, shadows, waving vegetation, and water reflections.
- **Supported Pipelines:** Iris Shaders, Oculus, OptiFine.
- **Supported Sources:** Modrinth, CurseForge, GitHub.
- **Folder Destination in Archive:** `shaderpacks/`

### 5. Datapacks (`/datapacks`)
- **Purpose:** Vanilla data modifications adding custom recipes, structures, advancements, and functions without Java code.
- **Supported Sources:** Smithed, Modrinth, PlanetMinecraft, CurseForge.
- **Folder Destination in Archive:** `datapacks/`

---

## 06. How the Interface Works

The CraftIndex interface is structured into four main functional regions:

```
+-------------------------------------------------------------------------------------+
| [Logo] CraftIndex       [⚡ Sources]  [ℹ️ About]  [☀️/🌙 Theme]  [Presets] [History] [Cart 0] |
+-------------------------------------------------------------------------------------+
| [🏠 Home]  [📦 Mods ▾]  [🔌 Plugins ▾]  [🎨 Resource Packs]  [✨ Shaders]  [📄 Data Packs] |
+-------------------------------------------------------------------------------------+
| [ Search Minecraft resources...                                ]  [↻ Refresh]       |
+-------------------------------------------------------------------------------------+
| [ Card 1 ]       [ Card 2 ]       [ Card 3 ]       [ Card 4 ]       [ Card 5 ]      |
| [ Card 6 ]       [ Card 7 ]       [ Card 8 ]       [ Card 9 ]       [ Card 10]      |
+-------------------------------------------------------------------------------------+
| [ CraftIndex by Arata Inlooker - craftindex.inlooker.top                          ] |
+-------------------------------------------------------------------------------------+
```

- **Header Controls:**
  - `Logo`: Brand emblem and title; returns to the Home tab.
  - `⚡ Sources`: Configure primary and secondary API providers for each category.
  - `ℹ️ About`: Opens this About & Documentation Center.
  - `☀️/🌙 Theme`: Toggles between Cosmic Purple (Dark) and Daylight Lavender (Light).
  - `Presets`: Quick starter configurations for Performance, Visuals, and Utilities.
  - `History`: Audit trail of recently viewed and downloaded items.
  - `Cart`: Slides open the persistent collection drawer.
- **Navigation Bar (Tabs):** Fast switching between Home and resource categories, with nested subcategory dropdowns for Mod Loaders and Server Software.
- **Search & Filters:** Real-time debounced text search, version selection, loader filtering, and sorting (Relevance, Downloads, Follows, Newest, Updated).
- **Resource Grid:** Responsive card deck presenting icon, title, author, version badges, summary, and "+ Add to Cart" buttons.

---

## 07. Supported Sources

| Source | Integration Type | Authentication | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Modrinth** | Direct Client REST API | None required | **Fully Supported** | Ultra-fast open API; primary source for mods, shaders, and resource packs. |
| **CurseForge** | Server Proxy (`/api/curseforge`) | Optional `CF_KEY` | **Supported (with proxy/key)** | Proxied through `server.js`. Requires key for production quota. |
| **Hangar (PaperMC)** | Server Proxy (`/api/hangar`) | None required | **Fully Supported** | High-quality Paper/Purpur/Velocity server plugins. |
| **Spiget (SpigotMC)** | Server Proxy (`/api/spiget`) | None required | **Fully Supported** | Extensive directory of SpigotMC server plugins. |
| **Polymart** | Server Proxy (`/api/polymart`) | None required | **Supported** | Community and premium Minecraft server resources. |
| **Smithed** | Server Proxy (`/api/smithed`) | None required | **Fully Supported** | Curated registry of vanilla datapacks. |
| **GitHub Releases**| Server Proxy (`/api/github`) | None required | **Supported** | Open-source mods and developer releases. |

---

## 08. Resource Discovery

The resource discovery workflow operates as follows:

```
[Select Category] ──> [Apply Filters (Loader/Version)] ──> [Query Upstream API]
                             │                                    │
                             ▼                                    ▼
                     [Debounced Input]                   [Render Cards]
                                                                  │
                                                                  ▼
                                                      [Open Modal or Add Cart]
```

1. **Category Selection:** Choosing a tab sets the active category (`mod`, `plugin`, `shaderpack`, etc.) and loader context.
2. **Dynamic Filtering:** Selecting a Minecraft version (e.g. `1.20.1`) or loader (e.g. `Fabric`) dynamically scopes the API query parameters.
3. **Debounced Search:** Typing into the search bar debounces input by 350 ms to avoid spamming upstream APIs.
4. **Card Rendering:** Upstream responses are normalized into standard CraftIndex resource objects containing title, description, author, download count, icon, and direct download links.
5. **Detail Inspection:** Clicking any resource card opens the Resource Detail Dashboard with markdown documentation, version tables, gallery screenshots, and external review links.

---

## 09. Collections

The Collection (Cart) serves as a staging area before downloading:
- **Adding Items:** Clicking `+ Add` on any card immediately registers the item into `C.cart`.
- **Badge Counter:** The header Cart button (`#cb`) updates in real time with the active item count.
- **Drawer Inspection:** Opening the Cart drawer displays all staged items grouped by folder destination (`mods/`, `plugins/`, etc.).
- **Deduplication:** Adding an already-selected resource updates its version preference rather than creating duplicate entries.
- **Item Removal:** Individual items can be removed via the trash button, or the entire cart cleared with `Clear All`.
- **Session Persistence:** Cart items are automatically saved to browser LocalStorage under the key `cv_cart`.

---

## 10. Pack Studio & Collection Exports

CraftIndex features **Pack Studio**, a dedicated client-side curation and archive packaging engine powered by **JSZip** and **IndexedDB**:

```
[Collection Cart] ──> [Persistent IndexedDB Blobs] ──> [JSZip Categorization] ──> [Standardized ZIP Archive]
                              │                                      │
                     (Cryptographic SHA-256)               (mods/, plugins/, etc.)
```

1. **Validation:** Checks that the collection contains valid resources and displays summary metrics.
2. **Archive Naming & Metadata:** Custom pack naming and description with automatic manifest generation (`craftindex_manifest.json` (with backward compatibility for `craftvault_manifest.json`) schema 1.0.0).
3. **Dependency Check:** If staged mods require unmet dependencies (e.g. Fabric API, Cloth Config), the Dependency Resolution Dialog offers one-click inclusion.
4. **Persistent Binary Storage:** Imported JARs and ZIPs are committed directly to IndexedDB (`CraftIndexDB`), ensuring local files survive page reloads and browser process restarts.
5. **Standardized Folder Organization:** Automatically places files into structured subdirectories conforming to Minecraft client and server standards:
   - `mods/*.jar` (Fabric, Forge, NeoForge, Quilt)
   - `plugins/*.jar` (Paper, Spigot, Purpur, Velocity)
   - `resourcepacks/*.zip` (Texture and resource packs with `pack.mcmeta`)
   - `shaderpacks/*.zip` (Iris and OptiFine shaders)
   - `datapacks/*.zip` (World datapacks with `data/` namespace)
   - `unverified/*.jar` (Generic archives without recognized manifest)
6. **Archive Assembly:** JSZip compresses the organized virtual directory and triggers a single native browser download prompt with zero server upload bottleneck.

---

## 11. Settings & Preferences

User preferences are configured via the Settings dialog (`⚙️ Settings`) and persist across sessions:
- **Theme Mode:** Dark (Cosmic Purple), Light (Daylight Lavender), or Auto (System Preference).
- **Default Game Version:** Automatically pre-filters search queries to your preferred Minecraft version.
- **Loader Preference:** Defaults to Fabric, Forge, NeoForge, or Quilt.
- **Primary / Secondary Sources:** Prioritizes Modrinth or CurseForge when resolving items.
- **Ambient Background Video:** Enable or disable the animated atmospheric background canvas.
- **Grid Layout Density:** Controls card spacing, column count, and compact card mode.

---

## 12. Settings Import & Export

Configurations can be backed up or transferred between computers via JSON files:

### Exporting Settings
- Clicking `Export Settings` in the Settings dialog downloads `CraftIndex.inlooker.top-settings.json`.
- Contains all visual options, preferred loaders, source weights, and layout parameters.

### Importing Settings
- Clicking `Import Settings` opens a file picker accepting `.json` configurations.
- Validates JSON structure, confirms schema version compatibility, updates in-memory config, and refreshes the UI without requiring a page reload.

### Sample Settings JSON Schema
```json
{
  "title": "CraftIndex",
  "brand": "#b388ff",
  "brand2": "#7c4dff",
  "bg": "#0c0915",
  "card": "#161126",
  "text": "#e8e0f5",
  "font": "Inter",
  "radius": 14,
  "sort": "relevance",
  "per": 24,
  "deb": 350,
  "zipName": "CraftIndex.inlooker.top-Collection.zip",
  "v": 2,
  "mode": "dark"
}
```

---

## 13. Modpack Import & Export

CraftIndex provides bidirectional compatibility with standard Modrinth modpacks:

- **Modpack Export (`.mrpack`):**
  - Generates a valid Modrinth `modrinth.index.json` containing hashes (SHA-1, SHA-512), download URLs, file paths, and dependency metadata.
  - Bundles overrides under `overrides/` and manifests under `overrides/craftindex_manifest.json`.
  - Directly loadable by Prism Launcher, ATLauncher, and the Modrinth App.
- **Modpack Import (`.mrpack` / JSON):**
  - Unpacks the modpack archive in memory.
  - Parses `modrinth.index.json` to extract project IDs, file versions, and target paths.
  - Automatically populates the CraftIndex cart with the full modpack contents for easy modification, subtraction, or addition.

---

## 14. Data & Browser Storage

CraftIndex stores all persistent state locally in the user's browser using `window.localStorage`:

| Key | Purpose | Example Value |
| :--- | :--- | :--- |
| `cv_cart` | Active cart items and metadata | Serialized JSON array of resource cards |
| `cv_settings` | Custom user preferences and visual options | Serialized JSON settings object |
| `cv_mode` | Theme selection | `"dark"`, `"light"`, or `"auto"` |
| `cv_primary_source` | Default upstream provider | `"modrinth"` or `"curseforge"` |
| `cv_secondary_source`| Fallback upstream provider | `"curseforge"` or `"github"` |
| `cv_hist` | Recently inspected resources | Array of recent item slugs |
| `cv_migrated` | Safe migration marker | `"1"` (Guards against duplicate migration runs) |
| `CraftIndexDB (IndexedDB)` | Persistent binary storage for local JARs, ZIPs & collection blobs | `binaries` object store keyed by SHA-256 hash or item key |

### IndexedDB Binary Storage
CraftIndex incorporates a persistent IndexedDB binary store (`CraftIndexDB`, object store: `binaries`). When users import local `.jar`, `.zip`, or `.mrpack` files via Pack Studio, raw binary data (as `Blob` or `ArrayBuffer`) is committed directly to IndexedDB. This guarantees that user-provided binaries survive page reloads and browser restarts with matching cryptographic SHA-256 hashes.

### Automatic Legacy Migration
On initialization, CraftIndex runs `migrateLegacyStorage()` to convert legacy `ci_*` keys to authoritative `cv_*` keys. Data is verified before old keys are removed, ensuring user preferences and cart contents are preserved across updates.

---

## 15. Technical Architecture

CraftIndex is built as a lightweight, frameworkless web application engineered for high performance, zero client bundle overhead, and resilience:

```
[Client Browser]
  ├── index.html               (Semantic markup, dialogs, metadata)
  ├── css/styles.css           (Cosmic purple theme, glassmorphism, responsive queries)
  ├── js/app.js                (State, UI controllers, search, cart, JSZip orchestration)
  ├── js/vendor/jszip.min.js   (Client-side ZIP archive compiler)
  └── site.webmanifest         (PWA manifest and icon definitions)
        │
        ├── Direct REST Requests (e.g. Modrinth API)
        │
        └── Local / Node.js Reverse Proxy
              ├── server.js            (Path validation, proxy routing, video streaming)
              ├── Upstream APIs        (CurseForge, Hangar, Spiget, Smithed, GitHub)
              └── dist/index.standalone.html (Self-contained distribution)
```

- **Frontend:** Pure HTML5, modern CSS3 (Custom Properties, Flexbox, Grid, Backdrop Filter), and Vanilla JavaScript (ES2022). Zero bulky dependencies (no React, Vue, or Webpack).
- **Styling:** Modular design tokens, WCAG 2.2 compliant `:focus-visible` states, and `@media (prefers-reduced-motion)` hooks.
- **Packaging:** Self-contained build script (`sync_standalone.js`) compiles the entire codebase into a single standalone distribution file.

---

## 16. API & Backend

While CraftIndex can run purely as a static website for direct APIs like Modrinth, `server.js` provides a lightweight Node.js HTTP reverse proxy:

- **Purpose:** Bypasses browser CORS restrictions on third-party APIs and securely injects developer credentials when proxying requests.
- **User-Agent:** All upstream queries send `User-Agent: CraftIndex`.
- **Proxy Routes:**
  - `/api/curseforge/*` -> `https://api.curseforge.com/*` (Injects optional `x-api-key: CF_KEY`)
  - `/api/hangar/*` -> `https://hangar.papermc.io/api/v1/*`
  - `/api/spiget/*` -> `https://api.spiget.org/v2/*`
  - `/api/polymart/*` -> `https://api.polymart.org/v1/*`
  - `/api/smithed/*` -> `https://api.smithed.dev/v2/*`
  - `/api/github/*` -> `https://api.github.com/*`
- **Security Guardrails:**
  - Strict path boundary verification via `path.resolve` prevents directory traversal.
  - Directly blocks access to `server.js`, `.env`, and dotfiles.
  - Video streaming supported via HTTP 206 Partial Content Range headers.

---

## 17. Hosting & Deployment

| Deployment Mode | Supported Features | Requirements | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js Server** | All features: Modrinth, CurseForge, Hangar, Spiget, Polymart, Smithed, GitHub, video streaming. | Node.js 18+, port 3000 (or `process.env.PORT`). | Start with `npm start` or `node server.js`. |
| **Cloudflare Pages (Static)** | Modrinth discovery, collection cart, ZIP generation, settings, standalone mode. | Any static CDN. | Proxied APIs (Hangar/Spiget) require Cloudflare Pages Functions or an external proxy. |
| **Local File Execution** | Standalone mode (`dist/index.standalone.html`), Modrinth discovery, cart, ZIP download. | Standard web browser. | Open directly via `file://`. |

---

## 18. Standalone Version

The standalone distribution is located at:
`dist/index.standalone.html`

- **Compilation:** Generated automatically using `sync_standalone.js` (`npm run build`).
- **Inlining:** Inlines CSS, configuration JSON, and JavaScript into a single distributable HTML document.
- **Portability:** Can be stored on a USB drive, shared via Discord, or run without a local web server.
- **Asset Links:** Relative asset paths (`../images/`, `../media/`, `../js/vendor/`) ensure icons and local resources resolve correctly when opened from `dist/`.

---

## 19. Privacy & Security

- **Zero Tracking:** CraftIndex has no trackers, no telemetry scripts, and no external analytics.
- **Local State:** All cart items, search histories, and custom settings remain 100% inside your local browser storage.
- **Client-Side Archiving:** ZIP files are generated in-memory on your machine. Your download selections are never uploaded to CraftIndex servers.
- **Credential Safety:** Never enter Minecraft account passwords or sensitive tokens. No user credentials are required to discover or download public resources.
- **Secure Links:** External outbound links use `target="_blank" rel="noopener noreferrer"` to prevent window opener hijacking.

---

## 20. Compatibility

- **Desktop Browsers:** Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari, Brave, Opera (current and prior 2 versions).
- **Mobile Browsers:** Chrome for Android, Safari on iOS/iPadOS, Samsung Internet, Firefox Mobile.
- **Screen Resolutions:** Tested and verified from small mobile screens (320 × 568) to 4K desktop displays (3840 × 2160) with zero horizontal overflow.
- **Operating Systems:** Windows, macOS, Linux, Android, iOS, ChromeOS.
- **Requirements:** JavaScript must be enabled; browser LocalStorage required for cart persistence; Web Workers and Blob API required for Pack Studio ZIP assembly.

---

## 21. Troubleshooting

| Symptom | Probable Cause | Recommended Resolution |
| :--- | :--- | :--- |
| **Search returns no results** | Upstream API rate limit or strict filter combination. | Clear version/loader filters, check search spelling, or wait 30 seconds for rate limits to reset. |
| **CurseForge results fail to load** | Missing `CF_KEY` in `server.js` or proxy offline. | Ensure `server.js` is running and supply an API key in `.env`, or switch primary source to Modrinth. |
| **Cart is empty after closing browser** | Private browsing mode or cleared LocalStorage. | Use standard browser mode; ensure browser settings do not clear storage on exit. |
| **ZIP download fails to trigger** | Browser blocked multiple download popups. | Allow popups and downloads for `craftindex.inlooker.top` in browser site settings. |
| **Settings JSON import error** | Malformed or incompatible JSON schema. | Re-export settings from CraftIndex to inspect valid format; ensure valid JSON syntax. |
| **Backend proxy connection refused** | Port 3000 occupied or server not running. | Run `npm start` in the project terminal or check `Get-NetTCPConnection -LocalPort 3000`. |

---

## 22. Frequently Asked Questions (FAQ)

### What is CraftIndex?
CraftIndex is a high-performance client-centric Minecraft resource discovery engine, Pack Studio, and multi-resource packager. It allows you to search across supported platforms, stage multiple resources into a single collection, inspect archives with persistent IndexedDB storage, and export them as standard-compliant ZIP archives.

### Is CraftIndex a Minecraft launcher?
No. CraftIndex does not launch Minecraft, manage game processes, or log into Microsoft accounts. It is a discovery and file preparation utility designed to complement launchers like Prism Launcher, Modrinth App, ATLauncher, and the official launcher.

### Which sources are supported?
Modrinth, CurseForge (via backend proxy), Hangar (PaperMC), Spiget (SpigotMC), Polymart, Smithed, and GitHub.

### How do I download multiple resources at once?
Browse resources in any category, click `+ Add` to add them to your cart, click the `Cart` button in the header, review your selections, and click `⬇ Download`. CraftIndex will fetch each file and bundle them into a single ZIP.

### Where are the downloaded files placed inside the ZIP?
Files are automatically organized into standard Minecraft directories: mods go into `mods/`, server plugins into `plugins/`, shaders into `shaderpacks/`, resource packs into `resourcepacks/`, and datapacks into `datapacks/`.

### Can I import Modrinth modpacks?
Yes! Click `Import` in the cart drawer and select any `.mrpack` archive. CraftIndex will parse its index and add all constituent mods directly into your cart.

### Where are my settings and cart items stored?
All data is stored exclusively in your browser's `window.localStorage`. Nothing is stored on CraftIndex servers.

### Does CraftIndex work completely offline?
The user interface and standalone file (`dist/index.standalone.html`) can be opened offline. However, searching live resource catalogs and downloading new files requires an active internet connection.

---

## 23. Credits & Project Links

- **Product:** CraftIndex
- **Creator & Maintainer:** Arata Inlooker
- **Official Website:** [https://craftindex.inlooker.top](https://craftindex.inlooker.top)
- **Creator Portfolio:** [https://inlooker.top](https://inlooker.top)
- **GitHub Repository:** [https://github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)
- **Contact Email:** [aratainlooker@gmail.com](mailto:aratainlooker@gmail.com)
- **License:** All Rights Reserved (Proprietary)

*CraftIndex is an independent open-source project and is not affiliated with, endorsed by, or associated with Mojang Studios, Microsoft, CurseForge, or Modrinth.*
