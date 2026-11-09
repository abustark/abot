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

**Package manager: `bun` (owner directive, 2026-11-08).** Use `bun` instead of `npm`/`npx` for everything: `bun install`, `bun run <script>`, `bunx <pkg>`. Bun is installed at `C:\Users\abu\.bun\bin\bun.exe` (v1.4.4). Notes:
- `bun run <script>` is the drop-in for `npm run <script>` — every `package.json` script keeps working unchanged.
- `node <file>` is still correct for direct script runs (the gate scripts are plain Node).
- `.githooks/pre-commit` prefers `bun` and falls back to `npm` when bun is absent, so the hook stays portable.
- Do **not** introduce `bun.lock` alongside `package-lock.json` without agreeing on one lockfile with the owner first — two lockfiles is a real drift risk.

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
   - **Keep the `📌 Next version` line at the top of `docs/COMMIT-HISTORY.md` current** so no session has to guess.
   - Every commit must also be logged in `docs/COMMIT-HISTORY.md` with its version and what it did.
   - **The version number is enforced, not remembered (2.6.10).** `.githooks/pre-commit` runs
     `tools/sync-version.js --from-history` **before** the checks: it takes the newest
     `### <version> - …` entry from `docs/COMMIT-HISTORY.md`, writes `APP_VERSION` in
     `js/config.js` (the single value the UI prints), advances the `📌 Next version` line
     using the roll-over rule above, and stages the files it rewrote. `.githooks/commit-msg` then
     **aborts the commit** when the subject's version disagrees with `APP_VERSION` — i.e.
     when the history entry is missing. So the order is: write the history entry →
     `git add` → `git commit -m "<version> - …"`. A subject without a version (merge
     commits) is skipped, and the sync can be re-run by hand:
     `node tools/sync-version.js 2.6.10`.
3. **Arena Synchronization (`arena/01a03fe9-abot`)**:
   - **⚠️ BEFORE ANY MIRROR, READ [§1b SYNC SAFETY](#1b-sync-safety--read-before-any-mirror-mandatory).**
     An Arena.ai session works only on arena and may hold unpushed commits there.
   - **🚫 NO AUTOMATIC MIRRORING (owner directive, 2026-11-08).** Agents **must not** run
     `git push origin main:arena/01a03fe9-abot` on their own, ever — not after a commit, not
     "to keep them in sync", not at the end of a session. Mirroring happens **only when the
     owner explicitly asks for it in chat** ("sync arena", "mirror to arena", "update arena").
     Between those orders arena is expected to lag behind `main` — that is the intended state,
     not drift to be corrected. When the owner does ask, mirror only the files/code involved
     with a **plain fast-forward push**: `git push origin main:arena/01a03fe9-abot`
     (owner directive, 2026-10-22: force-push happens only when the owner explicitly asks for
     it in chat). If the push is rejected, arena is ahead → merge it into `main` first (§1b.2).
     **Exception:** while an Arena session holds unpushed commits, arena legitimately leads —
     merge it into `main` first (§1b.2), then (if asked) mirror.
   - **`docs/updates.md`**: Exists **only on the `arena` branch** (never commit to `main`). It is updated only after major updates (not for every small commit) and documents the contrast between the old workflow and the updated workflow.
   - **`docs/PROJECT-INFO.md`**: **`main`-only — must NOT exist on `arena`** (owner directive, 2026-11-08). It is the AI fact sheet: the current state of the project, written so an AI can generate resume/portfolio copy **without reading the code**. Rules:
     - It holds **only current facts** (latest stack, architecture, instructions, metrics) and **never changelog narration** — "was X, now Y", "previously", "this release removed…" belong in `docs/COMMIT-HISTORY.md`.
     - It is **removed from the arena branch** and must stay removed. It was deleted there in `2.8.6`; because it is tracked on `main`, a future mirror would silently restore it on arena.
     - **Every agent must check before any arena sync:**
       ```bash
       git cat-file -e origin/arena/01a03fe9-abot:docs/PROJECT-INFO.md && echo "PRESENT — remove it before/after syncing"
       ```
       If it is present on arena, delete it from arena's tree in a follow-up arena-side commit so it does not remain. Never mirror it into arena deliberately.
4. **Secrets**: Never commit secrets (`.env`, `service-account-key.json` are gitignored — keep them that way).

---

## 1b. SYNC SAFETY — read before ANY mirror (mandatory)

> **The failure this prevents:** `main` is the source of truth and `arena/01a03fe9-abot`
> is normally a plain mirror. But an **Arena.ai coding session** works *only* on
> `arena/01a03fe9-abot` (its branch is fixed by the platform) and pushes its work
> there. If any agent then **overwrites** main over arena **without checking**,
> that session's commits are destroyed — silently, with no reflog recovery on the
> remote. Mirrors are **fast-forward only**; force-push never happens on its own
> (owner directive, 2026-10-22) — only when the owner explicitly says so in chat.
>
> **Mirroring is ON DEMAND ONLY (owner directive, 2026-11-08).** Nothing in this
> section authorises an agent to mirror on its own. Sections 1b.1–1b.3 describe
> *how* to mirror safely **once the owner has asked**; they are not a standing
> instruction to do it.

### 1b.1 The pre-mirror check (ALWAYS run first)

```bash
git fetch origin
git log --oneline origin/main..origin/arena/01a03fe9-abot
```

- **Output is EMPTY** → arena has no commits of its own → mirroring is safe.
- **Output lists ANY commits** → **arena is AHEAD. DO NOT push the mirror.** Merge first (1b.2).

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
again and the mirror is a clean fast-forward.

### 1b.3 The mirror command (fast-forward only)

```bash
git push origin main:arena/01a03fe9-abot
```

This push **fails safely**: if arena is ahead, git rejects it with
`non-fast-forward` instead of overwriting. That rejection is the signal to merge
arena into main first (§1b.2). **Do not add `--force`** — a force-push happens
only when the owner explicitly asks for it in chat.

### 1b.4 Rules for Arena sessions (the other direction)

An agent working inside an **Arena.ai session** is pinned to `arena/01a03fe9-abot`
and pushes its work there. Per the 2026-11-08 directive it does **not** mirror into
`main` on its own either — it reports what it needs and waits for the owner. When
the owner asks, bring arena's work into `main` with a **fast-forward push**, not a
force-push:

```bash
git fetch origin
git push origin arena/01a03fe9-abot:main
```

If another agent committed to `main` meanwhile, this is rejected; the arena session
must merge `main` first:

```bash
git merge origin/main    # on the arena branch, resolve, commit
# then retry the push above
```

### 1b.5 Hard rules (summary)

1. `main` is the single source of truth for released work. Arena is a mirror **except**
   while an Arena session holds unpushed commits there.
2. **Mirroring is on demand only** — never push `main:arena` unless the owner asked
   in chat (owner directive, 2026-11-08). Arena lagging behind `main` is normal.
3. **Never** force-push — not `main`, not `main:arena`. The mirror is always a plain
   fast-forward push; a rejection means arena is ahead → merge first (§1b.2).
4. The **only** exception: the owner explicitly asks for a force-push **in chat**
   (owner directive, 2026-10-22). Even then, create a backup tag of the current tip
   first and use `--force-with-lease`.
5. If you are unsure whether arena is ahead, **stop and ask the owner.** A refused
   push costs seconds; a destroyed feature costs a session.
6. Any agent that finds arena ahead of main must report it in its response
   ("arena was ahead by N commits; merged into main before mirroring").
7. `docs/PROJECT-INFO.md` must never exist on `arena` — check with
   `git cat-file -e origin/arena/01a03fe9-abot:docs/PROJECT-INFO.md` before and after
   any arena sync, and remove it from arena if present.

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
   **When asking, always name WHICH checks would run and split them into fast vs. slow**
   (see §3.0 below) so the owner can approve part of the set. **Copy this template — do not
   paraphrase it:**

   ```
   **FAST** (seconds, no browser): <exact commands, e.g. bun run lint, bun run check>
   **SLOW** (Chrome + screenshots, minutes, token-heavy): <exact commands, or "none proposed">

   <one line: is the fast set enough for this change? yes/no + why>
   Which — fast only, fast + SLOW, or none?
   ```

   Never ask a vague "run the gates?". Never ask the post-update question **without** both
   FAST and SLOW lines present — writing "none proposed" for SLOW is required, not optional.

### 3.0 Fast vs. slow checks — ALWAYS disclose this when asking (owner directive, 2026-11-09)

The owner budgets tokens and time. **Never bundle a slow visual check into a vague "tests?"**
request. Always state the split explicitly:

**FAST — no browser, no server, no screenshots (seconds):**

| Command | What it does |
|---|---|
| `bun run lint` | ESLint — static analysis of JS files |
| `bun run check` | acorn parse of every JS file |
| `bun run typecheck` | `tsc` check-only (JSDoc types) |
| `bun run test:html` | html-validate on `index.html` |
| `bun run test` | the four Node/jsdom suites via `tools/test-runner.js` (security · smoke · interaction · cycle) — no real browser |

**SLOW — launches a real browser, renders pages, writes screenshots, needs `node server.js`
on :3000 (minutes, heavy on tokens because output is large):**

| Command | Why it is slow |
|---|---|
| `bun run ui:audit` | Real Chrome, **desktop + mobile**, 11 groups, screenshots |
| `bun run test:security` | Needs the server running; live HTTP header + endpoint probes |
| `bun run visual:local` | Real Chrome, screenshot capture/compare per viewport and theme |
| `bun run build:css` + `git diff --exit-code -- dist/output.css` | Tailwind rebuild (not visual, but slow) — **standing approval, see below** |

**✅ Standing approval: `build:css` on every "commit and push" (owner directive, 2026-11-09).**
When the owner says *"commit and push"* (or any equivalent hand-off instruction), the agent **must**
run `bun run build:css` first, without asking and without a separate permission prompt, then commit
the rebuilt `dist/output.css`. Rationale: `dist/` is committed, so a stale build means the change
is not live — and CI fails the push. This is a **build step, not a verification step**: it does not
render, screenshot, or launch a browser, which is why it is carved out of the approval rule below.
The `git diff --exit-code -- dist/output.css` half remains part of the gate suite when the owner
does trigger gates. **Nothing else is covered by this carve-out.**

**Rules for the agent:**
- Every "want me to verify?" question **must** list the exact commands and mark each FAST or SLOW.
- **Never run a SLOW check without explicit approval for that specific check.** "Yes, verify" after a FAST-only
  offer does **not** authorise `ui:audit`, `test:security` or `visual:local`.
- `build:css` is **excepted**: it runs automatically on every commit-and-push instruction.
- If the owner approves FAST only, say plainly what remains unverified (e.g. "touch-target sizes and
  stacking are NOT covered by the fast set").
- Do not repeat a slow check the owner already declined in the same session.

3. When the owner says yes, **ALL** of the following must pass before push:

```bash
bun install                 # first time (replaces `npm ci`)
bun run lint                # eslint — 0 errors (warnings ≤ 30 acceptable)
bun run check               # acorn syntax check of every JS file
bun run typecheck           # tsc -p jsconfig.json (check-only) — 0 errors
bun run build:css           # rebuild Tailwind after any CSS/config/markup class change
git diff --exit-code -- dist/output.css   # stale CSS = fail; commit the rebuild
bun run test                # all four suites via tools/test-runner.js (security · smoke · interaction · cycle)
bun run test:html           # html-validate on index.html — hard fail
bun run test:security       # python tools/test-security.py — headers + endpoint auth (needs `node server.js` on :3000)
bun run ui:audit            # tools/ui-audit.js — 11 hard-fail groups, desktop + mobile (needs `node server.js` on :3000)
```

> **Package manager:** `bun` (see §0). `npm ci` → `bun install`; `npm run X` → `bun run X`;
> `npx X` → `bunx X`. The scripts themselves are unchanged.

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
10. **Two strikes, then stop.** If an approach fails twice for any reason — a tool won't run, a
    script errors, a command behaves unexpectedly — **stop and ask the owner** before a third
    attempt, stating what failed and what you would try next. Do not patch a scratch tool more
    than twice; the cost of one question is a message, the cost of thrashing is the owner's budget.
    **Before building any custom script** for testing, rendering, screenshotting or verification,
    check whether the repo already has a tool for it (`tools/`, `package.json` scripts) and use
    that first — `tools/visual-check.js`, `tools/ui-audit.js`, `tools/interaction-test.js`,
    `tools/smoke-node.js` already mock Firebase and drive a real browser.
    (Owner directive, 2026-11-08 — after a session spent rebuilding this tooling by hand.)

---

---

## 6. Images / screenshots — agent reference only (owner directive, 2026-10-17)

Screenshots/images the agent captures (browser checks, QA crops, generated
icons/mockups) are for the agent's own inspection during the session only.
**Do NOT copy them into `artifacts/`, do NOT commit them, do NOT upload them
anywhere** — to save time. `docs/audits/*.png` stay gitignored and local-only;
keep `artifacts/` from accumulating new captures.

---

*Prepared 2026-08-30 · Updated 2026-10-17 · Commit log: `docs/COMMIT-HISTORY.md`*
