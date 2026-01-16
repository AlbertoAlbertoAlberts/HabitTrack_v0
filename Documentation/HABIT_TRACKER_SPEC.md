Personal Habit Tracker – Functional & Behavioral Specification

1. Purpose & Scope

This web application is a personal habit tracking system designed for daily self-evaluation and long-term analysis.
It is single-user, offline-first, and local-storage-based (no login, no backend).

Core goals:
	•	Fast daily check-in
	•	Minimal cognitive load
	•	Strong structure (categories + priorities)
	•	Clear historical overview
	•	No gamification, streaks, or external motivation mechanics

All UI text is primarily in Latvian.

⸻

2. Global Rules & Principles

2.1 Data persistence
	•	All data is saved locally in the browser.
	•	No authentication.
	•	Page reloads must never reset state.

2.2 Scoring system
	•	Every habit always has exactly three possible scores:
	•	0 = bad / not done
	•	1 = partially done
	•	2 = done well
	•	No custom scales.
	•	No skipping scale values.

⸻

3. Page Structure Overview

The app has two main pages:
	1.	Daily Tracking Page (Page 1)
	2.	Overview / Analytics Page (Page 2)

Navigation between them is explicit (button).

⸻

4. Page 1 – Daily Tracking

4.1 Layout (three columns)

Left column – “Izaicinājumi” (Challenges)
	•	Lists all categories, each containing habits
	•	Always fully expanded (no collapsing)
	•	Scrollable if content exceeds height
	•	Contains a menu (hamburger) icon for management actions

Middle column – Daily scoring area
	•	Shows habits for the selected date
	•	Scrollable
	•	Two mutually exclusive views:
	•	KATEGORIJA view
	•	PRIORITĀTE view

	•	Also contains a “Nedēļa” (Weekly) panel for weekly tasks
		•	Shows a weekly date range (Monday–Sunday) based on the selected date
		•	Shows weekly tasks as tiles with a progress ring

Right column – TO-DO
	•	Global to-do list (not date-specific)
	•	Scrollable
	•	Contains:
	•	Add item
	•	Delete mode
	•	Archive access

⸻

5. Date Handling (Page 1)
	•	Current date is displayed at the top center.
	•	Left arrow → go to previous days (unlimited past).
	•	Right arrow:
	•	Disabled when viewing today
	•	Enabled only when viewing past dates
	•	You can return to today from the past.

5.1 Editing rules (important)

For each habit + date:
	•	If no score exists yet:
	•	You may select 0 / 1 / 2 freely.
	•	Once you leave Page 1 (navigate to overview or change date):
	•	All scores for that date become locked.
	•	Locked scores are read-only forever.
	•	While staying on the same date/page:
	•	You may freely change 0 ↔ 1 ↔ 2.

This creates a commit-on-leave behavior.

⸻

6. Category View (Page 1)

6.1 Structure
	•	Habits are grouped into category cards
	•	Each category is its own visual container
	•	Only categories that contain habits are shown

6.2 Habit row

Each habit row contains:
	•	Habit name (text length constrained)
	•	Three buttons: 0 / 1 / 2
	•	Selected value is visually highlighted (color stays same, emphasis changes)

⸻

7. Priority View (Page 1)

7.1 Structure
	•	Habits are grouped into Priority 1 / Priority 2 / Priority 3 cards
	•	Cards only appear if they contain habits
	•	Priorities are global per habit (not per day)

7.2 Editing priority
	•	Priority indicators (< 1 >) appear only when priority edit mode is active
	•	Priority edit mode is entered via menu
	•	An X icon exits priority edit mode

⸻

8. Priority Logic (Critical)

8.1 Priority characteristics
	•	Priority values: 1 (highest) → 3 (lowest)
	•	Priority changes are not historical
	•	Overview always uses the current priority, even for past data

8.2 Reordering behavior

Default state:
	•	Habits are ordered by priority (1 → 3)

Manual reordering:
	•	User may manually reorder habits inside categories
	•	Manual order is respected

Priority change behavior:
	•	When a habit’s priority changes:
	•	Only that habit moves
	•	Other habits remain untouched
	•	The habit moves to:
	•	The correct position among habits of the same category
	•	Placed above lower-priority habits
	•	Placed below higher-priority habits
	•	Movement happens:
	•	When exiting priority edit mode
	•	Or when leaving the page

Manual reorder override:
	•	Manual reorder applies until:
	•	A habit’s priority is changed again
	•	Then the moved habit repositions according to priority rules

⸻

9. Left Menu (Hamburger) – Actions

9.1 Add category
	•	Popup with:
	•	Category name
	•	New category appears at the top
	•	Empty category is allowed until habits are added

9.2 Add habit

Popup fields:
	1.	Habit name
	2.	Category (dropdown)

Rules:
	•	Default priority = 1
	•	Habit is inserted according to priority ordering

9.3 Change priority
	•	Activates priority edit mode
	•	Shows priority controls next to habits

9.4 Reorder
	•	Enables drag & drop
	•	Allows:
	•	Reordering categories
	•	Reordering habits
	•	Moving habits between categories

9.5 Delete
	•	Activ deletion mode:
	•	Trash icons appear next to categories and habits
	•	Confirmation popup required

Delete rules:
	•	Deleting a category → deletes all its habits
	•	Deleting a habit → permanently deletes all its data (no soft delete)

⸻

10. Weekly Tasks (“Nedēļa”)

10.1 Purpose
	•	Track a small set of weekly repeating tasks alongside daily habit scoring
	•	Provide a simple “done this day” interaction with a weekly progress ring

10.2 Week definition
	•	Weeks start on Monday and end on Sunday
	•	The current week range is computed from the selected date on Page 1

10.3 Task behavior
	•	Each weekly task has a weekly target: `targetPerWeek`
	•	A weekly task can be completed at most once per calendar day (once-per-day rule)
	•	The progress ring shows: completed days in that week vs `targetPerWeek`
	•	Allowed target range is 1–7 (clamped)
	•	Default target when creating a weekly task: 2

10.4 Interaction
	•	Click on a weekly task tile/ring:
		•	Marks the currently selected date as completed for that task
	•	Shift+click:
		•	Removes the completion mark for the selected date

10.5 Management
	•	Weekly tasks are managed via a compact menu (⋯) in the Weekly panel:
		•	Add (`+ Ieradumu`)
		•	Reorder (`Pārkārtot`)
		•	Rename (`Mainīt nosaukumus`)
		•	Delete (`Dzēst`)

⸻

11. TO-DO List (Right Column)

10.1 Behavior
	•	Global (same list regardless of date)
	•	Add item via plus icon
	•	Menu options:
	•	Add
	•	Delete mode

10.2 Completion & archive
	•	Checking an item:
	•	Moves it to Archive
	•	Stores completion date
	•	Archive:
	•	Ordered by most recent first
	•	Each item shows completion date
	•	Each item has restore (undo) option

Deleted TO-DO items are permanently removed.

⸻

12. Page 2 – Overview / Pārskats

11.1 Default state
	•	Time range: 30 days
	•	View: Overall result
	•	End date: today

11.2 Time navigation
	•	Shows date range (from → to)
	•	Left/right arrows move the window backward/forward
	•	Windows are:
	•	Rolling last 7 days
	•	Rolling last 30 days
	•	Not calendar weeks/months

⸻

13. Chart Logic

12.1 Axes
	•	X-axis: dates
	•	Y-axis: summed score

12.2 Scaling
	•	Max Y value depends on selection:
	•	Single habit → max = 2
	•	Category → habits × 2
	•	Priority → habits × 2
	•	Overall → all habits × 2
	•	Graph height remains constant
	•	Tick density changes dynamically

⸻

13. Overview Filters (Exclusive Modes)

Only one filter mode may be active at a time:
	1.	Atsevišķa sadaļa – single habit
	2.	Kategorija – one category (sum of its habits)
	3.	Prioritāte 1
	4.	Prioritāte 2
	5.	Prioritāte 3
	6.	Kopējais rezultāts – all habits

13.1 Selection behavior
	•	Selecting a mode deselects others
	•	Category / habit selection happens via scrollable list
	•	Priority selection auto-selects all habits of that priority

⸻

14. Persistence of UI State

Remember between sessions:
	•	Page 1 view (Category / Priority)
	•	Last selected date
	•	Overview page:
	•	Selected mode
	•	Selected habit/category (if applicable)
	•	7 vs 30 days

Always reset:
	•	Overview defaults to Overall + 30 days on first-ever load

⸻

15. Explicit Non-Goals (for clarity)
	•	No streaks
	•	No reminders
	•	No achievements
	•	No social features
	•	No cloud sync (for now)
	•	No AI recommendations
