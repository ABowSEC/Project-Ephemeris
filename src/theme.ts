import { extendTheme } from '@chakra-ui/react';
import type { StyleFunctionProps } from '@chakra-ui/theme-tools';
import { withAlpha } from './utils/color';

const colors = {
  // Brand teal (#2DD4BF), anchored at 200 since that's what Chakra's dark
  // buttons use. Lower shades are deeper: 300 for links, 400 for small labels.
  // Teal means "you can act on this" or "this is selected", nothing else.
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
  // Amber for things the visitor chose (tracked launches, alerts). Caution
  // uses orange.400, never orange.300, which is too close to amber's hue.
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
  // Logo colors
  accent: {
    teal:     '#2DD4BF',
    tealLight:'#C7EFEA',
    amber:    '#F5B942',
    terminal: '#00FF9D',
    hal:      '#FF3B30',
    ink:      '#0F1115',
    muted:    '#8B93A7',
  },
};

const semanticTokens = {
  colors: {
    // Near-neutral surfaces so the photography and signal colors carry the color
    'bg.body':     { default: '#0A0B0D', _dark: '#0A0B0D' },
    'bg.card':     { default: '#131518', _dark: '#131518' },
    'bg.elevated': { default: '#1B1E22', _dark: '#1B1E22' },
    // 17.4:1 on bg.body, 14.8:1 on bg.elevated
    'text.primary':   { default: '#F0F0FA', _dark: '#F0F0FA' },
    // 8.1:1 on bg.body, 6.9:1 on bg.elevated
    'text.secondary': { default: '#A2A6AD', _dark: '#A2A6AD' },
    'border.default': { default: '#2A2E34', _dark: '#2A2E34' },
    // Brighter than border.default so inputs have a visible edge (meets the
    // 3:1 WCAG contrast for UI boundaries).
    'border.control':      { default: '#6E747D', _dark: '#6E747D' },
    'border.controlHover': { default: '#8A9099', _dark: '#8A9099' },
    'brand.primary':  { default: 'brand.200' },
    // One meaning each: teal = interactive, terminal = live right now,
    // amber = tracked, orange = stale/hold, red = scrub/failure/error.
    // Always paired with a word and an icon.
    'accent.primary':  { default: 'accent.teal' },
    'accent.terminal': { default: 'accent.terminal' },
    'accent.tracked':  { default: 'accent.amber' },
    'accent.stale':    { default: 'orange.400' },
    'accent.danger':   { default: 'accent.hal' },
  },
};

// Shared input/select styling. On the `outline` variant (not baseStyle) so
// MissionTerminal's unstyled input isn't affected. Attached to Input and
// Select separately because Select doesn't inherit Input's variants.
const controlField = {
  bg: 'bg.elevated',
  borderColor: 'border.control',
  borderRadius: 'sm',
  color: 'text.primary',
  // Chakra's default placeholder fails 4.5:1 contrast; this passes.
  _placeholder: { color: 'text.secondary' },
  _hover: { borderColor: 'border.controlHover' },
  // The stock focus ring is a framework blue
  _focusVisible: {
    borderColor: 'brand.200',
    boxShadow: '0 0 0 1px var(--chakra-colors-brand-200)',
  },
};

// Small uppercase label shared by buttons, badges, nav links and stat labels
const labelText = {
  fontFamily: 'body',
  fontWeight: '600',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
} as const;

// Uppercase Barlow, for hero titles and major section transitions only
const headlineText = {
  fontFamily: 'headline',
  fontWeight: '700',
  fontSize: ['28px', '32px', '44px'],
  lineHeight: '1.1',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
} as const;

const config = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
} as const;

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts: {
    // Plex for headings and body. Barlow (headline) for uppercase section
    // titles. Orbitron (display) for the wordmark and Home tagline only.
    heading:  `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
    body:     `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
    headline: `'Barlow', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
    display:  `'Orbitron', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  shadows: {
    // Focus ring for every component: a 2px gap, then a 2px teal ring, so it
    // shows on outline buttons too
    outline: '0 0 0 2px var(--chakra-colors-bg-body), 0 0 0 4px var(--chakra-colors-brand-200)',
  },
  textStyles: {
    headline: headlineText,
    label: labelText,
    telemetry: {
      fontFamily: 'mono',
      fontVariantNumeric: 'tabular-nums',
    },
  },
  layerStyles: {
    // Flat data-view surface: no shadow, no hover lift
    card: {
      bg: 'bg.card',
      border: '1px solid',
      borderColor: 'border.default',
      borderRadius: 'sm',
    },
    // The only allowed gradient: a scrim so text on photos stays readable
    scrim: {
      bgImage: `linear-gradient(to right, ${withAlpha('bg.body', 95)} 25%, ${withAlpha('bg.body', 60)} 55%, ${withAlpha('bg.body', 20)})`,
    },
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
    // Outline by default. Only the brand scheme goes monochrome; amber and red
    // buttons keep their color because there it's the meaning. `solid` stays
    // teal for a page's one key call to action.
    Button: {
      baseStyle: {
        ...labelText,
        borderRadius: 'sm',
      },
      sizes: {
        md: { fontSize: '12px' },
        sm: { fontSize: '11px' },
        xs: { fontSize: '10px' },
      },
      variants: {
        outline: ({ colorScheme }: StyleFunctionProps) =>
          colorScheme === 'brand'
            ? {
                color: 'text.primary',
                borderColor: 'text.primary',
                _hover: { bg: 'whiteAlpha.100' },
                _active: { bg: 'whiteAlpha.200' },
              }
            : {
                color: `${colorScheme}.200`,
                borderColor: `${colorScheme}.200`,
                _hover: { bg: 'whiteAlpha.100' },
                _active: { bg: 'whiteAlpha.200' },
              },
      },
      defaultProps: { colorScheme: 'brand', variant: 'outline' },
    },
    Badge: {
      baseStyle: {
        ...labelText,
        fontSize: '10px',
        letterSpacing: '0.08em',
        borderRadius: 'sm',
      },
    },
    // Slight negative tracking for Plex headings; long mission names wrap
    // anywhere rather than overflow. `section` is the uppercase Barlow headline.
    Heading: {
      baseStyle: { fontWeight: '600', letterSpacing: '-0.01em', overflowWrap: 'anywhere' },
      variants: {
        // Spelled out (not textStyle) so Heading's size can't override fontSize
        section: headlineText,
      },
    },
    Input: {
      variants: { outline: { field: controlField } },
    },
    // Unused today (filters use Menu), but cheap to keep for future forms.
    Select: {
      variants: { outline: { field: controlField } },
    },
    // Chakra's Menu defaults to white, so set dark colors explicitly (same
    // for Modal and Drawer below). A border separates it, not a shadow.
    Menu: {
      baseStyle: {
        list: {
          bg: 'bg.elevated',
          borderColor: 'border.control',
          borderRadius: 'sm',
          boxShadow: 'none',
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
        subtle: ({ colorScheme }: StyleFunctionProps) => ({
          container: {
            bg: 'bg.card',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'border.default',
            borderLeftWidth: '3px',
            borderLeftColor: `${colorScheme}.400`,
            borderRadius: 'sm',
          },
          icon: { color: `${colorScheme}.300` },
          title: { color: 'text.primary' },
          description: { color: 'text.secondary' },
        }),
      },
    },
    Modal: {
      baseStyle: {
        dialog: { bg: 'bg.card', borderRadius: 'sm' },
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
