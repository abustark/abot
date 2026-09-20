# ABot Commit Log

This document tracks every commit made on `main` following the `2.0.x` versioning schema:
- Sequence: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ `2.1.0`, `2.1.1`, ..., `2.1.10` ➔ `2.2.0`, etc.
- Format: `<version> - <short sentence>`

---

## Commit History

### 2.0.8 - fix duplicate shell wiring after re-login; GIS auto-select signout fix; auth teardown hardening
- **Date**: 2026-08-30
- **Changes**:
  - `initApp()` is now idempotent (`window.__abotShellWired` guard). Root cause of "collapse menu stops working after sign-in": sign-out clears `isAppInitialized`, so the next sign-in re-ran `initApp()` and re-added every click listener — two logins made the sidebar/theme toggles fire twice per click and cancel out. Reproduced with the new `tools/cycle-test.js` (login → signout → re-login → assert single-fire), now part of `npm run test`.
  - `signOutUser()` calls `google.accounts.id.disableAutoSelect()` — GIS kept the previous account auto-selected, so the Google button silently no-oped after sign-out until refresh.
  - The logged-out branch of `onAuthStateChanged` is wrapped in try/catch with a belt-and-braces forced auth-screen reveal + toast, so a single teardown failure can never leave the auth screen non-interactive.
  - Interaction-test: fixed v2.0.7 overflow-menu sequencing (row-pick closes the menu; assert re-open via trigger) and cycle-test sidebar assertion (class-set semantics, not string order).

### 2.0.7 - fix mobile freeze + mobile search close, declutter PC header
- **Date**: 2026-09-20
- **Changes**:
  - **Mobile freeze after first login (critical):** `#app-loader` (fixed inset-0, z-50) was only removed via a 300ms `setTimeout`; when that timer was throttled/dropped on mobile page transitions, an invisible full-screen pane kept swallowing every real tap until refresh. Now `hideAppLoader()` sets `pointerEvents:'none'` + `visibility:hidden` immediately, and uses `transitionend` + a fallback timer to clear `display:none`. (js/auth.js)
  - **Mobile search "X" dead:** the search panel was `position:static` with no z-index, so on narrow screens the fixed composer dock (z-10) and jump pill (z-20) overlapped and covered the close button. Search is now a sheet: `#searchPanel` gets `relative z-40` (fixed top bar on <768px) plus a `#searchBackdrop` (z-30) for tap-outside-to-close. (index.html, src/input.css, js/app.js, js/chat.js)
  - **Google sign-in dead on first mobile tap:** GSI client is `async defer` and often not loaded when `onAuthStateChanged` fired; `google.accounts.id.initialize` is now retried (~6s) instead of silently skipped. (js/auth.js)
  - **PC header declutter (Option A):** slimmer bar (h-14→h-12, hairline border), quieter model pill, and the three ghost icons (search/prompt/theme) collapsed into a single `⋯` overflow menu (`#headerOverflowBtn`/`#headerOverflowMenu`). All original element IDs preserved inside the menu so wiring and tests stay intact. (index.html, js/app.js, src/input.css)
  - **iOS search inputs:** `type="search"` → `type="text" inputmode="search"` on message + chat search so the native iOS clear-x no longer swallows the first tap.
  - Added interaction-test coverage: search backdrop open/close + header overflow menu open/close/hosts-controls/theme-flip.
  - Rebuilt `dist/output.css`. No quality gates run per owner instruction.


### 2.0.6a - ignore python cache, unstage pyc
- **Date**: 2026-09-20
- **Changes**:
  - Removed accidentally committed `tools/__pycache__/*.pyc` and added `__pycache__/` + `*.pyc` to `.gitignore`.

### 2.0.6 - finish pragmatic-polyglot tooling and remove work-order docs
- **Date**: 2026-09-20
- **Changes**:
  - Removed `docs/UI-IDEAS-FREEBUFF.md` and `docs/AI-WORK-ORDER.md` per owner directive; cleaned all stale references in `AGENTS.md`, `docs/AGENTS.md`, and `docs/UI-COMPONENTS-ROADMAP.md`.
  - Completed JSDoc/TypeScript tooling (Antigravity session item 1): added `typescript@^5.9` dev dependency, added `npm run typecheck` script (`tsc -p jsconfig.json`), expanded `types/globals.d.ts` (ChatMessage/ChatSession/AppState/ModelDefinition + window extras), relaxed `checkJs` to false so editor IntelliSense infers without breaking the 0-error typecheck gate.
  - Added `.githooks/pre-commit` (syntax + lint gates) wired via the `prepare` script (`git config core.hooksPath .githooks`).
  - Added `tools/test-security.py` — Python security-header/CSP/endpoint audit for local or staging servers.
  - Verified gates: `npm run check`, `lint`, `test`, and `typecheck` all pass with 0 errors.

### 2.0.5 - add jsconfig for typescript type checking
- **Date**: 2026-09-19
- **Changes**:
  - Added `jsconfig.json` configuring TypeScript language service to type-check vanilla JavaScript files with `"checkJs": true`, target `ES2022`, and DOM libraries.
  - Added `types/globals.d.ts` with ambient declarations for CDN-loaded libraries (`firebase`, `marked`, `hljs`, `google`, `VANTA`) and window extensions.

### 2.0.4 - fix email verification gate race and cache-bust assets
- **Date**: 2026-09-19
- **Changes**:
  - Fixed `providerData` race condition in `onAuthStateChanged` where Firebase returns an empty `providerData[]` immediately after `createUserWithEmailAndPassword`, allowing unverified users to bypass the verification gate. Replaced with a simpler `!user.isAnonymous && !user.emailVerified` check (Google users always have `emailVerified=true`).
  - Added safety guard inside `enterApp()` as a second line of defense.
  - Cache-busted `app.js` and `output.css` in `index.html` (`?v=p14`) so Vercel visitors get the new code immediately.
  - Updated test fake users with `emailVerified: true` to match the new gate.

### 2.0.3 - add playwright verification suite and ignore local sessions
- **Date**: 2026-09-19
- **Changes**:
  - Added automated Playwright end-to-end verification script in `tools/test-playwright.py` covering auth views, guest session, model selector, account menu, dark mode toggle, and backend verified email enforcement.
  - Added `.playwright/` and `.playwright-cli/` to `.gitignore`.

### 2.0.1 - update workflow rules in agents and add commit log
- **Date**: 2026-09-19
- **Changes**:
  - Updated `AGENTS.md` and added `docs/AGENTS.md` establishing `main` as primary branch.
  - Documented commit versioning standard (`2.0.1`–`2.0.10` ➔ `2.1.0` rollover).
  - Documented arena sync rules (`arena/01a03fe9-abot` updated with `docs/updates.md` on major releases).
  - Created `docs/commits.md` to track all future commits.
