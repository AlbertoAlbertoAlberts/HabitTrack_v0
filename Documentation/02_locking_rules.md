# 02_locking_rules.md — Locking rules & state machine (Daily scores)

This document specifies **exactly when daily habit scores are editable vs locked** and how the UI must behave.  
The goal is to implement the “commit-on-leave” rule reliably and predictably.

---

## 0) Key concept: “Day session”

A **Day Session** is the period when the user is viewing **Page 1 (Daily Tracking)** for a specific date `D`.

- While the user remains on Page 1 and keeps the same date `D`, scores for that date are **editable**.
- Once the user “leaves” that day session (by navigating away or changing the date), that date becomes **locked** and **immutable forever**.

This is the central rule.

---

## 1) Definitions

### Entities referenced
- `DailyScore(date, habitId) -> score 0|1|2`
- `DayLock(date) -> lockedAt timestamp` (recommended representation)
- `UiState.selectedDate` (current date in Page 1)

### “Leaving” events (commit triggers)
A day session is considered “left” when any of the following occurs:

1. **Navigate to a different date** (previous day / next day)
2. **Navigate to a different page** (e.g., Overview page, Archive page)
3. **Close tab / reload** (browser refresh or app restart)  
   - On re-open, the date is not automatically considered “still in session”.

The effect of leaving is: **lock the day** (if it has any recorded score or if your policy says so; see Section 3).

---

## 2) State model (per date)

Each date `D` can be in one of these states:

### State A — `UNTOUCHED`
- No scores exist for date `D` (no `DailyScore` records).
- The day is not locked.

### State B — `IN_SESSION_EDITABLE`
- User is currently viewing Page 1 for date `D`.
- The day is not locked.
- Scores may exist (even many) and are editable.

### State C — `LOCKED_IMMUTABLE`
- Day lock exists for date `D`.
- All scores for that date are read-only.
- No new scores can be created for that date.

> Note: “Locked” is day-level, not per-habit. If the day is locked, everything for that day is locked.

---

## 3) When does the day lock get created?

### Rule (recommended, matches your intent)
A day becomes locked **only if at least one score exists** for that date at the moment you leave the day session.

This supports:
- If you never filled anything for a past day, you can come back later and still fill it.
- Once you start filling a day and then leave, you are “committing” that day.

Formally:

On leaving date `D`:
- If `DayLock(D)` already exists → do nothing
- Else if there exists at least one `DailyScore` for date `D` → create `DayLock(D)`
- Else (no scores) → do not lock

---

## 4) Events & transitions

### Event: `OPEN_DAY(D)` (enter Page 1 date D)
Triggered when:
- App opens on Page 1
- User navigates from another page to Page 1
- User changes date to D

Transition:
- If `DayLock(D)` exists → state becomes `LOCKED_IMMUTABLE`
- Else → state becomes `IN_SESSION_EDITABLE` (even if untouched)

### Event: `SET_SCORE(D, habitId, score)`
Allowed only if current state is `IN_SESSION_EDITABLE`.

Effects:
- Create or update `DailyScore(D, habitId) = score`
- Day remains `IN_SESSION_EDITABLE`

### Event: `LEAVE_DAY(D)` (commit trigger)
Triggered by:
- `CHANGE_DATE` to another date
- `NAVIGATE_TO_PAGE` away from Page 1
- `RELOAD/EXIT`

Transition:
- If `DayLock(D)` exists → remain `LOCKED_IMMUTABLE`
- Else if there is at least one `DailyScore` on D → create `DayLock(D)` and transition to `LOCKED_IMMUTABLE`
- Else → remain effectively `UNTOUCHED` (no lock created)

### Event: `TRY_EDIT_LOCKED(D, ...)`
If `DayLock(D)` exists:
- Block all modifications
- UI must not allow changing score buttons
- No new scores can be added

---

## 5) UI behavior requirements

### 5.1 Page 1 score buttons (0/1/2)
When date `D` is editable:
- Buttons are clickable
- Selecting a score highlights it
- Clicking a different score updates it (still editable)

When date `D` is locked:
- Buttons are disabled (or read-only visual state)
- No hover/click behavior that changes state
- Selected score still visible

### 5.2 Visual indicator (optional but recommended)
When viewing a locked day:
- Show subtle indicator (e.g., small lock icon near date or “Diena saglabāta”)
- This prevents confusion (“why can’t I change it?”)

### 5.3 Prevent accidental locking on blank days
- Do not lock a day unless at least one score exists (Section 3 rule)

---

## 6) Edge cases and how to handle them

### 6.1 Switching dates quickly
Scenario:
- User changes date from D to D-1 and back rapidly.

Rule:
- Leaving D triggers `LEAVE_DAY(D)` immediately.
- If D has any scores, it locks even if user comes back 1 second later.
- This is intended behavior (commit-on-leave).

### 6.2 Locking “today”
If user fills today and goes to overview:
- Today becomes locked when leaving.
- Coming back to today later → locked.
This matches your current rule.

(If later you decide today should remain editable until end-of-day, that would be a different policy.)

### 6.3 App crash / refresh
If user refreshed while editing a day:
- That counts as leaving the session.
- On next load, if there were scores, the day should be treated as locked (because leaving event occurred).

Implementation note:
- Best effort: before unload, attempt to commit lock if needed.
- If unload happens without handler, on next boot you can still enforce lock by policy (see Section 7.2).

---

## 7) Implementation notes (non-code)

### 7.1 Recommended persistence representation
Store day locks separately:

- `dayLocks: Record<YYYY-MM-DD, ISO_TIMESTAMP>`

Store scores separately:

- `dailyScores: Record<YYYY-MM-DD, Record<habitId, 0|1|2>>`
  (or an array; storage schema defined in `04_storage_schema.md`)

### 7.2 Recovery rule (important)
To ensure correctness if the app closes unexpectedly:

On app startup:
- If `dailyScores[D]` has at least one entry AND there is no active “in-session marker” for D:
  - treat D as locked if policy considers the previous session “left”.

Simplest approach:
- Do not attempt “resume session”.
- If the user re-opens, it is a new session → previous day with scores should be locked.

This matches “once I go back to a different page, results are hard stored” and extends it to reloads.

### 7.3 Optional: In-session marker (only if you want it)
If you ever want to allow “resume editing after reload” (not currently desired), you’d store:
- `activeSession = { date: D, startedAt: ... }`
But for your spec, we do **not** resume.

---

## 8) Acceptance criteria (testable)

For any date D:

1. If D has **no scores**, user can always return later and fill it.
2. If user sets at least one score on D, then navigates away (or changes date), D becomes locked.
3. Once locked, D cannot be changed ever again.
4. Lock is day-wide: if any habit was filled that day, and the day was locked, no other habits can be added later.
5. While staying on the same day without leaving, user can freely change scores.

---