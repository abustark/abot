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
 * 2.9.10 (owner directive): haptics on INTERACTIVE controls only.
 *
 * 2.8.0 fired on every tap anywhere in the page — including plain text, the
 * message body, the sidebar backdrop, empty space and scroll gestures. That
 * made the phone buzz at times when nothing had been "pressed", which reads as
 * a fault rather than feedback. A tap now ticks only when it lands on (or
 * inside) one of the affordances below.
 *
 * Adding a new interactive element? Give it the right tag or role and it is
 * covered automatically; otherwise add `data-haptic` to opt it in explicitly.
 */
const INTERACTIVE_SELECTOR = [
    'button',
    'a[href]',
    'label',
    'select',
    'summary',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="button"]',
    'input[type="submit"]',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[role="link"]',
    '[tabindex]:not([tabindex="-1"])',
    '[data-haptic]',
].join(',');

/**
 * One delegated listener covers every interactive control, including ones
 * created after load (chat rows, toast actions, palette results). A short gap
 * guard stops a <label> and its checkbox from double-firing.
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

        // Only real controls. A tap on message text, the background or a
        // backdrop must stay silent.
        const control = target.closest(INTERACTIVE_SELECTOR);
        if (!control) return;

        // Disabled / aria-disabled controls never act, so they must not buzz.
        if (control.closest('[aria-disabled="true"]')) return;
        if (control.disabled === true) return;

        // An explicitly opted-out subtree stays silent (e.g. a decorative pill
        // nested inside a button that already ticked).
        if (control.closest('[data-haptic="off"]')) return;

        const now = Date.now();
        if (now - lastTick < MIN_GAP_MS) return;
        lastTick = now;
        tick();
    }, { passive: true });
};
