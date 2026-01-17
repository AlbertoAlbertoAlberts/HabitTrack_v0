# Refactor Smoke Test Checklist

Test after each commit to ensure behavior remains unchanged.

## Daily Page
- [ ] Daily page renders without errors
- [ ] Can select scores (0, 1, 2) for habits
- [ ] Score selection persists after refresh
- [ ] Date navigation (prev/next) works
- [ ] "Today" button returns to current date
- [ ] Locking behavior unchanged (can't edit past locked dates)
- [ ] Category/Priority view toggle works
- [ ] Habit start dates respected (future habits show "Sākas" hint)

## Todos
- [ ] Can add new todo
- [ ] Can complete/uncomplete todo (checkbox)
- [ ] Can archive completed todos
- [ ] Can restore archived todos (from archive page)
- [ ] Can delete todos
- [ ] Can drag-reorder todos

## Weekly Tasks
- [ ] Weekly task tiles display correctly
- [ ] Can increment/decrement weekly task count
- [ ] Progress ring shows correct completion %
- [ ] Weekly tasks reset properly on week boundaries

## Overview Page
- [ ] Overview page renders chart
- [ ] Can toggle between day/week/month ranges
- [ ] Can filter by All/Category/Habit
- [ ] Chart colors and gradient render correctly
- [ ] Habit list shows correct statistics

## Archive Page
- [ ] Archive page lists completed/archived todos
- [ ] Can restore items from archive
- [ ] Can permanently delete archived items

## Navigation & Theme
- [ ] Top navigation works (Daily/Overview/Archive links)
- [ ] Theme toggle works (light/dark/system)
- [ ] Layout responsive to window resize

## Data Persistence
- [ ] All changes persist after page refresh
- [ ] Import/export backup works
