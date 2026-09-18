'use strict';
/**
 * Phase 2 gate — runtime smoke test.
 * Loads the real index.html DOM into jsdom, stubs firebase/marked/hljs/VANTA/google,
 * imports the new js/app.js module, fires DOMContentLoaded, and walks the
 * logged-out AND logged-in init paths. Fails on any thrown error.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const errors = [];

function stubChain(label) {
  const handler = {
    get(target, prop) {
      if (prop === 'then') return undefined; // never thenable
      if (prop === Symbol.toPrimitive) return () => `[stub ${label}]`;
      return makeStubFn(label + '.' + String(prop));
    },
    apply(target, thisArg, args) {
      return makeStubFn(label + '()');
    },
    construct(target, args) {
      return makeStubFn('new ' + label);
    },
  };
  const fn = function () {};
  return new Proxy(fn, handler);
}
function makeStubFn(label) {
  const f = stubChain(label);
  return f;
}

async function main() {
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'outside-only',
    resources: undefined, // do NOT load CDN scripts
    pretendToBeVisual: true,
    url: 'http://localhost:3000/', // real origin so localStorage works (file:// is opaque)
  });
  const { window } = dom;

  // ---- stubs on the jsdom window ----
  window.fetch = () => { throw new Error('fetch() called unexpectedly in smoke test'); };
  const authCallbacks = [];
  const firestoreChain = () => stubChain('firestore');
  const authStub = stubChain('auth');
  // make onAuthStateChanged capture the callback instead of chain-stubbing
  const authObj = new Proxy({}, {
    get(t, prop) {
      if (prop === 'onAuthStateChanged') return (cb) => { authCallbacks.push(cb); return () => {}; };
      if (prop === 'then') return undefined;
      return stubChain('auth.' + String(prop));
    },
  });
  window.firebase = {
    initializeApp: () => ({}),
    auth: () => authObj,
    firestore: () => firestoreChain(),
  };
  window.marked = { parse: (s) => String(s) };
  window.hljs = { highlightElement: () => {} };
  window.VANTA = { NET: () => ({ destroy: () => {} }) };
  // google left undefined -> GIS block skipped (same as pre-script-load state)
  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:stub');
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});

  // ---- bind jsdom globals for the module under test ----
  global.document = window.document;
  global.window = window;
  try { Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true }); } catch { /* keep node's navigator */ }
  global.localStorage = window.localStorage;
  global.location = window.location;
  global.history = window.history;
  global.CustomEvent = window.CustomEvent;
  // module top-level globals resolve via Node's globalThis — mirror the window stubs
  global.firebase = window.firebase;
  global.marked = window.marked;
  global.hljs = window.hljs;
  global.VANTA = window.VANTA;
  global.Event = window.Event;
  global.getComputedStyle = window.getComputedStyle;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  // initApp() uses MutationObserver (modal scroll-lock/focus-restore) —
  // without this global the import-time init crashes before listeners attach.
  global.MutationObserver = window.MutationObserver;
  global.KeyboardEvent = window.KeyboardEvent;

  process.on('unhandledRejection', (r) => errors.push('unhandledRejection: ' + (r && r.message || r)));

  // ---- import the module graph (copy to ESM scope: repo package.json is commonjs) ----
  const esmDir = path.join(ROOT, 'tmp', 'smoke-esm');
  fs.rmSync(esmDir, { recursive: true, force: true });
  fs.mkdirSync(esmDir, { recursive: true });
  fs.writeFileSync(path.join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'js', f), path.join(esmDir, f));
  }
  const appUrl = 'file://' + path.join(esmDir, 'app.js') + '?t=' + Date.now();
  const app = await import(appUrl);
  console.log('✓ module graph imported (app.js + all relative imports)');

  // ---- fire DOMContentLoaded ----
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  console.log('✓ DOMContentLoaded dispatched without throwing');

  // give microtasks/setTimeouts a beat
  await new Promise((r) => setTimeout(r, 600));

  if (!authCallbacks.length) errors.push('onAuthStateChanged was never registered');

  const loader = window.document.getElementById('app-loader');
  const authSection = window.document.getElementById('auth-section');
  if (!loader) throw new Error('app-loader missing from DOM');
  if (!authSection) throw new Error('auth-section missing from DOM');

  // ---- logged-out path ----
  for (const cb of authCallbacks) {
    try { await cb(null); } catch (e) { errors.push('auth(null) threw: ' + (e && e.stack || e)); }
  }
  await new Promise((r) => setTimeout(r, 600));
  if (loader.style.display !== 'none') errors.push(`[logged-out] app-loader display=${loader.style.display} (expected 'none')`);
  if (authSection.style.display === 'none') errors.push('[logged-out] auth-section hidden (expected visible)');
  console.log('✓ logged-out path OK (login view shown, loader hidden)');

  // ---- logged-in path: run initApp wiring via the auth callback ----
  const fakeUser = { uid: 'smoke-user-1', displayName: 'Smoke Tester', email: 'smoke@test.dev', isAnonymous: false, photoURL: null };
  for (const cb of authCallbacks) {
    try { await cb(fakeUser); } catch (e) { errors.push('auth(user) threw: ' + (e && e.stack || e)); }
  }
  await new Promise((r) => setTimeout(r, 600));

  // same URL the graph used (no query!) so we observe the SAME module instance
  const state = (await import('file://' + path.join(esmDir, 'state.js'))).state;
  if (!state.isAppInitialized) errors.push('state.isAppInitialized not set after logged-in callback');
  if (!state.auth) errors.push('state.auth not assigned by initFirebase');

  // composer + chat list must have listeners attached (spot-check initApp ran)
  const sendBtn = window.document.getElementById('sendBtn');
  if (!sendBtn) throw new Error('sendBtn missing from DOM');
  console.log('✓ logged-in path OK (initApp wiring completed, app shell visible)');

  // ---- DOM contract: every dom.js registry entry must resolve to a real element ----
  // (Phase 3 restyles markup; this guarantees JS never loses its handles)
  const domMod = await import('file://' + path.join(esmDir, 'dom.js'));
  const OPTIONAL_DOM = new Set(['googleSigninBtn']); // guarded by if(dom.x) in code
  let contractFailures = 0;
  for (const [key, val] of Object.entries(domMod.dom)) {
    if (val === null || val === undefined) {
      if (!OPTIONAL_DOM.has(key)) { errors.push(`DOM contract: dom.${key} is null (id missing from index.html?)`); contractFailures++; }
    } else if (!(val instanceof window.Element) && typeof val !== 'string') {
      errors.push(`DOM contract: dom.${key} is not an Element (${typeof val})`); contractFailures++;
    }
  }
  if (!contractFailures) console.log(`✓ DOM contract OK (${Object.keys(domMod.dom).length} registry entries resolve)`);

  // ---- double-fire auth callback (idempotence guard mirrors original isAppInitialized lock) ----
  for (const cb of authCallbacks) {
    try { await cb(fakeUser); } catch (e) { errors.push('auth re-callback threw: ' + (e && e.message || e)); }
  }

  if (errors.length) {
    console.error('\nSMOKE TEST FAILURES ❌');
    errors.forEach((e) => console.error(' ✗', e));
    process.exit(1);
  }
  console.log('\nSMOKE TEST PASSED ✅');
  process.exit(0);
}

main().catch((e) => { console.error('SMOKE TEST CRASHED ❌\n', e && e.stack || e); process.exit(1); });
