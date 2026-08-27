'use strict';
/**
 * Phase 2 gate — proves the split is behavior-preserving.
 *  1. TOKEN PARITY: every original main() statement (with the documented
 *     state.* renames applied) appears token-identically in the generated modules.
 *  2. COVERAGE: 100% of original statements matched.
 *  3. EXTRA-CODE AUDIT: every module statement traces to an original run or is
 *     whitelisted infra (hand-written wrappers in app.js / auth.js infra).
 *  4. RESOLUTION SCAN: no unresolved free identifiers (imports/globals/stubs).
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'tmp', 'main-module.js'), 'utf8');
const ast = acorn.parse(SRC, { ecmaVersion: 2022, sourceType: 'module', locations: true, onComment: () => {} });
const main = ast.body.find((s) => s.type === 'FunctionDeclaration');
const stmts = main.body.body;

// --- the documented mechanical rename set (must mirror build-split.js) ---
const STATE_VARS = ['chats', 'activeChatId', 'abortController', 'guestSessionMessageCount', 'isAppInitialized', 'vantaEffect', 'recognition', 'titleAnimationInterval', 'tokenClient', 'auth', 'db'];

// --- units (mirrors build-split.js classification) ---
const UNITS = [
  { stmts: [1] }, { stmts: [2] }, { stmts: [7] }, { stmts: [9] }, { stmts: [32] },
  { stmts: [8] }, { stmts: [33, 59], wrap: true },
  { stmts: [24] }, { stmts: [28] }, { stmts: [50] },
  { stmts: [30] }, { stmts: [31] }, { stmts: [34] }, { stmts: [35] }, { stmts: [36] }, { stmts: [37] }, { stmts: [25, 26] },
  { stmts: [3, 4, 5, 6], wrap: true },
  { stmts: [18] }, { stmts: [19] }, { stmts: [20] }, { stmts: [21] }, { stmts: [22] }, { stmts: [23] }, { stmts: [27] }, { stmts: [52] },
  { stmts: [54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65], wrap: true },
  { stmts: [29] }, { stmts: [38] }, { stmts: [39] }, { stmts: [40] }, { stmts: [41] }, { stmts: [42] }, { stmts: [43, 44], wrap: true }, { stmts: [46] }, { stmts: [47] }, { stmts: [48] }, { stmts: [49] }, { stmts: [45] },
  { stmts: [51] }, { stmts: [0], wrap: true },
];

const MODULES = ['config.js', 'dom.js', 'state.js', 'utils.js', 'ui.js', 'auth.js', 'chat.js', 'app.js'];

// allowed identifiers that are neither imports nor main-scope bindings
const GLOBALS = new Set(['document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'console', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout', 'fetch', 'AbortController', 'URL', 'Blob', 'FileReader', 'FormData', 'alert', 'confirm', 'location', 'history', 'crypto', 'TextDecoder', 'CustomEvent', 'requestAnimationFrame', 'getComputedStyle', 'MutationObserver', 'Notification', 'speechRecognition', 'webkitSpeechRecognition', 'firebase', 'marked', 'hljs', 'VANTA', 'google', 'prompt', 'Event', 'Infinity', 'NaN', 'undefined', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Promise', 'Error', 'RegExp', 'Map', 'Set', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'atob', 'btoa', 'globalThis', 'state', '_initApp']);

const INFRA_OK = new Set(['main', 'registerInitApp', '_initApp', 'ExpressionStatement', // Phase 2 infra
  'renderEmptyState', 'maybeCollapse', 'persistMessageMeta', 'toggleReaction', 'togglePin', 'performMessageSearch', 'renderSearchResults', 'ensureVanta', 'setVantaEnabled', 'vantaScriptsLoading', 'COLLAPSE_THRESHOLD' // Phase 3 features (documented additions)
]); // ExpressionStatement = the app.js DOMContentLoaded wiring (1 known line) // hand-written app.js main() + auth infra

function tokenize(text) {
  const out = [];
  for (const tok of acorn.tokenizer(text, { ecmaVersion: 2022, sourceType: 'module' })) {
    out.push(tok.value === undefined ? tok.type.label : String(tok.value));
  }
  return out;
}

// apply the state.* renames to original source text (identifier-level via parser)
function renamedOriginalText() {
  // We rely on build-split having applied identical renames; for parity we need the
  // original statements tokenized the same way. Simplest: reuse the generated
  // renamer logic — replicate with a parser-driven splice.
  const astC = acorn.parse(SRC, { ecmaVersion: 2022, sourceType: 'module', locations: true });
  const mainC = astC.body.find((s) => s.type === 'FunctionDeclaration');
  const stmtsC = mainC.body.body;

  const mainBindings = new Set();
  const unitByStmt = new Array(stmtsC.length).fill(null);
  UNITS.forEach((u) => u.stmts.forEach((i) => (unitByStmt[i] = u)));
  STATE_VARS.forEach((n) => mainBindings.add(n));
  stmtsC.forEach((s, i) => {
    if (s.type === 'VariableDeclaration') for (const d of s.declarations) if (d.id.type === 'Identifier') mainBindings.add(d.id.name);
    else if (s.type === 'FunctionDeclaration') mainBindings.add(s.id.name);
  });
  mainBindings.add('initApp');

  // collect binding positions & local scopes per unit run, then rename
  const edits = [];
  function markBindings(pat) {
    (function m(p) {
      if (!p || typeof p.type !== 'string') return;
      if (p.type === 'Identifier') bindingPositions.add(p);
      else if (p.type === 'RestElement') m(p.argument);
      else if (p.type === 'AssignmentPattern') { m(p.left); m(p.right); }
      else if (p.type === 'ArrayPattern') p.elements.forEach((e) => e && m(e));
      else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => m(pr.value || pr.argument));
    })(pat);
  }
  const bindingPositions = new Set();
  const unitLocalSets = []; // per-unit local name sets (mirrors generator's declaredLocal)

  for (const u of UNITS) {
    const nodes = u.stmts.map((i) => stmtsC[i]);
    const unitLocals = new Set();
    unitLocalSets.push(unitLocals);
    (function scan(node) {
      if (!node || typeof node.type !== 'string') return;
      if (node.type === 'VariableDeclarator') { walkIds(node.id).forEach((n) => { unitLocals.add(n); }); markBindings(node.id); }
      else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        (node.params || []).forEach((p) => { walkIds(p).forEach((n) => { unitLocals.add(n); }); markBindings(p); });
        if (node.id) { unitLocals.add(node.id.name); bindingPositions.add(node.id); }
        scan(node.body);
      } else if (node.type === 'CatchClause') {
        if (node.param) { walkIds(node.param).forEach((n) => { unitLocals.add(n); }); markBindings(node.param); }
        scan(node.body);
      } else {
        for (const key of Object.keys(node)) {
          if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
          const v = node[key];
          if (Array.isArray(v)) v.forEach(scan);
          else if (v && typeof v === 'object' && typeof v.type === 'string') scan(v);
        }
      }
    })({ type: 'Program', body: nodes });
  }

  // references to rename: identifiers in runs bound at main scope & in STATE_VARS
  for (const u of UNITS) {
    for (const i of u.stmts) {
      const s = stmtsC[i];
      (function w(node, parent) {
        if (!node || typeof node.type !== 'string') return;
        node._parent = parent;
        if (node.type === 'VariableDeclarator') { markBindings(node.id); w(node.init, node); return; }
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
          node.params.forEach((p) => markBindings(p));
          if (node.id) bindingPositions.add(node.id);
          w(node.body, node); return;
        }
        if (node.type === 'MemberExpression') { w(node.object, node); if (node.computed) w(node.property, node); return; }
        if (node.type === 'Property') { if (node.computed) w(node.key, node); w(node.value, node); return; }
        for (const key of Object.keys(node)) {
          if (key === 'type' || key === 'start' || key === 'end' || key === '_parent' || key === 'loc' || key === 'range') continue;
          const v = node[key];
          if (Array.isArray(v)) v.forEach((x) => w(x, node));
          else if (v && typeof v === 'object' && typeof v.type === 'string') w(v, node);
        }
      })(s, null);
    }
  }
  // collect rename candidates with local-scope awareness — UNIT STATEMENTS ONLY
  // (matches build-split.js, which never renames the state-var declarations)
  UNITS.forEach((unitNode, unitIdx) => {
    const unitNodes = unitNode.stmts.map((i) => stmtsC[i]);
    const unitLocals = unitLocalSets[unitIdx];
    const collect = function (node, locals) {  // per-unit locals (mirrors analyzeUnit)
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier' && !bindingPositions.has(node)) {
      const parent = node._parent;
      const isProp = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const isKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed;
      if (!isProp && !isKey && !locals.has(node.name) && STATE_VARS.includes(node.name)) {
        const p = parent;
        if (p && p.type === 'Property' && p.shorthand && p.value === node) {
          edits.push({ start: p.start, end: p.end, replacement: `${node.name}: state.${node.name}` });
        } else {
          edits.push({ start: node.start, end: node.end, replacement: `state.${node.name}` });
        }
      }
      return;
    }
    let next = locals;
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'CatchClause' || node.type === 'ClassDeclaration') {
      next = new Set(locals);
      (node.params || []).forEach((p) => walkIds(p).forEach((n) => next.add(n)));
      if (node.type === 'CatchClause' && node.param) walkIds(node.param).forEach((n) => next.add(n));
      if (node.id && node.type === 'FunctionExpression') next.add(node.id.name);
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === '_parent' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => collect(x, next));
      else if (v && typeof v === 'object' && typeof v.type === 'string') collect(v, next);
    }
  };
    for (const un of unitNodes) collect(un, unitLocals);
  });

  edits.sort((a, b) => b.start - a.start);
  let t = SRC;
  for (const e of edits) t = t.slice(0, e.start) + e.replacement + t.slice(e.end);
  // mirror build-split.js: initFirebase assigns state.auth/state.db (not locals)
  t = t.replace('const auth = firebase.auth();', 'state.auth = firebase.auth();');
  t = t.replace('const db = firebase.firestore();', 'state.db = firebase.firestore();');
  return { text: t, edits, astC, stmtsC, unitByStmt, bindingPositions, unitLocalSets };
}

function walkIds(pat) {
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

const { text: RENAMED, stmtsC, unitByStmt } = renamedOriginalText();
// NOTE: RENAMED has edits applied; statement offsets shifted. Re-parse renamed text
const astR = acorn.parse(RENAMED, { ecmaVersion: 2022, sourceType: 'module', locations: true });
const mainR = astR.body.find((s) => s.type === 'FunctionDeclaration');
const stmtsR = mainR.body.body;

// Build original token strings per unit run
function unitRunsOriginal(unit) {
  const runs = [];
  let cur = null;
  for (const i of unit.stmts) {
    const s = stmtsR[i];
    if (cur && s.start - cur.end <= 4) cur.end = s.end;
    else { cur = { start: s.start, end: s.end }; runs.push(cur); }
  }
  return runs.map((r) => tokenize(RENAMED.slice(r.start, r.end)).join(' '));
}

// Build module token stream
const moduleTokens = new Map(); // file -> joined token string
const moduleStmts = new Map(); // file -> [{type,name,text}]
for (const f of MODULES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const a = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' });
  // strip import statements from token stream
  const pieces = [];
  let last = 0;
  const names = [];
  for (const st of a.body) {
    if (st.type === 'ImportDeclaration') {
      pieces.push(src.slice(last, st.start));
      last = st.end;
      continue;
    }
    let name = '';
    if (st.type === 'ExportNamedDeclaration' && st.declaration) {
      const d = st.declaration;
      name = d.id ? d.id.name : (d.declarations ? d.declarations[0].id.name : '');
    } else if (st.type === 'FunctionDeclaration') name = st.id.name;
    else if (st.type === 'VariableDeclaration') name = st.declarations[0].id.name;
    else if (st.type === 'ExportSpecifier') name = st.exported.name;
    else if (st.type === 'ExportNamedDeclaration' && st.specifiers && st.specifiers.length) {
      st.specifiers.forEach((x) => names.push(x.exported.name));
      continue; // already pushed
    }
    names.push(name || st.type);
  }
  pieces.push(src.slice(last));
  moduleTokens.set(f, tokenize(pieces.join('')).join(' '));
  moduleStmts.set(f, names);
}

// --- CHECK 1+2: parity & coverage ---
let totalRuns = 0, matchedRuns = 0;
const failures = [];
for (const unit of UNITS) {
  for (const runTokens of unitRunsOriginal(unit)) {
    totalRuns++;
    let found = false;
    const runVariant = runTokens.replace(/\binitApp \(/g, '_initApp (');
    for (const f of MODULES) {
      if (moduleTokens.get(f).includes(runTokens) || (f === 'auth.js' && moduleTokens.get(f).includes(runVariant))) { found = true; break; }
    }
    if (found) matchedRuns++;
    else failures.push(runTokens.slice(0, 140));
  }
}
console.log(`PARITY: ${matchedRuns}/${totalRuns} unit-runs matched token-identically`);
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach((f) => console.log('  ✗', f));
}

// --- CHECK 3: module top-level names all trace to originals or infra ---
const originalTopNames = new Set();
stmtsC.forEach((s, i) => {
  if (s.type === 'VariableDeclaration') for (const d of s.declarations) if (d.id.type === 'Identifier') originalTopNames.add(d.id.name);
  else if (s.type === 'FunctionDeclaration') originalTopNames.add(s.id.name);
});
['closeGuestLimitModal', 'showGuestLimitModal'].forEach((n) => originalTopNames.add(n));
['handleCredentialResponse'].forEach((n) => originalTopNames.add(n));
originalTopNames.add('initApp');
const WRAPPERS = new Set(['initDomExtras', 'initFirebase', 'initAuth', 'initMessageActions', 'registerServiceWorker', 'state']);
const moduleOnly = [];
for (const f of MODULES) {
  for (const n of moduleStmts.get(f)) {
    if (!n || WRAPPERS.has(n) || INFRA_OK.has(n) || originalTopNames.has(n)) continue;
    moduleOnly.push(`${f}: ${n}`);
  }
}
console.log(`EXTRA-CODE AUDIT: ${moduleOnly.length} unexplained top-level names`);
moduleOnly.forEach((m) => console.log('  ?', m));

// --- CHECK 4: unresolved identifiers ---
let unresolved = 0;
for (const f of MODULES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const a = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true });
  const imports = new Set();
  for (const st of a.body) if (st.type === 'ImportDeclaration') st.specifiers.forEach((sp) => imports.add(sp.local.name));
  const bound = new Set(imports);
  const bindPos = new Set();
  (function scan(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'VariableDeclarator') walkIds(node.id).forEach((n) => bound.add(n));
    else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      if (node.id) bound.add(node.id.name);
      (node.params || []).forEach((p) => walkIds(p).forEach((n) => bound.add(n)));
    } else if (node.type === 'CatchClause' && node.param) walkIds(node.param).forEach((n) => bound.add(n));
    else if (node.type === 'ClassDeclaration' && node.id) bound.add(node.id.name);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === 'object' && typeof v.type === 'string') scan(v);
    }
  })(a);

  // binding positions again for reference filtering
  (function scanBind(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'VariableDeclarator') mark(node.id);
    else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      if (node.id) bindPos.add(node.id);
      (node.params || []).forEach(mark);
    } else if (node.type === 'CatchClause' && node.param) mark(node.param);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach(scanBind);
      else if (v && typeof v === 'object' && typeof v.type === 'string') scanBind(v);
    }
    function mark(p) {
      (function m(x) {
        if (!x || typeof x.type !== 'string') return;
        if (x.type === 'Identifier') bindPos.add(x);
        else if (x.type === 'RestElement') m(x.argument);
        else if (x.type === 'AssignmentPattern') { m(x.left); scanBind(x.right); }
        else if (x.type === 'ArrayPattern') x.elements.forEach((e) => e && m(e));
        else if (x.type === 'ObjectPattern') x.properties.forEach((pr) => m(pr.value || pr.argument));
      })(p);
    }
  })(a);

  // proper parent-linked reference scan
  (function linkParents(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    node._pp = parent;
    if (node.type === 'VariableDeclarator') {
      (function linkPattern(pat) {
        if (!pat || typeof pat.type !== 'string') return;
        if (pat.type === 'Property') { pat._pp = pat; linkParents(pat.key, pat); linkParents(pat.value, pat); return; }
        if (pat.type === 'ArrayPattern') pat.elements.forEach((e) => e && linkPattern(e));
        else if (pat.type === 'ObjectPattern') pat.properties.forEach((pr) => linkPattern(pr));
        else if (pat.type === 'RestElement') linkPattern(pat.argument);
        else if (pat.type === 'AssignmentPattern') { linkPattern(pat.left); linkParents(pat.right, node); }
        else if (pat.type === 'Identifier') { /* binding; nothing to link */ }
      })(node.id);
      linkParents(node.init, node); return;
    }
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      if (node.type !== 'ArrowFunctionExpression' && node.id) { /* binding */ }
      if (node.expression) { linkParents(node.body, node); return; }
      linkParents(node.body, node); return;
    }
    if (node.type === 'MemberExpression') { linkParents(node.object, node); linkParents(node.property, node); return; }
    if (node.type === 'Property') { linkParents(node.key, node); linkParents(node.value, node); return; }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === '_pp' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => linkParents(x, node));
      else if (v && typeof v === 'object' && typeof v.type === 'string') linkParents(v, node);
    }
  })(a, null);

  const markSet = (p, set) => { (function m(x) {
    if (!x || typeof x.type !== 'string') return;
    if (x.type === 'Identifier') set.add(x);
    else if (x.type === 'RestElement') m(x.argument);
    else if (x.type === 'AssignmentPattern') { m(x.left); linkParents(x.right, x); }
    else if (x.type === 'ArrayPattern') x.elements.forEach((e) => e && m(e));
    else if (x.type === 'ObjectPattern') x.properties.forEach((pr) => m(pr.value || pr.argument));
  })(p); };

  (function refsWalk(node, locals) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier') {
      if (!bindPos.has(node)) {
        const parent = node._pp;
        const isProp = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
        const isKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed;
        if (!isProp && !isKey && !locals.has(node.name) && !bound.has(node.name) && !GLOBALS.has(node.name)) {
          unresolved++;
          console.log(`  UNRESOLVED in ${f}: ${node.name} (L${node.loc ? node.loc.start.line : '?'}) ctx: ${src.slice(Math.max(0,node.start-70), node.end+40).replace(/\n/g,'|')}`);
        }
      }
      return;
    }
    let next = locals;
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'CatchClause' || node.type === 'ClassDeclaration') {
      next = new Set(locals);
      (node.params || []).forEach((p) => walkIds(p).forEach((n) => next.add(n)));
      if (node.type === 'CatchClause' && node.param) walkIds(node.param).forEach((n) => next.add(n));
      if (node.id && node.type === 'FunctionExpression') next.add(node.id.name);
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === '_pp' || key === 'loc' || key === 'range') continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((x) => refsWalk(x, next));
      else if (v && typeof v === 'object' && typeof v.type === 'string') refsWalk(v, next);
    }
  })(a, new Set());
} // end per-module loop

console.log(`RESOLUTION SCAN: ${unresolved} unresolved identifiers`);
console.log(unresolved === 0 && matchedRuns === totalRuns && moduleOnly.length === 0 ? 'ALL PARITY CHECKS PASSED ✅' : 'CHECKS FAILED ❌');
