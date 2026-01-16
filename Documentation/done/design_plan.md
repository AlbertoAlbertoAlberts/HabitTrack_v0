
# Visual redesign plan (no code changes yet)

Date: 2026-01-15

Goal: Redesign the visual appearance to feel clean, modern, calm, and unified—while keeping the existing behaviors and the overall layout structure recognizable.

Constraints (must hold)
- Keep existing functionality and data rules.
- React + TypeScript, desktop-first.
- Layout remains recognizable (3-column Daily, chart-centric Overview), but can be refined (alignment, spacing, sizing, proportions).
- Base palette: black/grey/white.
- 1–2 accent colors maximum (subtle emphasis; not playful).
- Avoid clutter, heavy decoration, or “too many visual ideas”.

This is a planning document only. No code changes are included here.

---

## 1) Current UI: main weaknesses

This is based on inspecting existing CSS modules and page structures.

### A) Color usage is louder than the desired direction
- Daily score buttons are strongly color-filled (red/orange/green) across large surface area, which reads energetic/playful rather than calm.
- The UI currently mixes multiple “semantic” colors as primary visuals (scores + accent + danger), which reduces the “monochrome + subtle accent” feel.
- Destructive/confirm colors are sometimes close to “score colors” in intensity, which can dilute hierarchy (what is important vs what is just an option).

### B) Inconsistent component feel across pages
- Border radii vary widely (8 / 10 / 12 / 14 / 16 / pills), sometimes within the same page.
- Surface treatment varies: some areas are transparent with blur, others are solid-ish, others are dark-tinted cards.
- Shadows are inconsistent: menus/dialogs use relatively heavy shadows while most panels are light.

### C) Typography is heavy in many places
- Many elements use 800–900 weights. This can feel “loud” and reduces hierarchy (everything looks emphasized).
- Headings and labels are often similar sizes (14–16px) with different weights, which makes scanning less effortless.

### D) Spacing rhythm isn’t fully unified
- Many different spacing values are used (10/12/14/16/18…), which makes the UI feel slightly improvised rather than intentional.
- Dense areas (Daily scoring rows, Weekly tiles, menus) compete for attention; whitespace isn’t always doing the “calming” work.

### E) Interaction states are not fully cohesive
- Some components use pill buttons, others use rounded rectangles, some are borderless icons.
- Focus/hover states exist, but the overall interaction language isn’t consistent across pages.

---

## 2) Design principles extracted from the reference screenshots

The references suggest a shared “calm, modern product UI” language. Not copying layouts/components—only extracting the feel.

### Spacing & layout
- Generous whitespace around major sections; content is grouped into clear blocks.
- Strong alignment: edges line up cleanly; consistent gutters.
- Cards/panels feel breathable (padding that looks intentional, not “just enough”).

### Typography
- Clear typographic hierarchy:
	- Large, confident primary headings.
	- Calm body text.
	- Labels that are subtle, not shouting.
- Weight is used sparingly: bold for headings/selected states, otherwise regular/medium.

### Visual hierarchy
- “One main thing” per area: the eye is guided.
- Secondary information is quieter (muted color, smaller size, less weight).
- Controls look consistent and predictable.

### Color usage
- Mostly neutral surfaces (white/off-white/grey) with light borders.
- 1 accent color used for selection/primary actions.
- Any additional color appears as a subtle highlight, not a big filled area.

### Overall feel
- Calm, minimal, confidence-inspiring.
- Low-noise UI: fewer competing shapes/colors; consistent radii; gentle shadows.

---

## 3) Proposed cohesive design direction for HabitTrack

### Name
“Calm Monochrome + Soft Accent”

### Visual approach (high-level)
- Surfaces: mostly solid (or consistently translucent if we keep the “glass” look), with light borders and minimal shadow.
- Accent: keep a single primary accent (current indigo is fine) for:
	- active/selected states
	- primary actions
	- focus ring
- Optional second accent (very restrained): a muted success green for “done/complete” indicators only.
- Red remains purely semantic for destructive actions (not a general accent).

### Specific improvements by area

#### A) Daily score buttons (0/1/2)
Goal: keep the same interaction but make it monochrome-first.
- Replace large saturated fills with neutral buttons.
- Use the accent to indicate selection (outline + soft background), not three different loud fills.
- If differentiation between 0/1/2 is needed visually, use subtle cues:
	- tiny dot/indicator,
	- small tint intensity differences within the same neutral palette,
	- or micro-label styling—without introducing bright colors.

#### B) Panels/cards
- Unify panel surface treatment: consistent background, border, and shadow.
- Make “cards inside panels” feel like part of one system (same radius family, same border weight).

#### C) Typography system (lightweight, not a big design system)
- Define a small, explicit hierarchy:
	- Page title
	- Panel title
	- Primary content text
	- Secondary/muted text
	- Small metadata
- Reduce overuse of 800–900 weight; reserve heavy weight for page titles and selected states.

#### D) Spacing rhythm
- Adopt a simple spacing rhythm (8px base): 8 / 12 / 16 / 24 / 32.
- Use it consistently for padding, gaps, and section separation.

#### E) Controls (buttons, icon buttons, menus)
- Align control shapes: pick one main corner radius for controls, one for panels.
- Standardize control heights and paddings (e.g., 32/36/40 in a consistent way).
- Make hover/focus consistent across pages.

### Palette proposal (fits constraints)
- Base neutrals: current `--bg`, `--panel-bg`, `--border`, `--text`, `--muted` are already aligned with the target.
- Accent 1 (primary): current `--accent` indigo.
- Accent 2 (optional, restrained): a muted green used only for “done” indicators (weekly ring, completion state).
- Danger stays red, but only for destructive confirmations.

Note: this keeps the number of “visual accents” low while preserving semantic meaning.

---

## 4) Redesign implementation phases (incremental, no big-bang)

Each phase should be small enough to verify quickly and keep the app usable at all times.

### Phase 1 — Global polish foundations (lowest risk)
Scope: make the UI feel more coherent without changing layout.
- Unify neutral surfaces (backgrounds, borders) and reduce any harsh shadow usage.
- Normalize typography weights (reduce 900 usage where it isn’t needed).
- Establish a simple spacing rhythm and apply to the most visible containers.

Primary files likely touched later:
- `app/src/index.css`
- `app/src/App.css`

Acceptance criteria:
- Pages feel calmer immediately; fewer “loud” elements.
- No behavior changes.

### Phase 2 — Buttons & inputs consistency
Scope: create a consistent language for controls.
- Standardize button heights, radius, border weight, hover/focus treatment.
- Align icon buttons (menus, delete, rename) with the same style.
- Ensure dialogs feel like the same product as the pages.

Primary files likely touched later:
- `app/src/components/ui/Dialog.module.css`
- Shared button styles in page modules (Daily/Overview/Archive)

Acceptance criteria:
- All buttons look related; primary/secondary/danger are visually clear.

### Phase 3 — Daily page: scoring visuals (biggest “feel” win)
Scope: redesign the scoring row visuals while keeping the structure and behavior.
- Convert score buttons from bright fills to neutral + accent selection.
- Improve row density/whitespace so scanning is effortless.
- Ensure locked state reads clearly but subtly (disabled styling consistent).

Primary files likely touched later:
- `app/src/pages/DailyPage/DailyPage.module.css`

Acceptance criteria:
- Score controls feel calm and modern; no colorful blocks.
- Locked day looks intentionally read-only.

### Phase 4 — Daily page: left column + weekly + todo visual unification
Scope: unify “side panels” and cards.
- Make category/habit list separators, hover states, and modes (delete/reorder/rename/priority edit) visually coherent.
- Weekly tiles: unify card styling, reduce visual noise, improve spacing.
- Todo list: align row spacing and mode controls; keep archive CTA clear but not loud.

Primary files likely touched later:
- `app/src/pages/DailyPage/DailyPage.module.css`
- `app/src/components/weekly/WeeklyTaskTile.module.css`
- `app/src/components/weekly/WeeklyProgressRing.module.css`

Acceptance criteria:
- Left / Weekly / Todo feel like one unified interface.

### Phase 5 — Overview page: calmer chart & filter presentation
Scope: keep the Overview layout recognizable but refine hierarchy.
- Make chart container calmer (borders, spacing, typography).
- Make filter buttons and selection list match the Daily control style.
- Ensure the side column reads like a “control area” (quiet, structured).

Primary files likely touched later:
- `app/src/pages/OverviewPage/OverviewPage.module.css`

Acceptance criteria:
- Overview feels consistent with Daily; filters are clear, not busy.

### Phase 6 — Micro-polish & consistency pass
Scope: remove remaining inconsistencies.
- Audit radii, border alpha, shadows, and typography sizes across pages.
- Unify spacing in menus/popovers.
- Confirm hover/focus behavior is consistent and accessible.

Acceptance criteria:
- No “odd one out” components; the app feels intentionally designed.

---

## Notes / guardrails (to avoid over-engineering)
- Don’t introduce a large design system. Keep it to a small set of reused patterns already present (panels, buttons, inputs, lists).
- Favor editing existing CSS modules over adding abstraction layers.
- Make changes iteratively and validate after each phase by clicking through Daily → Overview → Archive.

