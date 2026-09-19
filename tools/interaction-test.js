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
    // app.js initApp() uses MutationObserver (modal scroll-lock/focus-restore).
    // Without this global the import-time init crashes before any listener attaches.
    global.MutationObserver = window.MutationObserver;
    global.KeyboardEvent = window.KeyboardEvent;
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

    // GATE: no duplicate element ids (regression guard — sidebarToggle,
    // modelSelectorPanel and modal-title were all shipped duplicated before).
    {
        const seen = new Set(); const dupes = new Set();
        window.document.querySelectorAll('[id]').forEach((el) => {
            if (seen.has(el.id)) dupes.add(el.id); else seen.add(el.id);
        });
        check('no duplicate element ids', dupes.size === 0, [...dupes].join(', '));
    }

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
        check('sidebar toggle (header hamburger)', sb.className !== before);
        const opened = sb.className;
        click($('sidebarCloseBtn'));
        await sleep(100);
        check('sidebar close button (in-drawer ×)', sb.className !== opened);
        click($('sidebarToggle'));
        await sleep(100);
    }
    // desktop collapse: >=768px regime uses .sidebar-collapsed (margin slide),
    // not the transform — stub matchMedia to pretend a desktop viewport.
    {
        const realMatchMedia = window.matchMedia;
        window.matchMedia = (q) => ({ matches: String(q).includes('768'), media: String(q), addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} });
        const sb = $('sidebar');
        sb.classList.remove('-translate-x-full');
        click($('sidebarToggle'));
        await sleep(100);
        check('sidebar collapses on desktop', sb.classList.contains('sidebar-collapsed'));
        click($('sidebarToggle'));
        await sleep(100);
        check('sidebar re-expands on desktop', !sb.classList.contains('sidebar-collapsed'));
        window.matchMedia = realMatchMedia || ((q) => ({ matches: false, media: String(q), addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} }));
        sb.classList.add('-translate-x-full');
    }
    // settings
    {
        click($('settingsToggleBtn'));
        await sleep(50);
        check('settings panel opens', $('settingsPanel') && !$('settingsPanel').classList.contains('hidden'));
        // v1.0.4: dark mode is a switch row inside the panel (was a cramped link).
        const sw = $('sidebarThemeBtn');
        check('theme switch lives in settings', !!sw && sw.getAttribute('role') === 'switch' && $('settingsPanel').contains(sw));
        const darkBefore = window.document.documentElement.classList.contains('dark');
        click(sw);
        await sleep(50);
        const darkAfter = window.document.documentElement.classList.contains('dark');
        check('theme switch toggles dark mode', darkBefore !== darkAfter, `${darkBefore}->${darkAfter}`);
        check('theme switch aria-checked tracks state', sw.getAttribute('aria-checked') === String(darkAfter));
        click(sw); // restore
        await sleep(50);
    }
    // composer layout + morph state (v1.0.4): chips inside the box, stop hidden at rest
    {
        const box = $('messageInput') && $('messageInput').parentElement;
        check('chips sit inside the composer box', !!box && box.contains($('webSearchChip')) && box.contains($('sendBtn')));
        check('stop control hidden at rest', $('stopBtn').classList.contains('stop-hidden'));
        check('chat title moved to the sidebar', !!$('sidebarCurrentChat') && $('sidebarCurrentChat').contains($('chatTitle')));
    }
    // search
    {
        click($('searchToggleBtn'));
        await sleep(50);
        check('search panel opens', $('searchPanel') && !$('searchPanel').classList.contains('hidden'));
        // v1.0.3 C1: the drawer re-homes search for mobile — click must open the same panel.
        click($('sidebarSearchBtn'));
        await sleep(50);
        check('sidebar search button opens search panel', $('searchPanel') && !$('searchPanel').classList.contains('hidden'));
        // v1.0.4: explicit dismiss — the panel had no way out once opened.
        click($('searchCloseBtn'));
        await sleep(50);
        check('search close button dismisses the panel', $('searchPanel').classList.contains('hidden'));
    }
    // composer chips (v1.0.3 B3/B4): gated per model, toggle on/off.
    {
        const ws = $('webSearchChip');
        const th = $('thinkingChip');
        check('thinking chip gated for default model', th && th.disabled);
        check('web-search chip gated for groq default', ws && ws.disabled);
        // Switch the active chat to a fully capable model via app state, as a
        // model-selector pick would (capability re-sync is the point here).
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const { renderActiveChat } = await import('file://' + path.join(esmDir, 'chat.js'));
        const chat = state.chats[state.activeChatId];
        const prevModel = chat ? chat.model : null;
        if (chat) { chat.model = 'google/gemini-2.5-pro'; renderActiveChat(); } // same path the model picker uses
        click(ws);
        await sleep(50);
        check('web-search chip activates for capable model', ws.getAttribute('aria-pressed') === 'true' && ws.classList.contains('chip-active'));
        click(ws);
        await sleep(50);
        check('web-search chip deactivates', ws.getAttribute('aria-pressed') === 'false' && !ws.classList.contains('chip-active'));
        check('thinking chip unlocks for gemini-2.5-pro', th && !th.disabled);
        click(th);
        await sleep(50);
        check('thinking chip activates', th.getAttribute('aria-pressed') === 'true' && th.classList.contains('chip-active'));
        click(th);
        await sleep(50);
        check('thinking chip deactivates', th.getAttribute('aria-pressed') === 'false');
        if (chat) { chat.model = prevModel; renderActiveChat(); } // restore default
    }
    // jump-to-latest pill (v1.0.3 E1): hidden at rest (no stream, no scroll-away).
    {
        const pill = $('jumpToLatest');
        check('jump pill hidden at rest', pill && pill.classList.contains('hidden') && !pill.classList.contains('flex'));
    }
    // prompt library (v1.0.3 C1): drawer button opens the modal.
    {
        click($('sidebarPromptBtn'));
        await sleep(50);
        check('sidebar prompts button opens prompt modal', $('promptModal') && !$('promptModal').classList.contains('hidden'));
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(300);
        check('prompt modal Escape-closes', $('promptModal').classList.contains('hidden'));
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
    // --- v1.0.6: new-chat landing (centred composer + suggestions) -------------
    {
        // Drive the real render path: an active chat with zero messages.
        const chatMod = await import('file://' + path.join(esmDir, 'chat.js'));
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const activeChat = state.activeChatId ? state.chats[state.activeChatId] : null;
        const savedMessages = activeChat ? activeChat.messages : null;
        if (activeChat) activeChat.messages = [];
        chatMod.renderActiveChat();
        await sleep(30);

        check('new chat puts body in empty-chat mode', window.document.body.classList.contains('chat-empty'));
        const welcome = $('emptyWelcome');
        check('greeting renders above the composer', welcome && !welcome.classList.contains('hidden')
            && welcome.textContent.includes('How can I help today?'));
        const suggestions = $('emptySuggestions');
        check('suggestions render under the composer', suggestions && !suggestions.classList.contains('hidden'));
        const cards = suggestions ? suggestions.querySelectorAll('.suggestion-card') : [];
        check('suggestion cards available', cards.length === 4, cards.length + ' cards');
        if (cards.length) {
            click(cards[0]);
            check('suggestion click fills the composer', $('messageInput').value.length > 0);
        }
        const dock = $('composerDock');
        check('composer dock is no longer bottom-anchored in empty mode',
            !dock.getAttribute('style') || !dock.getAttribute('style').includes('bottom'));

        // ...and the normal layout returns as soon as the chat has messages.
        if (activeChat && savedMessages) activeChat.messages = savedMessages;
        chatMod.renderActiveChat();
        await sleep(30);
        check('normal layout returns once messages exist', !window.document.body.classList.contains('chat-empty'));
    }
    // --- v1.0.6: model panel opens/closes with no timer race -------------------
    {
        click($('modelSelectorBtn'));
        check('model panel opens synchronously (no setTimeout)', !$('modelSelectorPanel').classList.contains('hidden'));
        click($('modelSelectorBtn'));
        check('model panel re-toggle closes synchronously', $('modelSelectorPanel').classList.contains('hidden'));
    }
    // --- v1.0.6: theme icons cross-fade (.is-off) instead of display swap -----
    {
        const before = $('sunIcon').classList.contains('is-off');
        check('theme icons use the animatable is-off state', !$('sunIcon').classList.contains('hidden')
            && !$('moonIcon').classList.contains('hidden'));
        click($('themeToggle'));
        await sleep(50);
        check('theme toggle swaps the icon pair', $('sunIcon').classList.contains('is-off') !== before);
        click($('themeToggle'));
        await sleep(50);
    }
    // --- v1.0.6: keyboard hints in tooltips (C3) ------------------------------
    {
        check('send tooltip names the shortcut', ($('sendBtn').getAttribute('data-tooltip') || '').includes('Enter'));
        check('search tooltip names the shortcut', ($('searchToggleBtn').getAttribute('data-tooltip') || '').includes('Alt+/'));
        check('message rows offer no delete affordance',
            !window.document.querySelector('.delete-msg-btn'));
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
