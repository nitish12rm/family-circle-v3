/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0C0C0D",
          1: "#141416",
          2: "#1C1C1F",
          3: "#252529",
          4: "#2E2E33",
        },
        accent: {
          DEFAULT: "#7C5CFC",
          hover: "#6B4EE6",
          muted: "rgba(124,92,252,0.15)",
          glow: "rgba(124,92,252,0.3)",
        },
        text: {
          DEFAULT: "#E8E8EA",
          muted: "#8E8E93",
          faint: "#48484A",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.12)",
        },
        success: "#34C759",
        error: "#FF453A",
        warning: "#FF9F0A",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "sans-serif",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "spin-slow": "spin 2s linear infinite",
        grain: "grain 8s steps(10) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-2%, -3%)" },
          "20%": { transform: "translate(3%, 2%)" },
          "30%": { transform: "translate(-1%, 4%)" },
          "40%": { transform: "translate(4%, -2%)" },
          "50%": { transform: "translate(-3%, 1%)" },
          "60%": { transform: "translate(2%, 3%)" },
          "70%": { transform: "translate(-4%, -1%)" },
          "80%": { transform: "translate(1%, -4%)" },
          "90%": { transform: "translate(-2%, 2%)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(124,92,252,0.3)",
        "glow-sm": "0 0 10px rgba(124,92,252,0.2)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
