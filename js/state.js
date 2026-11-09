/**
 * ABot — state.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 */

// Shared mutable state — the closure variables of the original main(),
// preserved under a single exported object. initFirebase() assigns auth/db.
/** @type {AppState} */
export const state = {
  chats: {},
  activeChatId: null,
  abortController: null,
  guestSessionMessageCount: 0,
  isAppInitialized: false,

  titleAnimationInterval: null,
  tokenClient: undefined,
  auth: null, // assigned by initFirebase()
  db: null, // assigned by initFirebase()
  isStreaming: false, // an assistant reply is being generated (drives stop state + jump-to-latest pill)
  webSearchEnabled: false, // per-message chip; reset after each send
  thinkingEnabled: false, // per-message chip; only for thinking-capable models
};
