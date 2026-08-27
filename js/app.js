/**
 * ABot — app.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

// Entry point. Execution order mirrors the original main() statement order:
// SW registration -> firebase init -> dom extras -> message actions -> auth wiring.
import { MODEL_CONFIG } from './config.js';
import { closeGuestLimitModal } from './ui.js';
import { closePromptModal } from './ui.js';
import { closeSidebar } from './ui.js';
import { createNewChat } from './chat.js';
import { dom } from './dom.js';
import { generateColorClasses } from './config.js';
import { importChat } from './chat.js';
import { initDomExtras } from './dom.js';
import { setVantaEnabled } from './ui.js';
import { renderSearchResults } from './chat.js';
import { initFirebase, initAuth, registerInitApp } from './auth.js';
import { initMessageActions } from './chat.js';
import { linkGuestToGoogle } from './auth.js';
import { openPromptModal } from './ui.js';
import { renameChat } from './chat.js';
import { renderActiveChat } from './chat.js';
import { renderChatList } from './chat.js';
import { saveSystemPrompt } from './ui.js';
import { sendMessage } from './chat.js';
import { showToast } from './utils.js';
import { signOutUser } from './auth.js';
import { startVoiceRecognition } from './utils.js';
import { state } from './state.js';
import { switchChat } from './chat.js';

function registerServiceWorker() {
// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => {
                console.log('[App] SW registered');
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[App] New content available; please refresh.');
                            showToast('New update available! Please refresh.', 'success');
                        }
                    };
                };
            })
            .catch(err => console.log('[App] SW registration failed', err));
    });
}
}

// =================================================================================
// APPLICATION INITIALIZATION AND EVENT LISTENERS
// =================================================================================

function initApp() {

    // --- Main App Listeners ---

    if (!document.documentElement.classList.contains('dark')) {
        dom.sunIcon.classList.remove('hidden');
        dom.moonIcon.classList.add('hidden');
    } else {
        dom.sunIcon.classList.add('hidden');
        dom.moonIcon.classList.remove('hidden');
    }
    dom.themeToggle.addEventListener('click', () => {
        // Check the CURRENT state and reverse it.
        if (document.documentElement.classList.contains('dark')) {
            // It IS dark, so switch to LIGHT
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
            console.log('[Click Event] Switched to LIGHT mode.');
        } else {
            // It IS light, so switch to DARK
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
            console.log('[Click Event] Switched to DARK mode.');
        }
        dom.sunIcon.classList.toggle('hidden');
        dom.moonIcon.classList.toggle('hidden');
    });

    // --- Model Selector Listeners ---

    const handleModelSelectorNavigation = (e) => {
        if (dom.modelSelectorPanel.classList.contains('hidden')) return;

        const buttons = Array.from(dom.modelSelectorPanel.querySelectorAll('button'));
        if (buttons.length === 0) return;

        const currentIndex = buttons.findIndex(btn => btn === document.activeElement);

        if (e.key === 'Escape') {
            e.preventDefault();
            dom.modelSelectorPanel.style.opacity = '0';
            dom.modelSelectorPanel.style.transform = 'scale(0.95)';
            setTimeout(() => dom.modelSelectorPanel.classList.add('hidden'), 200);
            dom.modelSelectorBtn.focus();
            return;
        }

        if (e.key === 'Tab') {
            const firstElement = buttons[0];
            const lastElement = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
            return; // Allow default tab behavior otherwise
        }

        // Handle arrow keys
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!arrowKeys.includes(e.key)) return;

        e.preventDefault(); // Prevent page scrolling

        let nextIndex = currentIndex;
        const numColumns = window.getComputedStyle(dom.modelSelectorPanel).gridTemplateColumns.split(' ').length;

        switch (e.key) {
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % buttons.length;
                break;
            case 'ArrowLeft':
                nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
                break;
            case 'ArrowDown':
                if (currentIndex + numColumns < buttons.length) {
                    nextIndex = currentIndex + numColumns;
                }
                break;
            case 'ArrowUp':
                if (currentIndex - numColumns >= 0) {
                    nextIndex = currentIndex - numColumns;
                }
                break;
        }

        buttons[nextIndex].focus();
    };

    const renderModelSelectorOptions = () => {
        dom.modelSelectorPanel.innerHTML = ''; // Clear previous options
        const currentChatModel = state.activeChatId ? state.chats[state.activeChatId].model : null;

        Object.keys(MODEL_CONFIG).forEach(key => {
            const model = MODEL_CONFIG[key];
            const isActive = key === currentChatModel;
            const colorClasses = generateColorClasses(model.color);

            const optionEl = document.createElement('button');
                            optionEl.className = `w-full flex items-center justify-between text-left p-3 rounded-lg text-sm transition-colors duration-150 ${isActive ? 'bg-coral-soft font-semibold text-ink' : 'hover:bg-card'}`;
            optionEl.dataset.modelKey = key;

            let checkmarkSvg = '';
            if (isActive) {
                                checkmarkSvg = `<svg class="w-4 h-4 ${colorClasses.text}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clip-rule="evenodd" /></svg>`;
            }

            optionEl.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="w-2.5 h-2.5 rounded-full ${colorClasses.bg}"></span>
                <span class="font-medium text-ink">${model.name}</span>
            </div>
            ${checkmarkSvg}
        `;

            optionEl.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentUser = state.auth.currentUser;
                if (state.chats[state.activeChatId] && currentUser) {
                    state.chats[state.activeChatId].model = key;
                    const chatDocRef = state.db.collection('users').doc(currentUser.uid).collection('chats').doc(state.activeChatId);
                    await chatDocRef.update({ model: key }).catch(err => console.error("Failed to update model in DB", err));

                    renderActiveChat();

                    dom.modelSelectorPanel.style.opacity = '0';
                    dom.modelSelectorPanel.style.transform = 'scale(0.95)';
                    setTimeout(() => dom.modelSelectorPanel.classList.add('hidden'), 200);
                }
            });
            dom.modelSelectorPanel.appendChild(optionEl);
        });
    };



    dom.modelSelectorBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isHidden = dom.modelSelectorPanel.classList.contains('hidden');
        if (isHidden) {
            renderModelSelectorOptions(); // Re-render options every time it's opened
            dom.modelSelectorPanel.classList.remove('hidden');
            setTimeout(() => {
                dom.modelSelectorPanel.style.opacity = '1';
                dom.modelSelectorPanel.style.transform = 'translateY(0) scale(1)';
                // Focus the currently active model or the first one
                const activeOrFirstButton = dom.modelSelectorPanel.querySelector('button[class*="bg-coral-soft"]') || dom.modelSelectorPanel.querySelector('button');
                if (activeOrFirstButton) {
                    activeOrFirstButton.focus();
                }
            }, 10); // A short delay ensures the transition plays
        } else {
            dom.modelSelectorPanel.style.opacity = '0';
            dom.modelSelectorPanel.style.transform = 'translateY(-10px) scale(0.98)';
            setTimeout(() => dom.modelSelectorPanel.classList.add('hidden'), 200); // Wait for animation to finish
        }
    });

    document.addEventListener('click', () => {
        // First, check if the panel is currently visible BEFORE starting to close it.
        const isVisible = !dom.modelSelectorPanel.classList.contains('hidden');

        // Start the closing animation for the model panel.
        dom.modelSelectorPanel.style.opacity = '0';
        dom.modelSelectorPanel.style.transform = 'scale(0.95)';
        setTimeout(() => dom.modelSelectorPanel.classList.add('hidden'), 200);

        // Now, use the 'isVisible' variable. If the panel was open, return focus to the button.
        if (isVisible) {
            dom.modelSelectorBtn.focus();
        }

        // Also, ensure the smaller chat options menus are closed.
        document.querySelectorAll('.chat-options-menu').forEach(m => m.classList.add('hidden'));
    });

    // --- Core Interaction Listeners ---
    // Wrapper to handle new chat logic reuse
    async function createNewChatWrapper() {
        const currentUser = state.auth.currentUser;
        if (!currentUser) {
            console.error("Cannot create new chat: No user is signed in.");
            return;
        }
        await createNewChat(); // Call the existing createNewChat function
        // createNewChat already handles switching and rendering
    }

    // New chat (Sidebar)
    dom.newChatBtn?.addEventListener('click', createNewChatWrapper);

    // --- Phase 3: search + settings wiring ---
    dom.searchToggleBtn?.addEventListener('click', () => {
        dom.searchPanel.classList.toggle('hidden');
        if (!dom.searchPanel.classList.contains('hidden')) dom.messageSearchInput?.focus();
    });
    let searchDebounce = null;
    dom.messageSearchInput?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => renderSearchResults(e.target.value.trim()), 200);
    });

    dom.settingsToggleBtn?.addEventListener('click', () => dom.settingsPanel.classList.toggle('hidden'));
    if (dom.timestampsToggle) {
        dom.timestampsToggle.checked = localStorage.getItem('abot-show-timestamps') !== 'false';
        dom.timestampsToggle.addEventListener('change', () => {
            localStorage.setItem('abot-show-timestamps', dom.timestampsToggle.checked ? 'true' : 'false');
            renderActiveChat();
        });
    }
    if (dom.vantaToggle) {
        dom.vantaToggle.checked = localStorage.getItem('abot-vanta') === 'true';
        dom.vantaToggle.addEventListener('change', () => setVantaEnabled(dom.vantaToggle.checked));
    }
    // New chat (Header)
    document.getElementById('headerNewChatBtn')?.addEventListener('click', createNewChatWrapper);

    dom.modelSelectorPanel.addEventListener('keydown', handleModelSelectorNavigation);
    dom.messageInput.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
    dom.messageInput.addEventListener('keydown', e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage()));
    dom.stopBtn.addEventListener('click', () => {
        // This listener is now ONLY responsible for UI and aborting.
        const allBotSpans = dom.chatHistory.querySelectorAll('span[id^="bot-msg-"]');
        if (allBotSpans.length > 0) {
            const latestBotMessageSpan = allBotSpans[allBotSpans.length - 1];
            const finalContent = latestBotMessageSpan.querySelector('.content-span')?.innerHTML || "";
            // Use marked.parse to be consistent with how other messages are rendered.
            latestBotMessageSpan.innerHTML = finalContent + marked.parse('\n\n*-- Generation stopped --*');
        }

        if (state.abortController) {
            state.abortController.abort();
        }
    });

    dom.sendBtn.addEventListener('click', sendMessage);
    dom.voiceBtn.addEventListener('click', startVoiceRecognition);
    dom.sidebarToggle.addEventListener('click', e => { e.stopPropagation(); dom.sidebar.classList.toggle('-translate-x-full'); dom.sidebarOverlay.classList.toggle('hidden'); });
    dom.sidebarOverlay.addEventListener('click', closeSidebar);


    dom.searchChats.addEventListener('input', (e) => renderChatList(e.target.value));

    // --- Global Keyboard Shortcuts (Debugged) ---
    // --- Global Keyboard Shortcuts ---
    window.addEventListener('keydown', (e) => {
        // Ctrl+Enter: Send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement === dom.messageInput) {
            e.preventDefault();
            sendMessage();
            return;
        }

        // Alt+N: New Chat (Browser safe)
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            createNewChatWrapper(); // Use the wrapper
            return;
        }

        // Alt+/: Focus Search (Browser safe)
        if (e.altKey && (e.key === '/' || e.key === '?')) {
            e.preventDefault();
            dom.searchChats.focus();
            return;
        }

        // Esc: Close Modals
        if (e.key === 'Escape') {
            if (!dom.guestLimitModal.classList.contains('hidden')) {
                document.getElementById('guestLimitCancelBtn').click();
                return;
            }
            if (!dom.deleteModal.classList.contains('hidden')) {
                document.getElementById('deleteCancelBtn').click();
                return;
            }
            if (!dom.promptModal.classList.contains('hidden')) {
                closePromptModal();
                return;
            }
            if (!dom.modelSelectorPanel.classList.contains('hidden')) {
                dom.modelSelectorBtn.click();
                return;
            }
            if (!dom.sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
                closeSidebar();
                return;
            }
            if (document.activeElement === dom.messageInput || document.activeElement === dom.searchChats) {
                document.activeElement.blur();
            }
        }
    }, true);



    // --- Inline Chat Title Rename Listeners ---
    const switchToTitleView = () => {
        dom.chatTitle.classList.remove('hidden');
        dom.renameChatBtn.classList.remove('hidden');
        dom.chatTitleInput.classList.add('hidden');
    };

    const saveTitleEdit = () => {
        const newName = dom.chatTitleInput.value.trim();
        if (state.activeChatId && newName && state.chats[state.activeChatId] && newName !== state.chats[state.activeChatId].name) {
            renameChat(state.activeChatId, newName);
        }
        switchToTitleView();
    };

    dom.renameChatBtn.addEventListener('click', () => {
        if (!state.activeChatId) return;
        dom.chatTitle.classList.add('hidden');
        dom.renameChatBtn.classList.add('hidden');
        dom.chatTitleInput.classList.remove('hidden');
        dom.chatTitleInput.focus();
        dom.chatTitleInput.select();
    });

    dom.chatTitleInput.addEventListener('blur', saveTitleEdit);
    dom.chatTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitleEdit();
        } else if (e.key === 'Escape') {
            if (state.activeChatId && state.chats[state.activeChatId]) {
                dom.chatTitleInput.value = state.chats[state.activeChatId].name;
            }
            switchToTitleView();
        }
    });


    // --- Modal & Import/Export Listeners ---
    dom.promptBtn.addEventListener('click', openPromptModal);
    dom.promptOverlay.addEventListener('click', closePromptModal);
    dom.promptCancelBtn.addEventListener('click', closePromptModal);
    dom.promptSaveBtn.addEventListener('click', saveSystemPrompt);
    dom.importChatBtn.addEventListener('click', () => dom.importFileInput.click());
    dom.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) { importChat(e.target.files[0]); }
        e.target.value = null;
    });

    // --- Delete Modal Listeners ---
    const closeDeleteModal = () => {
        dom.deletePanel.style.opacity = '0';
        dom.deletePanel.style.transform = 'scale(0.95)';
        setTimeout(() => dom.deleteModal.classList.add('hidden'), 200);
    };

    const handleSignOutRequest = () => {
        // 1. Configure Modal Text
        dom.deleteModal.querySelector('#modal-title').textContent = "Confirm Sign Out";
        dom.deleteModalBody.textContent = "Are you sure you want to sign out? This will end your current session.";

        // 2. Configure Button
        const confirmBtn = dom.deleteConfirmBtn;
        confirmBtn.textContent = "Sign Out";
        confirmBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        confirmBtn.classList.add('bg-coral', 'hover:bg-coral-active');

        // 3. Set Action
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        dom.deleteConfirmBtn = newBtn;
        newBtn.addEventListener('click', () => {
            signOutUser();
            closeDeleteModal();
        }, { once: true });

        // 4. Show Modal
        dom.deleteModal.classList.remove('hidden');
        setTimeout(() => {
            dom.deletePanel.style.opacity = '1';
            dom.deletePanel.style.transform = 'scale(1)';
            dom.deleteConfirmBtn.focus(); // Set focus
        }, 10);
    };


    const handleDeleteConfirm = async (e) => {
        const chatId = e.target.dataset.chatId;
        const currentUser = state.auth.currentUser;
        if (!chatId || !currentUser) {
            showToast("Error: Could not identify chat or user.", 'error');
            return;
        }
        try {
            await state.db.collection('users').doc(currentUser.uid).collection('chats').doc(chatId).delete();
            delete state.chats[chatId];
            const remainingChatIds = Object.keys(state.chats);
            if (String(chatId) === String(state.activeChatId)) {
                if (remainingChatIds.length > 0) {
                    switchChat(String(Math.max(...remainingChatIds.map(Number))));
                } else {
                    await createNewChat();
                }
            } else {
                renderChatList();
            }
        } catch (error) {
            console.error("Error deleting chat from Firestore:", error);
            showToast("Error: Could not delete chat from the cloud.", 'error');
        } finally {
            closeDeleteModal();
        }
    };
    dom.deleteCancelBtn.addEventListener('click', closeDeleteModal);
    dom.deleteOverlay.addEventListener('click', closeDeleteModal);
    dom.deleteConfirmBtn.addEventListener('click', handleDeleteConfirm);

    // --- Guest Limit Modal Listeners ---
    dom.guestLimitOverlay.addEventListener('click', closeGuestLimitModal);
    dom.guestLimitCancelBtn.addEventListener('click', closeGuestLimitModal);
    dom.guestGoogleLinkBtn.addEventListener('click', linkGuestToGoogle);

    // --- Final Listeners ---
    dom.signoutBtn.addEventListener('click', handleSignOutRequest);

    state.isAppInitialized = true;
}

function main() {
    registerServiceWorker();
    initFirebase();            // was statements #3-6
    initDomExtras();           // was statements #33 and #59
    initMessageActions();      // was statements #43-44
    registerInitApp(initApp);  // auth's onAuthStateChanged needs initApp
    initAuth();                // was statements #52,54-58,60-65
    // footer years (replaces the old inline document.write scripts)
    for (const id of ['footer-year', 'footer-year2']) {
        const el = document.getElementById(id);
        if (el) el.textContent = new Date().getFullYear();
    }
}

document.addEventListener('DOMContentLoaded', main);
