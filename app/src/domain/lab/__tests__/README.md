# LAB Tests

This directory contains tests for the LAB analysis engine.

## Test Files

### `datasetBuilders.test.ts`
Tests for dataset normalization functions that convert raw logs into analysis-ready datasets.

**Coverage:**
- `buildDailyDataset()`: 5 tests
  - Empty/missing project handling
  - Tag initialization (all tags present in every row)
  - Skipping incomplete logs based on `requireOutcome`
  - Date sorting (ascending order)
  - Coverage statistics tracking

- `buildEventDataset()`: 4 tests
  - Empty/missing project handling
  - Event log tag mapping
  - Timestamp sorting
  - Notes preservation

### `methods.test.ts`
Tests for all 5 v1 analysis methods that detect correlations in the data.

**Coverage:**
- `presenceEffect`: 5 tests
  - Empty dataset handling
  - Minimum sample size requirements (3+ per group)
  - Positive correlation detection (tag → higher outcome)
  - Negative correlation detection (tag → lower outcome)
  - Confidence level assignment (high when n≥20)

- `lagEffects`: 3 tests
  - Minimum dataset size (5+ days)
  - Lag-1 detection (yesterday's tag → today's outcome)
  - Multiple lag windows (lag-1, lag-2, lag-3)

- `rollingAccumulation`: 3 tests
  - Minimum dataset size (8+ days)
  - Rolling 3-day and 7-day window detection
  - Confidence assignment based on sample size

- `doseResponse`: 3 tests
  - No intensity data handling
  - Positive dose-response detection
  - Minimum sample size (6+ intensity points)

- `regimeSummary`: 3 tests
  - Minimum dataset size (10+ days)
  - High-day vs low-day tag patterns
  - Filtering small differences (<15%)

### `safeguards.test.ts` ✨
Tests for caching and performance safeguards that prevent computation storms.

**Coverage:**
- `generateFingerprint()`: 5 tests
  - Detects log outcome changes
  - Detects tag additions/removals
  - Detects tag intensity changes in logs
  - Detects tag definition changes (intensity settings)
  - Returns same fingerprint for unchanged data

- Cache hit/miss behavior: 2 tests
  - Returns cached findings when fingerprint matches
  - Returns null when fingerprint doesn't match (cache miss)

- Throttling safeguard: 1 test
  - Prevents recomputation within 1 second
  - Returns stale cache during throttle window
  - Allows recomputation after throttle expires

## Test Helpers

### `testHelpers.ts`
Provides `createTestState()` helper that generates minimal valid `AppStateV1` objects for testing.

**Purpose:**
- Stubs out Habit Tracker fields (categories, habits, todos, etc.)
- Allows customizing LAB state only
- Ensures type safety without verbose boilerplate in every test

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# UI mode (interactive test explorer)
npm run test:ui
```

## Coverage Summary

- **33 tests total** (was 26)
- **3 test files** (was 2)
- **100% pass rate**
- **Fast execution**: ~31ms test time (was ~17ms)

## Design Principles

1. **Pure functions**: All tests use deterministic inputs with no side effects
2. **Edge cases**: Tests cover empty data, minimums, and thresholds
3. **Type safety**: Test helpers eliminate incomplete type assertions
4. **Readability**: Test names describe expected behavior clearly
5. **Guardrails**: Tests validate minimum sample sizes and confidence levels
6. **Performance**: Safeguard tests ensure cache correctness and throttling work
