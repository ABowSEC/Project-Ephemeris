import { Badge, Box, type BadgeProps, type BoxProps } from '@chakra-ui/react';
import { statusStyle } from '../data/launchStatus';
import type { LaunchStatus } from '../types/launchLibrary';

// Each size mirrors an exact padding/fontSize combo that used to be
// hand-copied at its one call site — kept as presets rather than free-form
// props so new call sites pick one of four known-good sizes instead of
// inventing a fifth.
const SIZES = {
  /** LaunchPage's nav-adjacent status pill. */
  xs: { fontSize: '10px', px: 2, py: 0.5 },
  /** LaunchDetailPage's hero badge. */
  sm: { px: 3, py: 0.5 },
  /** LaunchFeed's card corner badge. */
  md: { px: 3, py: 1 },
  /** CountdownDisplay's flown/window-open badge. */
  lg: { fontSize: 'sm', px: 5, py: 2 },
} as const;

export interface StatusBadgeProps extends Omit<BadgeProps, 'colorScheme' | 'children'> {
  status: LaunchStatus | null | undefined;
  /** Override the displayed text (e.g. "Launch window open") while keeping the status's color. */
  label?: string;
  size?: keyof typeof SIZES;
}

/** A launch's status, styled consistently everywhere it appears. */
export default function StatusBadge({ status, label, size = 'md', ...props }: StatusBadgeProps) {
  const style = statusStyle(status);
  return (
    <Badge colorScheme={style.colorScheme} variant="subtle" rounded="full" {...SIZES[size]} {...props}>
      {label ?? style.label}
    </Badge>
  );
}

/** The map/list dot variant — a colored circle with the status as its tooltip, no text. */
export function StatusDot({
  status,
  ...props
}: { status: LaunchStatus | null | undefined } & BoxProps) {
  const style = statusStyle(status);
  return (
    <Box w="8px" h="8px" borderRadius="full" flexShrink={0} bg={style.dot} title={style.label} {...props} />
  );
}
