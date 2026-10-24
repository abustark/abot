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
            if (prop in t) return t[prop];
            if (prop === 'onAuthStateChanged') return (cb) => { authCallbacks.push(cb); return () => {}; };
            if (prop === 'then') return undefined;
            return stubChain('auth.' + String(prop));
        },
        // allows tests to override specific props (e.g. currentUser) while
        // every other property keeps returning the generic stub.
        set(t, prop, val) { t[prop] = val; return true; },
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
    global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.requestAnimationFrame = global.requestAnimationFrame;
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

    const fakeUser = { uid: 'u1', displayName: 'T', isAnonymous: false, emailVerified: true, photoURL: null };
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
    // theme (2.2.8: the header toggle was removed with the overflow menu — the
    // account-menu switch is now the only theme control; flip it directly)
    {
        const before = window.document.documentElement.classList.contains('dark');
        const sw = $('sidebarThemeSwitch');
        sw.checked = !before;
        sw.dispatchEvent(new window.Event('change', { bubbles: true }));
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
    // account menu (v1.0.7): the profile row owns import / theme / TTS / timestamps
    {
        const menu = $('profileMenu');
        const trigger = $('profileMenuBtn');
        check('menu closed at rest', menu.classList.contains('hidden'));
        click(trigger);
        await sleep(50);
        check('account menu opens from the profile row', !menu.classList.contains('hidden'));
        check('trigger reports expanded state', trigger.getAttribute('aria-expanded') === 'true');
        check('menu carries menu semantics', menu.getAttribute('role') === 'menu');
        check('import chat lives in the menu', menu.contains($('importChatBtn')));
        check('read-aloud switch lives in the menu', menu.contains($('ttsToggle')));
        check('timestamps switch lives in the menu', menu.contains($('timestampsToggle')));
        const rows = [...menu.querySelectorAll('.menu-row')];
        check('sign out is the last row', rows.length > 0 && rows[rows.length - 1].id === 'signoutBtn');
        check('sign out is the red row',
            rows.length > 0 && rows[rows.length - 1].classList.contains('menu-row-danger'));
        // Dark mode is a real checkbox now, so the knob slides via :checked in CSS.
        const sw = $('sidebarThemeSwitch');
        check('theme switch is a checkbox in the menu',
            !!sw && sw.type === 'checkbox' && sw.getAttribute('role') === 'switch' && menu.contains(sw));
        const darkBefore = window.document.documentElement.classList.contains('dark');
        sw.checked = !sw.checked;
        sw.dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(50);
        const darkAfter = window.document.documentElement.classList.contains('dark');
        check('theme switch toggles dark mode', darkBefore !== darkAfter, `${darkBefore}->${darkAfter}`);
        check('theme switch checked state tracks the theme', sw.checked === darkAfter);
        // Flip it back through the switch itself.
        sw.checked = !sw.checked;
        sw.dispatchEvent(new window.Event('change', { bubbles: true }));
        await sleep(50);
        check('theme restored', window.document.documentElement.classList.contains('dark') === darkBefore);
        // Switch rows keep the menu open; Escape closes it and restores focus.
        sw.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        await sleep(30);
        check('switch rows keep the menu open', !menu.classList.contains('hidden'));
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(30);
        check('Escape closes the account menu', menu.classList.contains('hidden'));
        check('focus returns to the profile row', window.document.activeElement === trigger);
        if (sw.checked !== darkBefore) { sw.checked = darkBefore; sw.dispatchEvent(new window.Event('change', { bubbles: true })); }
    }
    // composer layout + morph state (v1.0.4): chips inside the box, stop hidden at rest
    {
        const box = $('messageInput') && $('messageInput').parentElement;
        check('chips sit inside the composer box', !!box && box.contains($('webSearchChip')) && box.contains($('sendBtn')));
        check('stop control hidden at rest', $('stopBtn').classList.contains('stop-hidden'));
        // 2.2.8: the sidebar's duplicate current-chat block was removed — the
        // header title is the single display, rename lives in each row menu.
        check('sidebar no longer duplicates the current chat',
            !$('sidebarCurrentChat') && !$('chatTitle') && !$('chatTitleInput') && !$('renameChatBtn'));
    }
    // search (2.3.5: the header toggle opens it, and an EMPTY chat now gets an
    // info toast instead of a dead sheet — seed a chat with messages first)
    {
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const priorChats = state.chats;
        const priorActive = state.activeChatId;
        const srchChat = (messages) => ({ id: 'srch1', name: 'Search test', model: 'gemini-2.5-flash', messages });

        // guard: nothing to search in an empty chat — info toast, panel stays shut
        state.chats = { srch1: srchChat([]) };
        state.activeChatId = 'srch1';
        click($('headerSearchBtn'));
        await sleep(60);
        check('search stays closed on an empty chat', $('searchPanel').classList.contains('hidden'));
        const guardToast = [...window.document.querySelectorAll('.abot-toast .toast-msg')].find((n) => n.textContent.includes('no messages'));
        check('empty-chat search shows an info toast', !!guardToast, guardToast ? guardToast.textContent : 'no toast found');
        if (guardToast) guardToast.closest('.abot-toast').remove();

        // happy path: a chat with messages opens the sheet + backdrop
        state.chats = { srch1: srchChat([{ role: 'user', content: 'hello world' }, { role: 'assistant', content: 'hi there' }]) };
        click($('headerSearchBtn'));
        await sleep(50);
        check('header search button opens search panel', $('searchPanel') && !$('searchPanel').classList.contains('hidden'));
        // v1.0.4: explicit dismiss — the panel had no way out once opened.
        click($('searchCloseBtn'));
        await sleep(50);
        check('search close button dismisses the panel', $('searchPanel').classList.contains('hidden'));
        // v2.0.7: backdrop is part of the sheet — opens with it, dismisses on tap.
        check('search backdrop hidden after close', $('searchBackdrop').classList.contains('hidden'));
        click($('headerSearchBtn'));
        await sleep(50);
        check('search reopen shows backdrop', !$('searchBackdrop').classList.contains('hidden'));
        click($('searchBackdrop'));
        await sleep(50);
        check('backdrop tap closes search', $('searchPanel').classList.contains('hidden') && $('searchBackdrop').classList.contains('hidden'));

        state.chats = priorChats;
        state.activeChatId = priorActive;
    }
    // header (2.2.8): the "⋯" overflow menu was removed (owner request) — the
    // header carries the sidebar toggle + new chat only; theme/search/prompts
    // are reached from the account menu, sidebar quick actions and palette.
    {
        check('header overflow menu removed', !$('headerOverflowBtn') && !$('headerOverflowMenu'));
        check('removed header controls are gone',
            !$('themeToggle') && !$('searchToggleBtn') && !$('promptBtn') && !$('sunIcon') && !$('moonIcon'));
        check('header carries history, search and new-chat controls',
            !!$('headerNewChatBtn') && $('appHeader').contains($('headerNewChatBtn'))
            && $('appHeader').querySelectorAll('button').length === 3);
        check('sidebar quick actions visible on desktop too',
            !!$('sidebarQuickActions') && !$('sidebarQuickActions').classList.contains('md:hidden'));
        check('composer chips carry aria-labels',
            $('webSearchChip') && $('webSearchChip').getAttribute('aria-label') === 'Web search'
            && $('thinkingChip') && $('thinkingChip').getAttribute('aria-label') === 'Think');
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
        if (chat) { chat.model = 'google/gemini-3.8-flash'; renderActiveChat(); } // same path the model picker uses
        click(ws);
        await sleep(50);
        check('web-search chip activates for capable model', ws.getAttribute('aria-pressed') === 'true' && ws.classList.contains('chip-active'));
        click(ws);
        await sleep(50);
        check('web-search chip deactivates', ws.getAttribute('aria-pressed') === 'false' && !ws.classList.contains('chip-active'));
        check('thinking chip unlocks for gemini-3.8-flash', th && !th.disabled);
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
        const cards = suggestions ? suggestions.querySelectorAll('.suggestion-pill') : [];
        check('suggestion pills available', cards.length === 8, cards.length + ' pills');
        if (cards.length) {
            click(cards[0]);
            check('suggestion click fills the composer', $('messageInput').value.length > 0);
        }
        const dock = $('composerDock');
        check('composer dock is no longer bottom-anchored in empty mode',
            !dock.getAttribute('style') || !dock.getAttribute('style').includes('bottom'));

        // ...and the normal layout returns as soon as the chat has messages.
        // Probe with a guaranteed non-empty thread (the active chat is an
        // untouched "New Chat" in this environment, so restoring savedMessages
        // can legitimately restore an empty array and keep chat-empty on),
        // then restore whatever the suite had.
        if (activeChat) {
            activeChat.messages = [
                { role: 'user', content: 'layout probe', ts: Date.now() },
                { role: 'assistant', content: 'ack', ts: Date.now() }
            ];
        }
        chatMod.renderActiveChat();
        await sleep(30);
        check('normal layout returns once messages exist', !window.document.body.classList.contains('chat-empty'));
        if (activeChat) activeChat.messages = savedMessages || [];
        chatMod.renderActiveChat();
        await sleep(30);
    }
    // --- 2.3.7: New Chat never piles up empty chats -----------------------------
    {
        const chatMod = await import('file://' + path.join(esmDir, 'chat.js'));
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const priorChats = state.chats;
        const priorActive = state.activeChatId;
        const mkChat = (id, messages) => ({ id, name: 'New Chat', model: 'gemini-2.5-flash', messages });

        // On an untouched chat: the click must not add a row, and stays here.
        state.chats = { '1001': mkChat('1001', []) };
        state.activeChatId = '1001';
        await chatMod.createNewChat();
        await sleep(30);
        check('New Chat on an untouched chat adds no new row',
            Object.keys(state.chats).length === 1 && state.activeChatId === '1001');
        check('repeat New Chat notifies via info toast',
            [...window.document.querySelectorAll('.abot-toast .toast-msg')].some(n => n.textContent.includes('already have a new chat')));

        // With another untouched chat around: the newest one is reused, not recreated.
        state.chats = {
            '1001': mkChat('1001', []),
            '1002': mkChat('1002', [{ role: 'user', content: 'hi', ts: Date.now() }]),
            '1003': mkChat('1003', []),
        };
        state.activeChatId = '1002';
        await chatMod.createNewChat();
        await sleep(30);
        check('New Chat reuses the newest untouched chat',
            Object.keys(state.chats).length === 3 && state.activeChatId === '1003');
        check('reuse path notifies via info toast',
            [...window.document.querySelectorAll('.abot-toast .toast-msg')].some(n => n.textContent.includes('Switched to your existing new chat')));

        state.chats = priorChats;
        state.activeChatId = priorActive;
        chatMod.renderActiveChat();
        await sleep(20);
    }
    // --- v1.0.6: model panel opens/closes with no timer race -------------------
    {
        click($('modelSelectorBtn'));
        check('model panel opens synchronously (no setTimeout)', !$('modelSelectorPanel').classList.contains('hidden'));
        click($('modelSelectorBtn'));
        check('model panel re-toggle closes synchronously', $('modelSelectorPanel').classList.contains('hidden'));
    }
    // --- 2.4.4: outside pointerdown closes the model panel (capture phase) -----
    {
        click($('modelSelectorBtn'));
        check('panel open before pointerdown test', !$('modelSelectorPanel').classList.contains('hidden'));
        window.document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
        check('outside pointerdown closes the model panel', $('modelSelectorPanel').classList.contains('hidden'));
    }
    // --- 2.2.6 revamp: header + composer layout --------------------------------
    {
        const dock = $('composerDock');
        const selectorBtn = $('modelSelectorBtn');
        const selectorPanel = $('modelSelectorPanel');
        const header = $('appHeader');
        // 2.4.4: the PILL stays composer-hosted, but the panel now lives on
        // <body> (fixed-positioned against the pill by app.js) so the landing
        // dock's scroll container can never clip it or grow a phantom
        // scrollbar; the old contract asserted dock.contains(panel).
        check('model selector pill is composer-hosted, panel is body-level',
            dock.contains(selectorBtn) && !header.contains(selectorBtn)
            && window.document.body.contains(selectorPanel),
            'composer pill + body-anchored panel');
        const headerTitle = $('headerChatTitle');
        // 2.2.8: compare against the active chat's real name — the sidebar
        // duplicate title it used to mirror is gone.
        const { state: tState } = await import('file://' + path.join(esmDir, 'state.js'));
        const tActive = tState.activeChatId ? tState.chats[tState.activeChatId] : null;
        check('header shows the active chat title',
            !!headerTitle && header.contains(headerTitle)
            && !!tActive && headerTitle.textContent === tActive.name,
            JSON.stringify(headerTitle ? headerTitle.textContent : null));
        check('jump button is icon-only (no text)',
            ($('jumpToLatest').textContent || '').trim() === '',
            'aria-label carries the meaning');
    }
    // --- 2.2.8: the B6 sun/moon icon pair was removed with the overflow menu ---
    {
        check('theme icon pair removed', !$('sunIcon') && !$('moonIcon'));
    }
    // --- v1.0.6: brand mark is theme-aware (black in light, white in dark) -----
    {
        const marks = [...window.document.querySelectorAll('img[src="/logo.png"]')];
        // 2.2.6 revamp: the header logo was replaced by the chat title, so 2
        // static placements remain (auth card + sidebar) plus the empty-state
        // logo while the landing renders. The class invariant is the real check.
        check('every on-page logo carries the silhouette class',
            marks.length >= 2 && marks.every(img => img.classList.contains('logo-mark')),
            marks.length + ' placements');
        const themed = [...window.document.querySelectorAll('link[rel="icon"][media]')]
            .map(l => l.getAttribute('href'));
        check('tab icon has a per-theme pair',
            themed.includes('/favicon-32-light.png') && themed.includes('/favicon-32-dark.png'),
            themed.join(' '));
    }
    // --- v1.0.7: auth backdrop is CSS-only; the app ships no CDN scripts -------
    {
        const scene = $('auth-scene');
        // 2.4.1: the CSS aurora blooms were replaced by the twinkling sparkle
        // canvas — the backdrop contract is now "scene + canvas".
        const sparklesCanvas = $('auth-sparkles');
        check('auth backdrop renders the sparkle canvas', !!scene && !!sparklesCanvas, sparklesCanvas ? 'canvas present' : 'canvas missing');
        check('old vanta canvas is gone', !$('vanta-bg'));
        const cdnScripts = [...window.document.querySelectorAll('script[src]')]
            .map(s => s.getAttribute('src'))
            .filter(src => /cdn\.jsdelivr|cdnjs\.cloudflare|unpkg/.test(src));
        check('no third-party CDN scripts are loaded', cdnScripts.length === 0, cdnScripts.join(' '));
    }
    // --- v1.0.6: keyboard hints in tooltips (C3) ------------------------------
    {
        check('send tooltip names the shortcut', ($('sendBtn').getAttribute('data-tooltip') || '').includes('Enter'));
        check('new-chat tooltip names the shortcut', ($('headerNewChatBtn').getAttribute('data-tooltip') || '').includes('Alt+N'));
        check('message rows offer no delete affordance',
            !window.document.querySelector('.delete-msg-btn'));
    }
    // toast stack (v2.0.9 roadmap #4): multiple toasts, close, promise states
    {
        const utils = await import('file://' + path.join(esmDir, 'utils.js'));
        const stack = $('toast-stack');
        // Deterministic start: earlier steps (e.g. the empty-chat search info
        // toast) can still be alive — auto-dismiss is time-based — so clear
        // whatever is on screen before asserting a stack of exactly 2.
        stack.querySelectorAll('.abot-toast .toast-close').forEach((b) => b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
        await sleep(320);
        utils.showToast('first toast');
        utils.showToast('second toast');
        await sleep(60);
        const count0 = stack.querySelectorAll('.abot-toast').length;
        check('toasts stack (2 visible)', count0 === 2, count0 + ' shown');

        stack.querySelector('.abot-toast .toast-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        await sleep(280);
        check('toast close removes it', stack.querySelectorAll('.abot-toast').length === 1);

        await utils.toast.promise(Promise.resolve('ok'), { loading: 'Saving…', success: 'Saved!' });
        await sleep(60);
        const last = stack.querySelector('.abot-toast:last-child .toast-msg');
        check('toast.promise swaps to success', last && last.textContent === 'Saved!', last && last.textContent);

        stack.querySelectorAll('.abot-toast .toast-close').forEach((b) => b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
        await sleep(280);
    }
    // modal hardening (v2.0.9 roadmap #6): focus trap + Escape close
    {
        click($('signoutBtn'));
        await sleep(60);
        const modal = $('deleteModal');
        check('signout dialog opens', !modal.classList.contains('hidden'));
        // focus trap: Tab on last focusable wraps to first
        window.document.getElementById('deleteConfirmBtn').focus();
        modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        await sleep(30);
        check('focus trapped (Tab wraps to first focusable)',
            modal.contains(window.document.activeElement) && window.document.activeElement !== window.document.getElementById('deleteConfirmBtn'),
            window.document.activeElement.id || window.document.activeElement.tagName);
        // Escape closes the dialog
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(280);
        check('Escape closes dialog', modal.classList.contains('hidden'));

        // 2.4.10 (owner report): the sign-out dialog's confirm button used to be
        // clone-replaced with a {once:true} handler per open — that detached the
        // chat-delete handler (bound once at init) and left later Enter presses
        // dead. Regression: re-open + cancel the sign-out dialog, then the
        // shared confirm must still run DELETE — via Enter on the focused button.
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const { deleteChat } = await import('file://' + path.join(esmDir, 'chat.js'));
        click($('signoutBtn'));
        await sleep(60);
        check('signout confirm marked as signout action', $('deleteConfirmBtn').dataset.action === 'signout');
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(280);

        const prevProbeUser = state.auth.currentUser;
        state.auth.currentUser = { uid: 'regression-probe' };
        state.chats['7776'] = { id: 7776, name: 'Regression probe', model: 'groq/openai/gpt-oss-120b', messages: [] };
        deleteChat('7776');
        await sleep(60);
        check('delete dialog marked as delete action', $('deleteConfirmBtn').dataset.action === 'delete');
        check('delete dialog reopened after the signout cancel', !modal.classList.contains('hidden'));
        $('deleteConfirmBtn').focus();
        $('deleteConfirmBtn').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await sleep(320);
        check('Enter on focused confirm activates (dialog closes)', modal.classList.contains('hidden'));
        check('delete confirm does NOT sign out (cross-wire regression)', state.isAppInitialized !== false);
        state.auth.currentUser = prevProbeUser;
        delete state.chats['7776'];
    }
    // model panel typeahead (v2.0.9 roadmap #5)
    {
        click($('modelSelectorBtn'));
        await sleep(320);
        const panel = $('modelSelectorPanel');
        panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true }));
        await sleep(30);
        const active = window.document.activeElement;
        check('typeahead jumps to matching model',
            panel.contains(active) && (active.textContent || '').trim().toLowerCase().startsWith('g'),
            active && (active.textContent || '').trim().slice(0, 24));
        click(document.body);
        await sleep(260);
    }

    // --- M1: email verification view and controls ----------------------------
    {
        const verifyView = $('verify-email-view');
        const checkBtn = $('check-verification-btn');
        const resendBtn = $('resend-verification-btn');
        const backToLogin = $('verify-back-to-login');
        check('verify email view exists in auth card', !!verifyView && verifyView.style.display === 'none');
        check('verify email action buttons present', !!checkBtn && !!resendBtn && !!backToLogin);
    }
    // --- M2: chat-name XSS hardening -----------------------------------------
    {
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const { renderChatList, deleteChat } = await import('file://' + path.join(esmDir, 'chat.js'));
        const maliciousName = '<img src=x onerror=alert(1)>';
        state.chats['9999'] = { id: 9999, name: maliciousName, messages: [] };
        renderChatList();
        const chatItem = window.document.querySelector('[data-chat-id="9999"]');
        const span = chatItem ? chatItem.querySelector('.chat-name-span') : null;
        check('malicious chat name rendered as text in sidebar', !!span && span.textContent === maliciousName);
        check('no img tag injected into sidebar chat item', !span?.querySelector('img'));

        // 2.4.6: chat-row ⋮ menu Escape-closes (was outside-click only).
        const rowOptionsBtn = chatItem ? chatItem.closest('.chat-list-item').querySelector('.chat-options-btn') : null;
        rowOptionsBtn?.click();
        check('chat row options menu opens', !!window.document.querySelector('.chat-options-menu:not(.hidden)'));
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        check('Escape closes chat row options menu', !window.document.querySelector('.chat-options-menu:not(.hidden)'));

        // 2.4.10 (owner request): ⋮ menu arrow-key navigation.
        rowOptionsBtn?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        check('ArrowDown opens the ⋮ menu', !!window.document.querySelector('.chat-options-menu:not(.hidden)'));
        check('first item focused (Rename)', window.document.activeElement?.textContent === 'Rename', window.document.activeElement?.textContent);
        window.document.activeElement?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        check('ArrowDown moves focus to Export JSON', window.document.activeElement?.textContent === 'Export JSON', window.document.activeElement?.textContent);
        window.document.activeElement?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        check('ArrowUp moves focus back to Rename', window.document.activeElement?.textContent === 'Rename', window.document.activeElement?.textContent);
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        check('Escape closes the menu and restores focus to the ⋮ trigger',
            !window.document.querySelector('.chat-options-menu:not(.hidden)') && window.document.activeElement === rowOptionsBtn);
        check('trigger reports collapsed state', rowOptionsBtn?.getAttribute('aria-expanded') === 'false');

        deleteChat('9999');
        const deleteBody = $('deleteModalBody');
        check('delete modal renders malicious chat name safely', !deleteBody?.querySelector('img') && deleteBody?.textContent.includes(maliciousName));
        delete state.chats['9999'];
        renderChatList();
    }
    // --- M3: markdown output sanitization ------------------------------------
    {
        const { sanitizeHtml } = await import('file://' + path.join(esmDir, 'utils.js'));
        const dirtyPayload = '<script>alert("pwned")</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad link</a>';
        const sanitized = sanitizeHtml(dirtyPayload);
        check('sanitizer removes script tags', !sanitized.includes('<script>') && !sanitized.includes('pwned'));
        check('sanitizer strips onerror handlers', !sanitized.includes('onerror'));
        check('sanitizer strips javascript: hrefs', !sanitized.includes('javascript:'));
        const safeHtml = sanitizeHtml('<p><strong>bold text</strong> and <a href="https://example.com">link</a></p>');
        check('sanitizer preserves valid formatting and secures links', safeHtml.includes('<strong>bold text</strong>') && safeHtml.includes('rel="noopener noreferrer"'));
    }
    // --- 2.2.4: error-card Retry + FM-4 (a failed interim save no longer aborts the send) ---
    {
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const { renderActiveChat } = await import('file://' + path.join(esmDir, 'chat.js'));
        const prevActive = state.activeChatId;
        const realDb = state.db;
        const model = 'groq/openai/gpt-oss-120b';
        const userMsg = () => ({ role: 'user', content: 'hello', model, ts: Date.now() });
        const errMsg = () => ({ role: 'assistant', content: 'Connection error: test', model, isError: true, ts: Date.now() });

        state.chats['8888'] = { id: 8888, name: 'Retry Test', messages: [userMsg(), errMsg()], model };
        state.activeChatId = '8888';
        renderActiveChat();
        await sleep(30);
        const retry = window.document.querySelector('.retry-btn');
        check('trailing error card renders a labelled Retry', !!retry && retry.getAttribute('aria-label') === 'Retry');

        // Error card no longer last (the user kept chatting) → Retry must hide.
        state.chats['8888'].messages.push(userMsg());
        renderActiveChat();
        await sleep(30);
        check('stale error cards hide Retry', !window.document.querySelector('.retry-btn'));

        // Click route with a failing Firestore save (FM-4): the send must still
        // proceed. jsdom has no network and the fake auth user has no
        // getIdToken, so it lands on a fresh error card with a fresh Retry.
        state.chats['8888'].messages = [userMsg(), errMsg()];
        renderActiveChat();
        await sleep(30);
        state.db = { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ update: () => Promise.reject(new Error('simulated save failure')) }) }) }) }) };
        const btn = window.document.querySelector('.retry-btn');
        if (btn) click(btn);
        await sleep(120);
        const toastText = ($('toast-stack') || {}).textContent || '';
        check('FM-4: failed save warns but keeps sending', toastText.includes("Couldn't save"));
        check('FM-4: prompt still sent (composer cleared)', $('messageInput').value === '');
        check('Retry re-attempted — fresh error card carries Retry', !!window.document.querySelector('.retry-btn'));

        state.db = realDb;
        delete state.chats['8888'];
        state.activeChatId = prevActive;
        renderActiveChat();
        await sleep(30);
    }

    // --- 2.4.9: message action rows (owner spec — user copy · read aloud · edit;
    // AI hover row + static end row; end row only after the reply finishes) ---
    {
        const { state } = await import('file://' + path.join(esmDir, 'state.js'));
        const chatMod = await import('file://' + path.join(esmDir, 'chat.js'));
        const prevActive = state.activeChatId;
        const model = 'groq/openai/gpt-oss-120b';
        const aiContainers = () => [...window.document.querySelectorAll('#chatHistory .message-container:not(.justify-end)')];

        state.chats['7777'] = {
            id: 7777, name: 'Actions Test', model,
            messages: [
                { role: 'user', content: 'ping', model, ts: Date.now() },
                { role: 'assistant', content: 'pong', model, ts: Date.now() },
            ],
        };
        state.activeChatId = '7777';
        chatMod.renderActiveChat();
        await sleep(30);

        const userContainer = window.document.querySelector('#chatHistory .message-container.justify-end');
        check('user row offers copy · read aloud · edit',
            !!userContainer?.querySelector('.copy-message-btn') && !!userContainer?.querySelector('.speak-btn') && !!userContainer?.querySelector('.edit-msg-btn'));
        check('user row has exactly three actions',
            userContainer ? userContainer.querySelectorAll('button').length === 3 : false,
            userContainer ? userContainer.querySelectorAll('button').length + ' buttons' : 'no row');

        // 2.5.14 (owner request): edit happens inline inside the bubble — no
        // browser prompt dialog. Escape cancels and restores the original text.
        const editBtnEl = userContainer?.querySelector('.edit-msg-btn');
        if (editBtnEl) {
            click(editBtnEl);
            const editTa = userContainer.querySelector('.user-edit-input');
            check('edit opens an inline textarea in the bubble', !!editTa && editTa.value === 'ping');
            if (editTa) {
                editTa.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                check('Escape cancels the inline edit',
                    !userContainer.querySelector('.user-edit-wrap')
                    && userContainer.querySelector('.prose')?.textContent === 'ping');
            }
        }

        // 2.4.10 (owner request): on touch, a tap on the user bubble reveals
        // the actions; a second tap — or a tap outside — dismisses them.
        const realMatchMediaTap = window.matchMedia;
        window.matchMedia = (q) => ({ matches: String(q).includes('hover: none'), media: String(q), addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} });
        const bubbleEl = userContainer?.querySelector('.user-bubble');
        if (bubbleEl) {
            click(bubbleEl);
            check('tap on the user bubble reveals the actions', !!userContainer?.classList.contains('actions-open'));
            click(bubbleEl);
            check('second tap hides them again', !userContainer?.classList.contains('actions-open'));
            click(bubbleEl);
            click(window.document.body);
            check('tapping outside dismisses the revealed actions', !userContainer?.classList.contains('actions-open'));
        }
        window.matchMedia = realMatchMediaTap || ((q) => ({ matches: false, media: String(q), addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} }));

        // 2.4.12 (owner report: speak button showed "playing" but stayed silent):
        // without Web Speech the button must refuse politely — info toast, no
        // pressed state, no throw.
        const speakBtnEl = userContainer?.querySelector('.speak-btn');
        if (speakBtnEl) {
            const realSpeechSynthesis = window.speechSynthesis;
            window.speechSynthesis = undefined;
            click(speakBtnEl);
            await sleep(30);
            check('speak without Web Speech shows an info toast and never lies about playing',
                speakBtnEl.getAttribute('aria-pressed') !== 'true'
                && [...window.document.querySelectorAll('.abot-toast .toast-msg')].some((n) => n.textContent.includes('not supported')));
            window.speechSynthesis = realSpeechSynthesis;
        }

        const aiContainer = aiContainers().pop();
        const endRow = aiContainer?.querySelector('.msg-actions-end');
        check('finished AI reply carries the static end row', !!endRow);
        check('end row = copy + read aloud only (no edit)',
            endRow ? !!endRow.querySelector('.copy-message-btn') && !!endRow.querySelector('.speak-btn') && !endRow.querySelector('.edit-msg-btn') : false);
        check('AI hover row keeps its copy + read aloud pair',
            aiContainer ? aiContainer.querySelectorAll('.copy-message-btn').length === 2 && aiContainer.querySelectorAll('.speak-btn').length === 2 : false);

        // A mid-stream placeholder (no index, not history) must defer the row.
        chatMod.appendMessage({ role: 'assistant', content: '', model, ts: Date.now() }, false, {});
        check('streaming placeholder defers the end row', !aiContainers().pop()?.querySelector('.msg-actions-end'));
        chatMod.renderActiveChat();
        await sleep(30);

        // Error cards keep Retry alone — no action pair under the alert.
        state.chats['7777'].messages.push({ role: 'assistant', content: 'boom', model, isError: true, ts: Date.now() });
        chatMod.renderActiveChat();
        await sleep(30);
        const errContainer = aiContainers().pop();
        check('error card gets no end row', !!errContainer && !errContainer.querySelector('.msg-actions-end') && !!errContainer.querySelector('.retry-btn'));
        // 2.4.15 (owner report): error cards are no-copy text.
        check('error card offers no copy · speak', !!errContainer && !errContainer.querySelector('.copy-message-btn') && !errContainer.querySelector('.speak-btn'));
        state.chats['7777'].messages.pop();
        chatMod.renderActiveChat();
        await sleep(30);

        // Full streamed round-trip: no row while streaming, row when done.
        const enc = new TextEncoder();
        const sse = (obj) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
        const realFetch = window.fetch;
        const realGlobalFetch = global.fetch;
        const realGetIdToken = fakeUser.getIdToken;
        // sendMessage() reads state.auth.currentUser — swap in the stub user.
        const prevCurrentUser = state.auth.currentUser;
        state.auth.currentUser = fakeUser;
        fakeUser.getIdToken = async () => 'test-token';
        const fakeFetch = async () => {
            const parts = [
                sse({ choices: [{ delta: { content: 'Hello ' } }] }),
                sse({ choices: [{ delta: { content: 'world' } }] }),
                enc.encode('data: [DONE]\n\n'),
            ];
            let i = 0;
            return { ok: true, body: { getReader: () => ({ read: async () => (i < parts.length ? { done: false, value: parts[i++] } : { done: true, value: undefined }) }) } };
        };
        // chat.js calls bare fetch() — in this harness that resolves to Node's
        // global fetch, not window.fetch, so both need the stub.
        window.fetch = fakeFetch;
        global.fetch = fakeFetch;
        $('messageInput').value = 'stream probe';
        await chatMod.sendMessage();
        await sleep(80);
        const streamed = aiContainers().pop();
        check('streamed reply renders + gains the end row once finished',
            !!streamed?.querySelector('.msg-actions-end') && streamed?.querySelector('.prose')?.textContent.includes('Hello world'));
        window.fetch = realFetch;
        global.fetch = realGlobalFetch;
        state.auth.currentUser = prevCurrentUser;
        if (realGetIdToken === undefined) delete fakeUser.getIdToken; else fakeUser.getIdToken = realGetIdToken;

        delete state.chats['7777'];
        state.activeChatId = prevActive;
        chatMod.renderActiveChat();
        await sleep(30);
    }

    console.log(fails ? `\n${fails} INTERACTION FAILURE(S) ❌` : '\nALL INTERACTIONS PASS ✅');
    process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
