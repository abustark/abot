# ABot — Project Info Sheet (source of truth for resume & portfolio summaries)

> **Purpose:** every fact an AI (or a person) needs to write a resume "Projects"
> entry, a portfolio summary, a LinkedIn post, or interview talking points for
> ABot — without reading the code.
> **Current as of:** **v2.9.2** · 2026-11-09 · branch `main`.

---

## 0. Instructions for the AI (read before writing anything)

**Use only the facts in this sheet.** Do not invent users, traffic, revenue, funding, partnerships, team size, or timelines. If a number is not here, it does not exist.

**The project is private.** The GitHub repo (`abustark/abot`) is private and the code is all rights reserved (`"license": "UNLICENSED"`). Therefore:

- never describe ABot as open source;
- never put the repo URL in a public post — outsiders get a 404. Link the live demo instead, and offer a code walkthrough on request;
- never offer the code for reuse or imply a license to copy it.

**Claims you may make:** 31 models across 4 provider APIs (Gemini, Groq, NVIDIA NIM, OpenRouter) · vanilla ES modules, no framework, no app bundler · compiled Tailwind design system with a warm oxblood-and-bone palette · SSE streaming through a hardened serverless proxy · Firebase Auth (email, Google, guest) + Firestore · installable PWA · strict CSP and security headers · 4 automated test suites · 49-entry bug registry · enforced one-version-per-release workflow · 116 versioned releases logged.

**Claims about visibility — read carefully before writing a public post:**

- The **live site is public** and may be linked and screenshotted freely.
- The **repo is private**. Never publish the repo URL (outsiders get a 404) and never imply the source is open source or reusable.
- The README and the site footer read **"© 2026 ABu. All rights reserved."** with an *"In active development — new features ship regularly"* line. You may quote that positioning, but don't describe a formal license beyond "proprietary / all rights reserved."
- The project ships **real product screenshots** (chat, model selector, command palette, mobile) — describe them as present; they are in `docs/screenshots/`.

**Claims you must not make:**

- **No scale claims.** No user counts, traffic, retention, revenue, or "production at scale" — none are measured, and the rate limiter is explicitly per-warm-instance (documented limitation, not a distributed limiter).
- **Don't say "tests pass" about a release** unless the gate suite was actually run for it. Say "ships with four automated suites" instead.
- **Don't call it TypeScript.** Types are JSDoc, checked with `tsc` in check-only mode.
- **Don't claim WCAG certification.** Say "accessibility-minded: focus-visible states, aria-labelled controls, reduced-motion support".
- **Don't claim every model is always available.** All provider keys are free tier; models can be rate-limited, rotated, or retired upstream without notice.
- **Don't claim the demo is unlimited.** Guest mode caps at 5 messages and shared provider quotas can make it busy.
- **Don't call the design a "Claude clone".** Call it "a warm editorial design system (oxblood & bone)".

**Voice by target:**

| Target | Shape |
|---|---|
| Resume | 3–5 verb-first bullets, numbers from §6, keywords from §8 |
| Portfolio | one readable paragraph + feature list + stack chips |
| LinkedIn | 2–3 short paragraphs, first person, demo link, one caveat line |
| Interview | architecture from §3, hardest problems from §7 |

**Demo caveat line (use whenever you link it):** *"Live demo — free-tier keys, so it may be busy; guest mode gives you 5 messages without signing up."*

**Keep this sheet current:** bump the version and date in §1 when the app ships; generated copy must never cite a stale version.

---

## 1. Project identity

| Field | Value |
|---|---|
| Name | **ABot — AI Chat Hub** |
| Type | Full-stack web application (multi-model AI chat client + hardened serverless proxy) |
| Author | ABu / Basith AbuSyed (`abustark` on GitHub) |
| Live site | https://abot-ai.vercel.app/ |
| Source | private GitHub repo `abustark/abot` (access on request) |
| License | private, all rights reserved (`"license": "UNLICENSED"`); site footer © 2026 ABu |
| Version | **2.9.2** (2026-11-09) |
| Status | Actively maintained. 2.8.x is the portfolio-readiness pass: repo hygiene (CI moved to root `.github/`), footer copy, and real product screenshots in the README |
| Stack | Vanilla ES modules · Tailwind 3.4 (compiled) · Vercel serverless + Express mirror · Firebase Auth/Firestore · 4 free-tier AI providers |

**One-liners (pick by context):**

- *10 words:* Multi-model AI chat hub with streaming, search, hardened proxy.
- *25 words:* ABot is a vanilla-JS chat hub routing 31 configured models across Google Gemini, Groq, NVIDIA NIM and OpenRouter free tier, with SSE streaming and Firestore chat storage.
- *Elevator pitch:* ABot is one calm place to talk to 31 models from 4 free-tier providers. Pick a model, stream answers with markdown and syntax highlighting, search chats, use TTS, export/import, and drive everything from a command palette — behind a hardened serverless proxy with rate limits, email-verified auth and strict security headers, wrapped in a warm oxblood-and-bone dark/light PWA.

---

## 2. Tech stack — exact versions

| Category | Technology | Version | Role |
|---|---|---|---|
| Runtime | Node.js | unpinned (Express 4 + Vercel serverless) | Local + serverless backends |
| HTTP framework | Express | ^4.18.2 | Local dev server (`server.js`) |
| Hardening | helmet | ^8.1.0 | CSP + security headers (local mirror of `vercel.json`) |
| Rate limiting | express-rate-limit | ^8.7.0 | General 100 req/15min per IP |
| Auth (server) | firebase-admin | ^12.7.0 | `verifyIdToken` + email-verification gate |
| Env | dotenv | ^16.3.1 | `.env` config |
| Legacy | cors | ^2.8.5 | Installed, unused (same-origin, no `cors()`) |
| Frontend | Vanilla HTML/CSS/JS | ES modules, **zero frameworks, zero app build step** | `index.html` (909 lines) + `js/` (13 modules, ~4,770 lines) |
| Styling | Tailwind CSS | ^3.4.13 | `src/input.css` (1,868 lines) → `dist/output.css` (91 KB) |
| Styling plugin | @tailwindcss/typography | ^0.5.16 | Markdown prose |
| CSS pipeline | autoprefixer + postcss | ^10.4.21 / ^8.5.6 | `npm run build:css` |
| Auth (client) | Firebase compat SDKs | v9.22.1 (deferred) | Email/password, Google, anonymous guest |
| Sign-in | Google Identity Services | `gsi/client` | Google popup + credential flow |
| Database | Cloud Firestore | client SDK, rules `users/{uid}/chats/{chatId}` owner-only | Chat CRUD |
| AI (direct) | Google Gemini API | `generativelanguage.googleapis.com`, `x-goog-api-key` | 3 `google/*` models |
| AI (OpenAI-compat) | Groq | `api.groq.com/openai/v1/chat/completions` | 2 `groq/*` models |
| AI (OpenAI-compat) | NVIDIA NIM | `integrate.api.nvidia.com/v1/chat/completions` | 12 `nvidia/*` models |
| AI (OpenAI-compat) | OpenRouter | `openrouter.ai/api/v1/chat/completions` | 14 `*:free` models + Auto Free router |
| Markdown | marked (vendored) | `vendor/marked.min.js` 43 KB (+ npm `^18.0.11`) | Deferred rendering |
| Highlight | highlight.js (vendored) | `vendor/highlight.min.js` 160 KB (+ npm `^11.12.0`) | Lazy on first code block |
| Fonts | Self-hosted woff2 | 7 files in `dist/fonts/` (3 precached) | Plus Jakarta Sans / Cabinet Grotesk / JetBrains Mono / Source Serif 4 |
| PWA | Hand-written service worker + manifest | `abot-cache-v83`, 24 precached assets | Installable, offline shell |
| Screenshots | 5 PNG product captures + 3 WebP auth captures in `docs/screenshots/` (1.1 MB total) | README hero section |
| Versioning | `tools/sync-version.js` + `.githooks/` | one version per request batch, `.10` rollover | Writes `APP_VERSION` + `package.json` version, verifies the commit subject |
| Testing | jsdom | ^30.0.1 | interaction / cycle / smoke suites |
| Syntax | acorn + acorn-walk | ^8.18.0 / ^8.3.5 | `npm run check` |
| Bundling helper | esbuild | ^0.28.2 | Vendor builds |
| Browser QA | puppeteer-core | ^25.11.0 | `visual-check.js`, `ui-audit.js`, screenshot capture |
| Types | TypeScript (check-only) | ^5.9.3 | `tsc -p jsconfig.json` (`allowJs`) |
| Lint | ESLint | ^9.39.5 + `@eslint/js` + `globals` | `npm run lint`, pre-commit hook |
| Hosting (prod) | Vercel Serverless | `api/chat.js`, `maxDuration 60` | Production deployment |
| VCS | Git / GitHub | `main` + `arena/01a03fe9-abot` (fast-forward mirror) | v2.8.3, 2026-11-08 head |
| CI | GitHub Actions | `.github/workflows/ci.yml` | Runs on push to `main`/arena — **only executes when the repo is public** |

---

## 3. Architecture (how it fits together)

- **No-framework frontend, compiled CSS only:** `index.html` + `js/app.js` entry with a strict module order (`config → dom → state → utils → ui → auth → chat → app`), plus `auth-preview`, `palette`, `sparkles` and `dotloader` for isolated UI behaviour. Tailwind is compiled separately — the app itself has no bundler step.
- **Dual backend, one security core:** local Express `server.js` (CJS) mirrors Vercel serverless `api/chat.js` (ESM); both share `lib/chat-security.js` (validation, email gate, in-memory per-uid/hashed-IP limiter, 55 s upstream timeout, generic SSE error envelopes) so prod and local enforce identical rules.
- **Provider routing:** `*:free` always routes to OpenRouter (the org prefix is part of the upstream model id, not a direct-provider key); otherwise `google/*` → Gemini direct, `groq/*` → Groq, `nvidia/*` → NIM (bare id after the first segment); everything else → OpenRouter. Web search appends `:online` (disabled for Groq/NVIDIA/free); thinking is gated per model.
- **Firebase data model:** `users/{uid}/chats/{chatId}` with owner-only Firestore rules; everything else denied. All chat CRUD is per-user.
- **Key isolation:** the browser never holds provider keys — `POST /api/chat` (SSE) with a Bearer Firebase JWT → server verifies, rate-limits and validates (40 messages / 8k chars per message / 200k total / 256 KB JSON) → upstream fetch with server-side keys → streamed passthrough (Google non-stream is assembled).
- **Static allowlist:** `server.js` + `vercel.json` serve only `index.html`, `dist/`, `js/`, `vendor/`, the service worker, manifest and icons; `.env`, `service-account-key.json` and `.git/` return 404.
- **Strict CSP:** `script-src 'self'` plus two SHA-256-pinned inline pre-paint blocks (theme boot + service-worker registration), with `connect-src` locked to exactly the APIs used. **The two hashes are byte-exact and must be re-pinned in `vercel.json` and `server.js` whenever either inline script changes** — 2.7.5 fixed a stale hash that had been silently blocking the theme boot in production since the 2.6.10 palette change.
- **Repo layout:** CI lives at `.github/workflows/ci.yml` (the only path GitHub reads workflows from). `docs/` holds the commit log, bug registry, project info and screenshots; `tools/` holds the gate scripts; `js/` has its own `README.md` documenting the module graph.

---

## 4. Feature inventory (technical depth for bullet generation)

1. **31 configured models** (`js/config.js MODEL_CONFIG`): 3 Gemini direct (3.8 Flash, 3.5 Flash Lite, 3.6 Flash), 2 Groq (GPT-oss 120B — the default, GPT-oss 20B), 12 NVIDIA NIM (Kimi K3, GLM 5.3 / 5.3 Flash, Nemotron 3.x / 3.5, Gemma 4, DeepSeek V4.1 Flash, MiniMax M3.1, Muse Glimmer 30B…), 14 OpenRouter free models (Poolside Laguna, Thinking Machines Inkling, Dots3, Cohere North Mini Code, Gemma 4 free, NVIDIA `:free` variants) plus the `openrouter/free` auto-failover router.
2. **SSE streaming** — `text/event-stream` passthrough with 100 ms throttled rendering (no mobile freeze), stop-generation via `AbortController`, live follow-scroll + jump-to-latest pill, error cards with one-click retry.
3. **Markdown + code** — vendored `marked` + lazy `highlight.js` (`atom-one-dark`), `renderSafeMarkdown` with a sanitize guard.
4. **Chat management** — new / inline-rename / delete-with-confirm, sidebar + header search with jump-and-highlight, draft leave-guard.
5. **Timestamps + message search** — per-message timestamp toggle, per-chat search with jump-and-highlight.
6. **TTS** — per-message speak/stop + auto-read toggle (`abot-auto-tts`), `stripForSpeech` cleanup.
7. **Export/import** — JSON + Markdown export, JSON import with `{name,messages,model,systemPrompt}` validation.
8. **Prompt library** — 13 presets in two groups per chat. **Assistant (11):** Standard, Code Helper, Creative Writer, Email Assistant, Technical Writer, ELI5, Brainstorm Partner, Code Reviewer, Debugger, SQL Helper, Explain Code. **Fun (2):** Sarcastic Pirate, Game Master.
9. **Auth trio** — email/password (signup, login, forgot-password, verification gate blocking unverified password accounts with 403), Google sign-in, anonymous guest (5-message limit + upgrade modal, `linkGuestToGoogle` merge path).
10. **Command palette + shortcuts** — `Ctrl+K` palette, `Alt+N` new chat, `Alt+/` search focus, Enter/Shift+Enter send, Esc handling, model-panel typeahead.
11. **Design system — oxblood & bone** (2.6.10): light canvas `#f7f6f3`, ink `#16130f`, oxblood accent `#7d1f3d` (9.1:1), danger orange-red `#c2410c`; dark canvas `#141210`, rose accent `#e08a9e` (7.4:1). Serif display + sans body, provider identity colours, and a four-hue "provider seam" used as the brand underline on the auth page.
12. **Auth page as a product demo** — a three-model reply thread that types itself, rotating through 4 real developer questions (220 ms bubble fade between prompts), plus a branded top-right lockup and a responsive single-column mobile layout.
13. **PWA** — `manifest` (standalone, `#141210`), service worker `abot-cache-v85` precaching 25 assets (same-origin GET only, skips `/api/`), safe-area insets, mobile keyboard dock.
14. **Chrome details** — toast stack with swipe-dismiss, skeleton shimmer, tooltips, dark/light theme with a pre-paint guard (no flash) and a View-Transition crossfade, plus an optional 10 ms haptic tick on every tap (Vibration API, coarse pointers only; the switch is hidden on desktop).
15. **Security headers** — `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `no-store` on `/api/*`, immutable fonts/vendor, hourly JS/CSS.

---

## 5. Quality & testing

- **`bun run test` (4 suites via `tools/test-runner.js`, Node, no external runner):** one entry point spawns each suite in order and aggregates their exit codes. `tests/chat-security.test.js` (security contract: `:free` acceptance, traversal/model-pattern rejection, 40/8k caps, field stripping, options coercion, limiter + email status), `tools/smoke-node.js` (logged-out/logged-in jsdom walk), `tools/interaction-test.js` (clicks every shell control, asserts the visible effect), `tools/cycle-test.js` (mobile keyboard dismiss, single-fire listeners, 3 rapid clicks → 1 message).
- **Plus:** ESLint (`bun run lint`), acorn syntax check (`bun run check`), `tsc -p jsconfig.json` (`bun run typecheck`), HTML validity (`bun run test:html`), security-header + endpoint audit (`bun run test:security`, needs a local server), real-browser UI audit with 11 hard-fail groups (`bun run ui:audit`), Playwright E2E (`tools/test-playwright.py`), visual regression tooling (`bun run visual:local`; baselines are local-only and gitignored).
- **Parity proof (historical):** the de-monolithisation was verified at 56/57 token parity (1 documented deviation = an `innerHTML` → DOM XSS fix); `index.html` went from 2,555 lines to ~840, extracted into ES modules. The one-off `tools/verify-parity.js` was retired in 2.9.3 once the migration was finished.
- **Pre-commit hook** (`.githooks/`, wired by `prepare`): `tools/sync-version.js --from-history` writes `APP_VERSION` in `js/config.js` **and** `version` in `package.json`, advances the `📌 Next version` line, then syntax + lint run; `.githooks/commit-msg` aborts when the subject's version disagrees.
- **Bug registry:** `docs/BUGS-AND-FIXES.md` (49 unique B-ids and counting), `docs/COMMIT-HISTORY.md` (full versioned log), `AGENTS.md` (operating brief).
- **Screenshots:** **8 committed captures** in `docs/screenshots/` — 5 product shots (chat light, chat dark, model selector, command palette, mobile chat; PNG, 1366×608 desktop and 706×1374 mobile) presented in the README, plus 3 auth-page captures (WebP) inside a collapsed `<details>` block so the product leads the page.
- **CI:** `.github/workflows/ci.yml` runs the gate suite on push to `main` and `arena/01a03fe9-abot`. Caveat — GitHub only executes workflows on **public** repos, so while the repo stays private this is a ready-to-activate config, not a running pipeline.

---

## 6. Scale metrics (quantifiables)

- **293** git-tracked files (0 in `node_modules`).
- **~4,770 lines** across **13** `js/` ES modules (`chat.js` 1,378 · `app.js` 1,349 · `auth.js` 532 · `utils.js` 295 · `auth-preview.js` 288 · `sparkles.js` 169 · `ui.js` 166 · `palette.js` 163 · `config.js` 161 · `dom.js` 108 · `haptics.js` 76 · `dotloader.js` 60 · `state.js` 25) + `server.js` 427 + `api/chat.js` 241 + `lib/chat-security.js` 215.
- **909** lines of `index.html`, **1,868** lines of Tailwind source → **91 KB** compiled CSS.
- **31 configured models** across **4 provider APIs**; **13** prompt presets (11 assistant + 2 fun); **49** bug-registry ids; **118** versioned releases logged in `docs/COMMIT-HISTORY.md`.
- **4 test suites** in `npm test`; **25** service-worker precached assets; **7** self-hosted font files; **8** committed screenshots.
- **60 s** serverless max duration with **55 s** upstream abort; **30 req/15 min** per-identity chat limit + **100 req/15 min** per-IP general limit.
- **10 security issues (S1–S10)** remediated in Phase 1 (2026-08-27); favicon 380 KB → 1.2 KB in Phase 4.

---

## 7. Engineering practices worth mentioning

- **Fail-closed authorization** — unverified-email 403, ownerless/foreign chat denial, header-only Bearer auth.
- **Allowlist everything** — static paths, provider prefixes, model charset, `connect-src` origins, Firestore matches.
- **CSP hash pinning** — the two inline pre-paint blocks are allow-listed by SHA-256; 2.7.5 caught and fixed a stale hash that had silently blocked the theme boot in production, and re-pinned it in both `vercel.json` and the local Express mirror.
- **Version automation** — one version per request batch, `.10` rollover enforced by script, hooks write the version into both `js/config.js` and `package.json`, and the commit subject is verified against it.
- **Atomic, single-write mutations** — one Firestore write per user action (send, rename, model switch).
- **Behaviour-freeze refactors** — parity-verified de-monolithisation before any visual change.
- **Stream-safe proxying** — chunk passthrough with timeout + null-body guards, truncated server-only logs, generic client envelopes.
- **Degradation by design** — in-memory limiter with a documented per-warm-instance limit and a Tier-2 Firestore-counter recommendation; vendored, pinned, deferred third-party code.
- **Trunk discipline** — `main` is the source of truth, `arena/01a03fe9-abot` is a fast-forward mirror, AI work is governed by `AGENTS.md`.
- **Repository hygiene as a release activity** — the tree is read for what a *reviewer* sees, not just what the build needs: no duplicate configs, no stale copies of documents that have a single source of truth, no abandoned design explorations, no multi-megabyte local tool directories left untracked, and CI where the platform actually looks for it.

---

## 8. ATS / keyword tags

AI chat, multi-model routing, LLM integration, prompt engineering, Google Gemini, Groq, NVIDIA NIM, OpenRouter, server-sent events, SSE streaming, markdown rendering, syntax highlighting, Firebase Authentication, Google OAuth, Firestore, NoSQL, per-user isolation, rate limiting, Content-Security-Policy, CSP hash pinning, security headers, PWA, service worker, TTS, vanilla JavaScript, ES modules, Tailwind CSS, design system, responsive design, dark mode, accessibility, command palette, automated testing, jsdom, ESLint, TypeScript checking, Vercel serverless, Express, GitHub Actions, Git/GitHub, WebP, repository hygiene, technical documentation.

---

## 9. Ready-made examples (regenerate freely — facts only)

**Resume bullets:**

- Built a multi-model AI chat hub (vanilla ES modules, Tailwind, no framework) routing **31 models** across Google Gemini, Groq, NVIDIA NIM and OpenRouter free tier with SSE streaming and 100 ms throttled rendering.
- Designed a hardened proxy (`api/chat.js` + `server.js` sharing `lib/chat-security.js`) with Firebase JWT verification, an email-verified gate, per-uid/hashed-IP rate limits, 40/8k/200k caps, a 55 s abort and generic error envelopes — provider keys never reach the browser.
- Implemented chat depth (Firestore per-user CRUD, search, TTS, JSON/Markdown export/import, a 9-preset prompt library, `Ctrl+K` palette, 5-message guest mode) inside an installable dark/light PWA.
- Built a warm oxblood-and-bone design system (tokenised light/dark palettes, serif-display pairing, provider identity colours) and a self-demoing auth page whose three-model reply thread rotates through real developer questions.
- Closed 10 security findings (open static root, missing limiter, CORS combo, query-token auth, URL key, token-burn caps, error leakage, client-only guest cap, hung lambdas, inline CSP) with an allowlist static server, header-only auth and a strict CSP.
- Verified with 4 Node suites (security contract, jsdom smoke, full-shell interaction, cycle regressions) plus ESLint, acorn syntax checking, `tsc` check-only types, Playwright E2E and browser UI audits; `index.html` was de-monolithised from 2,555 inline lines into 13 ES modules, verified at 56/57 token parity.

**Resume project paragraph (3 lines):** Multi-model AI chat hub built with vanilla JS modules and Tailwind, proxying 31 models from 4 free-tier providers via a hardened Vercel/Express backend with Firebase Auth and Firestore. Features streaming with markdown/highlighting, search/TTS, export/import and a command palette in an installable dark/light PWA. Ships with strict CSP headers, per-user isolation, and 4 automated test suites covering security, smoke, interaction and cycles.

**Portfolio card (title + ~30 words + stack):** ABot — one calm hub for 31 AI models with streaming chat, prompt presets, TTS and deep chat management. Hardened proxy, Google + guest auth, installable PWA. `Vanilla JS · Tailwind · Firebase · Vercel · 4 AI providers`

**LinkedIn post (first person, 3 short paragraphs):**

> I built ABot — a multi-model AI chat app that puts 31 models from Gemini, Groq, NVIDIA NIM and OpenRouter behind one calm interface. Vanilla ES modules and compiled Tailwind on the front end; a hardened Vercel proxy and Firebase on the back.
>
> The parts I'm proudest of are the boring ones: provider keys never reach the browser, the CSP is hash-pinned, and every release is versioned by a hook that refuses a mismatched commit.
>
> Live demo: https://abot-ai.vercel.app/ — free-tier keys, so it may be busy; guest mode gives you 5 messages without signing up. The source is private; happy to walk through the code on request.

**Tone/length guide for the AI:** follow §0. Frame impact as user capability plus the hardest engineering problem solved — no business KPIs. Lead with verbs and the numbers from §6, use keywords from §8, and never cite a model count other than **31** or claim committed screenshots that are not in `docs/screenshots/`.

**When asked to write a LinkedIn/portfolio post:** lead with the live demo, not the repo. Offer a screenshot (chat, model selector or mobile) as the visual — never a code screenshot, since the source is private.
