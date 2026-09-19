/**
 * ABot — ui.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { SYSTEM_PROMPTS, getProviderColor, modelCapabilities } from './config.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { showToast } from './utils.js';
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
    // Provider-colored dot in the header pill (buttons stay coral — actions are
    // brand, model identity lives in accents). The old duplicate indicator pill
    // was removed in the revamp; only the selector dot is updated.
    const provider = getProviderColor(model);

    if (dom.modelSelectorDot) {
        dom.modelSelectorDot.className = `w-2 h-2 rounded-full ${provider.dot} transition-colors`;
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
        dom.webSearchChip.title = caps.webSearch
            ? 'Search the web for current information before answering'
            : 'Web search is not available for this provider';
    }

    if (dom.thinkingChip) {
        const active = state.thinkingEnabled && caps.thinking;
        if (!caps.thinking) state.thinkingEnabled = false;
        dom.thinkingChip.disabled = !caps.thinking;
        dom.thinkingChip.classList.toggle('chip-active', active);
        dom.thinkingChip.setAttribute('aria-pressed', String(active));
        dom.thinkingChip.title = caps.thinking
            ? 'Extended thinking on/off (higher quality, slower and more tokens when on)'
            : caps.alwaysThinks
                ? 'This model always reasons — nothing to toggle'
                : 'Select a thinking-capable model (e.g. Gemini 2.5 Pro) to enable';
    }
};

// Function to render the preset buttons
export const renderPromptLibrary = () => {
    dom.promptLibrary.innerHTML = '';
    const currentPrompt = dom.promptTextarea.value;

    SYSTEM_PROMPTS.forEach(p => {
        const button = document.createElement('button');
        const isActive = currentPrompt === p.prompt;

        button.textContent = p.title;
                        button.className = `px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${isActive ? 'bg-coral text-white shadow-sm' : 'bg-card text-body hover:bg-hairline'}`;

        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission if it's inside a form
            dom.promptTextarea.value = p.prompt;
            renderPromptLibrary(); // Re-render to update the active state
        });
        dom.promptLibrary.appendChild(button);
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

// --- Phase 3.5b: ambient background for the AUTH SCREEN only ---
// Lazy-loads three.js/vanta on first need; theme-aware colors (coral on
// warm dark / warm cream). Destroyed on login (see auth.js).
let vantaScriptsLoading = null;
const ensureVanta = () => {
    if (window.VANTA) return Promise.resolve();
    if (!vantaScriptsLoading) {
        vantaScriptsLoading = new Promise((resolve, reject) => {
            console.log('[ABot] ambient bg: loading three.js…');
            const three = document.createElement('script');
            three.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
            three.onload = () => {
                console.log('[ABot] ambient bg: three.js OK, loading vanta…');
                const vanta = document.createElement('script');
                vanta.src = 'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js';
                vanta.onload = () => { console.log('[ABot] ambient bg: vanta OK'); resolve(); };
                vanta.onerror = () => reject(new Error('vanta script failed to load (network/CDN blocked?)'));
                document.head.appendChild(vanta);
            };
            three.onerror = () => reject(new Error('three.js failed to load (network/CDN blocked?)'));
            document.head.appendChild(three);
            setTimeout(() => reject(new Error('CDN load timed out after 20s')), 20000);
        });
        vantaScriptsLoading.catch(() => { vantaScriptsLoading = null; }); // allow retry on next sign-out
    }
    return vantaScriptsLoading;
};

export const startAuthVanta = async () => {
    const el = document.getElementById('vanta-bg');
    if (!el) { console.warn('[ABot] ambient bg: #vanta-bg element not found'); return; }
    console.log('[ABot] ambient bg: starting…');
    try {
        await ensureVanta();
    } catch (e) {
        console.warn('[ABot] ambient bg unavailable:', e.message);
        return;
    }
    if (!window.VANTA || state.vantaEffect) return;

    const init = () => {
        const dark = document.documentElement.classList.contains('dark');
        try {
            state.vantaEffect = VANTA.NET({
                el: '#vanta-bg',
                mouseControls: true, touchControls: true, gyroControls: false,
                scale: 1.00, scaleMobile: 1.20,
                color: 0xcc785c,
                backgroundColor: dark ? 0x181715 : 0xfaf9f5,
                points: 12.00, maxDistance: 18.00
            });
            console.log('[ABot] ambient bg: active (dark=' + dark + ')');
        } catch (e) {
            console.error('[ABot] ambient bg: VANTA.NET threw:', e);
        }
    };

    // VANTA.NET needs a laid-out element; if the section just un-hid, wait a frame
    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
        console.log('[ABot] ambient bg: waiting for layout…');
        requestAnimationFrame(() => requestAnimationFrame(init));
    } else {
        init();
    }
};
