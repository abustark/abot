# ABot — Skills-Based Audit & Improvement Pass

**Date:** 2026-09-13 · **Branch:** `main` · **Method:** skills from `~/.agents/skills` —
`web-design-guidelines` (live Vercel checklist), `ui-ux-pro-max` (design-system engine),
`design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`, `gpt-taste` (taste passes) —
plus repo history (`docs/audits/ui-baseline.md`, `ui-final.md`, `perf-pwa.md`).

## Scorecard

| Area | Before | After | Notes |
|---|---|---|---|
| Design language | 7.5 | **9.0** | Provider accents tokenized (`--c-provider-*`), SVG wordmark replaces 380 KB template logo, double-bezel auth card, eyebrow pill, signature radial glow, unified 1.5-stroke icons, serif voice on titles |
| UI | 7.0 | **8.5** | CSS tooltips, toast dismiss + flick-to-dismiss, touch-visible message actions, focus-within reveals, deprecated syntax removed |
| UX | 7.0 | **8.5** | Ctrl+K command palette (chat switcher + 8 actions), helper text in settings, unsent-draft leave-guard, streaming-state aware |
| Functions | 6.5 | **7.5** | Palette is the big add; export/search/import unchanged but now reachable from keyboard. Free-tier rule respected: **zero new AI API calls** |
| Accessibility | 7.5 | **9.0** | Skip link, landmark roles, labelled search input, 45px composer targets, focus-trap + focus-restore + scroll-lock on all dialogs, Tab-trap in model panel, reduced-motion-safe toast, 1 `h1` |
| Performance | 7.0 | **8.5** | highlight.js lazy (−164 KB initial), 380 KB logo + legacy favicon off the critical path and SW precache, immutable cache headers (fonts/vendor), preconnect gstatic |
| Visual feel | 7.5 | **8.5** | Warm palette now fully owned: no raw Tailwind hues, brand mark is custom SVG, both themes verified in a real browser |

**Overall: 7.2 → ~8.5** (projected 9.0 with the deferred items below).

## Verified (real browser, mobile + desktop viewport)
- Auth card renders in dark AND light (screenshots); glow visible; wordmark crisp
- Guest session loads: serif empty state, suggestion cards, provider-dot model selector
- Ctrl+K opens/filters/runs/Escapes; input auto-focus; listbox ARIA correct
- Theme toggle, palette toggle, Escape ordering all pass live
- Gates green per commit: `lint` 0 errors (29 warnings ≤ 30) · `check` clean ·
  `build:css` committed · `test` = security + smoke + interaction (incl. 9 new palette/toast cases)

## Deferred (owner decisions)
1. Firebase compat → modular v10 SDK (−100 KB+; touches auth wiring) — out of scope this pass
2. `i.pravatar.cc` default avatar → inline SVG identicon (removes external origin)
3. Full Lighthouse run on the deployed Vercel URL (sandbox lacks Chromium)
4. Regenerate / edit-and-resend — rejected: adds AI API calls (free-tier constraint)

## Commits
- `ae0ab94` A11y/UX/perf quick wins (web-design-guidelines)
- `e2479dc` Design language: deepen warm tokens
- `294249c` Command palette + tooltips + toast polish (roadmap 4/7/8)
- `dff9752` Real-browser pass fixes (45px targets, single h1)
- Preceded by: arena/01a03fe9-abot → main fast-forward (31 commits, `e22949b`)
