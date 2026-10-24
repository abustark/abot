/**
 * ABot — sparkles.js
 * 2.4.1 (owner request): twinkling sparkle field behind the auth screen —
 * a vanilla canvas port of the 21st.dev / Aceternity "Sparkles" look.
 * 2.4.2: retuned to the real demo source the owner supplied
 * ("SparklesPreviewColorful"): particleDensity 100 (per 400×400 px area),
 * minSize 0.6 / maxSize 1.4, opacity 0.1–1 with the demo's slow twinkle
 * (speed 0.5 → linear triangle fade), slow in-place drift (move 0.1–1)
 * and click-to-push bursts (quantity 4). No third-party scripts.
 *
 * Rules it honours:
 *  - palette comes from the theme tokens (graphite ink + the four provider
 *    accents, 2.6.6) — no hardcoded hexes, so dark mode flips with the app;
 *  - decoration only: the canvas is pointer-inert + aria-hidden;
 *  - the loop runs only while #auth-section is actually on screen
 *    (MutationObserver on its inline display) and the tab is visible
 *    (2.4.4: the reduced-motion still-frame branch was removed per owner
 *    directive — every platform animates identically).
 */

const PALETTE_VARS = [
    '--c-ink',
    '--c-provider-google',
    '--c-provider-groq',
    '--c-provider-nvidia',
    '--c-provider-openrouter'
];

// Original tsparticles density box: `value` particles per 400×400 px.
const DENSITY_AREA = 400 * 400;
const DENSITY_VALUE = 100;   // demo: particleDensity={100}
const MAX_SPARKLES = 4000;   // sanity cap for very large/4K viewports
const PUSH_QUANTITY = 4;     // demo: interactivity push mode default

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

    let palette = readPalette();
    if (palette.length === 0) return;

    let running = false;
    let rafId = 0;
    let lastTs = 0;
    let width = 0;
    let height = 0;
    let field = [];

    const makeSparkle = (x, y) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8; // px/s — the demo's move speed 0.1–1 reads as a slow wander
        return {
            x, y,
            r: 0.6 + Math.random() * 0.8,     // demo: minSize 0.6 / maxSize 1.4
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            phase: Math.random(),             // per-dot offset (demo: sync:false)
            period: 5 + Math.random() * 2,    // s per full 0.1→1→0.1 cycle (demo: speed 0.5)
            color: palette[(Math.random() * palette.length) | 0]
        };
    };

    const buildField = () => {
        const count = Math.round(Math.min(MAX_SPARKLES, Math.max(40, DENSITY_VALUE * (width * height) / DENSITY_AREA)));
        field = Array.from({ length: count }, () => makeSparkle(Math.random() * width, Math.random() * height));
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

    const paint = (t, dt) => {
        ctx.clearRect(0, 0, width, height);
        for (const s of field) {
            if (dt > 0) {
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                // tsparticles outModes "out" respawns escapees — wrapping looks the same for dots
                if (s.x < -4) s.x = width + 4; else if (s.x > width + 4) s.x = -4;
                if (s.y < -4) s.y = height + 4; else if (s.y > height + 4) s.y = -4;
            }
            const cyc = (t / s.period + s.phase) % 1;
            const tri = 1 - Math.abs(2 * cyc - 1); // linear up/down, like the engine's fade
            const alpha = 0.1 + 0.9 * tri;         // demo: opacity min 0.1 / max 1
            if (alpha < 0.03) continue;
            ctx.beginPath();
            ctx.fillStyle = `rgba(${s.color}, ${alpha.toFixed(3)})`;
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const frame = (now) => {
        const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0;
        lastTs = now;
        paint(now / 1000, dt);
        rafId = requestAnimationFrame(frame);
    };

    const isAuthVisible = () => {
        if (!section) return true;
        if (section.style.display === 'none') return false;
        return getComputedStyle(section).display !== 'none';
    };

    const apply = () => {
        const visibleNow = isAuthVisible() && !document.hidden;
        if (visibleNow) {
            if (!running) {
                running = true;
                lastTs = 0;
                rafId = requestAnimationFrame(frame);
            }
            return;
        }
        if (running) {
            running = false;
            cancelAnimationFrame(rafId);
        }
    };

    // Demo interactivity: onClick push (quantity 4) — clicks anywhere on the
    // auth screen (buttons included) seed a few fresh sparkles at the cursor.
    if (section) {
        section.addEventListener('click', (e) => {
            if (field.length >= MAX_SPARKLES) return;
            const rect = canvas.getBoundingClientRect();
            for (let i = 0; i < PUSH_QUANTITY; i++) {
                field.push(makeSparkle(
                    e.clientX - rect.left + (Math.random() * 24 - 12),
                    e.clientY - rect.top + (Math.random() * 24 - 12)
                ));
            }
        });
    }

    window.addEventListener('resize', () => { resize(); apply(); });
    document.addEventListener('visibilitychange', apply);
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
