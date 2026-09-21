'use strict';
/** Full auth-cycle test: login → signout → auth interactive → re-login → shell sane. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');

function stubChain(label) {
    return new Proxy(function () {}, {
        get(t, p) { if (p === 'then') return undefined; return stubChain(label + '.' + String(p)); },
        apply() { return stubChain(label + '()'); },
        construct() { return stubChain('new ' + label); },
    });
}

(async () => {
    const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
        runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:3000/',
    });
    const { window } = dom;
    const authCallbacks = [];
    let signedIn = null;
    // controllable firebase auth stub
    const authObj = new Proxy({}, {
        get(t, prop) {
            if (prop === 'onAuthStateChanged') return (cb) => { authCallbacks.push(cb); return () => {}; };
            if (prop === 'signOut') return () => { signedIn = null; authCallbacks.forEach(cb => cb(null)); return Promise.resolve(); };
            if (prop === 'currentUser') return signedIn;
            if (prop === 'then') return undefined;
            return stubChain('auth.' + String(prop));
        },
    });
    window.firebase = {
        initializeApp: () => ({}),
        auth: () => authObj,
        firestore: () => stubChain('fs'),
        authGoogle: null,
    };
    window.marked = { parse: s => String(s) };
    window.hljs = { highlightElement: () => {} };
    global.document = window.document; global.window = window;
    try { Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true }); } catch {}
    global.localStorage = window.localStorage; global.location = window.location;
    global.Event = window.Event; global.CustomEvent = window.CustomEvent;
    global.getComputedStyle = window.getComputedStyle;
    global.firebase = window.firebase; global.marked = window.marked; global.hljs = window.hljs;
    global.MutationObserver = window.MutationObserver || class { observe() {} disconnect() {} unobserve() {} };
    window.MutationObserver = global.MutationObserver;
    global.WeakMap = global.WeakMap || WeakMap;

    const esmDir = path.join(ROOT, 'tmp', 'smoke-esm');
    fs.rmSync(esmDir, { recursive: true, force: true });
    fs.mkdirSync(esmDir, { recursive: true });
    fs.writeFileSync(path.join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }));
    for (const f of fs.readdirSync(path.join(ROOT, 'js'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'js', f), path.join(esmDir, f));
    await import('file://' + path.join(esmDir, 'app.js'));
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 200));

    const $ = id => window.document.getElementById(id);
    const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const user = { uid: 'u1', displayName: 'T', isAnonymous: false, emailVerified: true, photoURL: null };
    let fails = 0;
    const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; };

    // --- LOGIN 1 ---
    signedIn = user;
    for (const cb of authCallbacks) await cb(user);
    await sleep(400);
    check('login 1: app visible', $('app-container').style.display === 'flex');

    // --- SIGN OUT via modal ---
    click($('signoutBtn'));
    await sleep(60);
    const modal = $('deleteModal');
    check('signout confirm modal opens', modal && !modal.classList.contains('hidden'));
    click(window.document.getElementById('deleteConfirmBtn'));
    await sleep(400);
    check('modal closed after signout confirm', modal.classList.contains('hidden'), modal.className.includes('hidden') ? '' : 'STILL VISIBLE');
    check('auth section shown', $('auth-section').style.display === 'flex');
    const loader = $('app-loader');
    const loaderNeutral = loader.style.pointerEvents === 'none' || loader.style.visibility === 'hidden' || loader.style.display === 'none' || loader.classList.contains('hidden') || loader.getAttribute('aria-hidden') === 'true' && parseFloat(window.getComputedStyle ? '1' : '1');
    check('loader cannot intercept (pe/visibility/display)', !!loaderNeutral, `pe=${loader.style.pointerEvents} vis=${loader.style.visibility} disp=${loader.style.display}`);

    // --- LOGIN 2 (the critical second cycle) ---
    signedIn = user;
    for (const cb of authCallbacks) await cb(user);
    await sleep(400);
    check('login 2: app visible again', $('app-container').style.display === 'flex');

    // sidebar single-toggle after re-login (duplicate-listener detector).
    // Assert the open-state SEMANTICS (translate class), not className string
    // order — classList re-appends toggled classes at the end.
    const sb = $('sidebar');
    const isOpen = () => !sb.classList.contains('-translate-x-full');
    const beforeOpen = isOpen();
    click($('sidebarToggle'));
    await sleep(80);
    const midOpen = isOpen();
    click($('sidebarToggle'));
    await sleep(80);
    const restoredOpen = isOpen() === beforeOpen;
    check('sidebar toggles exactly once per click (2nd login)', beforeOpen !== midOpen && restoredOpen,
        beforeOpen === midOpen ? 'NO-OP (duplicate listeners!)' : (restoredOpen ? '' : 'did not restore'));

    // theme single-toggle after re-login
    const htmlEl = window.document.documentElement;
    const d1 = htmlEl.classList.contains('dark');
    click($('themeToggle'));
    await sleep(50);
    const d2 = htmlEl.classList.contains('dark');
    check('theme toggles exactly once per click (2nd login)', d1 !== d2, `double-fire would return to ${d1}`);

    // --- double-send guard (v2.0.15): two rapid sendBtn clicks -> ONE user message ---
    {
        const input = $('messageInput');
        input.value = 'double fire probe';
        const send = () => click($('sendBtn'));
        send(); send(); send();
        await sleep(500);
        const stateMod = await import('file://' + path.join(esmDir, 'state.js'));
        const chats = stateMod.state.chats;
        const count = chats[Object.keys(chats)[0]].messages.filter(m => m.role === 'user' && m.content === 'double fire probe').length;
        check('double-send guard (3 clicks -> 1 message)', count === 1, count + ' messages');
    }

    console.log(fails ? `\n${fails} CYCLE FAILURE(S) ❌` : '\nAUTH CYCLE: ALL PASS ✅');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASHED:', e); process.exit(1); });
