import { Badge, Box, HStack, type BadgeProps, type BoxProps } from '@chakra-ui/react';
import { Check, Pause, TriangleAlert, X } from 'lucide-react';
import { statusStyle, TONE_COLORS, type StatusStyle } from '../data/launchStatus';
import type { LaunchStatus } from '../types/launchLibrary';

// Fixed size presets so call sites stay consistent.
const SIZES = {
  /** Compact rows (Home's coming-up list, the launches hero). */
  xs: { fontSize: '10px', px: 1.5, py: 0.5 },
  /** LaunchDetailPage's hero badge. */
  sm: { px: 2, py: 0.5 },
  /** LaunchFeed's card corner badge. */
  md: { px: 2, py: 1 },
  /** CountdownDisplay's flown/window-open badge. */
  lg: { fontSize: 'sm', px: 4, py: 2 },
} as const;

export interface StatusBadgeProps extends Omit<BadgeProps, 'colorScheme' | 'children'> {
  status: LaunchStatus | null | undefined;
  /** Override the displayed text (e.g. "Launch window open") while keeping the status's color. */
  label?: string;
  size?: keyof typeof SIZES;
}

/**
 * A launch's status: an outline badge, neutral unless the status means
 * something. Signal colors always come with an icon, never color alone.
 */
export default function StatusBadge({ status, label, size = 'md', ...props }: StatusBadgeProps) {
  const style = statusStyle(status);
  const { color, borderColor } = TONE_COLORS[style.tone];
  return (
    <Badge
      variant="outline"
      bg="blackAlpha.600"
      color={color}
      boxShadow="none"
      border="1px solid"
      borderColor={borderColor}
      title={style.label}
      {...SIZES[size]}
      {...props}
    >
      <HStack as="span" spacing={1.5}>
        <StatusIcon style={style} />
        <span>{label ?? style.short}</span>
      </HStack>
    </Badge>
  );
}

function StatusIcon({ style }: { style: StatusStyle }) {
  const props = { size: '1.1em', strokeWidth: 2.5, 'aria-hidden': true } as const;
  if (style.tone === 'live') {
    return (
      <Box
        as="span"
        display="inline-block"
        w="6px"
        h="6px"
        borderRadius="full"
        bg="accent.terminal"
        sx={{
          animation: 'statusPulse 1.6s ease-in-out infinite',
          '@keyframes statusPulse': { '50%': { opacity: 0.35 } },
        }}
      />
    );
  }
  if (style.tone === 'danger') return <X {...props} />;
  if (style.short === 'Hold') return <Pause {...props} />;
  if (style.tone === 'caution') return <TriangleAlert {...props} />;
  if (style.short === 'Success') return <Check {...props} />;
  return null;
}

/** The map/list dot variant: a colored circle with the status as its tooltip, no text. */
export function StatusDot({
  status,
  ...props
}: { status: LaunchStatus | null | undefined } & BoxProps) {
  const style = statusStyle(status);
  return (
    <Box w="8px" h="8px" borderRadius="full" flexShrink={0} bg={style.dot} title={style.label} {...props} />
  );
}
