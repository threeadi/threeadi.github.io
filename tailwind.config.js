/** @type {import('tailwindcss').Config} */
export default {
  content: ["./*.html", "./blog/*.html", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: "#0A0805", alt: "#100C08" },
        surface: { DEFAULT: "#181210", 2: "#201A14" },
        line: { DEFAULT: "#2E2318", hi: "#3D3025" },
        t1: "#F0E8DF",
        t2: "#9A8C82",
        t3: "#5A4E46",
        accent: {
          DEFAULT: "#4f9cf9",
          hi: "#74b0fa",
          org: "#c4a96e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      maxWidth: {
        site: "1080px",
      },
      spacing: {
        13: "52px",
      },
    },
  },
  plugins: [],
};
