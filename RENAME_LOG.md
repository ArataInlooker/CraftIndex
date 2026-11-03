# CraftIndex Official Rebranding & Product Rename Log

**Date:** 2026-11-02  
**Action:** Formal Rebranding & Nomenclature Migration  
**Previous Brand / Name:** CraftVault  
**Authoritative New Name:** CraftIndex  
**Authoritative Maintainer:** Arata Inlooker (aratainlooker@gmail.com)  

---

## 1. Executive Overview

On November 2, 2026, the product formerly designated as **CraftVault** was officially renamed to **CraftIndex**.

This rename encompasses all customer-facing touchpoints, UI representations, documentation, persistent storage mechanisms, and packaging schemas.

---

## 2. Nomenclature & Casing Conventions

- **PascalCase ("CraftIndex"):** Used for all human-facing display text, page titles, headers, navigation labels, UI cards, modal dialogs, and official documentation prose.
- **Lowercase ("craftindex"):** Used for identifiers, slugs, filenames, and package metadata (e.g. `package.json` package name `craftindex`, manifest filename `craftindex_manifest.json`, and logo filenames `craftindex-logo.png`).

---

## 3. Historical Reports & Pre-Existing Audit Ledgers

The following historical reports in the repository root document engineering phases executed under the former product name. In accordance with strict software engineering audit standards and historical integrity rules, these files are preserved in their original state and predate this renaming:

1. `ultimate_prompt_work_report.txt` (Comprehensive architecture overhaul ledger)
2. `publish_readiness_report.txt` (Pre-publish gap closure and audit report)
3. `home_card_removal_report.txt` (Audit report on homepage SSR banner resolution)
4. `settings_modal_fix_report.txt` (Settings modal layout audit)
5. `settings_modal_fix_report_v2.txt` (Computed styles and switch validation audit)
6. `css/styles.css.bak` (Archival CSS snapshot)

---

## 4. Persistent Data & Migration Architecture

1. **IndexedDB Persistent Binary Storage:**
   - Previous Database: `CraftVaultDB` (Version 1)
   - Current Database: `CraftIndexDB` (Version 1)
   - Migration: An automated on-startup migration transfers all records from `CraftVaultDB` into `CraftIndexDB`, validates record counts and SHA-256 integrity, and sets `ci_idb_migrated`. The legacy `CraftVaultDB` is retained intact for safekeeping.

2. **Collection Manifests & Backwards Compatibility:**
   - New Exports: `craftindex_manifest.json` (schema 1.1.0).
   - Dual-Support: The archive import engine actively recognizes and parses both `craftindex_manifest.json` and legacy `craftvault_manifest.json`.

3. **Global Script API:**
   - Primary Object: `window.CraftIndexStudio`
   - Alias: `window.CraftVaultStudio = window.CraftIndexStudio`

4. **Documentation Anchors:**
   - Primary Section: `why-craftindex`
   - Alias Map: Queries to `#why-craftvault` and `#03-why-craftvault` redirect smoothly to `why-craftindex`.

5. **LocalStorage Schema:**
   - `cv_*` key prefix retained to prevent any accidental user session or cart state loss across browser reloads.

---

## 5. Infrastructure & External Services

- **Hosting & DNS:** The live deployment continues to serve from `craftvault.inlooker.top` until a new custom domain is registered and DNS/hosting is configured by the project owner. The codebase has been made configurable via `CRAFTINDEX_DOMAIN`.
- **GitHub Repository:** The upstream repository URL remains `https://github.com/ArataInlooker/CraftVault` until renamed by the owner in GitHub repository settings.
