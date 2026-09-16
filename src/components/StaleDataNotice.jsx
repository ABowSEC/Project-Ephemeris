import { useState } from 'react';
import { Button, HStack, Icon, Text } from '@chakra-ui/react';
import { FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';

/**
 * Small inline warning for when launch data is old enough that presenting it
 * as current would be misleading - see useUpcomingLaunches' `stale` flag,
 * which only trips after a sustained run of failed refetches (a routine
 * refresh delay never reaches its threshold). Renders nothing when not
 * stale, so call sites can drop it in unconditionally.
 *
 * Pass `onRefresh` (e.g. useUpcomingLaunches' `refresh`) to offer a manual
 * retry against the proxy. Whether it actually lands fresh data isn't
 * something this component decides: `stale` and `fetchedAt` come from the
 * hook again on the next render, so the notice itself either updates its
 * "last updated" time or disappears once fetchedAt moves.
 */
export default function StaleDataNotice({ stale, fetchedAt, onRefresh, ...props }) {
  const [refreshing, setRefreshing] = useState(false);

  if (!stale) return null;

  const minutesAgo = fetchedAt != null ? Math.round((Date.now() - fetchedAt) / 60000) : null;

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <HStack spacing={1.5} color="orange.300" fontSize="xs" {...props}>
      <Icon as={FaExclamationTriangle} boxSize={2.5} flexShrink={0} />
      <Text>
        Data may be outdated{minutesAgo != null ? `, last updated ${minutesAgo} min ago` : ''}
      </Text>
      {onRefresh && (
        <Button
          size="xs"
          variant="link"
          color="orange.200"
          leftIcon={<Icon as={FaSyncAlt} boxSize={2.5} />}
          onClick={handleRefresh}
          isLoading={refreshing}
          loadingText="Refreshing"
        >
          Refresh
        </Button>
      )}
    </HStack>
  );
}
