/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './js/*.js', // JS-built markup must be scanned (Phase 3 fix)
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        wordmark: ['"Cabinet Grotesk"', '"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        heading: ['"Source Serif 4"', 'Georgia', 'serif'], // legacy alias -> serif display voice
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      // Semantic palette (claude DESIGN.md) — CSS vars flip with the .dark class,
      // so every token has automatic light/dark parity. RGB triplets keep
      // Tailwind opacity modifiers (bg-coral/20) working.
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        body: 'rgb(var(--c-body) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        coral: {
          DEFAULT: 'rgb(var(--c-coral) / <alpha-value>)',
          active: 'rgb(var(--c-coral-active) / <alpha-value>)',
          soft: 'rgb(var(--c-coral-soft) / <alpha-value>)',
        },
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        teal: 'rgb(var(--c-teal) / <alpha-value>)',
        amber: 'rgb(var(--c-amber) / <alpha-value>)',
        provider: {
          google: 'rgb(var(--c-provider-google) / <alpha-value>)',
          groq: 'rgb(var(--c-provider-groq) / <alpha-value>)',
          nvidia: 'rgb(var(--c-provider-nvidia) / <alpha-value>)',
          openrouter: 'rgb(var(--c-provider-openrouter) / <alpha-value>)',
        },
      },
      borderRadius: {
        btn: '10px',
        card: '14px',
        modal: '20px',
      },
      boxShadow: {
        lift: '0 1px 2px rgb(20 20 19 / 0.04), 0 8px 24px -8px rgb(20 20 19 / 0.12)',
        soft: '0 1px 2px rgb(20 20 19 / 0.04)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
