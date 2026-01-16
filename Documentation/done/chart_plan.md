Plan: Overview Line Chart Upgrade (Phased)
Upgrade the existing custom SVG chart to look more engaging while staying minimalist: a framed “card” container with breathing room, a larger plot (~140%), a dominant accent score series (curved, thicker, faint glow), and a secondary grey max-series (curved, dots, faint glow). Then polish readability (grid/axes) and add lightweight interactions (hover/tooltip, point highlight, optional subtle area fill) without adding libraries or new persisted data.

Steps 1–6

Phase 1 — Baseline audit: confirm chart render flow in OverviewPage.tsx and layout hooks in OverviewPage.module.css.
Phase 2 — Framed container + size: update the chart card styling (radius, 1px border, soft shadow, light inner background) and add inner padding so the plot doesn’t touch edges; increase chart wrapper sizing to ~140% in OverviewPage.module.css and keep SVG internal width/height consistent in OverviewPage.tsx.
Phase 3 — Grid/axes polish: reduce visual noise (fainter + fewer gridlines, typically horizontal-only), adjust tick density for X labels, lighten label typography, and slightly emphasize the baseline (0) in OverviewPage.tsx.
Phase 4 — Main series styling: replace straight segments with a smoothed curve path, increase stroke width, add a faint glow (SVG filter or blurred underlay path), and keep dots crisp and consistent in OverviewPage.tsx.
Phase 5 — Max series (grey) + legend: derive maxPossible from current filtered habits/mode, generate a second dataset that reuses the same X positions, render the grey curved line + grey dots (slightly thinner/lower opacity glow than primary), and add small inline labels (“Rezultāts”, “Maks.”) within the chart card in OverviewPage.tsx and OverviewPage.module.css.
Phase 6 — Interaction & engagement: add hover tooltip (date, value, max), expand/highlight the hovered dot (optional ring), subtly fade non-hover segments/points, and optionally add a very subtle area fill under the main line (6–10% opacity gradient) in OverviewPage.tsx.

Further Considerations 1–3
“Max possible” semantics: per selected habit (2) vs per active habit set (count * 2) depending on the current filter/mode.
Glow technique: SVG filter (more control) vs blurred underlay duplicate path (simpler).
Area fill + fading: keep optional if it risks reducing clarity on dense weeks.
If you want, tell me which “max possible” interpretation you want in each mode (single habit vs aggregated), and I’ll refine Phase 5 wording to match your exact intent.