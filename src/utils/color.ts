/**
 * A theme color token at partial opacity, as a CSS value.
 *
 * Overlays and translucent bars used to hard-code the background's RGB
 * (rgba(6, 9, 26, 0.8)), so changing bg.body in the theme left them behind.
 * color-mix reads the token's CSS variable instead, so they follow the theme.
 *
 * The result contains commas, so use it with `bg`/`bgImage` and a raw CSS
 * linear-gradient(...), not Chakra's `bgGradient` shorthand, which splits
 * its argument on commas.
 */
export function withAlpha(token: string, percent: number): string {
  return `color-mix(in srgb, var(--chakra-colors-${token.replace(/\./g, '-')}) ${percent}%, transparent)`;
}
