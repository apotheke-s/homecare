import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Hiragino Sans\"",
          "\"Yu Gothic\"",
          "Meiryo",
          "sans-serif"
        ]
      },
      colors: {
        care: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          600: "#0d9488",
          700: "#0f766e",
          900: "#134e4a"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
