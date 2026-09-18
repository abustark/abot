# ABot â€” UI/UX + Bug Audit & Fix Plan

**Date:** 2026-09-19 Â· **Base:** `origin/main` @ `216d1f2` (branch: `audit/ui-ux-fixes`)
**Scope:** full shell audit (`index.html`, `js/*`, `src/input.css`, gates) after the Sep-13 premium revamp.
**Reported symptoms:** (1) menu/sidebar not collapsing on PC & mobile, (2) an unused Ã— button, (3) hover popups clipped at the top of the site.

---

## 0. Gate status on main (before any fix)

| Gate | Result | Notes |
|---|---|---|
| `npm run check` (acorn syntax) | âœ… PASS | all files parse |
| `npx eslint js` (app code) | âœ… PASS | 0 errors, 7 unused-var warnings |
| `node tests/chat-security.test.js` | âœ… PASS | |
| `node tools/smoke-node.js` | âŒ **CRASH** | `initApp crashed: ReferenceError: MutationObserver is not defined` |
| `node tools/interaction-test.js` | âŒ **CRASH** | same â€” **no interaction test runs at all** |
| `npm run lint` (`eslint .`) | âŒ 1053 errors | **all from `.freebuff/` worktree** (minified bundle, no globals). App code itself is clean. |

> CI note: `.github/workflows/ci.yml` runs `npm test`, so **main is currently red in CI** because of the MutationObserver crash.

---

## 1. Root-cause findings (the bugs behind your symptoms)

### F1 â€” ðŸ”´ `initApp()` crashes in the test harness â†’ every shell control is dead in tests
`js/app.js:479` uses `new MutationObserver(...)` (modal a11y: scroll-lock + focus-restore). The harness (`tools/smoke-node.js` + `tools/interaction-test.js`) copies `js/` into `tmp/smoke-esm/` and imports it in Node, setting globals for `document`, `window`, `localStorage`â€¦ but **never sets `global.MutationObserver`**. So `initApp()` throws at line 479 â€” **before** the listeners for sidebar toggle, sign-out, rename, etc. attach (wired later, lines 524â€“591).

This is why "synthetic clicks do nothing" resurfaces: in the harness **no click works** because init died. Same *shape* as the original tap-blocking bug (handler never attached â†’ tap does nothing) â€” verify in a real browser with `#diag` that nothing upstream also aborts init early.

**Fix:** add `global.MutationObserver = window.MutationObserver;` to both harnesses. One line each â†’ tests go green.

### F2 â€” ðŸ”´ Duplicate `id="sidebarToggle"` (the "unused Ã—" + "menu not collapsing")
Two elements share the ID (a known-fixed pitfall per AGENTS.md â€” **regressed in the revamp**):
- `index.html:237` â€” sidebar brand row: `aria-label="Close sidebar"`, **Ã— icon** (the unused-looking Ã—; visible on desktop and, as the duplicate, **dead**)
- `index.html:346` â€” header: `aria-label="Toggle sidebar"`, hamburger (**the one that should work**)

`dom.js:34` `getElementById('sidebarToggle')` returns **#237 (the Ã—)**. The one listener (`js/app.js:353`) lands on the Ã—. Result:
- **Desktop:** header hamburger (#346) has **no listener** â†’ click does nothing â†’ *"menu not collapsing on PC."* Sidebar Ã— (#237) is visible but dead â†’ *"unused Ã—."*
- **Mobile:** the drawer toggle is the header hamburger (#346) â€” dead â†’ drawer **can't open/close by tap** â†’ *"menu not collapsing on mobile."*

**Fix:** distinct IDs â€” `#sidebarToggle` (header hamburger) and `#sidebarCloseBtn` (drawer Ã—). Wire both. Add `md:hidden` to the Ã— so it's mobile-only (the comment at line 231 already says it should be). Register `sidebarCloseBtn` in `dom.js`.

### F3 â€” ðŸŸ  Hover tooltips clipped at the top of the viewport
`src/input.css:477-496`: every `[data-tooltip]::after` is positioned **above** its trigger (`bottom: calc(100% + 6px)`). Header buttons (`sidebarToggle`, `renameChatBtn`, `modelSelectorBtn`, `searchToggleBtn`, `promptBtn`, `themeToggle`, `headerNewChatBtn`) sit at `top:0` in an `h-14` header â†’ tooltip renders **above the viewport** â†’ *"hover popup hidden at the top."*

**Fix:** add a `data-tooltip-pos="bottom"` variant (`top: calc(100% + 6px); bottom:auto;`) and apply it to **all header buttons**. Keep the top default where there's space above (composer `sendBtn`/`voiceBtn`/`stopBtn`).

### F4 â€” ðŸ”´ `firebase.state.auth` is broken on main (Jules' auth fix never landed on main)
`js/auth.js:98` & `:126` still use `firebase.state.auth.GoogleAuthProvider(...)` â€” `state.auth` is **not** on the global `firebase`, so:
- Google sign-in via GIS (`handleCredentialResponse`) **throws**
- Guestâ†’Google linking (`linkGuestToGoogle`) **throws**
- `signOutUser()` (line 93) only calls `stopSpeaking()` â€” **never signs out**

The fix exists as `a94c87d` on `origin/arena/01a03fe9-abot`, but `git merge-base --is-ancestor a94c87d origin/main` = **false** â€” main diverged from `e22949b` and never picked it up.

**Fix:** cherry-pick / re-apply `a94c87d` (also fixes `guestLimitModal` aria-labelledby â†’ `guest-modal-title`, rebuilds CSS).

### F5 — ?? `npm run lint` fails (1053 errors) because of `.freebuff/`
`eslint.config.js` ignores covers `node_modules`, `dist`, `vendor`, `tmp`, `.claude`, `.agents` — but **not `.freebuff/`**, which holds a full worktree incl. a minified JS bundle with no declared globals. The CI 0-errors gate fails on any machine that has run the freebuff flow.

**Fix:** add `.freebuff/**` to the `ignores` array.

### F6 — ?? Escape-key early-`return` chain can skip the sidebar close
`js/app.js:395-420` handles `Escape` with `if (...) { ...; return; }`. The sidebar-close branch (line 412) is only reached if none of the modal/panel branches above it matched. Note the model-selector branch (line 408) closes by `dom.modelSelectorBtn.click()` — if that button is ever in F2 dead state, Escape is a no-op. Re-test ordering after F1/F2.

### F7 — ?? Composer keyboard offset uses `window.innerHeight` (layout), not visual viewport
`--kb-h = innerHeight - vv.height - vv.offsetTop`. On browsers that already resize layout (`interactive-widget=resizes-content`) this is 0 (correct). But it runs on every visual-viewport `scroll`; on iOS Safari `vv.offsetTop` changes during rubber-banding and can briefly produce a wrong offset. Low priority — verify on a device.

---

## 2. Fix plan (small commits, gates green per commit)

### Commit 1 — Unbreak the test harness (F1)  · fixes CI red + nothing-clickable-in-tests
- `tools/smoke-node.js`: `global.MutationObserver = window.MutationObserver;`
- `tools/interaction-test.js`: same
- **Verify:** smoke ?, interaction test prints PASS/FAIL list instead of crashing. New FAILs that surface become new findings.

### Commit 2 — Sidebar IDs + collapse (F2)  · fixes menu not collapsing (PC & mobile), unused ×
- `index.html`: header hamburger keeps `id=sidebarToggle`; drawer × ? `id=sidebarCloseBtn` + `md:hidden`.
- `js/dom.js`: add `sidebarCloseBtn`.
- `js/app.js`: wire `sidebarCloseBtn ? closeSidebar()`; header toggle stays the open/close.
- `tools/interaction-test.js`: assert both buttons collapse/expand the drawer.
- **Verify:** interaction test passes; real browser: hamburger toggles on desktop, drawer × + overlay close on mobile.

### Commit 3 — Tooltip direction (F3)  · fixes hidden hover popups
- `src/input.css`: add `[data-tooltip-pos="bottom"]::after { top: calc(100% + 6px); bottom: auto; }`.
- `index.html`: add `data-tooltip-pos="bottom"` to every header button.
- `npm run build:css` and **commit `dist/output.css`** (repo rule: compiled CSS is committed).
- **Verify:** hover header icons ? tooltip appears below, fully visible.

### Commit 4 — Auth correctness (F4)  · fixes Google sign-in/link throw, sign-out no-op
- Cherry-pick `a94c87d` (or re-apply): `firebase.state.auth` ? `firebase.auth` (×2), real `state.auth.signOut()` in `signOutUser()`, `guestLimitModal` aria fix.
- **Verify:** `npm run check` ?; real browser: guest ? sign out returns to auth screen; Google link does not throw.

### Commit 5 — Lint gate (F5)  · fixes `npm run lint` red
- `eslint.config.js`: add `.freebuff/**` to `ignores`.
- **Verify:** `npm run lint` ? 0 errors (warnings = 30).

### Commit 6 (optional, low-pri) — Keyboard offset + Escape ordering (F6, F7)
- Re-test Escape chain after F2; only reorder if a real path is dead.
- Re-test composer on iOS Safari; only touch `--kb-h` math if the offset visibly jumps.

---

## 3. Definition of done
- [ ] `npm run check` ?
- [ ] `npm run lint` ? 0 errors
- [ ] `npm test` ? all 3 suites green (security, smoke, **interaction — incl. the new sidebar case**)
- [ ] `npm run build:css` + `git diff --exit-code -- dist/output.css` (committed, not stale)
- [ ] Real browser, desktop + mobile: sidebar opens/closes (hamburger, ×, overlay, Esc), no dead ×, header tooltips visible below icons, guest sign-in ? sign out works
- [ ] `/#diag` overlay: all hit-tests "reaches button", 0 viewport-covering layers

## 4. Out of scope / needs owner sign-off
- `api/chat.js`, `server.js`, `lib/chat-security.js`, `vercel.json`, `firestore.rules` — untouched (hard rule).
- No new AI API calls added (free-tier rule respected — all fixes are client-side).
