/**
 * ABot — ui.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 */

import { SYSTEM_PROMPTS, FUN_PROMPTS, getProviderColor, modelCapabilities } from './config.js';
import { dom } from './dom.js';
import { state } from './state.js';
// Single source of truth for the sidebar. Two regimes:
//  - <768px: off-canvas drawer (transform slide) + overlay + body scroll-lock.
//  - >=768px: static flex column; collapse = slide the 18rem column out via
//    negative margin (.sidebar-collapsed). The translate classes are inert on
//    desktop (md:translate-x-0 wins), which is why the hamburger "did nothing".
const isDesktopViewport = () => !!window.matchMedia && window.matchMedia('(min-width: 768px)').matches;

export const isSidebarOpen = () => isDesktopViewport()
    ? !dom.sidebar.classList.contains('sidebar-collapsed')
    : !dom.sidebar.classList.contains('-translate-x-full');

export const setSidebar = (open) => {
    if (isDesktopViewport()) {
        dom.sidebar.classList.toggle('sidebar-collapsed', !open);
        dom.sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    } else {
        dom.sidebar.classList.toggle('-translate-x-full', !open);
        dom.sidebarOverlay.classList.toggle('hidden', !open);
        document.body.style.overflow = open ? 'hidden' : '';
    }
    dom.sidebarToggle?.setAttribute('aria-expanded', String(open));
};

export const toggleSidebar = () => setSidebar(!isSidebarOpen());

// Mobile-only close: chat switching / overlay taps must not collapse the
// desktop column (desktop has the hamburger for that).
export const closeSidebar = () => { if (!isDesktopViewport()) setSidebar(false); };

export const applyModelColorTheme = (model) => {
    // Provider-colored dot in the composer's model pill (buttons stay coral —
    // actions are brand, model identity lives in accents).
    const provider = getProviderColor(model);

    if (dom.modelSelectorDot) {
        dom.modelSelectorDot.className = `w-1.5 h-1.5 rounded-full ${provider.dot} transition-colors`;
    }
};

// B3/B4: keep the composer chips in sync with (a) the selected model's
// capabilities and (b) the current toggle state. Runs on model change, on
// chat switch, and after each send (chips are per-message).
export const syncComposerChips = () => {
    const model = state.chats[state.activeChatId]?.model;
    const caps = modelCapabilities(model);

    if (dom.webSearchChip) {
        const active = state.webSearchEnabled && caps.webSearch;
        if (!caps.webSearch) state.webSearchEnabled = false;
        dom.webSearchChip.disabled = !caps.webSearch;
        dom.webSearchChip.classList.toggle('chip-active', active);
        dom.webSearchChip.setAttribute('aria-pressed', String(active));
        // 2.3.5 (owner request): styled tooltips — the native title bubble read
        // as broken next to the app's own tooltip system.
        dom.webSearchChip.setAttribute('data-tooltip', caps.webSearch
            ? 'Search the web for current information before answering'
            : 'Web search is not available for this provider');
    }

    if (dom.thinkingChip) {
        const active = state.thinkingEnabled && caps.thinking;
        if (!caps.thinking) state.thinkingEnabled = false;
        dom.thinkingChip.disabled = !caps.thinking;
        dom.thinkingChip.classList.toggle('chip-active', active);
        dom.thinkingChip.setAttribute('aria-pressed', String(active));
        dom.thinkingChip.setAttribute('data-tooltip', caps.thinking
            ? 'Extended thinking on/off (higher quality, slower and more tokens when on)'
            : caps.alwaysThinks
                ? 'This model always reasons — nothing to toggle'
                : 'Select a thinking-capable model (e.g. Gemini 3.8 Flash) to enable');
    }
};

// Function to render the preset buttons
export const renderPromptLibrary = () => {
    dom.promptLibrary.innerHTML = '';
    const currentPrompt = dom.promptTextarea.value;

    const makeButton = (p) => {
        const button = document.createElement('button');
        const isActive = currentPrompt === p.prompt;

        button.textContent = p.title;
                        // 2.2.8: borders per item (owner request) — the chips sat
                        // bg-on-bg, so the grid read as one undifferentiated block.
                        // 2.6.7: the accent is light in dark mode, so the active
                        // chip's label is canvas — text-white vanished against it.
                        button.className = `px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${isActive ? 'bg-coral text-canvas border-coral shadow-sm' : 'bg-card text-body border-hairline hover:bg-hairline'}`;

        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission if it's inside a form
            dom.promptTextarea.value = p.prompt;
            renderPromptLibrary(); // Re-render to update the active state
        });
        return button;
    };

    const makeHeading = (text) => {
        const heading = document.createElement('div');
        heading.className = 'col-span-full text-[11px] uppercase tracking-wide text-muted';
        heading.textContent = text;
        return heading;
    };

    dom.promptLibrary.appendChild(makeHeading('Assistant'));
    SYSTEM_PROMPTS.forEach((p) => {
        dom.promptLibrary.appendChild(makeButton(p));
    });
    dom.promptLibrary.appendChild(makeHeading('Fun'));
    FUN_PROMPTS.forEach((p) => {
        dom.promptLibrary.appendChild(makeButton(p));
    });
};

export const openPromptModal = () => {
    if (!state.activeChatId) return;
    dom.promptTextarea.value = state.chats[state.activeChatId].systemPrompt;

    renderPromptLibrary(); // Renders the buttons and checks for active state

    dom.promptModal.classList.remove('hidden');
    setTimeout(() => {
        dom.promptPanel.style.opacity = '1';
        dom.promptPanel.style.transform = 'scale(1)';
    }, 10);
};

export const closePromptModal = () => { dom.promptPanel.style.opacity = '0'; dom.promptPanel.style.transform = 'scale(0.95)'; setTimeout(() => dom.promptModal.classList.add('hidden'), 200); };

export const saveSystemPrompt = async () => {
    const currentUser = state.auth.currentUser;
    if (!state.activeChatId || !currentUser) return;

    const newPrompt = dom.promptTextarea.value.trim();
    state.chats[state.activeChatId].systemPrompt = newPrompt; // Update local state

    // Update Firestore
    const chatDocRef = state.db.collection('users').doc(currentUser.uid).collection('chats').doc(state.activeChatId);
    await chatDocRef.update({ systemPrompt: newPrompt }).catch(err => console.error("Failed to update prompt in DB", err));

    closePromptModal();
};

// =================================================================================
// CORE CHAT APPLICATION FUNCTIONS
// =================================================================================


const closeGuestLimitModal = () => {
    dom.guestLimitPanel.style.opacity = '0';
    dom.guestLimitPanel.style.transform = 'scale(0.95)';
    setTimeout(() => dom.guestLimitModal.classList.add('hidden'), 200);
};

const showGuestLimitModal = () => {
    dom.guestLimitModal.classList.remove('hidden');
    setTimeout(() => {
        dom.guestLimitPanel.style.opacity = '1';
        dom.guestLimitPanel.style.transform = 'scale(1)';
    }, 10);
};
export { closeGuestLimitModal, showGuestLimitModal };

// --- Auth screen backdrop -----------------------------------------------
// v1.0.7: this used to lazy-load three.js + vanta.net from two CDNs and render
// a `VANTA.NET` canvas behind the sign-in card. That meant every signed-out
// visitor pulled several hundred KB of third-party JS before seeing anything,
// and it failed silently whenever a CDN was blocked. The backdrop is now pure
// CSS (see `.auth-scene` in src/input.css): no scripts, no network, no failure
// mode — and the app no longer depends on any CDN at all.
// Nothing to start or tear down, so the old startAuthVanta() export is gone.
