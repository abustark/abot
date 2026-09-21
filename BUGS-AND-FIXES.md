# ABot — Bugs & Fixes Registry

> **Purpose:** the living record of every confirmed bug, where it lived (file + approximate line range), what fixed it, and in which commit. Used for regression review after every update (see §Re-verification Policy).
>
> **Maintenance rules:**
> 1. **Every** confirmed bug gets an entry here — with file, approx line range (guess if code moved), fix summary, and the version + commit ref that fixed it.
> 2. **Re-verification policy (MANDATORY):** whenever a new major or intermediate update ships to the site (arena or main), **re-run the checks in §Re-verification Checklist** and spot-check the Fix Lines of every entry below. If a bug's symptom reappears, its Fix Line region regressed — diff that region against the fix commit and restore.
> 3. **Two sections:** §Arena Branch (this branch's history, versions `2.0.x`) and §Main Repo (the `main` branch's own history — maintainers append there with main's own commit refs).

---

## §Arena Branch — Bug & Fix History

| # | Bug | File(s) + approx Fix Lines | Fix | Version / Commit |
|---|---|---|---|---|
| B-01 | **Repo source exposure** — `express.static('.')` served `server.js`, `package.json`, entire `.git/` (attacker could download full history) | `server.js` ~L60–80 (static middleware) | Replaced repo-root static with an explicit per-path allowlist (`/`, `index.html`, `favicon*`, `logo.png`, `service-worker.js`, `/dist`, `/js`, `/vendor`, icons, `manifest.json`) | 2.0.0-era hardening · Phase 1 security commit `2e967eb` |
| B-02 | **No auth-token size caps / unlimited prompt sizes** — free-tier token-burn abuse | `lib/chat-security.js` `LIMITS` (L10–25) + `validateChatRequest` (L30–75) | 40-message cap, 8,000 chars/message, 200K total, 256 KB JSON body limit | 2.0.0-era · `2e967eb` |
| B-03 | **Auth token accepted via `?token=` query** (leaks into logs) + Gemini key in URL | `server.js` checkAuth (~L150), both backends' Gemini fetch | Bearer-header-only auth; `x-goog-api-key` header | 2.0.0-era · `2e967eb` |
| B-04 | **Raw upstream errors streamed to client** (leaked provider details) | both backends' error branches | Generic messages server-side; `logProviderError` truncation server-side only | 2.0.0-era · `2e967eb` |
| B-05 | **Monolith frontend** — 2,555-line `index.html`, all JS inline | `index.html` + new `js/*.js` | Extracted to 8 ES modules with token-parity verification (`tools/verify-parity.js`) | Phase 2 · `22b0bf1`, `5175109`, `414f338` |
| B-06 | **`state.js` evaluated `firebase.auth()` at module load** — would crash in production (before `initializeApp`) | `js/state.js` (auth/db entries) | `null` initializers; assigned by `initFirebase()` at original closure timing | Phase 2 · `22b0bf1` |
| B-07 | **`/js` missing from static allowlist** — all modules 404 | `server.js` (allowlist block) | Added `/js` express.static route | Phase 2 · `5175109` |
| B-08 | **XSS sink** — SSE error rendered via `innerHTML` (upstream text could inject) | `js/chat.js` sendMessage error paths (~L530 & ~L775 at the time) | DOM-API construction; later (2.0.13+) errors became persisted messages via `textContent` only | Phase 2 · `22b0bf1`; superseded 2.0.13 `882e454` |
| B-09 | **Lost component CSS** — style-block cleanup removed loader/bubble/typing/transition CSS with the theme vars | `src/input.css` (restored block near end of file) | Full restore outside `@layer` (purge-proof), retuned to tokens | 3.x · `35ca4f3` |
| B-10 | **Light-mode invisible text** — auth header had hardcoded `#f3f4f6`/`#9ca3af` inline styles | `index.html` auth header (~L82–84 at the time) | Token classes (`text-ink`, `text-muted`) | 3.x · `5e81724` |
| B-11 | **Duplicate `modelSelectorPanel`** — visible pill wired to a distant second panel ("selector doesn't open") | `index.html` (top-header panel ~L345) | Removed duplicate; registry resolves to the chat-header panel | 3.5 · `57ff86f` |
| B-12 | **Predatory panel auto-closer** — document click handler scheduled "hide" 200 ms after ANY click; panel flashed open/closed | `js/app.js` document click handler (~L230) | Closes only when open + click genuinely outside panel/trigger | 3.5 · `57ff86f` |
| B-13 | **Duplicate `modal-title` id** — sign-out confirm modal wiring broke | `index.html` guest-limit modal (~L523) | Renamed `guest-modal-title`; duplicate-id check added to `#diag` + interaction tests | 3.5 · `dcbe9d4` |
| B-14 | **Stale SW/cache served old JS against new HTML** (mixed-version pages) | `service-worker.js` (CACHE_NAME) + `index.html` (css `?v=`) + `updateViaCache:'none'` | Versioned cache names (v9→v35+), busted asset URLs, `/#reset` purge tool | ongoing · e.g. `6b86082`, `045cd6b` |
| B-15 | **`initApp()` re-ran per sign-in → duplicate listeners** — after sign-out→sign-in, sidebar/theme toggles fired twice per click and cancelled out ("collapse menu stops working") | `js/app.js` `initApp()` head (~L63–75) | Idempotency guard `window.__abotShellWired`; `tools/cycle-test.js` regression (login→signout→re-login→single-fire) | 2.0.8 · `53e5f33` |
| B-16 | **Google button dead after sign-out** — GIS kept previous account auto-selected | `js/auth.js` `signOutUser()` (~L110) | `google.accounts.id.disableAutoSelect()` | 2.0.8 · `53e5f33` |
| B-17 | **Sign-out teardown could freeze the auth screen** — one throw in the logged-out branch left it non-interactive | `js/auth.js` logged-out branch (~L386–435) | try/catch + belt-and-braces forced reveal + toast | 2.0.8 · `53e5f33` |
| B-18 | **Invisible `#app-loader` intercepted all taps** (mobile "frozen after login") | `js/auth.js` `hideAppLoader()` (~L296) | `pointer-events:none` + `visibility:hidden` immediately; display cleanup via `transitionend` + fallback *(fixed by Antigravity v2.0.7, merged `828a54a`)* | v2.0.7 · `828a54a` |
| B-19 | **`providerStatusError is not a function`** — lib lost the function in a sandbox reset while both backends called it → EVERY provider error crashed into generic TypeError; masked all real model statuses | `lib/chat-security.js` exports (~L189) | Restored fn + export; **drift-guard tests** assert the full 10-name API surface + exercise the function (404 envelope, ended-stream no-write) | 2.0.17 · `176d371` |
| B-20 | **Error cards rendered as typing dots** — persisted errors passed `isHistory=false` → streaming-placeholder branch; error text never shown ("two loading bubbles") | `js/chat.js` `appendMessage` (~L282) | `message.isError` checked FIRST — danger text card in every path | 2.0.16 · `3ab9955` |
| B-21 | **`TypeError` from null `response.body`** — `getReader()`/`for await` on a null body crashed the proxy loops ("(groq/TypeError)") | `api/chat.js` (~L103–150), `server.js` reader loops (~L295–310) | Null-body guard + try/catch around every proxy loop → "model rotating" / "stream interrupted" messages | 2.0.16 · `3ab9955` (api) + 2.0.16-fixup (server) |
| B-22 | **Vanishing error message** — DOM-only error wiped ~2 s later by title-gen rename → `renderActiveChat` | `js/chat.js` sendMessage SSE-error branch + `finally` (~L690, ~L840) | Errors persisted as real assistant messages (`isError`); title-gen skipped after failed streams | 2.0.13 · `882e454` |
| B-23 | **Two identical responses for one prompt** — `sendMessage` had no in-flight guard; `isStreaming` set after a Firestore await | `js/chat.js` `sendMessage` head (~L543–620) | Guard first-line; `isStreaming` set before any await; cycle-test: 3 rapid clicks → 1 message | 2.0.15 · `34140a8` |
| B-24 | **Reply hidden behind composer (mobile)** — fixed-height padding vs dynamic dock; no follow during streams | `js/app.js` initApp wiring (~L100 region) + `js/chat.js` append/stream sites | ResizeObserver syncs container padding to dock height; auto-follow only when user is at bottom; follow also on re-renders | 2.0.15 `34140a8` + 2.0.18 (follow-on-render) |
| B-25 | **Deprecated model IDs served as options** — Groq: 5 of 6 dead (llama-3.1-8b, llama-3.3-70b, llama-4-scout, kimi-k2, deepseek-r1-distill); OpenRouter: dead DeepSeek V3 free + Venice | `js/config.js` MODEL_CONFIG; `lib/chat-security.js` ALLOWED_PROVIDERS; validation patterns also rejected `:` (broke ALL `:free` models) | Catalog refreshes from console.groq.com/docs/deprecations + openrouter.ai/models; `:` allowed in patterns; `:free` routing before org-prefix; web-search chip off for `:free` | 2.0.10–2.0.12 · `8adbcca`, `59c9264`, `981dde7` |
| B-26 | **Generic "Something went wrong" hid real causes** | `lib/chat-security.js` `sseError`/`providerStatusError` (~L157–180); backends' catch blocks | Machine `code` + status-specific messages (auth_failed / model_unavailable / rate_limited / config_missing naming the env var) | 2.0.13 `882e454` + 2.0.17 `176d371` |
| B-27 | **OpenRouter `:free` 401 — key missing on Vercel** *(owner action required)* | Not a code bug — `OPENROUTER_API_KEY` absent/expired in Vercel env | Owner: Vercel → Project → Settings → Environment Variables → add/refresh `OPENROUTER_API_KEY` → redeploy. Error message now names this explicitly | Documented 2.0.16+ |
| B-28 | **GIS token client lost after sign-out** — Google button could no-op | `js/auth.js` Google click handler (~L196) | On-demand rebuild of `tokenClient` if missing; explicit "still loading" message otherwise | 2.0.18 · current commit |
| B-29 | **Stuck dots bubble next to the error card** — on stream error the typing placeholder was never removed, so the error persisted as a SECOND bubble ("two responses" look) | `js/chat.js` SSE-error branch + network catch (~L695, ~L790) | Remove the `.typing-indicator` placeholder's message container before appending the error card | 2.0.19 · current commit |
| B-30 | **`llama-3.3-70b-instruct:free` 404** — listed free on OpenRouter but no provider currently serves the free variant (verified on the model page: exists, Price Free, but API 404). Removed from catalog; restore if it returns | `js/config.js` MODEL_CONFIG (removed entry, comment left in place) | Catalog removal; user's 401→404 change simultaneously confirmed the new `OPENROUTER_API_KEY` works | 2.0.19 · current commit |
| B-31 | **Confirmed working / not a bug:** "two GPT-oss replies" in screenshots = two separate "hi" sends, each with its own response (correct behavior). `OPENROUTER_API_KEY` confirmed working (401 → 404 status change after key update) | — | — | verified 2026-08-30 |

---

## §Re-verification Checklist (run after EVERY major/intermediate update)

**Fast automated pass (local or CI):**
```bash
npm run check && npx eslint . && node tests/chat-security.test.js && npm run test
# + rebuild & commit CSS if src/ or tailwind config changed:
npm run build:css && git diff --exit-code -- dist/output.css
```

**Manual spot-checks (5 min, real browser, both themes):**
1. `#reset` → reload → build badge/console build id matches the new deployment
2. Sign in (Google + guest) → **sign out → immediately sign back in** → sidebar collapse + theme toggle still single-fire (B-15, B-16, B-28)
3. Model selector opens, contains current catalog, no duplicate ids (`#diag` shows "duplicate ids: none") (B-11, B-13)
4. Send a message on one Groq + one OpenRouter model → response streams; if an error appears, the card shows SPECIFIC text and persists (B-19–B-22, B-26)
5. Long reply on mobile: nothing hides behind the composer; scrolling up pauses follow (B-24)
6. Send two messages fast → no duplicate user bubbles (B-23)
7. Toast stacks and dismisses; Escape closes dialogs; focus trapped inside (2.0.9 set)
8. Static probes: `/server.js`, `/.git/config`, `/package.json` → all 404 (B-01)

**Catalog freshness (monthly/quarterly):**
- Groq: console.groq.com/docs/models + /docs/deprecations — **monthly** (4 deprecation waves in 12 months)
- OpenRouter: openrouter.ai/models?q=free — **quarterly** (rotating free tier)

---

## §Main Repo — Bug & Fix History

> Maintainers of `main`: append entries here using the same table format, with `main`'s own version numbers and commit refs. The Re-verification Checklist applies to `main` deployments identically — run it after every main release and after every merge from `arena`.

| # | Bug | File(s) + approx Fix Lines | Fix | Version / Commit |
|---|---|---|---|---|
| M-01 | *(placeholder — log main-branch regressions here; e.g. merges from arena that dropped a fix listed in §Arena — re-run the checklist and diff Fix Lines against the referenced fix commits)* | — | — | — |

---

*Registry started 2026-08-30 · Arena branch: `arena/01a03fe9-abot` · Entries B-01…B-28 · Next review: every release*
