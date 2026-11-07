/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tdtu: {
          blue: '#005596',
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          accent: '#0284c7'
        }
      }
    },
  },
  plugins: [],
}
