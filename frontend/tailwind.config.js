/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"], // shadcn prefers dark mode toggling
	content: [
		"./index.html",
		"./src/**/*.{js,jsx,ts,tsx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Manrope", "sans-serif"], // 👈 add Manrope
				lexend: ["Lexend Zetta", "sans-serif"],
				cousine: ["Cousine", "monospace"],
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			keyframes: {
				slideDown: {
					'0%': { transform: 'translateY(-100%)' },
					'100%': { transform: 'translateY(100vh)' },
					},
				slideInLeft: {
					'0%': { transform: 'translateX(-50px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' },
					},
				slideOutRight: {
					'0%': { transform: 'translateX(0)', opacity: '1' },
					'100%': { transform: 'translateX(50px)', opacity: '0' },
					},
				zoomIn: {
					'0%': { transform: 'scale(0.9)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' },
					},
				},
			animation: {
				slideDown: 'slideDown 15s linear infinite', 
				slideInLeft: 'slideInLeft 0.5s ease-in-out forwards',
        		slideOutRight: 'slideOutRight 0.5s ease-in-out forwards',
				slideIn_Leftdelay: 'slideInLeft 0.7s ease-in-out forwards',
        		zoomIn: 'zoomIn 0.5s ease-in-out forwards',
				},
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
				},
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
