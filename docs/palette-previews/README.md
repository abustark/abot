# ABot — Colour Theme Candidates (preview renders)

Screenshots of the **real shipping UI** under four candidate palettes, captured with
the sandbox Chromium harness (`tools/palette-preview.js`). No repo CSS was modified —
each palette was injected as a document-level CSS-variable override, so what you see is
the actual markup, fonts, glass surfaces and sparkle field.

## Folders

| Folder | Palette | Status |
|---|---|---|
| `current-petrol/` | **Petrol & sand** — the shipped theme as of 2.6.7 | ✅ live |
| `oxblood/` | **A — Oxblood & bone** | candidate |
| `copper/` | **B — Copper & graphite** | candidate |
| `citron/` | **C — Citron & slate** | candidate |

Each folder has: `chat-light.png` · `chat-dark.png` · `auth-light.png` · `auth-dark.png`
(viewed at 1280×820, desktop).

## Side-by-side sheets

| File | Contents |
|---|---|
| `palette-SHEET-chat-light.png` | chat view, light, all four palettes left→right |
| `palette-SHEET-chat-dark.png` | chat view, dark, all four |
| `palette-SHEET-auth-light.png` | landing/auth, light, all four |
| `palette-SHEET-auth-dark.png` | landing/auth, dark, all four |
| `comparison-all-4rows.jpg` | **one image**: all four rows stacked with labels |

Order in every sheet: **current petrol → A oxblood → B copper → C citron**

## Why these three were proposed

ABot's identity already consumes four hues in-app — the provider dots:
**Gemini sky · Groq purple · NVIDIA emerald · OpenRouter yellow**. An accent in any of
those families competes with the product's own data legend (this is exactly why the
current petrol accent reads "green next to the green NVIDIA dot").

- **A Oxblood** — dark wine, warm bone canvas. No overlap with any provider hue, no overlap
  with Claude (coral), ChatGPT (green/black) or Gemini (blue/purple). Reads "archive of
  conversations".
- **B Copper** — warm accent on a *cool* graphite neutral (not cream). Closest to
  "premium hardware"; safest crowd-pleaser.
- **C Citron** — most energetic, but green-adjacent (brushes NVIDIA) and needs fill-only
  use (dark text on citron) to hold contrast.

## Token values (light / dark)

`rgb()` triplets, as Tailwind expects. Accent lives in the historical `--c-coral*` slot.

### A — Oxblood & bone
| Token | Light | Dark |
|---|---|---|
| canvas | `247 246 243` (#f7f6f3) | `20 18 16` (#141210) |
| surface | `242 240 236` | `27 24 21` |
| card | `239 236 230` | `32 29 25` |
| raised | `253 252 250` | `38 34 30` |
| hairline | `228 224 217` | `52 47 42` |
| ink | `22 19 15` (#16130f) | `245 242 236` |
| body | `67 64 58` | `221 216 207` |
| muted | `107 101 93` | `162 154 143` |
| **accent** | `125 31 61` (#7d1f3d) | `224 138 158` (#e08a9e) |
| accent-active | `95 21 45` (#5f152d) | `242 168 184` |
| accent-soft | `240 230 234` | `46 30 36` |

Contrast: ink 17.1 · body 9.6 · muted 5.3 · accent 9.1 · white-on-accent 9.8 · dark accent 7.4

### B — Copper & graphite
| Token | Light | Dark |
|---|---|---|
| canvas | `245 246 247` (#f5f6f7) | `19 20 22` (#131416) |
| card | `236 237 239` | `29 31 34` |
| ink | `20 23 26` (#14171a) | `243 244 245` |
| body | `62 67 72` | `220 221 224` |
| muted | `93 100 107` (#5d646b) | `155 161 167` |
| **accent** | `154 74 31` (#9a4a1f) | `229 154 106` (#e59a6a) |
| accent-active | `120 56 15` (#78380f) | `242 176 136` |
| accent-soft | `243 233 226` | `47 36 28` |

Contrast: muted 5.5 (on canvas) / 5.1 (on card — the lighter `#687076` fails at 4.3) · accent 5.8 · white-on-accent 6.2 · dark accent 8.0

### C — Citron & slate
| Token | Light | Dark |
|---|---|---|
| canvas | `246 247 244` (#f6f7f4) | `18 20 17` (#121411) |
| card | `236 238 232` | `29 32 28` |
| ink | `18 21 15` (#12150f) | `244 246 242` |
| body | `61 66 58` | `220 224 217` |
| muted | `102 107 98` | `154 160 150` |
| **accent** | `63 98 18` (#3f6212) | `184 233 134` (#b8e986) |
| accent-active | `47 74 13` (#2f4a0d) | `205 245 165` |
| accent-soft | `234 240 226` | `38 46 34` |

Contrast: muted 5.1 · accent 6.6 · white-on-accent 7.1 · dark accent 12.4
⚠️ Citron in **dark** mode is very light — use dark text on it (fill-only), never as
light-on-accent.

## Regenerating

```bash
node server.js                       # terminal 1 (port 3000)
npm i --no-save @sparticuz/chromium puppeteer-core
LD_LIBRARY_PATH=/tmp/al2023-libs/lib FONTCONFIG_PATH=/tmp/fonts \
  node tools/palette-preview.js      # → docs/audits/palette-*.png
```

See `docs/SANDBOX-BROWSER-VISUAL-TESTS.md` for the Chromium-in-sandbox setup.

## Picking one

Once a palette is chosen the real change is broader than these 11 vars: the two auth
blooms, the sparkle palette, `theme-color` (static meta + inline head script +
`syncThemeIcons`), `manifest.json`, a `dist/output.css` rebuild and a cache bump — then
`npm run ui:audit` proves AA contrast in a real browser before merge.
