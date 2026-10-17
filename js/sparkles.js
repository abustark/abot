/**
 * ABot — sparkles.js
 * 2.4.1 (owner request): twinkling sparkle field behind the auth screen —
 * a vanilla canvas port of the 21st.dev / Aceternity "Sparkles" look
 * (tiny light-dots that fade in and out in place). No third-party scripts.
 *
 * Rules it honours:
 *  - palette comes from the theme tokens (coral/amber/teal + provider
 *    accents) — no hardcoded hexes, so dark mode flips with the app;
 *  - decoration only: the canvas is pointer-inert + aria-hidden;
 *  - prefers-reduced-motion: one calm still frame, no rAF loop;
 *  - the loop runs only while #auth-section is actually on screen
 *    (MutationObserver on its inline display) and the tab is visible.
 */

const PALETTE_VARS = [
    '--c-coral',
    '--c-amber',
    '--c-teal',
    '--c-provider-google',
    '--c-provider-groq',
    '--c-provider-nvidia'
];

const readPalette = () => {
    const cs = getComputedStyle(document.documentElement);
    return PALETTE_VARS
        .map((name) => cs.getPropertyValue(name).trim().split(/\s+/))
        .filter((rgb) => rgb.length === 3)
        .map((rgb) => rgb.join(', ')); // "204, 120, 92"
};

export const initSparkles = (canvas) => {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch { /* jsdom has no canvas */ }
    if (!ctx) return; // smoke tests / unsupported browsers: skip silently

    const section = canvas.closest('#auth-section') || canvas.parentElement;
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    let palette = readPalette();
    if (palette.length === 0) return;

    let running = false;
    let rafId = 0;
    let width = 0;
    let height = 0;
    let field = [];

    const buildField = () => {
        const count = Math.round(Math.min(240, Math.max(70, (width * height) / 9000)));
        field = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 0.6 + Math.random() * 1.3,               // core radius (css px)
            phase: Math.random() * Math.PI * 2,
            speed: 0.7 + Math.random() * 1.6,           // rad/s → 2.6–9s twinkle
            max: 0.28 + Math.random() * 0.62,           // peak alpha
            color: palette[(Math.random() * palette.length) | 0]
        }));
    };

    const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        width = canvas.clientWidth || window.innerWidth;
        height = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        palette = readPalette();
        buildField();
    };

    const paint = (t) => {
        ctx.clearRect(0, 0, width, height);
        for (const s of field) {
            const pulse = Math.sin(t * s.speed + s.phase); // -1..1
            const alpha = s.max * (0.5 + 0.5 * pulse);
            if (alpha < 0.02) continue;
            const radius = s.r * (0.85 + 0.15 * pulse);
            // soft halo + bright core — reads like a tiny star, no filters
            ctx.beginPath();
            ctx.fillStyle = `rgba(${s.color}, ${(alpha * 0.22).toFixed(3)})`;
            ctx.arc(s.x, s.y, radius * 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle = `rgba(${s.color}, ${alpha.toFixed(3)})`;
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const frame = (now) => {
        paint(now / 1000);
        rafId = requestAnimationFrame(frame);
    };

    const isAuthVisible = () => {
        if (!section) return true;
        if (section.style.display === 'none') return false;
        return getComputedStyle(section).display !== 'none';
    };

    const apply = () => {
        const visibleNow = isAuthVisible() && !document.hidden;
        if (visibleNow && !reduceMq.matches) {
            if (!running) {
                running = true;
                rafId = requestAnimationFrame(frame);
            }
            return;
        }
        if (running) {
            running = false;
            cancelAnimationFrame(rafId);
        }
        if (visibleNow) paint(0); // reduced-motion: one calm still frame
    };

    window.addEventListener('resize', () => { resize(); apply(); });
    document.addEventListener('visibilitychange', apply);
    if (typeof reduceMq.addEventListener === 'function') {
        reduceMq.addEventListener('change', apply);
    }
    // auth.js flips the section's inline display on sign-in/out — observe
    // that instead of threading start/stop calls through every auth flow.
    if (section && typeof MutationObserver === 'function') {
        new MutationObserver(apply).observe(section, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    resize();
    apply();
};
