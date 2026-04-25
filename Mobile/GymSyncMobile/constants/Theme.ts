/**
 * Centralized brand theme — IRON PULSE.
 * Mirrors the values declared in tailwind.config.js so we can use them in
 * places that need raw color strings (StatusBar, ActivityIndicator,
 * ThemeProvider, etc).
 */
export const theme = {
  colors: {
    background: '#0B0905',
    surface: '#171309',
    surfaceContainer: '#231f14',
    surfaceContainerHigh: '#2e2a1e',
    surfaceContainerHighest: '#393428',
    surfaceContainerLow: '#1f1b11',
    surfaceContainerLowest: '#110e05',
    onBackground: '#ebe2d0',
    onSurface: '#ebe2d0',
    onSurfaceVariant: '#d1c6ab',
    outline: '#9a9078',
    outlineVariant: '#4d4632',

    primary: '#facc15', // IRON PULSE yellow
    primaryDim: '#eec200',
    primaryFixed: '#ffe083',
    onPrimary: '#3c2f00',

    secondary: '#bdc7d8',
    error: '#ffb4ab',
    errorContainer: '#93000a',
  },
  font: {
    headline: 'Lexend_700Bold',
    headlineExtra: 'Lexend_800ExtraBold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemi: 'Inter_600SemiBold',
  },
} as const;
