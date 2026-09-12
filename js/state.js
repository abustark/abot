/**
 * ABot — state.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

// Shared mutable state — the closure variables of the original main(),
// preserved under a single exported object. initFirebase() assigns auth/db.
export const state = {
  chats: {},
  activeChatId: null,
  abortController: null,
  guestSessionMessageCount: 0,
  isAppInitialized: false,
  vantaEffect: null,
  recognition: undefined,
  titleAnimationInterval: null,
  tokenClient: undefined,
  auth: null, // assigned by initFirebase()
  db: null, // assigned by initFirebase()
  toastTimeout: null, // auto-dismiss timer (skills-audit: no double-hide race)
};
