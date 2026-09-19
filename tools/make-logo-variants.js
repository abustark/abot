'use strict';
/**
 * ABot — tools/make-logo-variants.js
 *
 * The brand mark is a violet glyph. The UI needs it as a flat black silhouette
 * on the light theme and white on the dark theme, and a *favicon* cannot be
 * CSS-filtered — so the tab icon needs two real files.
 *
 * This script regenerates them from logo.png:
 *     node tools/make-logo-variants.js
 * Outputs (repo root):
 *     favicon-32-light.png  — black mark, referenced for prefers-color-scheme: light
 *     favicon-32-dark.png   — white mark, referenced for prefers-color-scheme: dark
 *
 * No dependencies: PNG decode/encode is done with Node's zlib.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SIZE = 32;

// --- PNG decode (8-bit RGBA only, which is what logo.png is) ------------------
function decodePng(buf) {
    let pos = 8;
    let ihdr = null;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.slice(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], colorType: data[9] };
        } else if (type === 'IDAT') {
            idat.push(data);
        }
        pos += 12 + len;
    }
    if (!ihdr || ihdr.depth !== 8 || ihdr.colorType !== 6) {
        throw new Error(`unsupported PNG (depth=${ihdr && ihdr.depth}, colorType=${ihdr && ihdr.colorType})`);
    }
    const bpp = 4;
    const stride = ihdr.w * bpp;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const out = Buffer.alloc(ihdr.h * stride);
    let rp = 0;
    for (let y = 0; y < ihdr.h; y++) {
        const filter = raw[rp++];
        const line = raw.slice(rp, rp + stride); rp += stride;
        const prev = y === 0 ? Buffer.alloc(stride) : out.slice((y - 1) * stride, y * stride);
        const cur = out.slice(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev[x];
            const c = x >= bpp ? prev[x - bpp] : 0;
            let v = line[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            }
            cur[x] = v & 0xff;
        }
    }
    return { w: ihdr.w, h: ihdr.h, data: out };
}

// --- Box-downsample to SIZE x SIZE, averaged in premultiplied alpha ----------
function downsample(img, size, rgb) {
    const out = Buffer.alloc(size * size * 4);
    const bx = img.w / size;
    const by = img.h / size;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let alpha = 0, n = 0;
            for (let sy = Math.floor(y * by); sy < Math.floor((y + 1) * by); sy++) {
                for (let sx = Math.floor(x * bx); sx < Math.floor((x + 1) * bx); sx++) {
                    alpha += img.data[(sy * img.w + sx) * 4 + 3] / 255;
                    n++;
                }
            }
            const o = (y * size + x) * 4;
            // Averaged coverage becomes the alpha: soft edges survive the
            // downsample, the color itself is flat.
            out[o] = rgb[0];
            out[o + 1] = rgb[1];
            out[o + 2] = rgb[2];
            out[o + 3] = Math.round((n ? alpha / n : 0) * 255);
        }
    }
    return out;
}

// --- PNG encode ---------------------------------------------------------------
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // RGBA
    const stride = size * 4;
    const rawWithFilters = Buffer.alloc((stride + 1) * size);
    for (let y = 0; y < size; y++) {
        rawWithFilters[y * (stride + 1)] = 0; // filter: none
        rgba.copy(rawWithFilters, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(rawWithFilters, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// --- Run ----------------------------------------------------------------------
const source = decodePng(fs.readFileSync(path.join(ROOT, 'logo.png')));
const targets = [
    { file: 'favicon-32-light.png', rgb: [0, 0, 0] },
    { file: 'favicon-32-dark.png', rgb: [255, 255, 255] },
];
for (const { file, rgb } of targets) {
    const png = encodePng(downsample(source, SIZE, rgb), SIZE);
    fs.writeFileSync(path.join(ROOT, file), png);
    console.log(`${file}: ${png.length} bytes (${SIZE}x${SIZE}, rgb(${rgb.join(',')}))`);
}
