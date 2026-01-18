# Visual guidelines — LAB page (match existing app)

This project already has a strong, consistent “glass panel” UI. When building LAB, reuse the same primitives/tokens so it feels like Daily + Overview.

## 1) Global design tokens (don’t hardcode colors)
Use CSS variables from `app/src/index.css`:
- Surfaces: `--bg`, `--panel-bg`, `--panel-bg-strong`, `--popover-bg`
- Borders: `--border`, `--btn-border`
- Text: `--text`, `--muted`
- Accents: `--accent`, `--accent-soft`, `--danger`
- Motion: `--t-fast`, `--t-med`, `--ease-out`, `--ease-standard`
- Focus ring: `--focus-ring`

Rules:
- Prefer `var(...)` tokens instead of hex/RGBA literals.
- Dark/light theme is already handled by tokens; don’t add theme-specific CSS in LAB.

## 2) Page scaffolding (same spacing as other pages)
Baseline page wrapper is `sharedStyles.page` in `app/src/components/ui/shared.module.css`:
- Use `display: grid`.
- Default spacing is **16px**: `gap: 16px`, `padding: 16px`.
- Keep `min-height: 100%` so panels fill the available viewport.

LAB should start with:
- `<div className={sharedStyles.page}>…</div>`

## 3) Panels/cards (the core visual language)
Use `sharedStyles.panel` for primary surfaces:
- `border: 1px solid var(--border)`
- `border-radius: 14px`
- `padding: 16px`
- `background: var(--panel-bg)`
- `backdrop-filter: blur(10px)`

Rules:
- Put most LAB content inside one or more panels.
- Inside a panel, prefer vertical stacking with `display: flex` and `gap: 12px–16px`.
- For “sub-cards” inside panels, copy the pattern from `DailyShared.module.css` (`.subCard`): use `--btn-bg` + `--btn-border`.

## 4) Layout patterns to mirror (pick one)
### A) Simple single-column (good for early LAB)
- One column, panels stacked.
- Use a top “header panel” + one/more “content panels”.

### B) Two-column (Overview-style)
From `app/src/pages/OverviewPage/OverviewPage.module.css`:
- Left column: ~320px (`grid-template-columns: 320px minmax(0, 1fr)`)
- Gap: 16px
- Mobile breakpoint: collapse to single column around `max-width: 980px`.

If LAB needs a sidebar (filters/tools), follow this exact pattern.

### C) Three-column (Daily-style)
From `app/src/pages/DailyPage/DailyPage.module.css`:
- `320px | fluid | 340px`
- Responsive collapse at 1200px → 2 columns + bottom row, then single column at 900px.

Use this only if LAB truly needs “left + main + right”.

## 5) Typography + labels
Patterns already used:
- Panel titles: 14px, weight 700, slight opacity (`.panelTitle` pattern in Daily/Overview CSS).
- Muted helper text uses `color: var(--muted)`.

Rules:
- Prefer small, bold headings (14–16px) over huge headers.
- Avoid all-caps unless it’s an intentional UI label (and then keep letter spacing subtle).

## 6) Buttons / interaction styling
### Segmented toggles (TopNav-style)
For “mode switches” (like HABIT/LAB, Auto/Light/Dark), reuse the segmented control:
- Container: `.toggle`
- Button/link: `.toggleBtn`
- Active: `.toggleBtnActive`

Rules:
- Active state should use `background: var(--accent-soft)`.
- Focus/active glow should use `box-shadow: var(--focus-ring)`.

### Standard small button (shared)
Use `sharedStyles.smallBtn` for simple actions inside LAB panels.

### List items (Overview-style)
For selectable rows, mirror `OverviewPage.module.css` `.listItem`:
- `background: var(--tile-bg)`
- Hover: `--tile-bg-hover`
- `border-radius: 10px`
- `:focus-visible` uses `box-shadow: var(--focus-ring)`

## 7) Inputs + popovers
Use the existing tokens:
- Inputs should blend: `background: var(--input-bg)` and `border: 1px solid var(--btn-border)`.
- Popovers/menus should be opaque: `background: var(--popover-bg)`.

Rules:
- Don’t introduce transparent popovers; keep them readable on dark mode.

## 8) Motion + hover behavior
Match the app’s interaction feel:
- Hover is subtle (mostly background change + opacity change).
- Active state uses a tiny scale (`transform: scale(0.99)` / `0.98`) in some controls.
- Transitions are short and consistent (`--t-fast`, `--t-med`).

Rules:
- Avoid large animations; keep it calm and fast.

## 9) Spacing cheat sheet
- Page padding/gap: **16px**
- Panel padding: **16px**
- Inner stack gaps: **8px / 12px / 16px**
- Pill controls: height **32px**, rounded **999px**
- Card corners: **14px** (primary panels), **10px** (list rows)

## 10) Implementation tips for LAB
- Prefer composing new LAB sections as panels first; only then add custom CSS.
- If you need a new reusable UI piece, place it under `app/src/components/ui/` and keep it tiny.
- Always run `npm run build` after a layout change.
