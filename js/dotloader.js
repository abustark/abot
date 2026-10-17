/**
 * ABot — dotloader.js
 * 2.4.3 (owner request): the starting-site loader's dot-matrix animation,
 * shown under the dotted "abot" wordmark — a vanilla port of the 21st.dev /
 * Pace UI "Dot Loader" (components/gsap/dot-loader.tsx). The original renders
 * a 7×7 grid of 49 dots and, every 100ms, toggles `.active` on the dots
 * listed by the current frame (49-dot indices) — same frames, same timing,
 * same order. FRAMES is the component's "Playing" demo sequence (a snake
 * traversing the grid), extracted verbatim from the demo source.
 */

const FRAME_MS = 100;

const FRAMES = [
    [14, 7, 0, 8, 6, 13, 20],
    [14, 7, 13, 20, 16, 27, 21],
    [14, 20, 27, 21, 34, 24, 28],
    [27, 21, 34, 28, 41, 32, 35],
    [34, 28, 41, 35, 48, 40, 42],
    [34, 28, 41, 35, 48, 42, 46],
    [34, 28, 41, 35, 48, 42, 38],
    [34, 28, 41, 35, 48, 30, 21],
    [34, 28, 41, 48, 21, 22, 14],
    [34, 28, 41, 21, 14, 16, 27],
    [34, 28, 21, 14, 10, 20, 27],
    [28, 21, 14, 4, 13, 20, 27],
    [28, 21, 14, 12, 6, 13, 20],
    [28, 21, 14, 6, 13, 20, 11],
    [28, 21, 14, 6, 13, 20, 10],
    [14, 6, 13, 20, 9, 7, 21],
];

export const initDotLoader = (grid) => {
    if (!grid) return;
    const dots = Array.from(grid.children);
    if (dots.length === 0) return;

    let index = 0;
    const applyFrame = () => {
        const frame = FRAMES[index];
        dots.forEach((dot, i) => dot.classList.toggle('active', frame.includes(i)));
        index = (index + 1) % FRAMES.length;
    };

    applyFrame();
    const timer = window.setInterval(applyFrame, FRAME_MS);

    // The loader is one-shot (the auth flow hides it for good), so stop the
    // interval once #app-loader is hidden — no idle 10 Hz timer.
    const loader = grid.closest('#app-loader');
    if (loader && typeof MutationObserver === 'function') {
        const stop = new MutationObserver(() => {
            if (loader.style.display === 'none' || loader.style.visibility === 'hidden') {
                window.clearInterval(timer);
                stop.disconnect();
            }
        });
        stop.observe(loader, { attributes: true, attributeFilter: ['style'] });
    }
};
