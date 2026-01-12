Phase 0 — Project setup (30–60 min)

Goal: a running React+TS app with routing and an empty page.

Deliverables
	•	Create project (Vite React TS recommended)
	•	Basic folders: src/pages, src/domain, src/persistence, src/components
	•	Routing: / (Daily), /overview, /archive
	•	App renders “Hello HabitTrack” on Daily page

Why first: you get a running app fast, confidence boost.

⸻

Phase 1 — Types + StorageService (core persistence)

Goal: you can load and save AppStateV1 to localStorage exactly as spec.

Deliverables
	•	src/domain/types.ts (Category, Habit, UiState, AppStateV1, etc.)
	•	src/persistence/storageService.ts
	•	loadState()
	•	saveState(state)
	•	default state creation (first run)
	•	schemaVersion check (no migrations yet, just the structure)

How you verify
	•	Open app → add temporary “Save test” button → refresh → state persists

This is the “backend” part, but it’s small and contained.

⸻

Phase 2 — Domain stores (actions that change state)

Goal: implement core operations without UI yet (but you can test with buttons).

Deliverables
	•	src/domain/actions/
	•	categories: add/delete/reorder
	•	habits: add/delete/move/reorder/setPriority
	•	dailyScores: setScore, getScoresForDate
	•	dayLocks: commitIfNeeded(date), isLocked(date)
	•	todos: add/delete/complete/restore
	•	A tiny “debug panel” page or buttons for testing actions

How you verify
	•	Click buttons → see JSON in a <pre> preview → refresh → still there

⸻

Phase 3 — Locking rules integration (commit-on-leave)

Goal: the “editable until you leave” logic works correctly.

Deliverables
	•	A “DaySession controller”:
	•	on date change → commit lock for previous date if needed
	•	on route change away from Daily page → commit lock
	•	UI disables score changes when locked

How you verify
	•	Set a score today → go to overview → return → locked
	•	Go to a blank day in past → still editable until you leave

This phase is important because it affects everything.

⸻

Phase 4 — Minimal DailyPage UI (no polish, just functional)

Goal: you can use it like a real tracker.

Deliverables
	•	Left list renders categories + habits
	•	Middle shows category view scoring (0/1/2)
	•	Top date navigation
	•	Right todo list + add/complete/archive link
	•	Keep it ugly but functional

How you verify
	•	You can track a whole day without touching JSON/buttons

⸻

Phase 5 — Priority view + priority edit mode

Goal: implement the second view + the priority edit behavior.

Deliverables
	•	Toggle between Category / Priority view
	•	Priority grouping cards
	•	Priority edit mode with < 1 > stepper next to habits
	•	Reorder behavior “on exit” (your rule)

How you verify
	•	Change priority → item moves appropriately after exiting edit mode
	•	Other items don’t shuffle

⸻

Phase 6 — Overview page (chart + filters)

Goal: analytics works.

Deliverables
	•	7/30 toggle + window navigation
	•	Filter panel (exclusive modes)
	•	Selection panel (category/habit selection)
	•	Chart rendering (simple line/scatter)

How you verify
	•	Overall sums match what you entered on Daily page

⸻

Phase 7 — Reorder & delete modes (polish + completeness)

Goal: management features are complete.

Deliverables
	•	Delete mode with trash icons + confirm
	•	Reorder mode (drag & drop)
	•	Move habit between categories

How you verify
	•	Reordering persists after refresh

⸻

Phase 8 — UI polish to match Canva (last)

Goal: make it look like your mockups.

Deliverables
	•	CSS modules (or Tailwind) styling
	•	Scrollable cards + spacing + colors
	•	Buttons states consistent with design