import { extendTheme } from '@chakra-ui/react';

const colors = {
  // Brand ramp built from the logo teal (#38B2AC at 500). Buttons and links
  // inherit it via colorScheme="brand"; nothing in the app should reach for
  // stock framework blues.
  brand: {
    50:  '#e4faf8',
    100: '#bff0ec',
    200: '#93e2dc',
    300: '#65d1c9',
    400: '#43c0b8',
    500: '#38B2AC',
    600: '#2c928e',
    700: '#227371',
    800: '#195755',
    900: '#113f3e',
  },
  space: {
    900: '#03050D',
    800: '#06091A',
    700: '#0B1120',
    600: '#101828',
    500: '#182135',
    400: '#243552',
  },
  // Brand palette from the Ephemeris logo sheet. Kept as named accents so the
  // teal→purple mark colors, the terminal-green and HAL-red variants can be
  // referenced directly (e.g. bgGradient="linear(to-r, accent.teal, accent.purple)").
  accent: {
    teal:     '#38B2AC',
    tealLight:'#5AD4D1',
    purple:   '#9F7AEA',
    terminal: '#00FF9D',
    hal:      '#FF3B30',
    ink:      '#0F1115',
    muted:    '#8B93A7',
  },
};

const semanticTokens = {
  colors: {
    'bg.body':     { default: '#06091A', _dark: '#06091A' },
    'bg.card':     { default: '#0B1120', _dark: '#0B1120' },
    'bg.elevated': { default: '#101828', _dark: '#101828' },
    'text.primary':   { default: '#E2E8F0', _dark: '#E2E8F0' },
    'text.secondary': { default: '#7A93B8', _dark: '#7A93B8' },
    'border.default': { default: '#1E2D45', _dark: '#1E2D45' },
    // Interactive controls need a brighter edge than cards do. border.default
    // is a hairline by design — correct for panels, but only 1.33:1 against
    // the control fill, so inputs and selects read as flat dark shapes with no
    // edge at all. These clear the 3:1 WCAG asks for a UI component boundary
    // (3.25:1 and 4.83:1 against bg.elevated) without making every card shout.
    'border.control':      { default: '#52698C', _dark: '#52698C' },
    'border.controlHover': { default: '#6B85AC', _dark: '#6B85AC' },
    'brand.primary':  { default: 'brand.400' },
    // Logo accents, exposed as semantic tokens for use across the UI.
    // Flight-console rules: terminal green marks LIVE data (countdowns,
    // telemetry, status dots) and nothing else; teal is for interactive
    // things; HAL red only ever means scrub/hold/error.
    'accent.primary':   { default: 'accent.teal' },
    'accent.secondary': { default: 'accent.purple' },
    'accent.terminal':  { default: 'accent.terminal' },
    'accent.danger':    { default: 'accent.hal' },
  },
};

// Shared field styling for text inputs and selects.
//
// Attached to the `outline` variant rather than to baseStyle on purpose:
// MissionTerminal renders its prompt with variant="unstyled" and its own
// green-on-black styling, and a baseStyle fill/border would override it.
//
// Chakra resolves Select's variants from its own theme definition rather than
// reading Input's at runtime, so this object has to be attached to both
// explicitly — overriding Input alone would leave every Select behind.
const controlField = {
  bg: 'bg.elevated',
  borderColor: 'border.control',
  color: 'text.primary',
  // Chakra's dark-mode default here is whiteAlpha.400, which lands around
  // 3.7:1 — under the 4.5:1 body text needs. text.secondary is the app's
  // established quieter text colour and measures 5.78:1 on this fill.
  _placeholder: { color: 'text.secondary' },
  _hover: { borderColor: 'border.controlHover' },
  // The stock outline focus ring is blue.300 — one of the framework blues the
  // brand ramp comment above rules out.
  _focusVisible: {
    borderColor: 'brand.400',
    boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)',
  },
};

const config = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts: {
    // Orbitron is the brand display face (wordmark + headings); IBM Plex Sans
    // stays for body copy, where Orbitron's wide geometric forms hurt readability.
    heading: `'Orbitron', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
    body:    `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  styles: {
    global: {
      // Belt and braces with the color-scheme declared on <html> in index.html:
      // that one covers first paint before CSS arrives, this one survives if
      // the prerendered shell is ever regenerated without it.
      ':root': {
        colorScheme: 'dark',
      },
      body: {
        bg: 'bg.body',
        color: 'text.primary',
        lineHeight: 'tall',
      },
      '::selection': {
        bg: 'brand.700',
        color: 'white',
      },
      // Note: deliberately NO styling on `select option`.
      //
      // The dropdown list is drawn by the OS, outside the Emotion-styled tree,
      // and browsers apply `color` there far more reliably than they apply
      // `background`. Setting both gets you light text on the OS's white popup
      // when the background is dropped — worse than leaving it alone. Native
      // popups also follow the OS light/dark setting on their own, so an
      // unstyled option is readable either way and a styled one is a coin flip.
      //
      // If this dropdown ever needs to match the dark UI properly, the fix is
      // to stop using a native <select> — Chakra's Menu renders real DOM and
      // is fully styleable — not to push harder on CSS the browser ignores.
      // Honor the OS reduced-motion preference everywhere: CSS transitions and
      // keyframe animations collapse to ~instant, so hover lifts and reveals
      // snap to their end state instead of moving. JS-driven motion (Framer,
      // the StarField canvas) is handled at those components directly.
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'brand' },
    },
    Input: {
      variants: { outline: { field: controlField } },
    },
    // Nothing renders a native <select> today — the launch filters use a Menu,
    // because a native dropdown's list is drawn by the OS and can't be styled
    // to match a dark UI. Kept anyway: it's one line sharing controlField, and
    // a native select is still the right call anywhere the mobile OS picker is
    // wanted (a settings form, say).
    Select: {
      variants: { outline: { field: controlField } },
    },
    // Chakra's Menu defaults to a white list. Every semantic token in this
    // file deliberately has matching default/_dark values, so component
    // defaults that switch on color mode can't be relied on — same reason
    // Modal and Drawer carry explicit bg overrides below.
    Menu: {
      baseStyle: {
        list: {
          bg: 'bg.elevated',
          borderColor: 'border.control',
          boxShadow: 'dark-lg',
          py: 1,
          zIndex: 'dropdown',
        },
        item: {
          // Load-bearing: without it each row keeps Chakra's light default and
          // the list is striped white however the container is styled.
          bg: 'transparent',
          color: 'text.primary',
          _hover: { bg: 'whiteAlpha.100' },
          _focus: { bg: 'whiteAlpha.100' },
          _active: { bg: 'whiteAlpha.200' },
        },
        divider: { borderColor: 'border.default' },
        groupTitle: { color: 'text.secondary' },
      },
    },
    Divider: {
      baseStyle: { borderColor: 'border.default', opacity: 1 },
    },
    // Chakra's subtle Alert is a pale `${colorScheme}.100` panel in light mode
    // and a transparentized tint in dark — either way it's a foreign surface
    // dropped into this palette. Rebuilt from the app's own tokens so empty
    // states, errors, and toasts read as part of the site.
    //
    // Status still has to be legible at a glance (ErrorState uses warning for
    // a countdown hold and error for a failure), so the meaning moves to the
    // icon and a coloured left edge rather than the whole fill.
    Alert: {
      variants: {
        subtle: ({ colorScheme }) => ({
          container: {
            bg: 'bg.card',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'border.default',
            borderLeftWidth: '3px',
            borderLeftColor: `${colorScheme}.400`,
          },
          icon: { color: `${colorScheme}.300` },
          title: { color: 'text.primary' },
          description: { color: 'text.secondary' },
        }),
      },
    },
    Modal: {
      baseStyle: {
        dialog: { bg: 'bg.card' },
      },
    },
    Drawer: {
      baseStyle: {
        dialog: { bg: 'bg.card' },
      },
    },
  },
});

export default theme;
