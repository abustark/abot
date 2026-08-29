# Phase 2 Execution Plan — Frontend De-monolithization

> **Goal:** Replace 4 inline `<script>` blocks (~1,700 lines of app JS) in `index.html` with real ES modules in `js/`, drop `'unsafe-inline'` from CSP — **with byte-level behavior freeze** and verification at every step.
>
> **Golden rule:** this is a *mechanical* refactor, not a rewrite. No visual or behavioral change. Every moved function must survive AST/token parity checks.

---

## 1. Ground truth (measured, not assumed)

| Fact | Evidence | Implication |
|---|---|---|
| Main app is **already one `type="module"`** (`index.html` 851–2523) | script tag scan | Strict mode + deferred exec already in effect → **no sloppy-mode hazards** on the big block |
| Entire app lives in **one `main()` closure** wired via `DOMContentLoaded` | 0 top-level declarations found | Splitting = converting closure scope → explicit imports; the only real risk of this phase |
| **193 const-arrow functions + 4 function declarations** inside `main()` | regex inventory | Large but flat surface; `dom` element registry + ~8 shared mutable state vars |
| External globals used: `marked`, `hljs`, `firebase` (compat 9.22.1), `VANTA`, `google` (GIS) | usage counts: 6/2/5/1/6 | These load as classic scripts in `<head>`/body *before* the deferred module → still available as globals after split. **No import changes needed** |
| **0 inline `onclick=` handlers**; all wiring via `addEventListener` (43 sites) | grep | CSP `script-src-attr` already effectively unused |
| `window.deleteMessage` / `window.editMessage` assigned but only called from 2 `addEventListener` closures | lines 567/610 → 775/776 | Unnecessary window indirection → become plain module functions (documented, behavior-identical) |
| 2 pre-render inline blocks: **theme flicker guard** (`<head>`, 337–347) + **SW registration** (349–358) | block reads | Theme block **must** remain inline pre-render → CSP needs its **sha256 hash**. SW block: keep + hash (module already registers SW separately — preserve both, timings unchanged) |
| 2 × `document.write(getFullYear())` footer scripts | lines 476/711 | Replace with static `<span id="footer-year">` filled by `app.js` → removes last inline app scripts |
| No `eval`/`new Function` anywhere | grep=0 | CSP can go `'self'`-only safely |
| `js/` reference modules are a **stale rewrite**, not the real code | README: "reference… NOT used" | Use only as architecture inspiration; real code extracted verbatim from `index.html` |

## 2. Target architecture

```
js/
  config.js   ← COLOR_MAP, MODEL_CONFIG, model list, DEFAULT_SYSTEM_PROMPT, GUEST_MESSAGE_LIMIT, generateColorClasses   (leaf, no deps)
  dom.js      ← element registry object + initDom()                       (leaf)
  state.js    ← shared mutable state: currentUser, activeChatId, activeModel, isGenerating, chats, auth/db handles   (leaf)
  utils.js    ← escapeHtml, sanitizeHtml, getTimestamp, showToast, voice recognition, markdown/render pipeline       (deps: dom, config*)
  ui.js       ← theme, sidebar/modals, model panel, chat-list & message renderers, applyModelColorTheme               (deps: config, dom, state, utils)
  auth.js     ← firebase init, guest/email/Google-GIS flows, onAuthStateChanged wiring, guest-limit logic             (deps: config, dom, state, utils, ui)
  chat.js     ← create/send/stream, edit/delete message, import/export, Firestore sync                                (deps: all above)
  app.js      ← entry: SW registration (existing module copy), initDom, module init calls, main() orchestration       (deps: all)
```
(Dependency arrows point one way — **no circular imports**; shared mutable values live in `state.js` as properties of a single exported object, preserving closure-like semantics.)

## 3. Steps (each with its own verification gate)

**2.0 — Tooling first** (before moving any code)
- `tools/extract-inline.js`: pulls the 4 blocks from `index.html` into normalized scratch files (source of truth; bounds: theme 338–346, SW 350–357, main module 852–2522 — *tags excluded*).
- Prereq: `npm i --no-save acorn jsdom` (sandbox `node_modules` isn't persisted; tools must stay re-runnable).
- `tools/verify-parity.js`: parses original module + all new `js/*.js` with **acorn**; for every declaration in the original, asserts a token-identical (whitespace-insensitive) twin exists in the new modules; then does an **unresolved-identifier scan** across modules + a stub map for browser globals → catches broken closure references.
- `tools/smoke-node.js`: jsdom + stubbed `firebase`/`marked`/`hljs`/`VANTA`/`google`; imports `js/app.js`, fires `DOMContentLoaded`, asserts execution reaches defined checkpoints (loader present, listeners attached, no thrown ReferenceErrors).
- ✅ Gate: tools run green on the *unsplit* code (parity of original vs itself, smoke passes with inline block stubbed).

**2.1 — Leaf modules** `config.js`, `dom.js`, `state.js`, `utils.js` — code moved verbatim, only imports/exports added.
- ✅ Gate: `node --check` each file + parity report 100% for moved units.

**2.2 — Feature modules** `ui.js` → `auth.js` → `chat.js` → `app.js` (in dependency order).
- ✅ Gate: parity report 100% across ALL 197 declarations; unresolved-identifier scan clean; smoke test green; `index.html` still untouched at this point (old code still runs).

**2.3 — Rewire `index.html`**
- Replace the big module block with `<script type="module" src="js/app.js"></script>`
- Compute **sha256 hashes** of theme + SW blocks → injected into CSP (`scriptSrc 'sha256-…'`), blocks stay inline
- `document.write` year scripts → `<span id="footer-year">` + one line in `app.js`
- Delete stale reference code in `js/README.md` + files replaced by real modules
- ✅ Gate: serve locally → HTML references `js/app.js`; smoke test against served page; diff of extracted-vs-original blocks is *exactly* the expected mechanical changeset (imports/exports/indent).

**2.4 — CSP hardening** (`server.js` helmet + `vercel.json` headers)
- `script-src`: drop `'unsafe-inline'`; keep required external hosts (jsdelivr, cdnjs, gstatic, accounts.google.com) + the two sha256 hashes
- ✅ Gate: curl headers show no `'unsafe-inline'`; page loads with zero CSP violation errors (smoke harness asserts `console` has no CSP reports)

**2.5 — Service worker** — `CACHE_NAME` v9 → **v10**; precache list += all `js/*.js`.
- ✅ Gate: SW syntax check (`node --check`); version bump forces client refresh.

**2.6 — Defense-in-depth fix (flagged in Phase 1)**
- `latestBotMessageSpan.innerHTML = friendlyError` → `createElement`/`textContent` (keeps the `<strong>` prefix via separate text nodes) — removes an XSS *sink* permanently.

**2.7 — Final verification & commit**
- Full probe suite (Phase 0 probes re-run) + smoke + parity + `node --check` everything
- Commit as **3 commits**: (a) `js/` modules + tools, (b) `index.html` rewire + CSP, (c) SW bump + XSS-sink fix — each independently revertible
- Real-browser screenshot/flow verification commands documented for your machine (sandbox has no browser — same limitation as Phase 0)

## 4. Risks & mitigations

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | Hidden closure coupling — a moved function references a variable that stayed behind | **High** (193 functions) | Unresolved-identifier scan + stub-map smoke test + parity tool. This is exactly what the tooling gate catches *before* anything ships |
| R2 | `this`-sensitivity differences | Low | Already a module (strict) → identical semantics in split files; scan for `this` at moved top level (expected: 0) |
| R3 | External-lib load order changes | Low | Classic scripts stay classic; module stays deferred. **No ordering change** |
| R4 | GIS callback (`handleCredentialResponse`) unreachable after split | Med | Stays an exported function in `auth.js`, passed to `google.accounts.id` exactly as today; smoke test stubs `google` and asserts the callback path is wired |
| R5 | Theme flicker regression | Med | Theme block stays inline, *hash-pinned* in CSP — byte-identical, so behavior identical |
| R6 | Vanta background behavior change | Low | **Phase 2 does not touch Vanta** (its init moves verbatim into `ui.js`/`app.js`); the optional-toggle work is Phase 3, separately approved |
| R7 | SW precache misses a module file → broken offline | Low | Precache list generated from `ls js/*.js` in the bump commit; smoke test asserts fetchability of every listed path |
| R8 | Firebase compat SDK expects classic-script timing | Low | SDKs stay classic scripts; only *our* code becomes modules — SDK globals untouched |

## 5. Explicitly NOT in Phase 2
- No visual/design changes (Phase 3) · no Vanta toggle (Phase 3) · no framework, no bundler, no TS (out of scope) · no CDN pinning/trimming (Phase 4)

---

## Self-review verdict (done twice, second pass after R1–R8 analysis)

**Mechanical checks run during self-review:**
- ✅ Extracted module (lines **852–2522**, excluding the script tags) **parses cleanly as an ES module** with acorn 8 — structure: `FunctionDeclaration main` (66 statements) + the `DOMContentLoaded` listener. Tooling extraction bounds confirmed.
- ✅ **R2 eliminated:** all 6 `\bthis\b` hits are inside string literals/comments — zero `this` *expressions* in the module.
- ✅ No top-level `await` (everything hangs off `main()`); acorn + jsdom install cleanly for the tooling.
- ✅ The 15 `await` hits are all function-scoped (streaming/fetch paths) — unaffected by the split.

1. ✅ The already-module discovery removes the scariest failure class (sloppy-mode/`this`/hoisting).
2. ⚠️ **Biggest real risk is R1 (closure splitting).** Accepted *because* the plan builds verification tooling BEFORE moving code, and gates every step on it. If the unresolved-identifier scan proves unreliable, fallback: keep all 197 functions in one `js/app.js` (verbatim main() body, zero split) and still achieve the phase goals — CSP drop + de-inlining — then split progressively later. **Ship-safe fallback exists at every step.**
3. ⚠️ CSP hashes must be computed on the *exact bytes* of the two retained inline blocks (including whitespace) — automated in 2.3, never hand-copied.
4. ✅ Rollback: 3 independent commits; original `index.html` untouched until 2.3; scratch-first workflow.
5. ✅ No user-visible change ⇒ the acceptance test is parity + zero console errors, not screenshots.

**Estimated scope:** ~10 files touched, 1,700 lines relocated, ~120 lines of tooling, ~0 lines of logic changed.
