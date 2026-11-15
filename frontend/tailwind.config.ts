import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          700: 'var(--navy-700)',
          800: 'var(--navy-800)',
          900: 'var(--navy-900)',
          950: 'var(--navy-950)',
        },
        paper: 'var(--paper)',
        canvas: 'var(--canvas)',
        sheet: 'var(--sheet)',
        surface: 'var(--surface)',
        subtle: 'var(--subtle)',
        'surface-hover': 'var(--surface-hover)',
        'surface-elevated': 'var(--surface-elevated)',
        rule: 'var(--rule)',
        'rule-subtle': 'var(--rule-subtle)',
        'rule-strong': 'var(--rule-strong)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        muted: 'var(--muted)',
        'ink-inverse': 'var(--ink-inverse)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-active': 'var(--accent-active)',
        'accent-tint': 'var(--accent-tint)',
        'accent-border': 'var(--accent-border)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-tint': 'var(--primary-tint)',
        focus: 'var(--focus)',
        ok: 'var(--ok)',
        'ok-bg': 'var(--ok-bg)',
        'ok-tint': 'var(--ok-tint)',
        'ok-border': 'var(--ok-border)',
        warn: 'var(--warn)',
        'warn-bg': 'var(--warn-bg)',
        'warn-tint': 'var(--warn-tint)',
        'warn-border': 'var(--warn-border)',
        error: 'var(--error)',
        'error-bg': 'var(--error-bg)',
        'error-tint': 'var(--error-tint)',
        'error-border': 'var(--error-border)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        'info-tint': 'var(--info-tint)',
        'info-border': 'var(--info-border)',
        gis: {
          'likely-electrified': 'var(--gis-likely-electrified)',
          'potentially-underserved': 'var(--gis-potentially-underserved)',
          'potentially-unserved': 'var(--gis-potentially-unserved)',
          unknown: 'var(--gis-unknown)',
          'aoi-boundary': 'var(--gis-aoi-boundary)',
          'existing-33kv': 'var(--gis-existing-33kv)',
          'existing-ht': 'var(--gis-existing-ht)',
          'existing-substation': 'var(--gis-existing-substation)',
          'existing-dt': 'var(--gis-existing-dt)',
          'assumed-tie-in': 'var(--gis-assumed-tie-in)',
          'proposed-ht': 'var(--gis-proposed-ht)',
          'proposed-lt': 'var(--gis-proposed-lt)',
          'proposed-dt': 'var(--gis-proposed-dt)',
          'minigrid-zone': 'var(--gis-minigrid-zone)',
          shs: 'var(--gis-shs)',
          'gap-corridor': 'var(--gis-gap-corridor)',
          building: 'var(--gis-building)',
          road: 'var(--gis-road)',
          water: 'var(--gis-water)',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], /* 11px / 16px — badges & map labels only */
        xs: ['0.75rem', { lineHeight: '1.125rem' }], /* 12px / 18px — compact data & labels */
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }], /* 13px / 20px — dense analytical tables */
        sm: ['0.875rem', { lineHeight: '1.375rem' }], /* 14px / 22px — standard UI body */
        base: ['1rem', { lineHeight: '1.5rem' }], /* 16px / 24px — section headings */
        lg: ['1.125rem', { lineHeight: '1.625rem' }], /* 18px / 26px — panel titles */
        xl: ['1.25rem', { lineHeight: '1.75rem' }], /* 20px / 28px — page titles & KPIs */
        '2xl': ['1.5rem', { lineHeight: '2rem' }], /* 24px / 32px — display metrics */
      },
      spacing: {
        'header': 'var(--header-height)',
        'toolbar': 'var(--toolbar-height)',
        'statusbar': 'var(--statusbar-height)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        control: 'var(--shadow-control)',
        overlay: 'var(--shadow-overlay)',
      },
      maxWidth: {
        workbench: 'var(--container-max)',
      },
    },
  },
  plugins: [],
} satisfies Config;
