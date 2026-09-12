/**
 * ABot — palette.js
 * Ctrl+K command palette (UI roadmap #8). Keyboard-first: no open
 * animation (per animate skill), quick fade-out only. Actions reuse
 * existing exported behaviors — zero new AI API calls.
 */

import { dom } from './dom.js';
import { state } from './state.js';
import { createNewChat, exportChat, exportChatMarkdown, switchChat } from './chat.js';
import { openPromptModal } from './ui.js';
import { stopSpeaking } from './utils.js';

let isOpen = false;
let commands = [];
let filtered = [];
let activeIndex = 0;

const buildCommands = () => {
    const chatCommands = Object.values(state.chats)
        .sort((a, b) => String(b.id).localeCompare(String(a.id)))
        .slice(0, 12)
        .map((chat) => ({
            label: chat.name || 'Untitled chat',
            hint: 'Chat',
            keywords: 'chat open go',
            run: () => switchChat(chat.id),
        }));

    const exportActive = state.activeChatId
        ? [
            { label: 'Export current chat as JSON', hint: 'Export', keywords: 'export download json', run: () => exportChat(state.activeChatId) },
            { label: 'Export current chat as Markdown', hint: 'Export', keywords: 'export download markdown md', run: () => exportChatMarkdown(state.activeChatId) },
        ]
        : [];

    return [
        { label: 'New chat', hint: 'Action', keywords: 'new chat create', run: () => createNewChat() },
        ...chatCommands,
        { label: 'Open prompt library', hint: 'Action', keywords: 'prompt library system instructions preset', run: () => openPromptModal() },
        { label: 'Search messages', hint: 'Action', keywords: 'search find messages', run: () => { dom.searchPanel.classList.remove('hidden'); dom.messageSearchInput?.focus(); } },
        { label: 'Toggle theme', hint: 'Action', keywords: 'theme dark light mode toggle', run: () => dom.themeToggle.click() },
        { label: 'Toggle sidebar', hint: 'Action', keywords: 'sidebar toggle history', run: () => dom.sidebarToggle.click() },
        { label: 'Toggle timestamps', hint: 'Action', keywords: 'timestamps time show hide', run: () => { dom.timestampsToggle.checked = !dom.timestampsToggle.checked; dom.timestampsToggle.dispatchEvent(new Event('change', { bubbles: true })); } },
        ...exportActive,
    ];
};

const renderList = () => {
    dom.commandPaletteList.innerHTML = '';
    if (!filtered.length) {
        dom.commandPaletteList.innerHTML = '<div class="px-3 py-6 text-sm text-muted text-center">No matching commands.</div>';
        return;
    }
    filtered.forEach((cmd, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'palette-item';
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', String(i === activeIndex));
        btn.innerHTML = `<span class="truncate">${cmd.label}</span><span class="palette-hint">${cmd.hint}</span>`;
        btn.addEventListener('click', () => runCommand(cmd));
        btn.addEventListener('mousemove', () => setActive(i));
        dom.commandPaletteList.appendChild(btn);
    });
    const active = dom.commandPaletteList.querySelector('[aria-selected="true"]');
    if (active && typeof active.scrollIntoView === 'function') {
        try { active.scrollIntoView({ block: 'nearest' }); } catch { /* jsdom/old engines */ }
    }
};

const setActive = (i) => {
    if (i < 0 || i >= filtered.length) return;
    activeIndex = i;
    dom.commandPaletteList.querySelectorAll('.palette-item').forEach((el, idx) => {
        el.setAttribute('aria-selected', String(idx === activeIndex));
    });
    const active = dom.commandPaletteList.querySelector('[aria-selected="true"]');
    if (active && typeof active.scrollIntoView === 'function') {
        try { active.scrollIntoView({ block: 'nearest' }); } catch { /* jsdom/old engines */ }
    }
};

const runCommand = (cmd) => {
    closePalette();
    // Defer so the palette is fully closed before the action re-renders UI
    setTimeout(() => { try { cmd.run(); } catch (e) { console.error('[palette] command failed:', e); } }, 0);
};

const applyFilter = () => {
    const q = dom.commandPaletteInput.value.trim().toLowerCase();
    filtered = !q
        ? commands
        : commands.filter((c) => (c.label + ' ' + c.keywords).toLowerCase().includes(q));
    activeIndex = 0;
    renderList();
};

export const openPalette = () => {
    if (isOpen || !state.isAppInitialized) return;
    commands = buildCommands();
    filtered = commands;
    activeIndex = 0;
    dom.commandPalette.classList.remove('hidden');
    dom.commandPaletteInput.value = '';
    renderList();
    dom.commandPaletteInput.focus();
    isOpen = true;
};

export const closePalette = () => {
    if (!isOpen) return;
    isOpen = false;
    dom.commandPalette.classList.add('hidden');
    dom.commandPaletteInput.blur();
};

export const togglePalette = () => (isOpen ? closePalette() : openPalette());

export const initPalette = () => {
    if (!dom.commandPalette) return;

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            togglePalette();
            return;
        }
        if (!isOpen) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIndex]) runCommand(filtered[activeIndex]); }
        else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    }, true);

    dom.commandPaletteInput.addEventListener('input', applyFilter);
    dom.commandPaletteOverlay.addEventListener('click', closePalette);
};
