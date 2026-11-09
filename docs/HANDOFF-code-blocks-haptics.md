# HANDOFF — code-block scroll + haptics scope + interaction tests

> **Read this first if you are an AI harness picking this up.**
> Written 2026-11-09 by a previous agent that ran out of budget mid-task.
> **Your job:** verify the claims marked `VERIFIED` below still hold, finish what
> is `OUTSTANDING`, then report to the owner. Do not re-do completed work.

---

## 0. TL;DR state

- **Work is UNCOMMITTED.** `main` HEAD is `2f7a407` (`2.9.9`). Pending version is **`2.10.0`**.
- **All four test suites passed** after the changes (`bun run test` → `All suites passed ✅`).
- **`bun run ui:audit` reported 0 failures** (first clean run ever, thanks to the auth-motion allowlist in `2.8.10`).
- **`dist/output.css` was rebuilt and is current** (`bun run build:css` ran after the CSS change).
- **NOT verified:** light-theme visual of the code block. The probe kept failing on a stale
  Puppeteer profile lock before the light-mode screenshot could be taken.
- **NOT done:** service-worker cache bump, `index.html` `?v=` bump, `COMMIT-HISTORY.md` entry, commit, push.

---

## 1. The three owner requests

1. **Diagnose why 4 interaction tests failed** (message action row).
2. **Code blocks: no horizontal scroll on mobile** when a line is wider than the screen.
3. **Haptics fired on every touch**; should fire **only on interactive controls**
   (buttons, toggles, send, options, new chat, settings, sign in, continue as guest).

---

## 2. Task 1 — interaction-test diagnosis (DONE, verified)

**Root cause:** the suite's fixture reply was `content: 'pong'` — **4 characters** — but
`js/chat.js` deliberately withholds the static end-of-reply action row unless the reply is
`>= END_ACTIONS_MIN_CHARS = 240` (owner rule from `2.6.0`: short replies keep copy + read-aloud
on the model header line only). The test predated that rule and was never updated, so those four
assertions could never pass. **The app was correct; the test was stale.** This was NOT a regression
from any recent work — it also fails at commit `40d6a8a`.

**Fixed in `tools/interaction-test.js`:**
- Added a shared `LONG_REPLY` constant (>240 chars) next to the `check()` helper.
- Main actions fixture now uses `LONG_REPLY` instead of `'pong'`.
- Added the **missing counterpart case**: a short reply must NOT get the end row, and keeps
  exactly one copy + one speak button.
- The streamed-reply fixture (`'Hello world'`) also became `LONG_REPLY`; its assertion now
  checks `includes('Hello')` rather than `includes('Hello world')`.
- **Haptics assertions rewritten** (see Task 3).

⚠️ **Trap already hit once:** the first attempt clicked a real `#signoutBtn` to test haptics,
which **signed the user out** and broke two later menu assertions. The probe button is now created
inside the menu element (appending to `<body>` counts as an outside click and closes the menu).

---

## 3. Task 2 — code-block horizontal scroll (DONE, verified in a real browser)

Two separate bugs, both fixed:

**(a) Structural — was already fixed and committed in `2.9.7`/`2.9.8`.**
`.code-block-header` / `.code-lang-name` existed in CSS but **nothing ever created them**;
`js/chat.js` now has `decorateCodeBlock()` + `detectLanguage()` + a 35-entry `LANGUAGE_LABELS`
map, called from **both** render paths (`appendMessage` and the streaming finaliser).

**(b) The scroll bug — THIS uncommitted change.**
```css
/* BEFORE — could never scroll */
.prose pre > code { width: max-content; min-width: 100%; overflow-x: auto; }

/* AFTER */
.prose pre > code { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto;
                    overflow-y: hidden; overscroll-behavior-x: contain;
                    -webkit-overflow-scrolling: touch; white-space: pre; tab-size: 4; }
```
`width: max-content` let the `<code>` **grow to fit its content**, so it never overflowed itself
and no scrollbar could appear — while the parent `.prose pre { overflow: hidden }` silently
clipped the line. Pinning `width: 100%` makes the inline content overflow *inside* the block,
which is what makes `overflow-x: auto` actually scroll. Also added slim scrollbar styling
(`scrollbar-width: thin`, `::-webkit-scrollbar` 8px, muted thumb) so a long line reads as
scrollable rather than cut off.

**Browser-verified measurements** (Puppeteer + real Chrome, mocked Firebase, real marked/hljs —
note `tools/ui-audit.js` stubs `window.marked`, so its G06 does NOT exercise real code blocks):

| Metric | mobile 390px | desktop 1440px |
|---|---|---|
| header rendered | ✅ | ✅ |
| language label | `JavaScript` | `JavaScript` |
| copy button | `Copy` | `Copy` |
| code clientWidth | 366 | 673 |
| code scrollWidth | **916** | **916** |
| horizontal scroll works | **✅** | **✅** |
| page horizontal overflow | **0** | **0** |
| `pre` background | `rgb(23,21,19)` dark | *(light not captured — see §6)* |

Screenshot evidence (dark, mobile) showed the ChatGPT layout: header strip with `JavaScript`
left and `Copy` right, code scrolling beneath.

---

## 4. Task 3 — haptics only on interactive elements (DONE, verified)

`js/haptics.js` previously had **one document-level click listener with no target filter** — every
tap anywhere (message text, backdrops, empty space) vibrated.

**Fixed:** added `INTERACTIVE_SELECTOR` and the listener now returns early unless the click target
is inside one of:
`button`, `a[href]`, `label`, `select`, `summary`, checkbox/radio/button/submit inputs,
`[role=button|menuitem|menuitemcheckbox|switch|tab|option|checkbox|radio|combobox|link]`,
`[tabindex]:not([tabindex="-1"])`, `[data-haptic]`.

Also guards: skip `[aria-disabled="true"]`, skip `control.disabled === true`, skip
`[data-haptic="off"]` subtrees. The 10 ms tick and 90 ms gap guard are unchanged.

**Tests added:** plain `<div>` tap does NOT vibrate · button tap vibrates exactly once ·
`aria-disabled` control does NOT vibrate.

---

## 5. Verification already run (do not need repeating)

```
bun run test      →  PASS chat-security · PASS smoke · PASS interaction · PASS cycle
                     All suites passed ✅
bun run ui:audit  →  0 UI-AUDIT FAILURE(S) — desktop + mobile
bun run build:css →  dist/output.css rebuilt; verified overflow-x / scrollbar-width present
```

---

## 6. OUTSTANDING — finish these

1. **Light-theme code block visual never captured.** Force the theme with
   `document.documentElement.classList.toggle('dark', false)` **and** `localStorage.setItem('theme','light')`
   *before* the screenshot; clicking `#sidebarThemeSwitch` did not take effect. Expected light
   values from `src/input.css`: plate `#f9f8f5`, header strip `#f2f0ec`, body text `#201d19`.
   If those do not appear, the `:root` token block near the code-block rules is not winning.
2. **Service-worker cache bump** — `service-worker.js` `CACHE_NAME` is currently `abot-cache-v88`;
   go to `v89` (CSS + JS changed). Comment should name this change.
3. **`index.html` asset version** — currently `./dist/output.css?v=p63` → `?v=p64`.
4. **`docs/COMMIT-HISTORY.md`** — write a `### 2.10.0 - …` entry **before** committing
   (`.githooks/commit-msg` aborts if the subject's version disagrees with `APP_VERSION`), and
   advance the `📌 Next version` line to `2.10.1`.
5. **Commit** as `2.10.0 - code-block scroll, haptics scope, interaction tests`, then push
   `origin main`. **Do NOT push to `arena`** — mirroring is on-demand only.
6. **Clean up** `tmp/probe.js` (gitignored scratch, safe to delete) and any stale
   `%TEMP%\puppeteer_dev_chrome_profile-*` directories; also make sure no orphan `node server.js`
   is left holding port 3000.

---

## 7. Gotchas that cost the previous agent time (read before debugging)

- **Port 3000 rate limiter**: `server.js` has an in-memory limiter. Repeated page loads return
  **HTTP 429** and the app then never boots (`#messageInput` stays hidden). Restart
  `node server.js` to reset it. A fresh server is required before any Puppeteer run.
- **Puppeteer "browser is already running"**: stale profile lock, not a real browser. Delete
  `%TEMP%\puppeteer_dev_chrome_profile-*` and retry.
- **`tools/ui-audit.js` stubs `window.marked` / `window.hljs`**, so code blocks render as plain
  text there. Its G06 overflow check therefore passes trivially and **cannot** verify this work.
  Use a probe that lets the real vendor marked/hljs load.
- **AGENTS.md §3.0**: `build:css` has standing approval on every "commit and push". Everything
  else (lint/test/ui:audit/visual) needs the owner's explicit go-ahead, and any request to verify
  must list FAST vs SLOW commands separately.

---

## 8. Files touched (uncommitted)

```
 M dist/output.css            rebuilt
 M js/haptics.js              interactive-only listener
 M src/input.css              code-block overflow fix + scrollbar styling
 M tools/interaction-test.js  LONG_REPLY fixture, short-reply case, haptics assertions
```

Already committed earlier in this thread (do not redo): `js/chat.js` header/language builder
(`2.9.7`), `dist` rebuild (`2.9.8`).
