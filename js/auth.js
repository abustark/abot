/**
 * ABot Authentication Module
 * Handles login, signup, guest access, and Firebase auth state
 * 
 * NOTE: This is a reference module. The app still uses inline JS.
 */

export function showLoginView(dom) {
    dom.loginView.style.display = 'block';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'none';
    dom.errorMessage.textContent = '';
}

export function showSignupView(dom) {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'block';
    dom.forgotPasswordView.style.display = 'none';
    dom.errorMessage.textContent = '';
}

export function showForgotPasswordView(dom) {
    dom.loginView.style.display = 'none';
    dom.signupView.style.display = 'none';
    dom.forgotPasswordView.style.display = 'block';
    dom.errorMessage.textContent = '';
}

export function handleAuthError(error, dom) {
    let message = "An unexpected error occurred.";
    switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            message = "Invalid email or password.";
            break;
        case 'auth/email-already-in-use':
            message = "This email is already registered.";
            break;
        case 'auth/weak-password':
            message = "Password should be at least 6 characters.";
            break;
        case 'auth/invalid-email':
            message = "Please enter a valid email address.";
            break;
        case 'auth/too-many-requests':
            message = "Too many attempts. Please try again later.";
            break;
    }
    dom.errorMessage.textContent = message;
}

export async function signInAsGuest(auth) {
    try {
        await auth.signInAnonymously();
    } catch (error) {
        console.error("Guest sign-in error:", error);
    }
}

export async function signOut(auth) {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Sign out error:", error);
    }
}

export async function loginWithEmail(auth, email, password, dom) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        handleAuthError(error, dom);
    }
}

export async function signupWithEmail(auth, email, password, dom) {
    try {
        await auth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
        handleAuthError(error, dom);
    }
}
