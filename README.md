# 🌌 CraftIndex

> **A Minimalist, Cosmic Purple bulk downloader for Minecraft mods, plugins, resource packs, shaders, and data packs.**

📚 **Full Documentation:** See [docs/CRAFTINDEX_DOCUMENTATION.md](file:///c:/Users/yogde/OneDrive/Documents/REA/docs/CRAFTINDEX_DOCUMENTATION.md) for the complete 23-section architecture, API reference, and user guide.

> **PROPRIETARY SOFTWARE · ALL RIGHTS RESERVED**
>
> CraftIndex is publicly viewable source-available software, not an open-source project.
>
> Copyright © 2026 Arata Inlooker. All rights reserved.
>
> Public visibility does not grant general permission to copy, modify, redistribute, rebrand, or commercially exploit CraftIndex.
>
> GitHub's platform terms permit viewing and forking public repositories. All other rights remain reserved, subject to applicable law and third-party licenses.
>
> See [LICENSE.md](LICENSE.md) for the copyright notice and permissions information.

---

## ✨ Features & Ambient Themes

- 🛠️ **Pack Studio (`/studio/`):** Full-screen collection builder with deep native ZIP & JAR recursive parsing (Fabric, Quilt, Forge, NeoForge, legacy Forge, plugins, datapacks, resourcepacks).
- 💾 **IndexedDB Persistent Binary Storage:** Stores uploaded JAR and ZIP binaries in browser IndexedDB (`CraftIndexDB`), surviving page reloads and browser restarts with matching SHA-256 hashes.
- 📦 **Collection ZIP Export:** Bundles multi-folder archives (`mods/`, `plugins/`, `resourcepacks/`, `shaderpacks/`, `datapacks/`) complete with `craftindex_manifest.json`.
- 🗂️ **Canonical Routing & Deep Linking:** Direct URL access for `/mods/`, `/mods/fabric/`, `/studio/`, `/docs/` with fresh-browser HTTP 200 resolution.
- 🌧️ **Dark Mode Ambient:** *rainy-evening-minecraft.mp4* video background with cosmic purple glassmorphism.
- 🌸 **Light Mode Ambient:** *sakura-forest-minecraft.mp4* video background with soft cherry blossom translucency.
- 🌓 **Dynamic Cross-Fade:** Smoothly toggles between themes with the `🌓` button.
- 🧩 **Modrinth API v2:** Real-time search, category tabs, and loader filters (Fabric, Forge, NeoForge, Quilt, Paper, Spigot, Purpur, Iris, OptiFine).
- 📦 **In-Browser Bulk Archiving:** Directly downloads and bundles `.jar` and `.zip` files in RAM via JSZip.
- 🅰️ **100% Offline Fonts:** Self-hosted Inter font in `fonts/inter/` (zero external CDN tracking/requests).

---

## 🚀 Quick Start

### Option 1: Run Local Server (Recommended for video streaming)
```bash
npm start
```
Then visit **`http://localhost:3000`** in your browser.

### Option 2: Build Standalone Single-File Distribution
```bash
npm run build
```
Generates a standalone portable file at `dist/index.standalone.html`.

> [!NOTE]
> `dist/index.standalone.html` must remain inside the `dist/` folder because its relative asset paths (e.g. `../images/`, `../media/`, and `../js/vendor/`) depend on being one level down from the project root.

---

## 🔐 Environment Variables

CraftIndex keeps all secrets out of client code. Any sensitive credential is read strictly from environment variables on the host.

Copy `.env.example` to `.env` for local runs:
```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the local HTTP streaming and proxy server. |
| `CF_KEY` | *(empty)* | CurseForge Core API key used exclusively by `server.js` when proxying CurseForge queries. |

> [!IMPORTANT]
> - **Never commit `.env` or any real API keys to version control.** `.env` is ignored by `.gitignore`.
> - If deploying to a hosting provider (Docker, VPS, Cloud Run, Render, etc.), set `CF_KEY` directly in the host's dashboard / environment settings rather than in code.
> - Modrinth and other primary sources work without any API key.

---

## 📁 File Structure

```
REA/
├── index.html                      # Production modular entry point
├── config.json                     # Central site configuration
├── package.json                    # Project manifest
├── server.js                       # Local HTTP streaming server (supports Range requests)
├── sync_standalone.js              # Standalone single-file compiler
├── README.md                       # Project documentation
├── css/
│   └── styles.css                  # Modern glassmorphism CSS & localized fonts
├── js/
│   ├── app.js                      # Core client application logic
│   └── vendor/
│       └── jszip.min.js            # Client-side zip compression library
├── fonts/
│   └── inter/                      # Localized Inter variable woff2 fonts (100% offline)
├── images/
│   ├── craftindex-logo.png         # Authoritative Cyber-Glass Amethyst Cube Logo (1024x1024)
│   ├── craftindex-logo.webp        # High-performance web-optimized logo
│   ├── craftindex-icon.png         # High-DPI application icon asset (512x512)
│   ├── apple-touch-icon.png        # iOS Home Screen bookmark icon (180x180)
│   ├── favicon-32x32.png           # Standard 32x32 browser tab icon
│   ├── favicon-16x16.png           # Standard 16x16 browser tab icon
│   ├── favicon.ico                 # Multi-resolution ICO container (16/32/48/64)
│   └── bigger-image.png            # Social share preview banner (1672x941)
├── favicon.ico                     # Root favicon
├── site.webmanifest                # Web application manifest
├── media/
│   ├── rainy-evening-minecraft.mp4 # Dark mode ambient video
│   └── sakura-forest-minecraft.mp4 # Light mode ambient video
└── dist/
    └── index.standalone.html       # Standalone distribution edition
```

---

## 👤 Author & Project Identity

- **Product Name:** CraftIndex
- **Creator / Maintainer:** Arata Inlooker ([aratainlooker@gmail.com](mailto:aratainlooker@gmail.com))
- **Official Website:** [craftvault.inlooker.top](https://craftvault.inlooker.top)
- **GitHub Repository:** [https://github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)
- **License:** MIT
