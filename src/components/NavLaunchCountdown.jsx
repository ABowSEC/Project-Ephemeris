import { Link as RouterLink } from 'react-router-dom';
import { Box, HStack, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useUpcomingLaunches } from '../hooks/useUpcomingLaunches';
import { useCountdown } from '../hooks/useCountdown';

// Radar ping: the dot stays lit and emits a soft expanding ring, reading
// as a live signal rather than a blinking light
const ping = keyframes`
  0%   { box-shadow: 0 0 6px rgba(0,255,157,0.6), 0 0 0 0    rgba(0,255,157,0.45); }
  70%  { box-shadow: 0 0 6px rgba(0,255,157,0.6), 0 0 0 8px  rgba(0,255,157,0); }
  100% { box-shadow: 0 0 6px rgba(0,255,157,0.6), 0 0 0 0    rgba(0,255,157,0); }
`;

// Console-style T-minus readout. Seconds only show inside 24h, where the
// live tick earns its place; further out, minutes are enough.
function formatCountdown({ d, h, m, s }) {
  const pad = (n) => String(n).padStart(2, '0');
  if (d > 0) return `T-${d}d ${pad(h)}:${pad(m)}`;
  return `T-${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function NavLaunchCountdown() {
  // Errors are deliberately not rendered: the readout is decorative, so on
  // failure we keep showing the last good launch or hide entirely.
  const { launches, loading, stale } = useUpcomingLaunches();
  const nextLaunch = launches[0] ?? null;
  const timeLeft = useCountdown(nextLaunch?.window_start);

  const name = nextLaunch?.name ?? null;

  const countdownText = timeLeft
    ? formatCountdown(timeLeft)
    : loading
    ? '...'
    : null;

  // Only hide if we've finished loading and got nothing back
  if (!loading && !nextLaunch) return null;

  return (
    <HStack
      as={RouterLink}
      to="/launches"
      spacing={2.5}
      flexShrink={0}
      px={2.5}
      py={1}
      rounded="md"
      transition="background 0.2s"
      _hover={{ bg: 'whiteAlpha.50', textDecoration: 'none' }}
      title={stale ? 'Launch data may be outdated — we\'re having trouble refreshing it' : undefined}
    >
      <Box
        boxSize="6px"
        rounded="full"
        bg={stale ? 'orange.300' : 'accent.terminal'}
        // The ping reads as "live" — don't play it over data we can't
        // currently confirm is, since that itself would be misleading.
        animation={stale ? undefined : `${ping} 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite`}
        flexShrink={0}
      />

      {name && (
        <Text
          fontSize="xs"
          color="text.secondary"
          display={{ base: 'none', lg: 'block' }}
          maxW="180px"
          isTruncated
        >
          {name}
        </Text>
      )}

      {countdownText && (
        <Text
          fontSize="xs"
          fontWeight="600"
          color="accent.terminal"
          fontFamily="mono"
          whiteSpace="nowrap"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {countdownText}
        </Text>
      )}
    </HStack>
  );
}
