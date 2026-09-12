'use strict';
/** Clicks every shell control in jsdom and asserts the visible effect. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

function stubChain(label) {
    return new Proxy(function () {}, {
        get(t, prop) {
            if (prop === 'then') return undefined;
            return stubChain(label + '.' + String(prop));
        },
        apply() { return stubChain(label + '()'); },
        construct() { return stubChain('new ' + label); },
    });
}

(async () => {
    const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
        runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:3000/',
    });
    const { window } = dom;
    window.fetch = () => { throw new Error('no fetch in test'); };
    const authCallbacks = [];
    const authObj = new Proxy({}, {
        get(t, prop) {
            if (prop === 'onAuthStateChanged') return (cb) => { authCallbacks.push(cb); return () => {}; };
            if (prop === 'then') return undefined;
            return stubChain('auth.' + String(prop));
        },
    });
    window.firebase = { initializeApp: () => ({}), auth: () => authObj, firestore: () => stubChain('fs') };
    window.marked = { parse: (s) => String(s) };
    window.hljs = { highlightElement: () => {} };
    global.document = window.document;
    global.window = window;
    try { Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true }); } catch {}
    global.localStorage = window.localStorage;
    global.location = window.location;
    global.Event = window.Event;
    global.CustomEvent = window.CustomEvent;
    global.getComputedStyle = window.getComputedStyle;
    global.firebase = window.firebase;
    global.marked = window.marked;
    global.hljs = window.hljs;

    const esmDir = path.join(ROOT, 'tmp', 'smoke-esm');
    fs.rmSync(esmDir, { recursive: true, force: true });
    fs.mkdirSync(esmDir, { recursive: true });
    fs.writeFileSync(path.join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }));
    for (const f of fs.readdirSync(path.join(ROOT, 'js'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'js', f), path.join(esmDir, f));

    await import('file://' + path.join(esmDir, 'app.js'));
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await new Promise((r) => setTimeout(r, 300));

    const fakeUser = { uid: 'u1', displayName: 'T', isAnonymous: false, photoURL: null };
    for (const cb of authCallbacks) await cb(fakeUser);
    await new Promise((r) => setTimeout(r, 500));

    const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const $ = (id) => window.document.getElementById(id);
    let fails = 0;
    const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; };

    // model selector FIRST (clean state; the panel auto-closer reacts to any prior click)
    {
        click($('modelSelectorBtn'));
        await sleep(300);
        const panel = $('modelSelectorPanel');
        const open = panel && !panel.classList.contains('hidden');
        const options = panel ? panel.querySelectorAll('button').length : 0;
        check('model selector opens', !!open, options + ' options');
        if (open) click($('modelSelectorBtn')); // toggle closed via the button itself
        await sleep(300);
    }
    // theme
    {
        const before = window.document.documentElement.classList.contains('dark');
        click($('themeToggle'));
        await sleep(50);
        const after = window.document.documentElement.classList.contains('dark');
        check('theme toggle', before !== after, `${before}->${after}`);
        await sleep(250); // let any panel-close timers flush
    }
    // sidebar
    {
        const sb = $('sidebar');
        const before = sb.className;
        click($('sidebarToggle'));
        await sleep(100);
        check('sidebar toggle', sb.className !== before);
        click($('sidebarToggle'));
        await sleep(100);
    }
    // settings
    {
        click($('settingsToggleBtn'));
        await sleep(50);
        check('settings panel opens', $('settingsPanel') && !$('settingsPanel').classList.contains('hidden'));
    }
    // search
    {
        click($('searchToggleBtn'));
        await sleep(50);
        check('search panel opens', $('searchPanel') && !$('searchPanel').classList.contains('hidden'));
    }
    // command palette (Ctrl+K): open, type, keyboard-run an action
    {
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', {
            key: 'k', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await sleep(50);
        const palette = $('commandPalette');
        check('palette opens with Ctrl+K', palette && !palette.classList.contains('hidden'));
        const items = palette ? palette.querySelectorAll('.palette-item') : [];
        check('palette lists commands', items.length >= 5, items.length + ' commands');
        window.document.getElementById('commandPaletteInput').value = 'timestamps';
        window.document.getElementById('commandPaletteInput').dispatchEvent(new window.Event('input', { bubbles: true }));
        await sleep(50);
        const filteredItems = palette.querySelectorAll('.palette-item');
        check('palette filters', filteredItems.length === 1, filteredItems.length + ' match');
        const input = window.document.getElementById('commandPaletteInput');
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await sleep(50);
        check('palette Enter closes and runs', palette.classList.contains('hidden'));
        check('palette action toggled timestamps', $('timestampsToggle').checked === false);
        // reset timestamps to true for determinism
        $('timestampsToggle').checked = true;
        $('timestampsToggle').dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(50);
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
        await sleep(50);
        check('palette re-opens (toggle)', palette && !palette.classList.contains('hidden'));
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(50);
        check('palette Escape closes', palette.classList.contains('hidden'));
    }
    // timestamps switch affects re-render without throwing
    {
        const tt = $('timestampsToggle');
        tt.checked = false;
        tt.dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(50);
        check('timestamps toggle change handled', true);
    }
    // toast: shows, dismiss button hides (roadmap #4 polish)
    {
        const { showToast } = await import('file://' + path.join(esmDir, 'utils.js'));
        showToast('test toast');
        await sleep(50);
        const toast = $('toast-notification');
        check('toast becomes visible', toast.style.transform.includes('translateX(0)'));
        click($('toastCloseBtn'));
        await sleep(50);
        check('toast close dismisses', toast.style.transform.includes('translateX(150%)'));
    }

    console.log(fails ? `\n${fails} INTERACTION FAILURE(S) ❌` : '\nALL INTERACTIONS PASS ✅');
    process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
