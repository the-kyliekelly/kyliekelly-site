/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        black: '#1a1a1a',
        offwhite: '#f5f4f2',
        pink: {
          DEFAULT: '#e040fb',
          light: '#f472b6',
        },
        muted: '#666666',
        warmgray: '#d4d0cc',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'Helvetica Neue', 'sans-serif'],
        script: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      borderRadius: {
        pill: '50px',
      },
    },
  },
  plugins: [],
};
