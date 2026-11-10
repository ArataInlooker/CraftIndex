# CraftIndex Design System & Enforceable Visual Specification

**Product:** CraftIndex  
**Authoritative Maintainer:** Arata Inlooker ([aratainlooker@gmail.com](mailto:aratainlooker@gmail.com))  
**Repository:** [https://github.com/ArataInlooker/CraftIndex](https://github.com/ArataInlooker/CraftIndex)  
**Primary Domain:** [https://craftindex.inlooker.top](https://craftindex.inlooker.top)  
**Specification Version:** 2.6.1
**Status:** Mandatory Enforceable Standard for Human Developers & AI Agents

---

## 1. Brand Identity & Visual Direction

CraftIndex is a specialized, production-grade Minecraft resource discovery platform, Pack Studio, and multi-resource packaging engine. Its visual identity balances developer-tool utility (Linear, GitHub, Vercel) with atmospheric depth inspired by Minecraft's amethyst and obsidian themes.

### Core Visual Principles

1. **Intentional Over Decorative:** Every border, shadow, background tint, and interaction must serve a structural or informational purpose. No decorative animations, rotating images, scaling wobbles, or radioactive glowing drop-shadows.
2. **Atmospheric Restraint:** Dark cosmic purple tones establish atmosphere, but contrast, typography, and legibility always take precedence. Text contrast must strictly comply with WCAG 2.2 AA (≥ 4.5:1 for normal text).
3. **Tactile Elevation:** Depth is achieved through subtle 1px border separation (`var(--colors-border)`), disciplined multi-stop dark surface tiers, and calibrated natural shadows—never via continuous floating or pulsing animations.
4. **Compositing & Scroll Performance:** To eliminate dropped frames and scroll flicker, nested `backdrop-filter` rules are strictly prohibited. Child buttons inside blurred headers, cards, and drawers must have `backdrop-filter: none`.
5. **Deterministic Interaction:** UI interactions use concise micro-transitions (150ms–200ms) with zero layout shifting.

---

## 2. Official Color Palette & Token System

`css/tokens.css` is the authoritative single source of truth for all colors, dimensions, and spacing.

### 2.1 Primitive Colors
Tailwind-style calibrated scales:
- **Brand Palette:** `--brand-50` through `--brand-950` (amethyst violet core `#9333ea`, `#7c3aed`, `#6b21a8`).
- **Neutral Palette:** `--neutral-50` through `--neutral-950` (rich obsidian `#0c0915`, `#161126`).
- **Feedback Scales:**
  - Success: `--green-50` to `--green-900` (`#10b981`)
  - Warning: `--amber-50` to `--amber-900` (`#f59e0b`)
  - Danger: `--red-50` to `--red-900` (`#ef4444`)
  - Info: `--blue-50` to `--blue-900` (`#0284c7`)

### 2.2 Semantic Tokens (Dark Theme — Default)

| Semantic Token | Value / Mapping | Role & Application |
|---|---|---|
| `--colors-background` | `#0c0915` (`var(--neutral-950)`) | Deep canvas background |
| `--colors-background-subtle` | `#110c1d` | Secondary canvas sections |
| `--colors-surface` | `#161126` | Card backgrounds, inputs |
| `--colors-surface-raised` | `#1c1530` | Elevated dropdowns, modal windows |
| `--colors-text-primary` | `#e8e0f5` | High-contrast headings and body text |
| `--colors-text-secondary` | `#c3b6dc` | Subtitles, labels, metadata |
| `--colors-text-muted` | `#8b7ea6` | Timestamps, fine print, placeholders |
| `--colors-primary` | `#b388ff` (`var(--brand-400)`) | Focus rings, text highlights |
| `--colors-primary-btn` | `linear-gradient(135deg, #9333ea, #7c3aed)` | Primary call-to-action buttons |
| `--colors-primary-btn-text`| `#ffffff` | Primary button text |
| `--colors-border` | `rgba(179, 136, 255, 0.15)` | Subtle 1px structural separation |
| `--colors-border-strong` | `rgba(179, 136, 255, 0.40)` | Active borders, selected states |
| `--colors-focus-ring` | `#b388ff` | Focus indicator outline |

### 2.3 Semantic Tokens (Light Theme — Daylight Crystal)

| Semantic Token | Value / Mapping | Role & Application | Contrast Ratio |
|---|---|---|---:|
| `--colors-background` | `#f8f4fc` | Paper canvas background | Canvas base |
| `--colors-surface` | `#ffffff` | Card and modal surfaces | High legibility |
| `--colors-surface-raised` | `#ffffff` | Elevated dialogs, tooltips | Elevated surface |
| `--colors-text-primary` | `#180c2e` | Primary text | **15.2 : 1** (AAA) |
| `--colors-text-secondary` | `#4a3869` | Secondary text | **8.1 : 1** (AAA) |
| `--colors-text-muted` | `#64748b` | Muted descriptions, hints | **4.6 : 1** (AA) |
| `--colors-primary` | `#9333ea` | Interactive violet accent | **6.4 : 1** (AA) |
| `--colors-primary-btn` | `linear-gradient(135deg, #9333ea, #7c3aed)` | Primary button gradient | High contrast |
| `--colors-primary-btn-text`| `#ffffff` | Primary button text | **5.8 : 1** (AA) |
| `--colors-border` | `rgba(225, 210, 240, 0.85)` | Subtle light structural division | Clean division |
| `--colors-border-strong` | `rgba(147, 51, 234, 0.35)` | Active borders, input focus | Visible boundary |
| `--colors-focus-ring` | `#7e22ce` | Focus indicator outline | **7.5 : 1** (AAA) |

---

## 3. Typography & Hierarchy Standards

CraftIndex strictly uses the **Inter** font family (`fonts/inter/`).

### Font Weight Rules (Mandatory)
- **400 (Regular):** Default weight for all body descriptions, metadata values, fine print, table data, and input text.
- **500 (Medium):** Standard weight for ordinary buttons, tab labels, form labels, and category badges.
- **600 (Semi-bold):** Reserved strictly for section titles, active navigation tabs, primary action buttons, and modal headers where genuine hierarchy demands it.
- **700 / 800+ (Bold):** **Prohibited** on ordinary buttons, navigation items, labels, badges, and body copy. Reserved exclusively for major display hero titles (`≥ 24px`).

### Type Scale
- `--text-xs` (12px): Badges, fine print, version chips
- `--text-sm` (13px): Metadata values, secondary interface labels
- `--text-base` (14px): Standard application body copy, input text
- `--text-lg` (16px): Card titles, modal headers
- `--text-xl` (18px): Section headings
- `--text-2xl` (22px): Major page headings
- `--text-3xl` (28px): Hero display titles

---

## 4. Spacing, Borders & Shadows

### 4.1 Spacing Scale
All margins, padding, and gaps adhere to a strict **4px/8px grid**:
- 4px (`--space-1`), 8px (`--space-2`), 12px (`--space-3`), 16px (`--space-4`), 20px (`--space-5`), 24px (`--space-6`), 32px (`--space-8`), 40px (`--space-10`).

### 4.2 Border Rules
- All structural boundaries use **subtle 1px borders** (`1px solid var(--colors-border)`).
- Never use transparent 2px borders as a universal spacing hack.
- Stronger borders (2px) are reserved strictly for keyboard `:focus-visible` and active selected states.

### 4.3 Elevation & Shadows
- **Card Surfaces:** Subtle elevation (`0 2px 8px rgba(0, 0, 0, 0.15)` in dark, `0 2px 8px rgba(160, 120, 180, 0.08)` in light).
- **Elevated Modals / Drawers:** Soft elevation (`0 16px 48px rgba(0, 0, 0, 0.6)` in dark, `0 16px 48px rgba(120, 80, 160, 0.18)` in light).
- **Prohibited:** Saturated outer glows (`box-shadow: 0 0 30px #b388ff`) and heavy dark shadows on ordinary surface elements.

---

## 5. Standardized Button Component System

All buttons share standardized dimensions, padding, and interaction feedback:

| Variant | Class | Styling & Role | Dimensions |
|---|---|---|---|
| **Primary Button** | `.btn.p` | Gradient fill (`#9333ea` to `#7c3aed`), `#ffffff` text, font-weight 600. Key call-to-action (Add to Cart, Download). | Height: 38px, Padding: 0 16px, Radius: 10px |
| **Secondary Button** | `.btn` | Subtle glass surface (`rgba(255,255,255,0.08)` dark, `#ffffff` light), 1px border, font-weight 500. Standard actions (Presets, History, Settings). | Height: 38px, Padding: 0 16px, Radius: 10px |
| **Destructive Button** | `.btn.danger` | Crimson text (`#ef4444` dark, `#dc2626` light), subtle tinted surface. Irreversible actions (Clear Cart, Delete). | Height: 38px, Padding: 0 16px, Radius: 10px |
| **Icon Tool Button** | `.dr-tool-btn`, `#mt` | Centered glyph/SVG, subtle border. Tools and toggles. | Height: 38px, Width: 38px–44px, Radius: 10px |
| **Compact Button** | Mobile `.btn` | Scaled for mobile viewports (≤ 480px). | Height: 34px, Padding: 0 10px, Font: 12.5px |

### Interaction Rules
- **No Hover Scaling or Wobble:** Buttons must not use `transform: scale(1.05)` or `translateY(-2px)`.
- **Restrained Feedback:** Subtle background color brightening and subtle elevation shift on hover.
- **Accessible Focus:** All buttons must display a crisp focus ring (`:focus-visible { outline: 2px solid var(--colors-focus-ring); outline-offset: 2px; }`).

---

## 6. Icon & Navigation Guidelines

- **Clean Typography Over Emojis:** Main navigation tabs, subtabs, and primary header buttons use clean professional text labels without decorative Unicode emojis.
- **Meaningful Icons:** Icons must provide functional affordance (e.g. Search magnifying glass, theme moon/sun SVG, share link glyph) rather than decorative clutter.
- **Preserve User Content:** Meaningful emojis and symbols inside Minecraft resource titles, descriptions, and changelogs remain preserved.

---

## 7. Loading Screen & State Standards

- **Restrained Presentation:** The boot loading screen (`#ci-boot-screen`) displays a clean static brand mark, crisp typography, and an indeterminate progress bar.
- **No Gratuitous Animation:** Infinite floating animations (`ci-boot-float`), pulsing dots (`ci-boot-pulse`), infinite glowing shimmers, and fabricated progress percentages are strictly prohibited.
- **Accessibility:** Full support for `@media (prefers-reduced-motion: reduce)`.
- **Theme Matching:** Matches Dark Mode (`#0c0915`) or Light Mode (`#f8f4fc`) immediately without flashing.

---

## 8. Modal Dialog Scroll Isolation Standards

To permanently eliminate background scroll leakage when interacting with overlays:
1. **Central Fixed-Body Lock:** `CraftIndexScrollLock.acquire(id)` adds `.ci-scroll-locked` to `document.documentElement` and sets `document.body.style.position = 'fixed'`, `document.body.style.top = -${scrollY}px`, and `document.body.style.width = '100%'`. This physically prevents any mouse wheel, touch drag, or keyboard navigation from scrolling the underlying page.
2. **Deterministic Position Restoration:** On release, `document.body.style.position = ''` and `window.scrollTo(0, scrollY)` instantly restores the exact scroll position down to the pixel.
3. **Internal Containment:** Every modal container (`.mx`, `.dash-window`, `.about-modal`, `.dr`, `.socials-modal`) specifies `overflow: hidden; touch-action: none; overscroll-behavior: contain;`.
4. **Internal Scroll Containers:** Every scrollable body (`.mbd`, `.dash-content`, `.about-content`, `.dl`, `.socials-body`) specifies `overflow-y: auto !important; overscroll-behavior: contain !important; -webkit-overflow-scrolling: touch;`.

---

## 9. Scroll Performance & Flicker Mitigation

To maintain high 60 FPS scrolling and eliminate compositor dropped frames:
1. **Zero Nested Backdrop Filters:** Child buttons, badges, and headers inside containers that already specify `backdrop-filter` (`header`, `.dr`, `.cd`, `.md`) must declare `backdrop-filter: none !important;`.
2. **Crisp Card Surfaces:** Resource cards (`.cd`) use high-performance solid/tinted surfaces (`var(--colors-surface)`) without redundant `backdrop-filter: blur()`, preventing compositor re-rasterization during rapid list scrolling.
3. **No Blanket Hover Lift:** Cards and buttons must not apply `transform: translateY(-2px)` on hover, avoiding layout invalidations during mouse movement over scrolling lists.

---

## 10. Prohibited Design Anti-Patterns (Enforceable)

The following patterns are **strictly prohibited** in CraftIndex:
- ❌ **No Arbitrary Colors:** Never introduce one-off hex or RGBA values in component CSS. All colors must resolve from semantic tokens in `css/tokens.css`.
- ❌ **No Heavy Font Weights on Ordinary Text:** Never use font weights 700 or 800 on buttons, labels, badges, navigation, or body copy.
- ❌ **No Transparent 2px Border Hacks:** Never use `border: 2px solid transparent` as a layout offset.
- ❌ **No Radioactive Outer Glows:** Avoid `box-shadow: 0 0 25px #b388ff`.
- ❌ **No Nested Backdrop Blurs:** Never place a `backdrop-filter` inside another element that already specifies `backdrop-filter`.
- ❌ **No Transform Wobbles:** Never use `transform: scale(1.05)`, `translateY(-3px)`, or keyframe shaking on interactive elements.
- ❌ **No Background Scroll Leakage:** Never open an overlay without engaging `CraftIndexScrollLock`.
