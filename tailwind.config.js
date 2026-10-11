/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef1ff',
          100: '#e0e5ff',
          200: '#c6cefe',
          300: '#a3aefc',
          400: '#7e85f8',
          500: '#6261f1',
          600: '#5045e5',
          700: '#4437ca',
          800: '#382fa3',
          900: '#312d81',
          950: '#1d1a4b',
        },
        canvas: '#f5f6fb',
        ink: '#0f1222',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        bangla: ['"Noto Sans Bengali"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.03), 0 6px 18px -8px rgba(16,24,40,.10)',
        lift: '0 10px 30px -12px rgba(68,55,202,.45)',
        nav: '0 -8px 30px -12px rgba(16,24,40,.18)',
      },
      keyframes: {
        sheetUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        sheetDown: { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeOut: { from: { opacity: 1 }, to: { opacity: 0 } },
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        toastIn: { from: { opacity: 0, transform: 'translateY(-12px) scale(.96)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
        shake: { '10%,90%': { transform: 'translateX(-2px)' }, '20%,80%': { transform: 'translateX(4px)' }, '30%,50%,70%': { transform: 'translateX(-6px)' }, '40%,60%': { transform: 'translateX(6px)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        sheet: 'sheetUp .36s cubic-bezier(.16,1,.3,1)',
        'sheet-out': 'sheetDown .22s cubic-bezier(.4,0,1,1) forwards',
        fade: 'fadeIn .2s ease-out',
        'fade-out': 'fadeOut .22s ease-in forwards',
        // 'backwards' (not 'both') so no transform lingers — a leftover transform would trap position:fixed children
        rise: 'rise .35s cubic-bezier(.16,1,.3,1) backwards',
        toast: 'toastIn .28s cubic-bezier(.16,1,.3,1)',
        shake: 'shake .45s ease-in-out',
        pop: 'pop .45s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};
