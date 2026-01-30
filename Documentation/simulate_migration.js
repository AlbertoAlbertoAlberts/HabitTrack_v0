/**
 * LAB Migration Simulation Script
 * 
 * This script simulates an old app state (without LAB) and demonstrates
 * that the migration works correctly.
 * 
 * USAGE:
 * 1. Open the app in your browser (http://localhost:5173)
 * 2. Open browser console
 * 3. Copy and paste this entire script
 * 4. Follow the prompts
 */

(function simulateLabMigration() {
  console.group('🔄 LAB Migration Simulation');
  
  const storageKey = 'habitTracker.appState';
  
  console.log('Step 1: Backing up current state...');
  const currentState = localStorage.getItem(storageKey);
  const backup = currentState ? JSON.parse(currentState) : null;
  
  if (backup) {
    console.log('✅ Current state backed up');
    console.log('Current LAB state:', backup.lab ? 'EXISTS' : 'MISSING');
  }
  
  // Create an old state without LAB
  console.log('\nStep 2: Creating simulated old state (without LAB)...');
  
  const oldState = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    meta: {
      appVersion: '0.0.0',
      createdAt: '2025-01-01T00:00:00.000Z'
    },
    categories: {
      'cat-test-1': {
        id: 'cat-test-1',
        name: 'Test Category',
        sortIndex: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z'
      }
    },
    habits: {},
    dailyScores: {},
    dayLocks: {},
    weeklyTasks: {},
    weeklyProgress: {},
    weeklyCompletionDays: {},
    todos: {},
    todoArchive: {},
    uiState: {
      dailyViewMode: 'category',
      selectedDate: '2026-01-22',
      overviewRangeDays: 7,
      overviewWindowEndDate: '2026-01-22',
      overviewMode: 'overall',
      overviewSelectedCategoryId: null,
      overviewSelectedHabitId: null,
      dailyLeftMode: 'normal',
      todoMode: 'normal',
      themeMode: 'system'
    }
    // NOTE: NO 'lab' field - this simulates old state
  };
  
  console.log('✅ Old state created (without LAB field)');
  console.log('Categories in old state:', Object.keys(oldState.categories));
  
  // Save the old state
  console.log('\nStep 3: Saving old state to localStorage...');
  localStorage.setItem(storageKey, JSON.stringify(oldState));
  console.log('✅ Old state saved');
  
  console.log('\n⚠️  Please REFRESH the page now to trigger migration.');
  console.log('After refresh, run the verification script to check results.');
  console.groupEnd();
  
  // Provide restore function
  window.restoreBackup = function() {
    if (backup) {
      localStorage.setItem(storageKey, JSON.stringify(backup));
      console.log('✅ Original state restored. Refresh the page.');
    } else {
      console.log('❌ No backup available');
    }
  };
  
  console.log('\n💡 Tip: If you want to restore your original state, run: restoreBackup()');
  
  return {
    oldState,
    backup,
    restore: window.restoreBackup
  };
})();
