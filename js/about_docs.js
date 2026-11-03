/**
 * CraftIndex Official Documentation & About Content
 * Authoritative single source of truth rendered in the About Center.
 * Synchronized with docs/CRAFTINDEX_DOCUMENTATION.md
 * Maintainer: Arata Inlooker (https://inlooker.top)
 */

const ABOUT_DOCS = [
  {
    id: "overview",
    title: "OVERVIEW",
    icon: "🏠",
    html: `
      <div class="creator-card">
        <div class="creator-top-row">
          <div class="creator-avatar" aria-hidden="true">AI</div>
          <div class="creator-info">
            <h3 class="creator-name">Arata Inlooker</h3>
            <span class="creator-role">Creator & Maintainer</span>
          </div>
          <a href="https://inlooker.top" target="_blank" rel="noopener noreferrer" class="creator-portfolio-btn" title="Open Arata Inlooker's Portfolio in a new tab">
            Visit Portfolio ↗
          </a>
        </div>
        <p class="creator-bio">
          CraftIndex is independently developed and maintained by <strong>Arata Inlooker</strong>, a student and independent developer working across software development, systems architecture and network infrastructure.
        </p>
      </div>

      <div class="doc-hero-section">
        <div class="doc-brand-banner">
          <img src="images/craftindex-logo.png" alt="CraftIndex" class="doc-brand-logo" width="48" height="48">
          <div>
            <h1 class="doc-main-title">CraftIndex</h1>
            <div class="doc-tagline">Discover. Collect. Download.</div>
          </div>
        </div>
        <p class="doc-lead-desc">
          CraftIndex is a high-performance client-centric Minecraft resource discovery engine, Pack Studio, and multi-resource packager designed to help players and server administrators discover, curate, inspect, and package mods, plugins, resource packs, shaders, and datapacks into clean, standard-compliant archives with automatic dependency resolution.
        </p>
      </div>

      <div class="doc-callout">
        <h4 class="doc-callout-title">🎯 Product Mission</h4>
        <p>
          CraftIndex aims to make Minecraft resource discovery and collection simpler, more organized and more efficient. Instead of repeatedly searching across different platforms and manually managing individual downloads, users can explore supported resources, collect their selections and organize downloads through one unified interface.
        </p>
      </div>

      <h3 class="doc-section-h3">📦 Supported Resource Categories</h3>
      <div class="doc-grid-cards">
        <div class="doc-mini-card">
          <div class="dmc-icon">📦</div>
          <div class="dmc-title">Mods</div>
          <div class="dmc-desc">Game modifications for Fabric, Forge, NeoForge, Quilt, and legacy loaders, routed to <code>mods/</code>.</div>
        </div>
        <div class="doc-mini-card">
          <div class="dmc-icon">🔌</div>
          <div class="dmc-title">Plugins</div>
          <div class="dmc-desc">Server extensions for Paper, Spigot, Purpur, Velocity, and Sponge, routed to <code>plugins/</code>.</div>
        </div>
        <div class="doc-mini-card">
          <div class="dmc-icon">🎨</div>
          <div class="dmc-title">Resource Packs</div>
          <div class="dmc-desc">Textures, 3D models, audio overhauls, and custom GUI themes, routed to <code>resourcepacks/</code>.</div>
        </div>
        <div class="doc-mini-card">
          <div class="dmc-icon">✨</div>
          <div class="dmc-title">Shaders</div>
          <div class="dmc-desc">Atmospheric post-processing for Iris, Oculus, and OptiFine, routed to <code>shaderpacks/</code>.</div>
        </div>
        <div class="doc-mini-card">
          <div class="dmc-icon">📄</div>
          <div class="dmc-title">Data Packs</div>
          <div class="dmc-desc">Vanilla game expansions, custom loot tables, and structures, routed to <code>datapacks/</code>.</div>
        </div>
      </div>

      <h3 class="doc-section-h3">⚡ Key Product Capabilities</h3>
      <ul class="doc-feature-list">
        <li><strong>Multi-Source Search:</strong> Seamless aggregation from Modrinth, CurseForge (via backend proxy), Hangar, Spiget, Polymart, Smithed, and GitHub.</li>
        <li><strong>Unified Cart Collection:</strong> Stage items across different categories without immediate downloads.</li>
        <li><strong>Pack Studio & Client-Side Packaging:</strong> Dedicated in-browser curation workspace and ZIP bundling via JSZip with persistent IndexedDB binary storage.</li>
        <li><strong>Dependency Awareness:</strong> Pre-checkout detection of core dependencies like Fabric API and Cloth Config.</li>
        <li><strong>Modpack Interoperability:</strong> Import and export Modrinth <code>.mrpack</code> archives and CraftIndex JSON manifests.</li>
        <li><strong>Standalone Edition:</strong> Single-file offline distribution at <code>dist/index.standalone.html</code>.</li>
      </ul>

      <div class="doc-callout info">
        <h4 class="doc-callout-title">📖 Explore Full Documentation</h4>
        <p>Use the vertical sidebar on the left to navigate through all 22 technical documentation sections covering technical architecture, API proxies, ZIP workflows, hosting configurations, and troubleshooting.</p>
      </div>
    `
  },
  {
    id: "introduction",
    title: "INTRODUCTION",
    icon: "📖",
    html: `
      <h2>01. Introduction</h2>
      <p class="doc-lead-desc">
        CraftIndex is designed for Minecraft players, server administrators, and modpack developers who need a faster, cleaner, and more organized way to acquire game resources.
      </p>
      <p>
        In the standard Minecraft ecosystem, acquiring resources requires opening dozens of browser tabs across conflicting repositories, clicking individual download links, waiting for timers, renaming files, and sorting them into separate folders (<code>mods/</code>, <code>resourcepacks/</code>, <code>shaderpacks/</code>, <code>plugins/</code>).
      </p>
      <p>
        CraftIndex streamlines this entire workflow into a single unified workspace:
      </p>
      <ol class="doc-steps-list">
        <li><strong>Explore:</strong> Browse multiple upstream repositories through clean, unified cyber-glass cards.</li>
        <li><strong>Collect:</strong> Stage mods, shaders, and packs into a temporary session cart with a single click.</li>
        <li><strong>Archive:</strong> Click "Download" to automatically bundle all items into a neatly categorized ZIP archive, ready to drop straight into your <code>.minecraft</code> directory or server root.</li>
      </ol>
      <p>
        CraftIndex adheres to a minimalist, futuristic cyber-glass aesthetic that runs entirely client-side, respecting user privacy, browser performance, and upstream API rate limits.
      </p>
    `
  },
  {
    id: "why-craftindex",
    title: "WHY CRAFTINDEX",
    icon: "💡",
    html: `
      <h2>02. Why CraftIndex</h2>
      <p>Collecting Minecraft resources from multiple platforms presents repetitive hurdles:</p>
      <ul class="doc-feature-list">
        <li><strong>Platform Fragmentation:</strong> Some mods only exist on Modrinth; others remain exclusively on CurseForge; plugins live on SpigotMC or Hangar; datapacks live on Smithed or PlanetMinecraft.</li>
        <li><strong>Manual Repetition:</strong> Installing a 40-mod collection requires visiting 40 pages, clicking 40 download buttons, and handling 40 separate files in your browser downloads folder.</li>
        <li><strong>Folder Disorganization:</strong> Mod files, shaders, resource packs, and datapacks end up intermingled in default download folders, requiring manual sorting.</li>
        <li><strong>Version & Loader Mismatches:</strong> Keeping track of compatible Minecraft versions (e.g., 1.20.1 vs 1.21) across disparate websites is error-prone.</li>
      </ul>
      <blockquote class="doc-quote">
        "CraftIndex was created to simplify the process of finding, collecting and downloading Minecraft resources. The idea is to reduce unnecessary manual work and provide a more organized experience through a unified interface."
      </blockquote>
      <p>
        By centralizing multi-source discovery, automated folder mapping, dependency awareness, and client-side ZIP packaging, CraftIndex eliminates tedious tab-juggling and allows players to get back to playing.
      </p>
    `
  },
  {
    id: "who-it-is-for",
    title: "WHO IT IS FOR",
    icon: "👥",
    html: `
      <h2>03. Who It Is For</h2>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Audience</th>
              <th>Primary Use Cases in CraftIndex</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Individual Players</strong></td>
              <td>Quickly assemble custom client profiles with performance mods (Sodium, Lithium, Iris), favorite shaderpacks, and resource packs in a single archive.</td>
            </tr>
            <tr>
              <td><strong>Server Administrators</strong></td>
              <td>Discover, verify, and bundle Paper/Spigot plugins from Hangar, Spiget, and Polymart for clean server deployments.</td>
            </tr>
            <tr>
              <td><strong>Modpack Creators</strong></td>
              <td>Curate mod lists, inspect file hashes and loaders, export <code>.mrpack</code> distribution archives, and generate shareable JSON collection links.</td>
            </tr>
            <tr>
              <td><strong>Resource Researchers</strong></td>
              <td>Compare release versions, changelogs, dependencies, and author statistics across Modrinth, CurseForge, and GitHub simultaneously.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },
  {
    id: "resource-categories",
    title: "RESOURCE CATEGORIES",
    icon: "📦",
    html: `
      <h2>04. Resource Categories</h2>
      <p>CraftIndex organizes resources into structured categories with tailored metadata and loader filters:</p>
      
      <h3>1. Mods (<code>/mods</code>)</h3>
      <p><strong>Purpose:</strong> Game modifications altering client or server behavior.</p>
      <p><strong>Supported Loaders:</strong> Fabric, Forge, NeoForge, Quilt, LiteLoader, Rift, Babric, Cleanroom, Ornithe.</p>
      <p><strong>Supported Sources:</strong> Modrinth, CurseForge (via backend proxy), PlanetMinecraft, Sponge, GitHub.</p>
      <p><strong>Folder Destination in Archive:</strong> <code>mods/</code></p>

      <h3>2. Plugins (<code>/plugins</code>)</h3>
      <p><strong>Purpose:</strong> Server-side extensions running on Bukkit-compatible software without requiring client mods.</p>
      <p><strong>Supported Platforms:</strong> Paper, Spigot, Purpur, Velocity, BungeeCord, Sponge, Folia, Waterfall.</p>
      <p><strong>Supported Sources:</strong> Hangar (PaperMC), Spiget (SpigotMC), Modrinth, Polymart, Bukkit.</p>
      <p><strong>Folder Destination in Archive:</strong> <code>plugins/</code></p>

      <h3>3. Resource Packs (<code>/resourcepacks</code>)</h3>
      <p><strong>Purpose:</strong> Custom textures, models, sound effects, fonts, and UI overhauls.</p>
      <p><strong>Supported Formats:</strong> Standard Minecraft resource pack ZIP structures with <code>pack.mcmeta</code>.</p>
      <p><strong>Supported Sources:</strong> Modrinth, CurseForge, PlanetMinecraft.</p>
      <p><strong>Folder Destination in Archive:</strong> <code>resourcepacks/</code></p>

      <h3>4. Shaders (<code>/shaders</code>)</h3>
      <p><strong>Purpose:</strong> GLSL post-processing pipelines providing realistic lighting, shadows, waving vegetation, and water reflections.</p>
      <p><strong>Supported Pipelines:</strong> Iris Shaders, Oculus, OptiFine.</p>
      <p><strong>Supported Sources:</strong> Modrinth, CurseForge, GitHub.</p>
      <p><strong>Folder Destination in Archive:</strong> <code>shaderpacks/</code></p>

      <h3>5. Datapacks (<code>/datapacks</code>)</h3>
      <p><strong>Purpose:</strong> Vanilla data modifications adding custom recipes, structures, advancements, and functions without Java code.</p>
      <p><strong>Supported Sources:</strong> Smithed, Modrinth, PlanetMinecraft, CurseForge.</p>
      <p><strong>Folder Destination in Archive:</strong> <code>datapacks/</code></p>
    `
  },
  {
    id: "how-the-interface-works",
    title: "HOW THE INTERFACE WORKS",
    icon: "🖥️",
    html: `
      <h2>05. How the Interface Works</h2>
      <p>The CraftIndex interface is structured into four main functional regions:</p>
      <ul class="doc-feature-list">
        <li><strong>Header Controls:</strong>
          <ul>
            <li><code>Logo:</code> Brand emblem and title; returns to the Home tab.</li>
            <li><code>⚡ Sources:</code> Configure primary and secondary API providers for each category.</li>
            <li><code>ℹ️ About:</code> Opens this About & Documentation Center.</li>
            <li><code>☀️/🌙 Theme:</code> Toggles between Cosmic Purple (Dark) and Daylight Lavender (Light).</li>
            <li><code>Presets:</code> Quick starter configurations for Performance, Visuals, and Utilities.</li>
            <li><code>History:</code> Audit trail of recently viewed and downloaded items.</li>
            <li><code>Cart:</code> Slides open the persistent collection drawer.</li>
          </ul>
        </li>
        <li><strong>Navigation Bar (Tabs):</strong> Fast switching between Home and resource categories, with nested subcategory dropdowns for Mod Loaders and Server Software.</li>
        <li><strong>Search & Filters:</strong> Real-time debounced text search, version selection, loader filtering, and sorting (Relevance, Downloads, Follows, Newest, Updated).</li>
        <li><strong>Resource Grid:</strong> Responsive card deck presenting icon, title, author, version badges, summary, and "+ Add to Cart" buttons.</li>
      </ul>
    `
  },
  {
    id: "supported-sources",
    title: "SUPPORTED SOURCES",
    icon: "🔌",
    html: `
      <h2>06. Supported Sources</h2>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Integration Type</th>
              <th>Auth Requirement</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Modrinth</strong></td>
              <td>Direct Client REST API</td>
              <td>None</td>
              <td><span class="status-badge pass">Fully Supported</span></td>
              <td>Ultra-fast open API; primary source for mods, shaders, and resource packs.</td>
            </tr>
            <tr>
              <td><strong>CurseForge</strong></td>
              <td>Server Proxy (<code>/api/curseforge</code>)</td>
              <td>Optional <code>CF_KEY</code></td>
              <td><span class="status-badge pass">Supported</span></td>
              <td>Proxied through <code>server.js</code>. Key required for official API access.</td>
            </tr>
            <tr>
              <td><strong>Hangar (PaperMC)</strong></td>
              <td>Server Proxy (<code>/api/hangar</code>)</td>
              <td>None</td>
              <td><span class="status-badge pass">Fully Supported</span></td>
              <td>High-quality Paper/Purpur/Velocity server plugins.</td>
            </tr>
            <tr>
              <td><strong>Spiget (SpigotMC)</strong></td>
              <td>Server Proxy (<code>/api/spiget</code>)</td>
              <td>None</td>
              <td><span class="status-badge pass">Fully Supported</span></td>
              <td>Extensive directory of SpigotMC server plugins.</td>
            </tr>
            <tr>
              <td><strong>Polymart</strong></td>
              <td>Server Proxy (<code>/api/polymart</code>)</td>
              <td>None</td>
              <td><span class="status-badge pass">Supported</span></td>
              <td>Community and premium Minecraft server resources.</td>
            </tr>
            <tr>
              <td><strong>Smithed</strong></td>
              <td>Server Proxy (<code>/api/smithed</code>)</td>
              <td>None</td>
              <td><span class="status-badge pass">Fully Supported</span></td>
              <td>Curated registry of vanilla datapacks.</td>
            </tr>
            <tr>
              <td><strong>GitHub Releases</strong></td>
              <td>Server Proxy (<code>/api/github</code>)</td>
              <td>None</td>
              <td><span class="status-badge pass">Supported</span></td>
              <td>Open-source mods and developer releases.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },
  {
    id: "resource-discovery",
    title: "RESOURCE DISCOVERY",
    icon: "🔍",
    html: `
      <h2>07. Resource Discovery</h2>
      <p>The resource discovery workflow operates as follows:</p>
      <ol class="doc-steps-list">
        <li><strong>Category Selection:</strong> Choosing a tab sets the active category (<code>mod</code>, <code>plugin</code>, <code>shaderpack</code>, etc.) and loader context.</li>
        <li><strong>Dynamic Filtering:</strong> Selecting a Minecraft version (e.g. <code>1.20.1</code>) or loader (e.g. <code>Fabric</code>) dynamically scopes the API query parameters.</li>
        <li><strong>Debounced Search:</strong> Typing into the search bar debounces input by 350 ms to avoid spamming upstream APIs.</li>
        <li><strong>Card Rendering:</strong> Upstream responses are normalized into standard CraftIndex resource objects containing title, description, author, download count, icon, and direct download links.</li>
        <li><strong>Detail Inspection:</strong> Clicking any resource card opens the Resource Detail Dashboard with markdown documentation, version tables, gallery screenshots, and external review links.</li>
      </ol>
    `
  },
  {
    id: "collections",
    title: "COLLECTIONS",
    icon: "🛒",
    html: `
      <h2>08. Collections</h2>
      <p>The Collection (Cart) serves as a staging area before downloading:</p>
      <ul class="doc-feature-list">
        <li><strong>Adding Items:</strong> Clicking <code>+ Add</code> on any card immediately registers the item into <code>C.cart</code>.</li>
        <li><strong>Badge Counter:</strong> The header Cart button (<code>#cb</code>) updates in real time with the active item count.</li>
        <li><strong>Drawer Inspection:</strong> Opening the Cart drawer displays all staged items grouped by folder destination (<code>mods/</code>, <code>plugins/</code>, etc.).</li>
        <li><strong>Deduplication:</strong> Adding an already-selected resource updates its version preference rather than creating duplicate entries.</li>
        <li><strong>Item Removal:</strong> Individual items can be removed via the trash button, or the entire cart cleared with <code>Clear All</code>.</li>
        <li><strong>Session Persistence:</strong> Cart items are automatically saved to browser LocalStorage under the key <code>cv_cart</code>.</li>
      </ul>
    `
  },
  {
    id: "bulk-downloads",
    title: "BULK DOWNLOADS",
    icon: "⬇️",
    html: `
      <h2>09. Bulk Downloads</h2>
      <p>CraftIndex performs bulk packaging directly in the user's browser using <strong>JSZip</strong>:</p>
      <ol class="doc-steps-list">
        <li><strong>Validation:</strong> Checks that the cart contains at least one downloadable resource.</li>
        <li><strong>Archive Naming:</strong> Defaults to <code>CraftIndex.inlooker.top-Collection.zip</code>, with full in-drawer renaming support.</li>
        <li><strong>Dependency Check:</strong> If staged mods require unmet dependencies (e.g. Fabric API), the Dependency Resolution Dialog offers one-click inclusion.</li>
        <li><strong>Parallel Fetching:</strong> Downloads raw <code>.jar</code>, <code>.zip</code>, or <code>.mrpack</code> files concurrently via CORS-enabled CDNs or the local proxy.</li>
        <li><strong>Folder Organization:</strong> Automatically places files into structured subdirectories:
          <ul>
            <li><code>mods/*.jar</code></li>
            <li><code>plugins/*.jar</code></li>
            <li><code>resourcepacks/*.zip</code></li>
            <li><code>shaderpacks/*.zip</code></li>
            <li><code>datapacks/*.zip</code></li>
          </ul>
        </li>
        <li><strong>Archive Assembly:</strong> JSZip compresses the organized virtual directory and triggers a single native browser download prompt.</li>
      </ol>
      <div class="doc-callout warning">
        <h4 class="doc-callout-title">⚠️ Network Limitations</h4>
        <p>If an upstream CDN has downtime or blocks direct CORS requests, individual file downloads may fail. CraftIndex skips failed files and completes the archive with all successfully retrieved assets.</p>
      </div>
    `
  },
  {
    id: "settings-preferences",
    title: "SETTINGS & PREFERENCES",
    icon: "⚙️",
    html: `
      <h2>10. Settings & Preferences</h2>
      <p>User preferences are configured via the Settings dialog (<code>⚙️ Settings</code>) and persist across sessions:</p>
      <ul class="doc-feature-list">
        <li><strong>Theme Mode:</strong> Dark (Cosmic Purple), Light (Daylight Lavender), or Auto (System Preference).</li>
        <li><strong>Default Game Version:</strong> Automatically pre-filters search queries to your preferred Minecraft version.</li>
        <li><strong>Loader Preference:</strong> Defaults to Fabric, Forge, NeoForge, or Quilt.</li>
        <li><strong>Primary / Secondary Sources:</strong> Prioritizes Modrinth or CurseForge when resolving items.</li>
        <li><strong>Ambient Background Video:</strong> Enable or disable the animated atmospheric background canvas.</li>
        <li><strong>Grid Layout Density:</strong> Controls card spacing, column count, and compact card mode.</li>
      </ul>
    `
  },
  {
    id: "settings-import-export",
    title: "SETTINGS IMPORT & EXPORT",
    icon: "🔄",
    html: `
      <h2>11. Settings Import & Export</h2>
      <p>Configurations can be backed up or transferred between computers via JSON files:</p>

      <h3>Exporting Settings</h3>
      <p>Clicking <code>Export Settings</code> in the Settings dialog downloads <code>CraftIndex.inlooker.top-settings.json</code>. Contains all visual options, preferred loaders, source weights, and layout parameters.</p>

      <h3>Importing Settings</h3>
      <p>Clicking <code>Import Settings</code> opens a file picker accepting <code>.json</code> configurations. Validates JSON structure, confirms schema version compatibility, updates in-memory config, and refreshes the UI without requiring a page reload.</p>

      <h3>Sample Settings JSON Schema</h3>
      <pre class="doc-code"><code>{
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
}</code></pre>
    `
  },
  {
    id: "modpack-import-export",
    title: "MODPACK IMPORT & EXPORT",
    icon: "📦",
    html: `
      <h2>12. Modpack Import & Export</h2>
      <p>CraftIndex provides bidirectional compatibility with standard Modrinth modpacks:</p>
      <ul class="doc-feature-list">
        <li><strong>Modpack Export (<code>.mrpack</code>):</strong>
          <ul>
            <li>Generates a valid Modrinth <code>modrinth.index.json</code> containing hashes (SHA-1, SHA-512), download URLs, file paths, and dependency metadata.</li>
            <li>Bundles overrides under <code>overrides/</code> and manifests under <code>overrides/craftindex_manifest.json</code>.</li>
            <li>Directly loadable by Prism Launcher, ATLauncher, and the Modrinth App.</li>
          </ul>
        </li>
        <li><strong>Modpack Import (<code>.mrpack</code> / JSON):</strong>
          <ul>
            <li>Unpacks the modpack archive in memory.</li>
            <li>Parses <code>modrinth.index.json</code> to extract project IDs, file versions, and target paths.</li>
            <li>Automatically populates the CraftIndex cart with the full modpack contents for easy modification, subtraction, or addition.</li>
          </ul>
        </li>
      </ul>
    `
  },
  {
    id: "data-browser-storage",
    title: "DATA & BROWSER STORAGE",
    icon: "💾",
    html: `
      <h2>13. Data & Browser Storage</h2>
      <p>CraftIndex stores all persistent state locally in the user's browser using <code>window.localStorage</code>:</p>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Purpose</th>
              <th>Example Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>cv_cart</code></td>
              <td>Active cart items and metadata</td>
              <td>Serialized JSON array of resource cards</td>
            </tr>
            <tr>
              <td><code>cv_settings</code></td>
              <td>Custom user preferences and visual options</td>
              <td>Serialized JSON settings object</td>
            </tr>
            <tr>
              <td><code>cv_mode</code></td>
              <td>Theme selection</td>
              <td><code>"dark"</code>, <code>"light"</code>, or <code>"auto"</code></td>
            </tr>
            <tr>
              <td><code>CraftIndexDB (IndexedDB)</code></td>
              <td>Persistent binary storage for uploaded JARs, ZIPs, and cached collection blobs</td>
              <td><code>binaries</code> store: <code>{ key, blob, name, size, hash, type, modified }</code></td>
            </tr>
            <tr>
              <td><code>cv_primary_source</code></td>
              <td>Default upstream provider</td>
              <td><code>"modrinth"</code> or <code>"curseforge"</code></td>
            </tr>
            <tr>
              <td><code>cv_secondary_source</code></td>
              <td>Fallback upstream provider</td>
              <td><code>"curseforge"</code> or <code>"github"</code></td>
            </tr>
            <tr>
              <td><code>cv_hist</code></td>
              <td>Recently inspected resources</td>
              <td>Array of recent item slugs</td>
            </tr>
            <tr>
              <td><code>cv_migrated</code></td>
              <td>Safe migration marker</td>
              <td><code>"1"</code> (Guards against duplicate migration runs)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>Automatic Legacy Migration</h3>
      <p>On initialization, CraftIndex runs <code>migrateLegacyStorage()</code> to convert legacy <code>ci_*</code> keys to authoritative <code>cv_*</code> keys. Data is verified before old keys are removed, ensuring user preferences and cart contents are preserved across updates.</p>
    `
  },
  {
    id: "technical-architecture",
    title: "TECHNICAL ARCHITECTURE",
    icon: "🏗️",
    html: `
      <h2>14. Technical Architecture</h2>
      <p>CraftIndex is built as a lightweight, frameworkless web application engineered for high performance, zero client bundle overhead, and resilience:</p>
      <pre class="doc-code"><code>[Client Browser]
  ├── index.html               (Semantic markup, dialogs, metadata)
  ├── css/styles.css           (Cosmic purple theme, glassmorphism, responsive queries)
  ├── js/app.js                (State, UI controllers, search, cart, JSZip orchestration)
  ├── js/about_docs.js         (Full About & Documentation single-source-of-truth)
  ├── js/vendor/jszip.min.js   (Client-side ZIP archive compiler)
  └── site.webmanifest         (PWA manifest and icon definitions)
        │
        ├── Direct REST Requests (e.g. Modrinth API)
        │
        └── Local / Node.js Reverse Proxy
              ├── server.js            (Path validation, proxy routing, video streaming)
              ├── Upstream APIs        (CurseForge, Hangar, Spiget, Smithed, GitHub)
              └── dist/index.standalone.html (Self-contained distribution)</code></pre>
      <ul class="doc-feature-list">
        <li><strong>Frontend:</strong> Pure HTML5, modern CSS3 (Custom Properties, Flexbox, Grid, Backdrop Filter), and Vanilla JavaScript (ES2022). Zero bulky dependencies (no React, Vue, or Webpack).</li>
        <li><strong>Styling:</strong> Modular design tokens, WCAG 2.2 compliant <code>:focus-visible</code> states, and <code>@media (prefers-reduced-motion)</code> hooks.</li>
        <li><strong>Packaging:</strong> Self-contained build script (<code>sync_standalone.js</code>) compiles the entire codebase into a single standalone distribution file.</li>
      </ul>
    `
  },
  {
    id: "api-backend",
    title: "API & BACKEND",
    icon: "🌐",
    html: `
      <h2>15. API & Backend</h2>
      <p>While CraftIndex can run purely as a static website for direct APIs like Modrinth, <code>server.js</code> provides a lightweight Node.js HTTP reverse proxy:</p>
      <ul class="doc-feature-list">
        <li><strong>Purpose:</strong> Bypasses browser CORS restrictions on third-party APIs and securely injects developer credentials when proxying requests.</li>
        <li><strong>User-Agent:</strong> All upstream queries send <code>User-Agent: CraftIndex</code>.</li>
        <li><strong>Proxy Routes:</strong>
          <ul>
            <li><code>/api/curseforge/*</code> &rarr; <code>https://api.curseforge.com/*</code> (Injects optional <code>x-api-key: CF_KEY</code>)</li>
            <li><code>/api/hangar/*</code> &rarr; <code>https://hangar.papermc.io/api/v1/*</code></li>
            <li><code>/api/spiget/*</code> &rarr; <code>https://api.spiget.org/v2/*</code></li>
            <li><code>/api/polymart/*</code> &rarr; <code>https://api.polymart.org/v1/*</code></li>
            <li><code>/api/smithed/*</code> &rarr; <code>https://api.smithed.dev/v2/*</code></li>
            <li><code>/api/github/*</code> &rarr; <code>https://api.github.com/*</code></li>
          </ul>
        </li>
        <li><strong>Security Guardrails:</strong>
          <ul>
            <li>Strict path boundary verification via <code>path.resolve</code> prevents directory traversal.</li>
            <li>Directly blocks access to <code>server.js</code>, <code>.env</code>, and dotfiles.</li>
            <li>Video streaming supported via HTTP 206 Partial Content Range headers.</li>
          </ul>
        </li>
      </ul>
    `
  },
  {
    id: "hosting-deployment",
    title: "HOSTING & DEPLOYMENT",
    icon: "☁️",
    html: `
      <h2>16. Hosting & Deployment</h2>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Deployment Mode</th>
              <th>Supported Features</th>
              <th>Requirements</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Node.js Server</strong></td>
              <td>All features: Modrinth, CurseForge, Hangar, Spiget, Polymart, Smithed, GitHub, video streaming.</td>
              <td>Node.js 18+, port 3000 (or <code>process.env.PORT</code>).</td>
              <td>Start with <code>npm start</code> or <code>node server.js</code>.</td>
            </tr>
            <tr>
              <td><strong>Cloudflare Pages (Static)</strong></td>
              <td>Modrinth discovery, collection cart, ZIP generation, settings, standalone mode.</td>
              <td>Any static CDN.</td>
              <td>Proxied APIs (Hangar/Spiget) require Cloudflare Pages Functions or an external proxy.</td>
            </tr>
            <tr>
              <td><strong>Local File Execution</strong></td>
              <td>Standalone mode (<code>dist/index.standalone.html</code>), Modrinth discovery, cart, ZIP download.</td>
              <td>Standard web browser.</td>
              <td>Open directly via <code>file://</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },
  {
    id: "standalone-version",
    title: "STANDALONE VERSION",
    icon: "📱",
    html: `
      <h2>17. Standalone Version</h2>
      <p>The standalone distribution is located at: <code>dist/index.standalone.html</code></p>
      <ul class="doc-feature-list">
        <li><strong>Compilation:</strong> Generated automatically using <code>sync_standalone.js</code> (<code>npm run build</code>).</li>
        <li><strong>Inlining:</strong> Inlines CSS, configuration JSON, and JavaScript into a single distributable HTML document.</li>
        <li><strong>Portability:</strong> Can be stored on a USB drive, shared via Discord, or run without a local web server.</li>
        <li><strong>Asset Links:</strong> Relative asset paths (<code>../images/</code>, <code>../media/</code>, <code>../js/vendor/</code>) ensure icons and local resources resolve correctly when opened from <code>dist/</code>.</li>
      </ul>
    `
  },
  {
    id: "privacy-security",
    title: "PRIVACY & SECURITY",
    icon: "🔒",
    html: `
      <h2>18. Privacy & Security</h2>
      <ul class="doc-feature-list">
        <li><strong>Zero Tracking:</strong> CraftIndex has no trackers, no telemetry scripts, and no external analytics.</li>
        <li><strong>Local State:</strong> All cart items, search histories, and custom settings remain 100% inside your local browser storage.</li>
        <li><strong>Client-Side Archiving:</strong> ZIP files are generated in-memory on your machine. Your download selections are never uploaded to CraftIndex servers.</li>
        <li><strong>Credential Safety:</strong> Never enter Minecraft account passwords or sensitive tokens. No user credentials are required to discover or download public resources.</li>
        <li><strong>Secure Links:</strong> External outbound links use <code>target="_blank" rel="noopener noreferrer"</code> to prevent window opener hijacking.</li>
      </ul>
    `
  },
  {
    id: "compatibility",
    title: "COMPATIBILITY",
    icon: "⚡",
    html: `
      <h2>19. Compatibility</h2>
      <ul class="doc-feature-list">
        <li><strong>Desktop Browsers:</strong> Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari, Brave, Opera (current and prior 2 versions).</li>
        <li><strong>Mobile Browsers:</strong> Chrome for Android, Safari on iOS/iPadOS, Samsung Internet, Firefox Mobile.</li>
        <li><strong>Screen Resolutions:</strong> Tested and verified from small mobile screens (320 &times; 568) to 4K desktop displays (3840 &times; 2160) with zero horizontal overflow.</li>
        <li><strong>Operating Systems:</strong> Windows, macOS, Linux, Android, iOS, ChromeOS.</li>
        <li><strong>Requirements:</strong> JavaScript must be enabled; browser LocalStorage required for cart persistence; Web Workers and Blob API required for Pack Studio ZIP assembly.</li>
      </ul>
    `
  },
  {
    id: "troubleshooting",
    title: "TROUBLESHOOTING",
    icon: "🛠️",
    html: `
      <h2>20. Troubleshooting</h2>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Probable Cause</th>
              <th>Recommended Resolution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Search returns no results</strong></td>
              <td>Upstream API rate limit or strict filter combination.</td>
              <td>Clear version/loader filters, check search spelling, or wait 30 seconds for rate limits to reset.</td>
            </tr>
            <tr>
              <td><strong>CurseForge results fail to load</strong></td>
              <td>Missing <code>CF_KEY</code> in <code>server.js</code> or proxy offline.</td>
              <td>Ensure <code>server.js</code> is running and supply an API key in <code>.env</code>, or switch primary source to Modrinth.</td>
            </tr>
            <tr>
              <td><strong>Cart is empty after closing browser</strong></td>
              <td>Private browsing mode or cleared LocalStorage.</td>
              <td>Use standard browser mode; ensure browser settings do not clear storage on exit.</td>
            </tr>
            <tr>
              <td><strong>ZIP download fails to trigger</strong></td>
              <td>Browser blocked multiple download popups.</td>
              <td>Allow popups and downloads for <code>craftvault.inlooker.top</code> in browser site settings.</td>
            </tr>
            <tr>
              <td><strong>Settings JSON import error</strong></td>
              <td>Malformed or incompatible JSON schema.</td>
              <td>Re-export settings from CraftIndex to inspect valid format; ensure valid JSON syntax.</td>
            </tr>
            <tr>
              <td><strong>Backend proxy connection refused</strong></td>
              <td>Port 3000 occupied or server not running.</td>
              <td>Run <code>npm start</code> in the project terminal or check <code>Get-NetTCPConnection -LocalPort 3000</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },
  {
    id: "faq",
    title: "FAQ",
    icon: "❓",
    html: `
      <h2>21. Frequently Asked Questions (FAQ)</h2>
      
      <div class="doc-faq-item">
        <h4>What is CraftIndex?</h4>
        <p>CraftIndex is a high-performance client-centric Minecraft resource discovery engine, Pack Studio, and multi-resource packager. It allows you to search across supported platforms, stage multiple resources into a single collection, inspect archives with persistent IndexedDB storage, and export them as standard-compliant ZIP archives.</p>
      </div>

      <div class="doc-faq-item">
        <h4>Is CraftIndex a Minecraft launcher?</h4>
        <p>No. CraftIndex does not launch Minecraft, manage game processes, or log into Microsoft accounts. It is a discovery and file preparation utility designed to complement launchers like Prism Launcher, Modrinth App, ATLauncher, and the official launcher.</p>
      </div>

      <div class="doc-faq-item">
        <h4>Which sources are supported?</h4>
        <p>Modrinth, CurseForge (via backend proxy), Hangar (PaperMC), Spiget (SpigotMC), Polymart, Smithed, and GitHub.</p>
      </div>

      <div class="doc-faq-item">
        <h4>How do I download multiple resources at once?</h4>
        <p>Browse resources in any category, click <code>+ Add</code> to add them to your cart, click the <code>Cart</code> button in the header, review your selections, and click <code>⬇ Download</code>. CraftIndex will fetch each file and bundle them into a single ZIP.</p>
      </div>

      <div class="doc-faq-item">
        <h4>Where are the downloaded files placed inside the ZIP?</h4>
        <p>Files are automatically organized into standard Minecraft directories: mods go into <code>mods/</code>, server plugins into <code>plugins/</code>, shaders into <code>shaderpacks/</code>, resource packs into <code>resourcepacks/</code>, and datapacks into <code>datapacks/</code>.</p>
      </div>

      <div class="doc-faq-item">
        <h4>Can I import Modrinth modpacks?</h4>
        <p>Yes! Click <code>Import</code> in the cart drawer and select any <code>.mrpack</code> archive. CraftIndex will parse its index and add all constituent mods directly into your cart.</p>
      </div>

      <div class="doc-faq-item">
        <h4>Where are my settings and cart items stored?</h4>
        <p>All data is stored exclusively in your browser's <code>window.localStorage</code>. Nothing is stored on CraftIndex servers.</p>
      </div>

      <div class="doc-faq-item">
        <h4>Does CraftIndex work completely offline?</h4>
        <p>The user interface and standalone file (<code>dist/index.standalone.html</code>) can be opened offline. However, searching live resource catalogs and downloading new files requires an active internet connection.</p>
      </div>
    `
  },
  {
    id: "credits-project-links",
    title: "CREDITS & PROJECT LINKS",
    icon: "🔗",
    html: `
      <h2>22. Credits & Project Links</h2>
      <div class="doc-card-link-box">
        <p><strong>Product:</strong> CraftIndex</p>
        <p><strong>Creator & Maintainer:</strong> Arata Inlooker</p>
        <p><strong>Official Website:</strong> <a href="https://craftvault.inlooker.top" target="_blank" rel="noopener noreferrer">https://craftvault.inlooker.top</a></p>
        <p><strong>Creator Portfolio:</strong> <a href="https://inlooker.top" target="_blank" rel="noopener noreferrer">https://inlooker.top</a></p>
        <p><strong>GitHub Repository:</strong> <a href="https://github.com/ArataInlooker/CraftIndex" target="_blank" rel="noopener noreferrer">https://github.com/ArataInlooker/CraftIndex</a></p>
        <p><strong>Contact Email:</strong> <a href="mailto:aratainlooker@gmail.com">aratainlooker@gmail.com</a></p>
        <p><strong>License:</strong> MIT License</p>
      </div>
      <p class="doc-footnote">
        <em>CraftIndex is an independent open-source project and is not affiliated with, endorsed by, or associated with Mojang Studios, Microsoft, CurseForge, or Modrinth.</em>
      </p>
    `
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = ABOUT_DOCS;
}
