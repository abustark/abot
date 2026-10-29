/**
 * ABot — haptics.js
 * A short vibration on every tap, with a saved on/off preference
 * (account menu → Haptic feedback; the row only exists on touch devices).
 *
 * Platform limits: the Vibration API exists on Android Chrome/Firefox and some
 * other Android browsers; iOS Safari does not expose it, so taps are silent
 * there. Desktop pointers never vibrate, so the switch is hidden on them.
 */
const STORAGE_KEY = 'abot-haptics';
const TICK_MS = 10;
const MIN_GAP_MS = 90;

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
 * 2.8.0 (owner request): a desktop pointer can never vibrate, so the switch is
 * hidden where it cannot do anything — and revealed again if a coarse pointer
 * shows up (tablet, hybrid laptop used in touch mode).
 */
const syncToggleVisibility = () => {
    const input = document.getElementById('hapticsToggle');
    const row = input && input.closest('.menu-row');
    if (row) row.classList.toggle('hidden', !isTouch());
};

/**
 * One delegated listener covers every current and future tap — buttons, chat
 * rows, the sidebar backdrop, model options, composer chips, chat-name
 * actions, toasts and menu items. A short gap guard stops a <label> and its
 * checkbox from double-firing.
 */
export const initHaptics = () => {
    syncToggleVisibility();
    if (typeof window.matchMedia === 'function') {
        const mq = window.matchMedia('(pointer: coarse)');
        const onChange = () => syncToggleVisibility();
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
        else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    }

    let lastTick = 0;
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest('[aria-disabled="true"]')) return;
        const now = Date.now();
        if (now - lastTick < MIN_GAP_MS) return;
        lastTick = now;
        tick();
    }, { passive: true });
};
