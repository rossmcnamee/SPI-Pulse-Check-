/** @type {import('tailwindcss').Config} */
// Brand tokens for Sports Physio Ireland. Adjust hexes here to restyle globally.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#14365C', // headers, primary text, structure, nav
        gold: '#F5A623', // signature accent — North Star + 1-2 highlights only
        green: '#3BB54A', // positive / on-track trend
        coral: '#E5564B', // negative / behind-target trend
        pink: '#F8D2D8', // soft section accent, used sparingly
        bg: '#F6F7F9', // page background (off-white)
        card: '#FFFFFF', // card surfaces
        ink: '#1F2733', // body text
        muted: '#6B7280', // secondary text, labels
        hairline: '#ECEEF2', // thin card borders
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 54, 92, 0.04), 0 8px 24px rgba(20, 54, 92, 0.06)',
      },
    },
  },
  plugins: [],
}
