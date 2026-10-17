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
import { showToast, stopSpeaking } from './utils.js';
import { state } from './state.js';
// Single source of truth for the Google OAuth client id (was hardcoded 3x).
const GOOGLE_CLIENT_ID = "784623545561-f9qumqjcsek7g368657cloq8rqc0kurj.apps.googleusercontent.com";
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

const setAuthMessage = (message = '', type = 'error') => {
    dom.errorMessage.textContent = message;
    dom.errorMessage.classList.remove('text-danger', 'text-ok');
    dom.errorMessage.classList.add(type === 'success' ? 'text-ok' : 'text-danger');
};

export const showLoginView = () => {
    dom.loginView.style.display = 'block';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'none';
    if (dom.verifyEmailView) dom.verifyEmailView.style.display = 'none';
    setAuthMessage();
};

export const showSignupView = () => {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'block';
    dom.forgotPasswordView.style.display = 'none';
    if (dom.verifyEmailView) dom.verifyEmailView.style.display = 'none';
    setAuthMessage();
};

export const showForgotPasswordView = () => {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'block';
    if (dom.verifyEmailView) dom.verifyEmailView.style.display = 'none';
    setAuthMessage();
};

export const showVerifyEmailView = (email = '') => {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'none';
    if (dom.verifyEmailView) dom.verifyEmailView.style.display = 'block';
    if (dom.verifyEmailAddress) dom.verifyEmailAddress.textContent = email;
    setAuthMessage();
};

export const handleAuthError = (error) => {
    console.error("Authentication Error:", error?.code);
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
    setAuthMessage(message);
    // v2.0.9 roadmap #3: mark the visible form's inputs invalid; any typing
    // clears the state (delegated listener below).
    const visibleView = ['login-view', 'signup-view', 'forgot-password-view']
        .map((id) => document.getElementById(id))
        .find((v) => v && !v.classList.contains('hidden') && v.style.display !== 'none');
    if (visibleView) {
        visibleView.querySelectorAll('input').forEach((inp) => inp.classList.add('input-error'));
    }

};

export const signInAsGuest = () => {
    setAuthMessage();
    state.auth.signInAnonymously()
        .catch((error) => {
            console.error("Anonymous sign-in error:", error);
            setAuthMessage(`Could not start a guest session: ${error.message}`);
        });
};

export const signOutUser = () => {
    stopSpeaking();
    // v2.0.8 fix: tell Google Identity Services the user is fully signed out.
    // Without this, GIS keeps the previous account auto-selected and the
    // Google button silently no-ops after sign-out until a refresh —
    // matching the owner's "auth buttons dead until refresh" report.
    try {
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
    } catch (e) { console.warn('[ABot] GIS disableAutoSelect failed:', e); }
    // Actually end the Firebase session (was a no-op — only stopped TTS).
    // onAuthStateChanged(null) handles the teardown + UI flip.
    state.isAppInitialized = false;
    if (state.auth) {
        state.auth.signOut().catch((err) => {
            console.error('Sign out error:', err);
            showToast('Failed to sign out. Please try again.', 'error');
        });
    }
};

export const linkGuestToGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
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
        const credential = firebase.auth.GoogleAuthProvider.credential(null, response.access_token);
        await state.auth.signInWithCredential(credential);
    } catch (error) {
        console.error("Google credential sign-in error:", error);
        handleAuthError(error);
    }
}

export function initAuth() {
if (window.google && google.accounts && google.accounts.id) {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
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
        // v2.0.18: after sign-out, Google's script may have been GC'd/lost its
        // init state in some browsers — rebuild the token client on demand
        // instead of silently doing nothing.
        if (state.tokenClient) {
            state.tokenClient.requestAccessToken();
            return;
        }
        if (window.google && google.accounts && google.accounts.oauth2) {
            state.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: handleCredentialResponse,
            });
            state.tokenClient.requestAccessToken();
        } else {
            setAuthMessage('Google sign-in is still loading — try again in a few seconds.');
            console.warn('[ABot] GIS not ready at Google button click');
        }
    });
}

dom.guestSigninBtn.addEventListener('click', signInAsGuest);

dom.forgotPasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-password-email').value;
    state.auth.sendPasswordResetEmail(email)
        .then(() => {
            setAuthMessage('Success! Check your email for a reset link.', 'success');
        })
        .catch(handleAuthError);
});


dom.signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setAuthMessage();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    state.auth.createUserWithEmailAndPassword(email, password)
        .then((credential) => {
            const user = credential.user;
            if (user) {
                user.sendEmailVerification().catch((err) => {
                    console.warn('[auth] Could not send initial verification email:', err);
                });
                showVerifyEmailView(user.email || email);
                setAuthMessage('Account created! A verification link has been sent to your email.', 'success');
            }
        })
        .catch(handleAuthError);
});

dom.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setAuthMessage();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    state.auth.signInWithEmailAndPassword(email, password).catch(handleAuthError);
});

if (dom.checkVerificationBtn) {
    dom.checkVerificationBtn.addEventListener('click', async () => {
        const user = state.auth.currentUser;
        if (!user) {
            showLoginView();
            return;
        }
        try {
            await user.reload();
            if (state.auth.currentUser.emailVerified) {
                setAuthMessage('Email verified! Loading ABot...', 'success');
                state.isAppInitialized = false;
                await enterApp(state.auth.currentUser);
            } else {
                setAuthMessage('Your email is not verified yet. Please check your inbox or spam folder.', 'error');
            }
        } catch (err) {
            console.error('Error reloading user:', err);
            setAuthMessage('Could not check verification status. Please try again.', 'error');
        }
    });
}

if (dom.resendVerificationBtn) {
    dom.resendVerificationBtn.addEventListener('click', async () => {
        const user = state.auth.currentUser;
        if (!user) {
            showLoginView();
            return;
        }
        try {
            await user.sendEmailVerification();
            setAuthMessage('Verification email sent! Please check your inbox.', 'success');
            showToast('Verification email resent');
        } catch (err) {
            console.error('Error resending verification email:', err);
            setAuthMessage('Could not resend verification email. Please wait a moment and try again.', 'error');
        }
    });
}

if (dom.verifyBackToLogin) {
    dom.verifyBackToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        signOutUser();
    });
}

// --- CENTRAL AUTH STATE CONTROLLER ---
// Phase 3.5: password visibility toggles
document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.querySelector('.eye-open')?.classList.toggle('hidden', show);
        btn.querySelector('.eye-off')?.classList.toggle('hidden', !show);
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
});

// build badge on the auth screen (confirms which build the client runs)
{
    const badge = document.getElementById('build-badge');
    if (badge) badge.textContent = `build ${window.ABOT_BUILD || '?'}`;
}

const hideAppLoader = () => {
    if (!dom.appLoader) return;
    // Remove from the hit-test path IMMEDIATELY — the element is fixed inset-0
    // z-50, so a transparent-but-present loader was swallowing every real tap
    // on mobile after first login (the 300ms display:none timer can be
    // throttled/dropped during page transitions). opacity handles the fade;
    // visibility + pointer-events make it untappable right away.
    dom.appLoader.style.pointerEvents = 'none';
    dom.appLoader.style.visibility = 'hidden';
    dom.appLoader.style.opacity = '0';
    const clear = () => { dom.appLoader.style.display = 'none'; };
    // Belt-and-braces: transitionend normally fires the cleanup, the timer is
    // the fallback for browsers that skip it (reduced-motion / bfcache).
    dom.appLoader.addEventListener('transitionend', clear, { once: true });
    setTimeout(clear, 350);
};

const enterApp = async (user) => {
    // Safety net: redirect unverified non-anonymous users back to the
    // verification screen even if the onAuthStateChanged gate was bypassed
    // (e.g. by a providerData race or direct call).
    if (!user.isAnonymous && !user.emailVerified) {
        state.isAppInitialized = false;
        dom.appContainer.style.display = 'none';
        dom.authSection.style.display = 'flex';
        showVerifyEmailView(user.email);
        hideAppLoader();
        return;
    }
    state.isAppInitialized = true; // Set the lock immediately
    // --- USER IS LOGGED IN ---

    dom.authSection.style.display = 'none';
    dom.appContainer.style.display = 'flex';

    try {
        _initApp();
    } catch (initError) {
        console.error('[ABot] initApp crashed:', initError);
        window.__abotErrors = window.__abotErrors || [];
        window.__abotErrors.push('initApp crashed: ' + (initError.stack || initError.message));
        showToast('App init failed — open ' + location.origin + '/#diag', 'error');
    }

    // 2.3.5 (owner request): show the account photo when one exists — DOM-built
    // img (never innerHTML with a user-controlled URL), letters stay the fallback.
    const setAvatar = (label, photoURL) => {
        dom.userAvatar.textContent = '';
        if (photoURL) {
            const img = document.createElement('img');
            img.src = photoURL;
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            img.className = 'w-full h-full rounded-full object-cover';
            img.addEventListener('error', () => { dom.userAvatar.textContent = label; }, { once: true });
            dom.userAvatar.appendChild(img);
        } else {
            dom.userAvatar.textContent = label;
        }
    };
    if (user.isAnonymous) {
        dom.userEmailDisplay.textContent = 'Guest User';
        setAvatar('G', null);
        dom.importChatBtn.style.display = 'none';
    } else {
        dom.userEmailDisplay.textContent = user.displayName || user.email;
        const initials = (user.displayName || user.email || '?')
            .trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
        setAvatar(initials || 'A', user.photoURL);
        dom.importChatBtn.style.display = 'flex';
    }

    dom.chatList.innerHTML = `<div class="p-2 space-y-2.5"><div class="skeleton h-11 rounded-xl" style="animation-delay:0ms"></div><div class="skeleton h-11 w-11/12 rounded-xl" style="animation-delay:80ms"></div><div class="skeleton h-11 w-4/6 rounded-xl" style="animation-delay:160ms"></div></div>`;
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
};

// v2.0.9 roadmap #3: typing clears validation styling; successful sends mark green.
dom.authSection?.addEventListener('input', (e) => {
    if (e.target.classList) e.target.classList.remove('input-error', 'input-success');
});

state.auth.onAuthStateChanged(async (user) => {
    if (user && state.isAppInitialized) return;

    if (user) {
        // Gate all non-anonymous users whose email isn't verified.
        // Google users always have emailVerified=true so they pass through.
        // This avoids the providerData race where it's initially empty [].
        if (!user.isAnonymous && !user.emailVerified) {
            state.isAppInitialized = false;
            dom.appContainer.style.display = 'none';
            dom.authSection.style.display = 'flex';
            showVerifyEmailView(user.email);
            hideAppLoader();
            return;
        }

        await enterApp(user);
    } else {
        // --- USER IS LOGGED OUT ---
        // v2.0.8: wrap the whole teardown so a single failure can never leave
        // the auth screen non-interactive (the owner's post-signout freeze).
        try {
        dom.appContainer.style.display = 'none';
        // The auth backdrop (sparkles canvas) starts and stops itself from
        // the auth-section display — nothing to spin up here.

        dom.authSection.style.display = 'flex';
        state.chats = {};
        state.activeChatId = null;
        showLoginView();

        // Correctly initialize Google's library here, only when it's needed.
        // The GSI script is `async defer` and on slow mobile networks may not
        // have loaded yet when this fires — so retry briefly instead of
        // leaving the Google button dead on first tap.
        const initGoogleButton = (attempt = 0) => {
            if (window.google && google.accounts && google.accounts.id) {
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse
                });
            } else if (attempt < 30) { // ~6s of retries at 200ms
                setTimeout(() => initGoogleButton(attempt + 1), 200);
            }
        };
        initGoogleButton();
        } catch (teardownError) {
            console.error('[ABot] sign-out teardown failed:', teardownError);
            window.__abotErrors = window.__abotErrors || [];
            window.__abotErrors.push('sign-out teardown: ' + (teardownError.stack || teardownError.message));
            // Belt-and-braces: force the auth screen visible + interactive
            // even if something above threw.
            dom.appContainer.style.display = 'none';
            dom.authSection.style.display = 'flex';
            showToast('Signed out — a UI glitch occurred. If buttons are dead, refresh once.', 'error');
        }
    }

    hideAppLoader();
});
}

// --- Phase 2 infra (new; no behavior change) ---
// app.js registers initApp so onAuthStateChanged can call it without a
// circular import. Call timing is identical to the original closure.
let _initApp = null;
export function registerInitApp(fn) { _initApp = fn; }
