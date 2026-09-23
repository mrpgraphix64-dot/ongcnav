/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#7A1930',
          dark: '#5A0F21',
          deep: '#3D0714',
          light: '#9E2442',
          soft: '#FDF2F4',
        },
        cream: {
          DEFAULT: '#FAF7F2',
          light: '#FFFDF9',
          soft: '#F3EDDF',
          dark: '#E8DEC9',
          card: '#FFFFFF',
        },
        gold: {
          DEFAULT: '#D4AF37',
          muted: '#C5A059',
          light: '#F3E5AB',
          soft: '#FFF9E6',
          dark: '#9A7B1C',
        },
        saffron: {
          DEFAULT: '#E65100',
          light: '#FF8A65',
          soft: '#FFF3E0',
        },
        ink: {
          DEFAULT: '#2A2124',
          soft: '#66595C',
          muted: '#94888B',
        },
        ongc: {
          red: '#7A1930',
          darkred: '#5A0F21',
          lightred: '#9E2442',
          gold: '#D4AF37',
          darkgold: '#9A7B1C',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        cinzel: ['var(--font-cinzel)', 'Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
};
