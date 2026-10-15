import { extendTheme } from '@chakra-ui/react';

const colors = {
  // Vivid brand teal (#2DD4BF), anchored at 200 because that is the shade
  // Chakra's dark-mode buttons fill with and outline/ghost text uses. Lower
  // shades are deeper, not brighter: 300 for links, 400 for small labels.
  // Buttons and links inherit it via colorScheme="brand"; nothing in the app
  // should reach for stock framework blues.
  brand: {
    50:  '#EBF9F8',
    100: '#C7EFEA',
    200: '#2DD4BF',
    300: '#2DB0A0',
    400: '#279889',
    500: '#207F73',
    600: '#1A665D',
    700: '#15524A',
    800: '#103F3A',
    900: '#0C2F2B',
  },
  // Amber (#F5B942, anchored at 200 like brand) for the things a visitor has
  // chosen: tracked launches and the alerts that follow them. Warnings
  // (stale data, holds) stay on Chakra's orange so the two never blur.
  amber: {
    50:  '#FCF5E9',
    100: '#F7E4C0',
    200: '#F5B942',
    300: '#E8A624',
    400: '#D09216',
    500: '#AE7A12',
    600: '#8D620F',
    700: '#714F0C',
    800: '#573D09',
    900: '#412D07',
  },
  // Brand palette from the Ephemeris logo sheet. Kept as named accents so the
  // teal→purple mark colors, the terminal-green and HAL-red variants can be
  // referenced directly (e.g. bgGradient="linear(to-r, accent.teal, accent.purple)").
  accent: {
    teal:     '#2DD4BF',
    tealLight:'#C7EFEA',
    amber:    '#F5B942',
    purple:   '#9F7AEA',
    terminal: '#00FF9D',
    hal:      '#FF3B30',
    ink:      '#0F1115',
    muted:    '#8B93A7',
  },
};

const semanticTokens = {
  colors: {
    // Mission black: near-neutral black and graphite surfaces, so the launch
    // photography and the teal accent carry the color, not the chrome.
    'bg.body':     { default: '#0A0B0D', _dark: '#0A0B0D' },
    'bg.card':     { default: '#131518', _dark: '#131518' },
    'bg.elevated': { default: '#1B1E22', _dark: '#1B1E22' },
    'text.primary':   { default: '#EEEEEE', _dark: '#EEEEEE' },
    // 8.1:1 on bg.body, 6.9:1 on bg.elevated
    'text.secondary': { default: '#A2A6AD', _dark: '#A2A6AD' },
    'border.default': { default: '#2A2E34', _dark: '#2A2E34' },
    // Interactive controls need a brighter edge than cards do. border.default
    // is a hairline by design, correct for panels, but too faint against the
    // control fill, so inputs and selects read as flat dark shapes with no
    // edge at all. These clear the 3:1 WCAG asks for a UI component boundary
    // (3.55:1 and 5.2:1 against bg.elevated) without making every card shout.
    'border.control':      { default: '#6E747D', _dark: '#6E747D' },
    'border.controlHover': { default: '#8A9099', _dark: '#8A9099' },
    'brand.primary':  { default: 'brand.200' },
    // Logo accents, exposed as semantic tokens for use across the UI.
    // Flight-console rules: terminal green marks LIVE data (countdowns,
    // telemetry, status dots) and nothing else; teal is for interactive
    // things; HAL red only ever means scrub/hold/error.
    'accent.primary':   { default: 'accent.teal' },
    'accent.secondary': { default: 'accent.purple' },
    'accent.terminal':  { default: 'accent.terminal' },
    'accent.danger':    { default: 'accent.hal' },
    // Amber marks what the visitor chose to follow (tracked launches, alerts)
    'accent.tracked':   { default: 'accent.amber' },
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
    borderColor: 'brand.200',
    boxShadow: '0 0 0 1px var(--chakra-colors-brand-200)',
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
