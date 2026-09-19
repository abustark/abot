'use strict';
/**
 * Generates the "ABot" dot-matrix wordmark (Nothing-style dotted type) as an
 * inline SVG for the app loader. Pure static markup — no font download, no
 * FOUC, and each dot carries its own animation-delay so the loader can build
 * every letter bottom-left -> top, sweeping A -> b -> o -> t left to right.
 *
 * Run: node tools/make-dotmark.js  (prints the SVG to stdout)
 */

// 7 rows x 5 cols per glyph. 'X' = dot.
const GLYPHS = {
    A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    b: ['X....', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
    o: ['.....', '.....', '.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
    t: ['..X..', '..X..', '.XXX.', '..X..', '..X..', '..X..', '...XX'],
};

const WORD = ['A', 'b', 'o', 't'];
const CELL = 6;          // dot grid pitch (px)
const R = 2.3;           // dot radius
const GAP = 8;           // space between letters
const LETTER_W = 4 * CELL; // 5 columns -> span 0..24
const HEIGHT = 6 * CELL;   // 7 rows -> span 0..36

// Timing: within a letter, bottom row first, left-to-right; letters staggered.
const LETTER_STAGGER = 140;
const ROW_STAGGER = 22;
const COL_STAGGER = 8;

const circles = [];
WORD.forEach((ch, li) => {
    const rows = GLYPHS[ch];
    const x0 = li * (LETTER_W + GAP);
    rows.forEach((row, ri) => {
        [...row].forEach((cell, ci) => {
            if (cell !== 'X') return;
            const delay = li * LETTER_STAGGER + (6 - ri) * ROW_STAGGER + ci * COL_STAGGER;
            circles.push(
                `<circle cx="${x0 + ci * CELL}" cy="${ri * CELL}" r="${R}" style="animation-delay:${delay}ms"/>`
            );
        });
    });
});

const width = WORD.length * LETTER_W + (WORD.length - 1) * GAP;
const svg =
    `<svg class="dotmark" viewBox="-4 -4 ${width + 8} ${HEIGHT + 8}" ` +
    `width="${(width + 8) * 2}" height="${(HEIGHT + 8) * 2}" role="img" aria-label="ABot">\n    ` +
    circles.join('\n    ') +
    '\n</svg>';

console.log(svg);
