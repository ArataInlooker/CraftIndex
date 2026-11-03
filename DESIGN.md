# CraftIndex Design System & Visual Specification

**Product:** CraftIndex  
**Authoritative Maintainer:** Arata Inlooker ([aratainlooker@gmail.com](mailto:aratainlooker@gmail.com))  
**Repository:** [https://github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)  
**Primary Domain:** [https://craftvault.inlooker.top](https://craftvault.inlooker.top)  
**Specification Version:** 2.6.0  
**Status:** Living Design Standard

---

## 1. Brand Identity & Visual Direction

CraftIndex is a specialized, production-grade Minecraft resource discovery platform, modpack creator, and bulk packaging engine. Its visual identity balances developer-tool utility (Linear, GitHub, Vercel) with thematic atmospheric depth inspired by Minecraft's cosmic and amethyst aesthetics.

### Core Visual Principles

1. **Intentional Over Decorative:** Every border, shadow, background tint, and interaction must serve a structural or informational purpose. Elements are never added solely to make a layout appear "futuristic" or "sci-fi".
2. **Atmospheric Restraint:** Dark cosmic purple tones establish atmosphere, but contrast, typography, and legibility always take precedence. Avoid saturated neon purple glows, oversaturated gradients, or radioactive drop-shadows.
3. **Tactile Elevation:** Depth is achieved through subtle border contrast (`rgba(179, 136, 255, 0.15)` to `rgba(179, 136, 255, 0.35)`), disciplined multi-stop dark surface tiers, and calibrated natural shadows—never via continuous floating or pulsing animations.
4. **Instant Responsiveness:** UI interactions use concise micro-transitions (150ms–220ms). No gratuitous keyframe loops, scaling wobbles, or heavy blur filters that trigger GPU rasterization thrashing.

---

## 2. Official Color Palette & Token System

CraftIndex employs a dual-theme architecture: **Cosmic Obsidian (Dark Mode / Default)** and **Daylight Crystal (Light Mode)**.

### 2.1 Cosmic Obsidian (Dark Mode) Tokens

| Token | Hex / Value | Semantic Role | Contrast / Usage |
| :--- | :--- | :--- | :--- |
| `--bg` | `#0c0915` | Canvas background | Deep void base |
| `--r` | `#161126` | Tier 1 Surface (Cards, Headers) | Card background, input fills |
| `--r2` | `#221a3a` | Tier 2 Surface (Elevated Panels) | Dropdown menus, tooltips, dialogs |
| `--bd` | `rgba(179, 136, 255, 0.20)` | Structural Border | Card boundaries, dividers |
| `--bd-focus` | `rgba(179, 136, 255, 0.55)` | Active Border | Focused inputs, selected cards |
| `--b` | `#b388ff` | Primary Accent (Amethyst Violet) | Focus rings, active tabs, text highlights |
| `--b2` | `#7c4dff` | Secondary Accent (Deep Purple) | Accent gradients, secondary actions |
| `--w` | `#fcf4ff` | Primary Text | Headings, titles, high-contrast labels |
| `--t` | `#d8cee8` | Secondary Text | Body descriptions, metadata, subtitles |
| `--t-muted` | `#9c8eb5` | Tertiary / Placeholder Text | Timestamps, secondary tags, input hints |
| `--red` | `#ff6b8f` | Destructive Action | Clear cart, error states, removal |
| `--green` | `#34d399` | Success / Active State | Verified status, import confirmation |
| `--amber` | `#fbbf24` | Warning / External Dependency | Dependency notices, external links |

### 2.2 Daylight Crystal (Light Mode) Tokens

| Token | Hex / Value | Semantic Role | Contrast / Usage |
| :--- | :--- | :--- | :--- |
| `--bg-light` | `#f8f5fc` | Light Canvas Background | Soft amethyst-tinted paper |
| `--r-light` | `#ffffff` | Light Tier 1 Surface | Crisp white card surface |
| `--r2-light` | `#f3ecfa` | Light Tier 2 Surface | Subtle elevated panels, active tabs |
| `--bd-light` | `rgba(147, 51, 234, 0.18)` | Light Border | Clean structural division |
| `--b-light` | `#7c3aed` | Light Primary Accent | High-legibility deep violet |
| `--w-light` | `#160b2b` | Light Primary Text | Ultra-dark violet (WCAG AAA compliant) |
| `--t-light` | `#4a3869` | Light Secondary Text | Clear descriptive copy (4.5:1+ contrast) |

---

## 3. Typography & Hierarchy

CraftIndex uses the **Inter** variable font family exclusively, bundled offline in `fonts/inter/` for privacy, performance, and resilience.

### Font Scale & Leading

| Level | Size | Weight | Line Height | Letter Spacing | Element / Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | 30px–36px | 800 (Bold) | 1.18 | -0.025em | Overview hero, main page headers |
| **Section Heading** | 22px–24px | 700 (Bold) | 1.25 | -0.015em | Category group titles, modal headers |
| **Card Title** | 16px–17px | 700 (Bold) | 1.30 | -0.010em | Mod, plugin, and pack card titles |
| **Subtitle / Subhead** | 14px–15px | 500 (Medium) | 1.45 | 0 | Dialog subheadings, section descriptions |
| **Body Standard** | 14px | 400 (Regular) | 1.55 | 0 | Resource descriptions, documentation |
| **Interface / Button** | 13px–14px | 600 (Semi-bold) | 1.20 | 0.005em | Buttons, filter controls, tab labels |
| **Caption / Badge** | 11.5px–12px | 700 (Bold) | 1.20 | 0.025em | Version tags, loader chips, counts |
| **Micro / Legal** | 11px | 500 (Medium) | 1.40 | 0.010em | Copyright notices, SHA-256 hashes |

---

## 4. Spacing, Layout & Grid Principles

All spatial measurements adhere to a strict **4px/8px baseline grid**.

### Spatial Scale
- **2xs:** 4px (tight badge padding, inline icon gap)
- **xs:** 8px (component interior gaps, button internal spacing)
- **sm:** 12px (form element gap, filter row spacing)
- **md:** 16px (card padding, standard section gap)
- **lg:** 20px–24px (drawer padding, modal headers, grid gaps)
- **xl:** 32px–40px (hero padding, major section divisions)

### Layout Containers
- **Main App Container:** Max width `1440px` (or user-customized up to `1720px`), centered with `0 auto`.
- **Resource Grid:** Responsive CSS Grid using `repeat(auto-fill, minmax(340px, 1fr))` with `16px` to `20px` gaps.
- **Card Aspect Ratio & Sizing:** Consistent 2-row layout with an 84×84px left icon column and flexible metadata right column. Cards in the same grid row strictly match height.

---

## 5. Components & Interactive Elements

### 5.1 Buttons

Buttons represent actionable operations. They must never be decorative placeholders.

- **Primary Button (`.btn.p`):** Accent gradient (`linear-gradient(135deg, var(--b2), var(--b))`), dark text (`var(--on)`), 8px border-radius. Used for key actions: Export Collection, Add to Cart, Apply Filters.
- **Secondary Button (`.btn`):** Subdued surface (`var(--r2)`), light text (`var(--w)`), subtle border (`var(--bd)`). Used for standard actions: Presets, History, Settings, Docs.
- **Destructive Button (`.btn.d`):** Dark surface with crimson accent (`var(--red)`). Used for irreversible actions: Clear Collection, Remove Item.
- **Icon Tool Button (`.dr-tool-btn`):** 36×36px or 40×40px square/circular icon button with centered glyph.

### 5.2 Cards & Containers

- **Resource Card (`.cd`):** Surface `var(--r)` (`#161126`), border `1px solid var(--bd)`, radius `14px`.
- **Hover Feedback:** Crisp `translateY(-2px)` elevation, subtle border color brighten (`rgba(179, 136, 255, 0.45)`), and a refined dark shadow (`0 10px 24px -4px rgba(0, 0, 0, 0.45)`). **No rotating icons, scale jumps, or blinding purple glows.**
- **Selected Card (`.cd.sel`):** Border `2px solid var(--b)`, crisp inner highlight.

### 5.3 Filter Controls & Custom Dropdowns

- Standardized trigger height (38px–42px).
- Native styling fallback for assistive technology and mobile viewports.
- Custom dropdown menus render with crisp, non-transparent surfaces (`#0f0a1c`), clean borders, and natural shadows. Menus dismiss immediately on outside click or Escape key.

### 5.4 Modals & Drawers

- **Backdrop:** Uniform `rgba(4, 2, 10, 0.75)` with subtle `backdrop-filter: blur(8px)`.
- **Drawer (`.dr`):** Sliding side sheet (max width 460px), cleanly attached to the right viewport border with a single 1px divider.
- **Dialogs (`.about-modal`, `.dep-modal`):** Centered overlay windows with clear header, scrollable body, and sticky action footer.

---

## 6. Feedback, States & Error Handling

1. **Loading State:** Deterministic, elegant spinner (`.cyber-spinner`) centered with an informative text label explaining what is loading (e.g. "Fetching Modrinth catalog..."). No vibrating or pulsating containers.
2. **Empty State:** Neutral, non-animated icon, clear descriptive title (e.g. "Your collection is empty"), and a clear call-to-action button (e.g. "Browse Mods").
3. **Error State:** Descriptive message explaining what failed and why, accompanied by a clean "Retry" button. Never display cryptic raw stack traces or silent failures.
4. **Success State:** Non-intrusive toast notification (`.toast`) appearing at bottom-center or top-right, auto-dismissing after 2800ms.

---

## 7. Motion & Accessibility (A11y) Standards

### 7.1 Motion Rules
- **Standard Transition:** `all 0.18s cubic-bezier(0.16, 1, 0.3, 1)`.
- **Modal Open/Close:** `0.22s ease-out`.
- **Looping Animations:** Strictly prohibited (no floating icons, infinite scale pulses, or bouncing badges).
- **Reduced Motion:** When `@media (prefers-reduced-motion: reduce)` is detected, all transitions, transforms, and background video loops must be disabled immediately.

### 7.2 Accessibility Requirements (WCAG 2.1 AA)
- **Color Contrast:** All body and label text must maintain at least 4.5:1 contrast against its immediate background. Headings must achieve at least 3:1.
- **Focus Rings:** All interactive elements must show a distinct focus ring (`outline: 2px solid var(--b); outline-offset: 2px;`) when navigated via keyboard (`:focus-visible`).
- **Semantic Structure:** Proper `<header>`, `<main>`, `<nav>`, `<aside>`, `<footer>`, `<h1>`–`<h3>`, and ARIA roles (`role="dialog"`, `role="tablist"`, `aria-selected`, `aria-expanded`).

---

## 8. Prohibited Design Anti-Patterns

The following patterns are **explicitly prohibited** in CraftIndex:

- ❌ **No Radioactive Glows:** Avoid `box-shadow: 0 0 25px #b388ff`, `0 0 35px`, or oversaturated outer drop-shadows.
- ❌ **No Excessive Glassmorphism:** Do not use `backdrop-filter: blur(36px)` across stacked containers.
- ❌ **No Gratuitous Animation Loops:** No `@keyframes floatCart`, `@keyframes pulseButton`, or infinite scaling.
- ❌ **No Arbitrary Card Wobbles:** No rotating images (`rotate(-1deg)`) or scale transitions on hover.
- ❌ **No Fake UI Elements:** Every button, tab, chip, and badge must connect to actual data or trigger a real action.
- ❌ **No Hyperbolic AI Copy:** Avoid generic buzzwords like "definitive cosmic repository", "unleash the ultimate power", or "revolutionary Minecraft experience". Write like a seasoned software engineer building dependable software.
