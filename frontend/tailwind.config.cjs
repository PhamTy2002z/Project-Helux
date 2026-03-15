/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "!./src/api/generated/**/*",
  ],
  theme: {
    extend: {
      screens: {
        fhd: "1920px",
        qhd: "2560px",
        uhd: "3840px",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      keyframes: {
        "typing-dot": {
          "0%, 60%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "30%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "typing-dot-1": "typing-dot 1.4s ease-in-out infinite 0ms",
        "typing-dot-2": "typing-dot 1.4s ease-in-out infinite 200ms",
        "typing-dot-3": "typing-dot 1.4s ease-in-out infinite 400ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
