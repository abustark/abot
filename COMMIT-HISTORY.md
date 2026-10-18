# ABot Commit Log

This document tracks every commit made on `main` following the versioning schema:
- Structure: `2.0.1` … `2.0.10` ➔ **rolls over to `2.1.0`**; then `2.1.1` … `2.1.10` ➔ **`2.2.0`**; then `2.2.1` … `2.2.10` ➔ **`2.3.0`**, and so on.
- **The third number NEVER exceeds `.10`.** When it would, roll the second number. Do not write `2.0.11`, `2.1.11`, … — that is the drift this rule exists to prevent.
- Format: `<version> - <short sentence>`

> ### 📌 Next version — **keep this line current, every commit**
> - **`main` → `2.4.7`** (current head is `2.4.6`)
> - **`arena/01a03fe9-abot` → mirrors `main`** (no version of its own: `git push origin main:arena/01a03fe9-abot --force`;
>   both branches stay identical)

> **⚠️ Branch-version independence (read before comparing branches):** `main` and
> `arena/01a03fe9-abot` keep **separate, independent version numbers and commit names**. The same number
> on both branches does **NOT** mean the same work — e.g. `main`'s `2.0.10` and arena's `2.0.10` were two
> completely different commits by different agents. Sync direction is one-way (`main` → arena) and it is now a
> **plain force-push mirror** (`git push origin main:arena/01a03fe9-abot --force`) — arena no longer keeps commits of its own.
> **Always identify/compare commits by their hash, never by version number alone.**

> **🧾 History note (why the numbering above looks odd):** commits `2.0.11`–`2.0.26` (arena) and
> `2.0.27`–`2.0.31` (main, this session) were written **past the roll-over point** — `.10` was exceeded
> instead of rolling to `2.1.0`. That drift is now corrected: the roll-over rule above is enforced from
> **`2.1.0`** onward, and the `📌 Next version` line must be updated with each commit.

---

## Commit History

### 2.4.6 - hygiene sweep + motion polish + guideline-audit defect fixes
- **Date**: 2026-10-18
- **Why**: owner-approved batch from the skills-driven proposal (emil-design-eng + find-animation-opportunities + web-design-guidelines): remove dead code left by earlier feature removals, make the docs match reality, ship 5 small motion items, and fix the defects the full guideline audit surfaced (owner chose "defects in 2.4.6"; the a11y + perf findings stay queued for later batches).
- **Dead code (leftovers of earlier removals)**: `startVoiceRecognition` + `alert()` + `state.recognition` (voice-input remnants), `COLOR_MAP`/`generateColorClasses` (superseded by `PROVIDER_COLORS`/`getProviderColor`), `_persistMessageMeta` (reactions/pins leftover), `.voice-pulse` CSS + `#voiceBtn:active` style. Stale comments corrected (utils.js header, chat.js "copy/speak/regen" and "reaction toggles", config.js stray Firestore comment).
- **Guideline-audit defect fixes**: command palette built chat labels via `innerHTML` — a stored-XSS vector for user/imported/AI-named chats → now DOM/textContent; palette "Search messages" uses the same gate as `openSearch()` (empty-chat toast + backdrop reveal); `.abot-toast` scroll-guard reattached (selector was still `#toast-notification`, dead since toasts became class-based); duplicate dialog attrs removed (`#guestLimitModal`, `#deleteModal`); stray `</main>` removed (no `<main>` opener existed); loader `role="status"` + `aria-hidden` contradiction resolved (aria-hidden kept — it's a paint-blocker, not live content); `theme-color` meta now follows the active theme (head pre-paint block + `syncThemeIcons`); chat-row ⋮ menus Escape-close with focus return to the trigger (was outside-click only).
- **Motion (5)**: new chat rows enter once (180ms rise, `.chat-item-enter` — only genuinely new ids via `renderedChatIds`, no replay on re-render); deleting a chat collapses the row 160ms before the list re-renders (`collapseChatRow`, WAAPI with jsdom-safe fallback); copy buttons morph to an inline check for ~1.2s (`flashCopiedState` — message copy + both code-copy sites); model options get `active:scale-[0.98]` press feedback; tooltips warm — once a tooltip has appeared, the next one within 1s skips the 2500ms rest (`data-tooltip-warm`, JS + CSS).
- **Docs truth pass**: README (36→20 models; dropped auto-collapse, reactions/pins, current-chat-chip claims), PROJECT-INFO (20 models, SW v60 + 24 precached assets, v2.4.6 head; reactions/pins/voice-input claims removed), js/README rows (config.js + utils.js exports).
- **Tests**: new interaction case — chat-row options menu opens and Escape closes it (M2 block, reuses the existing XSS-test chat row).
- **Cache-bust**: `?v=p33` → `?v=p34`, `abot-cache-v59` → `abot-cache-v60`; `ABOT_BUILD` → `2026-10-18.1`.
- **dist/output.css**: rebuilt via `npm run build:css` and committed (new `chat-item-enter` keyframes, `active:scale-[0.98]`, `transition-[background-color,transform]`).

### 2.4.5 - gate pass: interaction-test drift fixed (all suites green)
- **Date**: 2026-10-18
- **Why**: owner requested a full gate run for the 2.4.4 batch. `npm run test` surfaced 4 failures — all stale/flaky TEST expectations, not app bugs (app contracts verified in source: `chat.js` toggles `chat-empty` from the message count; the sparkle canvas replaced the aurora blooms in 2.4.1).
- **`tools/interaction-test.js` fixes**:
  1. "normal layout returns once messages exist" — the active chat is an untouched "New Chat" in this environment, so restoring `savedMessages` restored an EMPTY array and `chat-empty` legitimately stayed on. The check now probes with a guaranteed non-empty thread (2 messages), asserts, then restores the original state.
  2. "auth backdrop renders aurora layers" — asserted `.auth-bloom` ≥ 3, but the blooms were removed in 2.4.1 (sparkles). Updated to the current contract: `#auth-scene` + `#auth-sparkles` canvas present.
  3. "toasts stack (2 visible)" — a toast from the earlier empty-chat search step was still alive (time-based auto-dismiss), so 3 showed. The stack is now cleared deterministically before asserting exactly 2; the "toast close removes it" check follows cleanly.
- **Full gate results**: `npm run lint` — 0 errors (2 known pre-existing warnings: unused `identityKey` in `api/chat.js` + `server.js`); `npm run check` — every JS file parses; `npm run build:css` — rebuilt, `git diff --exit-code -- dist/output.css` clean; `npm run test` — chat-security ✅ · jsdom smoke ✅ · interaction ✅ (102 checks) · auth cycle ✅.
- **No app/runtime changes** — cache-bust stays at `?v=p33` / `abot-cache-v59`; `dist/output.css` untouched by this commit.

### 2.4.4 - arena AI checklist for the pending mobile/desktop fixes (part 1 of 2)
- **Date**: 2026-10-18
- **Why**: owner directive — before the fix work starts, a spec/checklist must exist so any AI working on the `arena` branch can verify each reported fix (fixed vs still pending) and implement whatever is pending. Owner chose a dedicated file (`docs/ARENA-AI-CHECKLIST.md`); with the force-mirror setup it necessarily lives on both branches (accepted by owner).
- **Content**: all 7 reported items (drawer quality/speed, model-list clipping, extra scrollbar, composer blink, outside-close popovers, desktop animation parity incl. reduced-motion guard removal, tooltip delay/placement, glassmorphism) each with: expected-after-fix contract, verification steps, PENDING status line (to be flipped to VERIFIED by the arena AI).
- **Part 2/2** (fix batch) follows in the same version — see the next entry.

### 2.4.4 - mobile/desktop fix batch: glass surfaces, animation parity, model-panel rework, popover close-all, tooltip placement (part 2 of 2)
- **Date**: 2026-10-18
- **Owner report** (7 items, the checklist in `docs/ARENA-AI-CHECKLIST.md` is the full spec): drawer too slow + opaque backdrop; model list cut off (mobile AND desktop); composer "rectangle that blinks" while typing; an extra scrollbar appears when the model selector opens; popovers don't close when clicking anywhere else; loader + sidebar animate on mobile but not desktop; tooltips appear instantly and one covers the chat name; model selector should be glassmorphic with a hover selection box.
- **Animation parity — every `prefers-reduced-motion` branch removed (owner directive, overrides the AGENTS.md a11y line by explicit owner call)**: 13 CSS guards in `src/input.css` (incl. the global utilities kill-switch, sidebar snap, dotmark assembly, tooltip transition, popover enters, switch/typing/stop-ring) + 3 JS checks (`app.js` theme crossfade, `chat.js` logo flight, `sparkles.js` still-frame). Root cause of "desktop has no animations": Windows "animation effects off" makes Chrome report `reduce`, which those guards matched. Stale comments updated; the only remaining mentions are intentional historical notes.
- **Sidebar (mobile "too slow", desktop "nothing")**: 1.5s → **480ms** `cubic-bezier(0.32,0.72,0,1)` (the --ease-drawer token curve) on every platform; the 2.4.0 reduced-motion snap guard is gone.
- **Glass everywhere (owner: "EVERYTHING")**: sidebar rail `surface/0.85 + blur(24px) saturate(1.5)`; mobile scrim `bg-ink/40` → `ink/0.25 + blur(14px) saturate(1.4)` (the "opaque white" is now a frozen translucent blur); model selector `canvas/card @72% + blur(20px) saturate(1.6)`; profile menu + chat-options menu `@78% + blur(16px)`. One consolidated `@supports not (backdrop-filter)` block supplies opaque fallbacks. Model rows now hover with a translucent ink "selection box" instead of an opaque fill.
- **Model selector rework (cut models + phantom scrollbar)**: app.js moves `#modelSelectorPanel` to `<body>` at init; new `positionModelPanel()` measures the natural list height and the space above/below the pill, opens on whichever side fits the WHOLE list (below preferred), clamps `max-height` to the measured space + horizontally into the viewport, glues itself on `resize`/`visualViewport.resize`, and closes when any outside scroll container moves. Markup: always `grid grid-cols-2` (2 columns on phones too, owner-approved), `w-[calc(100vw-2rem)] max-w-[26rem]`; positioning utilities, `max-h-[55vh]` and the 2.3.9 `body.chat-empty` placement CSS removed. The panel no longer lives inside the landing dock's scroll container, so no row is clipped and no extra scrollbar can appear.
- **Popover close-all (owner: "stayed open until refresh")**: new capture-phase `pointerdown` listener closes the model panel, profile menu and chat-options menus before any target handler can `stopPropagation()` — touch + mouse. The old click-based closer is kept for jsdom/tests; ESC and trigger re-tap still toggle.
- **Composer blink**: the landing dock's scrollbar chrome is now hidden (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}` — still scrollable). The suspected mechanism (textarea growth tipped the dock's `max-height:100dvh; overflow-y:auto` over the edge and the transient Windows scrollbar shifted the layout) can no longer paint a scrollbar; final visual confirmation is on the owner's gate pass / the arena checklist (item 3).
- **Tooltips**: the 2500ms rest delay now applies on every OS setting; new `data-tooltip-pos="side-right"` variant; the chat-row ⋮ switched from `left` to it, so the bubble opens into the main pane instead of over the chat name.
- **Cache-bust**: `?v=p32` → `?v=p33`, `abot-cache-v58` → `abot-cache-v59`.
- **Tests**: `tools/interaction-test.js` — the "panel in composer" contract updated (pill stays composer-hosted, panel is body-level) + new case: outside `pointerdown` closes the model panel.
- **dist/output.css**: rebuilt via `npm run build:css` and committed.

### 2.4.3 - starting loader: dot-matrix animation under the "abot" wordmark (Pace UI Dot Loader port)
- **Date**: 2026-10-18
- **Owner request** (reference: 21st.dev / @paceui "Dot Loader"): use that loader as the starting-site loader, below the dotted abot wordmark. Owner asked if the exact component could be found elsewhere — it was: Pace UI's public registry (`gsap.paceui.com/r/dot-loader.json`) serves the full source file, and the demo `game` frames were extracted from the component page payload, so this is a verbatim port (frames, timing, geometry), not an approximation.
- **Source facts kept 1:1**: 7×7 grid of 49 dots, 6px dots, 2px gap (`gap-0.5`), `rounded-sm` corners, per-frame `classList.toggle("active", frame.includes(index))`, 100ms default interval, loops forever.
- **New `js/dotloader.js`**: holds the 16-frame "Playing" demo sequence verbatim (a snake traversing the grid, dot indices 0–48); `initDotLoader(grid)` applies the first frame immediately then advances every 100ms. The interval stops once `#app-loader` is hidden (auth.js flips visibility/display) — no idle 10 Hz timer.
- **Markup**: the old `.loader-circle-22` ring spinner was replaced by the 7×7 `<span>` grid (`#dot-loader`) in the same flex slot under the dotmark wordmark.
- **Styling uses theme tokens** (not the demo's `bg-white/15`): idle dots `rgb(var(--c-ink) / 0.14)`, `active` dots `rgb(var(--c-coral))` — the coral the spinner used before it.
- **No reduced-motion guard**: it is a status indicator (the spinner it replaces had none either) — the motion is functional, not decorative.
- **Cache-bust**: `?v=p31` → `?v=p32`, `abot-cache-v57` → `abot-cache-v58`; `/js/dotloader.js` added to the SW precache.
- **dist/output.css**: rebuilt via `npm run build:css` and committed (the spinner keyframes were removed, the `.dot-loader` rules added).

### 2.4.2 - sparkle field retuned to the original Sparkles demo parameters
- **Date**: 2026-10-17
- **Context**: after 2.4.1 the owner supplied the actual reference demo source ("SparklesPreviewColorful" from the 21st.dev / Aceternity Sparkles component); this commit aligns the field with its real values.
- **`js/sparkles.js` retuned**:
  - **density**: `particleDensity={100}` means 100 particles per 400×400 px in tsparticles → `count = w·h / 1600` (2.4.1 used 1 per 9000 px², i.e. ~5.6× sparser). Sanity cap 4000 for very large viewports; floor 40.
  - **size**: exactly `minSize 0.6 / maxSize 1.4` (was 0.6–1.9).
  - **twinkle**: `speed={0.5}` in the demo = slow linear fade → triangle wave 0.1→1→0.1 over a 5–7s full cycle, random phase per dot (was a 2.6–9s sine).
  - **drift**: `move speed 0.1–1` reads as a slow wander → 2–10 px/s straight-line drift with edge wrap (2.4.1 dots were stationary; tsparticles "out" respawn ≈ wrap for dots).
  - **click**: demo has onClick `push` (quantity 4) → clicking the auth screen now seeds 4 sparkles at the cursor (never past the 4000 cap).
  - **render**: one flat dot per sparkle like tsparticles does (the halo pass was dropped — cheaper at the higher density and truer to the source).
- **Cache-bust**: `?v=p30` → `?v=p31`, `abot-cache-v56` → `abot-cache-v57` (the new SW install refetches `/js/sparkles.js`).
- **No CSS change** — `dist/output.css` untouched (no `build:css` needed).

### 2.4.1 - auth page gets a twinkling sparkle backdrop (replaces the blooms + grid)
- **Date**: 2026-10-17
- **Owner request** (reference: 21st.dev / @manuarora700 "Sparkles"): put a background effect like that on the auth page — owner chose to **replace** the v1.0.7 blooms + grid, with **mixed multi-colour** sparkles.
- **New `js/sparkles.js`** — vanilla canvas port (no third-party script, no framework): twinkling dots (soft halo + bright core, sine-pulsed alpha/radius), density ~1 per 9k css px² (70–240 dots), DPR capped at 2. Palette is read from the existing theme tokens (coral, amber, teal, Google blue, Groq violet, NVIDIA green) — no new colours, dark mode flips automatically.
- **Lifecycle**: the rAF loop runs only while `#auth-section` is visible (MutationObserver on its inline `display`) and the tab is on screen; `prefers-reduced-motion: reduce` draws one still frame instead. jsdom-safe (null 2D-context guard — smoke test unaffected).
- **Markup/CSS**: `#auth-scene` now holds `<canvas id="auth-sparkles">`; `.auth-bloom*`, `.auth-grid` and the `authDrift` keyframes were removed with it (scene wrapper + vignette kept).
- **Cache-bust**: `?v=p29` → `?v=p30`, `abot-cache-v55` → `abot-cache-v56`; `/js/sparkles.js` added to the SW precache.
- **dist/output.css**: rebuilt via `npm run build:css` and committed.

### 2.4.0 - sidebar motion now respects prefers-reduced-motion (snaps instead of the 1.5s slide)
- **Date**: 2026-10-17
- **Owner request** (follow-up to the 2.3.10 note): add the missing reduced-motion off-switch for the sidebar.
- **Change**: new `@media (prefers-reduced-motion: reduce)` guard in `src/input.css` — `.sidebar { transition: none; }`. Collapse/expand still works, it just snaps instantly; same pattern as the other component guards in the file.
- **Cache-bust**: `?v=p28` → `?v=p29`, `abot-cache-v54` → `abot-cache-v55`.
- **dist/output.css**: rebuilt via `npm run build:css` and committed.
- **Note**: first `2.4.x` number (rolled over from `2.3.10` per the versioning scheme).

### 2.3.10 - sidebar collapse now slides over 1.5s so the motion is clearly visible
- **Date**: 2026-10-17
- **Owner request**: "make the collapse menu atleast a 1.5sec sliding transition so that we can see it slide."
- **Change**: `.sidebar` transition duration `0.42s` → **`1.5s`** on all three properties (transform, margin-left, border-right-color). Still the single motion owner — applies to the desktop collapse and the mobile drawer alike (consistent with the owner's desktop/mobile parity ask). Curve (`cubic-bezier(0.4, 0, 0.2, 1)`) and all state/positioning rules unchanged.
- **Cache-bust**: `?v=p27` → `?v=p28`, `abot-cache-v53` → `abot-cache-v54`.
- **dist/output.css**: rebuilt via `npm run build:css` and committed.
- **Note**: `2.3.10` is the rollover boundary — **the next version number is `2.4.0`.**

### 2.3.9 - model selector fixed: two-column grid (no horizontal overflow) + drops below the pill on the landing
- **Date**: 2026-10-17
- **Owner request** (screenshot): the model selector panel "is like this — fix it" — the open panel showed only half the models with a bottom scrollbar, empty space, and it covered the "How can I help today?" heading on the landing.
- **Root cause**: the panel used CSS multicols (`md:columns-2`) with `max-h-[55vh]` + `overflow-y-auto`. Once the model list outgrew the max height, multicols fragment into **extra columns to the right** — horizontal overflow (off-screen models + bottom scrollbar) instead of vertical scroll. It also broke the keyboard nav silently: `handleModelSelectorNavigation` reads `gridTemplateColumns` for its ArrowUp/Down jump distance, which computed to `none` here (= 1 column).
- **Changes**:
  - `index.html`: `#modelSelectorPanel` `md:columns-2` → **`md:grid md:grid-cols-2 md:gap-x-2`** — grid flows into rows and scrolls vertically under `max-h`; no horizontal overflow possible (names truncate), and ArrowUp/Down works against a real 2-column grid again.
  - `src/input.css`: `body.chat-empty #modelSelectorPanel` now opens **downward** (`top: calc(100% + 8px)`, `transform-origin: top left`) — on the landing the composer floats mid-screen, so the upward panel covered the greeting heading; in normal chats it still opens upward.
  - `js/app.js`: stale multicol comments in `renderModelSelectorOptions` updated (grid item per provider — headings can never split from their options).
  - `index.html` + `service-worker.js`: cache-bust `?v=p26` → `?v=p27`, `abot-cache-v52` → `abot-cache-v53`.
  - `dist/output.css` rebuilt via `npm run build:css` and committed with the change (grid/gap utilities).
- **Note**: next version number is `2.3.10` — the last before the mandatory roll to `2.4.0`.

### 2.3.8 - New Chat guard shows an info toast on repeat clicks
- **Date**: 2026-10-17
- **Owner request**: clicking the New Chat button/icon again must give a popup notification explaining what happened.
- **Changes**:
  - `js/chat.js`: both guard paths in `createNewChat` now toast — staying on the untouched active chat → *"You already have a new chat open."*; switching to an existing untouched chat → *"Switched to your existing new chat."* — both via the muted `info` toast style (2.3.5). The real creation path stays silent.
  - `index.html` + `service-worker.js`: cache-bust `?v=p25` → `?v=p26`, `abot-cache-v51` → `abot-cache-v52`.
  - `tools/interaction-test.js`: regression block extended — both guard paths assert their info toast text.
- **Note**: no CSS changes — `dist/output.css` untouched this batch.

### 2.3.7 - New Chat reuses an untouched chat (no duplicate empty-chat pile-up)
- **Date**: 2026-10-17
- **Owner request**: opening a new chat while already sitting on an empty one — or clicking New Chat repeatedly — must not be able to create a series of empty "New Chat" rows.
- **Changes**:
  - `js/chat.js`: `createNewChat` now guards before creating — (a) if the **active chat is untouched** (no messages, or a pre-2.3.5 chat holding only the seeded greeting) the click just closes the mobile drawer and stays put; (b) if **any** untouched chat exists, the **newest** one is switched to instead of creating another; only when none exists does it create + persist a new chat. New shared helpers `LEGACY_GREETING` / `isEmptyChat` — `renderActiveChat`'s lone-greeting cleanup now uses them too.
  - Applies to every New Chat entry point for free (sidebar button, header button, Alt+N, palette, delete-last-chat recovery) since they all funnel through `createNewChat`.
  - `index.html` + `service-worker.js`: cache-bust `?v=p24` → `?v=p25`, `abot-cache-v50` → `abot-cache-v51`.
  - `tools/interaction-test.js`: new regression block — repeated New Chat on an untouched chat adds no row; the newest untouched chat is reused when one exists elsewhere.
- **Note**: no CSS changes — `dist/output.css` untouched this batch.

### 2.3.6 - sidebar collapse root-cause fix, tooltip idle-delay + edge-aware positions, landing spacing
- **Date**: 2026-10-17
- **Owner request** (walkthrough, round 3 + screenshots): add breathing room between the composer, the disclaimer line and the suggestion pills; tooltips should behave like OS title bubbles (rest ~2–3 s before showing); the "Chat options" bubble was trimmed at the sidebar edge; the header "New chat" bubble was cut at the top-right viewport edge; the sidebar collapse still showed no visible smooth transition.
- **Changes**:
  - Root cause of the "collapse too fast": the `<aside>` carried Tailwind utilities `transition-transform duration-300 ease-drawer` which overrode the `.sidebar` rule in the cascade — and `margin-left` (the actual desktop collapse property) was not in their transition list, so the collapse **snapped with no animation at all**. Utilities removed from `index.html`; the `.sidebar` rule (420 ms `cubic-bezier(0.4, 0, 0.2, 1)`, transform + margin-left + border-right-color) is now the single owner of the sidebar motion.
  - `src/input.css`: hover tooltip delay `240 ms` → **`2500 ms`** (rest-to-see, like the browser title bubble; the old "instant sweep" repeat case removed); keyboard focus stays immediate and leaving a trigger hides the bubble at once. Three new edge-anchored tooltip variants — `left` (sidebar rows), `bottom-right` (header right cluster), `right` (jump pill) — so bubbles are never trimmed by clipping containers or the viewport.
  - `index.html`: disclaimer row `mt-1.5` → `mt-3`; `#emptySuggestions` gains `mt-4` (composer → disclaimer → pills now 12 px / 16 px); `headerSearchBtn` / `headerNewChatBtn` → `data-tooltip-pos="bottom-right"`; `jumpToLatest` → `data-tooltip-pos="right"`; asset cache-bust `?v=p23` → `?v=p24`.
  - `js/chat.js`: chat-row options button gets `data-tooltip-pos="left"` (bubble opens inside the rail instead of clipping at the list edge).
  - `js/app.js`: tooltip "instant sweep" pointerover helper deleted (it was the only consumer of `[data-tooltip-instant]`).
  - `service-worker.js`: `abot-cache-v49` → `abot-cache-v50`, `?v=p23` → `?v=p24`.
- **Note**: code committed as `e4cf4e0` under the owner's "commit and push only" instruction at the time; this entry is the immediate follow-up commit of the same 2.3.6 batch. `dist/output.css` was rebuilt via `npm run build:css` and committed with the code.

### 2.3.5 - polish batch: calmer sidebar glide, pane-centred landing, suggestion pills, mobile header fix, message tooltips
- **Date**: 2026-10-17
- **Owner request** (walkthrough, round 2): the sidebar expand/collapse felt like "flight speed" with a stutter; the landing composer centred on the viewport (not the pane) and jumped around the sidebar; opening a new chat (New Chat) still showed the greeting + normal layout; suggestion cards should become a row of chips; the mobile header's right cluster sat next to the title; on phones the composer chips should hug the model pill again; searching an empty chat opened a dead panel; the send arrow + stop square needed optical polish; message actions used the raw browser title bubble; the account avatar stayed initials even with a photo set.
- **Changes**:
  - `src/input.css`: `.sidebar` transition 300 ms `--ease-drawer` → **420 ms `cubic-bezier(0.4, 0, 0.2, 1)`** (slow ramp in AND out — kills the flight-speed jump); md+ `body.chat-empty #composerDock` becomes `position: absolute` so the landing composer centres on the **pane** and re-centres in sync while the sidebar width animates (mobile stays fixed); `.suggestion-card` → `.suggestion-pill` (hover lift kept desktop-only) with stagger slots extended to 8.
  - `index.html`: header right cluster pinned with `grid-column:3` (sub-md, `#headerLogo` is `hidden md:block` so the cluster used to land in column 2 next to the title); composer pane gets `relative` (anchor for the landing dock); chips row back to `mr-auto` (hug the model pill on phones too); send icon → single clean arrow path + `aria-hidden`; stop icon → 7×7 `rx=2` optically-centred square; `data-tooltip` on `modelSelectorBtn` / `profileMenuBtn` / `jumpToLatest`; asset cache-bust `?v=p22` → `?v=p23`.
  - `js/chat.js`: `createNewChat` now stores `messages: []` (the seeded "Hello! How can I assist you today?" greeting made every new chat skip the landing); `renderActiveChat` clears a lone legacy greeting; `SUGGESTIONS` become 8 single-line pills (Explain a concept · Brainstorm ideas · Help me write · Debug my code · Plan a trip · Check my reasoning · Summarize a text · Translate something) — click-to-fill only, zero extra AI calls; message action buttons (`retry` / `copy` / `speak` / `edit` / chat options) switch `title` → `data-tooltip` (app-styled bubble).
  - `js/app.js`: `openSearch` guard — an empty chat shows an info toast ("This chat has no messages to search yet.") instead of a dead sheet; `#diag` search self-check updated to expect the gate on an empty chat.
  - `js/utils.js`: new muted `info` toast type (icon + `text-muted`).
  - `js/ui.js`: composer chips get `data-tooltip` via `setAttribute` (state-dependent strings preserved).
  - `js/auth.js`: account avatar renders the real `photoURL` as a DOM-built `<img>` (`no-referrer`, error → initials fallback; guest keeps `G`).
  - `service-worker.js`: `abot-cache-v48` → `abot-cache-v49`, stylesheet `?v=p19` → `?v=p23` (returning browsers drop pre-2.3.5 JS/CSS).
  - `tools/interaction-test.js`: search block updated for the header toggle + seeded-message state + new empty-chat guard case; header button count 2 → 3; suggestion checks moved to `.suggestion-pill` (8).
- **Note**: `dist/output.css` rebuilt via `npm run build:css` and committed **in this commit** — the 2.3.4 stale-CSS window (runtime classes missing from the committed build) is why the rebuild rides along this time.

### 2.3.4 - desktop polish: landing overlap fix, header logo flight, sidebar/composer tweaks
- **Date**: 2026-10-17
- **Owner request** (desktop walk-through + mobile composer chips): ugly landing layout; logo should move to the header centre on first send; smoother sidebar expand/collapse; trim the under-composer hint row; move message search to the header; slim the sidebar quick actions; bigger right-aligned chips on mobile.
- **Changes**:
  - `index.html`: `#emptySuggestions` moved INSIDE `#composerDock`, below the composer — as an outside sibling it sat in normal flow at the top of the empty main and the centred fixed dock overlapped it (root cause of the screenshot bug: cards top-anchored with the logo floating between them).
  - Header rebuilt as a 3-zone grid (inline style): new centred `#headerLogo` brand mark (desktop-only, opacity-toggled) between the left cluster and the right actions; new `#headerSearchBtn` (message search) sits left of `#headerNewChatBtn`.
  - Sidebar: `#sidebarSearchBtn` removed (search moved to the header); `Ctrl K for commands` kbd hint now sits below the New Chat button (desktop-only); Prompts is the only remaining quick action.
  - Composer: under-composer row trimmed to the disclaimer only (Enter/Ctrl-K hints gone); mobile chips (`Web search`/`Think`) pushed right (`ml-auto` + wider gap) and enlarged via a CSS media query.
  - `js/chat.js`: first-send logo flight — `flyLogoToHeader()` FLIP (WAAPI, 300 ms `--ease-drawer`-style curve, transform-only, reduced-motion-safe); `#emptyLogo` id on the landing logo; rect captured in `sendMessage` before `setEmptyMode(false)`; header logo visibility follows empty mode.
  - `src/input.css`: sidebar collapse targets `border-right-color: transparent` instead of snapping `border-right-width` to 0 (kills the 1 px mid-slide content shift) and the colour joins the transition; new mobile chip sizing rule.
  - Asset cache-bust `?v=p21` → `?v=p22` (`output.css`, `js/app.js`).
- **Note**: `dist/output.css` rebuilt via `npm run build:css` and committed as this batch's follow-up commit (brings the new sidebar/chip CSS plus earlier unbuilt utilities like `md:columns-2` to production).

### 2.3.3 - hard rules: do exactly the ask, give options when unsure
- **Date**: 2026-10-17
- **Why**: owner directive — two recurring failures (inventing extra scope around a request; guessing / self-debating side-decisions) written down as hard rules so every future session inherits them.
- **Changes**:
  - `AGENTS.md` §5: new hard rules **7** (do exactly what the owner asked — invent nothing; adjacent issues get one line in the report, no unrequested fixes) and **8** (unsure / side-decision → offer 2–4 options and wait; never re-decide repeatedly).
  - Global `C:\Users\abu\.config\opencode\AGENTS.md` (outside this repo): same two rules added as a "Working discipline" section, so they apply to every project.
  - Lessons half of the request skipped per owner call (agentmemory MCP not wired in this session; no `LESSONS.md` created).

### 2.3.2 - arena sync policy: mirror main (no merge commits)
- **Date**: 2026-10-17
- **Why**: owner directive — `arena/01a03fe9-abot` is no longer synced by merging `main`; it is force-pushed as a straight mirror of `main`, so the two branches are always identical.
- **Changes**:
  - `AGENTS.md` §1 item 3 + `docs/AGENTS.md` §1 item 3: arena sync rewritten to `git push origin main:arena/01a03fe9-abot --force` (the `merge main <version> into arena/...` flow is retired).
  - `COMMIT-HISTORY.md`: `📌 Next version` arena line + branch-independence note updated to the mirror policy.
  - Arena branch force-pushed to `main` (its 2 merge-marker commits `4b206f3`, `7a56463` are dropped — their content is already in `main`).

### 2.3.1 - rename commit log to COMMIT-HISTORY.md (universal name)
- **Date**: 2026-10-17
- **Why**: owner directive — one recognizable commit-history file name in every repo, always at the repo root (`COMMIT-HISTORY.md`), so the log is found instantly when opening a project.
- **Changes**:
  - `docs/commits.md` → **`COMMIT-HISTORY.md`** via `git mv`; all references updated (`AGENTS.md` ×3, `docs/AGENTS.md` ×2, `README.md`, `PROJECT-INFO.md`).
  - Cross-repo same batch (each repo's own sequence): `project_bmw` → `COMMIT-HISTORY.md` (`2.0.21`); HOUSE (`2.0.10`); `price-trail`, `linkly`, `cover_letter_gen` begin versioned commits at `2.0.0` with `COMMIT-HISTORY.md` created (owner picks: name = `COMMIT-HISTORY.md`, start = `2.0.0`).
  - `docs/updates.md` (arena-only) intentionally untouched.

### 2.3.0 - sync one-version-per-response rule into docs/AGENTS.md duplicate
- **Date**: 2026-10-17
- **Why**: `docs/AGENTS.md` is a stale duplicate of the root `AGENTS.md`; a session reading it instead of the root would miss the new rule. Folded the cross-project sync of the same rule into the same owner request — one version number per batch, as the rule itself demands.
- **Changes**:
  - `docs/AGENTS.md` §1 item 2: added the "One version number per agent response / request batch" bullet (wording identical to the root `AGENTS.md`).
  - Cross-repo same batch (each repo's own sequence, not abot numbers): `project_bmw/docs/commits.md` `2.0.20` + `HOUSE-PRICE/docs/commits.md` `2.0.9` headers; introduced the versioning scheme + rule into `price-trail/AGENTS.md`, `linkly/AGENTS.md` + `CLAUDE.md`, `cover_letter_gen/AGENTS.md` (start at `1.0.0`, history before it unversioned). `PhotoDuplicateCleaner` left untouched (owner call: not a git repo).

### 2.2.10 - clarify one version per agent response + advance next-version line
- **Date**: 2026-10-17
- **Why**: codify the rule (already practiced) that a single owner request / agent response batch consumes exactly **one** version number — not one per issue, not one per commit. Folded the dead-helper cleanup and this doc line into the same version instead of burning a second number.
- **Changes**:
  - `AGENTS.md` §1 item 2: the "one version per agent response / request batch" rule made explicit (multiple commits in one response may not each take a new number; follow-up fixes fold into the same version).
  - `docs/commits.md`: `?? Next version` advanced to `main` → `2.2.11`.

### 2.2.9 - remove dead isSearchOpen helper
- **Date**: 2026-10-17
- **Why**: the 2.2.8 overflow-menu removal deleted the only caller of `isSearchOpen` (the header search toggle); the leftover const tripped `no-unused-vars` in the pre-commit lint run. Deleted so the lint output stays at the two pre-existing `identityKey` warnings.

### 2.2.8 - mobile/desktop polish pass: composer, header, sidebar cleanup
- **Date**: 2026-10-17
- **Owner request** (mobile walk-through list): copy whitespace, "Show more" collapse, per-message regenerate icon, dotted typing loader, model-panel columns, new-chat icon, sidebar duplicate current-chat block, prompt-library borders, header "⋯" menu, composer action-row overlap.
- **Changes**:
  - `js/chat.js`: copy trims trailing per-line spaces + squeezes 3+ blank lines (was the raw template `textContent`); "Show more" collapse removed (`maybeCollapse` + all call sites) — long replies scroll naturally; per-message regenerate icon removed (error-card Retry remains the regenerate path); typing indicator is now a mini dotted-"A" (same 18 dots + baked delays as the splash wordmark; `.typing-indicator` wrapper class kept for the removal selectors); title-gen animation retargeted to `#headerChatTitle`; `renderActiveChat` no longer writes the removed sidebar title.
  - `index.html`: header "⋯" overflow menu removed entirely — header now carries the sidebar toggle + New chat only; New chat icon is the compose (pencil-square) icon; sidebar's duplicate current-chat block removed (rename lives in each chat row's options menu); sidebar quick actions (Search/Prompts) now visible on desktop too (`md:hidden` removed — the parity answer); composer chips are icon-only on phones (globe / brain) with labels from md up + `aria-label`s — fixes the action-row overlap; model panel gets `md:columns-2 md:w-[26rem]`; asset bust `?v=p20` -> `?v=p21`.
  - `js/app.js`: overflow wiring, theme icon sync, header search-toggle listener and sidebar rename listeners removed; `#diag` rewired (account switch, sidebar search, `sidebarPromptBtn`, tap-test probes `headerNewChatBtn`); model groups wrapped in `break-inside-avoid` blocks for the two-column panel; build id `2026-10-17.1` -> `2026-10-17.2`.
  - `js/palette.js`: "Toggle theme" now flips `#sidebarThemeSwitch` (the header button it used to click is gone).
  - `js/dom.js`: registry pruned (themeToggle/sunIcon/moonIcon/searchToggleBtn/promptBtn/chatTitle/chatTitleInput/renameChatBtn).
  - `js/ui.js`: prompt-library chips get per-item borders (active = coral border + fill).
  - `src/input.css`: dotted-A typing CSS (replaces the bounce dots); `#headerOverflowMenu` P3 block, `.theme-icon` B6 block, `.msg-collapsible` block and `.regen-btn:active` removed; shared P5/P7 rules kept.
  - `tools/`: interaction-test + cycle-test rewired to the surviving controls (overflow/icons/rename suites replaced with removal guards); `ui-recon.py` id list updated.
- **Note**: gates intentionally NOT run (owner directive) — `npm run build:css` and gate passes deferred to owner; `dist/output.css` is stale until then.

### 2.2.7 - screenshot policy: agent-reference only
- **Date**: 2026-10-17
- **Owner directive**: screenshots/images the agent captures are for the agent's own inspection only — **no** copies into `artifacts/`, **no** commits, **no** uploads, to save time. `AGENTS.md` §6 rewritten from the old "must copy to `artifacts/`" rule to the reference-only policy (footer date bumped). `docs/audits/*.png` stay gitignored/local-only. The 10 just-copied `artifacts/2.2.6-revamp-*.png` were deleted.
- **Also this session**: `arena/01a03fe9-abot` synced for 2.2.6 — arena-named merge commit `merge main 2.2.6 into arena/01a03fe9-abot` (`4b206f3`), pushed to `origin/arena/01a03fe9-abot`. Owner standing rule recorded: arena merge for every **major** update.
- `docs/commits.md`: this entry; `📌 Next version` → `main → 2.2.8`.

### 2.2.6 - header + composer revamp (chat-app pattern)
- **Date**: 2026-10-17
- **Owner-requested**: minimal current-AI-chat revamp of header + composer + message actions per scope answers (model selector INTO the composer bottom-left; header = chat title + New chat icon + ⋯ menu; circular icon-only jump FAB; empty-state polish; sidebar untouched).
- **Changes**:
  - `index.html`: header brand mark + model pill removed; header now shows the active chat title (`#headerChatTitle`, quiet, truncate). `#modelSelectorBtn`/`#modelSelectorPanel` moved into the composer action row bottom-left (quiet pill, `w-1.5` provider dot); panel opens UPWARD (`bottom-full`, `origin-bottom-left`, `z-30`). `#jumpToLatest` is now a circular icon-only 44px FAB (aria-label carries meaning; `hidden`/`flex`/`jump-enter` contract untouched). Asset bust `?v=p19` → `?v=p20`.
  - `js/chat.js`: header title mirrors the sidebar title in every path — `renderActiveChat` (chat name / "ABot" when none), title-gen dots animation (both updated per tick).
  - `js/dom.js`: `headerChatTitle` registered.
  - `js/ui.js`: selector dot `w-2` → `w-1.5` to match the quieter pill.
  - `js/app.js`: build id `2026-09-21.4` → `2026-10-17.1`.
  - `src/input.css`: `.model-panel` `@starting-style` enter offset flipped to `translateY(6px)` (panel now rises from the pill below it).
  - `service-worker.js`: cache `abot-cache-v46` → `v47`.
  - Tests: `tools/interaction-test.js` +3 checks (selector lives in composer + out of header; header mirrors chat title; jump button icon-only); `tools/visual-check.js` +3 real-browser checks (panel opens upward — panel top escapes above the dock top; stays inside viewport; Escape closes).
  - `docs/commits.md`: this entry; `📌 Next version` → `main → 2.2.7`.
- **Wiring kept intact**: `modelSelectorBtn`/`Panel` IDs + synchronous toggle + typeahead, `chatTitle` stays in sidebar, sidebar rename flow unchanged, `headerNewChatBtn` tooltip `Alt+N`.
- **Gates (owner-approved run)**: lint 0 errors (2 pre-existing warnings), `check` clean, `build:css` rebuilt (the 7 new utilities confirmed present in `dist/output.css`), `test` all pass (security + smoke + interaction + cycle), visual 35/35 PASS (mobile 18 + desktop 17, incl. the 6 new panel checks). Logo-placement assertion updated `>=3` → `>=2` (header logo removed; `every-logo-marked` invariant kept). Screenshots archived to `artifacts/2.2.6-revamp-*.png`.

### 2.2.5 - fix short replies hidden behind composer on mobile
- **Date**: 2026-10-17
- **Changes**:
  - `index.html`: `#chatHistory` carried `h-full`, which made it exactly the container height and absorbed the container's `padding-bottom` — so padding never created scroll space and short replies overlapped the fixed composer on mobile (visual check: `lastBottom=796 > dockTop=678`). Dropped `h-full` so the element grows with content and the padding creates the scrollable zone. Real-browser proof: mobile SHORT `lastBottom=612 ≤ dockTop=678`, LONG `547 ≤ 640`; desktop unchanged.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.6`.
  - No gates skipped — lint 0 errors, check clean, test all pass, visual 27/27.
- **Owner-requested**: full verification pass (visual + interaction + cycle + smoke + security + lint + check + build:css).

### 2.2.4 - error retry, model refresh, relative timestamps
- **Date**: 2026-10-17
- **Owner-approved**: Phase 2 of the audit fix plan (all four items in one commit, per the owner's one-version-per-phase directive).
- **Changes**:
  - `js/chat.js` (FM-4): a failed interim Firestore save of the user's message `return;`-ed out of `sendMessage`, killing the send and stranding the prompt in a dead composer. It now toasts "Couldn't save to history — sending anyway." and continues — the message is already on screen and in memory, and the finally-block save re-attempts persistence with the full exchange.
  - `js/chat.js` (retry): trailing error cards now carry a "Retry" button (danger-bordered, `aria-label="Retry"`) that replays the failed prompt through `regenerateLastResponse()`. Only the LAST message gets it — regenerate pops everything above the prompt, so an older error card would silently drop later messages. Covers both error paths: `appendMessage`'s isError branch and the in-place loading-bubble morph (which bypasses appendMessage wiring, so its listener attaches inline).
  - `js/chat.js` + `js/utils.js` (timestamps): messages now store `ts: Date.now()` at creation (user prompt, streaming placeholder, final reply, stopped, both error paths). The AI-row clock renders `formatRelativeTime(ts)` — "just now" / "5 min ago" / "2 hr ago" / "3 days ago" via `Intl.RelativeTimeFormat`, then a short date; legacy messages without `ts` keep the old render-time clock.
  - `js/config.js`: registry refreshed — `google/gemini-2.5-pro` → `google/gemini-3.8-flash` and `google/gemini-2.5-flash` → `google/gemini-3.5-flash-lite` (2.5 ids retired upstream), `THINKING_MODELS` follows the 3.8 id; removed `groq/qwen/qwen3.6-27b` (deprecated), `groq/qwen/qwen3.8-27b` (duplicate of the OpenRouter :free entry), `groq/minimaxai/minimax-m2.7` (not free-tier) and `nvidia/mistralai/mistral-nemotron` (off the free roster); `kimi-k3` left as-is (unverifiable without live calls).
  - `js/chat.js`: title-gen hardcoded `google/gemini-2.5-flash` → `google/gemini-3.5-flash-lite`. `index.html` + `js/ui.js`: Think chip tooltip now names Gemini 3.8 Flash.
  - `tools/interaction-test.js`: thinking-chip case updated to the new Gemini id; new case block covers Retry presence/aria-label, Retry hidden on stale (non-trailing) error cards, and FM-4 (a failing `state.db` save still sends — toast shown, composer cleared, fresh error card re-rendered).
  - `dist/output.css` rebuilt (new retry-button utilities).
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.5`.
  - No gates run per owner gate policy. FM-4/retry have no real-browser repro — jsdom interaction coverage added instead.

### 2.2.3 - surface command palette hint
- **Date**: 2026-10-16
- **Owner-approved**: Phase 1 of the audit fix plan.
- **Changes**:
  - `index.html`: the Ctrl/Cmd+K command palette had no discovery affordance anywhere in the shell — added "Ctrl K for commands" (with `.palette-kbd` key chips) to the desktop composer hint line, matching the palette's own footer kbd language. Hidden on mobile alongside the rest of that row.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.4`.
  - No gates run per owner gate policy.

### 2.2.2 - contain overscroll in inner scroll areas
- **Date**: 2026-10-16
- **Owner-approved**: Phase 1 of the audit fix plan.
- **Changes**:
  - `src/input.css`: `#chatList`, `#modelSelectorPanel`, `#searchResults` and `#commandPaletteList` had no `overscroll-behavior`, so a scroll at their edge chained to the page and rubber-banded (and could trigger pull-to-refresh) on mobile. Added one shared `overscroll-behavior: contain` rule; `#chatHistoryContainer` and the empty-state block already had containment. `dist/output.css` rebuilt.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.3`.
  - No gates run per owner gate policy.

### 2.2.1 - csp: allow google identity styles
- **Date**: 2026-10-16
- **Owner-approved**: Phase 1 of the audit fix plan (protected file — sign-off given).
- **Changes**:
  - `vercel.json`: the Content-Security-Policy `style-src` allowed only `'self' 'unsafe-inline'`, so the Google Identity SDK stylesheet from `https://accounts.google.com` was refused — a CSP violation printed on every load. Added `https://accounts.google.com` to `style-src` (also in `connect-src`/`frame-src`/`script-src` already).
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.2`.
  - No gates run per owner gate policy.

### 2.2.0 - ellipsis consistency in placeholders
- **Date**: 2026-10-16
- **Owner-approved**: Phase 1 of the audit fix plan.
- **Changes**:
  - `index.html`: three placeholder strings used keyboard dots ("...") while the command palette already used a real ellipsis ("…") — swapped "Search chats...", "Search messages..." and the sarcastic-pirate preset so truncation reads as a single typographic glyph everywhere.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.1`.
  - No gates run per owner gate policy.

### 2.1.10 - stop button ring no longer collides with tooltip
- **Date**: 2026-10-16
- **Owner-approved**: Phase 1 of the audit fix plan (this file only).
- **Changes**:
  - `src/input.css`: the streaming stop-ring sat on `#stopBtn::after` — the very pseudo-element the generic `[data-tooltip]::after` rule owns. The tooltip's ink disc, padding and `-50%` translate bled into the ring, so it rendered as a gray blob beside the send button (caught streaming→stop, desktop light theme) and as a detached disc (mobile dark). Ring moved to `#stopBtn::before` (incl. reduced-motion override); `dist/output.css` rebuilt. Side effect: the stop button's "Stop" tooltip now renders instead of being overridden.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.2.0`.
  - No gates run per owner gate policy.

### 2.1.9 - fix guest rate-limit crash
- **Date**: 2026-10-16
- **Owner-approved**: Phase 0 of the audit fix plan (sign-off given for this protected file).
- **Changes**:
  - `lib/chat-security.js`: `checkChatLimit()` called `limiter.checkWithMax(key, max)` — a method that does not exist — so the thrown TypeError was uncaught at both call sites (`api/chat.js`, `server.js`) and every affected chat request 500'd ("Connection error" in the UI). Now calls the real `MemoryRateLimiter.check(key, max)`.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.10`.
  - No gates run per owner gate policy.

### 2.1.8 - chore: untrack local-only visual audit screenshots
- **Date**: 2026-10-16
- **Owner directive**: audit/QA screenshots must never be pushed for any project.
- **Changes**:
  - Untracked all 10 `docs/audits/visual-*.png` (`git rm --cached`); `.gitignore` now ignores `docs/audits/visual-*.png`. Files stay on disk; the markdown/txt audit docs remain tracked.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.9`.
  - No code changes; no gates run per owner gate policy.

### 2.1.7 - docs: PROJECT-INFO.md - add resume framing note to tone guide
- **Date**: 2026-10-16
- **Owner request**: make the PROJECT-INFO.md sheets resume-ready without inventing KPIs.
- **Changes**:
  - `PROJECT-INFO.md` §9: tone guide now opens with "Frame impact as user capability + the hardest engineering problem solved (no business KPIs)."
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.8`.
  - No code changes; no gates run per owner gate policy.

### 2.1.6 - docs: fix stale PROJECT-INFO.md tone guide (live URL is canonical, not TODO)
- **Date**: 2026-10-16
- **Owner request**: audit all six project `PROJECT-INFO.md` sheets for stale/inaccurate facts; fix them.
- **Changes**:
  - `PROJECT-INFO.md` §9: removed "never claim a live public URL — URL is TODO" (stale since 2.1.5 added the canonical live URL to §1 and `README.md`); the guide now only forbids claiming 36 configured models or committed screenshots.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.7`.
  - No code changes; no gates run per owner gate policy.

### 2.1.5 - docs: repo README + live demo URL + PROJECT-INFO.md resume sheet
- **Date**: 2026-10-13
- **Owner directive**: canonical live URL `https://abot-eta.vercel.app/` (matches GitHub About page); all six projects get an AI-readable `PROJECT-INFO.md` for resume/portfolio summaries.
- **Changes**:
  - New root `README.md` (drafted earlier, never committed — folded in here): pitch, live-demo URL, screenshots section (captures pending, will live in `artifacts/` per AGENTS.md §6), feature highlights, mermaid architecture diagram, security & quality-gate summary, local setup from `.env.example`, project layout, docs index.
  - New `PROJECT-INFO.md` — machine-readable facts (24 configured models across 4 providers, exact versions, architecture, metrics, ATS tags, ready-made resume bullets/paragraph/card) so future AI can summarize without reading the code; linked from `README.md`.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.6`.
  - No code changes; no gates run per owner gate policy (pre-commit syntax + lint green).

### 2.1.4 - full audit fixes: guest cap (server), zombie-chat save, client_id single-source, bust drift
- **Date**: 2026-08-30
- **Full-stack audit findings + fixes**:
  - **B-44 guest limit bypass (backend)**: client's 5/session counter was the ONLY guest cap (trivially reset). Server now enforces `GUEST_MAX_REQUESTS: 20` per 15 min via `checkChatLimit()` (guest-aware limiter wrapper) in both backends, keyed on `sign_in_provider === 'anonymous'`.
  - **B-47 zombie-chat save (data)**: deleting the ACTIVE chat during an in-flight stream left the stream running; its finally-block `update()` re-created the deleted Firestore doc with the streamed reply. Delete handler now aborts the stream for the active chat, and the save is skipped when the chat no longer exists in state.
  - **B-45 client_id drift risk**: Google OAuth client id was hardcoded in 3 sites in js/auth.js; now a single `GOOGLE_CLIENT_ID` constant.
  - **B-46 asset bust drift**: `app.js?v=p15` vs `output.css?v=p18`; all busted to p19 in one pass, SW bumped.
  - Gates: security/smoke/interactions/cycle/check all green; ESLint 0 errors. SW v46.

### 2.1.3 - fix mobile UX: frozen screen during streams, 4th/5th+ replies behind composer, keyboard never dismissed
- **Date**: 2026-09-21
- **Owner report**: "when a model loads to respond the whole screen freezes instead of only model selector, causing can't scroll"; "long response or 4th/5th response goes behind the composer and can't be scrolled"; "after sending, the mobile keyboard stays up → mistypes → accidental second message".
- **Changes**:
  - **B-47 (screen freeze during streams)**: the SSE chunk handler re-parsed the ENTIRE accumulated reply (`renderSafeMarkdown(fullReply)` → `innerHTML`) + `maybeCollapse` + follow on **every chunk** — per-token full-markdown work saturated the phone's UI thread, freezing the whole app mid-stream. Now every chunk only accumulates text (cheap); the DOM flush runs **at most every ~100 ms**; the first chunk paints instantly; the final render after the loop covers the tail; a `streamDone` flag kills any pending flush on error/abort so it can never overwrite an error card.
  - **B-48 (keyboard never dismissed)**: `sendMessage` unconditionally refocused the input after send. Desktop (≥768 px) still refocuses for fast typing; **mobile now blurs the input after send**, dismissing the keyboard — the `--kb-h` shrink + visualViewport-resize listener re-settle the padding/dock.
  - **B-49**: the 4th/5th+-message coverage failure was the compounding of B-47 (frozen → unscrollable) + B-48 (keyboard squishing the viewport) on top of the correct B-36/B-41/B-42/B-43 machinery.
  - **Guards:** cycle-test gains "mobile send blurs the input" + "desktop send refocuses"; visual-check asserts `activeElement` after send on both viewports. SW cache v45, build id `2026-09-21.4`.

### 2.1.2 - docs: "bug and fixes summary" kit — the Bug & Fix Registry protocol, shareable
- **Date**: 2026-09-21
- **Owner request**: package the `BUGS-AND-FIXES.md` convention (bug → file + line region → fix → version/commit, plus re-verification) as a reference description to send to other projects.
- **Changes**:
  - New folder `bug and fixes summary/` with three files:
    - `README.md` — what the kit is and how to use it (2 steps).
    - `BUG-FIX-PROTOCOL.md` — the reference description: entry format (ID / symptom + root cause / files + approx fix lines / fix mechanism / version + commit), maintenance rules (append-only, regressions are new entries, tests name their B-id), the mandatory re-verification policy, and why it works.
    - `BUGS-AND-FIXES.template.md` — copy-paste starter for any repo (rename to `BUGS-AND-FIXES.md`), with filled example entries (incl. a REGRESSION example mirroring the real B-43 stale-CSS case) and a checklist skeleton.
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.3`.
  - No code changes.

### 2.1.1 - docs: agents may NEVER verify on their own; ask the owner after every update
- **Date**: 2026-09-21
- **Owner directive**: when the owner asks to fix/change files or code, the agent does **only that**.
  Agents may use commands **only** to write/read/copy/check/move files and code (incl. `git add`/`commit`/`push`).
  They must **never** run gates, lints, checks, tests, builds, browser suites, or any verification on their own —
  only the owner may say "run / verify / test / pass". After every meaningful update the agent must **ask**
  whether to run the gates/tests — in plain words, once — and wait for the answer.
- **Changes**:
  - `AGENTS.md` §3 rewritten: gates are **owner-triggered ONLY** (not even for large updates); item 2 is the mandatory ask-reminder with the exact wording to use.
  - `AGENTS.md` §5: new rule **0 — Commands: write-only, NO self-initiated runs** (file ops + commit/push only; no `git log`/`diff`/`ls-remote` fishing either).
  - `docs/commits.md`: `📌 Next version` advanced to `main → 2.1.2`.
  - No code changes.

### 2.1.0 - ROLL-OVER: enforce the version rule (.10 → next minor), fix branch-numbering discipline
- **Date**: 2026-09-21
- **Owner correction**: (1) the version rule was being violated — commits went past `2.0.10` (as `2.0.11` … `2.0.31`) instead of **rolling over to `2.1.0`**; (2) `main`'s commits were carrying **arena-style numbers/copies** because arena was synced by fast-forwarding main's ref, which put main's commit names on arena.
- **Changes**:
  - `docs/commits.md` header: roll-over rule stated explicitly (the third number never exceeds `.10`; `2.0.10` → `2.1.0`, `2.1.10` → `2.2.0`, `2.2.10` → `2.3.0`), plus a **`📌 Next version`** line agents must keep current, plus a history note recording the `2.0.11`–`2.0.31` drift.
  - `AGENTS.md` §1: roll-over enforced; **branch independence (strict)** — `main` and `arena` each keep their own version numbers and commit names, compare by hash never by number; and arena syncs are now **arena-named merge commits** (`git merge --no-ff main -m "merge main <version> into arena/01a03fe9-abot"`) — **never** a fast-forward of main's ref into arena.
  - This commit is the first under the corrected rule: the `2.0.x` line is closed at `2.0.31`; numbering continues at **`2.1.0`**.
  - No code changes.

### 2.0.31 - docs: gate policy — full gates only for large updates or on explicit owner request
- **Date**: 2026-09-21
- **Changes**:
  - `AGENTS.md` §3 rewritten per owner directive: agents must **not** run the full gate suite automatically. Gates run only for **large updates** (multi-file features; anything touching `api/`, `server.js`, `lib/`, security, routing, catalog overhauls) or when the **owner explicitly asks**. After every meaningful update the agent must **ask the owner whether to run the gates** before pushing.
  - Small/doc changes ship without the full suite; the pre-commit hook still runs `check` + `lint` on every commit (kept intact).
  - No code changes.

### 2.0.30 - fix NVIDIA models erroring: ids were routed to OpenRouter/Gemini (no nvidia/ prefix)
- **Date**: 2026-09-21
- **Changes**:
  - **B-46**: choosing NVIDIA's GLM 5.3 / GLM 5.3 Flash / GPT-OSS 20B (and 4 more) returned "AI provider returned an error". Root cause: the v2.0.25 owner-extracted catalog stored NVIDIA's ids **bare** (`z-ai/glm-5.3`, `openai/gpt-oss-20b`, …). Backend routing only maps `:free`→OpenRouter, `google/`→Gemini, `groq/`→Groq, `nvidia/`→NVIDIA — everything else falls through to OpenRouter, so 7 of 9 NVIDIA models were sent to OpenRouter (404) and `google/gemma-4-31b-it` matched the **Gemini** rule. The selector also grouped them under "OpenRouter · …"/Gemini headings (exactly what the owner saw) and the web-search chip was wrongly enabled.
  - **Fix:** all 9 NVIDIA ids re-keyed under the `nvidia/` routing prefix (`nvidia/z-ai/glm-5.3`, `nvidia/openai/gpt-oss-20b`, …) — mirroring the existing Groq pattern (`groq/openai/gpt-oss-120b`). Backends strip only the first segment, so NVIDIA still receives the bare NIM id (`z-ai/glm-5.3`) — **no backend change**. Selector now groups all of them under one NVIDIA heading; capability chips correct.
  - **Guards:** smoke test now asserts every `MODEL_CONFIG` key routes unambiguously (a bare publisher id fails the suite); 8 new security-validator asserts for the wrapped ids; `renderActiveChat` migrates a saved chat whose model id no longer exists (self-heals stale selections instead of erroring forever).
  - SW cache v44, build id `2026-09-21.3`.

### 2.0.29 - add "PASTE- sandbox browser" kit (self-contained browser-ability paste for online agents)
- **Date**: 2026-09-21
- **Changes**:
  - New folder `PASTE- sandbox browser/` holding everything an online-only AI agent needs to gain real-browser ability in a CDN-blocked sandbox (owner request — files extracted from the repo, not rewritten): `SANDBOX-BROWSER-VISUAL-TESTS.md` (the full setup guide, verbatim copy of `docs/`), `visual-check.js` (verbatim copy of the working `tools/` reference implementation), `package-scripts-snippet.json` (the `visual` / `visual:local` npm scripts to merge), and a `README.md` mapping the files + quick start + production lessons (offline determinism / request interception, browser resolution order, geometric assertions).
  - `eslint.config.js`: the kit folder is excluded from lint (it contains a verbatim tool copy — the live `tools/visual-check.js` remains the gated source of truth).
  - No app code changes.

### 2.0.28 - docs: branch-version independence note (commit names/versions are per-branch)
- **Date**: 2026-09-21
- **Changes**:
  - Added an explicit note (here at the top of this file + `AGENTS.md` §1) that `main` and `arena/01a03fe9-abot` use **separate, independent version numbers and commit names** — the same version on both branches is NOT the same work (e.g. main's `2.0.10` ≠ arena's `2.0.10`; branches converged at `2.0.27`). Compare commits by hash, not by version.
  - No code changes (docs only).

### 2.0.27 - verification pass: un-break the CSS/asset gates (fix was inert), make lint green, make the visual suite portable
- **Date**: 2026-09-21
- **Changes**:
  - **B-43 (the big one): v2.0.26 shipped stale CSS.** `src/input.css` got `#chatHistoryContainer{overflow-anchor:none}` + `#composerDock{bottom:var(--kb-h,0px)}`, but `dist/output.css` was never rebuilt in that commit, so the CSS half of the B-41/B-42 scroll fix never reached clients — production still had Chrome's scroll anchoring fighting the auto-follow and a dock that never lifted for the keyboard. Found by running the §3 gate: `npm run build:css` produced a bundle that did not match the committed one. Fixed by committing the rebuild. Cache drift fixed too: `index.html` CSS `?v=p17`→`p18` (SW precache held `p16`), `js/app.js` `?v=p14`→`p15` (stale across several releases), SW cache `v42`→`v43`; build id → `2026-09-21.2`.
  - **Regression guard:** `tools/visual-check.js` now asserts in a real browser that `overflow-anchor` computes to `none` on the chat container and that the dock's `bottom` comes from CSS (`var(--kb-h)`) — a stale/again-stale CSS bundle now fails the suite instead of shipping silently.
  - **B-44: lint gate was red (25 errors).** Browser globals (`document`/`window`/`getComputedStyle`) inside the puppeteer `page.evaluate()` callbacks of `tools/visual-check.js` and `tools/interaction-test.js` were flagged because `tools/**` gets Node globals only. Added a dedicated `eslint.config.js` override (node + browser) with an explanatory comment; dropped the unused `sanitizeHtml` import (`js/chat.js`) and unused `$`/`dockR`/`opts` (`tools/visual-check.js`). Lint: **0 errors**.
  - **B-45: the visual suite only ran in the Linux sandbox.** `puppeteer-core`/`@sparticuz/chromium` were ad hoc installs (not in `package.json`), the npm script used a bash-style env prefix, and determinism depended on the sandbox having no internet — on a networked machine the real Firebase SDK loads from gstatic and overwrites the mocked `window.firebase`, so the fake login never happens. `tools/visual-check.js` now resolves a browser cross-platform (`ABOT_CHROME` → installed Chrome/Edge/macOS → sparticuz when present) and blocks all non-localhost requests so the mock always wins; `package.json` gained the `puppeteer-core` devDependency and a `visual:local` script.
  - **Verified:** `lint` 0 errors · `check` all files parse · `test` (security + smoke + interactions + auth cycle) all pass · `build:css` → `git diff --exit-code -- dist/output.css` clean · real-browser `visual:local` **27/27 PASS** (mobile + desktop), including mid-stream/post-stream follow distance `0px` and last-line-above-composer assertions.

### 2.0.26 - REAL fix for persistent scroll/coverage bugs (scroll-anchoring + keyboard dock)
- **Date**: 2026-08-30
- **Changes**:
  - **B-41 (long replies: "auto scrolls to half, rest hidden")**: root cause = Chrome scroll anchoring + distance-math autoFollow. During streaming innerHTML updates Chrome shifts scrollTop; one transient scroll event with distance >120 flipped `__abotAutoFollow=false` and every later follow was silently skipped. autoFollow is now user-intent driven (wheel-up/upward touchmove mutes; near-bottom re-arms), follow is instant + settled (rAF + 250ms, forced scrollBehavior:auto), and `overflow-anchor:none` on the container stops Chrome fighting. Real-browser proof: mid-stream AND post-stream distance = 0px.
  - **B-42 (short replies hidden behind composer)**: padding now = max(dockRect.height + --kb-h, 170) measured with getBoundingClientRect; re-syncs on visualViewport resize (keyboard open/close), window resize, fonts.ready, load; `#composerDock` now lifts with the keyboard (`bottom: var(--kb-h)` — previously only the jump pill did); send-flow re-syncs 320ms after focus. Real-browser proof: SHORT reply lastBottom 675 ≤ dockTop 678; LONG reply lastBottom 501 ≤ 678.
  - visual-check.js extended with the owner's two exact scenarios: long streamed reply (mocked multi-chunk SSE, mid-stream + post-stream assertions) and short reply (visibility assertion), both viewports → 23/23 PASS.
  - jsdom harnesses gained requestAnimationFrame (follow-on-render paths). SW v42, CSS bust p17.

### 2.0.25 - NVIDIA catalog v2 (owner-extracted Free Endpoint IDs)
- **Date**: 2026-08-30
- **Changes**:
  - Owner extracted 9 model IDs directly from build.nvidia.com Free Endpoint cards; catalog replaced with that set (supersedes my 2.0.24 search-derived roster):
    meta/muse-glimmer-30b · nvidia/nemotron-3.5-lightning-30b-a3b · moonshotai/kimi-k3 · z-ai/glm-5.3-flash · z-ai/glm-5.3 · openai/gpt-oss-20b · mistralai/mistral-nemotron · google/gemma-4-31b-it · nvidia/nemotron-3-super-120b-a12b
  - New org prefixes allowlisted: `meta/`, `moonshotai/` (NVIDIA-hosted publishers).
  - NVIDIA leg re-verified end-to-end with the mock harness. 4 new security tests. SW bump.

### 2.0.24 - NVIDIA catalog refresh (free tier confirmed alive; 4 of 5 old IDs stale)
- **Date**: 2026-08-30
- **Changes**:
  - Confirmed via build.nvidia.com + cross-sources: NVIDIA NIM free API still exists (one nvapi- key, ~40 RPM, no credit card).
  - REMOVED: `nvidia/deepseek-ai/deepseek-r1-0528` (delisted), `nvidia/qwen/qwen2.5-coder-32b-instruct` (2024-era), `nvidia/nvidia/nvidia-nemotron-nano-9b-v2` (superseded).
  - KEPT: `nvidia/openai/gpt-oss-20b`, `nvidia/mistralai/mistral-nemotron`. ADDED: `nvidia/nvidia/nemotron-3-ultra-550b-a55b` (1M ctx), `nvidia/nvidia/nemotron-3-super-120b-a12b`, `nvidia/nvidia/nemotron-nano-3-30b-a3b`, `nvidia/minimaxai/minimax-m3`.
  - NVIDIA proxy leg verified end-to-end with a mock harness (tmp/nvtest): URL, our `nvidia/` prefix stripped before sending upstream, Bearer header, streaming proxied + [DONE].
  - NOTE for owner: on-device NVIDIA failures were most likely these dead IDs (404s now shown specifically) and/or NVIDIA_API_KEY missing on Vercel (config_missing card names it). SW bump.

### 2.0.23 - catalog reconciled to owner's authoritative OpenRouter free list
- **Date**: 2026-08-30
- **Changes**:
  - Owner supplied the definitive working free-model list; catalog now matches it exactly (8 entries):
    - KEPT: nemotron-3-ultra, laguna-s-2.1, nemotron-3.5-lightning, qwen3.8-27b, glm-5.2, gemma-4-31b-it
    - ADDED: `google/gemma-4-26b-a4b-it:free` (MoE Gemma variant), **`openrouter/free`** (the auto-router — routes to the best available free model; `openrouter/` org added to ALLOWED_PROVIDERS)
    - REMOVED (superseded by owner's list): gpt-oss-120b/20b:free, qwen3-coder:free, glm-4.5-air:free, inkling:free, ling-3.0-flash-vl:free
  - Security tests updated for the new IDs + auto-router. Typeahead test updated ('g' — 'l' leading names left the catalog). SW bump.

### 2.0.22 - REAL-browser visual verification in the sandbox (15/15 PASS)
- **Date**: 2026-08-30
- **Changes**:
  - **Tooling breakthrough (B-37)**: `@sparticuz/chromium` ships a Chromium binary inside the npm package (no CDN download — the thing that blocked Playwright). With `puppeteer-core` + the package's bundled system libs (extracted to /tmp/al2023-libs), the sandbox now runs a REAL browser.
  - `tools/visual-check.js` (`npm run visual`): boots the real site at mobile (375×812, touch) + desktop (1280×800), mocks Firebase auth to enter the app, then pixel-measures the composer: mic absence, stop-overlays-send EXACTLY (same x/y/size), send flush right, scroll padding >= dock height, duplicate ids, error-card visibility after a real send, stop re-hidden after stream. Screenshots to docs/audits/visual-*.png.
  - **First real-browser run: 15/15 PASS** — B-33/B-35/B-36 confirmed fixed pixel-exactly (send & stop both at (312,753) on mobile).
  - Client-side guard for non-OK /api/chat JSON responses verified present.

### 2.0.21 - cache-proof stop overlay + scroll-lock release + padding clamp (persistent regressions)
- **Date**: 2026-08-30
- **Changes**:
  - **B-35**: stop button now has inline critical styles (position:absolute;inset:0;danger bg) — the send/stop overlay cannot break on stale/purged CSS. Wrapper inline relative. Build id 2026-09-21.1 so stale clients are identifiable.
  - **B-36**: mobile scroll clamp raised (max(dock+40px,170px)); `__abotUnlockScroll()` releases stray body scroll locks (only when no dialog open) in sendMessage finally; padding re-sync + follow-bottom after every stream. Fixes "last reply stuck behind composer + can't scroll until refresh".
  - Playwright: attempted again — browser binary download is network-blocked in this sandbox (TLS to cdn.playwright.dev dies). Real-browser verification stays an owner-side step; documented honestly.
  - Registry: B-35, B-36 added as NEW entries (per owner instruction — persistent regressions get new entries, not edits to old ones). SW bump, CSS bust p16.

### 2.0.20 - composer fixes (mic removed, send flush right, stop=danger), in-place error morph, OpenRouter 404 reason surfaced
- **Date**: 2026-08-30
- **Changes**:
  - **Composer (owner report)**: mic button + all its wiring removed; send button flush right (justify-between slack gone); stop now overlays the send slot in `bg-danger` (was `bg-ink`, which flips with theme = invisible white-on-white/black-on-black).
  - **Error morph (owner clarification)**: the loading bubble BECOMES the error card in place — never a second bubble appearing beside the placeholder.
  - **OpenRouter 404 systemic (owner report: every :free model)**: upstream error body surfaced in the card ("OpenRouter (404): <reason>…"). Most likely cause: the new key was created with Model Limits enabled (openrouter.ai/keys) — a restricted key 404s every non-allowed model. Check key settings; also verify at openrouter.ai keys page.
  - Registry B-32/B-33/B-34. SW v37. All gates green.

### 2.0.19 - stuck-dots fix on stream errors + remove non-servable Llama free
- **Date**: 2026-08-30
- **Changes**:
  - **Stuck dots bubble (owner screenshot)**: on stream error the typing placeholder was left in the DOM next to the persisted error card — the "two responses" look. Placeholder container is now removed before the error card is appended (SSE-error branch + network catch).
  - **`llama-3.3-70b-instruct:free` removed**: model page exists and says Free, but API 404s — no provider currently serving the free variant. Comment left in catalog for restoration. Note: the 401→404 status change simultaneously CONFIRMED the owner's new `OPENROUTER_API_KEY` works.
  - Clarified (B-31): the two GPT-oss replies in the screenshot were two separate sends — correct behavior.
  - Registry: B-29, B-30, B-31 added to BUGS-AND-FIXES.md. SW bump. All gates green.

### 2.0.18 - follow-on-render, GIS on-demand rebuild, BUGS-AND-FIXES registry
- **Date**: 2026-08-30
- **Changes**:
  - **Composer overlap, part 2 (owner report: 3rd/4th reply still covered)**: re-renders (chat/model switch, reaction toggles) previously landed the viewport wherever the old scroll was. `renderActiveChat()` now follows the bottom in follow mode (rAF-guarded for jsdom).
  - **GIS robustness**: the Google button rebuilds the OAuth token client on demand if it was lost after sign-out, with a visible "still loading" fallback message instead of a silent no-op.
  - **401 message sharpened** for OpenRouter models: explicitly names `OPENROUTER_API_KEY` + the Vercel env path (owner's Gemma 4 31B screenshot = key missing/rejected on OpenRouter; Groq-direct + Gemini keys work).
  - **BUGS-AND-FIXES.md** created at repo root: 28 arena entries (bug, file+approx fix lines, fix, version+commit ref), mandatory re-verification checklist for every update, catalog freshness schedule, and a dedicated §Main Repo section for the main branch's own history.

### 2.0.17 - ROOT CAUSE FIXED: providerStatusError missing from the shared lib
- **Date**: 2026-08-30
- **Owner's Vercel log export named it**: `TypeError: providerStatusError is not a function` at api/chat.js:126, on EVERY provider error.
- **What happened**: v2.0.13 added `providerStatusError()` to lib/chat-security.js and made both backends call it — but a sandbox reset reverted the LIB while the callers kept the new code. Since then, any model hitting ANY provider error branch crashed the error-handler itself → generic "(groq/TypeError)". GPT-OSS-120b worked only because it never enters an error branch (200 OK).
- **Fix**: providerStatusError + code-aware sseError restored in the lib and exported.
- **Never again**: tests/chat-security.test.js now asserts the FULL export surface the backends destructure (10 names) AND invokes providerStatusError with a fake res (404 → model_unavailable envelope with machine code; ended stream → no write). Any future lib drift fails CI locally before push.
- **What this explains**: every "(groq/TypeError)" was a REAL provider error (rotated models, 429s, etc.) being masked by the crash. With the fix, models will surface their true status — some may just work, others will show "rotated/limit" precisely.

### 2.0.16 - fix error-cards-render-as-typing-dots + guard null-body stream crashes
- **Date**: 2026-08-30
- **Changes**:
  - **Owner screenshots cracked it**: the "two identical loading responses" were (1) the real placeholder AND (2) the persisted ERROR message rendering as a TYPING INDICATOR — v2.0.13's persisted errors passed `isHistory=false` into appendMessage, which routes non-history assistant messages to the streaming-placeholder branch. Fixed: `message.isError` checked FIRST in appendMessage; danger text card renders in every path.
  - **Server TypeError localized**: server.js `response.body.getReader()` (and api/chat.js `for await (response.body)`) throw TypeError on null body -> "(groq/TypeError)". All proxy loops in both backends guarded: null body -> "model rotating" message; mid-stream drop -> "stream interrupted (<class>)". Catch logs model id. SW bump.

### 2.0.15 - double-send guard, composer overlap fixes, error discriminators
- **Date**: 2026-08-30
- **Changes**:
  - **Double responses (owner report)**: `sendMessage` had no in-flight guard and set `isStreaming` only after a Firestore await — Enter + send-tap (or double-tap) in that window launched two streams for one prompt. Guard is now first line; `isStreaming` set before any await. Regression check added to cycle-test (3 rapid clicks → exactly 1 user message).
  - **Reply hidden behind composer (mobile)**: the dock is fixed with dynamic height (keyboard offset `--kb-h`, growing textarea) while the scroll container had static padding. A ResizeObserver now syncs the container's bottom padding to the dock's real height; during streaming the view auto-follows new content ONLY while the user is already at the bottom (scroll up = follow pauses; A1 viewport-ownership preserved).
  - **Generic errors now discriminate**: the `server_error` catch includes the provider leg + error class, e.g. "(groq/TypeError)" — safe (no raw upstream text) but points debugging at the right leg. Full detail still in deployment function logs (`logProviderError`).
  - Diagnostics note for the "all :free + most Groq fail" report: generic branch = a thrown exception, not a provider HTTP status (those now produce specific messages). Check Vercel → Deployment → Functions logs for `[chat] stream error: <Cause> leg: <provider>` + `logProviderError` lines.

### 2.0.14 - Groq catalog refresh (5 of 6 models were dead)
- **Date**: 2026-08-30
- **Changes**:
  - Owner report: only `groq/openai/gpt-oss-120b` worked; every other Groq model failed. Confirmed against console.groq.com/docs/deprecations:
    - `llama-3.1-8b-instant` + `llama-3.3-70b-versatile`: shutdown **08/16/26** (two weeks ago).
    - `meta-llama/llama-4-scout…` + `qwen/qwen3-32b`: shutdown 07/17/26. `moonshotai/kimi-k2-instruct`: deprecated Oct 2025. `deepseek-r1-distill-llama-70b`: deprecated.
    - `llama-4-maverick` removed too (absent from Groq's current model docs; uncertain = error message now says rotated).
  - New Groq lineup (per console.groq.com/docs/models): kept `openai/gpt-oss-120b`; added `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`, `qwen/qwen3.8-27b`, `minimaxai/minimax-m2.7`.
  - `minimaxai/` added to ALLOWED_PROVIDERS; 2 new security-test cases (nested-org + minimaxai via Groq). SW bump.
  - Note: Groq rotates fast (4 deprecation waves in 12 months) — re-check console.groq.com/docs/models monthly alongside the OpenRouter quarterly check.

### 2.0.13 - actionable stream errors + fix vanishing error message
- **Date**: 2026-08-30
- **Changes**:
  - **Vanish fix (owner-reported)**: stream errors were rendered DOM-only inside the bot message span; the `finally` block's title-generation (Gemini — a working provider) renamed the chat and re-rendered it ~2s later, wiping the error. Errors are now persisted as real assistant messages (`isError: true`), rendered as danger cards (`role=alert`), and survive re-renders + sync. Title generation is skipped after a failed stream.
  - **Actionable errors**: `sseError()` gained a machine `code`; backend maps upstream status → specific messages: 401/403 auth_failed, 404 model_unavailable ("free catalogs rotate"), 429 rate_limited, missing env var → config_missing naming the exact variable. No secrets leaked.
  - Applied to both backends via shared `providerStatusError()`. Frontend logs `[ABot] stream error: <code>`.
  - Root-cause note for "all :free fail except Groq GPT-OSS": Groq routes direct; :free routes through OpenRouter — top suspect is missing/expired OPENROUTER_API_KEY on Vercel (config_missing now says so) or free-tier 429s.

### 2.0.12 - add Qwen3.8 27B + GLM 5.2 (free variants, owner-requested)
- **Date**: 2026-08-30
- **Changes**:
  - Verified each on OpenRouter model pages (not just search results):
    - **`qwen/qwen3.8-27b:free`** — 262K ctx, dense vision-language, coding + flexible thinking. ADDED.
    - **`z-ai/glm-5.2:free`** — exists as a free variant but with only **33K context** (the 1M-ctx GLM 5.2 is paid $0.55/$1.74). ADDED with a context caveat comment.
    - `google/gemma-4-31b-it:free` — owner asked about "Gemma 4 27B"; the actual free model is 31B and already in the catalog (verified: Price Free, hosted by Google AI Studio).
    - `z-ai/glm-4.5-air:free` — verified still free/alive ("Price: Free", 131K ctx).
  - Fixed a self-introduced typo where the ling-3.0-flash-vl entry lost its `:free` suffix during editing (caught by post-edit grep before push).
  - Final OpenRouter :free count: 13. SW bumped.

### 2.0.11 - live-site OpenRouter :free refresh (openrouter.ai/models)
- **Date**: 2026-08-30
- **Changes**:
  - Pulled the live free catalog from openrouter.ai/models?q=free+ (supersedes the search-based 2.0.10 list):
    - REPLACED: `poolside/laguna-m.1:free` → **`poolside/laguna-s-2.1:free`** (current Poolside flagship, Jul 21 2026, 262K ctx).
    - ADDED: **`thinkingmachines/inkling:free`** (975B MoE, 1.05M ctx, multimodal), **`nvidia/nemotron-3.5-lightning:free`** (30B/3B MoE, 1M ctx, high-throughput), **`inclusionai/ling-3.0-flash-vl:free`** (124B/5.5B MoE, 262K ctx, vision + general).
    - SKIPPED deliberately: `dots-studio/dots-3-note-preview:free` (site marks it "Going away September 30, 2026"), `ling-3.0-flash-fin/sante` (finance/medical vertical niches), `nemotron-3-super` (redundant with Ultra + Lightning), `nex-n2.5-pro` (overlaps Qwen3-Coder's coding niche).
  - New org prefixes allowed server-side: `inclusionai/`, `thinkingmachines/` (both route to OpenRouter via the `:free` rule from 2.0.10).
  - Restored the `:free` security-test cases (lost in test rewrites) + 4 new live-site ID cases. All gates green. SW bumped.

### 2.0.10 - refresh OpenRouter :free catalog + fix :free routing/validation
- **Date**: 2026-08-30
- **Changes**:
  - Catalog refresh (vs openrouter.ai current roster, cross-checked across June/July 2026 sources):
    - REMOVED (deprecated): `deepseek/deepseek-chat-v3-0324:free` (upstream provider paywalled it — confirmed dead), `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` (delisted).
    - KEPT: `qwen/qwen3-coder:free`, `z-ai/glm-4.5-air:free`.
    - ADDED: `openai/gpt-oss-120b:free`, `openai/gpt-oss-20b:free`, `meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-ultra-550b-a55b:free` (1M ctx), `poolside/laguna-m.1:free`.
  - PRODUCTION BUG FIX: `MODEL_PATTERN`/`MODEL_SEGMENT_PATTERN` rejected `:` — every `:free` model 400-errored on send (the whole OpenRouter free tier was broken through the hardened backend). Patterns now allow `:` while still blocking traversal/metachars.
  - ROUTING FIX: `:free` models now ALWAYS route to OpenRouter before org-prefix checks — `openai/…:free`, `google/…:free`, `nvidia/…:free` would otherwise misroute to the Gemini/NVIDIA direct providers. Applied to both `api/chat.js` and `server.js`.
  - Web-search chip disabled for `:free` models (`:online` cannot stack on `:free`).
  - `getProviderColor`: `:free` suffix → OpenRouter yellow regardless of org prefix; new orgs added to PROVIDER_COLORS + ALLOWED_PROVIDERS.
  - Security tests: 6 new cases (colon acceptance, traversal/semicolon/unknown-org rejection with `:free`). SW bumped.

### 2.0.9 - modal hardening, Sonner-style toast stack, input states, menu typeahead
- **Date**: 2026-08-30
- **Changes**:
  - **Toasts (roadmap #4 complete)**: single toast replaced by a stacking container (max 3, oldest drops). New `toast.promise(p, {loading, success, error})` API with spinner state + auto-swap; per-toast swipe-to-dismiss (touch/pen) and close button; entrance via `@starting-style`, exit via `.toast-out`; messages set via `textContent` (no injection). `showToast()` API unchanged for all callers.
  - **Modal hardening (roadmap #6)**: generic focus trap on delete/guest-limit/prompt dialogs cycling ALL focusables — replacing the hardcoded two-button delete-only trap, whose planned `offsetParent` visibility check was caught (by the new interaction test) to be broken inside `position:fixed` dialogs; replaced with `.hidden`-ancestor filtering. Escape now closes the topmost dialog. `role="dialog" aria-modal="true"` + labelled-by on all three modals. Scroll-lock (existing observer) unchanged.
  - **Input states (roadmap #3)**: auth errors mark the visible form's inputs `.input-error` (danger border + focus ring); typing clears; `.input-success` token added for future flows.
  - **Model panel typeahead (roadmap #5)**: typing letters in the open panel jumps focus to the first model whose name matches the 600ms rolling buffer.
  - Tests: interaction suite gained stacking/close/promise, focus-trap wrap, Escape-close, and typeahead cases — all green. SW v18, CSS bust v=p15.

### 2.0.8 - fix duplicate shell wiring after re-login; GIS auto-select signout fix; auth teardown hardening
- **Date**: 2026-08-30
- **Changes**:
  - `initApp()` is now idempotent (`window.__abotShellWired` guard). Root cause of "collapse menu stops working after sign-in": sign-out clears `isAppInitialized`, so the next sign-in re-ran `initApp()` and re-added every click listener — two logins made the sidebar/theme toggles fire twice per click and cancel out. Reproduced with the new `tools/cycle-test.js` (login → signout → re-login → assert single-fire), now part of `npm run test`.
  - `signOutUser()` calls `google.accounts.id.disableAutoSelect()` — GIS kept the previous account auto-selected, so the Google button silently no-oped after sign-out until refresh.
  - The logged-out branch of `onAuthStateChanged` is wrapped in try/catch with a belt-and-braces forced auth-screen reveal + toast, so a single teardown failure can never leave the auth screen non-interactive.
  - Interaction-test: fixed v2.0.7 overflow-menu sequencing (row-pick closes the menu; assert re-open via trigger) and cycle-test sidebar assertion (class-set semantics, not string order).

---

## Main-branch history (merged 2026-08-30 — versions below are main's own numbering)

### 2.0.10 - live-site verification round: empty-state card order + dotmark radius fixes
- **Date**: 2026-09-20
- **Method:** owner approved running the site + full gates. Ran local `server.js`, the jsdom interaction suite, the Playwright real-browser suite (desktop 1280×800 + mobile 390×844), and DOM-order/geometry probes with screenshots.
- **Bug fixed — empty-state order (owner-visible):** `#emptySuggestions` was a sibling AFTER the fixed `#composerDock`, so on a fresh chat the 4 suggestion cards rendered in normal flow above the (fixed, centred) composer — clipped against the header. Moved the div INSIDE the dock under the composer so greeting + composer + cards centre as ONE unit; verified desktop + mobile (cards_top 456 >= composer_bottom 368; correct DOM order). (index.html)
- **Bug fixed:** `body.chat-empty #composerDock` now gets `max-height: 100dvh; overflow-y: auto; overscroll-behavior: contain` so the taller one-unit block scrolls instead of clipping on short viewports. (src/input.css)
- **Bug fixed:** all 55 dot-matrix wordmark circles were missing `r="2.3"` (default r=0 → zero-size, invisible dots — the loader showed only the spinner). Radius restored via regex pass; verified dots now paint 5×5 px with `dotRise` animation applied. (index.html)
- **Tests updated to real behavior:** overflow menu row-click closes the menu (asserted), trigger-toggle and outside-tap close paths added; "normal layout" assertion now seeds a message explicitly (new chats start empty since 2.0.9). (tools/interaction-test.js)
- **Tooling:** `tools/test-playwright.py` artifact dir is now repo-relative (`tmp/playwright/`, overridable via `ABOT_ARTIFACT_DIR`) instead of a hardcoded Antigravity path; self-creates the directory.
- **Noted (no code change):** local `server.js` `generalLimiter` is 100 req/15 min per IP — repeated full-page loads (Playwright SW cold loads) trip 429 with no friendly UI. Production is unaffected (Vercel). Owner may want a dev-mode relax later.
- **Gates run (green):** interaction suite (2 stale assertions updated to match intended behavior), smoke, chat-security, `lint` 0 errors, `check` clean, `tsc -p jsconfig.json` 0 errors, `build:css` rebuilt and verified (`100dvh`, `mt-5`, `.dotmark` present), Playwright auth/shell/theme/backend-policy suite all PASS with no page errors.


### 2.0.9 - new-chat landing fix, dotted loader, header + micro-interaction polish
- **Date**: 2026-09-20
- **Bug fixed (owner-reported):** the new-chat landing (centred composer + greeting + suggestion cards) never appeared. Root cause: `createNewChat()` seeded every new chat with a fake assistant message (`"Hello! How can I assist you today?"`), so `messages.length > 0` and `renderActiveChat()` always took the "has messages" branch — `renderEmptyState()` was unreachable. New chats now start with `messages: []`, so the Phase-0 landing renders on PC and mobile. (js/chat.js)
- **Phase 1 — Nothing-style dotted loader:** replaced the bare spinner with a self-generated dot-matrix "ABot" wordmark. Each dot rises bottom-left → top per letter, and letters sweep A → b → o → t via per-dot `animation-delay` baked into the SVG. Zero font download/FOUC. New reproducible generator `tools/make-dotmark.js`; loader shows the wordmark above the existing spinner. (index.html, src/input.css, tools/make-dotmark.js)
- **Phase 3 — header polish:** overflow menu rows sat on the same surface as the menu (invisible hover/active in dark mode). Menu now uses a raised/card surface with real hover, press and focus-visible states. Added full keyboard access: ArrowDown/Up cycle rows, ArrowDown on the trigger opens, Esc closes and returns focus; `aria-expanded` kept in sync. (src/input.css, js/app.js)
- **Phase 5 — micro-interactions:** pointer-only press feedback (`scale(.94)` trigger, `.985` rows) with token-based 140ms `--ease-out`, plus consistent coral `focus-visible` rings across header and search controls. (src/input.css)
- **Phase 7 — mobile ergonomics:** ≥40px tap targets on header buttons and 44px on menu rows/close button on touch devices only, plus momentum scrolling in the thread. (src/input.css)
- **Cache-busting:** `dist/output.css` + `js/app.js` bumped to `?v=p16`, service worker `CACHE_NAME` → `abot-cache-v29` and precache CSS → `?v=p16`, so Vercel cannot serve the stale precached bundles again.
- **Note:** quality gates intentionally skipped per owner instruction (`--no-verify`). Hard phases (chat-screen depth, interactive auth backdrop, feature layer) deferred pending owner go-ahead.


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
