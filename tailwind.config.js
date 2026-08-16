/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"VT323"', '"宋体"', '"SimSun"', 'sans-serif'],
        pixel: ['"Press Start 2P"', '"宋体"', 'monospace'],
        retro: ['"VT323"', '"宋体"', 'monospace'],
      },
      colors: {
        // 使用 CSS 变量，支持深色/浅色双主题切换
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        neon: {
          purple: '#A855F7',
          cyan: '#22D3EE',
          magenta: '#EC4899',
          gold: '#FBBF24',
          green: '#10B981',
          red: '#EF4444',
        },
      },
      screens: {
        sm: '768px',
        lg: '1024px',
      },
      boxShadow: {
        'neon-purple': '0 0 8px rgba(168,85,247,0.6), 0 0 16px rgba(168,85,247,0.3)',
        'neon-cyan': '0 0 8px rgba(34,211,238,0.6), 0 0 16px rgba(34,211,238,0.3)',
        'neon-blue': '0 0 8px rgba(99,102,241,0.6), 0 0 16px rgba(99,102,241,0.3)',
      },
    },
  },
  plugins: [],
}
