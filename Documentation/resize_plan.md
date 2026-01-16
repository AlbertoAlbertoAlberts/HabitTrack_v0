# resize_plan.md — Responsive “no clash / no overlap” plan (Daily + Header + Overview/Archive)

## Context / what’s failing
You report the UI is still “clashing like crazy” (header/content and/or internal panels overlapping) and that the **single-column switch should happen later** (i.e., at a *smaller* width).

### What I can confirm from the current code
- The workspace does **not** contain any screenshots (no `.png/.jpg/.webp` found), so the plan includes an explicit “verify against screenshots” step.
- There is still **viewport math using `--header-h`**:
  - Daily page: `min-height: calc(100vh - var(--header-h))` and panel `max-height: calc(100vh - var(--header-h) - 32px)` in `DailyPage.module.css`.
  - TopNav: `height: var(--header-h)` in `TopNav.module.css`.
- We recently changed the app shell so `#root` is a flex column and `main` is a scroll container.

### Likely root causes (based on code + typical symptoms)
1) **Header height mismatch**
   - `TopNav` is forced to `height: var(--header-h)` (56px), but on smaller widths the nav/toggle can wrap, making the header’s *real* content height > 56.
   - If other layout code assumes header is exactly 56px, you get overlap/clipping.

2) **Double “viewport math” (subtracting header twice)**
   - With `main` as a scroll container (sized to remaining space), page-level `calc(100vh - header)` becomes incorrect and can push content into/under other elements.

3) **Competing scroll containers**
   - `main` scrolls; some pages/panels also enforce their own `max-height` and `overflow`.
   - This often produces clipped content, awkward nested scroll, and elements that look like they’re “overlapping” when they’re actually being clipped.

4) **Breakpoint timing**
   - Daily currently switches to 1-column at ~980px. You want this to happen “later” → we should move the 1-column breakpoint to a smaller width (e.g. 900/880), *after* ensuring the 2-column layout remains stable.

---

## Goals / acceptance criteria
- **No overlap**: header never covers page content; page content never draws under the header.
- **No clipping**: panels should scroll rather than cut off content on short viewport heights.
- **Predictable responsive behavior**:
  - Daily: 3 columns → 2 columns → 1 column
  - 1 column happens at a *smaller* width than today.
- **Keep behavior unchanged**: layout-only changes (CSS + small structural wrappers if needed), no new data structures or features.

---

## Phase 0 — Reproduce + screenshot mapping (diagnosis)
**Outcome:** a precise checklist of “where it clashes” and which CSS rule causes it.

1) Collect inputs
   - Add the screenshots to the repo (recommended): `Documentation/screenshots/resize/`.
   - Name them with context: `daily-1020.png`, `overview-900.png`, `archive-760.png`, etc.

2) Reproduce on these viewports (minimum)
   - Widths: `1400, 1200, 1020, 980, 920, 880, 760, 520`
   - Heights: normal (~900) + short (~650)

3) Identify the exact clash type per screenshot
   - **Type A**: header visually overlaps page content (content appears under header).
   - **Type B**: page content clips (missing rows/buttons) when height is short.
   - **Type C**: internal overlap inside a panel (buttons/text draw on each other).
   - **Type D**: forced horizontal overflow (content pushes outside viewport).

4) Add temporary debug CSS (local only during investigation)
   - Outline header, main, and page containers.
   - Use devtools to inspect computed heights: header actual height vs `--header-h`.

---

## Phase 1 — Establish ONE layout contract for the app shell
**Outcome:** header and main area are structurally correct; no part of the app needs `calc(100vh - header)`.

Decision (recommended): **keep TopNav in-flow** and make `main` the only scroll container.

Steps:
1) Make header height “natural”, not forced
   - Change `TopNav.module.css` from `height: var(--header-h)` to:
     - `min-height: var(--header-h)`
     - allow wrapping on narrow widths (don’t constrain it to 56px)
   - This prevents the header from clipping its own content.

2) Keep `#root` as flex column and `main` as scroll container
   - Ensure:
     - `#root { min-height: 100vh; display:flex; flex-direction:column; }`
     - `main { flex:1; min-height:0; overflow:auto; }`

3) Remove any remaining “header offset” hacks
   - If any page uses top padding/margin based on `--header-h`, remove them once the shell is correct.

Verification:
- Narrow width where header wraps: header grows taller, main shrinks, **no overlap**.

---

## Phase 2 — Remove per-page 100vh math (especially Daily)
**Outcome:** pages fill the available `main` area and scroll correctly.

1) Daily page
   - Remove `min-height: calc(100vh - var(--header-h))` from `.page`.
   - Remove panel `max-height: calc(100vh - var(--header-h) - 32px)`.
   - Replace with shell-friendly sizing:
     - `.page { min-height: 100%; }`
     - panels use `min-height: 0` and an internal `.scrollArea { overflow:auto; }`.

2) Overview + Archive
   - Ensure their `.page` roots are compatible with the new shell:
     - `min-height: 100%` (or `min-height: 0` depending on flex usage)
     - no viewport calculations.

Verification:
- Short height: content scrolls within `main`, not clipped.

---

## Phase 3 — Fix “header clash” specifics on Overview/Archive
**Outcome:** even with floating chart legend or side panels, nothing renders under the header.

Checklist:
1) Confirm no element is `position: fixed/sticky` with `top:0` inside pages.
2) If a floating element exists (e.g., chart legend), ensure its `z-index` does not exceed the header.
3) Make sure the page root does not create an unexpected stacking context (rare but can happen with transforms/filters).

Potential targeted fixes:
- If the chart legend overlaps header when scrolling: cap it to the chart container with `position: sticky` inside that container, not `absolute` relative to viewport.
- If header is being covered: raise header z-index and ensure page elements do not create higher stacking contexts.

---

## Phase 4 — Daily breakpoints tuning (1-column “later”)
**Outcome:** Daily stays multi-column longer and only becomes single-column at a smaller width.

1) Define breakpoints (proposal)
- Keep 3→2 at `1200` (already).
- Keep “tight 2-col” adjustments around `1020` (already).
- Move 1-col from `980` to a smaller width (candidate):
  - `920` or `880` (we’ll choose based on screenshot evidence).

2) Make 2-col more resilient
- Ensure left panel never forces overflow:
  - `min-width: 0` everywhere.
  - avoid hard min-widths on date nav and habit rows.

3) Ensure internal rows stack before the whole page stacks
- Habit rows already have a 1-col internal layout at `1020`. Keep/adjust as needed.

Verification:
- At widths between the new 1-col breakpoint and 980, the 2-col layout remains stable with no overlap.

---

## Phase 5 — QA pass + regression check
**Outcome:** confirmed fix across pages, widths, and short heights.

1) Manual checklist
- Daily: 1400/1200/1020/980/920/880/760/520
- Overview: same
- Archive: same
- Confirm header wrapping does not overlap content.
- Confirm no horizontal scrollbars appear unexpectedly.

2) Build
- Run `npm run build`.

---

## Deliverables
- Updated app-shell + TopNav CSS to remove header-height assumptions.
- Updated Daily/Overview/Archive CSS to remove `100vh` math and rely on the shell.
- Adjusted Daily 1-column breakpoint to a smaller width (based on screenshot validation).
- A short “before/after viewport checklist” for you to verify.

---

## What I need from you to make this precise
- Please attach the screenshots in chat **or** drop them into `Documentation/screenshots/resize/` and tell me the filenames.
- Tell me what you mean by “single column later”: do you want 1-column at **920** or **880** (or give your preferred exact px).
