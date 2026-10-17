/**
 * ABot — dom.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */
export const dom = {
    authSection: document.getElementById('auth-section'),
    appContainer: document.getElementById('app-container'),
    loginView: document.getElementById('login-view'),
    signupView: document.getElementById('signup-view'),
    forgotPasswordView: document.getElementById('forgot-password-view'),
    verifyEmailView: document.getElementById('verify-email-view'),
    verifyEmailAddress: document.getElementById('verify-email-address'),
    checkVerificationBtn: document.getElementById('check-verification-btn'),
    resendVerificationBtn: document.getElementById('resend-verification-btn'),
    verifyBackToLogin: document.getElementById('verify-back-to-login'),
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    forgotPasswordForm: document.getElementById('forgot-password-form'),
    showSignup: document.getElementById('show-signup'),
    showLogin: document.getElementById('show-login'),
    showForgotPassword: document.getElementById('show-forgot-password'),
    backToLogin: document.getElementById('back-to-login'),
    guestSigninBtn: document.getElementById('guest-signin-btn'),
    signoutBtn: document.getElementById('signoutBtn'),
    errorMessage: document.getElementById('error-message'),
    userAvatar: document.getElementById('userAvatar'),
    userEmailDisplay: document.getElementById('userEmailDisplay'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    stopBtn: document.getElementById('stopBtn'),
    chatHistoryContainer: document.getElementById('chatHistoryContainer'),
    chatHistory: document.getElementById('chatHistory'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    newChatSpinner: document.getElementById('new-chat-spinner'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatList: document.getElementById('chatList'),
    modelSelectorBtn: document.getElementById('modelSelectorBtn'),
    modelSelectorLabel: document.getElementById('modelSelectorLabel'),
    modelSelectorPanel: document.getElementById('modelSelectorPanel'),
    headerChatTitle: document.getElementById('headerChatTitle'),
    promptModal: document.getElementById('promptModal'),
    promptOverlay: document.getElementById('promptOverlay'),
    promptPanel: document.getElementById('promptPanel'),
    promptTextarea: document.getElementById('promptTextarea'),
    promptSaveBtn: document.getElementById('promptSaveBtn'),
    promptCancelBtn: document.getElementById('promptCancelBtn'),
    searchChats: document.getElementById('searchChats'),
    importChatBtn: document.getElementById('importChatBtn'),
    importFileInput: document.getElementById('importFileInput'),
    deleteModal: document.getElementById('deleteModal'),
    deleteOverlay: document.getElementById('deleteOverlay'),
    deletePanel: document.getElementById('deletePanel'),
    deleteModalBody: document.getElementById('deleteModalBody'),
    deleteCancelBtn: document.getElementById('deleteCancelBtn'),
    deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),
    guestLimitModal: document.getElementById('guestLimitModal'),
    guestLimitOverlay: document.getElementById('guestLimitOverlay'),
    guestLimitPanel: document.getElementById('guestLimitPanel'),
    guestGoogleLinkBtn: document.getElementById('guestGoogleLinkBtn'),
    guestLimitCancelBtn: document.getElementById('guestLimitCancelBtn'),
    appHeader: document.getElementById('appHeader'),
    composerDock: document.getElementById('composerDock'),
    toastStack: document.getElementById('toast-stack'),
    appLoader: document.getElementById('app-loader'),
};

// --- Phase 3 additions (search + settings) ---
dom.commandPalette = document.getElementById('commandPalette');
dom.commandPaletteOverlay = document.getElementById('commandPaletteOverlay');
dom.commandPalettePanel = document.getElementById('commandPalettePanel');
dom.commandPaletteInput = document.getElementById('commandPaletteInput');
dom.commandPaletteList = document.getElementById('commandPaletteList');
dom.searchPanel = document.getElementById('searchPanel');
dom.messageSearchInput = document.getElementById('messageSearchInput');
dom.searchResults = document.getElementById('searchResults');
// v1.0.7: the settings panel became the account menu behind the profile row.
dom.profileMenuBtn = document.getElementById('profileMenuBtn');
dom.profileMenu = document.getElementById('profileMenu');
dom.timestampsToggle = document.getElementById('timestampsToggle');
dom.ttsToggle = document.getElementById('ttsToggle');
dom.webSearchChip = document.getElementById('webSearchChip');
dom.thinkingChip = document.getElementById('thinkingChip');
dom.jumpToLatest = document.getElementById('jumpToLatest');
dom.sidebarThemeSwitch = document.getElementById('sidebarThemeSwitch');
dom.sidebarSearchBtn = document.getElementById('sidebarSearchBtn');
dom.sidebarPromptBtn = document.getElementById('sidebarPromptBtn');
dom.composerHint = document.getElementById('composerHint');
dom.searchCloseBtn = document.getElementById('searchCloseBtn');
// v1.0.6 new-chat landing (empty state centres the composer).
dom.emptyWelcome = document.getElementById('emptyWelcome');
dom.emptySuggestions = document.getElementById('emptySuggestions');

export function initDomExtras() {
dom.promptLibrary = document.getElementById('promptLibrary');

// 4. Attach the listener for YOUR custom Google button.
dom.googleSigninBtn = document.getElementById('google-signin-btn');
}
