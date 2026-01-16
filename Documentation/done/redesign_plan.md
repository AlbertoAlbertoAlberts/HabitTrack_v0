Plan: Premium Header + Manrope + Theme Toggle
You’ve locked in: header with nav links, segmented theme toggle, Manrope, calm lime (less gaming). Next we align the app shell and token system so all pages inherit the new look and dark mode works consistently.

Steps
Add a persistent header in App.tsx and adjust App.css to avoid double padding once the header exists.
Implement header UI (app name + nav links + 3-way toggle) by wiring up TopNav.tsx (currently unused) or creating AppHeader alongside it.
Add themeMode: 'system'|'light'|'dark' to UI state and persistence in types.ts, uiState.ts, and storageService.ts.
Define light/dark token sets + calm lime accent + focus-ring token in index.css, applying theme via html[data-theme='dark'|'light'] and letting system fall back to prefers-color-scheme.
Fix “header + viewport math” by introducing --header-h and updating Daily layout sizing in DailyPage.module.css (it currently uses min-height: 100vh and max-height: calc(100vh - 32px)).
Add Manrope as self-hosted fonts: put files under app/public/fonts/ and add preload links in index.html, then set font-family tokens in index.css.
Replace hardcoded light-only colors with tokens in key components so dark mode is consistent: Dialog.module.css, WeeklyTaskTile.module.css, then page modules.