/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        /**
         * The dashboard's locked three-column workspace, gated on ROOM.
         *
         * `xl` alone asks the wrong question. It means "at least 1280px
         * wide", and width is not what a full-height workspace needs — a
         * 1366x768 laptop clears xl comfortably and then has roughly 640px of
         * viewport left after the browser's own chrome, which is not enough
         * for a header, the day tabs and three columns. The page was pinned
         * to 100vh with overflow hidden, so the controls rail simply ended
         * mid-air with no way to reach the rest of it.
         *
         * 860px of viewport height is the line. A 1080p monitor clears it
         * (~950px of viewport) and keeps the workspace it was designed for;
         * every laptop panel falls below it and gets an ordinary page that
         * scrolls. Note this measures the VIEWPORT, not the screen, which is
         * why a "900px" laptop lands on the scrolling side where it belongs.
         */
        workspace: { raw: '(min-width: 1280px) and (min-height: 860px)' },
      },
      colors: {
        // ── Pathwise "Pastel Istanbul" palette ──
        // Warm ivory ground + three balanced Istanbul motif families:
        // İznik tile (teal/blue), Bosphorus sunset (peach/salmon), historic
        // texture (terracotta/mustard). Sage stays reserved for safety.
        surface: {
          DEFAULT: '#FAF6F0', // warm ivory — page ground
          2: '#F3ECE2', // soft sand — panels & inset surfaces
        },
        ink: '#3D3229', // warm espresso — primary text (never pure black)
        iznik: {
          DEFAULT: '#4A7C82', // deep İznik blue — primary actions, links, active
          soft: '#8FC4BE', // soft turquoise — hover / tints
        },
        sunset: {
          DEFAULT: '#F4A896', // peach-salmon — badges, featured cards, CTA accents
          soft: '#F8C9B4', // soft pink — gradient tail / gentle highlights
        },
        terracotta: '#D98868', // dusty terracotta — secondary accents, warnings
        mustard: '#EAC873', // soft mustard — tags, secondary accents
        sage: '#9CBBA0', // soft sage — Solo-Verified / safety (unchanged role)
      },
      backgroundImage: {
        // Featured surfaces (badges, headers, highlight cards) — soft sunset.
        'accent-gradient': 'linear-gradient(135deg, #F4A896 0%, #F8C9B4 100%)',
        'accent-gradient-deep': 'linear-gradient(135deg, #D98868 0%, #F4A896 100%)',
        // Brand wordmark — teal→terracotta reads cleanly on the ivory ground.
        'brand-gradient': 'linear-gradient(135deg, #4A7C82 0%, #D98868 100%)',
      },
      boxShadow: {
        // Soft "paper-on-paper" elevation — replaces the old neon glow.
        soft: '0 4px 16px rgba(61, 50, 41, 0.08)',
        'soft-lg': '0 8px 28px rgba(61, 50, 41, 0.10)',
      },
      fontFamily: {
        display: ['"Poppins"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
