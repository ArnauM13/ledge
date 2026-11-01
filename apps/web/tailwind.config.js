const { join } = require('node:path');

/**
 * Tailwind v3 (Angular CLI picks this file up automatically).
 * All utilities use the `t-` prefix (e.g. `t-bg-surface`) to avoid clashes.
 * Colours are CSS variables defined in src/styles.css (dark theme only).
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  prefix: 't-',
  content: [
    join(__dirname, 'src/**/*.{html,ts}'),
    join(__dirname, '../../libs/web/charts/src/**/*.{html,ts}'),
  ],
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
        series: {
          1: 'rgb(var(--ledge-series-1) / <alpha-value>)',
          2: 'rgb(var(--ledge-series-2) / <alpha-value>)',
          3: 'rgb(var(--ledge-series-3) / <alpha-value>)',
          4: 'rgb(var(--ledge-series-4) / <alpha-value>)',
          5: 'rgb(var(--ledge-series-5) / <alpha-value>)',
        },
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
