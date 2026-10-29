/**
 * ABot — haptics.js
 * A short vibration on control taps for touch devices, with a saved on/off
 * preference (account menu → Haptic feedback).
 *
 * Platform limits: the Vibration API exists on Android Chrome/Firefox and some
 * other Android browsers; iOS Safari does not expose it, so the toggle is
 * silent there. Desktop pointers never vibrate.
 */
const STORAGE_KEY = 'abot-haptics';
const TICK_MS = 10;
const MIN_GAP_MS = 90;
const CONTROL_SELECTOR = [
    'button',
    'a[href]',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="switch"]',
    'label',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'select'
].join(', ');

const isTouch = () => typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;

export const hapticsEnabled = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true; // storage blocked (private mode) — default stays on
    }
};

export const setHaptics = (on) => {
    try {
        localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    } catch {
        // storage blocked — the toggle still applies to this page view
    }
};

export const tick = () => {
    if (!hapticsEnabled()) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (!isTouch()) return;
    navigator.vibrate(TICK_MS);
};

/**
 * One delegated listener covers every current and future control, including
 * the ones rendered after this runs (chat rows, model options, toasts).
 * A short gap guard stops a <label> and its checkbox from double-firing.
 */
export const initHaptics = () => {
    let lastTick = 0;
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const control = target.closest(CONTROL_SELECTOR);
        if (!control) return;
        if (control.disabled || control.getAttribute('aria-disabled') === 'true') return;
        const now = Date.now();
        if (now - lastTick < MIN_GAP_MS) return;
        lastTick = now;
        tick();
    }, { passive: true });
};
