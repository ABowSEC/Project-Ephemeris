/**
 * A theme color token at partial opacity, via color-mix so it follows the
 * theme. The result has commas, so use it with `bg` or a raw CSS gradient,
 * not Chakra's `bgGradient` (which splits on commas).
 */
export function withAlpha(token: string, percent: number): string {
  return `color-mix(in srgb, var(--chakra-colors-${token.replace(/\./g, '-')}) ${percent}%, transparent)`;
}
