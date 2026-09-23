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
        ongc: {
          red: '#D32F2F',
          darkred: '#9A0007',
          lightred: '#FF6659',
          gold: '#FFD700',
          darkgold: '#B29700',
          navy: '#0A192F',
          darknavy: '#020C1B',
          lightnavy: '#172A45',
        },
      },
    },
  },
  plugins: [],
};
