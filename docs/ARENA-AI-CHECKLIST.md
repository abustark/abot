# ARENA AI CHECKLIST — verify these fixes, solve any that are pending

> **Instructions for any AI agent reading this on the `arena/01a03fe9-abot` branch:**
> The owner reported the issues below (mobile + desktop). A fix batch was prepared on
> `main` under version **2.4.4**. Go through **every item** and verify it on this branch
> (real browser, mobile viewport AND desktop viewport):
>
> - If an item **works as described** → mark its status here as `VERIFIED ✓` (date + branch).
> - If an item is **still broken / pending** → **implement the fix yourself** following the
>   "Expected after fix" spec, keeping the repo rules (vanilla ES modules, theme tokens,
>   no new AI API calls, versioning/commit rules from `AGENTS.md`).
> - Never guess an interpretation — the Expected text is the contract.
>
> Note: this file intentionally mirrors to `main` and `arena` alike — the force-mirror
> (`git push origin main:arena/01a03fe9-abot --force`) makes a literal "arena-only" file
> impossible to keep; the owner accepted this.

---

## 0. Context — owner's original report (verbatim summary)

> Mobile: toggle works but too slow (1.5s) — make it faster with a premium blurred
> glassmorphic design (current iOS style). Model selector doesn't fully show all models —
> models are cut inside the rectangle.
>
> Desktop: same model-list cut. Composer has a rectangle that blinks when selecting to type
> a message / with the pill suggestions; the typing area and the toggle/buttons read as
> separate things sometimes. Opening the model selector adds an extra navigation scrollbar
> in the chat screen. All buttons/popovers must collapse when clicking anywhere else on the
> screen (currently an open model toggle stays open until refresh). The opening loader
> ("ball moving") works on mobile but not on desktop; same for the collapse-sidebar toggle
> (slow on mobile, nothing on desktop). Tooltip hover texts still appear instantly — they
> should appear after an idle rest; tooltip layout must suit each button/icon position
> (not hide the chat name). Model selector should be glassmorphic like current iOS with a
> slight selection box on hover.

Owner decisions locked for this batch:
- **All animations must run on desktop exactly like mobile** — remove ALL
  `prefers-reduced-motion` guards (owner explicitly overrides the a11y rule for this app;
  Windows "animation effects off" was silently killing sidebar motion, the dotmark loader,
  tooltip delays, theme crossfade, the landing→header logo flight and the sparkles loop).
- Model list: **2 columns at every width** (long names truncate with `…`).
- Glass: **every floating surface** — mobile scrim + drawer, desktop sidebar, model
  selector, profile menu, chat-options menu.

---

## 1. Mobile drawer too slow + opaque backdrop → glass + faster

- **Expected after fix**: opening/closing the sidebar on a phone takes ~0.48s with a smooth
  iOS-style deceleration curve (NOT the old 1.5s). The page behind darkens through a
  **translucent blurred** layer (`backdrop-filter: blur + saturate`), never an opaque dim.
  The drawer panel itself is frosted (translucent surface + blur); on browsers without
  `backdrop-filter` it falls back to the opaque surface color.
- **Verification**: mobile viewport → tap the hamburger → time the slide (≈½s), inspect the
  backdrop (content behind must stay visible but blurred). Desktop viewport → the aside
  slides too (not a snap).
- **Status**: PENDING (fix lands in 2.4.4; verify then)

## 2. Model selector cut off (mobile AND desktop) + extra scrollbar on desktop

- **Expected after fix**: the panel renders in **2 columns at all widths** (one provider
  group per column, same as desktop had) and is **never clipped**: it is positioned by JS
  (`position: fixed`, node lives directly under `<body>`) — it measures the space above vs
  below the composer pill and opens on the side where the **full list fits**, capped to the
  real available height. All ~20 models are reachable without hunting/scrolling on a normal
  phone and laptop. The currently selected model is scrolled into view on open.
- **Extra scrollbar (desktop)**: with the model selector open, the chat area must show **no
  new scrollbar** — the panel no longer lives inside the landing composer dock, so it can
  no longer inflate that dock's scroll height.
- **Fallback**: on very short viewports the panel scrolls internally (with the hover
  highlight working) — but never shows a cut-off row inside the rounded rectangle.
- **Verification**: open the selector on the landing page and inside a chat, mobile + a
  768px-tall desktop; count visible providers (NVIDIA + OpenRouter + Groq + Google must all
  be visible at once on phone); watch the chat area for a scrollbar appearing.
- **Status**: PENDING (fix lands in 2.4.4; verify then)

## 3. Composer "blinking rectangle" / two separate boxes (desktop)

- **Expected after fix**: focusing the composer and typing shows ONE cohesive composer —
  no flashing rectangle, no visible split between the typing area, the buttons row and the
  suggestion pills above. The landing dock no longer shows scrollbar chrome (hidden with
  `scrollbar-width: none` + `::-webkit-scrollbar{display:none}` while staying scrollable),
  and the model panel no longer overlaps/inflates the dock.
- **Verification**: desktop, landing + chat: click into the message box, type, and place the
  caret with the suggestion pills visible — nothing should blink or jump; the composer must
  read as a single surface. If a blink still reproduces, note the exact repro (state,
  hover, caret position) in the status line and fix per the repro.
- **Status**: VERIFIED ✓ — owner-confirmed visually on device, 2026-10-18 (`main`, mirrored to `arena`)

## 4. Popovers must close on outside click/tap — EVERYWHERE

- **Expected after fix**: with the model selector, profile menu or a chat-options menu open,
  a tap/click **anywhere outside** (even on an element that stops propagation, and on the
  landing where the panel covers the suggestions) closes it. A capture-phase
  `pointerdown` handler on `document` handles this. Escape and clicking the trigger again
  still close. Scrolling the chat also closes the model panel.
- **Verification**: open each popover, tap background / composer / suggestions / another
  button — it must close every time, no refresh needed.
- **Status**: PENDING (fix lands in 2.4.4; verify then)

## 5. Desktop animations — parity with mobile (reduced-motion guards removed)

- **Expected after fix**: on a PC with Windows "animation effects" OFF (i.e.
  `prefers-reduced-motion: reduce` matches) the app must still animate exactly like mobile:
  sidebar slide, the dotted "abot" loader (`dotmark` rise), the opening dot-matrix loader,
  tooltip rest-delay, theme crossfade, landing→header logo flight, sparkles loop.
  **No `prefers-reduced-motion` branch may remain** in `src/input.css` or `js/` — verify
  with a search; the owner explicitly removed this accommodation.
- **Verification**: search `prefers-reduced-motion` → only this doc may mention it.
  Then on the reduced-motion PC: collapse the sidebar (slides), open the app (dotmark
  assembles + dot grid animates), hover a tooltip (appears after ~2.5s, not instantly).
- **Status**: PENDING (fix lands in 2.4.4; verify then)

## 6. Tooltips — rest delay + per-position layout

- **Expected after fix**: tooltips appear only after a ~2.5s hover rest (the delay was being
  wiped by the reduce guard — see item 5) and each sits clear of nearby content:
  header buttons → below; sidebar close/toggle → below; jump pill → above-right; composer
  chips → above; chat-row `⋮` ("Chat options") → a new **side-right** placement so the
  bubble never covers the chat name.
- **Verification**: hover the chat-row `⋮` — label appears to the RIGHT of the button,
  chat name stays readable. Hover the others — labels follow the placements above.
- **Status**: PENDING (fix lands in 2.4.4; verify then)

## 7. Model selector glassmorphism + hover highlight (both platforms)

- **Expected after fix**: the selector is a frosted translucent card
  (`backdrop-filter: blur(20px) saturate(1.6)` over a ~72% translucent raised/card token
  color, hairline border, soft shadow). Each model row shows a subtle rounded highlight box
  on hover (translucent ink, not an opaque fill). Profile menu and chat-options menu get
  the same frosted treatment. Opaque fallback via `@supports` where backdrop-filter is
  missing.
- **Verification**: open the selector over chat content — background must show through
  blurred; hover rows — gentle highlight box; check both light and dark themes.
- **Status**: PENDING (fix lands in 2.4.4; verify then)

---

## Recipe — how to check quickly

1. `npm ci` → `npm run build:css` → serve locally (`node server.js` or any static server).
2. Mobile checks: device emulation ~412×915. Desktop checks: ~1366×768.
3. Toggle `localStorage.darkMode` for the dark pass; reduce-motion checks: DevTools →
   Rendering → "Emulate prefers-reduced-motion: reduce" (everything must still animate).
4. Interaction test suite covers popover toggling: `npm run test`
   (`tools/interaction-test.js` — the outside-pointerdown-close case was added in 2.4.4).

## Files this batch touched (for orientation)

`index.html` (scrim class, model-panel markup) · `src/input.css` (glass, sidebar timing,
guards removed, tooltip side-right, dock scrollbar) · `js/app.js` (panel moved to `<body>` +
fixed positioning, pointerdown closer, theme check removed) · `js/chat.js` (logo-flight guard
removed, `⋮` tooltip position) · `js/sparkles.js` (reduce branch removed) · `js/ui.js`
(overlay classes) · `service-worker.js` (p33 / v59) · `dist/output.css` (rebuild).
