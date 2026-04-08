const path = require("path");
const posixRoot = path.resolve(__dirname).replace(/\\/g, "/");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    `${posixRoot}/app/**/*.{ts,tsx}`,
    `${posixRoot}/components/**/*.{ts,tsx}`,
    `${posixRoot}/lib/**/*.{ts,tsx}`,
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F19",
        card: "#111827",
        accent: "#16C47F",
        gold: "#F0B90B",
        text: "#F9FAFB",
        muted: "#9CA3AF",
      },
      boxShadow: {
        panel: "0 10px 30px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top, rgba(22,196,127,0.18), transparent 35%), radial-gradient(circle at 80% 20%, rgba(240,185,11,0.12), transparent 25%)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
