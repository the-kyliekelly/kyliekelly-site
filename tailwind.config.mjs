/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        offwhite: '#f9f1f2',
        pink: {
          DEFAULT: '#e579df',
          light: '#d5b9db',
        },
        muted: '#666666',
        warmgray: '#d4d0cc',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Work Sans', 'Helvetica Neue', 'sans-serif'],
        script: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        pill: '50px',
      },
    },
  },
  plugins: [],
};
