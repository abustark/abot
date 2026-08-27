/**
 * ABot — ui.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { COLOR_MAP } from './config.js';
import { SYSTEM_PROMPTS } from './config.js';
import { dom } from './dom.js';
import { generateColorClasses } from './config.js';
import { state } from './state.js';
export const closeSidebar = () => { dom.sidebar.classList.add('-translate-x-full'); dom.sidebarOverlay.classList.add('hidden'); };

export const applyModelColorTheme = (colorName) => {
    const colorClasses = generateColorClasses(colorName);
    const elementsToColor = [dom.newChatBtn, dom.sendBtn];

                    const oldBgColors = Object.values(COLOR_MAP).map(c => `bg-${c.name}`);
                    const oldHoverBgColors = Object.values(COLOR_MAP).map(c => `hover:bg-${c.name}/90`);

    // Update New Chat and Send buttons
    elementsToColor.forEach(el => {
        if (!el) return;
        el.classList.remove(...oldBgColors, ...oldHoverBgColors);
        el.classList.add(colorClasses.bg, colorClasses.hoverBg);
    });

    // Update the new model selector dot
    if (dom.modelSelectorDot) {
        dom.modelSelectorDot.classList.remove(...oldBgColors);
        dom.modelSelectorDot.classList.add(colorClasses.bg);
    }

    // Update the old pill (can be removed later if not used)
    const pill = dom.modelIndicatorPill;
    if (pill) {

                        const oldTextColors = Object.values(COLOR_MAP).map(c => `text-${c.name}`);
                        const oldBorderColors = Object.values(COLOR_MAP).map(c => `border-${c.name}`);
        pill.classList.remove(...oldTextColors, ...oldBorderColors);
        pill.classList.add(colorClasses.text, colorClasses.border);
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
