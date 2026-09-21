# ABot Commit Log

This document tracks every commit made on `main` following the `2.0.x` versioning schema:
- Sequence: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ `2.1.0`, `2.1.1`, ..., `2.1.10` ➔ `2.2.0`, etc.
- Format: `<version> - <short sentence>`

> **⚠️ Branch-version independence (read this before comparing branches):** `main` and
> `arena/01a03fe9-abot` use **separate, independent version numbers and commit names**. The same
> version number on both branches does **NOT** mean the same work — e.g. `main`'s `2.0.10` and
> `arena`'s `2.0.10` were two different commits written by different agents before the branches
> converged at `2.0.27` (from then on, commits land on `main` and `arena` is fast-forwarded).
> **Always identify/compare commits by their hash, never by version number alone.**

---

## Commit History

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
