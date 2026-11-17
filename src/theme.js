import { extendTheme } from '@chakra-ui/react';

const colors = {
  // Brand teal (#2DD4BF), anchored at 200 since that's what Chakra's dark
  // buttons use. Lower shades are deeper: 300 for links, 400 for small labels.
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
  // Amber for things the visitor chose (tracked launches, alerts). Warnings
  // stay orange so the two don't get confused.
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
  // Logo colors, e.g. bgGradient="linear(to-r, accent.teal, accent.purple)".
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
    // Brighter than border.default so inputs have a visible edge (meets the
    // 3:1 WCAG contrast for UI boundaries).
    'border.control':      { default: '#6E747D', _dark: '#6E747D' },
    'border.controlHover': { default: '#8A9099', _dark: '#8A9099' },
    'brand.primary':  { default: 'brand.200' },
    // Green = live data only, teal = interactive, red = scrub/hold/error.
    'accent.primary':   { default: 'accent.teal' },
    'accent.secondary': { default: 'accent.purple' },
    'accent.terminal':  { default: 'accent.terminal' },
    'accent.danger':    { default: 'accent.hal' },
    // Amber marks what the visitor chose to follow (tracked launches, alerts)
    'accent.tracked':   { default: 'accent.amber' },
  },
};

// Shared input/select styling. On the `outline` variant (not baseStyle) so
// MissionTerminal's unstyled input isn't affected. Attached to Input and
// Select separately because Select doesn't inherit Input's variants.
const controlField = {
  bg: 'bg.elevated',
  borderColor: 'border.control',
  color: 'text.primary',
  // Chakra's default placeholder fails 4.5:1 contrast; this passes.
  _placeholder: { color: 'text.secondary' },
  _hover: { borderColor: 'border.controlHover' },
  // The stock outline focus ring is blue.300, one of the framework blues the
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
    // Plex for headings and body. Orbitron is only for brand text (wordmark,
    // tagline, short labels); long mission names were too loud in it.
    heading: `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
    body:    `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
    display: `'Orbitron', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  styles: {
    global: {
      // Also set on <html> in index.html for first paint.
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
      // No styling on `select option` on purpose: the OS draws that popup and
      // ignores some CSS, which can leave it unreadable.
      //
      // Reduced motion: collapse CSS transitions and animations. JS-driven
      // motion is handled in those components.
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
    // Plex at heading sizes reads slightly loose; a touch of negative tracking
    // tightens it without changing the face
    Heading: {
      baseStyle: { fontWeight: '600', letterSpacing: '-0.01em' },
    },
    Input: {
      variants: { outline: { field: controlField } },
    },
    // Unused today (filters use Menu), but cheap to keep for future forms.
    Select: {
      variants: { outline: { field: controlField } },
    },
    // Chakra's Menu defaults to white, so set dark colors explicitly (same
    // for Modal and Drawer below).
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
    // Restyle Alert to fit the palette. Status shows through the icon and a
    // colored left border instead of the whole background.
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
