/**
 * 2.6.9 (owner request) — TEMPORARY palette A/B switch.
 *
 * Steel blue is the default. The two controls (auth footer + profile menu) only
 * toggle `theme-oxblood` on <html>; every colour in the app comes from the
 * --c-* tokens, so the whole UI retints without any component knowing about it.
 *
 * Delete this file, the `.theme-oxblood` block in src/input.css, the two
 * .palette-compare groups in index.html and this script tag once the owner
 * picks a winner.
 */

const KEY = 'abot-palette';
const root = document.documentElement;

const read = () => {
    try {
        return localStorage.getItem(KEY) === 'oxblood' ? 'oxblood' : 'steel';
    } catch (e) {
        return 'steel';
    }
};

const apply = (name) => {
    const oxblood = name === 'oxblood';
    root.classList.toggle('theme-oxblood', oxblood);
    document.querySelectorAll('.palette-chip').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip.dataset.palette === (oxblood ? 'oxblood' : 'steel')));
    });
    try {
        localStorage.setItem(KEY, oxblood ? 'oxblood' : 'steel');
    } catch (e) { /* private mode: the switch still works for this page */ }
};

document.querySelectorAll('.palette-chip').forEach((chip) => {
    chip.addEventListener('click', () => apply(chip.dataset.palette));
});

apply(read());
