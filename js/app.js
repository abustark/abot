/**
 * ABot Main Application Entry Point
 * Orchestrates all modules and initializes the application
 * 
 * NOTE: This is a reference module. The app still uses inline JS in index.html.
 * To use this module, replace the inline script with:
 *   <script type="module" src="/js/app.js"></script>
 */

import { MODEL_CONFIG, DEFAULT_SYSTEM_PROMPT, GUEST_MESSAGE_LIMIT, fetchFirebaseConfig, generateColorClasses } from './config.js';
import { escapeHtml, sanitizeHtml, getTimestamp, showToast, initVoiceRecognition } from './utils.js';
import { initThemeToggle, closeSidebar, toggleSidebar, showModal, hideModal, applyModelColorTheme } from './ui.js';
import { showLoginView, showSignupView, showForgotPasswordView, signInAsGuest, signOut, loginWithEmail, signupWithEmail } from './auth.js';
import { loadUserChatsFromFirestore, createNewChat, saveChat, deleteChatFromFirestore, exportChat, appendMessage } from './chat.js';

// DOM element cache
const dom = {
    // Auth elements
    authSection: document.getElementById('auth-section'),
    appContainer: document.getElementById('app-container'),
    appLoader: document.getElementById('app-loader'),
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    loginView: document.getElementById('login-view'),
    signupView: document.getElementById('signup-view'),
    forgotPasswordView: document.getElementById('forgot-password-view'),
    errorMessage: document.getElementById('error-message'),

    // Chat elements
    chatHistory: document.getElementById('chatHistory'),
    chatHistoryContainer: document.getElementById('chatHistoryContainer'),
    chatTitle: document.getElementById('chatTitle'),
    chatList: document.getElementById('chatList'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    newChatBtn: document.getElementById('newChatBtn'),

    // UI elements
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    themeToggle: document.getElementById('themeToggle'),
    sunIcon: document.getElementById('sunIcon'),
    moonIcon: document.getElementById('moonIcon'),

    // Model selector
    modelSelectorBtn: document.getElementById('modelSelectorBtn'),
    modelSelectorPanel: document.getElementById('modelSelectorPanel'),
    modelSelectorLabel: document.getElementById('modelSelectorLabel'),
    modelSelectorDot: document.getElementById('modelSelectorDot'),

    // Toast
    toastNotification: document.getElementById('toast-notification'),
    toastIcon: document.getElementById('toast-icon'),
    toastMessage: document.getElementById('toast-message'),

    // Voice
    voiceBtn: document.getElementById('voiceBtn')
};

// Application state
let currentUser = null;
let chats = {};
let activeChatId = null;
let selectedModel = Object.keys(MODEL_CONFIG)[0];
let db = null;
let auth = null;

async function main() {
    console.log('[App] Initializing...');

    // Fetch Firebase config and initialize
    const firebaseConfig = await fetchFirebaseConfig();
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    // Initialize UI
    initThemeToggle(dom);

    // Initialize voice recognition
    const recognition = initVoiceRecognition(dom, (transcript) => {
        dom.messageInput.value = transcript;
    });

    // Auth state listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            dom.authSection.style.display = 'none';
            dom.appContainer.style.display = 'flex';

            // Load user's chats
            const loadedChats = await loadUserChatsFromFirestore(db, user.uid);
            if (loadedChats) {
                chats = loadedChats;
            } else {
                // Create first chat for new users
                const newChat = await createNewChat(db, user.uid);
                chats[newChat.id] = newChat;
                activeChatId = newChat.id;
            }

            renderChatList();
            applyModelColorTheme(dom, MODEL_CONFIG[selectedModel]?.color);
        } else {
            currentUser = null;
            dom.authSection.style.display = 'flex';
            dom.appContainer.style.display = 'none';
        }

        // Hide loader
        dom.appLoader.style.opacity = '0';
        setTimeout(() => {
            dom.appLoader.style.display = 'none';
        }, 300);
    });

    // Event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Auth form handlers
    dom.loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await loginWithEmail(auth, email, password, dom);
    });

    dom.signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        await signupWithEmail(auth, email, password, dom);
    });

    // Sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', () => toggleSidebar(dom));
    dom.sidebarOverlay?.addEventListener('click', () => closeSidebar(dom));

    // New chat
    dom.newChatBtn?.addEventListener('click', async () => {
        const newChat = await createNewChat(db, currentUser.uid);
        chats[newChat.id] = newChat;
        activeChatId = newChat.id;
        renderChatList();
        loadChat(activeChatId);
    });

    // Send message
    dom.sendBtn?.addEventListener('click', sendMessage);
    dom.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function renderChatList() {
    if (!dom.chatList) return;
    dom.chatList.innerHTML = '';

    Object.values(chats)
        .sort((a, b) => b.id - a.id)
        .forEach(chat => {
            const chatEl = document.createElement('div');
            chatEl.className = `chat-list-item p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${chat.id === activeChatId ? 'active' : ''}`;
            chatEl.textContent = chat.name;
            chatEl.addEventListener('click', () => loadChat(chat.id));
            dom.chatList.appendChild(chatEl);
        });
}

function loadChat(chatId) {
    activeChatId = chatId;
    const chat = chats[chatId];
    if (!chat) return;

    dom.chatTitle.textContent = chat.name;
    dom.chatHistory.innerHTML = '';

    chat.messages.forEach(msg => {
        appendMessage({ message: msg, dom, chats, activeChatId, isHistory: true });
    });

    renderChatList();
    closeSidebar(dom);
}

async function sendMessage() {
    const content = dom.messageInput?.value.trim();
    if (!content || !activeChatId) return;

    dom.messageInput.value = '';

    // Add user message
    const userMessage = { role: 'user', content, timestamp: getTimestamp() };
    chats[activeChatId].messages.push(userMessage);
    appendMessage({ message: userMessage, dom, chats, activeChatId });

    // TODO: Call API and stream response
    // This is simplified - the full implementation is in index.html

    await saveChat(db, currentUser.uid, activeChatId, chats[activeChatId]);
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', main);
