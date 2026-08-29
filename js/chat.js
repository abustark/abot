/**
 * ABot Chat Module
 * Handles chat operations, message sending, and Firestore integration
 * 
 * NOTE: This is a reference module. The app still uses inline JS.
 */

import { MODEL_CONFIG, DEFAULT_SYSTEM_PROMPT, generateColorClasses } from './config.js';
import { escapeHtml, sanitizeHtml, getTimestamp } from './utils.js';

export async function loadUserChatsFromFirestore(db, userId) {
    const chatsRef = db.collection('users').doc(userId).collection('chats');
    try {
        const snapshot = await chatsRef.orderBy('id', 'desc').get();
        if (snapshot.empty) return null;

        const chats = {};
        snapshot.forEach(doc => { chats[doc.id] = doc.data(); });
        return chats;
    } catch (error) {
        console.error("Error loading chats:", error);
        return null;
    }
}

export async function createNewChat(db, userId) {
    const newChatId = String(Date.now());
    const newChatData = {
        id: newChatId,
        name: "New Chat",
        model: Object.keys(MODEL_CONFIG)[0],
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        messages: [{ role: "assistant", content: "Hello! How can I assist you today?", model: Object.keys(MODEL_CONFIG)[0] }]
    };
    await db.collection('users').doc(userId).collection('chats').doc(newChatId).set(newChatData);
    return newChatData;
}

export async function saveChat(db, userId, chatId, chatData) {
    await db.collection('users').doc(userId).collection('chats').doc(chatId).set(chatData);
}

export async function deleteChatFromFirestore(db, userId, chatId) {
    await db.collection('users').doc(userId).collection('chats').doc(chatId).delete();
}

export function exportChat(chatData) {
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chatData.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function appendMessage({ message, dom, chats, activeChatId, isHistory = false }) {
    const { role, content, model: messageModel } = message;
    const isUser = role === 'user';
    const currentChat = chats[activeChatId];
    if (!currentChat) return;

    const modelConf = MODEL_CONFIG[messageModel || currentChat.model] || { name: 'AI', color: 'indigo-600' };
    const colorClasses = generateColorClasses(modelConf.color);

    const bubbleClasses = isUser
        ? `user-bubble ${colorClasses.userBubbleBg}`
        : `bot-bubble bg-white dark:bg-gray-700`;

    const messageEl = document.createElement('div');
    if (!isHistory) messageEl.className = 'message-enter';

    let messageContent = isUser
        ? escapeHtml(content)
        : (isHistory ? sanitizeHtml(marked.parse(content)) : '<div class="typing-indicator"><span></span><span></span><span></span></div>');

    const justifyClass = isUser ? 'justify-end' : 'justify-start';
    messageEl.innerHTML = `<div class="message-container flex items-end gap-x-2 ${justifyClass}"><div class="${bubbleClasses} chat-bubble p-4 text-sm"><div class="prose dark:prose-invert max-w-none">${messageContent}</div><div class="text-xs text-gray-400 mt-2 text-right">${getTimestamp()}</div></div></div>`;

    dom.chatHistory.appendChild(messageEl);
    dom.chatHistoryContainer.scrollTop = dom.chatHistoryContainer.scrollHeight;
    return messageEl;
}
