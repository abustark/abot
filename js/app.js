/**
 * ABot — app.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

// Entry point. Execution order mirrors the original main() statement order:
// SW registration -> firebase init -> dom extras -> message actions -> auth wiring.
import { MODEL_CONFIG, getProviderColor } from './config.js';
import { closeGuestLimitModal } from './ui.js';
import { closePromptModal } from './ui.js';
import { closeSidebar } from './ui.js';
import { syncComposerChips } from './ui.js';
import { toggleSidebar } from './ui.js';
import { createNewChat } from './chat.js';
import { dom } from './dom.js';
import { importChat } from './chat.js';
import { initDomExtras } from './dom.js';
import { renderSearchResults } from './chat.js';
import { initFirebase, initAuth, registerInitApp } from './auth.js';
import { initPalette } from './palette.js';
import { initMessageActions } from './chat.js';
import { linkGuestToGoogle } from './auth.js';
import { openPromptModal } from './ui.js';
import { renderActiveChat } from './chat.js';
import { renderChatList } from './chat.js';
import { saveSystemPrompt } from './ui.js';
import { sendMessage } from './chat.js';
import { showToast, stopSpeaking, installDraftLeaveGuard, setUnsentDraft, renderSafeMarkdown } from './utils.js';
import { signOutUser } from './auth.js';
import { state } from './state.js';
import { switchChat } from './chat.js';

function registerServiceWorker() {
// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
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
    // v2.0.8 fix: initApp re-ran on EVERY sign-in (sign-out clears
    // isAppInitialized), re-adding every click listener. Two logins = the
    // sidebar/theme toggles fired twice per click and cancelled themselves
    // out ("collapse menu not working"). Listener wiring is one-time work:
    // all handlers read shared module state, so re-wiring is never needed.
    if (window.__abotShellWired) {
        console.log('[ABot] shell already wired — skipping re-init');
        return;
    }
    window.__abotShellWired = true;

    // --- Theme: follow system until the user explicitly toggles ---
    // Head script applies the initial class (stored choice > system pref);
    // here we only keep the icon pair in sync and persist explicit choices.
    const syncThemeIcons = () => {
        // 2.2.8: the header sun/moon icon pair was removed together with the
        // overflow menu — the account-menu switch is now the only UI that
        // mirrors the theme, so keep it (and nothing else) in sync.
        const dark = document.documentElement.classList.contains('dark');
        if (dom.sidebarThemeSwitch) dom.sidebarThemeSwitch.checked = dark;
    };
    syncThemeIcons();
    // One owner of "set the theme", taking an explicit value so every entry
    // point (account-menu switch, command palette) can never drift apart.
    const applyTheme = (dark) => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('darkMode', String(dark));
        syncThemeIcons();
    };
    const setTheme = (dark) => {
        // B1 (v1.0.5): crossfade the theme flip where the View Transitions API
        // exists (progressive enhancement, ~0 cost); instant on browsers
        // without it. Reduced-motion users always get the instant swap.
        const reduceMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion && typeof document.startViewTransition === 'function') {
            document.startViewTransition(() => applyTheme(dark));
        } else {
            applyTheme(dark);
        }
    };
    dom.sidebarThemeSwitch?.addEventListener('change', () => {
        setTheme(dom.sidebarThemeSwitch.checked);
    });

    // --- Mobile keyboard offset: keep the fixed composer dock above the
    // keypad even on browsers that ignore `interactive-widget=resizes-content`
    // (visualViewport shrinks while the layout viewport does not). ---
    if (window.visualViewport) {
        const vv = window.visualViewport;
        const applyKbOffset = () => {
            const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            document.documentElement.style.setProperty('--kb-h', kb + 'px');
        };
        vv.addEventListener('resize', applyKbOffset);
        vv.addEventListener('scroll', applyKbOffset);
        applyKbOffset();
    }

    // --- Floating header hairline + jump-to-latest pill (E1). ---
    // Header gets its hairline border once scrolled (premium-chat pattern);
    // the pill shows only while a reply is streaming AND the user has scrolled
    // up past the fresh content (>200px) — never otherwise. rAF-throttled.
    const JUMP_PILL_THRESHOLD = 200;
    let headerTick = false;
    const updateJumpPill = () => {
        if (!dom.jumpToLatest) return;
        const el = dom.chatHistoryContainer;
        const away = el.scrollHeight - el.scrollTop - el.clientHeight > JUMP_PILL_THRESHOLD;
        const show = away && state.isStreaming;
        if (show && dom.jumpToLatest.classList.contains('hidden')) {
            dom.jumpToLatest.classList.remove('hidden');
            dom.jumpToLatest.classList.add('flex', 'jump-enter');
        } else if (!show && !dom.jumpToLatest.classList.contains('hidden')) {
            dom.jumpToLatest.classList.add('hidden');
            dom.jumpToLatest.classList.remove('flex', 'jump-enter');
        }
    };
    dom.chatHistoryContainer.addEventListener('scroll', () => {
        if (headerTick) return;
        headerTick = true;
        requestAnimationFrame(() => {
            dom.appHeader.classList.toggle('header-scrolled', dom.chatHistoryContainer.scrollTop > 4);
            updateJumpPill();
            headerTick = false;
        });
    }, { passive: true });
    // Click = go to the live bottom; the next scroll event hides the pill.
    dom.jumpToLatest?.addEventListener('click', () => {
        dom.chatHistoryContainer.scrollTo({ top: dom.chatHistoryContainer.scrollHeight, behavior: 'smooth' });
    });

    // --- Composer chips (B3/B4): per-message Web search / Think toggles. ---
    // Capability gating lives in syncComposerChips(); re-sync after each toggle
    // so the active visual state follows the (possibly re-gated) state.
    dom.webSearchChip?.addEventListener('click', () => {
        if (dom.webSearchChip.disabled) return;
        state.webSearchEnabled = !state.webSearchEnabled;
        syncComposerChips();
    });
    dom.thinkingChip?.addEventListener('click', () => {
        if (dom.thinkingChip.disabled) return;
        state.thinkingEnabled = !state.thinkingEnabled;
        syncComposerChips();
    });

    // --- Model Selector Listeners ---

    // B5 (v1.0.6): enter-only, origin-aware motion via `@starting-style`
    // (see .model-panel in src/input.css). The old code wrote inline
    // opacity/transform and hid the panel 200ms later from five separate call
    // sites — those timers raced each other, so open → close → open could
    // leave the panel stuck invisible.
    const openModelPanel = () => {
        renderModelSelectorOptions(); // re-render options every time it's opened
        dom.modelSelectorPanel.classList.remove('hidden');
        const activeOrFirst = dom.modelSelectorPanel.querySelector('button[class*="bg-coral-soft"]')
            || dom.modelSelectorPanel.querySelector('button');
        if (activeOrFirst) activeOrFirst.focus();
    };
    const closeModelPanel = ({ restoreFocus = false } = {}) => {
        if (!dom.modelSelectorPanel.classList.contains('hidden')) {
            dom.modelSelectorPanel.classList.add('hidden');
        }
        if (restoreFocus) dom.modelSelectorBtn.focus();
    };

    const handleModelSelectorNavigation = (e) => {
        if (dom.modelSelectorPanel.classList.contains('hidden')) return;

        const buttons = Array.from(dom.modelSelectorPanel.querySelectorAll('button'));
        if (buttons.length === 0) return;

        const currentIndex = buttons.findIndex(btn => btn === document.activeElement);

        if (e.key === 'Escape') {
            e.preventDefault();
            closeModelPanel({ restoreFocus: true });
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

        // Provider-grouped menu (single column on phones, two CSS columns from
        // md up — 2.2.8 owner request for better model visibility).
        const groups = new Map();
        Object.keys(MODEL_CONFIG).forEach(key => {
            const provider = getProviderColor(key).label;
            if (!groups.has(provider)) groups.set(provider, []);
            groups.get(provider).push(key);
        });

        groups.forEach((keys, providerLabel) => {
            // Each provider is one unbreakable block so the two-column flow
            // never splits a heading away from its options.
            const groupEl = document.createElement('div');
            groupEl.className = 'break-inside-avoid';

            const heading = document.createElement('div');
            heading.className = 'px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';
            heading.textContent = providerLabel;
            groupEl.appendChild(heading);

            keys.forEach(key => {
                const model = MODEL_CONFIG[key];
                const isActive = key === currentChatModel;
                const providerColor = getProviderColor(key);

                const optionEl = document.createElement('button');
                optionEl.className = `w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${isActive ? 'bg-coral-soft font-semibold text-ink' : 'hover:bg-card'}`;
                optionEl.dataset.modelKey = key;

                let checkmarkSvg = '';
                if (isActive) {
                    checkmarkSvg = `<svg class="w-4 h-4 text-coral" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clip-rule="evenodd" /></svg>`;
                }

                optionEl.innerHTML = `
                    <span class="flex items-center gap-2.5 min-w-0">
                        <span class="w-2 h-2 rounded-full ${providerColor.dot} flex-shrink-0"></span>
                        <span class="font-medium text-ink truncate">${model.name}</span>
                    </span>
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
                        closeModelPanel();
                    }
                });
                groupEl.appendChild(optionEl);
            });

            dom.modelSelectorPanel.appendChild(groupEl);
        });
    };



    // Typeahead (v2.0.9 roadmap #5): typing letters jumps panel focus to the
    // first matching model name. Buffer resets after 600ms of inactivity.
    let typeaheadBuf = '';
    let typeaheadTimer = null;
    dom.modelSelectorPanel.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length !== 1 || !/\S/.test(e.key)) return;
        e.preventDefault();
        typeaheadBuf = (typeaheadBuf + e.key).toLowerCase();
        clearTimeout(typeaheadTimer);
        typeaheadTimer = setTimeout(() => { typeaheadBuf = ''; }, 600);
        const match = Array.from(dom.modelSelectorPanel.querySelectorAll('button'))
            .find((btn) => (btn.textContent || '').trim().toLowerCase().startsWith(typeaheadBuf));
        if (match) match.focus();
    });

    dom.modelSelectorBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (dom.modelSelectorPanel.classList.contains('hidden')) openModelPanel();
        else closeModelPanel();
    });

    document.addEventListener('click', (e) => {
        // Close the model panel only if it is open AND the click landed outside
        // it and outside its trigger button. (The old version scheduled a hide
        // after ANY click — a tap elsewhere followed by the pill within 200ms
        // made the panel flash open then close.)
        const panel = dom.modelSelectorPanel;
        const isVisible = !panel.classList.contains('hidden');
        if (isVisible && !panel.contains(e.target) && !dom.modelSelectorBtn.contains(e.target)) {
            closeModelPanel({ restoreFocus: true });
        }

        // Also, ensure the smaller chat options menus are closed.
        if (!e.target.closest('.chat-list-item')) {
            document.querySelectorAll('.chat-options-menu').forEach(m => m.classList.add('hidden'));
        }
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

    // --- v2.0.15: composer overlap fixes (owner report, mobile) ---
    // (a) The dock is fixed and its height changes (keyboard offset, growing
    //     textarea). Keep the scroll area's bottom padding in sync so the
    //     newest message can never sit behind the composer.
    const syncScrollPadding = () => {
        if (!dom.composerDock || !dom.chatHistoryContainer) return;
        // v2.0.26: rect-measure (survives transforms/keyboard lift) + include
        // the keyboard offset so the padded zone covers dock + keypad state.
        const rect = dom.composerDock.getBoundingClientRect();
        const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb-h')) || 0;
        const h = window.innerWidth < 768 ? Math.max(rect.height + kb, 170) : 24;
        dom.chatHistoryContainer.style.paddingBottom = h + 'px';
    };
    syncScrollPadding();
    window.__abotSyncScrollPadding = syncScrollPadding;
    if (typeof ResizeObserver === 'function' && dom.composerDock) {
        new ResizeObserver(syncScrollPadding).observe(dom.composerDock);
    }
    window.addEventListener('resize', syncScrollPadding);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncScrollPadding);
    }
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(syncScrollPadding).catch(() => {});
    }
    window.addEventListener('load', syncScrollPadding);

    // (b) Auto-follow during streaming: only while the user is already at the
    //     bottom (scrolling up mutes the follow until they return — the user
    //     still owns the viewport when they want to read).
    // v2.0.26: autoFollow is USER-INTENT driven. The old version recomputed
    // from scroll distance on every scroll event — Chrome's scroll anchoring
    // (which shifts scrollTop during streaming innerHTML updates) could flip
    // it to false mid-stream, silently killing all follow ("auto scrolls to
    // half, rest hidden"). Now: only an explicit upward user gesture mutes it.
    window.__abotAutoFollow = true;
    const followContainer = dom.chatHistoryContainer;
    followContainer?.addEventListener('wheel', (e) => {
        if (e.deltaY < 0) window.__abotAutoFollow = false;
    }, { passive: true });
    let touchStartY = null;
    followContainer?.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    followContainer?.addEventListener('touchmove', (e) => {
        if (touchStartY !== null && e.touches[0].clientY > touchStartY + 10) {
            window.__abotAutoFollow = false; // swiping up = reading up
        }
    }, { passive: true });
    // Near-bottom on ANY scroll always re-arms follow.
    followContainer?.addEventListener('scroll', () => {
        const el = followContainer;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
            window.__abotAutoFollow = true;
        }
    }, { passive: true });
    window.__abotFollowBottom = () => {
        if (!window.__abotAutoFollow) return;
        const el = followContainer;
        // Force instant positioning (never smooth), settled across paints:
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
        setTimeout(() => { el.scrollTop = el.scrollHeight; el.style.scrollBehavior = prev; }, 250);
    };
    // v2.0.21: unlock helper — if any code path left body scroll locked
    // (modal overflow-lock without a matching close), the page became
    // unscrollable until refresh (owner report). Releases only when NO
    // dialog is actually open.
    window.__abotUnlockScroll = () => {
        const anyOpen = [dom.deleteModal, dom.guestLimitModal, dom.promptModal]
            .some((m) => m && !m.classList.contains('hidden'));
        if (!anyOpen) document.body.style.overflow = '';
    };

    // --- Phase 3: search + settings wiring ---
    // v2.0.7: search is a sheet with its own backdrop so the close control can
    // never be covered by the fixed composer/jump-pill layers on mobile. The
    // backdrop lives in the DOM (index.html); these helpers keep panel +
    // backdrop + aria in lockstep.
    const searchBackdrop = document.getElementById('searchBackdrop');
    const openSearch = () => {
        dom.searchPanel.classList.remove('hidden');
        searchBackdrop?.classList.remove('hidden');
        dom.messageSearchInput?.focus();
    };
    const closeSearch = () => {
        dom.searchPanel.classList.add('hidden');
        searchBackdrop?.classList.add('hidden');
        if (dom.searchResults) dom.searchResults.innerHTML = '';
    };
    const isSearchOpen = () => !dom.searchPanel.classList.contains('hidden');
    // 2.2.8: the header search toggle was removed with the overflow menu —
    // search is now opened from the sidebar quick actions / palette only, and
    // the in-panel close button below is the single explicit dismiss.
    // v1.0.4: search had no way out once opened — on mobile it is entered from
    // the drawer, so the header toggle was never reachable to dismiss it.
    dom.searchCloseBtn?.addEventListener('click', closeSearch);
    // Tap outside (backdrop) closes the sheet — the mobile-natural affordance.
    searchBackdrop?.addEventListener('click', closeSearch);
    let searchDebounce = null;
    dom.messageSearchInput?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => renderSearchResults(e.target.value.trim()), 200);
    });

    // --- Account menu (v1.0.7) ------------------------------------------------
    // The profile row opens a popup above itself. Dismissal follows the same
    // contract as every other popover here: outside click, Escape, or activating
    // an item — and focus goes back to the trigger. The switch rows deliberately
    // stay open, so several settings can be flipped in one visit.
    const setProfileMenu = (open) => {
        if (!dom.profileMenu || !dom.profileMenuBtn) return;
        dom.profileMenu.classList.toggle('hidden', !open);
        dom.profileMenuBtn.setAttribute('aria-expanded', String(open));
        if (open) dom.profileMenu.querySelector('[role="menuitem"]')?.focus();
    };
    const closeProfileMenu = ({ restoreFocus = false } = {}) => {
        if (!dom.profileMenu || dom.profileMenu.classList.contains('hidden')) return;
        setProfileMenu(false);
        if (restoreFocus) dom.profileMenuBtn.focus();
    };
    dom.profileMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        setProfileMenu(dom.profileMenu.classList.contains('hidden'));
    });
    dom.profileMenu?.addEventListener('click', (e) => {
        if (e.target.closest('[role="menuitem"]')) closeProfileMenu();
    });
    document.addEventListener('click', (e) => {
        if (!dom.profileMenu || dom.profileMenu.classList.contains('hidden')) return;
        if (dom.profileMenu.contains(e.target) || dom.profileMenuBtn.contains(e.target)) return;
        closeProfileMenu();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeProfileMenu({ restoreFocus: true });
    });
    if (dom.ttsToggle) {
        dom.ttsToggle.checked = localStorage.getItem('abot-auto-tts') === 'true';
        dom.ttsToggle.addEventListener('change', () => {
            localStorage.setItem('abot-auto-tts', dom.ttsToggle.checked ? 'true' : 'false');
            if (!dom.ttsToggle.checked) stopSpeaking();
        });
    }
    if (dom.timestampsToggle) {
        dom.timestampsToggle.checked = localStorage.getItem('abot-show-timestamps') !== 'false';
        dom.timestampsToggle.addEventListener('change', () => {
            localStorage.setItem('abot-show-timestamps', dom.timestampsToggle.checked ? 'true' : 'false');
            renderActiveChat();
        });
    }

    // New chat (Header)
    document.getElementById('headerNewChatBtn')?.addEventListener('click', createNewChatWrapper);

    // 2.2.8: the header "⋯" overflow menu was removed (owner request) — the
    // header now carries exactly two controls: sidebar toggle + new chat.

    dom.modelSelectorPanel.addEventListener('keydown', handleModelSelectorNavigation);
    // Tab must not escape the open model panel (a11y: keep focus in the menu)
    dom.modelSelectorPanel.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const items = [...dom.modelSelectorPanel.querySelectorAll('button')].filter(b => !b.disabled);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    dom.messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        setUnsentDraft(this.value.trim().length > 0);
        // B1: the hint carries the Enter shortcut — fade it once typing starts.
        if (dom.composerHint) dom.composerHint.style.opacity = this.value ? '0' : '1';
    });
    installDraftLeaveGuard(); // warn before leaving with an unsent draft or mid-stream
    initPalette(); // Ctrl+K command palette (roadmap #8)
    dom.messageInput.addEventListener('keydown', e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage()));
    dom.stopBtn.addEventListener('click', () => {
        stopSpeaking();
        // This listener is now ONLY responsible for UI and aborting.
        const allBotSpans = dom.chatHistory.querySelectorAll('span[id^="bot-msg-"]');
        if (allBotSpans.length > 0) {
            const latestBotMessageSpan = allBotSpans[allBotSpans.length - 1];
            const finalContent = latestBotMessageSpan.querySelector('.content-span')?.innerHTML || "";
            // Use renderSafeMarkdown to be consistent with how other messages are rendered.
            latestBotMessageSpan.innerHTML = finalContent + renderSafeMarkdown('\n\n*-- Generation stopped --*');
        }

        if (state.abortController) {
            state.abortController.abort();
        }
    });

    dom.sendBtn.addEventListener('click', sendMessage);
    // Both the header hamburger (#sidebarToggle) and the in-drawer close
    // (#sidebarCloseBtn) drive the single setSidebar() state owner (ui.js).
    const onSidebarToggleClick = (e) => { e.stopPropagation(); toggleSidebar(); };
    dom.sidebarToggle.addEventListener('click', onSidebarToggleClick);
    if (dom.sidebarCloseBtn) dom.sidebarCloseBtn.addEventListener('click', onSidebarToggleClick);
    dom.sidebarOverlay.addEventListener('click', closeSidebar);

    // --- Sidebar quick actions (C1): mobile header declutter re-homed search,
    // prompt library and theme into the drawer. Actions close the drawer on
    // mobile first so the target UI isn't covered. ---
    dom.sidebarSearchBtn?.addEventListener('click', () => {
        closeSidebar();
        openSearch();
    });
    dom.sidebarPromptBtn?.addEventListener('click', () => {
        closeSidebar();
        openPromptModal();
    });

    // Breakpoint crossing: classes valid in one regime are inert/harmful in the
    // other (e.g. sidebar-collapsed margin on a phone). Re-sanitize on change.
    // jsdom (and some old browsers) lack matchMedia — degrade to "no listener".
    const mdMq = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)') : null;
    const onBreakpointChange = () => {
        dom.sidebar.classList.remove('sidebar-collapsed');
        if (mdMq.matches) {
            dom.sidebar.classList.remove('-translate-x-full');
        } else {
            dom.sidebar.classList.add('-translate-x-full');
        }
        dom.sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
        dom.sidebarToggle?.setAttribute('aria-expanded', String(!dom.sidebar.classList.contains('-translate-x-full')));
    };
    if (mdMq) {
        if (mdMq.addEventListener) mdMq.addEventListener('change', onBreakpointChange);
        else if (mdMq.addListener) mdMq.addListener(onBreakpointChange); // old Safari/Edge
    }


    dom.searchChats.addEventListener('input', (e) => renderChatList(e.target.value));

    // --- C3 (v1.0.6): warm tooltips -----------------------------------------
    // A tooltip waits ~240ms before appearing (so stray hovers don't flash),
    // but once you have seen one, sweeping to the next control shows it
    // immediately — the standard toolbar behaviour. One delegated listener.
    let lastTooltipAt = 0;
    document.addEventListener('pointerover', (e) => {
        if (!(e.target instanceof Element)) return;
        const trigger = e.target.closest('[data-tooltip]');
        if (!trigger) return;
        // Ignore pointer moves that stay inside the same trigger (icon → edge).
        if (e.relatedTarget instanceof Element && trigger.contains(e.relatedTarget)) return;
        const now = performance.now();
        document.querySelectorAll('[data-tooltip-instant]').forEach(el => el.removeAttribute('data-tooltip-instant'));
        if (now - lastTooltipAt < 1500) trigger.setAttribute('data-tooltip-instant', '');
        lastTooltipAt = now;
    }, { passive: true });

    // --- C5 (v1.0.6): swipe the mobile drawer closed -------------------------
    // Follows the finger 1:1 (transform only), then commits on either 35% of
    // the drawer width or a flick. A gesture only claims the touch once it is
    // clearly horizontal, so the chat list still scrolls normally.
    if (dom.sidebar) {
        const isMobileDrawer = () => !mdMq || !mdMq.matches;
        let startX = 0, startY = 0, lastX = 0, lastT = 0, dx = 0, vx = 0;
        let horizontal = false, swiping = false;
        dom.sidebar.addEventListener('touchstart', (e) => {
            if (!isMobileDrawer() || e.touches.length !== 1) return;
            startX = lastX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            lastT = performance.now();
            dx = 0; vx = 0; horizontal = false; swiping = false;
        }, { passive: true });
        dom.sidebar.addEventListener('touchmove', (e) => {
            if (!isMobileDrawer() || e.touches.length !== 1) return;
            const touch = e.touches[0];
            const ddx = touch.clientX - startX;
            const ddy = touch.clientY - startY;
            if (!horizontal) {
                if (Math.abs(ddx) < 12 && Math.abs(ddy) < 12) return;
                // Vertical intent → hand the gesture back to the scrollable list.
                if (Math.abs(ddx) < Math.abs(ddy) * 1.3) { horizontal = true; swiping = false; return; }
                horizontal = true;
                swiping = true;
                dom.sidebar.style.transition = 'none';
            }
            if (!swiping) return;
            const now = performance.now();
            vx = (touch.clientX - lastX) / Math.max(now - lastT, 1); // px/ms, <0 = closing
            lastX = touch.clientX;
            lastT = now;
            dx = Math.min(0, ddx); // only leftward drags move the drawer
            dom.sidebar.style.transform = `translateX(${dx}px)`;
        }, { passive: true });
        const endDrawerSwipe = () => {
            if (!swiping) { horizontal = false; return; }
            const width = dom.sidebar.getBoundingClientRect().width || 288;
            const dismiss = -dx > width * 0.35 || vx < -0.5;
            swiping = false;
            horizontal = false;
            dom.sidebar.style.transition = '';
            dom.sidebar.style.transform = ''; // hand control back to the class
            if (dismiss) closeSidebar();
        };
        dom.sidebar.addEventListener('touchend', endDrawerSwipe, { passive: true });
        dom.sidebar.addEventListener('touchcancel', endDrawerSwipe, { passive: true });
    }

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
            if (!dom.searchPanel.classList.contains('hidden')) {
                closeSearch();
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



    // 2.2.8: the sidebar's inline title-rename block was removed (owner
    // request) — renaming lives in each chat row's options menu (renderChatList).

    // --- Modal & Import/Export Listeners ---
    dom.promptOverlay.addEventListener('click', closePromptModal);
    dom.promptCancelBtn.addEventListener('click', closePromptModal);
    dom.promptSaveBtn.addEventListener('click', saveSystemPrompt);
    dom.importChatBtn.addEventListener('click', () => dom.importFileInput.click());
    dom.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) { importChat(e.target.files[0]); }
        e.target.value = null;
    });

    // --- Modal a11y (skills-audit): scroll-lock + focus restore for every
    // dialog. Class mutations are the single source of truth — chat.js and
    // app.js both open/close via classList, so one observer covers all paths.
    const rememberOpener = new WeakMap();
    const observeModal = (modalEl) => {
        if (!modalEl) return;
        new MutationObserver(() => {
            const open = !modalEl.classList.contains('hidden');
            if (open) {
                if (document.activeElement && document.activeElement !== document.body) {
                    rememberOpener.set(modalEl, document.activeElement);
                }
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
                const opener = rememberOpener.get(modalEl);
                if (opener && document.contains(opener)) {
                    try { opener.focus({ preventScroll: true }); } catch { opener.focus(); }
                }
            }
        }).observe(modalEl, { attributes: true, attributeFilter: ['class'] });
    };
    observeModal(dom.deleteModal);
    observeModal(dom.guestLimitModal);
    observeModal(dom.promptModal);

    // Focus-trap for every dialog (v2.0.9): Tab cycles ALL focusable
    // descendants — no more hardcoded two-button traps.
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const trapFocus = (modalEl) => {
        if (!modalEl) return;
        modalEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            // NOTE: offsetParent is null inside position:fixed containers
            // (all our dialogs) — visibility is judged by the .hidden class
            // instead, which is how dialogs are shown/hidden throughout.
            const items = Array.from(modalEl.querySelectorAll(FOCUSABLE))
                .filter((el) => !el.disabled && !el.closest('.hidden'));
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !modalEl.contains(document.activeElement))) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !modalEl.contains(document.activeElement))) {
                e.preventDefault(); first.focus();
            }
        });
    };
    trapFocus(dom.deleteModal);
    trapFocus(dom.guestLimitModal);
    trapFocus(dom.promptModal);

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
        // v2.1.4 audit fix (BUG-1): abort an in-flight stream targeting the
        // chat being deleted — otherwise the stream keeps running, mutates the
        // detached object, and its finally-block re-creates the chat doc.
        if (String(chatId) === String(state.activeChatId) && state.abortController) {
            state.abortController.abort();
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

// Phase 6.5: client-state reset + build identity
// Visit <site>/#reset to wipe SW/caches/storage and reload (recovery tool).
window.ABOT_BUILD = '2026-10-17.2';
console.log(`[ABot] build ${window.ABOT_BUILD}`);
if (location.hash === '#reset') {
    (async () => {
        try {
            const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
            await Promise.all(regs.map((r) => r.unregister()));
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            localStorage.clear();
            sessionStorage.clear();
            console.log('[ABot] client state cleared — reloading');
        } catch (e) {
            console.error('[ABot] reset failed:', e);
        }
        location.replace(location.pathname);
    })();
}

// Phase 6.5c: real-click recorder (capture phase — fires even when other
// code stops propagation). #diag prints the last clicks so we can see
// exactly which element a PHYSICAL tap lands on.
window.__abotClicks = window.__abotClicks || [];
document.addEventListener('click', (e) => {
    const t = e.target;
    const desc = t && t.tagName
        ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
        : 'unknown';
    window.__abotClicks.push({ x: e.clientX, y: e.clientY, at: desc, time: new Date().toLocaleTimeString() });
    if (window.__abotClicks.length > 12) window.__abotClicks.shift();
}, true);

// Phase 3.5b: surface runtime errors (diagnostic aid)
let runtimeErrorToasted = false;
window.__abotErrors = window.__abotErrors || [];
window.addEventListener('error', (e) => {
    window.__abotErrors.push(`${e.message} @ ${e.filename}:${e.lineno}`);
    console.error('[ABot] runtime error:', e.message, e.filename + ':' + e.lineno);
    if (!runtimeErrorToasted) {
        runtimeErrorToasted = true;
        import('./utils.js').then(u => u.showToast('A background error occurred — details in console (F12)', 'error')).catch(() => {});
    }
});
window.addEventListener('unhandledrejection', (e) => {
    window.__abotErrors.push('unhandled rejection: ' + (e.reason && (e.reason.stack || e.reason.message) || String(e.reason)));
    console.error('[ABot] unhandled promise rejection:', e.reason);
});

function main() {
    registerServiceWorker();
    initFirebase();            // was statements #3-6
    initDomExtras();           // was statements #33 and #59
    initMessageActions();      // was statements #43-44
    registerInitApp(initApp);  // auth's onAuthStateChanged needs initApp
    initAuth();                // was statements #52,54-58,60-65
    // footer year (the old duplicate in-app footer was removed in the revamp)
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// --- Phase 6.5b: #diag — in-page interaction self-test (mobile-friendly) ---
async function runDiagnostics() {
    const results = [];
    const add = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    add('build', true, window.ABOT_BUILD || '?');
    add('viewport', true, window.innerWidth + 'x' + window.innerHeight);
    try {
        const dup = {};
        document.querySelectorAll('[id]').forEach((el) => { dup[el.id] = (dup[el.id] || 0) + 1; });
        const dups = Object.entries(dup).filter(([, n]) => n > 1).map(([id, n]) => id + 'x' + n);
        add('duplicate ids', dups.length === 0, dups.join(', ') || 'none');
    } catch (e) { add('duplicate ids', false, e.message); }
    try {
        navigator.serviceWorker.getRegistrations().then((rs) => {
            if (rs.length) results.push('SW: ' + rs.map((r) => (r.active && r.active.scriptURL) || '?').join(', '));
            return caches.keys();
        }).then((keys) => { if (keys.length) results.push('caches: ' + keys.join(', ')); }).catch(() => {});
    } catch {}

    let stateMod = null;
    try { stateMod = await import('./state.js'); } catch (e) { add('import state.js', false, e.message); }
    const st = stateMod ? stateMod.state : null;
    add('initApp completed (state.isAppInitialized)', st ? !!st.isAppInitialized : false);

    if (window.__abotErrors && window.__abotErrors.length) {
        results.push('--- captured errors ---');
        window.__abotErrors.slice(0, 6).forEach((e) => results.push('ERR  ' + e));
    }
    if (window.__abotClicks && window.__abotClicks.length) {
        results.push('--- last REAL clicks (tap something, then run #diag) ---');
        window.__abotClicks.slice(-8).forEach((c) => results.push(`CLICK ${c.time} @(${c.x},${c.y}) -> ${c.at}`));
    } else {
        results.push('--- no real clicks recorded yet: tap a button, then re-run #diag ---');
    }

    const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    try {
        const before = document.documentElement.classList.contains('dark');
        const sw = dom.sidebarThemeSwitch;
        sw.checked = !before;
        sw.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(60);
        const after = document.documentElement.classList.contains('dark');
        add('theme toggle (account switch)', before !== after, `${before}->${after}`);
        sw.checked = before;
        sw.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { add('theme toggle', false, e.message); }

    try {
        click(dom.modelSelectorBtn);
        await sleep(350);
        const open = dom.modelSelectorPanel && !dom.modelSelectorPanel.classList.contains('hidden');
        const options = dom.modelSelectorPanel ? dom.modelSelectorPanel.querySelectorAll('button').length : 0;
        add('model selector opens', !!open, options + ' options');
        if (open) click(document.body);
        await sleep(250);
    } catch (e) { add('model selector opens', false, e.message); }

    try {
        const sb = dom.sidebar;
        const before = sb.className;
        click(dom.sidebarToggle);
        await sleep(120);
        const changed = sb.className !== before;
        add('sidebar toggle', changed);
        click(dom.sidebarToggle);
        await sleep(120);
    } catch (e) { add('sidebar toggle', false, e.message); }

    try {
        click(dom.profileMenuBtn); await sleep(60);
        const pm = dom.profileMenu && !dom.profileMenu.classList.contains('hidden');
        add('account menu opens', !!pm);
        if (pm) click(dom.profileMenuBtn);
    } catch (e) { add('account menu opens', false, e.message); }
    try {
        click(dom.sidebarSearchBtn); await sleep(60);
        const sp = dom.searchPanel && !dom.searchPanel.classList.contains('hidden');
        add('search panel opens (sidebar quick action)', !!sp);
        if (sp) click(dom.searchCloseBtn);
    } catch (e) { add('search panel opens', false, e.message); }

    ['signoutBtn', 'sidebarPromptBtn'].forEach((k) => {
        const el = dom[k];
        add(`${k} present`, !!el);
    });
    add('TTS support', typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined');

    // REAL hit-test: what would a physical tap on each control actually hit?
    results.push('--- real tap hit-test (elementFromPoint) ---');
    ['headerNewChatBtn', 'modelSelectorBtn', 'sidebarToggle', 'sendBtn'].forEach((k) => {
        const el = dom[k];
        if (!el) { add(`tap ${k}`, false, 'missing'); return; }
        const r = el.getBoundingClientRect();
        const cx = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
        const cy = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
        const hit = document.elementFromPoint(cx, cy);
        const ok = !!hit && (hit === el || el.contains(hit) || (hit && el.contains(hit.closest('[id]'))));
        add(`tap ${k}`, !!ok, ok ? 'reaches button' : `BLOCKED by <${hit ? hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : '') + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ').slice(0, 2).join('.') : '') : 'nothing'}>`);
    });

    // invisible-overlay detector: full-viewport, visible, click-catching layers
    try {
        const suspects = [];
        const vw = window.innerWidth, vh = window.innerHeight;
        document.querySelectorAll('body *').forEach((el) => {
            if (dom.appContainer && (el === dom.appContainer || dom.appContainer.contains(el))) return;
            if (el.id === 'auth-scene') return; // decorative backdrop, by design
            const cs = getComputedStyle(el);
            if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            if (cs.pointerEvents === 'none') return;
            const r = el.getBoundingClientRect();
            if (r.width > vw * 0.6 && r.height > vh * 0.6) {
                suspects.push(`<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}> ${Math.round(r.width)}x${Math.round(r.height)} z=${cs.zIndex} opacity=${cs.opacity}`);
            }
        });
        add('viewport-covering layers (outside app)', suspects.length === 0, suspects.slice(0, 3).join(' | ') || 'none');
    } catch (e) { add('overlay scan', false, e.message); }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:99999;border-top:2px solid #cc785c';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#252320;color:#faf9f5;font:12px monospace;padding:6px 12px';
    bar.innerHTML = '<span>ABOT DIAGNOSTICS</span>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ close & re-test by hand';
    closeBtn.style.cssText = 'background:#cc785c;color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer';
    closeBtn.addEventListener('click', () => wrap.remove());
    bar.appendChild(closeBtn);
    const pre = document.createElement('div');
    pre.style.cssText = 'background:#181715;color:#faf9f5;font:12px/1.5 monospace;padding:12px;max-height:50vh;overflow:auto;white-space:pre-wrap';
    pre.textContent = results.join('\n');
    wrap.appendChild(bar); wrap.appendChild(pre);
    document.body.appendChild(wrap);
}
if (location.hash === '#diag') {
    setTimeout(() => runDiagnostics().catch((e) => console.error('[ABot] diag crashed:', e)), 1500);
}

window.addEventListener('beforeunload', stopSpeaking);
document.addEventListener('DOMContentLoaded', main);
