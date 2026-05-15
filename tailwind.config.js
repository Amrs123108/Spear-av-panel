/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        spear: { dark: '#111827', mid: '#374151', green: '#065F46', red: '#991B1B', yellow: '#92400E' }
      }
    }
  },
  plugins: []
}
