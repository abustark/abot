# ABot — Project Info Sheet (source of truth for resume & portfolio summaries)

> **Purpose:** every fact an AI (or a person) needs to write a resume "Projects"
> entry or a portfolio project summary for ABot — without reading the code.
> Generate prose from these facts only; do not invent beyond them. Tune length
> and tone to the target (resume = dense & quantified; portfolio = readable &
> story-driven).

---

## 1. Project identity

| Field | Value |
|---|---|
| Name | **ABot — AI Chat Hub** |
| Type | Full-stack web application (multi-model AI chat client + hardened proxy) |
| Author | ABu / Basith AbuSyed (`abustark` on GitHub) |
| Live site | https://abot-eta.vercel.app/ |
| Source | https://github.com/abustark/abot |
| License | ISC |
| Status | Actively maintained (2026, v2.1.4, Phases 0–4 complete, Phase 5 browser verification owner-gated) |

**One-liners (pick by context):**
- *10 words:* Multi-model AI chat hub with streaming, search, hardened proxy.
- *25 words:* ABot is a vanilla-JS chat hub routing to 24 configured models across Google Gemini, Groq, NVIDIA NIM and OpenRouter free tier with SSE streaming and Firestore chat storage.
- *Elevator pitch:* ABot is one calm place to talk to 24 models from 4 free-tier providers. Pick a model, stream answers with markdown and syntax highlighting, search chats, react/pin messages, use voice and TTS, export/import, and manage everything from a command palette — behind a hardened serverless proxy with rate limits, email-verified auth and strict security headers, wrapped in a Claude-style dark/light PWA.

---

## 2. Tech stack — exact versions

| Category | Technology | Version | Role |
|---|---|---|---|
| Runtime | Node.js | unpinned (Express 4 + Vercel serverless) | Local + serverless backends |
| HTTP framework | Express | ^4.18.2 | Local dev server (`server.js`) |
| Hardening | helmet | ^8.1.0 | CSP + security headers |
| Rate limiting | express-rate-limit | ^8.7.0 | General 100 req/15min per IP |
| Auth (server) | firebase-admin | ^12.7.0 | `verifyIdToken` + email-verification gate |
| Env | dotenv | ^16.3.1 | `.env` config |
| Legacy | cors | ^2.8.5 | Installed (unused — same-origin, no `cors()`) |
| Frontend | Vanilla HTML/CSS/JS | ES modules, **zero frameworks, zero app build step** | `index.html` (813 lines) + `js/` (9 modules) |
| Styling | Tailwind CSS | ^3.4.13 | Compiled `src/input.css` (1050 lines) → `dist/output.css` (66 KB) |
| Styling plugin | @tailwindcss/typography | ^0.5.16 | Markdown prose |
| CSS pipeline | autoprefixer + postcss | ^10.4.21 / ^8.5.6 | Build via `npm run build` |
| Auth (client) | Firebase compat SDKs | v9.22.1 (deferred) | Email/password, Google, anonymous guest |
| Sign-in | Google Identity Services | `gsi/client` | Token-client flow + One Tap |
| Database | Cloud Firestore | via client SDK, rules `users/{uid}/chats/{chatId}` owner-only | Chat CRUD |
| AI (direct) | Google Gemini API | `generativelanguage.googleapis.com`, `x-goog-api-key` | `google/*` models |
| AI (OpenAI-compat) | Groq | `api.groq.com/openai/v1/chat/completions` | `groq/*` models |
| AI (OpenAI-compat) | NVIDIA NIM | `integrate.api.nvidia.com/v1/chat/completions` | `nvidia/*` models |
| AI (OpenAI-compat) | OpenRouter | `openrouter.ai/api/v1/chat/completions` | `*:free` + org-prefixed models + Auto Free router |
| Markdown | marked (vendored) | `vendor/marked.min.js` 44 KB (+ npm `^18.0.11`) | Lazy/deferred rendering |
| Highlight | highlight.js (vendored) | `vendor/highlight.min.js` 164 KB (+ npm `^11.12.0`) | Lazy on first code block |
| 3D bg (optional) | Vanta.js + Three.js | Vanta pinned 0.5.24, Three r134, default OFF lazy | Ambient background toggle |
| Fonts | Self-hosted woff2 | 8 files in `dist/fonts/` | Geist / JetBrains Mono / Source Serif 4 |
| PWA | Hand-written service worker + manifest | `abot-cache-v45`, 16 precached assets | Installable, offline shell |
| Testing | jsdom | ^30.0.1 | interaction/cycle/smoke suites |
| Syntax | acorn + acorn-walk | ^8.18.0 / ^8.3.5 | `npm run check` |
| Bundling helper | esbuild | ^0.28.2 | Vendor builds |
| Browser QA | puppeteer-core | ^25.11.0 | `visual-check.js`, Playwright E2E script |
| Types | TypeScript (check-only) | ^5.9.3 | `tsc -p jsconfig.json` (`allowJs`, `checkJs:false`) |
| Lint | ESLint | ^9.39.5 + `@eslint/js` + `globals` | `npm run lint`, pre-commit hook |
| Hosting (prod) | Vercel Serverless | `api/chat.js`, `maxDuration 60` | Production deployment |
| VCS | Git / GitHub | main branch | v2.1.4, 2026-09-24 head |

---

## 3. Architecture (how it fits together)

- **No-framework frontend, compiled CSS only:** `index.html` + `js/app.js` entry with strict module order (`config → dom → state → utils → ui → auth → chat → app` + `palette`); Tailwind compiled separately — the app itself has no bundler step.
- **Dual backend, one security core:** local Express `server.js` (CJS) mirrors Vercel serverless `api/chat.js` (ESM); both share `lib/chat-security.js` (validation, email gate, in-memory per-uid/hashed-IP limiter, 55s upstream timeout, generic SSE error envelopes) so prod and local enforce identical rules.
- **Provider routing by prefix/suffix:** `google/*` → Gemini direct, `groq/*` → Groq, `nvidia/*` → NIM (bare ID after first segment), `*:free` + org prefixes (`deepseek/, qwen/, z-ai/, openai/, meta-llama/…`) → OpenRouter; web-search appends `:online` (disabled for Groq/NVIDIA/free); thinking gated per-model.
- **Firebase data model:** `users/{uid}/chats/{chatId}` with owner-only Firestore rules; everything else denied. Client holds `state.auth/db` from `initFirebase()`; all chat CRUD is per-user.
- **Key isolation:** browser never holds provider keys — `POST /api/chat` (SSE) with Bearer Firebase JWT → server verifies + rate-limits + validates (40 msgs / 8k chars/msg / 200k total / 256 KB JSON) → upstream fetch with server-side keys → streamed passthrough (Google non-stream assembled).
- **Static allowlist:** `server.js` + `vercel.json` serve only `index.html, dist/, js/, vendor/, SW, manifest, icons`; `.env`, `service-account-key.json`, `.git/` return 404; strict CSP (`script-src 'self'` + 2 sha256-pinned pre-render blocks, locked `connect-src` to exactly the APIs used).

---

## 4. Feature inventory (technical depth for bullet generation)

1. **24 configured models** (`js/config.js MODEL_CONFIG`; README describes 36-model vision) — default `groq/openai/gpt-oss-120b`, Gemini 2.5 Pro/Flash, Qwen 3.x, MiniMax M2.7, Nemotron/Glimmer/Kimi/GLM/Gemma variants, plus `:free` tier + `openrouter/free` Auto failover router.
2. **SSE streaming** — `text/event-stream` passthrough with 100 ms throttled rendering (no mobile freeze), stop-generation via `AbortController`, live follow-scroll + jump-to-latest pill, auto-collapse long messages, error cards with one-click retry.
3. **Markdown + code** — vendored `marked` + lazy `highlight.js` (`atom-one-dark`), `renderSafeMarkdown` with `sanitizeHtml` XSS guard.
4. **Chat management** — new / inline-rename / delete-with-confirm, sidebar + header search with jump-and-highlight, current-chat chip, draft leave-guard.
5. **Reactions + pins + timestamps** — persisted to Firestore (1 write/action), collapse-long-messages, per-chat message search.
6. **Voice + TTS** — Web Speech recognition input, per-message speak/stop + auto-read toggle (`abot-auto-tts`), `stripForSpeech` cleanup.
7. **Export/import** — JSON + Markdown export, JSON import with `{name,messages,model,systemPrompt}` validation.
8. **Prompt library** — 9 presets (Standard, Code Helper, Sarcastic Pirate, Creative Writer, Email Assistant, Technical Writer, ELI5, Brainstorm Partner, Game Master) per chat.
9. **Auth trio** — email/password (signup/login/forgot + verification gate blocking unverified `password` provider → 403), Google GIS, anonymous guest (5-message limit + upgrade modal, `linkGuestToGoogle` merge path).
10. **Command palette + shortcuts** — `Ctrl+K` palette (export/new/switch/prompt actions), `Alt+N` new chat, `Alt+/` search focus, Enter/Shift+Enter send, Esc handling, model-panel typeahead.
11. **Claude-style theming** — dark/light + system pre-paint (no flash), View-Transition crossfade, warm-neutral tokens, serif-display pairing, per-provider identity colours, per-chat model theming.
12. **PWA** — `manifest` (standalone, `#181715`), SW `v45` precaching 16 assets (same-origin GET only, skips `/api/`), safe-area insets, mobile keyboard dock.
13. **Chrome details** — toast stack with swipe-dismiss, skeleton shimmer, tooltips, Vanta toggle (default OFF, coral/charcoal retune), reduced-motion support.
14. **Security headers** — `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `no-store` on `/api/*`, immutable fonts/vendor, hourly JS/CSS.

---

## 5. Quality & testing

- **`npm test` (4 suites, Node, no external runner):** `tests/chat-security.test.js` (113 lines — `:free` acceptance, traversal/model-pattern rejection, 40/8k caps, field stripping, options coercion, limiter + email-status), `tools/smoke-node.js` (logged-out/logged-in jsdom walk), `tools/interaction-test.js` (clicks every shell control, asserts visible effect), `tools/cycle-test.js` (mobile keyboard dismiss, single-fire listeners, 3-rapid-clicks→1-message).
- **Plus:** ESLint (`npm run lint`), acorn syntax check (`npm run check`), `tsc -p jsconfig.json` (`npm run typecheck`), Python header audit (`tools/test-security.py`), Playwright E2E (`tools/test-playwright.py`), visual regression (`npm run visual:local` + 10 `docs/audits/visual-*.png`).
- **Parity proof:** `tools/verify-parity.js` — token parity 56/57 after de-monolithisation (1 deviation = documented innerHTML→DOM XSS fix); `index.html` 2555→813 lines, 8 ES modules.
- **Pre-commit hook** (`.githooks/`, wired by `prepare`) runs syntax + lint.
- **Bug registry:** `BUGS-AND-FIXES.md` (B-01→B-49+), `COMMIT-HISTORY.md` (312 lines, `x.y.10→x.y+1.0` version rule), audits `ui-baseline/ui-final/perf-pwa`, `SUGGESTIONS.md`, `AGENTS.md`.
- **Screenshots pending:** `artifacts/` absent — README light/dark/mobile captures are owner browser-gated TODOs.

---

## 6. Scale metrics (quantifiables)

- **315** git-tracked files (0 in `node_modules`); **104** excluding skill packs (`.claude/agent/.agents` = 211 support files).
- **~3,200 lines** across **9** `js/` ES modules (`app.js` 1047, `chat.js` 934, `auth.js` 418, `utils.js` 265, `config.js` 151, `ui.js` 134, `palette.js` 126, `dom.js` 107, `state.js` 24) + `server.js` 380 + `api/chat.js` 224 + `lib/chat-security.js` 185.
- **24 configured models** × **4 providers**; **9 prompt presets**; **49+** bug-registry entries.
- **4 test suites** in `npm test`; **10** visual baselines; **16** SW-precached assets; **8** self-hosted fonts.
- **10 security issues (S1–S10)** remediated in Phase 1 (2026-08-27); favicon 380 KB→1.2 KB in Phase 4.
- **60s** serverless max duration with **55s** upstream abort; **30 req/15min** per-identity chat limit + **100 req/15min** IP general limit.

---

## 7. Engineering practices worth mentioning

- Fail-closed authorization — unverified-email 403, ownerless/foreign chat denial, header-only Bearer auth.
- Allowlist-everything — static paths, provider prefixes, model charset, `connect-src` origins, Firestore matches.
- Atomic, single-write mutations — reactions/pins as one Firestore write per action.
- Behaviour-freeze refactors — parity-verified de-monolithisation before any visual change.
- Stream-safe proxying — chunk passthrough with timeout + null-body guards, truncated server-only logs, generic client envelopes.
- Degradation by design — in-memory limiter with documented per-warm-instance limit + Tier-2 Firestore-counter recommendation; Vanta lazy + default-off.
- Pinned, vendored, deferred — CDN deps vendored/pinned, Firebase deferred, highlight lazy, fonts self-hosted.
- Trunk discipline — phased commits (Phases 0–4), version rule, arena-named merges; AI work governed by `AGENTS.md`.

---

## 8. ATS / keyword tags

AI chat, multi-model routing, LLM integration, prompt engineering, Google Gemini, Groq, NVIDIA NIM, OpenRouter, server-sent events, SSE streaming, markdown rendering, syntax highlighting, Firebase Authentication, Google OAuth, Firestore, NoSQL, per-user isolation, rate limiting, Content-Security-Policy, security headers, PWA, service worker, Web Speech API, TTS, vanilla JavaScript, ES modules, Tailwind CSS, responsive design, dark mode, accessibility (WCAG-minded), command palette, automated testing, jsdom, ESLint, TypeScript checking, Vercel serverless, Express, Git/GitHub.

---

## 9. Ready-made examples (regenerate freely — facts only)

**Resume bullets:**
- Built a multi-model AI chat hub (vanilla ES modules, Tailwind, no framework) routing 24 models across Google Gemini, Groq, NVIDIA NIM and OpenRouter free tier with SSE streaming and throttled rendering.
- Designed a hardened proxy (`api/chat.js` + `server.js` sharing `lib/chat-security.js`) with Firebase JWT verification, email-verified gate, per-uid/hashed-IP rate limits, 40/8k/200k caps, 55s abort and generic error envelopes — keys never reach the browser.
- Implemented chat depth (Firestore per-user CRUD, search, reactions/pins, TTS + voice input, JSON/Markdown export/import, 9-preset prompt library, `Ctrl+K` palette, guest 5-message mode) in a Claude-style dark/light PWA (SW v45, 16 precached assets).
- Closed 10 security findings (open static root, missing limiter, CORS combo, query-token auth, URL key, token-burn caps, error leakage, client-only guest cap, hung lambdas, inline CSP) with allowlist static, header-only auth and strict CSP.
- Verified with 4 Node suites (security contract, jsdom smoke, full-shell interaction, cycle regressions) plus ESLint, acorn syntax, `tsc` check, Playwright E2E and visual baselines; de-monolithised `index.html` 2555→813 lines with 56/57 token parity.

**Resume project paragraph (3 lines):** Multi-model AI chat hub built with vanilla JS modules and Tailwind, proxying 24 models from 4 free-tier providers via a hardened Vercel/Express backend with Firebase Auth and Firestore. Features streaming with markdown/highlighting, search/reactions/pins, voice/TTS, export/import and a command palette in an installable dark/light PWA. Ships with strict CSP headers, per-user isolation, and 4 automated test suites covering security, smoke, interaction and cycles.

**Portfolio card (title + ~30 words + stack):** ABot — one calm hub for 24 AI models with streaming chat, prompt presets, voice, and deep chat management. Hardened proxy, Google + guest auth, installable PWA. `Vanilla JS · Tailwind · Firebase · Vercel · 4 AI providers`

**Tone/length guide for the AI:** Frame impact as user capability + the hardest engineering problem solved (no business KPIs). Resume = 3–5 dense bullets or one 3-line paragraph, lead with verbs and numbers, keywords from §8; portfolio = friendly paragraph + feature list + stack chips, mention the 24-model routing, the hardened proxy, and the PWA; never claim 36 models as configured or committed screenshots — config holds 24, `artifacts/` is absent.
