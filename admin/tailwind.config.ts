import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#202725",
        paper: "#f6f7f3",
        line: "#e5e8e2",
        moss: "#385548",
      },
    },
  },
  plugins: [],
};
export default config;
