import { Badge, Box, HStack, Text, VStack } from '@chakra-ui/react';
import { useCountdown } from '../../hooks/useCountdown';
import { formatNet, hasPreciseTime, launchTime } from '../../utils/launchFields';
import { hasFlown, statusStyle } from '../../data/launchStatus';
import type { AnyLaunch } from '../../types/launchLibrary';

/**
 * The mission-control countdown, lifted out of LaunchPage so the detail page
 * shows exactly the same clock rather than a third implementation of it.
 * (There were two before this: the useCountdown hook and a hand-rolled
 * setInterval inside LaunchFeed's card.)
 *
 * It also refuses to tick when the T-0 is not real. A launch pinned only to a
 * month gets a "NET August 2026" line instead of a to-the-second clock that
 * implies a precision the data does not have.
 */
export default function CountdownDisplay({
  launch,
  size = 'lg',
}: {
  launch: AnyLaunch;
  size?: 'sm' | 'lg';
}) {
  const target = launchTime(launch);
  const countdown = useCountdown(hasPreciseTime(launch) ? target : null);
  const flown = hasFlown(launch.status);
  const style = statusStyle(launch.status);

  if (flown) {
    return (
      <Badge colorScheme={style.colorScheme} px={5} py={2} fontSize="sm" rounded="full" variant="subtle">
        {style.label}
      </Badge>
    );
  }

  if (!countdown) {
    // Either the window has opened (T-0 passed, no confirmed outcome yet) or
    // the date is too vague to count down to. Both want words, not digits.
    return (
      <VStack spacing={1}>
        <Badge colorScheme={style.colorScheme} px={5} py={2} fontSize="sm" rounded="full" variant="subtle">
          {hasPreciseTime(launch) ? 'Launch window open' : style.label}
        </Badge>
        <Text fontSize="xs" color="text.secondary" fontFamily="mono">
          {formatNet(launch)}
        </Text>
      </VStack>
    );
  }

  return (
    <HStack spacing={1} align="flex-start">
      <CountdownBlock value={countdown.d} label="Days" size={size} />
      <CountdownSeparator size={size} />
      <CountdownBlock value={countdown.h} label="Hrs" size={size} />
      <CountdownSeparator size={size} />
      <CountdownBlock value={countdown.m} label="Min" size={size} />
      <CountdownSeparator size={size} />
      <CountdownBlock value={countdown.s} label="Sec" size={size} />
    </HStack>
  );
}

function CountdownBlock({
  value,
  label,
  size,
}: {
  value: number;
  label: string;
  size: 'sm' | 'lg';
}) {
  const large = size === 'lg';
  return (
    <VStack spacing={0} align="center">
      <Box
        bg="rgba(0,255,157,0.05)"
        border="1px solid"
        borderColor="rgba(0,255,157,0.25)"
        rounded="lg"
        px={large ? { base: 3, md: 4 } : 2.5}
        py={large ? { base: 2, md: 3 } : 1.5}
        minW={large ? { base: '56px', md: '72px' } : '48px'}
        textAlign="center"
      >
        <Text
          fontSize={large ? { base: '2xl', md: '4xl' } : 'xl'}
          fontWeight="bold"
          fontFamily="mono"
          color="accent.terminal"
          lineHeight="1"
        >
          {String(value).padStart(2, '0')}
        </Text>
      </Box>
      <Text
        fontSize="9px"
        color="text.secondary"
        letterSpacing="widest"
        mt={1.5}
        fontWeight="semibold"
        textTransform="uppercase"
      >
        {label}
      </Text>
    </VStack>
  );
}

function CountdownSeparator({ size }: { size: 'sm' | 'lg' }) {
  return (
    <Text
      color="rgba(0,255,157,0.35)"
      fontSize={size === 'lg' ? { base: 'xl', md: '3xl' } : 'md'}
      fontFamily="mono"
      mb={4}
      userSelect="none"
    >
      :
    </Text>
  );
}
