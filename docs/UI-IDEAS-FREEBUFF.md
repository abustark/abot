# UI Ideas by Freebuff — Performance, Motion & Polish Backlog (v1.0.4+)

> **Created 2026-09-19 · Owner-approved direction (2026-09-19).**
> This file is the **read-first directive** for every AI agent working on ABot:
> go through this plan **before** doing anything else the user asks, and keep
> these ideas in mind for every UI change. This file overrides scattered
> suggestions elsewhere — treat it as the current UI/UX north star alongside
> `docs/IMPLEMENT-PLAN.md` (whose ledger remains the progress record).
>
> **Constraint reminder:** vanilla JS only (no animation libraries, no
> framework migration), token-only colors, motion ≤300ms from `--ease-*`
> tokens, reduced-motion respected, all AI providers are FREE-TIER — no new
> always-on AI API calls.

---

## A. Lightweight & fast (do first — biggest wins, zero visual change)

### A1 · De-duplicate highlight.js — **−159 KB off every first load** 🔴
- **Evidence:** `index.html:27` eagerly downloads `vendor/highlight.min.js`
  (159 KB, `defer` but still downloaded + parsed on every visit), while
  `js/chat.js` *also* has a complete lazy loader for the same file
  (`loadHighlightJs()` — first code block triggers one deferred load with
  graceful fallback).
- **Fix:** delete the head `<script src="/vendor/highlight.min.js">` and the
  `<link rel="stylesheet" href="/vendor/atom-one-dark.css">`; move the
  stylesheet into the lazy path in `chat.js` (inject the `<link>` alongside
  the script). Users who never render code pay nothing.
- **Accept:** no head highlight script; code blocks still highlight with
  correct theme; `npm test` green.

### A2 · Drop the Inter font files — 4 requests, ~92 KB dead weight 🟠
- **Evidence:** Geist is the UI voice and always wins `font-family: Geist,
  Inter, sans-serif`; Inter's four woff2 faces (400/500/600/700, ~23 KB each)
  are effectively never fetched. Markup uses weights 400/500/600 (+ two
  `font-bold` outliers).
- **Fix:** remove Inter `@font-face` blocks from `src/input.css`; change the
  stack to `Geist, ui-sans-serif, system-ui, sans-serif`; swap the two
  `font-bold` uses (index.html, chat.js) to `font-semibold` so browsers don't
  faux-bold a missing weight.
- **Accept:** no Inter references in CSS/HTML; text renders identically
  (Geist 600 everywhere); rebuild `dist/output.css`.

### A3 · `content-visibility: auto` on messages 🟢
- **Fix:** one CSS rule —
  `.message-container { content-visibility: auto; contain-intrinsic-size: auto 120px; }`
  Off-screen messages skip layout/paint. Massive for 100+ message threads on
  mobile. Watch for: scroll-anchor quirks (the A1 no-auto-scroll work already
  keeps the user in control), search-highlight jump still must work.
- **Accept:** long chat scrolls correctly, search jump-to-message still lands.

### A4 · Property-specific transitions 🟢
- **Evidence:** 3 `transition-all` uses remain (animate-skill rule: never
  animate `all` — it forces layout work on every frame).
- **Fix:** replace each with explicit properties (`colors`,
  `border-color, box-shadow`, etc.).
- **Accept:** zero `transition-all` in committed markup.

---

## B. Buttons & transitions — vanilla, token-based, no libraries

### B1 · View Transitions API theme crossfade ⭐ (highest feel-per-byte)
- **Fix:** in the theme toggle handler:
  ```js
  const toggle = () => { document.documentElement.classList.toggle('dark'); /* persist + icons */ };
  document.startViewTransition ? document.startViewTransition(toggle) : toggle();
  ```
  ~6 lines, progressive enhancement, instant repaint becomes a smooth
  light↔dark crossfade. Degrades silently on unsupported browsers.
- **Accept:** crossfade on Chrome/Edge; instant on Safari/Firefox; respect
  the existing reduced-motion media query.

### B2 · Send ⇄ stop morph polish
- The two states already share geometry (B2 v1.0.3). Add: 150ms icon
  crossfade between arrow and square, and a subtle coral pulsing ring on the
  stop button while streaming (CSS-only keyframe, disabled under
  `prefers-reduced-motion`).

### B3 · Send confirmation tick
- On successful send, the arrow briefly morphs to a checkmark (~600ms) before
  reset. Pure CSS class swap in `sendMessage()`'s success path. No deps.

### B4 · Chip activation pop
- v1.0.3 chips toggle state silently. Add `active:scale-95` + a 150ms tint
  transition on activation (`chip-active` already exists — add the tactile
  layer). One line each.

### B5 · Model panel @starting-style migration
- The ⋮ chat menus already use `@starting-style` enter-only motion; the model
  selector panel still uses JS opacity/transform timers. Migrate for
  consistency and less JS. Careful: `handleModelSelectorNavigation` and the
  Escape path reference the timers — keep behavior identical.

### B6 · Theme icon rotation
- Sun/moon currently hard-swap via `hidden`. A 180ms rotate+fade (scale/rotate
  on the icon pair) is warmer. Same trigger point as B1.

### B7 · Toast swipe-to-dismiss (mobile)
- Already pending on the UI roadmap (#4 polish). Touch handlers + translateX
  follow-finger + velocity threshold. Keep the close button working.

---

## C. PC & mobile UI fixes and upgrades

### C1 · Jump pill vs. mobile keyboard — real bug 🟠
- **Evidence:** `#jumpToLatest` is `fixed bottom-28`, but the composer lifts
  by `--kb-h` when the mobile keyboard opens — mid-stream with the keyboard
  up, the pill can sit under the keyboard.
- **Fix:** `bottom: calc(7rem + var(--kb-h, 0px));` (matches the composer
  dock's lifting variable).
- **Accept:** pill visible above keyboard at all times on iOS/Android.

### C2 · Chip touch targets below 44px minimum 🟠
- **Evidence:** chips are ~26px tall — under the 44px a11y minimum.
- **Fix:** keep the visual pill slim but grow the tap area (padding +
  negative margin, or `::before` hit-area expansion).
- **Accept:** ≥44px effective touch target; visual design unchanged.

### C3 · Shortcut hints in tooltips (desktop)
- Header `data-tooltip`s become "Search (Ctrl+K)" style hints. Free
  discoverability; zero new code paths (tooltip system already exists).

### C4 · D1 reading measure (from IMPLEMENT-PLAN, now prioritized here)
- Content max-width 48rem (768px) with larger side padding; ~70–80ch prose
  measure. The single biggest "calm professional" layout improvement left.

### C5 · Mobile drawer swipe-to-close (optional, medium effort)
- Touch-follow drawer close with momentum. Only after C1–C4; must not
  regress the drawer's open/close state machine in `ui.js`.

---

## Status (updated 2026-09-19 · shipped in v1.0.5)

- ✅ **A1** highlight.js *and* its theme now lazy-load on the first code block;
  the eager head tags are gone (−159 KB on every first visit) and the SW no
  longer precaches the stylesheet.
- ✅ **A2** Inter removed end-to-end: 2 `@font-face` blocks, 4 woff2 files and
  the SW precache entry are gone; sans stack is `Geist, ui-sans-serif,
  system-ui`; the two `font-bold` uses became `font-semibold` (Geist ships
  400/500/600, so bold was being faux-rendered).
- ✅ **A3** `content-visibility: auto` + `contain-intrinsic-size: auto 120px` on
  `.message-container` — ⚠️ owner should sanity-check long-thread scrolling and
  the search jump-to-message path locally (render behavior is not testable in
  jsdom).
- ✅ **A4** zero `transition-all` left — all three are property-specific now.
- ✅ **B1** theme flips through `document.startViewTransition` where available,
  and is skipped entirely under `prefers-reduced-motion`.
- ✅ **C1** `#jumpToLatest { bottom: calc(7rem + var(--kb-h, 0px)); }` — the pill
  now lifts with the mobile keyboard exactly like the composer dock.
- ✅ **C2** chip tap area reaches ≥44px via a vertical-only `::before` (the
  visible pill stays slim).
- ✅ **C4** already satisfied before this pass — the chat column is `max-w-3xl`
  (48rem), matching the intended reading measure.
- ☐ **B2–B7, C3, C5** remain — next slice (see execution order below).

## Execution order (suggested)

1. **v1.0.4 "light & motion":** A1 → A2 → A3 → A4 + B1 + C1 (+ C2/C4 if time).
   One commit per item, gates green per commit.
2. **v1.0.5:** B2–B7 motion polish + C3.
3. **C5 and any new ideas:** owner discussion first.

## Rules for every item
- Token colors only, `--ease-*` motion ≤300ms, reduced-motion respected.
- No new runtime dependencies. CSS-first. Vanilla JS.
- Interaction-test case in `tools/interaction-test.js` for anything clickable.
- `npm run build:css` + commit `dist/output.css` after any style change.
- Free-tier rule: no feature may add always-on AI API calls.
