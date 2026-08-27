/**
 * ABot — auth.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { closeGuestLimitModal } from './ui.js';
import { createNewChat } from './chat.js';
import { dom } from './dom.js';
import { loadUserChatsFromFirestore } from './chat.js';
import { showToast } from './utils.js';
import { state } from './state.js';
import { switchChat } from './chat.js';
export function initFirebase() {
const firebaseConfig = {
    apiKey: "AIzaSyBXgaTb9XFlDS491i765UFBe325Qg4z0QE",
    authDomain: "abot-cloud.firebaseapp.com",
    projectId: "abot-cloud",
    storageBucket: "abot-cloud.firebasestorage.app",
    messagingSenderId: "784623545561",
    appId: "1:784623545561:web:74a3ba27805e005d7ca2c8",
    measurementId: "G-DR76L8Y697"
};

firebase.initializeApp(firebaseConfig);

state.auth = firebase.auth();

state.db = firebase.firestore();
}

// For the chat title loading animation

// =================================================================================
// AUTHENTICATION FUNCTIONS
// =================================================================================


export const showLoginView = () => {
    dom.loginView.style.display = 'block';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'none';
    dom.errorMessage.textContent = '';
};

export const showSignupView = () => {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'block';
    dom.forgotPasswordView.style.display = 'none';
    dom.errorMessage.textContent = '';
};

export const showForgotPasswordView = () => {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'block';
    dom.errorMessage.textContent = '';
};

export const handleAuthError = (error) => {
    console.error("Authentication Error:", error.code);
    let message = "An unexpected error occurred. Please try again.";
    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            message = "Invalid email or password. Please check your credentials and try again.";
            break;
        case 'auth/email-already-in-use':
            message = "An account with this email address already exists.";
            break;
        case 'auth/weak-password':
            message = "Your password is too weak. It must be at least 6 characters long.";
            break;
        case 'auth/popup-closed-by-user':
            message = "The sign-in window was closed. Please try again.";
            break;
    }
    dom.errorMessage.textContent = message;
};

export const signInAsGuest = () => {
    dom.errorMessage.textContent = '';
    state.auth.signInAnonymously()
        .catch((error) => {
            console.error("Anonymous sign-in error:", error);
                            dom.errorMessage.textContent = `Could not start a guest session: ${error.message}`;
        });
};

export const signOutUser = () => {
    state.isAppInitialized = false; // Reset the app state
    state.auth.signOut().catch((error) => console.error('Sign out error', error));
};

export const linkGuestToGoogle = () => {
    const provider = new firebase.state.auth.GoogleAuthProvider();
    const currentUser = state.auth.currentUser;
    if (!currentUser || !currentUser.isAnonymous) return;

    currentUser.linkWithPopup(provider)
        .then((result) => {
            console.log("Anonymous account successfully linked!", result.user);
            closeGuestLimitModal();
            showToast("Account created! Your chat is saved.");
            // The onAuthStateChanged listener will automatically refresh the user's info.
        }).catch((error) => {
            // This error occurs if the user's Google account is already in use.
            if (error.code === 'auth/credential-already-in-use') {
                showToast("This Google account is already linked to another user.", "error");
            } else {
                handleAuthError(error); // Use our existing error handler
            }
        });
};

// --- ATTACH EVENT LISTENERS FOR AUTH FORMS ---

// This is the definitive, reliable implementation using the traditional pop-up window.

// 1. Define the callback function that Firebase will use after a successful sign-in.
export async function handleCredentialResponse(response) {
    try {
        // This creates a Firebase credential from the token the pop-up provides.
        const credential = firebase.state.auth.GoogleAuthProvider.credential(null, response.access_token);
        await state.auth.signInWithCredential(credential);
    } catch (error) {
        console.error("Google credential sign-in error:", error);
        handleAuthError(error);
    }
}

export function initAuth() {
if (window.google && google.accounts && google.accounts.id) {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: "784623545561-f9qumqjcsek7g368657cloq8rqc0kurj.apps.googleusercontent.com",
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: handleCredentialResponse,
    });
}

// 3. Attach standard listeners.
dom.showSignup.addEventListener('click', (e) => { e.preventDefault(); showSignupView(); });

dom.showLogin.addEventListener('click', (e) => { e.preventDefault(); showLoginView(); });

dom.showForgotPassword.addEventListener('click', (e) => { e.preventDefault(); showForgotPasswordView(); });

dom.backToLogin.addEventListener('click', (e) => { e.preventDefault(); showLoginView(); });

if (dom.googleSigninBtn) {
    dom.googleSigninBtn.addEventListener('click', () => {

        // This command will ALWAYS open the pop-up because it's designed for a user click.
        if (state.tokenClient) {
            state.tokenClient.requestAccessToken();
        }
    });
}

dom.guestSigninBtn.addEventListener('click', signInAsGuest);

dom.forgotPasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-password-email').value;
    state.auth.sendPasswordResetEmail(email)
        .then(() => {
            dom.errorMessage.style.color = '#22c55e';
            dom.errorMessage.textContent = 'Success! Check your email for a reset link.';
        })
        .catch(handleAuthError);
});

dom.signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    dom.errorMessage.textContent = '';
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    state.auth.createUserWithEmailAndPassword(email, password).catch(handleAuthError);
});

dom.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    dom.errorMessage.textContent = '';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    state.auth.signInWithEmailAndPassword(email, password).catch(handleAuthError);
});

// --- CENTRAL AUTH STATE CONTROLLER ---
state.auth.onAuthStateChanged(async (user) => {
    if (user && state.isAppInitialized) return;

    if (user) {
        state.isAppInitialized = true; // Set the lock immediately
        // --- USER IS LOGGED IN ---
        if (state.vantaEffect) {
            state.vantaEffect.destroy();
            state.vantaEffect = null;
        }

        dom.authSection.style.display = 'none';
        dom.appContainer.style.display = 'flex';

        _initApp();

        if (user.isAnonymous) {
            dom.userEmailDisplay.textContent = 'Guest User';
                            dom.userAvatar.src = `https://i.pravatar.cc/40?u=guest`;
            dom.importChatBtn.style.display = 'none';
        } else {
            dom.userEmailDisplay.textContent = user.displayName || user.email;
                            dom.userAvatar.src = user.photoURL || `https://i.pravatar.cc/40?u=${user.uid}`;
            dom.importChatBtn.style.display = 'flex';
        }

                        dom.chatList.innerHTML = `<div class="p-2 space-y-2"><div class="h-9 bg-gray-200 dark:bg-gray-700/50 rounded-md animate-pulse"></div><div class="h-9 bg-gray-200 dark:bg-gray-700/50 rounded-md animate-pulse w-5/6"></div><div class="h-9 bg-gray-200 dark:bg-gray-700/50 rounded-md animate-pulse w-4/6"></div></div>`;
        const chatsLoaded = await loadUserChatsFromFirestore(user.uid);

        if (chatsLoaded) {
            const chatIds = Object.keys(state.chats);
            if (chatIds.length > 0) {
                const lastChatId = Math.max(...chatIds.map(Number));
                switchChat(String(lastChatId));
            } else {
                await createNewChat();
            }
        } else {
            await createNewChat();
        }

    } else {

        // --- USER IS LOGGED OUT ---
        dom.appContainer.style.display = 'none';
        if (window.VANTA && !state.vantaEffect) {
            try {
                state.vantaEffect = VANTA.NET({
                    el: "#vanta-bg",
                    mouseControls: true, touchControls: true, gyroControls: false,
                    scale: 1.00, scaleMobile: 1.20, color: 0x8b5cf6,
                    backgroundColor: 0x0f172a, points: 12.00, maxDistance: 18.00
                });
            } catch (e) {
                console.error("Vanta.js initialization failed:", e);
                const vantaBg = document.getElementById('vanta-bg');
                if (vantaBg) { vantaBg.style.backgroundColor = '#0f172a'; }
            }
        }

        dom.authSection.style.display = 'flex';
        state.chats = {};
        state.activeChatId = null;
        showLoginView();

        // Correctly initialize Google's library here, only when it's needed.
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: "784623545561-f9qumqjcsek7g368657cloq8rqc0kurj.apps.googleusercontent.com",
                callback: handleCredentialResponse
            });
        }
    }

    // HIDE THE LOADER IN BOTH CASES (Correctly placed)
    dom.appLoader.style.opacity = '0';
    setTimeout(() => {
        dom.appLoader.style.display = 'none';
    }, 300);
});
}

// --- Phase 2 infra (new; no behavior change) ---
// app.js registers initApp so onAuthStateChanged can call it without a
// circular import. Call timing is identical to the original closure.
let _initApp = null;
export function registerInitApp(fn) { _initApp = fn; }
