// Shared chip styling for the launch filter row (FilterSelect, Tracked, Alerts).

/** Chip-style control shared by the filter row: same height, radius and states. */
export const filterChip = {
  h: '44px',
  px: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
  borderRadius: { base: 'full', md: 'sm' },
  border: '1px solid',
  borderColor: 'border.control',
  bg: 'transparent',
  color: 'text.primary',
  fontSize: 'sm',
  fontWeight: '500',
  whiteSpace: 'nowrap',
  transition: 'border-color 0.15s, background 0.15s',
  _hover: { borderColor: 'border.controlHover', bg: 'whiteAlpha.50' },
} as const;

/** Teal edge and text for a filter that is switched on. */
export const filterChipActive = {
  borderColor: 'accent.primary',
  color: 'accent.primary',
  bg: 'rgba(45,212,191,0.08)',
  _hover: { borderColor: 'brand.100', bg: 'rgba(45,212,191,0.12)' },
} as const;
