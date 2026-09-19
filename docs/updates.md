# ABot Arena Major Updates Log

> **Note**: This file exists **only on the `arena/01a03fe9-abot` branch** to track major releases and contrast the **old workflow vs. the updated workflow**. It is updated only after major milestones, not for minor commits.

---

## Update: v2.0.7 Mobile Stability & Header Cleanup (2026-09-20)

### 1. Critical: Mobile "frozen after first login"
* **Old Workflow**: `#app-loader` (fixed, z-50) was removed only by a 300 ms `setTimeout`.
  When mobile browsers throttled/dropped that timer during page transitions, an
  invisible full-screen layer kept intercepting every real tap — forcing a refresh.
* **Updated Workflow**: `hideAppLoader()` now sets `pointer-events:none` + `visibility:hidden`
  *immediately*, and clears `display:none` via `transitionend` with a timer fallback.
  The loader can never trap taps again.

### 2. Mobile search close button was unreachable
* **Old Workflow**: `#searchPanel` was `position:static` with no z-index; on narrow screens the
  fixed composer dock (z-10) and jump-to-latest pill (z-20) overlapped and covered
  the close "X", so taps never landed. Worked on PC (composer is in-flow there).
* **Updated Workflow**: search is now a proper sheet — `#searchPanel` is `relative z-40`
  (a fixed top bar below 768px) with a `z-30` `#searchBackdrop` for tap-outside-to-close.

### 3. Google sign-in dead on first mobile tap
* **Old Workflow**: the GSI client (`async defer`) often hadn't loaded when `onAuthStateChanged`
  ran, so `google.accounts.id.initialize` was skipped and the button did nothing.
* **Updated Workflow**: initialization is retried for ~6 s instead of silently skipped.

### 4. PC header declutter (Option A)
* **Old Workflow**: a row of five mismatched ghost icons + barely-visible dividers; the model
  pill was the loudest element; no clear primary action.
* **Updated Workflow**: slimmer `h-12` bar with a hairline border, quieter model pill, and
  search/prompt/theme collapsed into a single `⋯` overflow menu. Original element IDs
  preserved inside the menu so wiring and interaction tests stay intact.

### 5. Misc
* Search inputs switched to `type="text" inputmode="search"` so iOS's native clear-x
  no longer swallows the first tap.
* Interaction tests added for the search backdrop and the overflow menu.

> Note: landed on `main` (commit `828a54a`), merged into arena. Quality gates deferred per owner instruction.

---

## Major Update: v2.0.0 Architecture & Security Overhaul (2026-09-19)

### 1. Workflow Comparison: Old vs. Updated

#### A. Branch & Contribution Discipline
* **Old Workflow**:
  - Work was split into separate side branches (e.g. `audit/ui-ux-fixes`, `fix/tap-blocking`), often requiring complex rebasing and multi-step branch tracking.
  - Agents operated on various integration branches without a unified commit sequence or log.
* **Updated Workflow**:
  - Development is strictly anchored on **`main`**.
  - All features, fixes, and gates are executed and pushed directly to `main`.
  - `main` is merged into `arena/01a03fe9-abot` to maintain parity.
  - Commits strictly use standard version numbering: `2.0.1`–`2.0.10` rolling over to `2.1.0` (with short descriptions), all tracked in `docs/commits.md`.

#### B. Authentication & Email Verification
* **Old Workflow**:
  - Email/password accounts could be created without email verification and immediately access the app.
  - Backend endpoints (`api/chat.js` and `server.js`) did not verify the email verification state of Firebase ID tokens.
* **Updated Workflow**:
  - Email/password signup requires email verification before entering the app (`#verify-email-view`).
  - Backend enforces `email_verified: true` for `password` provider accounts; unverified requests return `403 Forbidden` with a clean error message.
  - Google and guest sign-ins continue to work seamlessly.

#### C. Input/Output Hardening & Markdown Sanitization
* **Old Workflow**:
  - Raw HTML strings and chat names could potentially trigger XSS in sidebar rendering and delete confirmation dialogs.
  - Model responses were parsed via `marked.parse` directly into innerHTML without universal sanitization.
* **Updated Workflow**:
  - Chat names are constructed with safe DOM APIs (`textContent`).
  - `renderSafeMarkdown` uses a dedicated DOM-based `sanitizeHtml` parser that strips script tags, event handlers (`onerror`, `onclick`), and unsafe URL protocols (`javascript:`).

#### D. Performance, Scripts & CSP
* **Old Workflow**:
  - Auth backdrop relied on external CDN scripts (`three.js` + `vanta.net`), adding hundreds of KB and CDN vulnerabilities.
  - CSP permitted external CDNs (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`).
* **Updated Workflow**:
  - Auth backdrop is 100% pure CSS aurora animation (zero JavaScript footprint).
  - All CDN scripts removed from CSP in both `vercel.json` and `server.js`.
  - Content measure comfortably locked to `max-w-3xl` (~48rem) for Claude-level reading calm.
