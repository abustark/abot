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

## Status (updated 2026-09-19 · shipped in v1.0.6)

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
### v1.0.6 — motion + new-chat landing (shipped)

- ✅ **B2** the stop control wears a coral ring that pulses while a response is
  streaming. Driven by the button's own `.stop-hidden` state, so no extra JS
  flag; the ring is static (not animated) under reduced motion. The icon
  crossfade was folded into the same states instead of adding a second element.
- ☐ **B3** *send tick — deliberately skipped:* the tick would report a success we
  don't know about yet (the request may fail a moment later). A false-positive
  confirmation is worse than no confirmation; revisit only if the send promise
  resolves before the tick would end.
- ✅ **B4** chips acknowledge the press (`scale(0.96)`, transform in the 150ms
  transition), and chip hover now sits behind `@media (hover: hover)` so it
  cannot stick after a tap on touch.
- ✅ **B5** the model panel is now `@starting-style` enter-only, matching the ⋮
  menus. **This also fixed a real bug:** five call sites each scheduled their own
  `setTimeout(...hidden, 200)`, so open → close → open could leave the panel
  stuck invisible. All five were replaced by one `openModelPanel` /
  `closeModelPanel` pair.
- ✅ **B6** sun/moon cross-fade + rotate via a new `.is-off` state (`display:none`
  could never animate). Reduced motion keeps the fade, drops the rotation.
- ✅ **B7** toasts follow the finger 1:1 (pointer capture) and dismiss on either
  48px or a flick (>0.5 px/ms); a short drag settles back instead of vanishing.
  Touch/pen only, so a mouse text-selection drag can't fling the toast away.
  All three dismiss paths (timer, ×, swipe) now route through one `dismissToast`.
- ✅ **C3** tooltips wait 240ms before appearing, but a repeat hover (sweeping a
  toolbar) is instant — `[data-tooltip-instant]`, set by one delegated listener.
  Keyboard focus is never delayed. Hints now read "Send (Enter)" and
  "Search messages (Alt+/)".
- ✅ **C5** the mobile drawer follows a horizontal drag and closes on 35% width or
  a flick. A gesture only claims the touch once it is clearly horizontal, so the
  chat list still scrolls; `ui.js`'s state machine is untouched (the inline
  transform is handed back before `closeSidebar()` runs).

### Owner-requested UI pass (v1.0.6, same release)

- ✅ **New-chat landing:** on an empty chat the greeting, composer and four
  suggestion cards centre together mid-screen (`body.chat-empty`); the composer
  releases the bottom anchor and lifts by half the mobile-keyboard height, so it
  can never hide behind the keyboard. Sending restores the normal layout.
- ✅ **Message-level delete removed for good** — user rows are copy · edit, AI
  rows are copy · read aloud · regenerate. The stale `.delete-msg-btn` CSS
  selectors went with it. (Chats are still deletable from the sidebar ⋮ menu.)
- ✅ **Model panel inline `style` removed** and the composer's `--kb-h` offset
  moved from an inline style into CSS, so layout states can override it.

### v1.0.7 — auth backdrop, account menu, composer alignment (shipped)

- ✅ **Auth backdrop is CSS-only.** The sign-in screen lazy-loaded three.js +
  vanta.net from two CDNs and painted a `VANTA.NET` canvas: several hundred KB
  of third-party JS on the very first screen, plus a silent failure whenever a
  CDN was blocked. It is now an aurora — three slow-drifting blooms plus a
  masked hairline grid — transform/opacity only, ~0 KB, offline-safe, and under
  reduced motion the composition stays while the drift stops. The app now ships
  **no third-party scripts at all** (`marked` and `highlight.js` are vendored).
  ⚠️ Follow-up for the owner: `cdn.jsdelivr.net` / `cdnjs.cloudflare.com` in
  `vercel.json`'s CSP `script-src` are now unused and could be removed.
- ✅ **Account menu** replaces the settings panel. The profile row is the trigger
  for a `role="menu"` popup above it holding Import chat, Dark mode, Read replies
  aloud, Show timestamps, and Sign out last in red. Outside-click and Escape
  dismiss it; the switch rows deliberately stay open.
- ✅ **The dark-mode switch actually slides.** The old `.switch-track` needed
  app.js to write `data-on` after every theme change; the new `.switch` follows
  the checkbox's own `:checked` through `peer`, so the knob cannot disagree with
  the theme.
- ✅ **Composer right edge fixed.** The chips and the action buttons shared one
  `flex-wrap` container with `order-*` + `mr-auto` re-ordering, which left dead
  space after the send button. The box is now a textarea over one explicit
  `justify-between` row.
- ✅ Brand mark is a flat silhouette — black on light, white on dark — with
  per-theme tab icons (see the v1.0.6-logo commit).

## Execution order

1. ~~v1.0.4 "light & motion": A1 → A2 → A3 → A4 + B1 + C1 (+ C2/C4).~~ ✅ shipped
2. ~~v1.0.5: remaining perf + the two mobile bugs.~~ ✅ shipped
3. ~~v1.0.6: B2/B4–B7 + C3 + C5 + the owner's new-chat landing and settings pass.~~ ✅ shipped
4. **Next:** B3 revisit-trigger, the D-polish items in `IMPLEMENT-PLAN.md`, and
   the optional drawer drag-handle affordance.

## Rules for every item
- Token colors only, `--ease-*` motion ≤300ms, reduced-motion respected.
- No new runtime dependencies. CSS-first. Vanilla JS.
- Interaction-test case in `tools/interaction-test.js` for anything clickable.
- `npm run build:css` + commit `dist/output.css` after any style change.
- Free-tier rule: no feature may add always-on AI API calls.
