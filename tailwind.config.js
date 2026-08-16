/** @type {import('tailwindcss').Config} */

// 使用函数方式定义颜色，避免 Tailwind 在构建时尝试解析 var() 导致回退到默认灰色
function cssVar(name) {
  return ({ opacityVariable, opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${name}) / ${opacityValue})`
    }
    if (opacityVariable !== undefined) {
      return `rgb(var(${name}) / var(${opacityVariable}, 1))`
    }
    return `rgb(var(${name}))`
  }
}

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
          50: cssVar('--ink-50'),
          100: cssVar('--ink-100'),
          200: cssVar('--ink-200'),
          300: cssVar('--ink-300'),
          400: cssVar('--ink-400'),
          500: cssVar('--ink-500'),
          600: cssVar('--ink-600'),
          700: cssVar('--ink-700'),
          800: cssVar('--ink-800'),
          900: cssVar('--ink-900'),
        },
        accent: {
          magenta: cssVar('--accent-magenta'),
          periwinkle: cssVar('--accent-periwinkle'),
        },
        semantic: {
          success: cssVar('--semantic-success'),
          warning: cssVar('--semantic-warning'),
          error: cssVar('--semantic-error'),
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
