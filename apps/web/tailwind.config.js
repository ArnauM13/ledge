const { join } = require('node:path');

/**
 * Tailwind v3 (Angular CLI picks this file up automatically).
 * All utilities use the `t-` prefix (e.g. `t-bg-surface`) to avoid clashes.
 * Colours are CSS variables defined in src/styles.css (dark theme only).
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  prefix: 't-',
  content: [join(__dirname, 'src/**/*.{html,ts}')],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--ledge-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--ledge-surface) / <alpha-value>)',
          raised: 'rgb(var(--ledge-surface-raised) / <alpha-value>)',
        },
        line: 'rgb(var(--ledge-line) / <alpha-value>)',
        content: {
          DEFAULT: 'rgb(var(--ledge-content) / <alpha-value>)',
          muted: 'rgb(var(--ledge-content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--ledge-content-subtle) / <alpha-value>)',
        },
        positive: 'rgb(var(--ledge-positive) / <alpha-value>)',
        negative: 'rgb(var(--ledge-negative) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
