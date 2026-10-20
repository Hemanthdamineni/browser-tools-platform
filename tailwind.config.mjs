/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf1ed',
          100: '#f7e4de',
          200: '#efc7bc',
          300: '#e4a08e',
          400: '#d47a63',
          500: '#b3422a',
          600: '#963520',
          700: '#7b2c1c',
          800: '#64271b',
          900: '#54241b',
          950: '#32140f',
        },
        surface: {
          0: '#fffefd',
          50: '#faf9f7',
          100: '#f6f5f2',
          200: '#eeece7',
          300: '#dedbd4',
          400: '#bdb9b0',
          500: '#88837a',
          600: '#5e5a53',
          700: '#3b3935',
          800: '#2d2c29',
          900: '#1d1d1b',
          950: '#141412',
        },
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: { content: '76rem', prose: '68ch' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-in': 'fade-in 0.2s ease-out', 'slide-up': 'slide-up 0.2s ease-out' },
    },
  },
  plugins: [],
};
