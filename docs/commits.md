# ABot Commit Log

This document tracks every commit made on `main` following the `2.0.x` versioning schema:
- Sequence: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ `2.1.0`, `2.1.1`, ..., `2.1.10` ➔ `2.2.0`, etc.
- Format: `<version> - <short sentence>`

---

## Commit History

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
