import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        sheet: 'var(--sheet)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-tint': 'var(--accent-tint)',
        focus: 'var(--focus)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        'warn-bg': 'var(--warn-bg)',
        error: 'var(--error)',
        'error-bg': 'var(--error-bg)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        gis: {
          'likely-electrified': 'var(--gis-likely-electrified)',
          'potentially-underserved': 'var(--gis-potentially-underserved)',
          'potentially-unserved': 'var(--gis-potentially-unserved)',
          unknown: 'var(--gis-unknown)',
          'existing-ht': 'var(--gis-existing-ht)',
          'proposed-ht': 'var(--gis-proposed-ht)',
          'proposed-lt': 'var(--gis-proposed-lt)',
          'minigrid-zone': 'var(--gis-minigrid-zone)',
          shs: 'var(--gis-shs)',
          building: 'var(--gis-building)',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
      },
      boxShadow: {
        control: '0 1px 2px rgba(31, 35, 40, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;

