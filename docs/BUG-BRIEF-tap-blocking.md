# BUG BRIEF — Real taps do nothing (synthetic clicks pass)

> **Handoff for any agent/dev** (Antigravity or otherwise) picking this up.
> **Status:** OPEN · Build with the latest diagnostics: `2026-08-30.2`+ · Branch: `arena/01a03fe9-abot`

## Symptom
- On the deployed Vercel preview, **physical taps/clicks on shell controls do nothing**: theme toggle, sidebar collapse, model selector (real tap), sign-out.
- **Synthetic clicks all pass** — `#diag` dispatches clicks directly to elements and every effect fires (theme flips, panel opens with 17 options, sidebar toggles).
- Chat send works. App init completes (`state.isAppInitialized === true`). **Zero captured runtime errors.**
- Seen on desktop Chrome (1366×807) and mobile Chrome.

## What this pattern means
Synthetic `dispatchEvent` bypasses **hit-testing**; physical taps go through it.
Therefore: either (a) something invisible intercepts real pointer events, or
(b) the element the user sees/taps is NOT the element the handlers are bound to.

## Already fixed (verify these persist)
1. `modelSelectorPanel` existed **twice** — visible pill was wired to a distant panel. Deduplicated (commit 57ff86f).
2. Global click-closer scheduled "hide" 200 ms after **any** click — made the panel flash open/closed. Now closes only when open + click truly outside (same commit).
3. `modal-title` id duplicated (broke sign-out confirm modal wiring) → `guest-modal-title` (commit dcbe9d4).

## Ground-truth tools now in the build
- `window.__abotClicks` — **capture-phase recorder of every real click** (target tag/#id/.class, x/y, time). Not interceptable by `stopPropagation`.
- `#diag` overlay prints: build id, `initApp` completion, **duplicate-id scan**, **`elementFromPoint` hit-test** for theme/model/sidebar/send (names the element a tap at that pixel would hit, or `BLOCKED by <…>`), **viewport-covering-layer scan**, last 8 real clicks, captured errors, SW + cache versions.
- `<url>/#reset` — wipes SW + caches + storage, reloads.

## Decisive next step (2 minutes)
1. Open deploy URL → `/#reset` → reload → sign in as guest
2. **Tap the theme toggle 2–3 times** (nothing may happen — that's fine)
3. Append `#diag` to the URL
4. Read the section **"last REAL clicks"** and **"real tap hit-test"**:
   - If clicks land on `button#themeToggle` but nothing happens → handler wiring issue (re-check `initApp` ran on THIS build — see `state.isAppInitialized` line)
   - If clicks land on something else (any `<div>`/`<div#…>`) → **that** is the interceptor; find it via the covering-layer scan
   - If `elementFromPoint` says `BLOCKED by <…>` → same: kill that layer
5. Screenshot the overlay → paste results into the fix PR.

## Candidate causes, ranked
1. **Unknown overlay/interceptor** — extension-injected layer or stray fixed element the covering-layer scan can't see into (shadow DOM / extension iframes are invisible to it). Test in a **clean profile / incognito with extensions off** — this alone may resolve it.
2. CSS hit-shift (transform/zoom on a parent making visual ≠ hit target) — elementFromPoint will show the offset element.
3. Stale-layer mixing (old SW) — `#reset` + `SW:` line in diag should show `service-worker.js` + `abot-cache-v17`.

## Do NOT
- Don't re-add duplicate IDs; don't re-add the any-click closer.
- Don't rewrite the app shell — the logic is proven; this is a hit-testing/interception issue.
