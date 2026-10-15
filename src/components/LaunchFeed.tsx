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
import CalendarMenu from './launch/CalendarMenu';
import ErrorState from './ErrorState';
import StatusBadge from './StatusBadge';
import { formatNet, launchPath, providerName } from '../utils/launchFields';
import { useLaunchCountdown } from '../hooks/useCountdown';
import type { LaunchListItem } from '../types/launchLibrary';
import { withAlpha } from '../utils/color';

const MotionBox = motion(Box);
const MotionImage = motion(Image);

// How many cards to show before the "show more" button. The feed holds 50, and
// rendering all of them on a phone is a lot of images for a list most people
// scan the top of.
const PAGE_SIZE = 12;

const AGENCY_LOGOS: Record<string, string> = {
  NASA: '/logos/nasa.jpg',
  SpaceX: '/logos/spacex.jpeg',
  ULA: '/logos/ula.jpg',
  ESA: '/logos/esa.jpg',
  JAXA: '/logos/jaxa.jpg',
  'Russian Federal Space Agency (ROSCOSMOS)': '/logos/Roscosmos.jpg',
  'China Aerospace Science and Technology Corporation': '/logos/casc.jpg',
  'Blue Origin': '/logos/blueorigin.jpg',
};

const agencyLogo = (agency: string | null) =>
  (agency && AGENCY_LOGOS[agency]) || '/logos/defaultAgency.jpg';

/**
 * Compact T-minus line for a card, with the date beneath it. Once there is
 * nothing to count down to, the date alone takes the countdown's place, so
 * a card never prints the same date twice. The full clock lives on the
 * detail page.
 */
function CardTiming({ launch }: { launch: LaunchListItem }) {
  const countdown = useLaunchCountdown(launch);

  if (!countdown) {
    return (
      <Text fontSize="sm" fontFamily="mono" color="text.secondary">
        {formatNet(launch)}
      </Text>
    );
  }

  // Seconds only matter once the launch is close enough to watch for
  const parts = countdown.d > 0
    ? [`${countdown.d}d`, `${countdown.h}h`, `${countdown.m}m`]
    : [`${countdown.h}h`, `${countdown.m}m`, `${String(countdown.s).padStart(2, '0')}s`];

  return (
    <Box minW={0}>
      <Text fontSize="sm" fontFamily="mono" color="accent.terminal" letterSpacing="wide">
        T- {parts.join(' ')}
      </Text>
      <Text fontSize="xs" color="text.secondary" noOfLines={1}>
        {formatNet(launch)}
      </Text>
    </Box>
  );
}

/**
 * One launch in the list.
 *
 * The card used to expand in place to reveal mission details, calendar links,
 * and a webcast button. All of that now lives at /launches/<slug>, which is
 * linkable, shareable, and previews properly when posted — so the card's only
 * job is to identify the launch and get you there.
 */
interface LaunchCardProps {
  launch: LaunchListItem;
  index?: number;
  reduceMotion?: boolean;
}

function LaunchCard({ launch, index = 0, reduceMotion = false }: LaunchCardProps) {
  const provider = providerName(launch);

  return (
    <LinkBox
      as={MotionBox}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
      // Transitions ride on each target: a top-level transition prop collides
      // with Chakra's CSS transition prop, and it also gave the hover lift
      // the reveal's stagger delay
      whileInView={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: (index % 2) * 0.08 } }}
      viewport={{ once: true, margin: '-60px' }}
      whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
      bg="bg.card"
      border="1px solid"
      borderColor="border.default"
      borderRadius="xl"
      overflow="hidden"
      shadow="md"
      position="relative"
      data-group
      _hover={{
        borderColor: 'border.controlHover',
      }}
    >
      <Box position="relative" h={{ base: '190px', md: '210px' }} overflow="hidden">
        {launch.image ? (
          <MotionImage
            src={launch.image}
            alt=""
            w="100%"
            h="100%"
            objectFit="cover"
            fallback={<Box h="100%" bg="bg.elevated" />}
            transition="transform 0.7s ease"
            _groupHover={reduceMotion ? undefined : { transform: 'scale(1.06)' }}
          />
        ) : (
          <Box h="100%" w="100%" bg="bg.elevated" />
        )}

        <Box
          position="absolute"
          inset={0}
          bgImage={`linear-gradient(to bottom, ${withAlpha('bg.card', 15)} 0%, ${withAlpha('bg.card', 15)} 45%, ${withAlpha('bg.card', 92)} 100%)`}
        />

        {/* The track and calendar buttons sit above the overlay so using
            them doesn't navigate. LinkOverlay covers the rest of the card. */}
        <HStack position="absolute" top={3} right={3} spacing={1} zIndex={3}>
          <CalendarMenu launch={launch} />
          <TrackButton launch={launch} />
          <StatusBadge status={launch.status} size="md" />
        </HStack>

        <HStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          p={4}
          spacing={3}
          align="flex-end"
          zIndex={2}
        >
          <Box
            bg="whiteAlpha.900"
            borderRadius="lg"
            p={1.5}
            boxShadow="0 2px 8px rgba(0,0,0,0.4)"
            flexShrink={0}
          >
            <Image
              src={agencyLogo(provider)}
              alt=""
              boxSize="40px"
              objectFit="contain"
              fallbackSrc="/logos/defaultAgency.jpg"
            />
          </Box>
          <VStack align="start" spacing={0.5} flex={1} minW={0}>
            <Text
              fontSize="lg"
              fontWeight="bold"
              color="white"
              lineHeight="1.2"
              noOfLines={2}
              textShadow="0 1px 6px rgba(0,0,0,0.7)"
            >
              {launch.name}
            </Text>
            <Text fontSize="sm" color="whiteAlpha.800" noOfLines={1}>
              {provider ?? 'Unknown provider'}
            </Text>
          </VStack>
        </HStack>
      </Box>

      <VStack spacing={2} align="stretch" px={5} py={4}>
        <HStack justify="space-between" align="start" spacing={3}>
          <CardTiming launch={launch} />
          <Text fontSize="xs" color="text.secondary" noOfLines={2} textAlign="right" maxW="50%">
            {launch.pad?.location?.name ?? launch.pad?.name ?? 'Site TBD'}
          </Text>
        </HStack>
      </VStack>

      {/* The real click target for the whole card, added last so it paints
          above everything else at the same z-index tier (the title text
          above, which is now plain, non-linked text) while staying below the
          track button/badge group (zIndex 3), so starring a launch still
          doesn't navigate to it. It has to be a direct child of LinkBox,
          not nested inside the image Box above — that Box is also
          `position="relative"`, so a LinkOverlay nested inside it would only
          ever stretch to cover the image, leaving the stats section below
          permanently unclickable. */}
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
    return <ErrorState title="Error loading launches!" message={error} onRetry={refetch} />;
  }

  const shown = filters.filtered.slice(0, visible);

  return (
    <VStack spacing={6} align="stretch">
      <LaunchFilters state={filters} trackingControls={<AlertSettings />} />

      {shown.length === 0 ? (
        <Alert status="info" borderRadius="lg">
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
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
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
        Showing {shown.length} of {filters.filtered.length} launches · Times in your timezone,
        subject to change for weather, technical issues, or range conflicts
      </Text>
    </VStack>
  );
}
