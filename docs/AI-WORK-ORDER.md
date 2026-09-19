# ABot AI Work Order

This is the canonical handoff file for every AI agent working on ABot.
Read this after `AGENTS.md` and `docs/UI-IDEAS-FREEBUFF.md`, before fixing bugs,
changing UI, changing auth/security, or adding features.

Owner directive: work from LOW difficulty upward. Complete LOW work first. Do
not start MEDIUM or HARD work without explicit owner approval.

## Current Baseline

- `npm run check` passes: all JS parses cleanly.
- `npm run lint` passes with 0 errors and 0 warnings.
- `npm run test` passes: security, smoke, and interaction tests (73/73) are green.
- `npm audit --omit=dev` passes with 0 production vulnerabilities.
- L1–L4, M1–M4, and H1 completed.
- H2 removed by owner directive.

## Ground Rules

- Keep vanilla JS. Do not migrate frameworks.
- Do not add always-on AI API calls; all providers are free-tier.
- Do not touch backend security files unless the task explicitly calls for it:
  `api/chat.js`, `server.js`, `lib/chat-security.js`, `vercel.json`,
  `firestore.rules`.
- Any interactive UI change needs an interaction test in `tools/interaction-test.js`.
- Any CSS or markup class change requires `npm.cmd run build:css` and a committed
  `dist/output.css`.
- Use design tokens only. Do not hardcode raw hex colors in markup or JS.
- Before finishing any task, run the focused test plus the full gate set when
  the change touches shared behavior.

## Work Order

### LOW Difficulty - Do First

#### L1 - Replace direct auth status color with token-safe styling

The reset-password success path in `js/auth.js` writes a raw green color into
`dom.errorMessage.style.color`. Replace this with existing token/CSS classes or
a small semantic helper so auth messages do not depend on hardcoded color.

Acceptance criteria:
- No raw success color is written from `js/auth.js`.
- Error and success auth messages remain visually distinct.
- `npm.cmd run check` and `npm.cmd run lint` pass.

#### L2 - Clean obvious lint warnings without behavior changes

Fix only unused variables/imports that are mechanically safe. Do not refactor.
Keep this below the risk line: no control-flow changes, no API changes.

Acceptance criteria:
- Warning count decreases from 26.
- No lint errors are introduced.
- `npm.cmd run check`, `npm.cmd run lint`, and `npm.cmd run test` pass.

#### L3 - Tighten stale documentation and references

Keep this file as the source of truth. Remove or update stale references to
finished phase plans and old audits so future agents do not follow outdated work.

Acceptance criteria:
- Agents are pointed to this file for current audit/findings/work order.
- Removed docs are not referenced by live docs.
- `rg` finds no references to deleted plan/audit filenames.

#### L4 - CSP cleanup plan-only check

Confirm whether `cdn.jsdelivr.net` and `cdnjs.cloudflare.com` are still unused in
both local and Vercel CSP. Do not change CSP yet unless the owner approves backend
security edits.

Acceptance criteria:
- Record exact lines that still allow unused CDN script origins.
- Verify no current script tag depends on those domains.
- Stop before editing `server.js` or `vercel.json`.

### STOP: Owner Approval Required Before MEDIUM

After LOW items are complete, report:
- files touched,
- gates run,
- remaining warnings,
- any risk found during the LOW pass.

Do not continue to MEDIUM until the owner explicitly says to proceed.

### MEDIUM Difficulty - Requires Approval

#### M1 - Email verification for signup and login

Add Firebase email verification to the email/password account flow.

Expected behavior:
- Signup creates the user, sends a verification email, and shows a clear
  "check your email" state.
- Unverified email/password users cannot enter the app.
- Login for an unverified user shows a resend-verification option.
- Guest and Google sign-in continue to work.

Likely files:
- `js/auth.js`
- `index.html`
- `tools/interaction-test.js`
- possibly `src/input.css` and `dist/output.css`

Verification:
- Existing auth flows still pass.
- New interaction tests cover unverified login/resend UI.
- Real-browser signup check confirms Firebase sends the verification email.

#### M2 - Chat-name XSS hardening

Stop interpolating chat names into `innerHTML`. Render chat names and rename
input values through DOM APIs or escaped attributes.

Known risky spots:
- `js/chat.js` delete modal body.
- `js/chat.js` sidebar chat row template.

Verification:
- A chat name like `<img src=x onerror=alert(1)>` renders as text.
- Rename, delete, export, and search still work.
- Add focused tests for malicious chat names.

#### M3 - Markdown output sanitization

AI output is rendered with `marked.parse()`. Add a sanitization step or a safe
renderer policy before inserting model output into the DOM.

Verification:
- Markdown still supports code blocks, lists, links, and inline formatting.
- Script tags, event handlers, javascript URLs, and unsafe HTML are removed.
- Streaming and historical message rendering both use the same safe path.

#### M4 - Dependency audit remediation

Update vulnerable production dependencies in small commits. Start with
non-breaking updates. Do not run `npm audit fix --force` automatically.

Priority:
- `express-rate-limit`
- `express` / `body-parser` / `qs` / `path-to-regexp`
- `firebase-admin` and Google Cloud transitive advisories
- `protobufjs`, `fast-xml-parser`, `websocket-driver`

Verification:
- `npm audit --omit=dev` improves or passes.
- Firebase Admin token verification still works.
- `npm.cmd run test` passes.

### HARD Difficulty

#### H1 - Backend-enforced verified-email policy [COMPLETED]

Enforced unverified email/password blocking in `api/chat.js` and `server.js` via
shared `verifyUserEmailStatus` in `lib/chat-security.js`.
- Password auth requires `email_verified: true` (returns 403 otherwise).
- Google and anonymous guest sign-ins remain allowed.
- Tested via unit assertions in `tests/chat-security.test.js`.

#### H2 - Account deletion and data export [REMOVED]

Explicitly cancelled and removed by owner directive (2026-09-19).
No account deletion or Firestore data purge will be implemented.

#### H3 - Feature expansion after security fixes

Only after auth and XSS hardening:
- pinned/favorite chats,
- folders or tags,
- better search filters,
- import preview,
- per-chat default model/system prompt,
- improved exports,
- local drafts per chat.

None of these may add always-on AI calls.

## Verification Gates

Use these before reporting completion:

```bash
npm.cmd run lint
npm.cmd run check
npm.cmd run test
npm audit --omit=dev
```

Run this after CSS/config/markup class changes:

```bash
npm.cmd run build:css
git diff --exit-code -- dist/output.css
```

Real-browser checks for auth/security/UI work:
- `/#reset`
- guest sign-in
- email signup and login path
- chat send/stream
- sidebar
- model selector
- settings/account menu
- search
- export menu
- sign-out confirm

