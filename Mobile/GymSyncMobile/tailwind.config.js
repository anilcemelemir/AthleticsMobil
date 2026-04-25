/**
 * Tailwind / NativeWind theme — IRON PULSE.
 * Colors mapped from MyDesigns/*.html.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand palette (IRON PULSE).
        primary: {
          DEFAULT: '#facc15', // primary-container yellow
          dim: '#eec200',
          fixed: '#ffe083',
          on: '#3c2f00',
        },
        background: '#0B0905',
        surface: {
          DEFAULT: '#171309',
          dim: '#171309',
          bright: '#3e392d',
          container: '#231f14',
          'container-low': '#1f1b11',
          'container-high': '#2e2a1e',
          'container-highest': '#393428',
          'container-lowest': '#110e05',
        },
        on: {
          background: '#ebe2d0',
          surface: '#ebe2d0',
          'surface-variant': '#d1c6ab',
          primary: '#3c2f00',
        },
        outline: {
          DEFAULT: '#9a9078',
          variant: '#4d4632',
        },
        secondary: '#bdc7d8',
        accent: {
          red: '#ffb4ab',
          green: '#86efac',
        },
      },
      fontFamily: {
        headline: ['Lexend_700Bold'],
        'headline-x': ['Lexend_800ExtraBold'],
        body: ['Inter_400Regular'],
        'body-medium': ['Inter_500Medium'],
        'body-semi': ['Inter_600SemiBold'],
      },
    },
  },
  plugins: [],
};
