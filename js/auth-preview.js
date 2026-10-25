/**
 * ABot — auth-preview.js
 * 2.6.2 (owner request): the auth page shows the product, not only a form.
 * Two jobs, both decoration:
 *
 *  1. Fill the preview thread with THREE REAL models read straight out of
 *     MODEL_CONFIG — a different trio on every load (2.6.3). Each of the four
 *     providers gets a slot, the slots are shuffled and three are shown, and
 *     the model inside a slot is picked at random. Nothing is invented here: if
 *     a provider has no entry in MODEL_CONFIG its slot is dropped, so the
 *     preview can never advertise a model the app does not actually have.
 *     2.7.0: the thread also rotates through several prompts, each with its own
 *     per-provider reply, so the panel shows range instead of one frozen Q&A.
 *
 *  2. Tilt the sign-in card toward the pointer (±2.2°) and slide its coral
 *     glare. Pointer-fine only, never while a field inside the card has focus,
 *     and skipped entirely under prefers-reduced-motion.
 *
 * Honours the repo's motion rules: transform/opacity only, the app's --ease-out
 * token and a one-shot entrance handled in CSS. The type-on loop always runs
 * (2.6.4: owner directive); only the tilt is skipped under reduced motion.
 */

import { MODEL_CONFIG } from './config.js';

const PROVIDER_META = {
    google: { dot: 'bg-provider-google' },
    groq: { dot: 'bg-provider-groq' },
    nvidia: { dot: 'bg-provider-nvidia' },
    openrouter: { dot: 'bg-provider-openrouter' }
};

// 2.7.0 (owner request): the thread used to show one frozen prompt. It now
// rotates through several, so the panel reads as range rather than a single
// screenshot. Each prompt carries a reply per provider, and every reply is kept
// short enough to stay on one line at the preview's width — the typing loop
// must never reflow the page.
const QUESTIONS = [
    {
        q: 'Why did the login button stop working on iOS?',
        replies: {
            google: 'Found it — the guard runs before the token check.',
            groq: 'Same path, cheaper fix: bail out before the guard.',
            nvidia: 'Patched, plus a test that reproduces it.',
            openrouter: 'Reproduced on a free route, then fixed at the source.'
        }
    },
    {
        q: 'Can you split this 400-line component into hooks?',
        replies: {
            google: 'Yes — three hooks, one render path, no new state.',
            groq: 'Start with the fetch hook; that is the biggest win.',
            nvidia: 'Split, plus a snapshot test for each hook.',
            openrouter: 'Refactored on a free route; behaviour unchanged.'
        }
    },
    {
        q: 'Why is the sidebar jumpy when I scroll on Android?',
        replies: {
            google: 'The transform fights the scroll container.',
            groq: 'Drop will-change — one class, no JS needed.',
            nvidia: 'Fixed and covered by a layout test.',
            openrouter: 'Reproduced on a low-end phone, then patched.'
        }
    },
    {
        q: "What's the cheapest way to stream a 200-token reply?",
        replies: {
            google: 'Trim the system prompt; it is most of the bill.',
            groq: 'Flush per chunk instead of per sentence.',
            nvidia: 'Measured: 38% fewer tokens, same answer.',
            openrouter: 'Compared three routes; this one costs least.'
        }
    }
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

const shuffled = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

const initThread = () => {
    const host = document.getElementById('auth-preview-replies');
    const section = document.getElementById('auth-section');
    const bubble = document.querySelector('#auth-preview .auth-preview-bubble');
    const userRow = document.querySelector('#auth-preview .auth-preview-user');
    if (!host || !section) return;

    // 2.6.3: a different trio on every load. Every provider in MODEL_CONFIG gets
    // a slot, the slots are shuffled and three are shown, and the model inside a
    // slot is random — so refreshing the page shows another slice of the
    // catalogue while still never naming a model that is not in the app.
    const byProvider = new Map();
    for (const [id, meta] of Object.entries(MODEL_CONFIG)) {
        const key = providerOf(id);
        if (!byProvider.has(key)) byProvider.set(key, []);
        byProvider.get(key).push(meta.name);
    }

    const slots = shuffled(Object.keys(PROVIDER_META))
        .filter((key) => byProvider.has(key))
        .slice(0, 3)
        .map((key) => ({ key, ...PROVIDER_META[key], model: pickOne(byProvider.get(key)) }));

    const rows = [];
    for (const slot of slots) {
        const row = document.createElement('div');
        row.className = 'auth-preview-reply';

        const dot = document.createElement('span');
        dot.className = `auth-preview-dot ${slot.dot}`;

        const text = document.createElement('p');
        text.className = 'auth-preview-reply-text';

        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = slot.model;

        const body = document.createElement('span');

        text.append(who, document.createTextNode(' — '), body);
        row.append(dot, text);
        host.append(row);
        rows.push({ row, body, provider: slot.key });
    }
    if (!rows.length) return;

    const reset = () => rows.forEach((r) => {
        r.row.classList.remove('is-in');
        r.body.textContent = '';
    });

    // 2.6.4 (owner directive): always type. The 2.6.2 code rendered the thread
    // fully finished whenever the OS asked for reduced motion — on the owner's
    // machine that read as "the animation is gone". Type-on IS the point of this
    // preview, so it runs regardless; the loop still stops dead whenever the
    // auth section is hidden or the tab is in the background.

    let token = 0;
    let running = false;
    let cycle = 0;

    // The token invalidates an in-flight loop the moment the page is hidden —
    // every await re-checks it, so a hidden auth screen costs nothing.
    const play = async (myToken) => {
        while (myToken === token) {
            // 2.7.0: rotate the prompt, one per cycle. The swap happens while
            // the replies are empty and the bubble is faded out, so the reader
            // never sees a half-changed thread.
            const question = QUESTIONS[cycle % QUESTIONS.length];
            cycle += 1;

            userRow?.classList.add('is-swapping');
            reset();
            await sleep(220);
            if (myToken !== token) return;
            if (bubble) bubble.textContent = question.q;
            userRow?.classList.remove('is-swapping');
            rows.forEach((r) => { r.line = question.replies[r.provider] || ''; });
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
            // 2.7.0: never leave the prompt mid-fade when the loop is stopped.
            userRow?.classList.remove('is-swapping');
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
