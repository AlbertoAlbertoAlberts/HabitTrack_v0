# Line chart gradient-by-score (Option B) — Implementation Plan

## Goal
Make the **main score line** change color along its length based on the score value:
- Score = **0** → **red**
- Score = **max** → **green**
- In-between → smooth transition via a **3-stop ramp**: **red → amber → green**

This uses **Option B**: *color-by-segment*, meaning the line is rendered as multiple short segments, each with its own computed stroke color.

## Constraints
- No new persisted data structures.
- No chart library.
- Keep existing chart layout, scaling, axes, glow approach.
- Keep performance reasonable for typical window sizes (7–30 days).

---

## Phase 1 — Baseline + Hook Points
**Objective:** Identify where to plug in per-segment rendering without disturbing the rest of the chart.

**Work:**
- Locate the main series path rendering in `app/src/pages/OverviewPage/OverviewPage.tsx`.
- Confirm we already have:
  - `points[]` with `{x,y,value,date}`
  - `yMax` (max possible) available for normalization
- Decide the draw order (recommended):
  1) grid/axes
  2) max-line series
  3) **main gradient segments**
  4) main dots
  5) overlays (hover state, etc.)

**Acceptance:**
- No visual change yet.
- Code location for main series render is clear and isolated.

---

## Phase 2 — Color Ramp Function (3-stop)
**Objective:** Implement a small utility that converts a score value into a color.

**Work:**
- Add a helper (same file or small util) like:
  - `scoreToColor(value: number, max: number): string`
- Normalize `t = clamp(value / max, 0..1)`.
- Use 3 stops:
  - `t=0.0` red (e.g. `#ef4444`)
  - `t=0.5` amber (e.g. `#f59e0b`)
  - `t=1.0` green (e.g. `#22c55e`)
- Interpolate RGB (or HSL if you prefer smoother hue).

**Acceptance:**
- Unit-like sanity in code via quick manual checks (e.g., log or temporary render of swatches if needed).
- No dependency added.

---

## Phase 3 — Segment Rendering (Core)
**Objective:** Replace the single colored main `<path>` with many small segments each colored by score.

**Work:**
- Replace the main line path with:
  - For each consecutive pair `(p[i], p[i+1])`, render a `<path>` or `<line>` segment.
- Segment color options:
  - **Midpoint color** (recommended): compute `v = (p[i].value + p[i+1].value)/2` then `stroke = scoreToColor(v, yMax)`.
  - Alternative: color by start point.
- Keep rounded joins/caps for continuity:
  - `strokeLinecap="round"`
  - `strokeLinejoin="round"`
- Use the existing smooth geometry *for the overall curve*:
  - Practical approach: approximate the smooth curve with **many small straight segments** by sampling the curve.
  - Two implementation routes:
    1) **Simple (good enough for 7–30 days):** draw straight segments between original `points[]` (no extra sampling). The line remains slightly angular.
    2) **Better (recommended):** sample the smooth curve:
       - build a function to get cubic Bezier segments from your smoothing logic
       - for each Bezier, sample N points (e.g., 12–20) to create micro-segments
       - color each micro-segment by its interpolated score value

**Acceptance:**
- The line visibly shifts color along peaks/valleys.
- No gaps between segments.

---

## Phase 4 — Glow Strategy for Segments
**Objective:** Preserve the “faint glow” look while using many colored segments.

**Work:**
- Render glow as a separate underlay using the **same segments**, but:
  - larger `strokeWidth` (e.g. 3–4×)
  - lower opacity
  - SVG blur filter
- Keep glow color aligned to segment color (same `stroke`), so the glow matches the gradient.

**Acceptance:**
- Glow doesn’t look “striped” or noisy.
- Performance still OK.

---

## Phase 5 — Dots + Hover/Focus Consistency
**Objective:** Ensure points/dots and interactions still feel coherent with the gradient line.

**Work:**
- Color dots by score using the same 3-stop ramp (dots match the gradient line).
- If hover interactions exist:
  - ensure the hovered-point ring/tooltip still reads correctly
  - ensure dimming logic applies to segments too (optional)

**Acceptance:**
- Hover/focus doesn’t break; tooltip still shows correct values.
- Dots remain legible against the gradient.

---

## Phase 6 — Performance + Polish
**Objective:** Avoid rendering too many DOM nodes and keep the chart smooth.

**Work:**
- If using curve sampling, cap the number of micro-segments:
  - Example: `segmentsPerDay = 12` and clamp total segments to a max (e.g. 600)
- Use `useMemo` to precompute segment geometry + colors.
- Verify in 30-day mode.

**Acceptance:**
- No noticeable lag.
- Visual continuity is clean (no jagged color breaks).

---

## Suggested Defaults
- Ramp: `#ef4444` → `#f59e0b` → `#22c55e`
- Segment color source: midpoint score
- Curve sampling: enabled, with bounded resolution

## Notes / Decisions Needed
**Decisions locked in:**
1) Dots match the gradient (color-by-score).
2) Glow matches the gradient (color-by-score underlay).
3) Use curve sampling to keep the curve smooth.
