---
name: awesome-design
description: Reference library of 74 DESIGN.md design-system documents extracted from real websites (Apple, Linear, Airbnb, Stripe, Vercel, Ferrari, and more). Use when designing or restyling a UI and you want to match a specific brand's look — colors, typography, spacing, motion, and component patterns — or when you need real-world design-token inspiration.
---

# Awesome Design (DESIGN.md Library)

A curated collection of design-system documents extracted from public websites, from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

## How to use

1. **Pick a brand direction** — browse `references/` for a brand whose aesthetic matches the goal:

   ```bash
   ls .claude/skills/awesome-design/references/
   ```

   Notable examples: `apple`, `linear.app`, `stripe`-style minimalism, `airbnb`, `vercel`, `framer`, `claude`, `cursor`, `ferrari`, `lamborghini` (bold), `ibm` / `bmw` (corporate), `dell-1996` (retro).

2. **Read its DESIGN.md** before writing any UI code:

   ```bash
   cat .claude/skills/awesome-design/references/<brand>/DESIGN.md
   ```

3. **Apply the tokens** — each DESIGN.md documents real CSS values: color palette, typography scale, spacing, radii, shadows, motion, and component patterns. Extract the design tokens into the project's theme (e.g. `tailwind.config.js`) rather than hard-coding scattered values.

4. **Combine with other skills** — use together with `taste-skill` (direction + pre-flight audit), `web-design-guidelines` (accessibility/UX review), and `image-to-code` (design-first implementation).

## Notes

- Files are reference material "as is" — the extracted tokens represent publicly visible CSS values; do not copy trademarks or claim a site's visual identity outright.
- When none of the brands fit, use them for structural inspiration (type scales, spacing rhythm) and derive a bespoke palette instead.
