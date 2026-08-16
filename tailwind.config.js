/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', '"ZCOOL KuaiLe"', 'system-ui', 'sans-serif'],
        cute: ['"ZCOOL KuaiLe"', '"Noto Sans SC"', 'sans-serif'],
      },
      colors: {
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
        accent: {
          magenta: 'rgb(var(--accent-magenta) / <alpha-value>)',
          periwinkle: 'rgb(var(--accent-periwinkle) / <alpha-value>)',
        },
        semantic: {
          success: 'rgb(var(--semantic-success) / <alpha-value>)',
          warning: 'rgb(var(--semantic-warning) / <alpha-value>)',
          error: 'rgb(var(--semantic-error) / <alpha-value>)',
        },
      },
      screens: {
        sm: '768px',
        lg: '1024px',
      },
    },
  },
  plugins: [],
}
