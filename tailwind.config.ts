import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14201D",
        mineral: "#F2F4F3",
        sand: "#D9D4C7",
        muted: "#5C6B66",
        cobalt: { DEFAULT: "#2845D6", dark: "#1E36AB" },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
