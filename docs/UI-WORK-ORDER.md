# UI WORK ORDER — composer density, prompt library, code-block polish

> **For:** an executor agent (OpenCode or any harness).
> **From:** audit by DeepSeek Harness, 2026-11-08.
> **Repo:** `D:\projects\abot` · branch `main` · package manager **bun**.
> **Status:** revised after `bun run ui:audit` (the repo's own real-browser
> audit) returned **0 failures**. The audit disproved one suspected bug and
> cleared another, so this order is smaller than its first draft:
>
> | Task | Status |
> |---|---|
> | 1. Composer density | **Do this** — measured 389px dock, no audit coverage |
> | 2. Code blocks | **Cosmetic only** — overflow bug disproved (G06 passes) |
> | 3. Prompt library | **Do this** — code-level finding |
> | 4. Contrast | **DROPPED** — findings were auth-page only, which is frozen |
> | 5. Text floor | **Probably a no-op** — check scope before editing |
> | 6. Optional | Needs owner approval |
>
> **The auth page is frozen.** Owner directive 2026-11-08: leave it alone.

---

## Ground rules for the executor

1. **Read `AGENTS.md` first.** It governs versioning, gates, and branch discipline.
2. **Do not push to `arena`.** Mirroring is on-demand only.
3. **One version number per batch.** Write the `docs/COMMIT-HISTORY.md` entry
   first, then `git add`, then commit with `<version> - <description>`.
4. **After ANY change under `src/`, `tailwind.config.js`, or markup classes:**
   ```bash
   bun run build:css
   git diff --exit-code -- dist/output.css   # must be clean after committing the rebuild
   ```
   A stale `dist/output.css` has shipped broken CSS to production in this repo
   before (see `COMMIT-HISTORY` 2.7.5).
5. **Bump the service-worker cache** if you touch CSS or JS:
   `service-worker.js` `CACHE_NAME` → next `abot-cache-vNN`.
6. **If a gate cannot run in your environment, say so in your report.**
   Do not claim "tests pass" without running them (AGENTS.md §0).
7. **Stop and ask after two failed attempts** (AGENTS.md §5 rule 10).

---

## Task 1 — Composer density (P0, owner's #1 complaint)

### Measured facts

| Element | Current | Where |
|---|---|---|
| `#composerDock` total height | **389px** desktop / **391px** mobile | measured in Chrome 1440×900 / 390×844 |
| Composer box | 113px | `index.html:634-635` |
| Empty textarea | **56px** (`min-h-[56px]`) | `index.html:637` |
| Action row | 44px button | `index.html:664` |
| Disclaimer | 17px + 12px margin | `index.html:714-716` |

The owner reports the whole chat surface feels **bulky at 100% zoom** and had to
zoom out to screenshot it. The empty textarea is the largest single contributor.

### Changes

**1a. Textarea resting height** — `index.html:637`
```
min-h-[56px]  →  min-h-[44px]
```
44px is the minimum comfortable touch target and matches the send button.
Keep `max-h-[40vh]` (growing behaviour is correct and tested by
`tools/interaction-test.js`).

**1b. Remove the disclaimer from the dock** — `index.html:714-716`
Delete the `<div class="items-center justify-center mt-3 hidden md:flex">…</div>`
block entirely. It costs ~29px (17px text + 12px margin), is desktop-only, is
11px text flagged by the a11y detector, and duplicates a statement every chat
product already puts in the empty state.
**Do not** move it above the composer — that relocates the cost instead of
removing it. If the owner later wants it back, it belongs in the empty-state
block (`#emptyWelcome`), not the persistent dock.

**1c. Send button — pointer density only** — `index.html:664`
Keep `44px` on touch. Add a desktop refinement **without breaking the tap target**:
```
w-[44px] h-[44px]  →  w-9 h-9 md:w-9 md:h-9    (36px)
```
⚠️ **`#stopBtn` must stay exactly co-located** (`index.html:674-676` uses
`absolute inset-0` and is asserted by `tools/visual-check.js` B-35: "stop
overlays send slot exactly"). If you change the send size you **must** assert
this still passes.

**1d. Reduce vertical padding** — `index.html:629` and `:635`
- Dock `pt-3` → `pt-2`
- Composer box `py-1.5` → `py-1`
Net: ~12px.

### Acceptance

- Composer dock measured height **≤ 320px** on desktop (down from 389px)
- Textarea still grows to `max-h-[40vh]` when typing multiple lines
- `tools/visual-check.js` B-35 (stop-overlays-send) **still passes**
- `tools/interaction-test.js` full-shell suite passes
- No horizontal overflow at 390px
- Screenshot at 1440×900 and 390×844, light **and** dark

---

## Task 2 — Code-block polish, cosmetic only (P2)

### Facts

`src/input.css:1041-1081` defines `.prose pre`, `.code-block-header`,
`.copy-code-btn`. Current:
- `--c-code-bg: #1c1916` — intentionally dark in both themes
- header lang label: `0.7rem` **uppercase**, `letter-spacing 0.05em`
- copy button: `11px` (a11y-detector: undersized)

**⛔ The horizontal-overflow bug does NOT exist — do not "fix" it.**
`bun run ui:audit` (2026-11-08) ran a real reply containing an inline `code`
span, a fenced ```js``` block and a 140-character unbroken URL, and **G06
overflow passed on desktop and mobile** (`proseContained: true`,
`overflow=0px`). An earlier page-level measurement also returned 0.
Do **not** add `overflow-x` rules or restructure the `<pre>` — there is nothing
to fix, and changing it risks breaking a passing group.

What remains here is **cosmetic only (P2)**: the block looks plainer than it
should, not broken.

### Changes (cosmetic only)

**2b. Language label: information, not decoration**
Drop `text-transform: uppercase`, raise `font-size: 0.7rem` → `0.75rem`.
Uppercase + tiny + letterspaced reads as an ornament; the language name is
functional information.

**2c. Copy button legibility** — `src/input.css:1059-1066`
`font-size: 11px` → `12px`. It is a real control, not micro-copy.

**2d. Light-theme separation**
In light mode the dark code plate sits on a light card with no boundary. Add:
```css
.prose pre { border: 1px solid rgb(var(--c-hairline)); border-radius: 0.5rem; }
```
(Verify it does not double-border against the `.code-block-header` radius.)

### Acceptance

- **G06 overflow still passes** (this is a regression guard, not a fix)
- Language label renders sentence case at ≥0.75rem
- Copy button is ≥12px and passes contrast in both themes
- Screenshot of a conversation containing a long code block (390px + 1440px)

---

## Task 3 — Prompt library refresh (P1, portfolio credibility)

### Facts

`js/config.js:151-160` — **9 presets, unchanged for many releases**:

| Current preset | Problem |
|---|---|
| Standard Assistant | fine |
| Code Helper | fine, and the only dev-relevant one |
| **Sarcastic Pirate** | joke preset — undercuts a professional read |
| Creative Writer | fine |
| Email Assistant | fine |
| Technical Writer | fine |
| ELI5 Explainer | fine |
| Brainstorm Partner | fine |
| **Game Master** | joke preset — undercuts a professional read |

The owner is about to show this to recruiters. Two joke presets in a product
whose core is "31 models, hardened proxy" read as unfinished.

### Changes

**3a.** In `js/config.js`, **move** `Sarcastic Pirate` and `Game Master` to a
separate exported array `FUN_PROMPTS` (do not delete — they are harmless and
some users like them), and render them under a "Fun" heading inside the existing
modal.

**3b.** Add these developer-relevant presets to `SYSTEM_PROMPTS`:
```
{ title: "Code Reviewer",   prompt: "You are a senior code reviewer. Identify bugs, edge cases, security issues and maintainability problems. Reference exact lines. Be direct about what must change, and say so when the code is fine." }
{ title: "Debugger",       prompt: "You are a debugging assistant. Ask for the failing input, the expected output and the actual output before proposing a fix. Form one hypothesis at a time and state how to test it." }
{ title: "SQL Helper",     prompt: "You are a SQL expert. Write correct, readable queries for the given dialect, explain the join and index choices, and flag anything that would be slow at scale." }
{ title: "Explain Code",   prompt: "Explain the provided code top to bottom: what it does, why it is written that way, and what would break if it changed. Assume the reader is competent but unfamiliar with this file." }
```

**3c. UI** — `js/ui.js:99`, `index.html:762`
The grid is `grid-cols-3 md:grid-cols-5` with `gap-y-5` (measured `18.75px`
row gap). With 11+ presets this becomes a tall block. Change:
- `gap-y-5` → `gap-y-2`
- Keep `grid-cols-3 md:grid-cols-5`
- Section headers for "Assistant" and "Fun" with `text-[11px] uppercase
  tracking-wide text-muted` at `col-span-full`

### Acceptance

- Prompt modal shows all presets grouped, no vertical overflow at 900px height
- Clicking a preset still fills `#promptTextarea` and marks it active
- `tools/interaction-test.js` prompt-modal cases pass

---

## Task 4 — DROPPED (auth page is frozen)

The static detector reported four `low-contrast` findings, all on the **auth
page** (search placeholder 2.2:1, muted text 2.8:1 and 3.4:1, hover 4.48:1).

**Owner directive (2026-11-08): the auth page is frozen — keep it exactly as it
is.** The owner reviewed the auth page's motion and contrast together and chose
to leave the page untouched.

Independently, `bun run ui:audit` proved the **chat surface already passes WCAG
AA in both themes** — every tested pair is green (body 9.56:1 light / 13.17:1
dark, model label 4.91:1, timestamps 5.33:1, icons ≥3:1). So there is no
contrast work to do on the actual product surface.

**Do not touch `--c-muted`, `--c-coral-active`, or any auth-page token as part
of this work order.** If the owner ever unfreezes the auth page, the four
findings above are the list to revisit.

---

## Task 5 — Small text floor

Detector: `undersized-ui-text` at **10px** on "Multi-model chat" and "or use
email"; `tiny-text` at 11px.

### Change
Raise every functional 10px instance to **≥11px**. Legal/footer microprint may
stay 10px. Affected declarations in `src/input.css` around lines 631, 661,
1561, 1582 (verify before editing — line numbers drift).

⚠️ **Scope check before editing.** The two detector hits named "Multi-model
chat" and "or use email" are on the **auth page**, which is **frozen** by owner
directive (see Task 4). So:
- **Skip** any 10px instance that renders on the auth page.
- **Apply** the ≥11px floor only to the in-app chat surface (sidebar, composer,
  message meta, menus).
- If every remaining instance turns out to be on the auth page, **Task 5 is a
  no-op — report that and change nothing.**

### Acceptance
- Detector: 0 `undersized-ui-text` **on the in-app surface**
- Chat-surface layout does not reflow badly at 1440px or 390px
- Auth page byte-identical (`git diff --exit-code src/input.css` shows no
  auth-related change)

---

## Task 6 — Optional, needs owner approval

These are **not** bugs. Do not implement without explicit sign-off:

- **Density toggle** (comfortable / compact). A real product decision; doubles
  the surface to test.
- **`PRODUCT.md` / `DESIGN.md`** via `impeccable init` / `document`. Adds files
  to a repo the owner shows publicly — owner decides.

---

## Do NOT do

- **Do not touch the auth page.** Owner directive 2026-11-08: it is frozen —
  motion (the 52s/68s blooms, the 520ms entrance), contrast and text sizes are
  all approved as built. They are already exempted in `tools/ui-audit.js`.
- **Do not add `overflow-x` to code blocks.** G06 already passes; there is no
  overflow bug. Task 2 is cosmetic only.
- **Do not** change the typeface because of the `overused-font` finding.
  Plus Jakarta Sans is the owner's brief; the skill's own rule is "the brief wins".
- **Do not** run `impeccable typeset` or `impeccable bolder` — they would fight
  the established oxblood/bone design.
- **Do not** touch `api/chat.js`, `lib/chat-security.js`, `server.js`,
  `vercel.json`, `firestore.rules` (AGENTS.md §5 rule 2).
- **Do not** push to `arena`.

---

## Suggested execution order

1. **Task 1 — composer density** (the owner's main complaint, ~90px recoverable)
2. **Task 3 — prompt library** (JS only, no CSS dependency)
3. **Task 2 — code-block cosmetics** (P2, small diff)
4. **Task 5** — probably a no-op; check scope first

Rebuild CSS after Tasks 1 and 2. Task 3 is JS-only.

**Baseline to preserve:** `bun run ui:audit` currently reports **0 failures**
(the two motion exceptions are approved). Any new failure after your changes
is a regression you introduced.

---

## Reporting back

For each task, report:
- What changed (file + line)
- The acceptance check and whether you ran it
- A screenshot for anything visual
- Anything you could not verify, stated plainly
