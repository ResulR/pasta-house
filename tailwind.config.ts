import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", md: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body:    ["var(--font-body)",    "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)",    "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        terracotta: {
          DEFAULT: "hsl(var(--terracotta))",
          soft: "hsl(var(--terracotta-soft))",
        },
        olive: {
          DEFAULT: "hsl(var(--olive))",
          soft: "hsl(var(--olive-soft))",
        },
        espresso: {
          DEFAULT: "hsl(var(--espresso))",
          soft: "hsl(var(--espresso-soft))",
        },
        cream: "hsl(var(--background))",

        /* ---- Claude Design tokens ---- */
        cream2:   "hsl(var(--cream2))",
        paper:    "hsl(var(--paper))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          2:       "hsl(var(--ink2))",
          3:       "hsl(var(--ink3))",
        },
        smoke:    "hsl(var(--smoke))",
        line: {
          DEFAULT: "hsl(var(--line))",
          2:       "hsl(var(--line2))",
        },
        sugo: {
          DEFAULT: "hsl(var(--sugo))",
          dark:    "hsl(var(--sugo-dark))",
          soft:    "hsl(var(--sugo-soft))",
        },
        sun: {
          DEFAULT: "hsl(var(--sun))",
          soft:    "hsl(var(--sun-soft))",
        },
        oliveSoft: "hsl(var(--olive-soft))",
        basil:     "hsl(var(--basil))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        card: "var(--shadow-card)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-soft": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.22s ease-out",
        "accordion-up": "accordion-up 0.22s ease-out",
        "fade-in": "fade-in 0.5s cubic-bezier(0.22,0.61,0.36,1) both",
        "fade-in-soft": "fade-in-soft 0.5s ease-out both",
        "slide-up": "slide-up 0.45s cubic-bezier(0.22,0.61,0.36,1) both",
        "slide-down": "slide-down 0.32s cubic-bezier(0.22,0.61,0.36,1) both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22,0.61,0.36,1) both",
        "shimmer": "shimmer 1.6s linear infinite",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22,0.61,0.36,1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;