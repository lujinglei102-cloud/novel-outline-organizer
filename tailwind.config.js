/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"宋体"', '"SimSun"', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f7f7f7',
          100: '#ededed',
          200: '#d9d9d9',
          300: '#bfbfbf',
          400: '#8c8c8c',
          500: '#595959',
          600: '#434343',
          700: '#262626',
          800: '#1f1f1f',
          900: '#0d0d0d',
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
