import { HStack, Icon, Text } from '@chakra-ui/react';
import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * Small inline warning for when launch data is old enough that presenting it
 * as current would be misleading — see useUpcomingLaunches' `stale` flag,
 * which only trips after a sustained run of failed refetches (a routine
 * refresh delay never reaches its threshold). Renders nothing when not
 * stale, so call sites can drop it in unconditionally.
 */
export default function StaleDataNotice({ stale, fetchedAt, ...props }) {
  if (!stale) return null;

  const minutesAgo = fetchedAt != null ? Math.round((Date.now() - fetchedAt) / 60000) : null;

  return (
    <HStack spacing={1.5} color="orange.300" fontSize="xs" {...props}>
      <Icon as={FaExclamationTriangle} boxSize={2.5} flexShrink={0} />
      <Text>
        Data may be outdated{minutesAgo != null ? ` — last updated ${minutesAgo} min ago` : ''}
      </Text>
    </HStack>
  );
}
