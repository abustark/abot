/**
 * ABot — auth-preview.js
 * 2.6.2 (owner request): the auth page shows the product, not only a form.
 * Two jobs, both decoration:
 *
 *  1. Fill the preview thread with THREE REAL models — one each from Google,
 *     Groq and NVIDIA read straight out of MODEL_CONFIG — and play a short,
 *     silent exchange on a loop. Nothing is invented here: if a provider has
 *     no entry in MODEL_CONFIG, its row is dropped, so the preview can never
 *     advertise a model the app does not actually have.
 *
 *  2. Tilt the sign-in card toward the pointer (±2.2°) and slide its coral
 *     glare. Pointer-fine only, never while a field inside the card has focus,
 *     and skipped entirely under prefers-reduced-motion.
 *
 * Honours the repo's motion rules: transform/opacity only, the app's --ease-out
 * token, one-shot entrance handled in CSS, and a static thread when reduced
 * motion is requested.
 */

import { MODEL_CONFIG } from './config.js';

const PROVIDER_SLOTS = [
    { prefix: 'google/', dot: 'bg-provider-google', line: 'Found it — the guard runs before the token check.' },
    { prefix: 'groq/', dot: 'bg-provider-groq', line: 'Same path, cheaper fix: bail out before the guard.' },
    { prefix: 'nvidia/', dot: 'bg-provider-nvidia', line: 'Patched, plus a test that reproduces it.' }
];

const prefersReducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const hasFinePointer = () => {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const providerOf = (id) => {
    if (id.startsWith('google/')) return 'google';
    if (id.startsWith('groq/')) return 'groq';
    if (id.startsWith('nvidia/')) return 'nvidia';
    return 'openrouter';
};

const initThread = () => {
    const host = document.getElementById('auth-preview-replies');
    const section = document.getElementById('auth-section');
    if (!host || !section) return;

    const rows = [];
    for (const slot of PROVIDER_SLOTS) {
        const entry = Object.entries(MODEL_CONFIG).find(([id]) => id.startsWith(slot.prefix));
        if (!entry) continue;

        const row = document.createElement('div');
        row.className = 'auth-preview-reply';

        const dot = document.createElement('span');
        dot.className = `auth-preview-dot ${slot.dot}`;

        const text = document.createElement('p');
        text.className = 'auth-preview-reply-text';

        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = entry[1].name;

        const body = document.createElement('span');

        text.append(who, document.createTextNode(' — '), body);
        row.append(dot, text);
        host.append(row);
        rows.push({ row, body, line: slot.line });
    }
    if (!rows.length) return;

    const showAll = () => rows.forEach((r) => {
        r.row.classList.add('is-in');
        r.body.textContent = r.line;
    });
    const reset = () => rows.forEach((r) => {
        r.row.classList.remove('is-in');
        r.body.textContent = '';
    });

    // Reduced motion: the finished thread, no typing, no loop.
    if (prefersReducedMotion()) {
        showAll();
        return;
    }

    let token = 0;
    let running = false;

    // The token invalidates an in-flight loop the moment the page is hidden —
    // every await re-checks it, so a hidden auth screen costs nothing.
    const play = async (myToken) => {
        while (myToken === token) {
            reset();
            await sleep(260);
            for (const r of rows) {
                if (myToken !== token) return;
                r.row.classList.add('is-in');
                await sleep(220);
                for (let i = 1; i <= r.line.length; i += 1) {
                    if (myToken !== token) return;
                    r.body.textContent = r.line.slice(0, i);
                    await sleep(14);
                }
                await sleep(520);
            }
            await sleep(3400);
            if (myToken !== token) return;
            rows.forEach((r) => r.row.classList.remove('is-in'));
            await sleep(420);
        }
    };

    const sync = () => {
        const visible = section.style.display !== 'none' && !document.hidden;
        if (visible && !running) {
            running = true;
            token += 1;
            play(token);
        } else if (!visible && running) {
            running = false;
            token += 1;
            reset();
        }
    };

    new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ['style'] });
    document.addEventListener('visibilitychange', sync);
    sync();
};

const initTilt = () => {
    const card = document.getElementById('auth-card');
    const wrap = card?.closest('.auth-card-wrap');
    const glare = card?.querySelector('.auth-glare > span');
    if (!card || !wrap) return;

    let frame = 0;
    let latest = null;

    const reset = () => {
        latest = null;
        if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
        card.style.transform = '';
    };

    const flush = () => {
        frame = 0;
        const event = latest;
        if (!event) return;

        // Never tilt while someone is typing in the card — the text would
        // drift under the caret.
        if (document.activeElement && card.contains(document.activeElement)) {
            card.style.transform = '';
            return;
        }

        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const nx = (event.clientX - rect.left) / rect.width - 0.5;
        const ny = (event.clientY - rect.top) / rect.height - 0.5;

        card.style.transform = `perspective(1100px) rotateX(${(-ny * 2.2).toFixed(2)}deg) rotateY(${(nx * 2.6).toFixed(2)}deg)`;

        if (glare) {
            glare.style.transform = `translate3d(${((nx + 0.5) * rect.width).toFixed(1)}px, ${((ny + 0.5) * rect.height).toFixed(1)}px, 0)`;
        }
    };

    wrap.addEventListener('pointermove', (event) => {
        if (!hasFinePointer() || prefersReducedMotion()) return;
        latest = event;
        if (!frame) frame = requestAnimationFrame(flush);
    }, { passive: true });

    wrap.addEventListener('pointerleave', reset);
    card.addEventListener('focusin', reset);
    window.addEventListener('blur', reset);
};

export const initAuthPreview = () => {
    const ids = Object.keys(MODEL_CONFIG);

    const modelsEl = document.getElementById('auth-stat-models');
    if (modelsEl) modelsEl.textContent = String(ids.length);

    const providersEl = document.getElementById('auth-stat-providers');
    if (providersEl) providersEl.textContent = String(new Set(ids.map(providerOf)).size);

    initThread();
    initTilt();
};
