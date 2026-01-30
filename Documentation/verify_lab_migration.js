/**
 * LAB State Migration Verification Script
 * 
 * This script helps verify that Phase 1 migration is working correctly.
 * Run this in the browser console to check LAB state initialization.
 */

(function verifyLabMigration() {
  console.group('🧪 LAB State Migration Verification');
  
  const storageKey = 'habitTracker.appState';
  const raw = localStorage.getItem(storageKey);
  
  if (!raw) {
    console.error('❌ No app state found in localStorage');
    console.groupEnd();
    return;
  }
  
  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    console.error('❌ Failed to parse app state:', e);
    console.groupEnd();
    return;
  }
  
  console.log('📦 Current App State:', state);
  
  // Check if LAB exists
  if (!state.lab) {
    console.error('❌ LAB state is missing!');
    console.groupEnd();
    return;
  }
  
  console.log('✅ LAB state exists');
  
  // Verify LAB structure
  const requiredKeys = [
    'version',
    'projects',
    'projectOrder',
    'tagsByProject',
    'tagOrderByProject',
    'dailyLogsByProject',
    'eventLogsByProject'
  ];
  
  const missingKeys = requiredKeys.filter(key => !(key in state.lab));
  
  if (missingKeys.length > 0) {
    console.error('❌ Missing LAB keys:', missingKeys);
  } else {
    console.log('✅ All required LAB keys present');
  }
  
  // Verify LAB version
  if (state.lab.version === 1) {
    console.log('✅ LAB version is correct:', state.lab.version);
  } else {
    console.error('❌ LAB version is incorrect:', state.lab.version);
  }
  
  // Verify LAB is empty (for new installs)
  const isEmpty = 
    Object.keys(state.lab.projects).length === 0 &&
    state.lab.projectOrder.length === 0 &&
    Object.keys(state.lab.tagsByProject).length === 0;
  
  if (isEmpty) {
    console.log('✅ LAB is properly initialized (empty)');
  } else {
    console.log('ℹ️  LAB contains data:', {
      projectCount: Object.keys(state.lab.projects).length,
      projectOrder: state.lab.projectOrder,
    });
  }
  
  // Verify other state is intact
  const hasOtherState = 
    'categories' in state &&
    'habits' in state &&
    'dailyScores' in state &&
    'uiState' in state;
  
  if (hasOtherState) {
    console.log('✅ Other app state is intact');
  } else {
    console.error('❌ Other app state may be corrupted');
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log('- Schema version:', state.schemaVersion);
  console.log('- LAB version:', state.lab?.version);
  console.log('- LAB projects:', Object.keys(state.lab?.projects || {}).length);
  console.log('- Categories:', Object.keys(state.categories || {}).length);
  console.log('- Habits:', Object.keys(state.habits || {}).length);
  
  console.groupEnd();
  
  return {
    state,
    labState: state.lab,
    isValid: state.lab && state.lab.version === 1 && missingKeys.length === 0
  };
})();
