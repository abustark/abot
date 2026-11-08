# ABot — AI Chat Hub

> 📄 **[`docs/PROJECT-INFO.md`](docs/PROJECT-INFO.md)** — machine-readable project facts (stack + exact versions, architecture, metrics, keyword tags) designed so an AI can generate resume entries and portfolio project summaries from it alone.

**One calm place to talk to 31 models from 4 providers** — Google Gemini, Groq, NVIDIA NIM, and OpenRouter's free tier — with streaming, markdown, and a warm, Claude-style design system. No framework, no build step for the app itself: vanilla ES modules all the way down.

> **Live demo:** https://abot-ai.vercel.app/
> **Repo:** https://github.com/abustark/abot

---

## Screenshots

| Light · Desktop | Dark · Desktop |
|:---:|:---:|
| <img src="docs/screenshots/auth-light-desktop.webp" alt="ABot sign-in page — light theme, desktop" width="400"> | <img src="docs/screenshots/auth-dark-desktop.webp" alt="ABot sign-in page — dark theme, desktop" width="400"> |

<p align="center">
  <img src="docs/screenshots/auth-mobile.webp" alt="ABot sign-in page — mobile layout" width="300">
</p>

---

## Highlights

**Multi-model core**
- 31 models across **Google Gemini** (direct API), **Groq**, **NVIDIA NIM**, and **OpenRouter** free tier
- **OpenRouter Auto (Free)** — an auto-failover router that picks the best available free model
- Per-provider identity colors, per-chat model theming, per-request **web-search** and **thinking** toggles with capability gating (chips auto-disable where the provider doesn't support them)

**Chat experience**
- SSE streaming with throttled rendering (~100 ms flushes — no UI-thread freeze on phones), stop-generation via `AbortController`, live follow-scroll with jump-to-latest pill
- Full markdown with lazy-loaded syntax highlighting, error cards with one-click retry
- Optional timestamps, TTS (auto-read + per-message speak/stop), per-chat message search, draft leave-guard

**Chat management**
- New / inline-rename / delete-with-confirm, export to JSON **and** Markdown, **import chat**, sidebar search
- Prompt library with 9 system-prompt presets per chat

**Auth & accounts**
- Email/password (signup, login, forgot-password, email-verification gate), Google sign-in, and a **guest mode** (5-message limit + upgrade modal) so visitors can try it instantly

**Chrome & platform**
- Command palette (`Ctrl+K`), keyboard shortcuts (`Alt+N`, `Alt+/`), dark/light theme with system-preference pre-paint (no flash)
- Toast stack with swipe-dismiss, skeleton screens, tooltips
- **Installable PWA**: manifest + service worker, safe-area insets, keyboard dock for mobile

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser["Browser — vanilla ES modules (no framework)"]
        UI[index.html + js/app.js]
        TW[Tailwind CSS\ncompiled dist/output.css]
        SW[Service Worker\nPWA]
    end

    subgraph Vercel["Vercel Serverless"]
        API[api/chat.js\nhardened proxy]
        SEC[lib/chat-security.js]
    end

    subgraph Firebase["Firebase"]
        AUTH[Auth\nemail · Google · guest]
        FS[(Firestore\nusers/uid/chats/chatId)]
    end

    subgraph Providers["AI Providers — free-tier keys"]
        GEM[Google Gemini]
        GRQ[Groq]
        NV[NVIDIA NIM]
        OR[OpenRouter\nfree models + auto-router]
    end

    UI -->|SSE stream| API
    API --> SEC --> GEM & GRQ & NV & OR
    UI --> AUTH
    UI -->|chat CRUD| FS
```

**Why no framework?** Deliberate, settled decision (owner, 2026-08-30) — [`AGENTS.md`](AGENTS.md) §5 rule 1 lists the conditions that would trigger a revisit.

**Frontend modules** (`js/`, dependency order): `config.js` (model registry, colors, prompts) → `dom.js` → `state.js` → `utils.js` → `ui.js` → `auth.js` → `chat.js` → `app.js` (entry). Extracted verbatim from the original inline monolith with **token-level parity verification** (`tools/verify-parity.js`). Details: [`js/README.md`](js/README.md).

**Backend mirror:** `server.js` replicates `api/chat.js` for local dev, sharing `lib/chat-security.js` so prod and local enforce identical rules.

---

## Security & quality gates

This is the part most portfolio projects skip.

- **Hardened serverless proxy** (`api/chat.js`): rate limiting, request size caps, verified-email enforcement (Firebase Admin), generic error envelopes — provider keys never reach the browser
- **Strict CSP + security headers** in `vercel.json` (nosniff, frame-deny, HSTS, locked-down connect-src to exactly the APIs used)
- **Firestore rules**: per-user isolation (`users/{uid}` only, everything else denied) — [`firestore.rules`](firestore.rules)
- **Test suite** (`npm run test`):
  - `tests/chat-security.test.js` — backend security contract
  - `tools/interaction-test.js` — clicks **every shell control** in jsdom and asserts the visible effect
  - `tools/cycle-test.js` — behavior regressions (e.g. mobile keyboard dismissal after send)
  - `tools/smoke-node.js` — jsdom runtime walk of logged-out/logged-in init paths
- **Plus**: ESLint (`npm run lint`), acorn syntax check of every JS file (`npm run check`), TypeScript checking via JSDoc (`npm run typecheck`), HTML validity (`npm run test:html`, html-validate), Python security-header + endpoint audit (`npm run test:security`, needs local server), real-browser UI audit with 11 hard-fail groups (`npm run ui:audit`, needs local server), Playwright E2E (`tools/test-playwright.py`), visual regression (`npm run visual:local`)
- **Pre-commit hook** runs syntax + lint on every commit (`.githooks/`, wired by `npm ci`)

---

## Getting started

```bash
npm ci                  # installs deps + wires .githooks via prepare
cp .env.example .env    # fill in Firebase + provider keys (all have free tiers)
node server.js          # local dev server (mirrors the Vercel function)
npm run watch:css       # in another terminal, if you're touching styles
```

**Environment variables** (see [`.env.example`](.env.example)): Firebase client config, Google OAuth client ID, Firebase Admin service-account JSON, and the four provider keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`). All providers used have free tiers — the app is designed around them.

**Deploy:** push to `main` → Vercel serves `index.html` statically and `api/chat.js` as a serverless function (60 s max duration for long streams).

---

## Project layout

```
index.html            # app shell (single page)
js/                   # frontend ES modules (see js/README.md)
api/chat.js           # Vercel serverless proxy (production)
server.js             # local dev mirror of api/chat.js
lib/chat-security.js  # shared backend hardening
src/input.css         # Tailwind source + design tokens → dist/output.css
tests/ tools/         # security tests, interaction/cycle/smoke/visual suites
docs/                 # commit log, project info, bug registry, plans, paste-kits
```

## Docs worth reading

- [`docs/COMMIT-HISTORY.md`](docs/COMMIT-HISTORY.md) — full versioned commit history
- [`docs/BUGS-AND-FIXES.md`](docs/BUGS-AND-FIXES.md) — bug registry: symptom → root cause → fix, 49 entries and counting
- [`AGENTS.md`](AGENTS.md) — the operating brief (branch discipline, quality gates, hard rules)

## License

© 2026 ABu. All rights reserved. The source is not licensed for reuse, modification, or redistribution.

In active development — new features ship regularly.

