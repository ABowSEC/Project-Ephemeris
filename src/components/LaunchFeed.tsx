import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  HStack,
  Image,
  LinkBox,
  LinkOverlay,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useUpcomingLaunches } from '../hooks/useUpcomingLaunches';
import LaunchFilters from './LaunchFilters';
import AlertSettings from './AlertSettings';
import { useLaunchFilters } from '../hooks/useLaunchFilters';
import TrackButton from './TrackButton';
import ProviderMark from './ProviderMark';
import { LaunchName } from './LaunchHero';
import CalendarMenu from './launch/CalendarMenu';
import ErrorState from './ErrorState';
import StatusBadge from './StatusBadge';
import { MapPin } from 'lucide-react';
import { formatNetShort, launchImageUrl, launchPath, providerName, shortSite } from '../utils/launchFields';
import { useLaunchCountdown } from '../hooks/useCountdown';
import type { LaunchListItem } from '../types/launchLibrary';
import { withAlpha } from '../utils/color';

const MotionBox = motion(Box);
const MotionImage = motion(Image);

// Cards shown before "show more". Fewer images to load on phones.
const PAGE_SIZE = 12;

/** One-line timing: "T-2d 8h" (or NET) then the short date. */
function CardTiming({ launch }: { launch: LaunchListItem }) {
  const countdown = useLaunchCountdown(launch);

  // Seconds only matter once the launch is close enough to watch for
  const lead = !countdown
    ? null
    : countdown.d > 0
      ? `T-${countdown.d}d ${countdown.h}h`
      : `T-${countdown.h}h ${countdown.m}m ${String(countdown.s).padStart(2, '0')}s`;

  return (
    <HStack spacing={2} minW={0} fontSize="sm">
      {lead && (
        <Text as="span" textStyle="telemetry" fontWeight="500" color="text.primary" flexShrink={0}>
          {lead}
        </Text>
      )}
      <Text as="span" color="text.secondary" noOfLines={1}>
        {formatNetShort(launch, { weekday: !lead })}
      </Text>
    </HStack>
  );
}

/** One launch in the list. Details live on /launches/<slug>. */
interface LaunchCardProps {
  launch: LaunchListItem;
  index?: number;
  reduceMotion?: boolean;
}

function LaunchCard({ launch, index = 0, reduceMotion = false }: LaunchCardProps) {
  const provider = providerName(launch);
  const image = launchImageUrl(launch);
  const site = shortSite(launch);

  return (
    <LinkBox
      as={MotionBox}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut', delay: (index % 3) * 0.05 } }}
      viewport={{ once: true, margin: '-60px' }}
      layerStyle="card"
      overflow="hidden"
      position="relative"
      data-group
      transition="border-color 0.15s"
      _hover={{ borderColor: 'border.controlHover' }}
    >
      <Box position="relative" h={{ base: '136px', md: '150px' }} overflow="hidden">
        {image ? (
          <MotionImage
            src={image}
            alt=""
            w="100%"
            h="100%"
            objectFit="cover"
            fallback={<Box h="100%" bg="bg.elevated" />}
            transition="transform 0.7s ease"
            _groupHover={reduceMotion ? undefined : { transform: 'scale(1.04)' }}
          />
        ) : (
          <Box h="100%" w="100%" bg="bg.elevated" />
        )}

        {/* Scrim: light at the top for the buttons, dark at the bottom for the name */}
        <Box
          position="absolute"
          inset={0}
          bgImage={`linear-gradient(to bottom, ${withAlpha('bg.body', 45)} 0%, ${withAlpha('bg.body', 10)} 35%, ${withAlpha('bg.body', 92)} 100%)`}
        />

        <Box position="absolute" top={3} left={3} zIndex={3}>
          <StatusBadge status={launch.status} size="sm" />
        </Box>

        {/* Above the LinkOverlay so using them doesn't navigate */}
        <HStack position="absolute" top={1} right={1} spacing={0} zIndex={3} color="text.primary">
          <CalendarMenu launch={launch} />
          <TrackButton launch={launch} />
        </HStack>

        <HStack position="absolute" bottom={0} left={0} right={0} p={3} spacing={3} align="center" zIndex={2}>
          <ProviderMark name={provider} size={36} />
          <VStack align="start" spacing={0} flex={1} minW={0}>
            <Text fontSize="md" fontWeight="600" color="text.primary" lineHeight="1.3" noOfLines={2} title={launch.name}>
              <LaunchName name={launch.name} clamped />
            </Text>
            <Text fontSize="xs" color="text.secondary" noOfLines={1}>
              {provider ?? 'Unknown provider'}
            </Text>
          </VStack>
        </HStack>
      </Box>

      <HStack justify="space-between" spacing={3} px={4} py={3}>
        <CardTiming launch={launch} />
        {site && (
          <HStack spacing={1} color="text.secondary" fontSize="sm" minW={0} flexShrink={1}>
            <Box as={MapPin} boxSize="13px" flexShrink={0} aria-hidden="true" />
            <Text as="span" noOfLines={1}>{site}</Text>
          </HStack>
        )}
      </HStack>

      {/* Whole-card click target. A direct child of LinkBox so it covers the
          card, not just the image box. */}
      <LinkOverlay
        as={RouterLink}
        to={launchPath(launch)}
        aria-label={launch.name}
        position="absolute"
        inset={0}
        zIndex={2}
        borderRadius="inherit"
      />
    </LinkBox>
  );
}

export default function LaunchFeed() {
  const { launches, loading, error, refetch } = useUpcomingLaunches();
  const filters = useLaunchFilters(launches);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const reduceMotion = useReducedMotion();

  if (loading) {
    return (
      <VStack spacing={6} py={10}>
        <Spinner size="xl" color="brand.primary" thickness="4px" />
        <Text color="text.secondary">Loading upcoming launches...</Text>
      </VStack>
    );
  }

  if (error) {
    return <ErrorState title="Launch schedule temporarily unavailable" message={error} onRetry={refetch} />;
  }

  const shown = filters.filtered.slice(0, visible);

  return (
    <VStack spacing={6} align="stretch">
      <LaunchFilters state={filters} trackingControls={<AlertSettings />} />

      {shown.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          <Box>
            <AlertTitle>
              {filters.activeCount > 0 ? 'No launches match these filters' : 'No upcoming launches found'}
            </AlertTitle>
            <AlertDescription>
              {filters.activeCount > 0
                ? 'Try widening the timeframe or clearing a filter.'
                : 'Check back later for new launch schedules.'}
            </AlertDescription>
          </Box>
        </Alert>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={{ base: 3, md: 5 }}>
            {shown.map((launch, index) => (
              <LaunchCard
                key={launch.id}
                launch={launch}
                index={index}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </SimpleGrid>

          {filters.filtered.length > shown.length && (
            <Button
              alignSelf="center"
              variant="outline"
              colorScheme="brand"
              onClick={() => setVisible((n) => n + PAGE_SIZE)}
            >
              Show more ({filters.filtered.length - shown.length} remaining)
            </Button>
          )}
        </>
      )}

      {/* One quiet footnote; data credits live in the site footer */}
      <Text fontSize="xs" color="text.secondary" textAlign="center" pt={2}>
        Times in your timezone, subject to change for weather, technical issues, or range conflicts
      </Text>
    </VStack>
  );
}
