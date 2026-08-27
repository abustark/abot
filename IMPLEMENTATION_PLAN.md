# ABot — UI/UX Revamp + Backend Security Implementation Plan

> **Goal:** Fix all known UI/UX, architecture, and security issues in structured phases — one phase at a time, executed sequentially, with a check-in before every large change.
>
> **Production target:** Vercel (`api/chat.js` serverless) · Firebase Auth + Firestore · free-tier AI providers (Google, Groq, NVIDIA, OpenRouter)
>
> **Status:** ▶️ In execution — **Phase 0 ✅ done** · **Phase 1 ✅ done** · Phase 2 next (needs approval)

---

## 1. Skills Used (and where they plug in)

| Skill | File | Used in | Purpose |
|---|---|---|---|
| **web-design-guidelines** (Vercel) | `.claude/skills/web-design-guidelines/` | Phase 0 & 5 | Baseline UI/a11y audit before changes; final compliance review after revamp |
| **taste-skill** | `.claude/skills/taste-skill/` | Phase 3 | Anti-slop guardrails for the redesign: design direction, audit-first process, pre-flight check before shipping |
| **awesome-design → `claude/DESIGN.md`** | `.claude/skills/awesome-design/references/claude/` | Phase 3 | Source of the calm warm-neutral design tokens (colors, type scale, spacing, motion) for the Claude-style theme |
| **image-to-code** | `.claude/skills/image-to-code/` | Phase 3 | Generate design mockup images first, analyze them, then implement to match (used only if a section is ambiguous) |
| **playwright-cli** | `.claude/skills/playwright-cli/` | Phase 0 & 5 | Real-browser verification: screenshots before/after, interaction flows (sign-in → chat → model switch), responsive checks |

---

## 2. Current-State Findings (what we're fixing)

### 🔴 Security — Critical
| # | Issue | Location |
|---|---|---|
| S1 | `express.static('.')` serves the **entire repo root** — `.env`, `service-account-key.json`, `.git/` are all downloadable | `server.js` |
| S2 | `api/chat.js` has **no rate limiting at all** (serverless — express-rate-limit is absent) | `api/chat.js` |
| S3 | `vercel.json` sets `Access-Control-Allow-Origin: *` **with** `Allow-Credentials: true` (insecure, invalid combo) | `vercel.json` |
| S4 | Auth token accepted via `?token=` query param → leaks into logs/history | `server.js` |
| S5 | Gemini API key passed in URL (`?key=`) → appears in upstream logs/proxies | `server.js`, `api/chat.js` |
| S6 | No cap on message count / message length → free-tier **token-burn abuse** | both backends |
| S7 | Raw upstream API error text streamed to client (can leak provider/key details) | both backends |
| S8 | Guest message limit (5) is **client-side only** — trivially bypassed | `index.html` |
| S9 | No upstream fetch timeout → hung lambdas / sockets | both backends |
| S10 | CSP allows `'unsafe-inline'` scripts (acceptable only until Phase 2 removes inline JS) | `server.js`, `vercel.json` |

### 🟠 Architecture
| # | Issue |
|---|---|
| A1 | `index.html` is a 2,555-line monolith; all app JS lives in 4 inline `<script>` blocks |
| A2 | `js/*.js` modules exist but are **dead code** — never referenced |
| A3 | Backend logic duplicated (server.js ↔ api/chat.js) with drift (Groq path sends un-cleaned messages in api/chat.js) |
| A4 | Vanta.js + Three.js loaded from CDN just for a background animation (heavy, blocks, CSP exception needed) |

### 🟡 UI/UX (from SUGGESTIONS.md + audit to confirm in Phase 0)
- Search within chat messages (missing)
- Loading states: no skeletons
- Message reactions / pin / collapse-long-messages / timestamps toggle
- Consistent empty states, better streaming indicator
- Mobile responsiveness & touch targets (to verify)

---

## 3. Phased Execution Plan

> **Working agreement:** Phases run strictly in order. I pause and ask before starting each phase, and before any single change that rewrites >1 file's core behavior. Each phase ends with a commit + short report.

### Phase 0 — Baseline Audit *(small, read-only)*
1. Stand up the app locally (`server.js`) and capture **before** screenshots (desktop + mobile) via playwright-cli.
2. Run the **web-design-guidelines** audit → save scored report to `docs/audits/ui-baseline.md`.
3. Confirm the security checklist above with quick probes (e.g. `GET /.env`).
4. Output: final task list confirmation, screenshots, audit report.

### Phase 1 — Backend Security Hardening *(Vercel-first)* ✅ **DONE 2026-08-27**
> **Delivered:** `lib/chat-security.js` (shared core), hardened `api/chat.js` + `server.js`, `vercel.json` headers, `firestore.rules` + deploy guide, `tests/chat-security.test.js` (all passing).
> S1a/S1b ✅ (allowlist static, `.git` 404) · S2 ✅ (per-uid/hashed-IP in-memory limiter) · S3 ✅ (CORS block removed) · S4 ✅ (header-only auth) · S5 ✅ (`x-goog-api-key` header) · S6 ✅ (40 msgs / 8k chars / 200k total caps) · S7 ✅ (generic error envelopes, sanitized logs) · S9 ✅ (55s AbortController) · model-path traversal guard added.
> ⚠️ Deploy-time follow-ups for the owner: set env vars on Vercel if not present; deploy `firestore.rules`; note Tier-1 limiter is per-warm-instance.
<!-- ORIGINAL TASK LIST (kept for reference)
1. **`api/chat.js` (primary):**
   - Per-user rate limiting: Firebase Auth `uid` + hashed-IP for guests. Tier 1: free in-memory per-instance window (documented limitation); Tier 2 (recommended): Firestore `usage/{uid}` daily counters — same free-tier pattern as the existing guest-limit modal. *I'll ask which tier before implementing.*
   - Hard caps: max 40 messages/request, max 8,000 chars/message, 1 concurrent stream per connection.
   - Generic error envelopes to clients; full details server-side only (`console.error`).
   - `AbortController` timeout (55s, under the 60s `maxDuration`).
   - Gemini key moved to `x-goog-api-key` header; strip `?token=`/query auth entirely.
   - Fix Groq/NVIDIA/OpenRouter paths to use `cleanedMessages` (drift bug).
2. **`vercel.json`:** drop `Allow-Origin: *` + credentials combo (app is same-origin → no CORS needed); add security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS; CSP tightened in Phase 2).
3. **`server.js` (secondary, kept in sync):** static serving locked to an allowlist (`index.html`, `dist/`, `favicon.png`, `logo.png`, manifest, service worker) with dotfile blocking; same validation/limits/errors; remove `cors()` (same-origin only).
4. **Firebase:** add `firestore.rules` file + deployment instructions (auth-based reads/writes) — final rules need your Firebase console access.
5. **`.gitignore`:** ensure `.env`, `service-account-key.json` never land (already clean in history ✅).

### Phase 2 — Frontend De-monolithization
1. Convert inline scripts → ES modules wired into the existing `js/` structure: `config.js`, `auth.js`, `chat.js`, `ui.js`, `utils.js`, `app.js` (update dead reference code to the *real* extracted modules).
2. `<script type="module" src="js/app.js">` — zero inline JS.
3. **CSP tightened:** `scriptSrc 'self'` only (drop `'unsafe-inline'`) in `server.js` + `vercel.json`.
4. Service worker cache-busting version bump + precache `dist/output.css`, `js/*.js`.
5. *Behavior-freeze rule:* no visual/UX changes in this phase — pure refactor, verified by playwright flows matching Phase 0 screenshots.

### Phase 3 — UI/UX Revamp (Claude-style calm) *(the big one — spec check-in before code)*
1. **Design system:** extract tokens from `awesome-design/references/claude/DESIGN.md` into `src/input.css` + `tailwind.config.js` — warm neutral palette (`#faf9f5`-family light / deep warm dark), serif-display + humanist-sans pairing, generous line-height, soft radii, subtle borders over shadows.
2. **taste-skill process:** audit-first on every screen; direction statement; pre-flight checklist before considered done.
3. **Screens:** auth, sidebar, chat history, composer, model selector, modals, empty state.
4. **Message layout:** refined Claude/ChatGPT hybrid — full-width AI messages with model header, compact user bubbles, comfortable max-width reading column.
5. **Vanta/Three.js background removed** (perf + CSP win); replaced with calm gradient/pattern (CSS only). *Confirm you're OK losing the animated background.*
6. **Feature batch from SUGGESTIONS.md:** search within messages · skeleton loaders · reactions 👍👎 · pin messages · collapse long messages · timestamps toggle.
7. Dark/light theme parity, mobile pass, focus states, reduced-motion support.
8. If any section is ambiguous: generate mockup with image-to-code skill, analyze, implement.

### Phase 4 — Performance & PWA Polish
1. Trim CDN deps (marked.js/dompurify kept; drop vanta/three), self-host critical fonts, preconnect hints.
2. Lighthouse pass (perf/a11y/best-practices) — targets recorded in plan review.
3. Service worker + manifest final check (offline shell, install-ability).

### Phase 5 — End-to-End Verification & Handoff
1. playwright-cli flows: sign-in → new chat → send (mocked SSE) → model switch → search → export; desktop + mobile viewports.
2. Final **web-design-guidelines** audit vs Phase 0 baseline → `docs/audits/ui-final.md`.
3. Security re-probe (S1–S10 checklist all green).
4. Summary report + remaining "future ideas" from SUGGESTIONS.md stay untouched.

---

## 4. Explicitly Out of Scope (for now)
- New AI features requiring heavy token usage (per repo constraint)
- Framework migration (React/Vue) — staying vanilla JS
- Chat sharing/links, PDF export, TTS, vision upload, code sandbox (future list)
- Firestore rules *deployment* (I'll author them; you deploy from console)

## 5. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Modularization breaks hidden behavior | Behavior-freeze + playwright flow parity checks |
| Serverless rate-limiting is inherently weak in-memory | Recommend Firestore counters (Tier 2); document limitation |
| Free-tier API keys in local `.env` during dev | Never commit; static allowlist blocks serving; `.env.example` only |
| Large UI diff hard to review | Phase-per-commit, before/after screenshots in each report |

---

*Prepared 2026-08-27 · Executed on branch `arena/01a03fe9-abot` · Check-in before every phase.*
