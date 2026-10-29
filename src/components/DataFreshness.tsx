import { useEffect, useState } from 'react';
import { Button, HStack, Icon, Text, type StackProps } from '@chakra-ui/react';
import { FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';
import { STALE_WARNING_MS } from '../hooks/useUpcomingLaunches';

// Past this age the timestamp turns amber and offers a manual refresh: the
// scheduled refresh has missed a day of runs, though the data is still
// probably usable.
const AGING_MS = 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / MINUTE_MS);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

interface DataFreshnessProps extends StackProps {
  fetchedAt: number | null;
  onRefresh?: () => Promise<void>;
}

/**
 * Shows when the launch data was last updated, escalating with its age: a
 * quiet gray timestamp normally, amber with a Refresh link once it's a day
 * old, and an outright warning past STALE_WARNING_MS. Renders nothing until
 * there's data, so call sites can drop it in unconditionally.
 *
 * `fetchedAt` comes from useUpcomingLaunches, so a successful refresh moves
 * it and the indicator settles back to gray on the next render.
 */
export default function DataFreshness({ fetchedAt, onRefresh, ...props }: DataFreshnessProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Keeps "12 min ago" ticking between refetches.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(id);
  }, []);

  if (fetchedAt == null) return null;

  const age = Math.max(0, now - fetchedAt);
  const stale = age > STALE_WARNING_MS;
  const aging = age > AGING_MS;

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <HStack spacing={1.5} color={aging ? 'orange.300' : 'gray.500'} fontSize="xs" {...props}>
      <Icon as={stale ? FaExclamationTriangle : FaSyncAlt} boxSize={2.5} flexShrink={0} />
      <Text>
        {stale
          ? `Data may be outdated · last updated ${formatAge(age)}`
          : `Updated ${formatAge(age)}`}
      </Text>
      {aging && onRefresh && (
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
