/**
 * ABot — chat.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { GUEST_MESSAGE_LIMIT } from './config.js';
import { MODEL_CONFIG } from './config.js';
import { applyModelColorTheme } from './ui.js';
import { closeSidebar } from './ui.js';
import { dom } from './dom.js';
import { generateColorClasses } from './config.js';
import { getTimestamp } from './utils.js';
import { showGuestLimitModal } from './ui.js';
import { showToast } from './utils.js';
import { state } from './state.js';
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
                        dom.chatList.innerHTML = `<div class="p-4 text-sm text-red-500">Could not load chats.</div>`;
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
                    dom.deleteModalBody.innerHTML = `Are you sure you want to delete the chat: "<strong class="font-medium text-gray-800 dark:text-gray-100">${chat.name}</strong>"? This action cannot be undone.`;

    // 2. Configure Button
    const confirmBtn = dom.deleteConfirmBtn;
    confirmBtn.textContent = "Delete";
    confirmBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
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
                        chatItemContainer.innerHTML = `<div class="flex items-center justify-between w-full rounded-md ${String(chat.id) === String(state.activeChatId) ? '' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'}"><a href="#" class="flex-1 px-4 py-2 text-sm truncate" data-chat-id="${chat.id}"><span class="chat-name-span">${chat.name}</span></a><input type="text" class="chat-rename-input hidden flex-1 mx-2 p-1 text-sm bg-gray-200 dark:bg-gray-700 rounded" value="${chat.name}"><button class="chat-options-btn p-1 mr-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"><svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg></button></div><div class="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md shadow-lg z-10 hidden chat-options-menu"><button class="rename-chat-btn w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Rename</button><button class="export-chat-btn w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Export</button><button class="delete-chat-btn w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">Delete</button></div>`;
        const nameSpan = chatItemContainer.querySelector('.chat-name-span');
        const renameInput = chatItemContainer.querySelector('.chat-rename-input');
        const saveRename = () => { renameChat(chat.id, renameInput.value); };
        renameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { saveRename(); renameInput.blur(); } else if (e.key === 'Escape') { renameInput.blur(); } });
        renameInput.addEventListener('blur', () => { nameSpan.classList.remove('hidden'); renameInput.classList.add('hidden'); renderChatList(dom.searchChats.value); });
        chatItemContainer.querySelector('a').addEventListener('click', e => { e.preventDefault(); switchChat(chat.id); });
        chatItemContainer.querySelector('.chat-options-btn').addEventListener('click', e => { e.stopPropagation(); const menu = chatItemContainer.querySelector('.chat-options-menu'); document.querySelectorAll('.chat-options-menu').forEach(m => m !== menu && m.classList.add('hidden')); menu.classList.toggle('hidden'); });
        chatItemContainer.querySelector('.rename-chat-btn').addEventListener('click', e => { e.stopPropagation(); nameSpan.classList.add('hidden'); renameInput.classList.remove('hidden'); renameInput.focus(); renameInput.select(); chatItemContainer.querySelector('.chat-options-menu').classList.add('hidden'); });
        chatItemContainer.querySelector('.export-chat-btn').addEventListener('click', e => { e.stopPropagation(); exportChat(chat.id); chatItemContainer.querySelector('.chat-options-menu').classList.add('hidden'); });
        chatItemContainer.querySelector('.delete-chat-btn').addEventListener('click', e => { e.stopPropagation(); deleteChat(chat.id); });
        dom.chatList.appendChild(chatItemContainer);
    });
};

export function initMessageActions() {
// --- Message Action Helpers ---
window.deleteMessage = (chatId, msgIndex) => {
    const chat = state.chats[chatId];
    if (!chat || !chat.messages[msgIndex]) return;

    // Simple confirm (reusing modal structure manually or just cloning button logic)
    dom.deleteModal.querySelector('#modal-title').textContent = "Delete Message";
    dom.deleteModalBody.textContent = "Are you sure you want to delete this message? This cannot be undone.";

    const confirmBtn = dom.deleteConfirmBtn;
    confirmBtn.textContent = "Delete";
    confirmBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    confirmBtn.classList.add('bg-red-600', 'hover:bg-red-700');

    // Clone and replace to handle click
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    dom.deleteConfirmBtn = newBtn;

    newBtn.addEventListener('click', async () => {
        try {
            chat.messages.splice(msgIndex, 1);
            await state.db.collection('users').doc(state.auth.currentUser.uid).collection('chats').doc(chatId).update({ messages: chat.messages });
            // Determine if we need to update active view
            if (state.activeChatId === chatId) renderActiveChat();

            // Close modal
            dom.deletePanel.style.opacity = '0';
            dom.deletePanel.style.transform = 'scale(0.95)';
            setTimeout(() => dom.deleteModal.classList.add('hidden'), 200);
            showToast("Message deleted.");
        } catch (e) {
            console.error(e);
            showToast("Failed to delete message", "error");
        }
    }, { once: true });

    dom.deleteModal.classList.remove('hidden');
    setTimeout(() => {
        dom.deletePanel.style.opacity = '1';
        dom.deletePanel.style.transform = 'scale(1)';
    }, 10);
};

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
    state.activeChatId = String(chatId);
    renderActiveChat();
    renderChatList(dom.searchChats.value);
    closeSidebar();
};

export const createNewChat = async () => {
    const currentUser = state.auth.currentUser;
    if (!currentUser) {
        console.error("Cannot create new chat: No user is signed in.");
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
            messages: [{ role: "assistant", content: "Hello! How can I assist you today?", model: Object.keys(MODEL_CONFIG)[0] }]
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

export const appendMessage = (message, isHistory = false, options = {}) => {
    const { role, content: text, model: messageModel } = message;
    const isUser = role === 'user';
    const currentChat = state.chats[state.activeChatId];
    if (!currentChat) return;

    // CORE LOGIC: Use the message's own model, or fall back to the chat's current model.
    const modelConf = MODEL_CONFIG[messageModel || currentChat.model] || { name: 'AI', color: 'indigo-600' };
    const colorClasses = generateColorClasses(modelConf.color);

    let messageContent;
    if (isUser) {
        messageContent = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
                        const uniqueId = `bot-msg-${Date.now()}`;
        if (isHistory) {
                            messageContent = `<span id="${uniqueId}">${marked.parse(text)}</span>`;
        } else {
            let indicatorHtml = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
            if (options.isGoogle) {
                                indicatorHtml += `<p class="fade-in-polite text-xs text-gray-500 dark:text-gray-400 mt-2 italic">Please wait, fetching the full response from Gemini...</p>`;
            }
                            messageContent = `<span id="${uniqueId}">${indicatorHtml}</span>`;
        }
    }

    // --- Action Buttons ---
                    const copyBtnHtml = `<button class="copy-message-btn p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Copy"><svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg></button>`;

    let actionButtonsHtml = '';
    if (typeof options.index === 'number') {
        actionButtonsHtml = `
                            ${isUser ? `<button class="edit-msg-btn p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Edit"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>` : ''}
                            <button class="delete-msg-btn p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.958L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                         `;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'w-full'; // Wrapper
    if (!isHistory) messageEl.classList.add('message-enter');

    if (isUser) {
        // --- USER MESSAGE LAYOUT (Clean Bubble, Right Aligned) ---
        messageEl.innerHTML = `
                            <div class="message-container w-full flex justify-end mb-6 group relative pl-10">
                                <div class="absolute right-full mr-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 px-1">
                                    ${copyBtnHtml}
                                    ${actionButtonsHtml}
                                </div>
                                <div class="max-w-[90%] md:max-w-[80%] bg-gray-100 dark:bg-gray-800 rounded-[24px] rounded-tr-sm px-5 py-3 text-[15px] text-gray-900 dark:text-gray-100 shadow-sm">
                                   <div class="prose dark:prose-invert max-w-none whitespace-pre-wrap">${messageContent}</div>
                                </div>
                            </div>
                        `;
    } else {
        // --- AI MESSAGE LAYOUT (Full Width, Header, No Background) ---
        // Note: Using colorClasses.text matches the theme color
        messageEl.innerHTML = `
                            <div class="message-container w-full flex flex-col mb-10 group">
                                <div class="flex items-center gap-3 mb-2 select-none">
                                    <div class="w-7 h-7 rounded-sm ${colorClasses.bg} flex items-center justify-center flex-shrink-0 shadow-sm">
                                         <span class="text-white text-[10px] font-bold">${modelConf.name.substring(0, 2)}</span>
                                    </div>
                                    <span class="text-xs font-bold uppercase tracking-wider ${colorClasses.text}">${modelConf.name}</span>
                                    <span class="text-xs text-gray-400 dark:text-gray-500">${getTimestamp()}</span>
                                </div>
                                <div class="pl-0 md:pl-10 w-full overflow-hidden">
                                    <div class="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-[15px] leading-7">
                                        ${messageContent}
                                    </div>
                                    <div class="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                         ${copyBtnHtml}
                                         ${actionButtonsHtml}
                                    </div>
                                </div>
                            </div>
                        `;
    }

    // Attach Event Listeners
    if (typeof options.index === 'number') {
        messageEl.querySelector('.delete-msg-btn')?.addEventListener('click', (e) => { e.stopPropagation(); window.deleteMessage(state.activeChatId, options.index); });
        messageEl.querySelector('.edit-msg-btn')?.addEventListener('click', (e) => { e.stopPropagation(); window.editMessage(state.activeChatId, options.index); });
    }

    const copyBtn = messageEl.querySelector('.copy-message-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', (event) => {
            const proseContent = messageEl.querySelector('.prose'); // Simpler selection
            const textToCopy = proseContent ? proseContent.textContent : '';
            navigator.clipboard.writeText(textToCopy).then(() => showToast("Copied!")).catch(() => showToast("Failed to copy", "error"));
        });
    }

    dom.chatHistory.appendChild(messageEl);

    // Syntax Highlighting for AI messages
    if (!isUser) {
        messageEl.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
            // Add Copy Code button (simplified logic)
            const pre = block.parentElement;
            const copyCodeBtn = document.createElement('button');
            copyCodeBtn.className = 'copy-code-btn absolute top-2 right-2 bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity';
            copyCodeBtn.textContent = 'Copy Code';
            pre.classList.add('group'); // Enable hover
            copyCodeBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent);
                copyCodeBtn.textContent = 'Copied!';
                setTimeout(() => copyCodeBtn.textContent = 'Copy Code', 2000);
            });
            pre.appendChild(copyCodeBtn);
        });
    }
};

/* NEW Code to Add (This replaces the old start of the function) */
export const sendMessage = async () => {
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

    state.abortController = new AbortController(); // Create a new controller for this request

    // Create the user message object, now including the current model.
    const userMessage = { role: 'user', content: message, model: currentChat.model };
    appendMessage(userMessage, false, { index: currentChat.messages.length });
    currentChat.messages.push(userMessage);

    // Save the user's message to Firestore immediately to prevent data loss on refresh.
    try {
        const chatDocRef = state.db.collection('users').doc(activeUser.uid).collection('chats').doc(state.activeChatId);
        await chatDocRef.update({ messages: currentChat.messages });
    } catch (dbError) {
        console.error("Error saving user message to Firestore:", dbError);
        showToast("Error: Could not save your message.", "error");
        // We can choose to stop here if saving is critical
        return;
    }

    if (state.auth.currentUser && state.auth.currentUser.isAnonymous) {
        state.guestSessionMessageCount++;
    }

    // Check if this is the first user message in a new chat to trigger intelligent naming
    const isFirstUserMessage = currentChat.name === "New Chat" && currentChat.messages.filter(m => m.role === 'user').length === 1;

    if (isFirstUserMessage) {
        dom.chatTitle.textContent = "Generating Title.";
        let dotCount = 1;
        // Start the animation and store its ID
        state.titleAnimationInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1; // Cycle dotCount between 1, 2, 3
            if (dom.chatTitle.textContent.startsWith("Generating")) { // Only animate if not already renamed
                dom.chatTitle.textContent = "Generating Title" + ".".repeat(dotCount);
            }
        }, 500); // Update the text every half-second
    }

    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    dom.messageInput.focus();

    dom.sendBtn.classList.add('hidden');
    dom.stopBtn.classList.remove('hidden');

    dom.modelSelectorBtn.disabled = true;
    dom.modelSelectorBtn.classList.add('opacity-50', 'cursor-not-allowed');

    const isGoogleModel = currentChat.model.startsWith('google/');
    // Append the placeholder message with the current model's info
    appendMessage({ role: 'assistant', content: '', model: currentChat.model }, false, { isGoogle: isGoogleModel });

    const allBotSpans = dom.chatHistory.querySelectorAll('span[id^="bot-msg-"]');
    const latestBotMessageSpan = allBotSpans[allBotSpans.length - 1];

    if (!latestBotMessageSpan) {
        dom.sendBtn.classList.remove('hidden');
        dom.stopBtn.classList.add('hidden');
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
            body: JSON.stringify({ model: currentChat.model, messages: cleanedMessages }),
            signal: state.abortController.signal
        });

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
                    const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
                    if (dataLine) {
                        const jsonStr = dataLine.substring(6);
                        try {
                            const errorPayload = JSON.parse(jsonStr);
                            // Phase 2 security fix: build error display with DOM APIs
                            // (innerHTML here was an XSS sink for upstream text)
                            const strongEl = document.createElement('strong');
                            let errorText;
                            if (errorPayload.message && errorPayload.message.includes("429")) {
                                strongEl.textContent = "Rate Limit Exceeded:";
                                errorText = " The AI provider is busy. Please wait a moment and try again.";
                            } else {
                                strongEl.textContent = "Server Error:";
                                errorText = " " + (errorPayload.message || "An unknown error occurred.");
                            }
                            latestBotMessageSpan.textContent = "";
                            latestBotMessageSpan.appendChild(strongEl);
                            latestBotMessageSpan.appendChild(document.createTextNode(errorText));
                                        } catch { latestBotMessageSpan.innerHTML = `<strong>An unreadable error occurred.</strong>`; }
                    }
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
                                                latestBotMessageSpan.innerHTML = `<span class="content-span">${marked.parse(fullReply)}</span><span class="blinking-cursor"></span>`;
                                isFirstChunk = false;
                            } else {
                                const contentHolder = latestBotMessageSpan.querySelector('.content-span');
                                if (contentHolder) {
                                    contentHolder.innerHTML = marked.parse(fullReply);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Could not parse JSON chunk:", jsonStr);
                    }
                }
            }
            dom.chatHistoryContainer.scrollTop = dom.chatHistoryContainer.scrollHeight;
        }

        const contentHolder = latestBotMessageSpan.querySelector('.content-span');
        const cursor = latestBotMessageSpan.querySelector('.blinking-cursor');
        if (contentHolder) contentHolder.innerHTML = marked.parse(fullReply);
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
            hljs.highlightElement(block);
        });

        currentChat.messages.push({ role: 'assistant', content: fullReply, model: currentChat.model });


    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Chat generation aborted. Saving partial response.");
            const finalContent = fullReply || "";
            const stoppedMessage = finalContent + '\n\n*-- Generation stopped --*';
            currentChat.messages.push({ role: 'assistant', content: stoppedMessage, model: currentChat.model });
        } else {
            console.error("sendMessage stream error:", error);
            latestBotMessageSpan.innerHTML = "<strong>Error:</strong> Could not get response from the server.";
        }
    }
    finally {
        // --- THIS IS THE FINAL, CORRECT VERSION ---

        // 1. Save the final state of the chat to Firestore.
        try {
            const chatDocRef = state.db.collection('users').doc(activeUser.uid).collection('chats').doc(state.activeChatId);
            await chatDocRef.update({
                messages: currentChat.messages,
                name: currentChat.name
            });
        } catch (dbError) {
            console.error("Error saving final chat state to Firestore:", dbError);
        }

        // 2. Reset the UI buttons.
        dom.sendBtn.classList.remove('hidden');
        dom.stopBtn.classList.add('hidden');
        state.abortController = null;
        dom.modelSelectorBtn.disabled = false;
        dom.modelSelectorBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        // 3. Generate the title if it was the first message.
        if (isFirstUserMessage) {
            try {
                                const conversationForTitle = currentChat.messages.slice(1, 3).map(m => `${m.role}: ${m.content}`).join('\n');
                                const titlePrompt = `Based on this conversation, create a concise, 5-word-or-less title. Do not use quotation marks.\n\n---\n${conversationForTitle}`;
                const idToken = await activeUser.getIdToken(true);
                const response = await fetch('/api/chat', {
                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: titlePrompt }] })
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

export const renderActiveChat = () => {
    if (!state.activeChatId || !state.chats[state.activeChatId]) {
        dom.chatHistory.innerHTML = '<div class="text-center text-gray-500 mt-10">Select a chat or start a new one.</div>';
        dom.chatTitle.textContent = "No Chat Selected";
        return;
    }
    const chat = state.chats[state.activeChatId];
    dom.chatHistory.innerHTML = '';
    chat.messages.forEach((msg, index) => appendMessage(msg, true, { index }));
    // Update header elements
    dom.chatTitle.textContent = chat.name;
    dom.chatTitleInput.value = chat.name;
    dom.modelSelectorLabel.textContent = MODEL_CONFIG[chat.model]?.name || 'Select Model';
    dom.modelIndicatorPill.textContent = MODEL_CONFIG[chat.model]?.name || 'Select Model';
    applyModelColorTheme(MODEL_CONFIG[chat.model]?.color || 'indigo-600');
};
