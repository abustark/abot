# Phase 3 Design Spec — Claude-Style Calm Revamp

> **Status:** 📝 Awaiting approval — no styles touched yet.
> **Sources:** `awesome-design/references/claude/DESIGN.md` (tokens) · `taste-skill` (process discipline) · Phase 0 audit (`docs/audits/ui-baseline.md`) · decisions you already made (Vanta = optional toggle, default OFF; features: search, skeletons, reactions, pin, collapse, timestamps toggle).

---

## 0. Design Read *(taste-skill §0.B — stated before anything else)*

**"Reading this as: a redesign (overhaul) of an AI chat product for consumers and developers, with a calm warm-editorial language, leaning toward the Claude design system — cream canvas, serif display voice, coral accents, hairline borders over shadows."**

**Dials** (per taste-skill §1.A — "minimalist / clean / calm" signal): `DESIGN_VARIANCE: 5` · `MOTION_INTENSITY: 3` · `VISUAL_DENSITY: 3`.
Note: taste-skill targets landing/portfolio pages; for product UI we apply its *discipline* (anti-slop defaults, pre-flight, restraint) rather than its marketing-page layouts.

**Anti-default discipline:** no purple gradients, no glassmorphism, no Inter-on-slate. Warmth comes from the cream/ink/coral palette; depth comes from hairlines and surface tint steps, not blur or heavy shadows.

---

## 1. Design Tokens → Tailwind (concrete)

### Palette (from claude DESIGN.md, verbatim)
| Token | Hex | Use |
|---|---|---|
| `canvas` | `#faf9f5` | app background (light mode) |
| `surface-soft` | `#f5f0e8` | sidebar, composer field |
| `surface-card` | `#efe9de` | cards, hover states, user bubble |
| `hairline` | `#e6dfd8` | **all borders** (1px, no shadows) |
| `ink` | `#141413` | headings (light mode) |
| `body` | `#3d3d3a` | body text |
| `muted` | `#6c6a64` | secondary text, timestamps |
| `primary` | `#cc785c` | **coral** — primary buttons, active states, links |
| `primary-active` | `#a9583e` | pressed states |
| `on-primary` | `#ffffff` | text on coral |
| `surface-dark` | `#181715` | app background (dark mode) |
| `surface-dark-elevated` | `#252320` | sidebar/cards (dark) |
| `on-dark` | `#faf9f5` | text on dark |
| `on-dark-soft` | `#a09d96` | secondary text (dark) |
| `success/warning/error` | `#5db872` / `#d4a017` / `#c64545` | toasts, errors (replaces Tailwind red/green defaults) |
| `accent-teal` / `accent-amber` | `#5db8a6` / `#e8a55a` | model color-coding accents |

### Typography
| Role | Font | Notes |
|---|---|---|
| Display (auth headline, empty state, "ABot" wordmark) | **Source Serif 4** (Google Fonts, self-hostable later) — stands in for Copernicus/Tiempos which are commercial | weight 400, tight tracking (-0.5px) |
| UI/body | **Inter** (keep — matches DESIGN.md's humanist-sans body voice) | 14–16px base, line-height 1.55 |
| Code | **JetBrains Mono** (keep) | 14px |

Per-model chat names keep current color-coding, re-mapped to the two accents + muted coral tints.

### Radii / spacing / motion
- Radii: buttons/inputs `8px` (`rounded-md`), cards `12px`, user bubble `12px` with `4px` tail corner, modals `16px`, icon buttons `full`
- Motion: 120–180ms ease-out transitions only; **no** infinite ambient animation; `prefers-reduced-motion` disables all transforms
- Borders replace shadows globally (`border-hairline`); elevation = surface tint step, not blur

---

## 2. Per-Screen Spec

### 2.1 Auth screen
- Canvas background, centered card on `surface-soft`/`surface-dark-elevated`, 16px radius, hairline border
- Headline in serif display: **"Converse with every model."** (or keep existing copy — your call)
- Google button: white/canvas with ink text (per DESIGN.md button-secondary); email forms with `autocomplete` attrs (Phase 0 fix); coral primary submit
- Guest sign-in: quiet text-link style under the card
- Error messages: `error` token, `role=alert`

### 2.2 Sidebar
- `surface-soft` (light) / `surface-dark-elevated` (dark), hairline right border
- "New chat" = coral primary button, full-width
- Chat list items: 8px radius, hover = `surface-card`; active = `surface-card` + coral 2px left inset; rename/delete in a small overflow menu (reduces icon noise)
- Footer: user chip + **Settings row** (new: theme, timestamps, Vanta toggle live here) + import/export icons

### 2.3 Header
- 56px, canvas/dark background, hairline bottom
- Model selector pill: hairline border, opens existing panel restyled to card + hairline + 8px radius items, check = coral

### 2.4 Chat messages (the core)
- Reading column: max-width 48rem, 24px side padding
- **AI messages:** no bubble — full width on canvas; header row = small model avatar dot (color-coded) + model name (caption style) + timestamp (toggleable); body = prose styles (existing typography plugin, retuned line-height 1.7)
- **User messages:** bubble on `surface-card`/`surface-dark-elevated`, 12px radius, right-aligned, max 80% width
- **Action row** (per AI message, on hover / always on mobile): copy · react 👍👎 · pin · collapse — icon buttons 32px, muted → ink on hover, tooltips
- **Streaming cursor:** 2px coral blinking bar (replaces any existing indicator); streaming state also sets `aria-busy` (Phase 0 fix)
- **Collapse long messages:** >12 lines collapses with "Show more" hairline-separated link
- **Skeleton loaders:** 3 shimmer bars on `surface-card` while chat loads (replaces spinner-only)

### 2.5 Composer
- Rounded-16 field on `surface-soft`, hairline border; focus = coral 2px ring (**this plus `:focus-visible` global styles fixes the Phase 0 focus finding**)
- Send button: coral circular; stop button: error-toned square while streaming
- Char/token hint stays subtle (muted caption)

### 2.6 Empty state (new)
- Serif display "How can I help today?" + 4 suggested-prompt cards on `surface-card` that prefill the composer (pure client-side, zero API cost)

### 2.7 Modals
- Delete/rename/guest-limit/prompt-library: canvas card, 16px radius, hairline, dim `ink/40%` backdrop; danger action = `error` token

---

## 3. Feature Specs (all free-tier safe — zero new AI calls)

| Feature | Storage | Notes |
|---|---|---|
| **Search within messages** | none (client-side) | Header search icon → filter bar; searches `state.chats` titles + message content; jumps to match & highlights (CSS mark); debounced 200ms |
| **Reactions 👍👎** | per-message field in the existing chat doc (1 write per reaction — same pattern as edit/delete) | only on AI messages; counts shown if >0; toggle to remove |
| **Pin messages** | per-message field (same write pattern) | pinned messages listed at top of chat; unpin from action row or pin list |
| **Collapse long messages** | UI only | see 2.4 |
| **Skeleton loaders** | UI only | chat-list + message-area skeletons |
| **Timestamps toggle** | `localStorage` (like darkMode) | Settings row; default on |
| **Vanta toggle** | `localStorage`, **default OFF** | three.js/vanta script tags **removed** from HTML; injected on first enable; toggle lives in Settings; CSP hosts unchanged |

## 4. Accessibility (Phase 0 findings — all closed in this phase)
- `:focus-visible` global ring (coral, 2px, 2px offset)
- `aria-label`s on ALL icon buttons (the 7 nameless ones + every new icon button)
- `autocomplete` on all auth inputs
- `aria-live="polite"` on the message stream container; `role="status"` on toast; `aria-busy` while streaming
- Single `<h1>` (auth: headline; app: visually-hidden "ABot chat")
- Empty state + skeletons (state coverage)
- All new interactive elements ≥ 40px touch targets

## 5. What does NOT change (DOM & behavior contract)
- **Every element ID in the `dom.js` registry stays** (smoke test enforces this)
- All logic: streaming, Firestore sync, auth flows, keyboard shortcuts, model config
- API surface: zero new AI calls (repo constraint)
- Parity gates: Phase 2's token-freeze **ends for `ui.js`/`chat.js` render functions and `index.html` markup** (that's the point of this phase); the smoke test + a NEW DOM-contract check (all `dom.js` ids present) become the gates

## 6. Execution sub-steps (each = build → smoke → serve → probe → commit)
| # | Step | Gate |
|---|---|---|
| 3.1 | Tokens: `tailwind.config.js` + `src/input.css` + fonts + CSS vars for light/dark | build CSS, smoke, serve |
| 3.2 | Shell: sidebar + header + settings row | smoke + DOM contract |
| 3.3 | Auth screen | smoke (auth ids) |
| 3.4 | Messages + composer + empty state + skeletons | smoke + DOM contract |
| 3.5 | Features A: collapse, timestamps, focus/a11y sweep | smoke + a11y re-audit |
| 3.6 | Features B: search, reactions, pin | smoke + probes |
| 3.7 | Vanta toggle + CDN tag removal | smoke + CSP check |
| 3.8 | Final: re-run Phase 0 audit suite → `docs/audits/ui-final.md` | all Phase 0 highs resolved |

## 7. Risks
| Risk | Mitigation |
|---|---|
| Tailwind purge misses dynamically-added classes (JS-built markup) | `tailwind.config.js` content globs include `./js/*.js` (currently only scans index.html — **must fix in 3.1**) |
| Hash-pinned CSP blocks nothing new; styles keep `'unsafe-inline'` (inline `style=""` attrs still used) | no CSP change needed in Phase 3 |
| Serif webfont adds render weight | `display=swap`; Phase 4 self-hosts/preloads |
| Reactions/pins add Firestore writes | 1 write per user action, same as existing edit/delete pattern; no listeners added |
| DOM id drift breaks `dom.js` | DOM-contract check added to smoke test in 3.1 |

---

**Your approval needed on 3 open decisions (next message):** display font, default theme, reaction storage scope.
