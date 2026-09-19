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
- Tests/gates: see §3. Docs worth reading before UI work: `docs/UI-IDEAS-FREEBUFF.md` (**read first — owner directive**), `docs/PHASE3_PLAN.md` (design system), `IMPLEMENTATION_PLAN.md` (history).

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

> **Standing pre-task step (all phases):** read `docs/UI-IDEAS-FREEBUFF.md`
> first and keep its backlog in mind — the user may ask for something else,
> but the UI ideas there are the standing direction for every visual change.

### PHASE A — Fix the open bug first (blocking everything else)
Read **`docs/BUG-BRIEF-tap-blocking.md`** in full. Summary: physical taps on shell controls do nothing on the deployed app, while synthetic `dispatchEvent` clicks all pass — a hit-testing/interception issue. The build already contains ground-truth tools you must use, not replace:
- `window.__abotClicks` — capture-phase log of every real click (target, x/y, time)
- `#diag` in-page overlay: build id, initApp completion, duplicate-id scan, `elementFromPoint` hit-tests, viewport-covering-layer scan, real-click log, captured errors
- `<url>/#reset` — wipes SW/caches/storage and reloads

**Method:** run the app locally (`node server.js`, port 3000), reproduce with REAL browser interaction (you have a real browser — use it; the previous agent's sandbox could not, which is why this bug survived), follow the brief's decisive test, name the intercepting layer or wiring mismatch, fix it minimally.

Known-fixed pitfalls — do NOT reintroduce: duplicate element IDs (`modelSelectorPanel`, `modal-title` were duplicated before), the any-click panel auto-closer, `'unsafe-inline'` scripts, `express.static('.')`.

### PHASE B — Verify (all gates green + real-browser pass)
Run every gate in §3, then verify in a real browser (desktop + mobile viewport):
- `#reset` → sign in as guest → send a chat message (streams in)
- Tap-test by hand: theme toggle, sidebar, model selector (17 options), settings switches, search, export menu, sign-out confirm
- Auth screen: coral ambient net renders behind the card in dark AND light

### PHASE C — Only now push
Push your branch, merge into `arena/01a03fe9-abot` (CI must be green — `.github/workflows/ci.yml` runs on every push), and report to the owner: root cause, fix, files touched, verification evidence (the diag overlay output before/after).

### PHASE D — Component visual upgrade (only after A–C)
Open **`docs/UI-COMPONENTS-ROADMAP.md`** and execute it top-down (toast polish → modal focus-trap → tooltips → Ctrl+K command palette). Respect its acceptance criteria and the design-token/motion rules. One component per commit, gates green per commit.

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

*Prepared 2026-08-30 · Current open bug: `docs/BUG-BRIEF-tap-blocking.md` · Next roadmap: `docs/UI-COMPONENTS-ROADMAP.md`*
