# ABot — Frontend Modules

These are the **live application modules** (Phase 2 de-monolithization). They are loaded by
`index.html` via `<script type="module" src="js/app.js"></script>`.

> Logic is extracted verbatim from the former 1,670-line inline module — verified by
> `node tools/verify-parity.js` (token-level parity) and `node tools/smoke-node.js`
> (jsdom runtime walk of the logged-out and logged-in init paths).

## Modules (dependency order)

| File | Owns | Imports |
|---|---|---|
| `config.js` | `PROVIDER_COLORS`, `getProviderColor`, `MODEL_CONFIG`, `GUEST_MESSAGE_LIMIT`, `modelCapabilities`, `SYSTEM_PROMPTS` | — |
| `dom.js` | element registry `dom` + `initDomExtras()` | — |
| `state.js` | shared mutable `state` (chats, activeChatId, abortController, auth/db handles, …) | — |
| `utils.js` | `showToast`, `getTimestamp`, `formatRelativeTime`, `renderSafeMarkdown`, `sanitizeHtml`, `speakText`/`stopSpeaking`, `installDraftLeaveGuard` | dom, state |
| `ui.js` | theme, sidebar, prompt modals, guest-limit modals, `applyModelColorTheme` | config, dom, state, utils |
| `auth.js` | Firebase init, login/signup/guest/Google-GIS flows, `initAuth()` (`onAuthStateChanged` wiring) | config, dom, state, utils, ui, chat |
| `chat.js` | chat CRUD, message rendering/streaming (`sendMessage`), import/export, `renderChatList`/`renderActiveChat` | config, dom, state, utils, ui |
| `app.js` | entry: SW registration, init sequence (`main()`), `initApp()` listener wiring | all |

`auth/db` live on `state` and are assigned by `initFirebase()` — the same point in the
init sequence as the original closure statements (module-load evaluation would precede
`initializeApp()`).

## Tools

- `tools/extract-inline.js` — pulls the inline script blocks out of `index.html`
- `tools/build-split.js` — regenerates the modules from the extracted block (mechanical)
- `tools/verify-parity.js` — proves token-level parity with the original inline code
- `tools/smoke-node.js` — jsdom runtime smoke test with stubbed firebase/marked/hljs/Vanta

Re-run after any generator change: `node tools/build-split.js && node tools/verify-parity.js && node tools/smoke-node.js`
