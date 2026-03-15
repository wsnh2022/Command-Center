import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      // --- Color system (all resolved from CSS variables at runtime) ---
      colors: {
        surface: {
          0: 'var(--surface-0)',  // deepest background
          1: 'var(--surface-1)',  // sidebar bg
          2: 'var(--surface-2)',  // card bg
          3: 'var(--surface-3)',  // input / hover bg
          4: 'var(--surface-4)',  // border / divider
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          inverse:   'var(--text-inverse)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft:    'var(--accent-soft)',
          hover:   'var(--accent-hover)',
        },
        // Semantic (static — not theme-dependent)
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
        info:    '#3b82f6',
      },

      // --- Typography ---
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'xs':   ['12px', { lineHeight: '17px' }],
        'sm':   ['13px', { lineHeight: '19px' }],
        'base': ['15px', { lineHeight: '22px' }],
        'lg':   ['17px', { lineHeight: '24px' }],
        'xl':   ['19px', { lineHeight: '27px' }],
      },

      // --- Spacing (density-aware via CSS var) ---
      spacing: {
        'card-pad':            'var(--card-pad)',
        'item-height':         'var(--item-height)',
        'sidebar-width':       '224px', // w-56
      },

      // --- Border radius ---
      borderRadius: {
        'card':  '10px',
        'pill':  '999px',
        'modal': '14px',
        'input': '6px',
        'btn':   '6px',
        'panel': '0px',
      },

      // --- Shadows ---
      boxShadow: {
        'card':  '0 2px 8px rgba(0,0,0,0.18)',
        'modal': '0 8px 32px rgba(0,0,0,0.32)',
        'panel': '-4px 0 24px rgba(0,0,0,0.24)',
        'tray':  '0 2px 12px rgba(0,0,0,0.22)',
      },

      // --- Transitions ---
      transitionDuration: {
        'fast': '100ms',
        'base': '150ms',
        'slow': '250ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // --- Sidebar width variants ---
      width: {
        'sidebar':    '224px',  // default w-56
        'sidebar-sm': '192px',  // compact at narrow widths
        'sidebar-lg': '256px',  // w-64 at wide widths
      },
    },
  },
  plugins: [],
}

export default config
