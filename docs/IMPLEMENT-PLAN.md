# ABot — UI/UX IMPLEMENT PLAN (living document)

> Created 2026-09-19 · base: `main` @ `5a8364e` (v1.0.1)
> Method: full code audit + Playwright recon on `localhost:3000` (PC 1440×900, mobile 390×844).
> **Purpose:** this file is the backlog AND the progress ledger. Every session: audit completed items against it, tick statuses, then commit as `Version 1.0.x — <short sentence>`.
> Rule (AGENTS.md): features that add AI API calls need owner sign-off — marked 💰 below.

Status legend: ☐ planned · ◐ in progress · ✅ done · ❌ rejected

---

## A. Behavior fixes (P0 — user-reported)

### A1 · Streaming must not auto-scroll ☐
- **Evidence:** `js/chat.js:756` — `dom.chatHistoryContainer.scrollTo({ top: scrollHeight, smooth })` runs on every stream batch → long answers yank the viewport to the bottom while the user is reading the first lines.
- **Fix:** scroll the user's message into view **once, on send** (so the reply starts on screen); remove the in-stream scroll entirely. The user scrolls at will.
- **Nice-to-have:** "Jump to latest ⬇" pill fades in when the user has scrolled up >200px during an active stream (A1b).
- Accept: send a long prompt; viewport stays put; no jank.

### A2 · Message actions slim-down ☐
- **Evidence:** `js/chat.js:362-378` — AI messages currently render copy + 🔊 + 👍 + 👎 + 📌 + 🗑; user messages get copy + ✏️ + 🗑.
- **Fix:** AI row = **Copy + Read aloud** only. Remove 👍/👎/📌 buttons (and `react-up/down-btn`, `pin-btn` handlers + `toggleReaction`/`togglePin` calls; 📌 emoji in the label row goes too).
- **User row:** keep Copy + Edit + Delete (edit/delete are curation, not reaction noise).
- **Placement (A3):** move the action row to the **top-right of the message, aligned with the model-label line** (inline with meta, right side) instead of a hover row under the bubble. Hover-reveal on desktop, always-visible on touch (`@media (hover:none)` rule already exists). Accept: ≤2 buttons on AI rows, aligned to meta line, no layout shift on reveal.

### A4 · Streaming indicator honesty ☐
- Typing dots show before first token; after that the blinking cursor is enough — verify no double indicator, cursor sits inline (not on its own line).

### A5 · Desktop auth: guest click intercepted ☐ (P0 — Playwright-verified)
- At 1440×900, clicking `#guest-signin-btn` times out (mobile clicks fine). Something intercepts pointer events on desktop-auth only. Suspects: Google GSI invisible iframe, Vanta canvas stacking, or layout shift from A6's `↵` glyph. Debug with `elementFromPoint` at the button center + overlay scan (`#diag` pattern).
- Accept: `page.click('#guest-signin-btn')` succeeds <2s at desktop viewport.

### A6 · Guest button label "Continue⏎ as Guest" ☐ (one-liner)
- Stray `↵` (U+21B5) inside the label markup. Remove; also give the guest entry a ghost-button affordance (currently plain muted text — D2 follow-up).

---

## B. Composer redesign (P0/P1)

### B1 · Textbox upgrade ☐
- Min-height ~52px (2 lines), auto-grow to max ~40vh on desktop (currently `max-h-48` = 192px — raise), `focus-within` ring already tokened — keep.
- Placeholder hint "Enter to send · Shift+Enter for newline" on desktop only.

### B2 · Send ⇄ Stop morph button ☐
- One circular coral button; send icon crossfades to stop square while streaming (currently two separate buttons with a `hidden` swap — visible jump).
- 44px target, dimmed when input empty, `active:scale-95` kept.

### B3 · Web-search toggle chip 💰☐
- Chip in composer footer row: 🌐 "Search" — OFF by default, per-message, active state = coral tint.
- Backend: OpenRouter `:online` / web plugin; Gemini → grounding with Google Search.
- ⚠️ AGENTS.md free-tier rule: consumes provider quota — exists only behind the toggle (never always-on). Owner approved 2026-09-19.

### B4 · Thinking toggle chip 💰☐
- Chip 🧠 "Think" — **enabled only when the selected model is thinking-capable** (`MODEL_CONFIG` gains `thinking: true`; DeepSeek R1 groq/nvidia, Gemini 2.5 Pro). Disabled chip for other models (greyed + tooltip "Model doesn't support extended thinking").
- Sends provider param (reasoning effort / thinkingBudget); 🧠 badge on the header model pill while on.

### B5 · Model capability badge ☐
- Model pill: small ⚡ / 🧠 glyph before the name — sets expectations before sending.

---

## C. Header & navigation (P0 mobile, P1 desktop)

### C1 · Mobile header declutter ☐
- **Evidence:** mobile header stacks hamburger + title + ✏️ + ➕ + model pill + 🔍 + 📋 + theme toggle in one 56px row (~7 controls on 390px) — the "ugly crowded" chat screen.
- **Fix:** mobile header = **hamburger + title (+✏️) + model pill only**.
  - 🔍 message search → sidebar (under chat search) + command palette.
  - 📋 prompt library → composer chip row (B) + palette action.
  - 🌙/☀️ theme → sidebar, beside Settings in the user card.
  - ➕ header new-chat → remove on mobile; sidebar "New Chat" is primary.
- Accept: ≤4 elements per mobile header row; nothing truncates at 360px.

### C2 · Desktop header rhythm ☐
- Right cluster grouped with hairline dividers: [model pill] | [search · prompts] | [theme]; consistent hover states.

---

## D. Visual & layout polish (professional, not flashy)

### D1 · Message list reading measure ☐
- Desktop content max-width 3xl (768px) → **48rem with larger side padding**; line-length ~70-80ch for prose; consistent vertical rhythm.

### D2 · Sidebar refinement ☐
- Section labels (uppercase 11px muted), search inside a grouped block, chat rows 40px, active item = coral inset + card tint (exists), hover 120ms.
- User card: avatar + name + settings + theme (C1 move) + sign-out — one tidy cluster.

### D3 · Composer area ☐
- Disclaimer text 11px muted centered (exists) — align with new chip row; dock shadow added in polish pass; verify no seam during mobile keyboard states.

### D4 · Motion pass (≤200ms, interruptible) ☐
- Audit every `transition`: property-specific (never `all`), ease-out tokens, no keyframes on frequently-triggered elements. Tooltips/menus 150ms, modals 180ms, drawer 300ms (existing).

### D5 · Empty state & suggestions ☐
- Coral glow + centered layout (v1.0.1) — refine suggestion-card copy; hover lift exists; add subtle 40ms stagger.

### D6 · Dark/light parity sweep ☐
- Every new surface uses tokens (`raised`, `card`, `hairline`) — screenshot both themes in Playwright and compare.

---

## E. New feature candidates

### E1 · Jump-to-latest pill ☐ (pairs with A1)
- Appears only while streaming AND user scrolled up; click = smooth-scroll to bottom; hides on arrival.

### E2 · Regenerate last response 💰☐
- ↻ button in AI action row (after A2 slim-down); re-sends last prompt, replaces reply. One extra AI call per use — needs explicit owner OK.

### E3 · Command palette additions ☐
- Toggle web search, toggle thinking, jump-to-latest, regenerate — keyboard-first parity with chip UI.

### E4 · Message search inside chat (mobile placement) ☐
- Re-home existing searchPanel per C1; verify result scroll + highlight (`search-highlight` exists).

---

## F. Playwright recon findings (2026-09-19, Chrome headless via `tools/ui-recon.py`)

> Screenshots: `%TEMP%\abot-ui\` (desktop-auth, mobile-auth, mobile-chat, mobile-composer-focus, mobile-messages, mobile-model-panel). Re-run anytime: server up → `python tools/ui-recon.py`.

### Measured (hard numbers)
- **Mobile header (390px):** 8 visible controls — `sidebarToggle, chatTitle, renameChatBtn, headerNewChatBtn, modelSelectorBtn, searchToggleBtn, promptBtn, themeToggle` — **368px of the 390px viewport (94%)**, with a **real overlap `chatTitle ↔ renameChatBtn`** → renders as title "N" + pencil jam (visible in mobile-chat.png). C1 is justified, not cosmetic.
- **Mobile AI message row:** `copy, speak, 👍, 👎, 📌, 🗑` (6 buttons, always visible on touch) + code-copy inside blocks — confirms A2. Emoji reactions clash with the warm token palette.
- **Model panel fits** within mobile viewport (no clipping) ✅.
- **Desktop sign-in click TIMED OUT** (mobile signed in fine) — actionability blocked on `#guest-signin-btn` at 1440px. Something intercepts pointer events on desktop-auth only. Suspects: Google GSI invisible iframe / Vanta canvas layer / the stray `↵` label reflow. → new item A5; this smells like the old tap-blocking bug class on the auth screen.
- **Guest button label renders "Continue⏎ as Guest"** — stray `↵` (U+21B5) glyph inside the label. → new item A6, one-line fix.
- **scrollProbe inconclusive** (injected short messages didn't overflow) — A1 stands on code evidence (`chat.js:756`).
- **No page errors** in either viewport; light theme rendered (headless default) — D6 comparison needs both-theme captures.

### Desktop-auth screenshot notes (desktop-auth.png)
- Visual language is strong (Vanta net, warm card, serif display, eyebrow pill, build badge).
- "Continue as Guest" is plain muted text — low affordance for the fastest entry path; consider ghost-button styling (D2).
- Footer "© 2026 … under active development" fine.

### Mobile-chat screenshot notes (mobile-chat.png)
- Header: title unreadable ("N"), controls collide — C1.
- Action row: emoji noise + permanently-visible destructive 🗑 — A2/A3.
- Composer dock: good post-polish (rounded, mic, coral send, arrow-up icon) — B2 morph still pending.
- Large dead space with 1 message — acceptable; D1 measure + D5 will help.

---

## G. Explicitly rejected / parked
- ❌ Framework migration (AGENTS.md §5 — settled decision).
- ❌ Always-on web search (free-tier rule).
- ❌ "Smart" auto-scroll modes (user wants manual scroll; E1 pill covers the only real need).

## H. Progress ledger (update every session)

> **Direction note (2026-09-19):** the owner-approved UI/perf/motion direction
> now lives in **`docs/UI-IDEAS-FREEBUFF.md`** — read it FIRST (AGENTS.md
> carries the read-first rule). This ledger remains the progress record; the
> ideas file is the north star for what "polish" means next (v1.0.4 "light
> & motion" = its A1–A4 + B1 + C1 items).

> **Session 2026-09-19 (v1.0.3 completion):** finished the interrupted v1.0.3 work —
> wired dead controls (chips had no listeners, jump pill had no logic, sidebar quick
> actions unwired), added missing `.composer-chip`/`.chip-active`/`.jump-enter` CSS
> + rebuilt `dist/output.css`, plumbed `options:{webSearch,thinking}` through
> `validateChatRequest` (strict bool coercion, tests added) into both backends
> (OpenRouter `:online`, Gemini `google_search` + `thinkingConfig`, Groq/NVIDIA
> ignored), B1 textbox (52px min, 40vh max) + fading Enter hint, B2 morph kept,
> E3 palette commands, SW cache v23. Gates: check ✅ lint 0 errors ✅ npm test ✅
> (9 new interaction assertions incl. per-model chip gating) CSS rebuilt ✅.

| Item | Target version | Status | Evidence / commit |
|------|---------------|--------|-------------------|
| A1 no auto-scroll | 1.0.2 | ✅ | v1.0.3 — single scroll on send (`chat.js`), no in-stream scroll |
| A2 actions slim-down | 1.0.2 | ✅ | v1.0.3 — AI rows = copy·read-aloud·regenerate; 👍/👎/📌 removed |
| A3 placement | 1.0.2 | ✅ | v1.0.3 — actions on the model-label line, top-right |
| A5 desktop auth click fix | 1.0.2 | ✅ | fixed with shell restore (`f7ad27d`); re-verify on deploy |
| A6 guest label ↵ + affordance | 1.0.2 | ✅ | v1.0.3 — ↵ removed, ghost-button styling |
| B1 textbox | 1.0.3 | ✅ | v1.0.3 — min 52px, max 40vh, Enter hint fades while typing |
| B2 send⇄stop morph | 1.0.3 | ✅ | v1.0.3 — stop overlays send (same geometry, no jump) |
| B3 web search chip 💰 | 1.0.5 | ✅ | v1.0.3 — chip → `:online`/`google_search`; owner OK 2026-09-19 |
| B4 thinking chip 💰 | 1.0.5 | ✅ | v1.0.3 — chip → Gemini `thinkingConfig` 8192; owner OK 2026-09-19 |
| C1 mobile header | 1.0.3 | ✅ | v1.0.3 — search/prompts/theme re-homed to drawer, quick-action row |
| E1 jump-to-latest pill | 1.0.6 | ✅ | v1.0.3 — shows only while streaming AND scrolled up >200px |
| E2 regenerate 💰 | 1.0.7 | ✅ | v1.0.3 — `regenerateLastResponse()`, one AI call per use |
| E3 palette additions | 1.0.6 | ✅ | v1.0.3 — web search / thinking / jump-to-latest commands |
| E4 message search mobile placement | 1.0.6 | ✅ | v1.0.3 — drawer Search opens the panel |
| B5 model capability badge | 1.0.6 | ☐ | |
| C2 desktop header rhythm | 1.0.4 | ☐ | |
| D1-D6 polish pass | 1.0.4 | ☐ | |

