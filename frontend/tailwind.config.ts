import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces
        'bg-0': '#07090d',
        'bg-1': '#0b0e15',
        'bg-2': '#10141d',
        'bg-3': '#161b27',
        'bg-4': '#1c2230',
        // Text
        'fg-0': '#f3f4f6',
        'fg-1': '#d8dde6',
        'fg-2': '#9aa3b2',
        'fg-3': '#6b7488',
        'fg-4': '#4a5263',
        // Tier accents
        working: { DEFAULT: '#2dd4bf', dim: '#0f766e' },
        episodic: { DEFAULT: '#f5a524', dim: '#b45309' },
        kg: { DEFAULT: '#a78bfa', dim: '#6d28d9' },
        // Status
        ok: '#34d399',
        warn: '#fbbf24',
        danger: '#f87171',
        info: '#60a5fa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      keyframes: {
        'pulse-dot': {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%':     { transform: 'scale(0.6)', opacity: '0.7' },
        },
        'card-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to:   { transform: 'translateX(0)', opacity: '1' },
        },
        'blink': { '50%': { opacity: '0' } },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
        'card-in':   'card-in 380ms cubic-bezier(.2,.7,.3,1.2)',
        'toast-in':  'toast-in 280ms cubic-bezier(.2,.7,.3,1.2)',
        'slide-in':  'slide-in 240ms cubic-bezier(.2,.7,.3,1)',
        blink:       'blink 1.1s steps(2, end) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
