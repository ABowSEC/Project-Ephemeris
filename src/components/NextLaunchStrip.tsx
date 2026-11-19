import { Link as RouterLink } from 'react-router-dom';
import { Box, Flex, HStack, Image, LinkBox, LinkOverlay, Skeleton, Text, VStack } from '@chakra-ui/react';
import { ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import DataFreshness from './DataFreshness';
import { useLaunchCountdown } from '../hooks/useCountdown';
import { formatNet, formatNetShort, launchImageUrl, launchPath, providerName, shortSite } from '../utils/launchFields';
import type { LaunchListItem } from '../types/launchLibrary';

const pad = (n: number) => String(n).padStart(2, '0');

/** "T-23:10:55", "T-2d 08:10:55", or the NET date when there's no precise T-0. */
function StripCountdown({ launch }: { launch: LaunchListItem }) {
  const countdown = useLaunchCountdown(launch);
  if (!countdown) {
    return (
      <Text textStyle="telemetry" fontSize="md" color="text.secondary">
        {formatNet(launch)}
      </Text>
    );
  }
  return (
    <Text
      textStyle="telemetry"
      fontSize={{ base: '22px', md: '34px' }}
      fontWeight="500"
      lineHeight="1"
      color="accent.terminal"
      aria-label={`Time to launch: ${countdown.d} days ${countdown.h} hours ${countdown.m} minutes`}
    >
      T-{countdown.d > 0 && `${countdown.d}d `}
      {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
    </Text>
  );
}

/** Compact next-launch row for the top of /launches. Links to the detail page. */
export default function NextLaunchStrip({
  launch,
  loading,
  fetchedAt,
  onRefresh,
}: {
  launch: LaunchListItem | null | undefined;
  loading: boolean;
  fetchedAt: number | null;
  onRefresh?: () => Promise<void>;
}) {
  if (loading) return <Skeleton h={{ base: '92px', md: '106px' }} rounded="sm" startColor="bg.card" endColor="bg.elevated" />;
  if (!launch) return null;

  const image = launchImageUrl(launch);
  const meta = [providerName(launch), shortSite(launch), formatNetShort(launch)].filter(Boolean).join(' · ');

  return (
    <LinkBox
      layerStyle="card"
      p={{ base: 3, md: 4 }}
      transition="border-color 0.15s"
      _hover={{ borderColor: 'border.controlHover' }}
    >
      <Flex align="center" gap={{ base: 3, md: 5 }} wrap={{ base: 'wrap', lg: 'nowrap' }}>
        {image && (
          <Image
            src={image}
            alt=""
            display={{ base: 'none', md: 'block' }}
            w="128px"
            h="72px"
            objectFit="cover"
            rounded="2px"
            flexShrink={0}
          />
        )}

        <VStack align="start" spacing={1} flex="1 1 280px" minW={0}>
          <HStack spacing={2.5}>
            <Text textStyle="label" fontSize="11px" color="text.secondary">
              Next launch
            </Text>
            <StatusBadge status={launch.status} size="xs" />
          </HStack>
          <LinkOverlay as={RouterLink} to={launchPath(launch)} _hover={{ textDecoration: 'none' }}>
            <Text fontSize={{ base: 'md', md: 'xl' }} fontWeight="600" lineHeight="1.3" color="text.primary">
              {launch.name}
            </Text>
          </LinkOverlay>
          <Text fontSize="sm" color="text.secondary" noOfLines={1} display={{ base: 'none', md: 'block' }}>
            {meta}
          </Text>
        </VStack>

        <VStack align={{ base: 'start', lg: 'end' }} spacing={1.5} flexShrink={0}>
          <StripCountdown launch={launch} />
          <Box position="relative" zIndex={1} display={{ base: 'none', md: 'block' }}>
            <DataFreshness fetchedAt={fetchedAt} onRefresh={onRefresh} />
          </Box>
        </VStack>

        <Box as={ArrowRight} boxSize={5} color="text.secondary" flexShrink={0} display={{ base: 'none', md: 'block' }} aria-hidden="true" />
      </Flex>
    </LinkBox>
  );
}
