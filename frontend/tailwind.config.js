/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        dark: {
          900: '#0F172A', // bg-primary
          800: '#1E293B', // bg-secondary
          700: '#334155', // bg-tertiary
          600: '#475569',
        },
        // Accent colors
        accent: {
          primary: '#A855F7',   // Purple
          secondary: '#EC4899', // Pink
        },
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

