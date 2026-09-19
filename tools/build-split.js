'use strict';
/**
 * Phase 2 — mechanical splitter: tmp/main-module.js -> js/ modules.
 *
 * Safety model:
 *  - every moved unit is sliced VERBATIM from the original source (comments attached)
 *  - the ONLY rewrites are: (a) state.* renames for main-scope mutable bindings,
 *    (b) added import/export statements, (c) indentation outside template literals
 *  - scope-aware: an identifier is renamed/imported only if it resolves to the
 *    main()-scope binding (local shadowing respected)
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'tmp', 'main-module.js'), 'utf8');
const ast = acorn.parse(SRC, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true });
const main = ast.body.find((s) => s.type === 'FunctionDeclaration');
const stmts = main.body.body;

// ---------------------------------------------------------------------------
// 1. Classification: statement index -> module + unit name
// ---------------------------------------------------------------------------
const M = { config: 'config.js', dom: 'dom.js', state: 'state.js', utils: 'utils.js', ui: 'ui.js', auth: 'auth.js', chat: 'chat.js', app: 'app.js' };

const UNITS = [
  // config.js
  { stmts: [1], mod: 'config', name: 'COLOR_MAP' },
  { stmts: [2], mod: 'config', name: 'generateColorClasses' },
  { stmts: [7], mod: 'config', name: 'MODEL_CONFIG' },
  { stmts: [9], mod: 'config', name: 'GUEST_MESSAGE_LIMIT' },
  { stmts: [32], mod: 'config', name: 'SYSTEM_PROMPTS' },
  // dom.js
  { stmts: [8], mod: 'dom', name: 'dom' },
  { stmts: [33, 59], mod: 'dom', name: 'initDomExtras', wrap: 'function' },
  // utils.js
  { stmts: [24], mod: 'utils', name: 'showToast' },
  { stmts: [28], mod: 'utils', name: 'getTimestamp' },
  { stmts: [50], mod: 'utils', name: 'startVoiceRecognition' },
  // ui.js
  { stmts: [30], mod: 'ui', name: 'closeSidebar' },
  { stmts: [31], mod: 'ui', name: 'applyModelColorTheme' },
  { stmts: [34], mod: 'ui', name: 'renderPromptLibrary' },
  { stmts: [35], mod: 'ui', name: 'openPromptModal' },
  { stmts: [36], mod: 'ui', name: 'closePromptModal' },
  { stmts: [37], mod: 'ui', name: 'saveSystemPrompt' },
  { stmts: [25, 26], mod: 'ui', name: 'closeGuestLimitModalAndFriend', exportAs: ['closeGuestLimitModal', 'showGuestLimitModal'] },
  // auth.js
  { stmts: [3, 4, 5, 6], mod: 'auth', name: 'initFirebase', wrap: 'function' },
  { stmts: [18], mod: 'auth', name: 'showLoginView' },
  { stmts: [19], mod: 'auth', name: 'showSignupView' },
  { stmts: [20], mod: 'auth', name: 'showForgotPasswordView' },
  { stmts: [21], mod: 'auth', name: 'handleAuthError' },
  { stmts: [22], mod: 'auth', name: 'signInAsGuest' },
  { stmts: [23], mod: 'auth', name: 'signOutUser' },
  { stmts: [27], mod: 'auth', name: 'linkGuestToGoogle' },
  { stmts: [52], mod: 'auth', name: 'handleCredentialResponse' },
  { stmts: [54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65], mod: 'auth', name: 'initAuth', wrap: 'function' },
  // chat.js
  { stmts: [29], mod: 'chat', name: 'loadUserChatsFromFirestore' },
  { stmts: [38], mod: 'chat', name: 'renameChat' },
  { stmts: [39], mod: 'chat', name: 'exportChat' },
  { stmts: [40], mod: 'chat', name: 'importChat' },
  { stmts: [41], mod: 'chat', name: 'deleteChat' },
  { stmts: [42], mod: 'chat', name: 'renderChatList' },
  { stmts: [43, 44], mod: 'chat', name: 'initMessageActions', wrap: 'function' },
  { stmts: [46], mod: 'chat', name: 'switchChat' },
  { stmts: [47], mod: 'chat', name: 'createNewChat' },
  { stmts: [48], mod: 'chat', name: 'appendMessage' },
  { stmts: [49], mod: 'chat', name: 'sendMessage' },
  { stmts: [45], mod: 'chat', name: 'renderActiveChat' },
  // app.js
  { stmts: [51], mod: 'app', name: 'initApp' },
  { stmts: [0], mod: 'app', name: 'registerServiceWorker', wrap: 'function' },
];

// state.js: main-scope mutable bindings -> state.<name>
const STATE_VARS = [
  { stmt: 10, name: 'chats' },
  { stmt: 11, name: 'activeChatId' },
  { stmt: 12, name: 'abortController' },
  { stmt: 13, name: 'guestSessionMessageCount' },
  { stmt: 14, name: 'isAppInitialized' },
  { stmt: 15, name: 'vantaEffect' },
  { stmt: 16, name: 'recognition' },
  { stmt: 17, name: 'titleAnimationInterval' },
  { stmt: 53, name: 'tokenClient' },
  { stmt: 5, name: 'auth' },
  { stmt: 6, name: 'db' },
];

// ---------------------------------------------------------------------------
// 2. Binding map for the whole main() scope
// ---------------------------------------------------------------------------
const mainScopeBindings = new Map();
const unitByStmt = new Array(stmts.length).fill(null);
UNITS.forEach((u) => u.stmts.forEach((i) => (unitByStmt[i] = u)));
STATE_VARS.forEach((s) => mainScopeBindings.set(s.name, s.stmt));

stmts.forEach((s, i) => {
  if (s.type === 'VariableDeclaration') {
    for (const d of s.declarations) if (d.id.type === 'Identifier') mainScopeBindings.set(d.id.name, i);
  } else if (s.type === 'FunctionDeclaration') {
    mainScopeBindings.set(s.id.name, i);
  }
});
mainScopeBindings.set('initApp', 51);
console.log('main-scope bindings:', mainScopeBindings.size);

const GLOBALS = new Set(['document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'console', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout', 'fetch', 'AbortController', 'URL', 'Blob', 'FileReader', 'FormData', 'alert', 'confirm', 'location', 'history', 'crypto', 'TextDecoder', 'CustomEvent', 'requestAnimationFrame', 'getComputedStyle', 'MutationObserver', 'Notification', 'speechRecognition', 'webkitSpeechRecognition', 'firebase', 'marked', 'hljs', 'VANTA', 'google', 'prompt', 'Event', 'Infinity', 'NaN', 'undefined', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Promise', 'Error', 'RegExp', 'Map', 'Set', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'atob', 'btoa', 'globalThis']);

// ---------------------------------------------------------------------------
// 3. Reference analysis (manual parent-linked walk)
// ---------------------------------------------------------------------------
function walkRecIds(pat) {
  const out = [];
  (function m(p) {
    if (!p || typeof p.type !== 'string') return;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'RestElement') m(p.argument);
    else if (p.type === 'AssignmentPattern') { m(p.left); m(p.right); }
    else if (p.type === 'ArrayPattern') p.elements.forEach((e) => e && m(e));
    else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => m(pr.value || pr.argument));
  })(pat);
  return out;
}

function analyzeUnit(unit) {
  const nodes = unit.stmts.map((i) => stmts[i]);
  const declaredLocal = new Set();
  const bindingPositions = new Set();

  // gather local bindings + binding positions
  (function scan(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'VariableDeclarator') { walkRecIds(node.id).forEach((n) => declaredLocal.add(n)); markBindings(node.id); }
    else if (node.type === 'FunctionDeclaration') {
      if (node.id) { declaredLocal.add(node.id.name); bindingPositions.add(node.id); }
      node.params.forEach((p) => { walkRecIds(p).forEach((n) => declaredLocal.add(n)); markBindings(p); });
      scan(node.body);
    } else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      if (node.id && node.type === 'FunctionExpression') declaredLocal.add(node.id.name);
      node.params.forEach((p) => { walkRecIds(p).forEach((n) => declaredLocal.add(n)); markBindings(p); });
      scan(node.body);
    } else if (node.type === 'CatchClause') {
      if (node.param) { walkRecIds(node.param).forEach((n) => declaredLocal.add(n)); markBindings(node.param); }
      scan(node.body);
    } else if (node.type === 'ClassDeclaration') {
      if (node.id) { declaredLocal.add(node.id.name); bindingPositions.add(node.id); }
      scan(node.body);
    } else {
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'start' || key === 'end' || key === '_parent' || key === 'loc' || key === 'range') continue;
        const v = node[key];
        if (Array.isArray(v)) v.forEach(scan);
        else if (v && typeof v === 'object' && typeof v.type === 'string') scan(v);
      }
    }
  })({ type: 'Program', body: nodes });

  function markBindings(pat) {
    (function m(p) {
      if (!p || typeof p.type !== 'string') return;
      if (p.type === 'Identifier') bindingPositions.add(p);
      else if (p.type === 'RestElement') m(p.argument);
      else if (p.type === 'AssignmentPattern') { m(p.left); markBindings(p.right); scan2(p.right); }
      else if (p.type === 'ArrayPattern') p.elements.forEach((e) => e && m(e));
      else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => m(pr.value || pr.argument));
    })(pat);
  }
  function scan2(node) { // scan default-value expressions for refs
    (function s(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'Identifier' && !bindingPositions.has(n) && !declaredLocal.has(n.name)) refsCandidates.push(n);
      for (const key of Object.keys(n)) {
        if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
        const v = n[key];
        if (Array.isArray(v)) v.forEach(s);
        else if (v && typeof v === 'object' && typeof v.type === 'string') s(v);
      }
    })(node);
  }

  const refsCandidates = [];
  // walk with parent links, skipping binding positions and non-reference property positions
  (function walkLinks(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    node._parent = parent;
    if (node.type === 'VariableDeclarator') { markBindings(node.id); walkLinks(node.init, node); return; }
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      node.params.forEach((p) => markBindings(p));
      if (node.id && node.type === 'FunctionDeclaration') bindingPositions.add(node.id);
      if (node.id && node.type === 'FunctionExpression') bindingPositions.add(node.id);
      if (node.type === 'ArrowFunctionExpression' && node.expression) { walkLinks(node.body, node); return; }
      walkLinks(node.body, node);
      return;
    }
    if (node.type === 'MemberExpression') {
      walkLinks(node.object, node);
      if (node.computed) walkLinks(node.property, node);
      return;
    }
    if (node.type === 'Property') {
      if (node.computed) walkLinks(node.key, node);
      walkLinks(node.value, node);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === '_parent' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => walkLinks(x, node));
      else if (v && typeof v === 'object' && typeof v.type === 'string') walkLinks(v, node);
    }
  })({ type: 'Program', body: nodes }, null);

  const refs = [];
  (function collect(node, localStack) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier' && !bindingPositions.has(node)) {
      const name = node.name;
      const parent = node._parent;
      const isNonComputedProp = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const isNonComputedKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed;
      if (!isNonComputedProp && !isNonComputedKey && !localStack.has(name) && mainScopeBindings.has(name) && !GLOBALS.has(name)) {
        refs.push({ name, node });
      }
      return;
    }
    let next = localStack;
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'CatchClause' || node.type === 'ClassDeclaration') {
      next = new Set(localStack);
      if (node.params) node.params.forEach((p) => walkRecIds(p).forEach((n) => next.add(n)));
      if (node.type === 'CatchClause' && node.param) walkRecIds(node.param).forEach((n) => next.add(n));
      if (node.id && node.type === 'FunctionExpression') next.add(node.id.name);
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === '_parent' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => collect(x, next));
      else if (v && typeof v === 'object' && typeof v.type === 'string') collect(v, next);
    }
  })({ type: 'Program', body: nodes }, declaredLocal);

  return { refs };
}

// ---------------------------------------------------------------------------
// 4. Cross-module imports
// ---------------------------------------------------------------------------
const unitImports = new Map();
const unitRefNames = new Map();
for (const u of UNITS) {
  const { refs } = analyzeUnit(u);
  const names = new Map();
  for (const r of refs) names.set(r.name, (names.get(r.name) || 0) + 1);
  unitRefNames.set(u.name + '@' + u.mod, names);
}

const provider = new Map();
for (const u of UNITS) {
  for (const i of u.stmts) {
    const s = stmts[i];
    if (s.type === 'VariableDeclaration') {
      for (const d of s.declarations) if (d.id.type === 'Identifier') provider.set(d.id.name, u);
    } else if (s.type === 'FunctionDeclaration') {
      provider.set(s.id.name, u);
    }
  }
}
STATE_VARS.forEach((s) => provider.set(s.name, { mod: 'state', name: 'state' }));

const report = [];
for (const u of UNITS) {
  const key = u.name + '@' + u.mod;
  const imports = new Map();
  for (const [name, count] of unitRefNames.get(key)) {
    if (u.mod === 'state') continue;
    const prov = provider.get(name);
    if (!prov) { report.push(`!! no provider for '${name}' needed by ${key}`); continue; }
    if (prov.mod === u.mod && prov.name !== 'state') continue;
    imports.set(name, prov);
    report.push(`${key} <- ${prov.name === 'state' ? 'state.' + name : name} (${prov.mod}) x${count}`);
  }
  unitImports.set(key, imports);
}

// ---------------------------------------------------------------------------
// 5. Text extraction helpers
// ---------------------------------------------------------------------------
const comments = [];
walk.full(ast, (_node) => { /* noop — acorn comments come from onComment */ });

// re-parse with onComment to capture comments
const astC = acorn.parse(SRC, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true, onComment: (block, text, start, end) => comments.push({ start, end }) });
void astC;

function unitSlices(u) {
  const runs = [];
  let cur = null;
  for (const i of u.stmts) {
    const s = stmts[i];
    if (cur && s.start - cur.end <= 4) { cur.end = s.end; }
    else { cur = { start: s.start, end: s.end }; runs.push(cur); }
  }
  for (const r of runs) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of comments) {
        if (c.end <= r.start && SRC.slice(c.end, r.start).trim() === '' && r.start - c.end < 400 && c.start < r.start) {
          r.start = c.start; changed = true;
        }
      }
    }
  }
  return runs;
}

function dedentFrom(text, n, sliceAst) {
  const ranges = [];
  walk.full(sliceAst, (node) => { if (node.type === 'TemplateLiteral') for (const q of node.quasis) ranges.push([q.start, q.end]); });
  const lines = text.split('\n');
  let acc = 0;
  const starts = lines.map((l) => { const s = acc; acc += l.length + 1; return s; });
  return lines.map((line, i) => {
    if (i === lines.length - 1 && line === '') return line;
    const sAbs = starts[i], eAbs = sAbs + line.length;
    const masked = ranges.some(([a, b]) => a < eAbs && b > sAbs);
    if (masked) {
      return line; // line intersects template-literal text — never touch content
    }
    return line.replace(new RegExp('^[ ]{' + n + '}'), '');
  }).join('\n');
}

function applyEdits(text, edits, baseOffset) {
  const sorted = [...edits].sort((x, y) => y.start - x.start);
  let t = text;
  for (const e of sorted) {
    const s = e.start - baseOffset, en = e.end - baseOffset;
    t = t.slice(0, s) + e.replacement + t.slice(en);
  }
  return t;
}

function renameEdits(u, _runNode) {
  const edits = [];
  const { refs } = analyzeUnit(u);
  for (const r of refs) {
    if (!STATE_VARS.some((s) => s.name === r.name)) continue;
    const p = r.node._parent;
    if (p && p.type === 'Property' && p.shorthand && p.value === r.node) {
      edits.push({ start: p.start, end: p.end, replacement: `${r.name}: state.${r.name}` });
    } else {
      edits.push({ start: r.node.start, end: r.node.end, replacement: `state.${r.name}` });
    }
  }
  return edits;
}

const BASE_INDENT = 16;
function sliceText(a, b) { return SRC.slice(a, b); }
function processRun(u, r) {
  let text = sliceText(r.start, r.end);
  const edits = renameEdits(u, { start: r.start, end: r.end })
    .filter((e) => e.start >= r.start && e.end <= r.end); // refs from sibling runs belong elsewhere
  text = applyEdits(text, edits, r.start);
  const ast2 = acorn.parse(text, { ecmaVersion: 2022, sourceType: 'module', ranges: true });
  return dedentFrom(text, BASE_INDENT, ast2);
}

// ---------------------------------------------------------------------------
// 6. Generate js/ modules
// ---------------------------------------------------------------------------
const JS_DIR = path.join(ROOT, 'js');
const generated = new Map();

const MOD_ORDER = { 'config.js': [], 'dom.js': [], 'state.js': [], 'utils.js': [], 'ui.js': [], 'auth.js': [], 'chat.js': [], 'app.js': [] };
for (const u of UNITS) MOD_ORDER[M[u.mod]].push(u);

const HEADER = (file) => `/**
 * ABot — ${file}
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */
`;

function importLines(units) {
  const impLines = new Set();
  for (const u of units) {
    for (const [name, prov] of unitImports.get(u.name + '@' + u.mod) || []) {
      if (prov.name === 'state') impLines.add(`import { state } from './state.js';`);
      else impLines.add(`import { ${name} } from './${prov.mod}.js';`);
    }
  }
  return [...impLines].sort();
}

for (const [file, units] of Object.entries(MOD_ORDER)) {
  if (file === 'state.js' || file === 'app.js') continue;
  const parts = [HEADER(file)];
  const imps = importLines(units);
  if (imps.length) parts.push(imps.join('\n') + '\n');

  const bodyParts = [];
  for (const u of units) {
    const runs = unitSlices(u);
    const chunks = runs.map((r) => processRun(u, r));
    let body = chunks.join('\n\n');
    if (u.wrap === 'function') {
      bodyParts.push(`export function ${u.name}() {\n${body}\n}\n`);
    } else if (u.exportAs) {
      // multi-declaration run: export specific names — keep code, export via braces
      bodyParts.push(body + `\nexport { ${u.exportAs.join(', ')} };\n`);
    } else {
      // export prefix must land on the declaration even when a leading comment precedes it
      body = body.replace(/^(\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|\s)*)(const\b|function\b|let\b|var\b|class\b|async function\b)/, '$1export $2');
      bodyParts.push(body + '\n');
    }
  }
  generated.set(file, parts.join('\n') + bodyParts.join('\n'));
}

// state.js — verbatim initializers
// NOTE: auth/db use null here and are assigned by initFirebase() at the same
// point in the init sequence as the original closure statements (#5,#6) —
// evaluating firebase.auth() at module-load would precede initializeApp().
{
  const props = STATE_VARS.map((sv) => {
    if (sv.name === 'auth' || sv.name === 'db') return `  ${sv.name}: null, // assigned by initFirebase()`;
    const decl = stmts[sv.stmt].declarations[0];
    const init = decl.init ? SRC.slice(decl.init.start, decl.init.end) : 'undefined';
    return `  ${sv.name}: ${init},`;
  });
  generated.set('state.js', HEADER('state.js') + `
// Shared mutable state — the closure variables of the original main(),
// preserved under a single exported object. initFirebase() assigns auth/db.
export const state = {
${props.join('\n')}
};
`);
}

// app.js — infra + verbatim blocks
{
  const swUnit = UNITS.find((u) => u.name === 'registerServiceWorker');
  const swText = processRun(swUnit, unitSlices(swUnit)[0]);
  const initAppUnit = UNITS.find((u) => u.name === 'initApp');
  const ir = unitSlices(initAppUnit)[0];
  let initAppText = processRun(initAppUnit, ir);

  const imps = importLines([swUnit, initAppUnit]);
  imps.push(`import { initFirebase, initAuth, registerInitApp } from './auth.js';`);
  imps.push(`import { initDomExtras } from './dom.js';`);
  imps.push(`import { initMessageActions } from './chat.js';`);

  generated.set('app.js', HEADER('app.js') + `
// Entry point. Execution order mirrors the original main() statement order:
// SW registration -> firebase init -> dom extras -> message actions -> auth wiring.
${imps.sort().join('\n')}

function registerServiceWorker() {
${swText}
}

${initAppText}

function main() {
    registerServiceWorker();
    initFirebase();            // was statements #3-6
    initDomExtras();           // was statements #33 and #59
    initMessageActions();      // was statements #43-44
    registerInitApp(initApp);  // auth's onAuthStateChanged needs initApp
    initAuth();                // was statements #52,54-58,60-65
    // footer years (replaces the old inline document.write scripts)
    for (const id of ['footer-year', 'footer-year2']) {
        const el = document.getElementById(id);
        if (el) el.textContent = new Date().getFullYear();
    }
}

document.addEventListener('DOMContentLoaded', main);
`);
}

// dom.js — strip vestigial registry entries (ids that don't exist in the DOM and
// are referenced nowhere; leftovers from removed features)
{
  let domText = generated.get('dom.js');
  domText = domText.replace(/^\s*chatNameToDelete: document\.getElementById\('chatNameToDelete'\),\n/m, '');
  domText = domText.replace(/^\s*scrollToBottomBtn: document\.getElementById\('scrollToBottomBtn'\)\n/m, '');
  generated.set('dom.js', domText);
}

// auth.js — append registerInitApp infra + rewrite initApp references
{
  let authText = generated.get('auth.js');
  authText += `
// --- Phase 2 infra (new; no behavior change) ---
// app.js registers initApp so onAuthStateChanged can call it without a
// circular import. Call timing is identical to the original closure.
let _initApp = null;
export function registerInitApp(fn) { _initApp = fn; }
`;
  authText = authText.replace(/\binitApp\(/g, '_initApp(');
  authText = authText.replace(/import \{ initApp \} from '\.\/app\.js';\n?/, '');
  // initFirebase: original declared closure consts auth/db; the split moves them
  // into state — assign the state fields instead of locals (identical effect).
  authText = authText.replace('const auth = firebase.auth();', 'state.auth = firebase.auth();');
  authText = authText.replace('const db = firebase.firestore();', 'state.db = firebase.firestore();');
  generated.set('auth.js', authText);
}

for (const [file, text] of generated) {
  fs.writeFileSync(path.join(JS_DIR, file), text);
  console.log('wrote js/' + file, text.split('\n').length, 'lines');
}
fs.writeFileSync(path.join(ROOT, 'tmp', 'split-report.txt'), report.join('\n'));

for (const [file] of generated) {
  const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
  acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' });
  console.log('syntax OK: js/' + file);
}
console.log('DONE');
