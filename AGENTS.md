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
   - Structure: `2.0.1` … `2.0.10` ➔ **rolls over to `2.1.0`**; then `2.1.1` … `2.1.10` ➔ **`2.2.0`**; and so on.
     **The third number NEVER exceeds `.10`** — when it would, roll the second number
     (`2.0.10` → `2.1.0`, `2.1.10` → `2.2.0`, `2.2.10` → `2.3.0`, …).
   - Format: `<version> - <short description>` (e.g., `2.0.2 - auth page ui changed`). Keep it short and clear, avoid overly long commit titles.
   - **Branch independence (strict):** `main` and `arena/01a03fe9-abot` each keep their **own** version
     numbers and commit names. The same number on the two branches is NOT the same work — always compare
     **hashes**, never numbers. Never give a `main` commit a number from arena's sequence (or vice versa).
   - **Keep the `📌 Next version` line at the top of `docs/commits.md` current** so no session has to guess.
   - Every commit must also be logged in `docs/commits.md` with its version and what it did.
3. **Arena Synchronization (`arena/01a03fe9-abot`)**:
   - After updating `main`, sync arena with an **arena-named merge commit**:
     `git switch arena/01a03fe9-abot && git merge --no-ff main -m "merge main <version> into arena/01a03fe9-abot"`.
     **Never fast-forward / push `main`'s ref straight into arena** — that brands main's commit names onto
     arena and wipes out arena's own sequence.
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

## 3. Quality gates (owner-triggered ONLY — agents never run them on their own)

**Gate policy (owner directive, 2026-09-21 — overrides everything ever written about "run gates"):**

1. **NEVER run gates, lints, checks, tests, builds, browser suites, or ANY verification
   command on your own.** Not for small changes, not for large updates, not "just to be safe".
   No `npm run lint`, no `npm run check`, no `npm run test`, no `npm run build:css`,
   no `npm run visual`, no verification scripts of any kind — unless the owner explicitly
   tells you to run them ("run the gates", "run checks", "verify", "test it", …).
2. **Ask after every meaningful update — always, once, in plain words:** when a fix/change
   is done, the agent reports what changed and then asks: *"Update done — want me to run
   the gate passes / tests to verify, or leave it?"* Then it **waits for the answer**.
   This reminder is mandatory and may not be skipped or folded into other text.
3. When the owner says yes, **ALL** of the following must pass before push:

```bash
npm ci                      # first time
npm run lint                # eslint — 0 errors (warnings ≤ 30 acceptable)
npm run check               # acorn syntax check of every JS file
npm run build:css           # rebuild Tailwind after any CSS/config/markup class change
git diff --exit-code -- dist/output.css   # stale CSS = fail; commit the rebuild
npm run test                # security tests + jsdom smoke + interaction test
```

`tools/interaction-test.js` clicks every shell control in jsdom and asserts the visible effect — if you broke a toggle, this is where it shows. Add a case there for every new interactive element you build.

> **Note:** the pre-commit hook still runs `npm run check` + `npm run lint` automatically on every
> commit (repo mechanism, not agent choice). If the owner ever wants even that removed, say so
> and the agent will take the hook out of `.githooks/`.


---

## 4. Skills available in-repo (use them)

- `.agents/skills/` — Emil Kowalski's craft library: `animate`, `review-animations`, `improve-animations`, `emil-design-eng`, `apple-design`, `animation-vocabulary`, `pick-ui-library`, `ask-sonner`, `prototype`, `find-animation-opportunities`
- `.claude/skills/` — `taste-skill` (anti-slop UI process), `web-design-guidelines` (a11y/UX audit), `image-to-code`, `awesome-design/references/claude/DESIGN.md` (the design tokens this app implements), `playwright-cli` (browser automation for verification)

For PHASE A: debugging discipline matters more than design skills.
For PHASE D: load `emil-design-eng` + `animate` + `taste-skill` before writing UI.

---

## 5. Hard rules

0. **Commands: write-only — NO self-initiated runs.** When the owner asks to fix or change
   a file/code, the agent does **exactly that and nothing else**. Commands may be used **only**
   to write, read, copy, check, or move files and code (editing, creating, copying, listing,
   `git add`/`commit`/`push`). The agent must **never** run verification of any kind on its own —
   no tests, no lints, no builds, no checks, no browser suites, and no `git` probing to "confirm"
   (no `git log`/`diff`/`ls-remote` fishing, no fetching just to look). **Only the owner may say
   "run / verify / test / pass"** — and only then does the agent run those commands.

1. **Do not rewrite the app shell or migrate frameworks.** Vanilla ES modules is a settled decision (`docs/UI-COMPONENTS-ROADMAP.md` documents why and its revisit-triggers).
2. **Do not modify backend security hardening** (`api/chat.js`, `server.js`, `lib/chat-security.js`, `vercel.json`, `firestore.rules`) without owner sign-off.
3. **Behavior changes need a failing test or a real-browser repro first.** No speculative refactors.
4. **A11y is not optional:** every icon button has `aria-label`, focus-visible works, motion uses the `--ease-*` tokens at ≤300 ms, reduced-motion respected.
5. Commit messages explain *why*, not just *what*.
6. If blocked or the repro won't reproduce, add diagnostics (like `#diag`) rather than guessing — and say so in your report.

---

---

## 6. Images / screenshots → project folder (mandatory)

Any image the agent produces — browser screenshots, QA captures, crops, generated
icons/mockups — must ALSO be saved to `D:\projects\abot\artifacts\` (in addition to
any temp working dir on C:). Keep file names descriptive (e.g. `final-light-desktop.png`).
Never leave a capture only in temp — if you snapped it, the project folder gets a copy.

---

*Prepared 2026-08-30 · Updated 2026-09-20 · Commit log: `docs/commits.md`*
