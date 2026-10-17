/**
 * ABot — chat.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { GUEST_MESSAGE_LIMIT, getProviderColor } from './config.js';
import { MODEL_CONFIG } from './config.js';
import { applyModelColorTheme, syncComposerChips } from './ui.js';
import { closeSidebar } from './ui.js';
import { dom } from './dom.js';
import { formatRelativeTime, isSpeaking, speakText, stopSpeaking, setUnsentDraft, renderSafeMarkdown } from './utils.js';
import { showGuestLimitModal } from './ui.js';
import { showToast } from './utils.js';
import { state } from './state.js';
// --- On-demand highlight.js (skills-audit perf fix: 164 KB eager → lazy).
// First code block triggers a single deferred <script> load; all highlighting
// waits for it. Errors fall back gracefully to unstyled (still readable) code.
let highlightLoadPromise = null;
// A1 (v1.0.5): the library AND its theme used to be head-linked, so every
// visitor downloaded 159 KB plus a stylesheet even if they never saw a code
// block. Both are now injected on the first code block and runtime-cached by
// the service worker.
const loadHighlightJs = () => {
    if (window.hljs) return Promise.resolve();
    if (!highlightLoadPromise) {
        highlightLoadPromise = new Promise((resolve) => {
            if (!document.querySelector('link[data-hljs-theme]')) {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = '/vendor/atom-one-dark.css';
                css.dataset.hljsTheme = '1';
                document.head.appendChild(css);
            }
            const s = document.createElement('script');
            s.src = '/vendor/highlight.min.js';
            s.onload = () => resolve();
            s.onerror = () => {
                console.warn('[ABot] highlight.js failed to load; code blocks render unstyled.');
                resolve();
            };
            document.head.appendChild(s);
        });
    }
    return highlightLoadPromise;
};
const highlightWhenReady = (block) => {
    loadHighlightJs().then(() => {
        if (window.hljs && typeof window.hljs.highlightElement === 'function') {
            window.hljs.highlightElement(block);
        }
    });
};

export const loadUserChatsFromFirestore = async (userId) => {
    const chatsCollectionRef = state.db.collection('users').doc(userId).collection('chats');
    try {
        const snapshot = await chatsCollectionRef.orderBy('id', 'desc').get();
        if (snapshot.empty) {
            console.log("No chats found for user, creating a new one.");
            return false; // Signal that we need to create a new chat
        }

        const remoteChats = {};
        snapshot.forEach(doc => {
            remoteChats[doc.id] = doc.data();
        });
        state.chats = remoteChats; // Overwrite local chats with cloud data
        return true; // Signal that chats were loaded successfully

    } catch (error) {
        console.error("Error loading chats from Firestore:", error);
        // Handle error, maybe show a notification to the user
                        dom.chatList.innerHTML = `<div class="p-4 text-sm text-danger">Could not load chats.</div>`;
        return false;
    }
};

export const renameChat = async (chatId, newName) => {
    // Stop any title-generating animation that might be running
    if (state.titleAnimationInterval) {
        clearInterval(state.titleAnimationInterval);
        state.titleAnimationInterval = null;
    }
    const currentUser = state.auth.currentUser;
    const trimmedName = newName.trim();
    if (!state.chats[chatId] || !trimmedName || !currentUser) return;

    // 1. Update the local state first
    state.chats[chatId].name = trimmedName;

    // 2. Update Firestore in the background
    const chatDocRef = state.db.collection('users').doc(currentUser.uid).collection('chats').doc(chatId);
    chatDocRef.update({ name: trimmedName }).catch(err => console.error("Failed to rename chat in DB", err));

    // 3. Force a complete UI refresh
    renderChatList(); // Redraws the sidebar
    if (String(chatId) === String(state.activeChatId)) {
        renderActiveChat(); // Redraws the main header and content area
    }
};

export const exportChatMarkdown = (chatId) => {
    if (!state.chats[chatId]) return;
    const chat = state.chats[chatId];
    const lines = [];
    lines.push(`# ${chat.name}`, '');
    lines.push(`_Exported from ABot on ${new Date().toLocaleString()}_`, '', '---', '');
    (chat.messages || []).forEach((msg) => {
        const modelLabel = msg.role === 'assistant'
            ? (MODEL_CONFIG[msg.model]?.name || msg.model || 'AI')
            : null;
        lines.push(msg.role === 'user' ? '### 🧑 You' : `### 🤖 ${modelLabel}`, '', msg.content, '', '---', '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = chat.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `abot_chat_${safeName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Chat exported as Markdown!');
};

export const exportChat = (chatId) => {
    if (!state.chats[chatId]) return;
    const chat = state.chats[chatId];
    const jsonString = JSON.stringify(chat, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = chat.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    a.download = `abot_chat_${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Chat exported successfully!");
};

export const importChat = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const currentUser = state.auth.currentUser;
        if (!currentUser) {
            showToast("You must be logged in to import chats.", "error");
            return;
        }

        try {
            const importedChat = JSON.parse(e.target.result);
            if (importedChat.name && Array.isArray(importedChat.messages)) {
                const newChatId = String(Date.now());
                const newChatData = {
                    id: newChatId,
                    name: importedChat.name || "Imported Chat",
                    model: importedChat.model || Object.keys(MODEL_CONFIG)[0],
                    systemPrompt: importedChat.systemPrompt || "You are a helpful AI assistant.",
                    messages: importedChat.messages
                };

                await state.db.collection('users').doc(currentUser.uid).collection('chats').doc(newChatId).set(newChatData);

                state.chats[newChatId] = newChatData;
                switchChat(newChatId);
                showToast("Chat imported successfully!");

            } else {
                showToast('Invalid chat file format.', 'error');
            }
        } catch (err) {
            console.error("Import error:", err);
            showToast('Could not read or parse chat file.', 'error');
        }
    };
    reader.readAsText(file);
};

export const deleteChat = (chatId) => {
    const chat = state.chats[chatId];
    if (!chat) return;

    // 1. Configure Modal Text
    dom.deleteModal.querySelector('#modal-title').textContent = "Confirm Deletion";
    dom.deleteModalBody.textContent = 'Are you sure you want to delete the chat: "';
    const strong = document.createElement('strong');
    strong.className = 'font-medium text-ink';
    strong.textContent = chat.name;
    dom.deleteModalBody.appendChild(strong);
    dom.deleteModalBody.appendChild(document.createTextNode('"? This action cannot be undone.'));

    // 2. Configure Button
    const confirmBtn = dom.deleteConfirmBtn;
    confirmBtn.textContent = "Delete";
    confirmBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'bg-coral', 'hover:bg-coral-active');
    confirmBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    confirmBtn.dataset.chatId = chatId;

    // 3. Show Modal
    dom.deleteModal.classList.remove('hidden');
    setTimeout(() => {
        dom.deletePanel.style.opacity = '1';
        dom.deletePanel.style.transform = 'scale(1)';
        dom.deleteConfirmBtn.focus(); // Set focus
    }, 10);
};

export const renderChatList = (searchTerm = '') => {
    dom.chatList.innerHTML = '';
    const filteredChats = Object.values(state.chats).filter(chat => chat.name.toLowerCase().includes(searchTerm.toLowerCase()));
    filteredChats.sort((a, b) => b.id - a.id).forEach(chat => {
        const chatItemContainer = document.createElement('div');
        chatItemContainer.className = `relative chat-list-item group ${String(chat.id) === String(state.activeChatId) ? 'active' : ''}`;
        chatItemContainer.innerHTML = `<div class="flex items-center justify-between w-full rounded-xl ${String(chat.id) === String(state.activeChatId) ? '' : 'text-body hover:bg-card/70'}"><a href="#" class="flex-1 px-3 py-2.5 text-sm truncate" data-chat-id="${chat.id}"><span class="chat-name-span"></span></a><input type="text" class="chat-rename-input hidden flex-1 mx-2 p-1 text-sm bg-surface dark:bg-card rounded" value=""><button class="chat-options-btn p-2 mr-1 rounded-lg hover:bg-card transition-colors" aria-label="Chat options" data-tooltip="Chat options" data-tooltip-pos="left"><svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg></button></div><div class="absolute right-0 top-full mt-1 w-36 bg-canvas dark:bg-card border border-hairline rounded-xl shadow-lift z-10 hidden chat-options-menu overflow-hidden"><button class="rename-chat-btn w-full text-left px-3 py-2 text-sm hover:bg-card">Rename</button><button class="export-chat-btn w-full text-left px-3 py-2 text-sm hover:bg-card">Export JSON</button><button class="export-md-btn w-full text-left px-3 py-2 text-sm hover:bg-card">Export Markdown</button><button class="delete-chat-btn w-full text-left px-3 py-2 text-sm text-danger hover:bg-card">Delete</button></div>`;
        const nameSpan = chatItemContainer.querySelector('.chat-name-span');
        const renameInput = chatItemContainer.querySelector('.chat-rename-input');
        nameSpan.textContent = chat.name;
        renameInput.value = chat.name;
        const saveRename = () => { renameChat(chat.id, renameInput.value); };
        renameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { saveRename(); renameInput.blur(); } else if (e.key === 'Escape') { renameInput.blur(); } });
        renameInput.addEventListener('blur', () => { nameSpan.classList.remove('hidden'); renameInput.classList.add('hidden'); renderChatList(dom.searchChats.value); });
        chatItemContainer.querySelector('a').addEventListener('click', e => { e.preventDefault(); switchChat(chat.id); });
        chatItemContainer.querySelector('.chat-options-btn').addEventListener('click', e => { e.stopPropagation(); const menu = chatItemContainer.querySelector('.chat-options-menu'); document.querySelectorAll('.chat-options-menu').forEach(m => m !== menu && m.classList.add('hidden')); menu.classList.toggle('hidden'); });
        chatItemContainer.querySelector('.rename-chat-btn').addEventListener('click', e => { e.stopPropagation(); nameSpan.classList.add('hidden'); renameInput.classList.remove('hidden'); renameInput.focus(); renameInput.select(); chatItemContainer.querySelector('.chat-options-menu').classList.add('hidden'); });
        chatItemContainer.querySelector('.export-chat-btn').addEventListener('click', e => { e.stopPropagation(); exportChat(chat.id); chatItemContainer.querySelector('.chat-options-menu').classList.add('hidden'); });
        chatItemContainer.querySelector('.export-md-btn').addEventListener('click', e => { e.stopPropagation(); exportChatMarkdown(chat.id); chatItemContainer.querySelector('.chat-options-menu').classList.add('hidden'); });
        chatItemContainer.querySelector('.delete-chat-btn').addEventListener('click', e => { e.stopPropagation(); deleteChat(chat.id); });
        dom.chatList.appendChild(chatItemContainer);
    });
};

export function initMessageActions() {
// --- Message Action Helpers ---
// v1.0.6 (owner request): per-message deletion was removed from the UI. Only
// the copy + edit helpers remain for user rows; AI rows keep copy/speak/regen.
window.editMessage = (chatId, msgIndex) => {
    const chat = state.chats[chatId];
    const msg = chat?.messages[msgIndex];
    if (!msg) return;

    // Simple prompt for now
    const newContent = prompt("Edit your message:", msg.content);
    if (newContent !== null && newContent.trim() !== "" && newContent !== msg.content) {
        const oldContent = msg.content;
        msg.content = newContent;
        // Optimistic update
        if (state.activeChatId === chatId) renderActiveChat();

        state.db.collection('users').doc(state.auth.currentUser.uid).collection('chats').doc(chatId).update({ messages: chat.messages })
            .then(() => showToast("Message edited"))
            .catch(err => {
                console.error(err);
                msg.content = oldContent; // Revert
                if (state.activeChatId === chatId) renderActiveChat();
                showToast("Failed to edit", "error");
            });
    }
};
}

export const switchChat = (chatId) => {
    stopSpeaking();
    state.activeChatId = String(chatId);
    renderActiveChat();
    renderChatList(dom.searchChats.value);
    closeSidebar();
};

// 2.3.7 (owner request): a chat counts as "untouched" while it has no messages —
// a pre-2.3.5 chat still holding only the seeded greeting counts too (see the
// legacy cleanup in renderActiveChat).
const LEGACY_GREETING = 'Hello! How can I assist you today?';
const isEmptyChat = (chat) => !chat || !chat.messages || chat.messages.length === 0
    || (chat.messages.length === 1 && chat.messages[0].role === 'assistant'
        && chat.messages[0].content === LEGACY_GREETING);

export const createNewChat = async () => {
    const currentUser = state.auth.currentUser;
    if (!currentUser) {
        console.error("Cannot create new chat: No user is signed in.");
        return;
    }

    // 2.3.7 (owner request): tapping New Chat repeatedly (or while an untouched
    // chat already exists) must never pile up empty "New Chat" rows — stay on
    // the untouched chat you are on; otherwise reuse the newest untouched one.
    const activeChat = state.activeChatId ? state.chats[state.activeChatId] : null;
    if (activeChat && isEmptyChat(activeChat)) {
        closeSidebar();
        // 2.3.8 (owner request): make the no-op visible — an info toast explains
        // why nothing new was created.
        showToast('You already have a new chat open.', 'info');
        return;
    }
    const untouched = Object.values(state.chats)
        .filter((c) => isEmptyChat(c))
        .sort((a, b) => Number(b.id) - Number(a.id))[0];
    if (untouched) {
        switchChat(untouched.id);
        showToast('Switched to your existing new chat.', 'info');
        return;
    }

    dom.newChatBtn.disabled = true;
    dom.newChatSpinner.classList.remove('hidden');

    try {
        const newChatId = String(Date.now());
        const newChatData = {
            id: newChatId,
            name: "New Chat",
            model: Object.keys(MODEL_CONFIG)[0],
            systemPrompt: "You are an AI assistant powered by ABot, a multi-model chat platform. Your goal is to be helpful, accurate, and concise. When asked about yourself, you can mention you are running on the ABot application.",
            messages: []
        };

        await state.db.collection('users').doc(currentUser.uid).collection('chats').doc(newChatId).set(newChatData);

        state.chats[newChatId] = newChatData;

        switchChat(newChatId);

    } catch (error) {
        console.error("Error creating new chat in Firestore:", error);
        showToast("Error creating chat.", "error");
    } finally {
        dom.newChatBtn.disabled = false;
        dom.newChatSpinner.classList.add('hidden');
    }
};

// 2.2.4 (audit): trailing error cards get a Retry action. It replays the
// failed prompt through the regenerate path (pop the error + prompt, refill
// the composer, send again). Error cards deeper in the history must stay
// text-only — regenerate pops everything above the prompt, so retrying a
// stale error would silently drop every message sent after it.
const RETRY_BTN_HTML = `<button class="retry-btn mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-btn border border-danger/40 text-danger hover:bg-danger/10 transition-colors" aria-label="Retry" data-tooltip="Retry this message"><svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Retry</button>`;

export const appendMessage = (message, isHistory = false, options = {}) => {
    const { role, content: text, model: messageModel } = message;
    const isUser = role === 'user';
    const showTs = localStorage.getItem('abot-show-timestamps') !== 'false';
    const currentChat = state.chats[state.activeChatId];
    if (!currentChat) return;

    // CORE LOGIC: Use the message's own model, or fall back to the chat's current model.
    const modelConf = MODEL_CONFIG[messageModel || currentChat.model] || { name: 'AI', color: 'indigo-600' };
    const providerColor = getProviderColor(messageModel || currentChat.model);

    let messageContent;
    if (message.isError) {
        // v2.0.16 fix: persisted error cards must render their TEXT in every
        // path — as non-history assistant messages they used to fall into the
        // streaming-placeholder branch and show a typing indicator forever
        // (the "error looks like a second loading bubble" bug).
        // 2.2.4 (audit): only the LAST message may carry Retry (see the const above).
        const isTrailingError = typeof options.index === 'number' && options.index === currentChat.messages.length - 1;
        messageContent = `<div class="text-sm leading-6 text-danger" role="alert">⚠️ ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>${isTrailingError ? RETRY_BTN_HTML : ''}`;
    } else if (isUser) {
        messageContent = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
                        const uniqueId = `bot-msg-${Date.now()}`;
        if (isHistory) {
                            messageContent = message.isError
                                ? `<div class="text-sm leading-6 text-danger" role="alert">⚠️ ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
                                : `<span id="${uniqueId}">${renderSafeMarkdown(text)}</span>`;
        } else {
            // 2.2.8: the three bouncing dots became a mini dotted-"A" — the same
            // 18 dots as the app-loader wordmark, pulsing in a loop while the
            // reply streams. Same circle coords/delays as the splash dotmark
            // (index.html), so the wait state is on-brand; viewBox crops to "A".
            let indicatorHtml = '<div class="typing-indicator" role="status" aria-label="ABot is typing"><svg class="typing-a" viewBox="-4 -4 32 44" aria-hidden="true">'
                + '<circle cx="0" cy="36" r="2.3" style="animation-delay:0ms"/><circle cx="24" cy="36" r="2.3" style="animation-delay:32ms"/>'
                + '<circle cx="0" cy="30" r="2.3" style="animation-delay:22ms"/><circle cx="24" cy="30" r="2.3" style="animation-delay:54ms"/>'
                + '<circle cx="0" cy="24" r="2.3" style="animation-delay:44ms"/><circle cx="24" cy="24" r="2.3" style="animation-delay:76ms"/>'
                + '<circle cx="0" cy="18" r="2.3" style="animation-delay:66ms"/><circle cx="6" cy="18" r="2.3" style="animation-delay:74ms"/><circle cx="12" cy="18" r="2.3" style="animation-delay:82ms"/><circle cx="18" cy="18" r="2.3" style="animation-delay:90ms"/><circle cx="24" cy="18" r="2.3" style="animation-delay:98ms"/>'
                + '<circle cx="0" cy="12" r="2.3" style="animation-delay:88ms"/><circle cx="24" cy="12" r="2.3" style="animation-delay:120ms"/>'
                + '<circle cx="0" cy="6" r="2.3" style="animation-delay:110ms"/><circle cx="24" cy="6" r="2.3" style="animation-delay:142ms"/>'
                + '<circle cx="6" cy="0" r="2.3" style="animation-delay:140ms"/><circle cx="12" cy="0" r="2.3" style="animation-delay:148ms"/><circle cx="18" cy="0" r="2.3" style="animation-delay:156ms"/>'
                + '</svg></div>';
            if (options.isGoogle) {
                                indicatorHtml += `<p class="fade-in-polite text-xs text-muted mt-2 italic">Please wait, fetching the full response from Gemini…</p>`;
            }
                            messageContent = `<span id="${uniqueId}">${indicatorHtml}</span>`;
        }
    }

    // --- Action Buttons (v1.0.3/v1.0.6: owner spec — AI rows carry copy · read
    // aloud; user rows carry copy · edit. Nothing is deletable at message level
    // any more, so there is no destructive affordance to mis-tap on mobile.
    // Chats themselves are still deletable from the sidebar. 2.2.8: the
    // per-message regenerate icon was removed (owner request) — Retry on the
    // error card is the only regenerate affordance.) ---
                    const copyBtnHtml = `<button class="copy-message-btn p-1.5 rounded-md text-muted hover:text-ink transition-colors" data-tooltip="Copy" aria-label="Copy message"><svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg></button>`;

    const speakBtnHtml = `<button class="speak-btn p-1.5 rounded-md transition-colors hover:text-coral text-muted" aria-label="Read aloud" aria-pressed="false" data-tooltip="Read aloud"><svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 4.5c0-1.104-.806-2.03-1.886-2.03H11L9.66 5.33A2.5 2.5 0 017.5 6.5H5A2.5 2.5 0 002.5 9v6A2.5 2.5 0 005 17.5h2.5a2.5 2.5 0 012.16 1.17l1.34 2.83h.114C12.194 21.5 13 20.574 13 19.47v-14.97z"/><path d="M16.5 8.5a.75.75 0 011.06 0 5 5 0 010 7 .75.75 0 11-1.06-1.06 3.5 3.5 0 000-4.88.75.75 0 010-1.06z"/><path d="M19.09 5.5a.75.75 0 011.06 0 9 9 0 010 13 .75.75 0 11-1.06-1.06 7.5 7.5 0 000-10.88.75.75 0 010-1.06z"/></svg></button>`;

    // AI rows: copy + read aloud, parked top-right on the meta line.
    const aiActionsHtml = (!isUser) ? copyBtnHtml + speakBtnHtml : '';

    let actionButtonsHtml = '';
    if (typeof options.index === 'number') {
        actionButtonsHtml = `
                            ${isUser ? `<button class="edit-msg-btn p-1.5 text-muted hover:text-coral transition-colors" data-tooltip="Edit" aria-label="Edit message"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>` : ''}`;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'w-full'; // Wrapper
    if (typeof options.index === 'number') messageEl.dataset.msgIndex = String(options.index);
    if (!isHistory) messageEl.classList.add('message-enter');

    if (isUser) {
        // --- USER MESSAGE: right-aligned soft-coral bubble (Gemini pattern) ---
        messageEl.innerHTML = `
                            <div class="message-container w-full flex justify-end mb-5 group relative">
                                <div class="absolute right-full mr-2 top-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center bg-canvas dark:bg-card rounded-lg shadow-sm border border-hairline px-1">
                                    ${copyBtnHtml}
                                    ${actionButtonsHtml}
                                </div>
                                <div class="max-w-[85%] md:max-w-[75%] user-bubble bg-coral-soft px-4 py-2.5 text-[15px] leading-relaxed text-ink shadow-soft">
                                   <div class="prose dark:prose-invert max-w-none whitespace-pre-wrap">${messageContent}</div>
                                </div>
                            </div>
                        `;
    } else {
        // --- AI MESSAGE: full-width clean text + quiet model label (Claude/ChatGPT
        // pattern) — no bubble box, model identity is a small avatar + muted
        // label, content is the star. ---
        messageEl.innerHTML = `
                            <div class="message-container w-full flex flex-col mb-8 group">
                                <div class="flex items-center gap-2.5 mb-1.5 select-none">
                                    <div class="w-5 h-5 rounded-md ${providerColor.dot} flex items-center justify-center flex-shrink-0">
                                         <span class="text-white text-[8px] font-semibold">${modelConf.name.substring(0, 2).toUpperCase()}</span>
                                    </div>
                                    <span class="text-xs font-semibold ${providerColor.text}">${modelConf.name}</span>
                                    ${showTs ? `<span class="text-[11px] text-muted/80 msg-timestamp">${formatRelativeTime(message.ts)}</span>` : ''}
                                    <div class="ml-auto flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                        ${aiActionsHtml}
                                    </div>
                                </div>
                                <div class="w-full overflow-hidden">
                                    <div class="prose dark:prose-invert max-w-none text-body text-[15px] leading-7">
                                        ${messageContent}
                                    </div>
                                </div>
                            </div>
                        `;
    }

    // Attach Event Listeners
    if (typeof options.index === 'number') {
        messageEl.querySelector('.edit-msg-btn')?.addEventListener('click', (e) => { e.stopPropagation(); window.editMessage(state.activeChatId, options.index); });
        const speakBtn = messageEl.querySelector('.speak-btn');
        speakBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const msg = state.chats[state.activeChatId]?.messages[options.index];
            if (!msg) return;
            if (isSpeaking()) {
                stopSpeaking();
                speakBtn.setAttribute('aria-pressed', 'false');
            } else {
                speakText(msg.content, { onend: () => speakBtn.setAttribute('aria-pressed', 'false') });
                speakBtn.setAttribute('aria-pressed', 'true');
            }
        });
        messageEl.querySelector('.retry-btn')?.addEventListener('click', (e) => { e.stopPropagation(); regenerateLastResponse(); });
    }

    const copyBtn = messageEl.querySelector('.copy-message-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const proseContent = messageEl.querySelector('.prose'); // Simpler selection
            // 2.2.8: textContent of the template HTML carried indentation and
            // blank-line padding — copies had leading/trailing whitespace.
            // Strip trailing per-line spaces and squeeze 3+ blank lines to one.
            const raw = proseContent ? proseContent.textContent : '';
            const textToCopy = raw.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
            navigator.clipboard.writeText(textToCopy).then(() => showToast("Copied!")).catch(() => showToast("Failed to copy", "error"));
        });
    }

    dom.chatHistory.appendChild(messageEl);
    window.__abotFollowBottom?.(); // v2.0.15: keep up if the user is parked at the bottom

    // Syntax Highlighting for AI messages
    if (!isUser) {
        messageEl.querySelectorAll('pre code').forEach(block => {
            highlightWhenReady(block);
            // Add Copy Code button (simplified logic)
            const pre = block.parentElement;
            const copyCodeBtn = document.createElement('button');
            copyCodeBtn.className = 'copy-code-btn';
            copyCodeBtn.textContent = 'Copy';
            pre.classList.add('group'); // Enable hover
            copyCodeBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent);
                copyCodeBtn.textContent = 'Copied!';
                setTimeout(() => copyCodeBtn.textContent = 'Copy', 2000);
            });
            pre.appendChild(copyCodeBtn);
        });
    }

    // 2.2.8: the "Show more" collapse for long replies was removed (owner
    // request) — long answers scroll naturally.
};

// ---------------------------------------------------------------------------
// Phase 3: message meta (reactions / pins), search
// ---------------------------------------------------------------------------
const _persistMessageMeta = async (chatId) => {
    try {
        const uid = state.auth.currentUser.uid;
        await state.db.collection('users').doc(uid).collection('chats').doc(chatId)
            .update({ messages: state.chats[chatId].messages });
    } catch {
        console.error('Failed to save message meta');
        showToast('Could not save', 'error');
    }
};

export const performMessageSearch = (term) => {
    const results = [];
    if (!term || term.length < 2) return results;
    const needle = term.toLowerCase();
    for (const chatId of Object.keys(state.chats)) {
        const chat = state.chats[chatId];
        (chat.messages || []).forEach((msg, index) => {
            const content = (msg.content || '').toLowerCase();
            const pos = content.indexOf(needle);
            if (pos !== -1) {
                const start = Math.max(0, pos - 40);
                const end = Math.min(msg.content.length, pos + term.length + 40);
                const snippet = (start > 0 ? '…' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '…' : '');
                results.push({ chatId, chatName: chat.name || 'Chat', index, snippet, role: msg.role });
            }
        });
    }
    return results.slice(0, 30);
};

export const renderSearchResults = (term) => {
    if (!dom.searchResults) return;
    if (!term || term.length < 2) { dom.searchResults.innerHTML = ''; return; }
    const results = performMessageSearch(term);
    if (!results.length) {
        dom.searchResults.innerHTML = '<div class="text-sm text-muted px-2 py-1">No matches found.</div>';
        return;
    }
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    dom.searchResults.innerHTML = results.map((r) => `
        <button class="search-result w-full text-left px-3 py-2 rounded-btn bg-canvas dark:bg-card border border-hairline hover:border-coral transition-colors"
            data-chat-id="${esc(r.chatId)}" data-msg-index="${r.index}">
            <span class="block text-xs font-medium text-coral">${esc(r.chatName)}</span>
            <span class="block text-sm text-body truncate">${esc(r.snippet)}</span>
        </button>`).join('');
    dom.searchResults.querySelectorAll('.search-result').forEach(btn => {
        btn.addEventListener('click', () => {
            const chatId = btn.dataset.chatId;
            const idx = parseInt(btn.dataset.msgIndex, 10);
            switchChat(chatId);
            dom.searchPanel.classList.add('hidden');
            document.getElementById('searchBackdrop')?.classList.add('hidden');
            const jump = () => {
                const el = dom.chatHistory.querySelector(`[data-msg-index="${idx}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('search-highlight');
                    setTimeout(() => el.classList.remove('search-highlight'), 2000);
                }
            };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(jump);
            else setTimeout(jump, 0);
        });
    });
};

/* NEW Code to Add (This replaces the old start of the function) */
export const sendMessage = async () => {
    // v2.0.15 fix (owner report: "two identical responses for one question"):
    // sendMessage had NO in-flight guard, and isStreaming was set only after a
    // Firestore await — Enter keydown + send tap (or a double-tap) in that
    // window launched TWO streams for one prompt. Guard first, set immediately.
    if (state.isStreaming) return;
    const activeUser = state.auth.currentUser; // Define user ONCE at the top.
    if (!activeUser) {
        console.error("Attempted to send message without an active user.");
        return; // Stop if there's no user.
    }

    // Check for guest user message limit
    if (activeUser.isAnonymous) {
        if (state.guestSessionMessageCount >= GUEST_MESSAGE_LIMIT) {
            showGuestLimitModal();
            return;
        }
    }

    const message = dom.messageInput.value.trim();
    if (!message || !state.activeChatId) return;

    const currentChat = state.chats[state.activeChatId];
    if (!currentChat) return;

    let fullReply = "";
    let streamFailed = false; // v2.0.13: an SSE/provider error occurred — skip title-gen, persist the error
    // 2.1.3 (B-47): stream render throttle state — the chunk handler accumulates
    // text cheaply and flushes the DOM at most every ~100ms (see below).
    let streamFlushNeeded = false;
    let streamFlushScheduled = false;
    let streamDone = false;

    stopSpeaking(); // any ongoing narration ends when a new message is sent
    state.isStreaming = true; // set BEFORE any await (double-fire window fix)
    state.abortController = new AbortController(); // Create a new controller for this request

    // Create the user message object, now including the current model.
    // 2.2.4 (audit): every message now carries ts (Date.now()) — rendered as a
    // relative time on AI rows; legacy messages without ts fall back to the
    // old render-time clock.
    const userMessage = { role: 'user', content: message, model: currentChat.model, ts: Date.now() };
    appendMessage(userMessage, false, { index: currentChat.messages.length });
    currentChat.messages.push(userMessage);
    // 2.3.4: if this send leaves the new-chat landing, capture the landing
    // logo's position first so it can fly to the header mark after the layout
    // swaps (setEmptyMode clears the welcome markup).
    const landingLogoRect = document.body.classList.contains('chat-empty')
        ? document.getElementById('emptyLogo')?.getBoundingClientRect() || null
        : null;
    setEmptyMode(false); // first send leaves the new-chat layout immediately
    if (landingLogoRect) flyLogoToHeader(landingLogoRect);
    // A1: ONE deterministic scroll on send so the reply starts on screen —
    // never again during the stream; the user owns the viewport from here.
    dom.chatHistoryContainer.scrollTop = dom.chatHistoryContainer.scrollHeight;

    // Save the user's message to Firestore immediately to prevent data loss on refresh.
    try {
        const chatDocRef = state.db.collection('users').doc(activeUser.uid).collection('chats').doc(state.activeChatId);
        await chatDocRef.update({ messages: currentChat.messages });
    } catch (dbError) {
        console.error("Error saving user message to Firestore:", dbError);
        // 2.2.4 (audit, FM-4): this used to `return;` — a transient save error
        // (offline blip, rules hiccup) killed the send entirely and the prompt
        // sat in a dead composer. The message is already on screen and in
        // memory; carry on and let the finally-block save re-attempt
        // persistence with the full exchange.
        showToast("Couldn't save to history — sending anyway.", "error");
    }

    if (state.auth.currentUser && state.auth.currentUser.isAnonymous) {
        state.guestSessionMessageCount++;
    }

    // Check if this is the first user message in a new chat to trigger intelligent naming
    const isFirstUserMessage = currentChat.name === "New Chat" && currentChat.messages.filter(m => m.role === 'user').length === 1;

    if (isFirstUserMessage) {
        // 2.2.8: the sidebar title block was removed — the header title is the
        // only place this animation shows now.
        if (dom.headerChatTitle) dom.headerChatTitle.textContent = "Generating Title.";
        let dotCount = 1;
        // Start the animation and store its ID
        state.titleAnimationInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1; // Cycle dotCount between 1, 2, 3
            if (dom.headerChatTitle && dom.headerChatTitle.textContent.startsWith("Generating")) { // Only animate if not already renamed
                dom.headerChatTitle.textContent = "Generating Title" + ".".repeat(dotCount);
            }
        }, 500); // Update the text every half-second
    }

    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    setUnsentDraft(false); // draft shipped — clear leave-guard
    // 2.1.3 (B-48): desktop keeps focus for rapid follow-up typing; on mobile
    // the keyboard must DISMISS after send — it stayed open over the reply,
    // squished the viewport behind the composer, and caused mistyped
    // accidental re-sends (owner report).
    if (window.innerWidth >= 768) dom.messageInput.focus();
    else dom.messageInput.blur();
    // v2.0.26: focusing opens the keyboard → --kb-h grows and the dock lifts;
    // re-sync padding + settle so the reply is never behind dock+keyboard.
    if (typeof window.__abotSyncScrollPadding === 'function') {
        setTimeout(() => { window.__abotSyncScrollPadding(); window.__abotFollowBottom?.(); }, 320);
    }

    // B2: single morphing control — the stop state overlays the send button
    // (same geometry, crossfade), no layout jump.
    dom.stopBtn.classList.remove('stop-hidden');
    state.isStreaming = true;

    dom.modelSelectorBtn.disabled = true;
    dom.modelSelectorBtn.classList.add('opacity-50', 'cursor-not-allowed');

    const isGoogleModel = currentChat.model.startsWith('google/');
    // Append the placeholder message with the current model's info
    appendMessage({ role: 'assistant', content: '', model: currentChat.model, ts: Date.now() }, false, { isGoogle: isGoogleModel });

    const allBotSpans = dom.chatHistory.querySelectorAll('span[id^="bot-msg-"]');
    const latestBotMessageSpan = allBotSpans[allBotSpans.length - 1];

    if (!latestBotMessageSpan) {
        dom.stopBtn.classList.add('stop-hidden');
        state.isStreaming = false;
        state.abortController = null;
        return;
    }

    const messagesToSend = [
        { role: 'system', content: currentChat.systemPrompt },
        ...currentChat.messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10)
    ];

    const currentUser = state.auth.currentUser;
    if (!currentUser) {
        latestBotMessageSpan.innerHTML = "<strong>Authentication Error:</strong> You are not signed in.";
        return;
    }

    try {
        const cleanedMessages = messagesToSend.map(({ role, content }) => ({ role, content }));

        const idToken = await currentUser.getIdToken(true);

        const response = await fetch('/api/chat', {
            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({
                model: currentChat.model,
                messages: cleanedMessages,
                options: { webSearch: state.webSearchEnabled, thinking: state.thinkingEnabled },
            }),
            signal: state.abortController.signal
        });

        if (!response.ok) {
            let errorMsg = "Could not get response from the server.";
            try {
                const errData = await response.json();
                if (errData && typeof errData.error === 'string') {
                    errorMsg = errData.error;
                }
            } catch {
                // Ignore json parse error
            }
            throw new Error(errorMsg);
        }

        if (!response.body) throw new Error("Response body is missing.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let isFirstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            while (buffer.includes('\n\n')) {
                const endOfChunk = buffer.indexOf('\n\n');
                const chunk = buffer.substring(0, endOfChunk).trim();
                buffer = buffer.substring(endOfChunk + 2);

                if (chunk.startsWith('event: error')) {
                    // v2.0.13: persist the error as a real assistant message.
                    // It used to be DOM-only, and the title-generation rename in
                    // the finally block re-rendered the chat ~2s later — wiping
                    // the error (the "error vanishes" bug).
                    const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
                    let errMsg = 'Something went wrong while generating a response. Please try again.';
                    try {
                        const errorPayload = dataLine ? JSON.parse(dataLine.substring(6)) : {};
                        errMsg = errorPayload.message || errMsg;
                        console.error('[ABot] stream error:', errorPayload.code || 'unknown', '-', errMsg);
                    } catch { }
                    streamFailed = true;
                    streamDone = true; // 2.1.3: kill any pending throttled flush — it must not overwrite the error card
                    // v2.0.20: the loading bubble BECOMES the error card (in
                    // place) — the user sees one bubble morph, never a second
                    // one appearing next to the placeholder.
                    const safeErr = errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    if (latestBotMessageSpan) {
                        latestBotMessageSpan.innerHTML =
                            `<div class="text-sm leading-6 text-danger" role="alert">⚠️ ${safeErr}</div>${RETRY_BTN_HTML}`;
                        // 2.2.4 (audit): these morphed-in cards bypass the
                        // index-based wiring inside appendMessage — attach here.
                        latestBotMessageSpan.querySelector('.retry-btn')?.addEventListener('click', (e) => { e.stopPropagation(); regenerateLastResponse(); });
                    } else {
                        dom.chatHistory.querySelector('.typing-indicator')?.closest('.message-container')?.remove();
                        const now = currentChat.messages.length;
                        appendMessage({ role: 'assistant', content: errMsg, model: currentChat.model, isError: true }, false, { index: now });
                    }
                    const errorMsg = { role: 'assistant', content: errMsg, model: currentChat.model, isError: true, ts: Date.now() };
                    currentChat.messages.push(errorMsg);
                    return;
                }

                if (chunk.startsWith('data: ')) {
                    const jsonStr = chunk.substring(6).trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const textChunk = (parsed.candidates?.[0]?.content?.parts?.[0]?.text) || (parsed.choices?.[0]?.delta?.content) || '';

                        if (textChunk) {
                            fullReply += textChunk;

                            if (isFirstChunk) {
                                                latestBotMessageSpan.innerHTML = `<span class="content-span">${renderSafeMarkdown(fullReply)}</span><span class="blinking-cursor"></span>`;
                                isFirstChunk = false;
                            } else {
                                // 2.1.3 (B-47): re-parsing + innerHTML + follow on EVERY
                                // SSE chunk saturated the UI thread on phones — the screen
                                // "froze" while a model responded (only the model selector
                                // is meant to disable). Accumulate cheaply per chunk and
                                // flush the DOM at most every ~100ms.
                                streamFlushNeeded = true;
                                if (!streamFlushScheduled) {
                                    streamFlushScheduled = true;
                                    setTimeout(() => {
                                        streamFlushScheduled = false;
                                        if (streamDone || !streamFlushNeeded) return;
                                        streamFlushNeeded = false;
                                        const contentHolder = latestBotMessageSpan.querySelector('.content-span');
                                        if (contentHolder) contentHolder.innerHTML = renderSafeMarkdown(fullReply);
                                        window.__abotFollowBottom?.();
                                    }, 100);
                                }
                            }
                        }
                    } catch {
                        console.warn("Could not parse JSON chunk:", jsonStr);
                    }
                }
            }
            // A1: intentionally NO in-stream auto-scroll — the user reads the
            // first lines and scrolls down when they choose (E1 pill covers
            // "catch up" if they scrolled away mid-stream).
        }

        // 2.1.3 (B-47): stream over — any pending throttled flush must not fire
        // (the full final render below already covers the complete reply).
        streamDone = true;
        const contentHolder = latestBotMessageSpan.querySelector('.content-span');
        const cursor = latestBotMessageSpan.querySelector('.blinking-cursor');
        if (contentHolder) contentHolder.innerHTML = renderSafeMarkdown(fullReply);
        if (cursor) cursor.remove();

        latestBotMessageSpan.closest('.prose').querySelectorAll('pre code').forEach(block => {
            const pre = block.parentElement;
            if (pre.querySelector('.copy-code-btn')) return;
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            });
            pre.appendChild(copyBtn);
            highlightWhenReady(block);
        });

        currentChat.messages.push({ role: 'assistant', content: fullReply, model: currentChat.model, ts: Date.now() });
        if (localStorage.getItem('abot-auto-tts') === 'true' && fullReply) {
            speakText(fullReply);
        }


    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Chat generation aborted. Saving partial response.");
            const finalContent = fullReply || "";
            const stoppedMessage = finalContent + '\n\n*-- Generation stopped --*';
            currentChat.messages.push({ role: 'assistant', content: stoppedMessage, model: currentChat.model, ts: Date.now() });
        } else {
            console.error("sendMessage stream error:", error);
            streamFailed = true;
            streamDone = true; // 2.1.3: pending throttled flush must not overwrite the error card
            dom.chatHistory.querySelector('.typing-indicator')?.closest('.message-container')?.remove();
            const netErrMsg = { role: 'assistant', content: 'Connection error: ' + (error.message || 'could not reach the server.'), model: currentChat.model, isError: true, ts: Date.now() };
            currentChat.messages.push(netErrMsg);
            appendMessage(netErrMsg, false, { index: currentChat.messages.length - 1 });
        }
    }
    finally {
        // --- THIS IS THE FINAL, CORRECT VERSION ---

        // 1. Save the final state of the chat to Firestore.
        // v2.1.4 audit fix (BUG-1): if the user DELETED this chat mid-stream,
        // skip the save — update() on the missing doc silently re-created a
        // zombie chat containing the streamed reply.
        const chatStillExists = !!state.chats[state.activeChatId];
        if (!chatStillExists) {
            console.log('[ABot] chat deleted mid-stream — skipping final save');
        }
        try {
        if (chatStillExists) {
            const chatDocRef = state.db.collection('users').doc(activeUser.uid).collection('chats').doc(state.activeChatId);
            await chatDocRef.update({
                messages: currentChat.messages,
                name: currentChat.name
            });
        }
        } catch (dbError) {
            console.error("Error saving final chat state to Firestore:", dbError);
        }

        // 2. Reset the UI buttons + per-message composer chips.
        dom.stopBtn.classList.add('stop-hidden');
        state.isStreaming = false;
        // Stream over: the E1 pill must never outlive the reply (no scroll
        // event fires here if the user is parked above, so hide it directly).
        dom.jumpToLatest?.classList.add('hidden');
        dom.jumpToLatest?.classList.remove('flex', 'jump-enter');
        state.abortController = null;
        state.webSearchEnabled = false;
        state.thinkingEnabled = false;
        syncComposerChips();
        // v2.0.21: release any stray scroll lock + settle the view so the
        // latest content is never stuck behind the composer (owner report:
        // "can't scroll until refresh" on mobile).
        window.__abotUnlockScroll?.();
        window.__abotSyncScrollPadding?.();
        window.__abotFollowBottom?.();
        dom.modelSelectorBtn.disabled = false;
        dom.modelSelectorBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        // 3. Generate the title if it was the first message.
        // v2.0.13: not after a failed stream — a failed first message keeps
        // "New Chat" (the retry via regenerate will title it on success).
        if (isFirstUserMessage && !streamFailed) {
            try {
                                const conversationForTitle = currentChat.messages.slice(1, 3).map(m => `${m.role}: ${m.content}`).join('\n');
                                const titlePrompt = `Based on this conversation, create a concise, 5-word-or-less title. Do not use quotation marks.\n\n---\n${conversationForTitle}`;
                const idToken = await activeUser.getIdToken(true);
                const response = await fetch('/api/chat', {
                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ model: 'google/gemini-3.5-flash-lite', messages: [{ role: 'user', content: titlePrompt }] }) // 2.2.4 (audit): registry id refreshed (was gemini-2.5-flash, retired)
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let title = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.substring(6);
                            if (jsonStr.trim() === "[DONE]") continue;
                            try {
                                const parsed = JSON.parse(jsonStr);
                                title += (parsed.candidates?.[0]?.content?.parts?.[0]?.text) || (parsed.choices?.[0]?.delta?.content) || '';
                            } catch { }
                        }
                    }
                }
                if (title) {
                    await renameChat(state.activeChatId, title.trim().replace(/"/g, ''));
                }
            } catch (titleError) {
                console.error("Could not generate title:", titleError);
                await renameChat(state.activeChatId, message.substring(0, 30)); // Fallback
            }
        }
    }
};

// v1.0.6 (owner request): the new-chat screen centers the composer and offers
// ready-made prompts UNDER it. `chat-empty` on <body> switches the layout (CSS),
// and the pills live outside the scroll area so they land below the composer
// instead of above it. 2.3.5 (owner request): the old two-line cards became a
// single-line pill row; still click-to-fill only — zero extra AI calls.
const SUGGESTIONS = [
    { label: 'Explain a concept', prompt: 'Explain how large language models work, in simple terms.' },
    { label: 'Brainstorm ideas', prompt: 'Brainstorm 10 names for a warm, minimal AI chat app.' },
    { label: 'Help me write', prompt: 'Help me write a short, friendly follow-up email to a client.' },
    { label: 'Debug my code', prompt: 'I will paste some code — help me find and fix the bug.' },
    { label: 'Plan a trip', prompt: 'Plan a relaxed 5-day city trip for me, with a light daily schedule.' },
    { label: 'Check my reasoning', prompt: 'I will share an argument — check my reasoning and point out weak spots.' },
    { label: 'Summarize a text', prompt: 'I will paste a long text — summarize it into a few clear bullet points.' },
    { label: 'Translate something', prompt: 'Help me translate a short message into clear, natural English.' },
];

const setEmptyMode = (isEmpty) => {
    document.body.classList.toggle('chat-empty', isEmpty);
    dom.emptyWelcome?.classList.toggle('hidden', !isEmpty);
    dom.emptySuggestions?.classList.toggle('hidden', !isEmpty);
    // 2.3.4: the header centre hosts the brand mark whenever a real chat is on
    // screen; the empty landing keeps its own (bigger) logo instead.
    dom.headerLogo?.classList.toggle('opacity-0', isEmpty);

    if (!isEmpty) {
        if (dom.emptyWelcome) dom.emptyWelcome.innerHTML = '';
        if (dom.emptySuggestions) dom.emptySuggestions.innerHTML = '';
        return;
    }
    if (!dom.emptySuggestions) return;

    dom.emptySuggestions.innerHTML = `
        <div class="flex flex-wrap justify-center gap-2">
            ${SUGGESTIONS.map(sg => `
                <button type="button" class="suggestion-pill suggestion-enter inline-flex items-center whitespace-nowrap px-3.5 py-1.5 rounded-full border border-hairline bg-raised text-xs font-medium text-body cursor-pointer transition-[box-shadow,transform,border-color,color] duration-base ease-out active:scale-[0.98] hover:text-ink" data-prompt="${sg.prompt.replace(/"/g, '&quot;')}">${sg.label}</button>`).join('')}
        </div>`;
    dom.emptySuggestions.classList.remove('hidden');
    dom.emptySuggestions.querySelectorAll('.suggestion-pill').forEach(pill => {
        pill.addEventListener('click', () => { dom.messageInput.value = pill.dataset.prompt; dom.messageInput.focus(); });
    });
};

// 2.3.4 (owner request): first-send logo flight — the landing logo glides from
// its spot above the composer into the header's centre mark. FLIP: measure both
// rects, animate the header logo from the landing position back to rest
// (transform-only, 300ms, --ease-drawer curve; skipped entirely for
// reduced-motion / no-WAAPI browsers).
const flyLogoToHeader = (fromRect) => {
    const logo = dom.headerLogo;
    if (!logo || !fromRect?.width) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof logo.animate !== 'function') return;
    const to = logo.getBoundingClientRect();
    if (!to.width) return;
    const dx = (fromRect.left + fromRect.width / 2) - (to.left + to.width / 2);
    const dy = (fromRect.top + fromRect.height / 2) - (to.top + to.height / 2);
    const scale = fromRect.width / to.width;
    logo.animate(
        [
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
            { transform: 'none' }
        ],
        { duration: 300, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }
    );
};

const renderEmptyState = () => {
    setEmptyMode(true);
    dom.chatHistory.innerHTML = ''; // nothing to scroll — the landing lives in the dock
    // v1.0.6: the greeting renders ABOVE the composer inside the dock, so the
    // whole new-chat block (greeting · composer · suggestions) centres as one
    // unit instead of the old full-height block fighting the fixed dock.
    if (!dom.emptyWelcome) return;
    dom.emptyWelcome.innerHTML = `
        <div class="relative flex flex-col items-center justify-center text-center">
            <div class="empty-glow" aria-hidden="true"></div>
            <img id="emptyLogo" src="/logo.png" alt="" aria-hidden="true" class="logo-mark h-12 w-12 rounded-xl mb-4 select-none shadow-soft" draggable="false">
            <h2 class="font-display text-2xl md:text-3xl leading-tight text-ink mb-2 tracking-tight">How can I help today?</h2>
            <p class="text-muted text-sm max-w-sm">Pick a suggestion below or type your own prompt.</p>
        </div>`;
};

export const renderActiveChat = () => {
    if (!state.activeChatId || !state.chats[state.activeChatId]) {
        renderEmptyState();
        if (dom.headerChatTitle) dom.headerChatTitle.textContent = 'ABot';
        dom.modelSelectorLabel.textContent = 'Select Model';
        return;
    }
    const chat = state.chats[state.activeChatId];
    // 2.0.30: migrate stale model ids — a saved chat holding an id that is no
    // longer in the catalog (e.g. the pre-2.0.30 bare NVIDIA ids like
    // 'z-ai/glm-5.3', re-keyed under the 'nvidia/' routing prefix) would keep
    // sending a dead id to the wrong provider on every message.
    if (!MODEL_CONFIG[chat.model]) {
        chat.model = Object.keys(MODEL_CONFIG)[0];
        const cu = state.auth.currentUser;
        if (cu && state.db) {
            state.db.collection('users').doc(cu.uid).collection('chats').doc(state.activeChatId)
                .update({ model: chat.model })
                .catch((err) => console.error('Failed to migrate stale model in DB', err));
        }
    }
    dom.chatHistory.innerHTML = '';
    if (chat.messages && chat.messages.length === 1 && isEmptyChat(chat)) {
        chat.messages = [];
    }
    if (!chat.messages || chat.messages.length === 0) {
        renderEmptyState();
    } else {
        setEmptyMode(false);
        chat.messages.forEach((msg, index) => appendMessage(msg, true, { index }));
    }
    // Update header elements
    if (dom.headerChatTitle) dom.headerChatTitle.textContent = chat.name;
    dom.modelSelectorLabel.textContent = MODEL_CONFIG[chat.model]?.name || 'Select Model';
    applyModelColorTheme(chat.model);
    syncComposerChips();
    // v2.0.18: re-renders (chat switch, model switch, reaction toggles) land
    // the view wherever the old scroll was — pin to the newest content when
    // the user is in follow mode so replies never sit behind the composer.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => window.__abotFollowBottom?.()); else window.__abotFollowBottom?.();
};

// E2 (owner-approved): drop the trailing assistant reply, keep the last user
// prompt, and send it again. Costs one extra AI call per use.
export const regenerateLastResponse = () => {
    const chat = state.chats[state.activeChatId];
    if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) return;
    while (chat.messages.length && chat.messages[chat.messages.length - 1].role === 'assistant') chat.messages.pop();
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== 'user') return;
    const text = last.content;
    chat.messages.pop(); // sendMessage re-appends it fresh
    renderActiveChat();
    dom.messageInput.value = text;
    sendMessage();
};
