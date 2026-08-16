/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"宋体"', '"SimSun"', 'sans-serif'],
      },
      colors: {
        // 赛博朋克配色：反转 ink 色阶（50=最深，900=最亮）
        ink: {
          50: '#0A0B2E', // 深紫黑（主背景）
          100: '#0F1035', // 深紫
          200: '#1E1B4B', // 中深紫（边框/分区）
          300: '#312E81', // 中紫
          400: '#6366F1', // 蓝紫（强调色）
          500: '#818CF8', // 中亮紫
          600: '#A5B4FC', // 亮紫
          700: '#C7D2FE', // 淡亮（次要文字）
          800: '#E0E7FF', // 近白（主文字）
          900: '#F0F9FF', // 最亮
        },
        // 霓虹色
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
