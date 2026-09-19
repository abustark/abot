# UI Components Roadmap — "shadcn-class" quality without React

> **Decision (owner, 2026-08-30):** stay vanilla. Do **not** migrate to React.
> This file is historical component-roadmap context. Current work order and
> approval gates live in `docs/AI-WORK-ORDER.md`.
>
> Skills to load when executing: `.agents/skills/emil-design-eng`,
> `animate`, `review-animations`, `apple-design`, plus
> `.claude/skills/taste-skill` and `awesome-design/references/claude/DESIGN.md`.

## Why not React (settled — do not relitigate without new triggers)
- ABot is a single-view app with one state tree; vanilla ES modules fit it exactly.
- React ≈ +45 KB gzipped + full rewrite of ~4,000 tested lines + test-tooling rebuild.
- Triggers to revisit: multiple complex views/routes, deeply nested shared state, or a team mandate.

## The path: Basecoat-style components (shadcn aesthetics, vanilla runtime)
- **Basecoat UI** approach: shadcn-inspired markup/look implemented with Tailwind classes, no framework.
- Optional headless behavior via Web Components (Lit) where JS is genuinely needed (menus, dialogs).
- **Preact + compat (~4 KB)** is the escape hatch if a React-only component is ever unavoidable.

## Component backlog (priority order)
| # | Component | Status today | Work |
|---|---|---|---|
| 1 | Buttons (primary/secondary/ghost/danger, press states) | ✅ done (coral system, active:scale) | polish pass vs emil-design-eng review |
| 2 | Switch (peer-based, coral, focus ring) | ✅ done | extract to a shared snippet doc |
| 3 | Inputs (+ password eyes, autocomplete) | ✅ done | success/error states + helper text pattern |
| 4 | Toast | custom, transitions added | "Sonner-style" polish: stack, swipe-to-dismiss on mobile, promise states (loading → success/error) |
| 5 | Dropdown/menu (chat ⋮, model selector) | ✅ working, origin-aware | keyboard nav reuse, typeahead, animation review vs `animate` skill |
| 6 | Modal/Dialog (delete, guest limit, sign-out) | ✅ working | focus trap, `@starting-style` entry, scroll-lock |
| 7 | Tooltip | none | title-attr upgrade → small CSS-only tooltip, 125–200ms, skip-delay on subsequent hovers |
| 8 | Command palette (Ctrl+K) | none | search + actions launcher; keyboard-first (per `animate`: no open animation for high-frequency keyboard UI) |
| 9 | Tabs / settings sections | partial (settings panel) | only if settings grow |
| 10 | Skeletons | ✅ done | — |

## Acceptance criteria for each new component
- Token-only colors (canvas/surface/card/hairline/ink/coral…) — zero raw hex
- Motion from `--ease-*` tokens, ≤300ms, reduced-motion safe, `animate`-skill rules
- A11y: keyboard reachable, visible focus, aria wiring; interaction-test added to `tools/interaction-test.js`
- No new runtime dependencies (CSS-first; Web Component only if unavoidable)

## Execution order (when unlocked)
1. Fix tap-blocking bug → verify on deploy (gate for everything below)
2. Tooltip + Toast polish (quick wins)
3. Modal focus-trap + scroll-lock
4. Command palette (Ctrl+K) — biggest UX jump
5. Review pass with `review-animations` skill; fix flags
