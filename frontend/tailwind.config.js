/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: 'rgb(var(--primary-500, 14 165 233) / <alpha-value>)',
          600: 'rgb(var(--primary-600, 2 132 199) / <alpha-value>)',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: 'rgb(var(--secondary-500, 217 70 239) / <alpha-value>)',
          600: 'rgb(var(--secondary-600, 192 38 211) / <alpha-value>)',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        accent: {
          500: 'rgb(var(--accent-500, 245 158 11) / <alpha-value>)',
          600: 'rgb(var(--accent-600, 217 119 6) / <alpha-value>)',
          DEFAULT: 'rgb(var(--accent-500, 245 158 11) / <alpha-value>)',
        },
        resort: {
          sand: '#f5f0e6',
          ocean: '#1e88e5',
          forest: '#2e7d32',
          sunset: '#ff7043',
          gold: '#ffc107',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
