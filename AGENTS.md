# AGENTS.md — Operating Brief for AI Agents (Antigravity et al.)

> **Read this fully before writing any code.** It defines branch discipline,
> task order, quality gates, and hard constraints for working on ABot.
> Codex/Claude/Antigravity: this file overrides your defaults where they conflict.
>
---

## 0. Repository context (60 seconds)

ABot is a **vanilla-JS, multi-model AI chat app** (no framework):
- Frontend: `index.html` + ES modules in `js/` (entry: `js/app.js`), Tailwind CSS compiled from `src/input.css` → `dist/output.css` (**compiled file is committed — always rebuild + commit it after CSS/config changes**)
- Design system: Claude-style warm tokens (canvas/ink/coral) defined in `src/input.css` CSS vars + `tailwind.config.js`. **Never hardcode hex colors in markup/JS.**
- Backend: Vercel serverless `api/chat.js` (production) + `server.js` (local dev mirror), sharing `lib/chat-security.js`. Firebase Auth + Firestore (`users/{uid}/chats/{chatId}`).
- Tests/gates: see §3. (`docs/UI-IDEAS-FREEBUFF.md` and `docs/AI-WORK-ORDER.md` were removed by owner directive, 2026-09-20 — no replacement work order exists; ask the owner before starting non-trivial work.)

**Constraint:** all AI providers are FREE-TIER keys. Never add features that make extra AI API calls without asking the owner.

---

## 1. Branch discipline & Commit Versioning (strict)

1. **Always work on `main`**: All development, fixes, quality gates, and commits happen directly on the `main` branch.
2. **Commit Naming & Versioning**:
   - Every commit must follow this versioning structure:
     `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ rolls over to `2.1.0`.
     Then `2.1.1`, ..., `2.1.10` ➔ rolls over to `2.2.0`, etc.
   - Format: `<version> - <short description>` (e.g., `2.0.2 - auth page ui changed`). Keep it short and clear, avoid overly long commit titles.
   - **Branch independence:** `main` and `arena/01a03fe9-abot` carry **separate, independent version sequences and commit names** — equal version numbers on the two branches are NOT the same work (the branches converged at `2.0.27`; before that they diverged, e.g. main's `2.0.10` ≠ arena's `2.0.10`). Identify commits by hash, never by version alone.
   - Every commit must also be logged in `docs/commits.md` with its version and what it did.
3. **Arena Synchronization (`arena/01a03fe9-abot`)**:
   - After updating `main`, merge `main` into `arena/01a03fe9-abot` so the integration branch stays synced with `main`.
   - **`docs/updates.md`**: Exists **only on the `arena` branch** (never commit to `main`). It is updated only after major updates (not for every small commit) and documents the contrast between the old workflow and the updated workflow.
4. **Secrets**: Never commit secrets (`.env`, `service-account-key.json` are gitignored — keep them that way).

---

## 2. Task order

> The work-order docs (`docs/UI-IDEAS-FREEBUFF.md`, `docs/AI-WORK-ORDER.md`)
> were removed by owner directive (2026-09-20). The LOW → MEDIUM → HARD
> backlog they tracked is complete (L1–L4, M1–M4, H1; H2 cancelled).

1. There is no standing work queue — **confirm scope with the owner before starting non-trivial work.**
2. Do not add new features without owner approval.
3. Keep using `/#diag`, `/#reset`, interaction tests, and real-browser checks
   when debugging shell taps, auth, or mobile UI.

---

## 3. Quality gates (ALL must pass before any push)

```bash
npm ci                      # first time
npm run lint                # eslint — 0 errors (warnings ≤ 30 acceptable)
npm run check               # acorn syntax check of every JS file
npm run build:css           # rebuild Tailwind after any CSS/config/markup class change
git diff --exit-code -- dist/output.css   # stale CSS = fail; commit the rebuild
npm run test                # security tests + jsdom smoke + interaction test
```

`tools/interaction-test.js` clicks every shell control in jsdom and asserts the visible effect — if you broke a toggle, this is where it shows. Add a case there for every new interactive element you build.

---

## 4. Skills available in-repo (use them)

- `.agents/skills/` — Emil Kowalski's craft library: `animate`, `review-animations`, `improve-animations`, `emil-design-eng`, `apple-design`, `animation-vocabulary`, `pick-ui-library`, `ask-sonner`, `prototype`, `find-animation-opportunities`
- `.claude/skills/` — `taste-skill` (anti-slop UI process), `web-design-guidelines` (a11y/UX audit), `image-to-code`, `awesome-design/references/claude/DESIGN.md` (the design tokens this app implements), `playwright-cli` (browser automation for verification)

For PHASE A: debugging discipline matters more than design skills.
For PHASE D: load `emil-design-eng` + `animate` + `taste-skill` before writing UI.

---

## 5. Hard rules

1. **Do not rewrite the app shell or migrate frameworks.** Vanilla ES modules is a settled decision (`docs/UI-COMPONENTS-ROADMAP.md` documents why and its revisit-triggers).
2. **Do not modify backend security hardening** (`api/chat.js`, `server.js`, `lib/chat-security.js`, `vercel.json`, `firestore.rules`) without owner sign-off.
3. **Behavior changes need a failing test or a real-browser repro first.** No speculative refactors.
4. **A11y is not optional:** every icon button has `aria-label`, focus-visible works, motion uses the `--ease-*` tokens at ≤300 ms, reduced-motion respected.
5. Commit messages explain *why*, not just *what*.
6. If blocked or the repro won't reproduce, add diagnostics (like `#diag`) rather than guessing — and say so in your report.

---

*Prepared 2026-08-30 · Updated 2026-09-20 · Commit log: `docs/commits.md`*
