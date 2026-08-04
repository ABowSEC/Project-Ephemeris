import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  Image,
  Link,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { FaMapMarkerAlt, FaRocket, FaSatellite, FaCloudSun } from 'react-icons/fa';
import ErrorState from '../components/ErrorState';
import CountdownDisplay from '../components/launch/CountdownDisplay';
import WebcastPanel from '../components/launch/WebcastPanel';
import MissionUpdates from '../components/launch/MissionUpdates';
import ShareBar from '../components/launch/ShareBar';
import LaunchStats from '../components/launch/LaunchStats';
import LaunchLighting from '../components/launch/LaunchLighting';
import { useLaunchDetail } from '../hooks/useLaunchDetail';
import { usePageMeta } from '../hooks/usePageMeta';
import { statusStyle } from '../data/launchStatus';
import {
  formatNet,
  padDescription,
  providerName,
  rocketName,
  weatherProbability,
} from '../utils/launchFields';

/**
 * A single launch: /launches/<slug>
 *
 * The permanent, shareable URL for a mission. Social metadata for this page is
 * stamped in at the edge by functions/launches/[slug].ts, since crawlers never
 * run the SPA; usePageMeta below only keeps things right for in-app navigation.
 */
export default function LaunchDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { launch, loading, error, notFound, refetch } = useLaunchDetail(slug);

  // Mirrors what the edge already wrote into the HTML, so a client-side
  // navigation into this page ends up with the same title and description a
  // direct visit would have had.
  usePageMeta(
    '/launches/:slug',
    launch
      ? {
          title: launch.name,
          description:
            launch.mission?.description?.slice(0, 300) ??
            `Live countdown, official webcast, and mission updates for ${launch.name}.`,
          image: launch.image ?? undefined,
          url: `/launches/${slug}`,
        }
      : null
  );

  if (notFound) {
    return (
      <Container maxW="4xl" py={20}>
        <VStack spacing={4}>
          <Heading size="lg">Launch not found</Heading>
          <Text color="text.secondary" textAlign="center">
            No mission matches <Text as="code">{slug}</Text>. It may have been renamed upstream, or
            the link may be mistyped.
          </Text>
          <Link as={RouterLink} to="/launches" color="brand.300">
            Browse upcoming launches
          </Link>
        </VStack>
      </Container>
    );
  }

  if (loading && !launch) {
    return (
      <Container maxW="6xl" py={20}>
        <VStack spacing={6}>
          <Spinner size="xl" color="accent.terminal" thickness="3px" />
          <Text color="text.secondary">Loading mission...</Text>
        </VStack>
      </Container>
    );
  }

  if (error && !launch) {
    return (
      <Container maxW="4xl" py={16}>
        <ErrorState title="Could not load this launch" message={error} onRetry={refetch} />
      </Container>
    );
  }

  if (!launch) return null;

  const style = statusStyle(launch.status);
  const provider = providerName(launch);
  const rocket = rocketName(launch);
  const pad = padDescription(launch);
  const probability = weatherProbability(launch);

  return (
    <Container maxW="6xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Link
          as={RouterLink}
          to="/launches"
          fontSize="sm"
          color="text.secondary"
          alignSelf="flex-start"
          _hover={{ color: 'brand.300', textDecoration: 'none' }}
        >
          <ChevronLeftIcon /> All launches
        </Link>

        {/* Hero */}
        <Box position="relative" rounded="2xl" overflow="hidden" minH="300px">
          {launch.image && (
            <Box
              position="absolute"
              inset={0}
              bgImage={`url(${launch.image})`}
              bgSize="cover"
              bgPos="center"
              filter="brightness(0.45) saturate(0.9)"
              transform="scale(1.06)"
            />
          )}
          <Box
            position="absolute"
            inset={0}
            bgGradient="linear(to-r, rgba(6,9,26,0.95) 25%, rgba(6,9,26,0.6) 55%, rgba(6,9,26,0.2))"
          />

          <Flex
            position="relative"
            p={{ base: 6, md: 10 }}
            minH="300px"
            align="center"
            justify="space-between"
            gap={{ base: 8, md: 12 }}
            direction={{ base: 'column', lg: 'row' }}
          >
            <VStack align={{ base: 'center', lg: 'start' }} spacing={4} flex={1} maxW={{ lg: '560px' }}>
              <HStack spacing={2} flexWrap="wrap" justify={{ base: 'center', lg: 'flex-start' }}>
                <Badge colorScheme={style.colorScheme} variant="subtle" rounded="full" px={3} py={0.5}>
                  {style.label}
                </Badge>
                {launch.program?.map((program) => (
                  <Badge key={program.id} variant="outline" rounded="full" px={3} py={0.5}>
                    {program.name}
                  </Badge>
                ))}
              </HStack>

              <Heading
                as="h1"
                size={{ base: 'xl', md: '2xl' }}
                lineHeight="1.15"
                textAlign={{ base: 'center', lg: 'left' }}
              >
                {launch.name}
              </Heading>

              <VStack align={{ base: 'center', lg: 'start' }} spacing={1.5}>
                {provider && (
                  <HStack color="text.secondary" fontSize="sm" spacing={2}>
                    <Icon as={FaSatellite} boxSize={3} flexShrink={0} />
                    <Text>{provider}</Text>
                    {rocket && (
                      <>
                        <Text color="whiteAlpha.300">·</Text>
                        <Text color="text.primary" fontWeight="medium">
                          {rocket}
                        </Text>
                      </>
                    )}
                  </HStack>
                )}
                {pad && (
                  <HStack color="text.secondary" fontSize="sm" spacing={2}>
                    <Icon as={FaMapMarkerAlt} boxSize={3} flexShrink={0} />
                    <Text>{pad}</Text>
                  </HStack>
                )}
                <Text fontSize="xs" color="text.secondary" fontFamily="mono" letterSpacing="wide" mt={1}>
                  {formatNet(launch)}
                </Text>
              </VStack>
            </VStack>

            <VStack spacing={3} flexShrink={0}>
              <Text
                fontSize="10px"
                color="text.secondary"
                letterSpacing="0.18em"
                textTransform="uppercase"
                fontWeight="semibold"
              >
                Time to Launch
              </Text>
              <CountdownDisplay launch={launch} />
            </VStack>
          </Flex>
        </Box>

        <ShareBar launch={launch} />

        {/* Anything upstream is currently flagging: a hold, a failure, or the
            weather forecast. Rendered ahead of the mission blurb because it is
            the thing that changed most recently. */}
        {(launch.holdreason || launch.failreason || probability != null || launch.weather_concerns) && (
          <VStack align="stretch" spacing={3}>
            {launch.holdreason && (
              <ErrorState status="warning" title="Countdown hold" message={launch.holdreason} />
            )}
            {launch.failreason && (
              <ErrorState status="error" title="Failure" message={launch.failreason} />
            )}
            {(probability != null || launch.weather_concerns) && (
              <Box
                bg="bg.card"
                border="1px solid"
                borderColor="border.default"
                borderRadius="xl"
                p={5}
              >
                <HStack spacing={3} align="flex-start">
                  <Icon as={FaCloudSun} color="text.secondary" mt={1} />
                  <Box>
                    {probability != null && (
                      <Text fontWeight="600">{probability}% chance of favorable weather</Text>
                    )}
                    {launch.weather_concerns && (
                      <Text fontSize="sm" color="text.secondary" mt={probability != null ? 1 : 0}>
                        Concerns: {launch.weather_concerns}
                      </Text>
                    )}
                  </Box>
                </HStack>
              </Box>
            )}
          </VStack>
        )}

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
          <VStack align="stretch" spacing={6}>
            <WebcastPanel launch={launch} />

            {launch.mission?.description && (
              <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius="xl" p={5}>
                <HStack spacing={2} mb={3}>
                  <Icon as={FaRocket} color="text.secondary" />
                  <Text fontWeight="600">
                    {launch.mission.name ?? 'Mission'}
                    {launch.mission.type ? ` · ${launch.mission.type}` : ''}
                  </Text>
                </HStack>
                <Text fontSize="sm" lineHeight="1.7" color="text.secondary">
                  {launch.mission.description}
                </Text>
                {launch.mission.orbit?.name && (
                  <Text fontSize="xs" color="text.secondary" mt={3}>
                    Target orbit: <Text as="span" color="text.primary">{launch.mission.orbit.name}</Text>
                  </Text>
                )}
              </Box>
            )}

            {launch.mission_patches && launch.mission_patches.length > 0 && (
              <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius="xl" p={5}>
                <Text fontWeight="600" mb={4}>
                  Mission Patch
                </Text>
                <HStack spacing={4}>
                  {launch.mission_patches.map((patch) => (
                    <Image
                      key={patch.id}
                      src={patch.image_url}
                      alt={patch.name}
                      boxSize="96px"
                      objectFit="contain"
                    />
                  ))}
                </HStack>
              </Box>
            )}

            <LaunchLighting launch={launch} />

            <LaunchStats launch={launch} />
          </VStack>

          <VStack align="stretch" spacing={6}>
            {launch.updates && launch.updates.length > 0 && (
              <MissionUpdates updates={launch.updates} />
            )}

            {launch.pad && (
              <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius="xl" p={5}>
                <Text fontWeight="600" mb={3}>
                  Launch Site
                </Text>
                <Text fontSize="sm">{launch.pad.name}</Text>
                {launch.pad.location?.name && (
                  <Text fontSize="sm" color="text.secondary">
                    {launch.pad.location.name}
                  </Text>
                )}
                <HStack spacing={4} mt={3} flexWrap="wrap">
                  {launch.pad.map_url && (
                    <Link href={launch.pad.map_url} isExternal fontSize="sm" color="brand.300">
                      Open in Maps <ExternalLinkIcon mx="2px" mb="2px" />
                    </Link>
                  )}
                  {launch.pad.wiki_url && (
                    <Link href={launch.pad.wiki_url} isExternal fontSize="sm" color="brand.300">
                      Wikipedia <ExternalLinkIcon mx="2px" mb="2px" />
                    </Link>
                  )}
                </HStack>
              </Box>
            )}

            {launch.infoURLs && launch.infoURLs.length > 0 && (
              <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius="xl" p={5}>
                <Text fontWeight="600" mb={3}>
                  More Information
                </Text>
                <VStack align="stretch" spacing={2}>
                  {launch.infoURLs.map((info) => (
                    <Link key={info.url} href={info.url} isExternal fontSize="sm" color="brand.300">
                      {info.title ?? info.url} <ExternalLinkIcon mx="2px" mb="2px" />
                    </Link>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </SimpleGrid>

        <Text fontSize="xs" color="text.secondary" textAlign="center">
          Launch times change often. Data from The Space Devs · Times shown in your local timezone.
        </Text>
      </VStack>
    </Container>
  );
}
