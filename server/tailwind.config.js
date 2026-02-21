/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./views/**/*.ejs"
  ],
  theme: {
    extend: {
      colors: {
        clifford: "#da373d",
      },
    },
  },
  plugins: [],
}
