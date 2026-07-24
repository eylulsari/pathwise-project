/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Pathwise brand palette ──
        night: {
          DEFAULT: '#0D0B1D', // deep midnight navy (background)
          800: '#131129',
        },
        cream: '#FDF7EF', // warm cream (cards)
        violet: {
          DEFAULT: '#8B5CF6', // electric violet (accent gradient start)
          deep: '#6B21A8',
        },
        fuchsia: {
          DEFAULT: '#EC4899', // neon pink/fuchsia (accent gradient end)
          neon: '#FF007F',
        },
        coral: '#FF7E5F', // sunset coral (secondary accent)
        emerald: '#10B981', // Solo-Verified / safety green
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
        'accent-gradient-deep': 'linear-gradient(135deg, #6B21A8 0%, #FF007F 100%)',
      },
      fontFamily: {
        display: ['"Poppins"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
