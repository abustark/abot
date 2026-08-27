# Performance & PWA — Phase 4 Notes

**Date:** 2026-08-27 · Branch: `arena/01a03fe9-abot`

## Shipped

### Fonts — self-hosted
- Inter (400/500/600/700), Source Serif 4 (400/600), JetBrains Mono (400/500/600) — latin woff2 subsets in `dist/fonts/` (~200 KB total)
- `@font-face` with `font-display: swap` in `src/input.css`; 3 key fonts preloaded (`<link rel="preload">`)
- Removed: Google Fonts stylesheet (render-blocking) + 2 preconnect handshakes

### Libraries — vendored + pinned
- `vendor/marked.min.js` (npm `marked`, minified UMD, 44 KB) — replaces unpinned `marked@latest` CDN
- `vendor/highlight.min.js` (npm `highlight.js` common-languages bundle via esbuild, 164 KB) + `vendor/atom-one-dark.css` — replaces cdnjs 11.9.0
- All head scripts now `defer` (firebase ×3, marked, hljs) → **zero synchronous render-blocking scripts** (was 4)
- Vanta pinned to `vanta@0.5.24` (was `@latest`), three.js already pinned r134; both lazy-loaded only when "Ambient background" is ON

### Icons — right-sized
- `favicon.png` was a 1024×1024 **380 KB** file loaded by every browser → now `favicon-32.png` **1.2 KB** (−99.7%)
- Added `icon-192.png` (14 KB), `icon-512.png` (74 KB), `apple-touch-icon.png` (13 KB)

### PWA
- `manifest.json` (name, standalone, theme `#181715`, icons 192/512 maskable) — installable
- `theme-color` meta; SW v12 precaches fonts + vendor + manifest; navigation network-first with offline fallback; `/api/` never cached

### CSP — tightened with the CDN removals
- `style-src`: dropped fonts.googleapis + cdnjs · `font-src`: 'self' only · `connect-src`: dropped fonts/cdn/jsdelivr
- `script-src` keeps jsdelivr + cdnjs **only** for the lazy Vanta load

## Honest measurement note
This sandbox cannot run Lighthouse (no Chromium). Numbers above are byte/DNS/request-level facts; a Lighthouse pass on the deployed URL is the remaining acceptance step for the owner. Expected effect: fewer origins (6 → 2: self + gstatic, +2 only if ambient bg enabled), no render-blocking head scripts, ~600 KB fewer first-paint bytes (fonts deferred + favicon 380 KB→1.2 KB + lib parity).

## SW cache versions
v9 (pre-Phase2) → v10 (modules) → v11 (bust) → **v12** (fonts + vendor). Old caches purge on activate.
