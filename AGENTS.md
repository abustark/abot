# AGENTS.md — Operating Brief for AI Agents (Antigravity et al.)

> **Read this fully before writing any code.** It defines branch discipline,
> task order, quality gates, and hard constraints for working on ABot.
> Codex/Claude/Antigravity: this file overrides your defaults where they conflict.
>
> **🔴 READ-FIRST RULE (owner directive, 2026-09-19): before doing ANYTHING
> else the user asks, open and go through `docs/UI-IDEAS-FREEBUFF.md` — the
> Freebuff UI ideas backlog (performance, motion, PC/mobile polish). Every
> UI change you make must keep those ideas in mind, and new work should not
> contradict them. Re-read it when you touch `index.html`, `js/`, or
> `src/input.css`.**

---

## 0. Repository context (60 seconds)

ABot is a **vanilla-JS, multi-model AI chat app** (no framework):
- Frontend: `index.html` + ES modules in `js/` (entry: `js/app.js`), Tailwind CSS compiled from `src/input.css` → `dist/output.css` (**compiled file is committed — always rebuild + commit it after CSS/config changes**)
- Design system: Claude-style warm tokens (canvas/ink/coral) defined in `src/input.css` CSS vars + `tailwind.config.js`. **Never hardcode hex colors in markup/JS.**
- Backend: Vercel serverless `api/chat.js` (production) + `server.js` (local dev mirror), sharing `lib/chat-security.js`. Firebase Auth + Firestore (`users/{uid}/chats/{chatId}`).
- Tests/gates: see §3. Docs worth reading before any work: `docs/UI-IDEAS-FREEBUFF.md` (**read first — owner directive**) and `docs/AI-WORK-ORDER.md` (current findings, difficulty order, and approval gates).

**Constraint:** all AI providers are FREE-TIER keys. Never add features that make extra AI API calls without asking the owner.

---

## 1. Branch discipline (strict)

1. `git fetch origin` and base ALL work on **`origin/arena/01a03fe9-abot`** — this is the current integration branch (50+ commits: security hardening, modularization, design system, TTS, CI).
2. Create your working branch **from it**: `git checkout -b fix/tap-blocking origin/arena/01a03fe9-abot`
3. Commit early, commit small, message style: imperative summary + body explaining *why*.
4. When done and all gates pass (§3), push your branch to `origin`, then merge or open a PR **into `arena/01a03fe9-abot`**. Do not push broken/intermediate states to the integration branch. Do not touch `main` — the owner merges that.
5. Never force-push `arena/01a03fe9-abot`. Never commit secrets (`.env`, `service-account-key.json` are gitignored — keep them that way).

---

## 2. Task order (do NOT skip ahead)

> **Standing pre-task step:** read `docs/UI-IDEAS-FREEBUFF.md` first and keep
> its backlog in mind. Then read `docs/AI-WORK-ORDER.md` and follow its LOW →
> MEDIUM → HARD order.

1. Complete LOW difficulty work first.
2. Stop and report before starting MEDIUM work.
3. Start MEDIUM or HARD work only after explicit owner approval.
4. Do not add new features until the current security/auth findings in
   `docs/AI-WORK-ORDER.md` are handled or deliberately deferred by the owner.
5. Keep using `/#diag`, `/#reset`, interaction tests, and real-browser checks
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

*Prepared 2026-08-30 · Updated 2026-09-19 · Current source of truth: `docs/AI-WORK-ORDER.md`*
