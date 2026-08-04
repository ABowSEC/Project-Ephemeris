import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
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
import { useLaunchFilters } from '../hooks/useLaunchFilters';
import TrackButton from './TrackButton';
import ErrorState from './ErrorState';
import { statusStyle } from '../data/launchStatus';
import { formatNet, launchPath, launchTime, providerName } from '../utils/launchFields';
import { useCountdown } from '../hooks/useCountdown';

const MotionBox = motion(Box);
const MotionImage = motion(Image);

// How many cards to show before the "show more" button. The feed holds 50, and
// rendering all of them on a phone is a lot of images for a list most people
// scan the top of.
const PAGE_SIZE = 12;

const AGENCY_LOGOS = {
  NASA: '/logos/nasa.jpg',
  SpaceX: '/logos/spacex.jpeg',
  ULA: '/logos/ula.jpg',
  ESA: '/logos/esa.jpg',
  JAXA: '/logos/jaxa.jpg',
  'Russian Federal Space Agency (ROSCOSMOS)': '/logos/Roscosmos.jpg',
  'China Aerospace Science and Technology Corporation': '/logos/casc.jpg',
  'Blue Origin': '/logos/blueorigin.jpg',
};

const agencyLogo = (agency) => AGENCY_LOGOS[agency] ?? '/logos/defaultAgency.jpg';

/** Compact T-minus line for a card. The full clock lives on the detail page. */
function CardCountdown({ launch }) {
  const countdown = useCountdown(launchTime(launch));

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
    <Text fontSize="sm" fontFamily="mono" color="accent.terminal" letterSpacing="wide">
      T- {parts.join(' ')}
    </Text>
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
function LaunchCard({ launch, index = 0, reduceMotion = false }) {
  const style = statusStyle(launch.status);
  const provider = providerName(launch);

  return (
    <LinkBox
      as={MotionBox}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: (index % 2) * 0.08 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      bg="bg.card"
      border="1px solid"
      borderColor="border.default"
      borderRadius="xl"
      overflow="hidden"
      shadow="md"
      position="relative"
      role="group"
      _hover={{
        shadow: '0 12px 32px -12px var(--chakra-colors-blue-500)',
        borderColor: 'blue.400',
      }}
    >
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h="3px"
        bgGradient="linear(to-r, teal.400, blue.400, purple.400)"
        zIndex={3}
      />

      <Box position="relative" h={{ base: '190px', md: '210px' }} overflow="hidden">
        {launch.image ? (
          <MotionImage
            src={launch.image}
            alt=""
            w="100%"
            h="100%"
            objectFit="cover"
            fallback={<Box h="100%" bgGradient="linear(to-br, blue.900, purple.900)" />}
            transition="transform 0.7s ease"
            _groupHover={reduceMotion ? undefined : { transform: 'scale(1.06)' }}
          />
        ) : (
          <Box h="100%" w="100%" bgGradient="linear(to-br, blue.900, purple.900)" />
        )}

        <Box
          position="absolute"
          inset={0}
          bg="linear-gradient(to bottom, rgba(11,17,32,0.15) 0%, rgba(11,17,32,0.15) 45%, rgba(11,17,32,0.92) 100%)"
        />

        {/* The track button sits above the overlay so starring a launch doesn't
            navigate to it. LinkOverlay covers the rest of the card. */}
        <HStack position="absolute" top={3} right={3} spacing={2} zIndex={3}>
          <TrackButton launch={launch} />
          <Badge colorScheme={style.colorScheme} px={3} py={1} borderRadius="full">
            {style.label}
          </Badge>
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
            <LinkOverlay as={RouterLink} to={launchPath(launch)}>
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
            </LinkOverlay>
            <Text fontSize="sm" color="whiteAlpha.800" noOfLines={1}>
              {provider ?? 'Unknown provider'}
            </Text>
          </VStack>
        </HStack>
      </Box>

      <VStack spacing={2} align="stretch" px={5} py={4}>
        <HStack justify="space-between" align="baseline" spacing={3}>
          <CardCountdown launch={launch} />
          <Text fontSize="xs" color="text.secondary" noOfLines={1} textAlign="right">
            {launch.pad?.location?.name ?? launch.pad?.name ?? 'Site TBD'}
          </Text>
        </HStack>
        <Text fontSize="xs" color="text.secondary">
          {formatNet(launch)}
        </Text>
      </VStack>
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
        <Spinner size="xl" color="blue.400" thickness="4px" />
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
      <LaunchFilters state={filters} />

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
                reduceMotion={reduceMotion}
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

      <Box textAlign="center" pt={2}>
        <Text fontSize="sm" color="text.secondary">
          Showing {shown.length} of {filters.filtered.length} launches · Data from The Space Devs API
        </Text>
      </Box>
    </VStack>
  );
}
