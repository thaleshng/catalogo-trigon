/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        trigon: {
          950: '#060709',
          900: '#0c0d12',
          850: '#12141a',
          800: '#191b24',
          750: '#20232f',
          700: '#2a2e3d',
          600: '#3e4458',
          500: '#5c647e',
          400: '#8c95ae',
          300: '#b4bcd1',
          200: '#dce0ec',
          100: '#edf0f7',
          50: '#f8f9fc',
        },
        crimson: {
          950: '#2e0408',
          900: '#540911',
          800: '#7e0e1a',
          700: '#a61323',
          600: '#d3182d',
          500: '#e52237',
          400: '#f04355',
          300: '#f67886',
          200: '#fbb3bc',
          100: '#fde2e6',
        },
      },
      fontFamily: {
        sans: ['Cinzel', 'Inter', 'sans-serif'],
        display: ['Cinzel', 'serif'],
      },
      boxShadow: {
        'glow-crimson': '0 0 25px -3px rgba(229, 34, 55, 0.35)',
        'glow-crimson-lg': '0 0 45px -5px rgba(229, 34, 55, 0.45)',
        'metal': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1), 0 4px 14px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        'radial-gradient': 'radial-gradient(circle at center, var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
