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
   - **One version number per agent response / request batch** — not per issue, not per commit.
     A single owner request (even if it fixes many issues) consumes exactly ONE version number.
     Multiple commits inside one response are NOT allowed to each take a new number; if a follow-up
     fix is needed in the same batch, fold it into the same version's commit(s) — never burn a
     second number. Only a genuinely new owner request (a new response turn) advances the number.
   - Format: `<version> - <short description>` (e.g., `2.0.2 - auth page ui changed`). Keep it short and clear, avoid overly long commit titles.
   - **Branch independence (strict):** `main` and `arena/01a03fe9-abot` each keep their **own** version
     numbers and commit names. The same number on the two branches is NOT the same work — always compare
     **hashes**, never numbers. Never give a `main` commit a number from arena's sequence (or vice versa).
   - **Keep the `📌 Next version` line at the top of `COMMIT-HISTORY.md` current** so no session has to guess.
   - Every commit must also be logged in `COMMIT-HISTORY.md` with its version and what it did.
3. **Arena Synchronization (`arena/01a03fe9-abot`)**:
   - **⚠️ BEFORE ANY MIRROR, READ [§1b SYNC SAFETY](#1b-sync-safety--read-before-any-force-push-mandatory).**
     An Arena.ai session works only on arena and may hold unpushed commits there;
     force-pushing without the §1b.1 check destroys them.
   - After updating `main` **and passing the §1b.1 check**, mirror onto arena. Prefer the
     loss-proof fast-forward (`git push origin main:arena/01a03fe9-abot`); use
     `--force` only when §1b.1 confirmed arena is not ahead:
     `git push origin main:arena/01a03fe9-abot --force`.
     The two branches stay **identical** — `main` is the single source of truth, and arena normally
     keeps no commits of its own (the old `merge main <version> into arena/...` flow is retired).
     **Exception:** while an Arena session holds unpushed commits, arena legitimately leads —
     merge it into `main` first (§1b.2), then mirror.
   - **`docs/updates.md`**: Exists **only on the `arena` branch** (never commit to `main`). It is updated only after major updates (not for every small commit) and documents the contrast between the old workflow and the updated workflow.
4. **Secrets**: Never commit secrets (`.env`, `service-account-key.json` are gitignored — keep them that way).

---

## 1b. SYNC SAFETY — read before ANY force-push (mandatory)

> **The failure this prevents:** `main` is the source of truth and `arena/01a03fe9-abot`
> is normally a plain mirror. But an **Arena.ai coding session** works *only* on
> `arena/01a03fe9-abot` (its branch is fixed by the platform) and pushes its work
> there. If any agent then force-pushes `main` over arena **without checking**,
> that session's commits are destroyed — silently, with no reflog recovery on the
> remote. This section makes that impossible.

### 1b.1 The pre-force-push check (ALWAYS run first)

```bash
git fetch origin
git log --oneline origin/main..origin/arena/01a03fe9-abot
```

- **Output is EMPTY** → arena has no commits of its own → mirroring is safe.
- **Output lists ANY commits** → **arena is AHEAD. DO NOT force-push.** Merge first (1b.2).

Never skip this check, even when you "just pushed main" yourself — another agent
or the owner's Arena session may have committed to arena in between.

### 1b.2 When arena is ahead — merge INTO main (never the reverse)

```bash
git checkout main
git pull --ff-only origin main            # start from the current main
git merge origin/arena/01a03fe9-abot      # bring arena's commits in
# resolve conflicts, run the gates (see §3), commit the merge
git push origin main
```

Only **then** may the mirror run (1b.3) — at that point the two branches converge
again and the force-push has nothing to destroy.

### 1b.3 The mirror command (and its safe alternative)

Conventional mirror (allowed ONLY after 1b.1 shows arena is not ahead):

```bash
git push origin main:arena/01a03fe9-abot --force
```

**Preferred, loss-proof alternative** — a fast-forward push that *refuses* to run
if main has moved behind arena's back:

```bash
git push origin main:arena/01a03fe9-abot
```

Why prefer it: a plain push **fails safely**. If arena is ahead, git rejects it with
`non-fast-forward` instead of overwriting. A force-push never fails — it just deletes.
Use `--force` only immediately after verifying 1b.1 came back empty.

### 1b.4 Rules for Arena sessions (the other direction)

An agent working inside an **Arena.ai session** is pinned to `arena/01a03fe9-abot`
and should mirror its work **into main** at the end of every feature, so the two
never diverge:

```bash
git fetch origin
git push origin arena/01a03fe9-abot:main
```

This is a **fast-forward push, not a force-push** — if another agent committed to
`main` meanwhile, it is rejected, and the arena session must merge `main` first:

```bash
git merge origin/main    # on the arena branch, resolve, commit
# then retry the push above
```

### 1b.5 Hard rules (summary)

1. `main` is the single source of truth for released work. Arena is a mirror **except**
   while an Arena session holds unpushed commits there.
2. **Never** force-push `main:arena` without running 1b.1 first.
3. **Never** force-push `main` at all — it has no mirror to be restored from.
4. Prefer the plain (fast-forward) push; `--force` is the exception, not the habit.
5. If you are unsure whether arena is ahead, **stop and ask the owner.** A refused
   push costs seconds; a destroyed feature costs a session.
6. Any agent that finds arena ahead of main must report it in its response
   ("arena was ahead by N commits; merged into main before mirroring").

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
npm run typecheck           # tsc -p jsconfig.json (check-only) — 0 errors
npm run build:css           # rebuild Tailwind after any CSS/config/markup class change
git diff --exit-code -- dist/output.css   # stale CSS = fail; commit the rebuild
npm run test                # security tests + jsdom smoke + interaction test
npm run test:html           # html-validate on index.html — hard fail
npm run test:security       # python tools/test-security.py — headers + endpoint auth (needs `node server.js` on :3000)
npm run ui:audit            # tools/ui-audit.js — 11 hard-fail groups, desktop + mobile (needs `node server.js` on :3000)
```

`tools/interaction-test.js` clicks every shell control in jsdom and asserts the visible effect — if you broke a toggle, this is where it shows. Add a case there for every new interactive element you build. `tools/ui-audit.js` is the real-browser counterpart (sizes, contrast, stacking, fonts, overflow); keep both green.

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

1. **Do not rewrite the app shell or migrate frameworks.** Vanilla ES modules is a settled decision (owner, 2026-08-30) — revisit only if ABot grows multiple complex views/routes, deeply nested shared state, or a team mandate.
2. **Do not modify backend security hardening** (`api/chat.js`, `server.js`, `lib/chat-security.js`, `vercel.json`, `firestore.rules`) without owner sign-off.
3. **Behavior changes need a failing test or a real-browser repro first.** No speculative refactors.
4. **A11y is not optional:** every icon button has `aria-label`, focus-visible works, motion uses the `--ease-*` tokens at ≤300 ms, reduced-motion respected.
5. Commit messages explain *why*, not just *what*.
6. If blocked or the repro won't reproduce, add diagnostics (like `#diag`) rather than guessing — and say so in your report.
7. **Do exactly what the owner asked — invent nothing.** No "consistency" sweeps, extra doc/rule
   updates, side-commits, or cleanups around the request. If something adjacent looks wrong, say it
   in **one line** in the report; do not fix it unless told.
8. **Unsure or facing a side-decision → give the owner options, don't guess.** Offer 2–4 short
   choices and wait. Never re-decide the same thing repeatedly or debate it internally.
9. **Finish the owner's asked task first; report side-findings afterward** — never derail mid-task.
   (Owner directive, 2026-10-18.)

---

---

## 6. Images / screenshots — agent reference only (owner directive, 2026-10-17)

Screenshots/images the agent captures (browser checks, QA crops, generated
icons/mockups) are for the agent's own inspection during the session only.
**Do NOT copy them into `artifacts/`, do NOT commit them, do NOT upload them
anywhere** — to save time. `docs/audits/*.png` stay gitignored and local-only;
keep `artifacts/` from accumulating new captures.

---

*Prepared 2026-08-30 · Updated 2026-10-17 · Commit log: `COMMIT-HISTORY.md`*
