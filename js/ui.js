/**
 * ABot — ui.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { COLOR_MAP, getProviderColor } from './config.js';
import { SYSTEM_PROMPTS } from './config.js';
import { dom } from './dom.js';
import { generateColorClasses } from './config.js';
import { state } from './state.js';
import { showToast } from './utils.js';
export const closeSidebar = () => { dom.sidebar.classList.add('-translate-x-full'); dom.sidebarOverlay.classList.add('hidden'); };

export const applyModelColorTheme = (model) => {
    // Phase 3.5: provider-colored dot (buttons stay coral — actions are brand,
    // model identity lives in accents). `model` is the full model string.
    const provider = getProviderColor(model);

    if (dom.modelSelectorDot) {
        dom.modelSelectorDot.className = `w-2.5 h-2.5 rounded-full ${provider.dot} transition-colors`;
    }

    const pill = dom.modelIndicatorPill;
    if (pill) {
        pill.className = `flex items-center px-2 py-1 text-sm font-medium ${provider.text}`;
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

// --- Phase 3: ambient background (lazy three.js/vanta, default OFF) ---
let vantaScriptsLoading = null;
const ensureVanta = () => {
    if (window.VANTA) return Promise.resolve();
    if (!vantaScriptsLoading) {
        vantaScriptsLoading = new Promise((resolve, reject) => {
            const three = document.createElement('script');
            three.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
            three.onload = () => {
                const vanta = document.createElement('script');
                vanta.src = 'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js';
                vanta.onload = resolve;
                vanta.onerror = () => reject(new Error('vanta load failed'));
                document.head.appendChild(vanta);
            };
            three.onerror = () => reject(new Error('three load failed'));
            document.head.appendChild(three);
        });
    }
    return vantaScriptsLoading;
};

export const setVantaEnabled = async (enabled) => {
    localStorage.setItem('abot-vanta', enabled ? 'true' : 'false');
    if (enabled) {
        try {
            await ensureVanta();
        } catch (e) {
            showToast('Could not load background effect', 'error');
            return;
        }
        if (window.VANTA && !state.vantaEffect) {
            state.vantaEffect = VANTA.NET({
                el: '#vanta-bg',
                mouseControls: true, touchControls: true, gyroControls: false,
                scale: 1.00, scaleMobile: 1.20, color: 0xcc785c,
                backgroundColor: 0x181715, points: 12.00, maxDistance: 18.00
            });
        }
    } else if (state.vantaEffect) {
        state.vantaEffect.destroy();
        state.vantaEffect = null;
    }
};
