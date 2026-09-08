import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Container,
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
import { FaRocket, FaCloudSun } from 'react-icons/fa';
import ErrorState from '../components/ErrorState';
import Breadcrumbs from '../components/Breadcrumbs';
import StatusBadge from '../components/StatusBadge';
import LaunchMetaLine from '../components/LaunchMetaLine';
import LaunchHero from '../components/LaunchHero';
import Card from '../components/Card';
import CountdownDisplay from '../components/launch/CountdownDisplay';
import WebcastPanel from '../components/launch/WebcastPanel';
import MissionUpdates from '../components/launch/MissionUpdates';
import ShareBar from '../components/launch/ShareBar';
import LaunchStats from '../components/launch/LaunchStats';
import LaunchLighting from '../components/launch/LaunchLighting';
import { useLaunchDetail } from '../hooks/useLaunchDetail';
import { useUpcomingLaunches } from '../hooks/useUpcomingLaunches';
import { usePageMeta } from '../hooks/usePageMeta';
import { statusStyle } from '../data/launchStatus';
import {
  buildLaunchDescription,
  buildLaunchTitle,
  buildMissionSummary,
  formatNet,
  launchPath,
  missionDisplayName,
  padDescription,
  providerName,
  rocketName,
  weatherProbability,
} from '../utils/launchFields';
import type { LaunchListItem } from '../types/launchLibrary';

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
  const { launches: upcoming } = useUpcomingLaunches();

  // Mirrors what the edge already wrote into the HTML, so a client-side
  // navigation into this page ends up with the same title and description a
  // direct visit would have had. buildLaunchTitle/buildLaunchDescription are
  // the same functions the edge function uses, so the two can't drift.
  usePageMeta(
    '/launches/:slug',
    launch
      ? {
          title: buildLaunchTitle(launch),
          description: buildLaunchDescription(launch),
          image: launch.image ?? undefined,
          url: `/launches/${slug}`,
        }
      : null
  );

  // A few other upcoming launches to link to: same provider first, then same
  // rocket family, then whatever's chronologically next. Pulls from the
  // already-cached upcoming feed, so this costs no extra API requests — but it
  // also means a *past* launch's "related" list is other still-upcoming
  // launches rather than topically similar ones, since there's no previous-
  // launches feed wired up yet.
  const related = useMemo(() => {
    if (!launch) return [] as LaunchListItem[];
    const candidates = (upcoming as LaunchListItem[]).filter((l) => l.slug !== launch.slug);

    const providerId = launch.launch_service_provider?.id;
    const rocketConfigId = launch.rocket?.configuration?.id;
    const sameProvider = providerId
      ? candidates.filter((l) => l.launch_service_provider?.id === providerId)
      : [];
    const sameRocket = rocketConfigId
      ? candidates.filter((l) => l.rocket?.configuration?.id === rocketConfigId)
      : [];

    const seen = new Set<string>();
    const result: LaunchListItem[] = [];
    for (const l of [...sameProvider, ...sameRocket, ...candidates]) {
      if (seen.has(l.slug)) continue;
      seen.add(l.slug);
      result.push(l);
      if (result.length === 4) break;
    }
    return result;
  }, [upcoming, launch]);

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
  const rocketConfig = launch.rocket?.configuration;
  const pad = padDescription(launch);
  const probability = weatherProbability(launch);
  const displayName = missionDisplayName(launch);
  const summary = buildMissionSummary(launch);

  return (
    <Container maxW="6xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Launches', to: '/launches' },
            { label: displayName },
          ]}
        />

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
        <LaunchHero
          image={launch.image}
          eyebrow={
            <>
              <StatusBadge status={launch.status} size="sm" />
              {launch.program?.map((program) => (
                <Badge key={program.id} variant="outline" rounded="full" px={3} py={0.5}>
                  {program.name}
                </Badge>
              ))}
            </>
          }
          heading={displayName}
          metaLine={<LaunchMetaLine provider={provider} rocket={rocket} pad={pad} net={formatNet(launch)} />}
          countdown={<CountdownDisplay launch={launch} />}
        />

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
              <Card p={5}>
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
              </Card>
            )}
          </VStack>
        )}

        {/* Mission Overview */}
        <Box as="section">
          <Heading as="h2" size="md" mb={4}>
            Mission Overview
          </Heading>
          <VStack align="stretch" spacing={6}>
            <Card p={5}>
              <HStack spacing={2} mb={3}>
                <Icon as={FaRocket} color="text.secondary" />
                <Text fontWeight="600">
                  {launch.mission?.name ?? 'Mission'}
                  {launch.mission?.type ? ` · ${launch.mission.type}` : ''}
                </Text>
              </HStack>
              <Text fontSize="sm" lineHeight="1.7" color="text.secondary">
                {summary}
              </Text>
              {launch.mission?.orbit?.name && (
                <Text fontSize="xs" color="text.secondary" mt={3}>
                  Target orbit: <Text as="span" color="text.primary">{launch.mission.orbit.name}</Text>
                </Text>
              )}
            </Card>

            {launch.mission_patches && launch.mission_patches.length > 0 && (
              <Card p={5}>
                <Heading as="h3" size="sm" mb={4}>
                  Mission Patch
                </Heading>
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
              </Card>
            )}
          </VStack>
        </Box>

        {/* Launch Details */}
        <Box as="section">
          <Heading as="h2" size="md" mb={4}>
            Launch Details
          </Heading>
          <VStack align="stretch" spacing={6}>
            <WebcastPanel launch={launch} />
            <LaunchLighting launch={launch} />
            {launch.updates && launch.updates.length > 0 && (
              <MissionUpdates updates={launch.updates} />
            )}
          </VStack>
        </Box>

        {/* Rocket */}
        {(rocket || provider) && (
          <Box as="section">
            <Heading as="h2" size="md" mb={4}>
              Rocket
            </Heading>
            <VStack align="stretch" spacing={6}>
              <Card p={5}>
                <Heading as="h3" size="sm" mb={2}>
                  {rocket ?? 'Rocket'}
                </Heading>
                {rocketConfig?.family && (
                  <Text fontSize="sm" color="text.secondary">
                    Family: <Text as="span" color="text.primary">{rocketConfig.family}</Text>
                  </Text>
                )}
                {provider && (
                  <Text fontSize="sm" color="text.secondary">
                    Operated by <Text as="span" color="text.primary">{provider}</Text>
                  </Text>
                )}
              </Card>
              <LaunchStats launch={launch} />
            </VStack>
          </Box>
        )}

        {/* Launch Site */}
        {launch.pad && (
          <Box as="section">
            <Heading as="h2" size="md" mb={4}>
              Launch Site
            </Heading>
            <Card p={5}>
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
            </Card>
          </Box>
        )}

        {/* Mission Status */}
        <Box as="section">
          <Heading as="h2" size="md" mb={4}>
            Mission Status
          </Heading>
          <VStack align="stretch" spacing={6}>
            <Card p={5}>
              <Text fontSize="sm">
                This mission is currently{' '}
                <Text as="span" fontWeight="600" color="text.primary">
                  {style.label}
                </Text>
                .
              </Text>
            </Card>

            {launch.infoURLs && launch.infoURLs.length > 0 && (
              <Card p={5}>
                <Heading as="h3" size="sm" mb={3}>
                  More Information
                </Heading>
                <VStack align="stretch" spacing={2}>
                  {launch.infoURLs.map((info) => (
                    <Link key={info.url} href={info.url} isExternal fontSize="sm" color="brand.300">
                      {info.title ?? info.url} <ExternalLinkIcon mx="2px" mb="2px" />
                    </Link>
                  ))}
                </VStack>
              </Card>
            )}
          </VStack>
        </Box>

        {/* Related Launches */}
        {related.length > 0 && (
          <Box as="section">
            <Heading as="h2" size="md" mb={4}>
              Related Launches
            </Heading>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
              {related.map((l) => (
                <Link
                  key={l.slug}
                  as={RouterLink}
                  to={launchPath(l)}
                  display="block"
                  bg="bg.card"
                  border="1px solid"
                  borderColor="border.default"
                  borderRadius="xl"
                  p={4}
                  _hover={{ borderColor: 'brand.300', textDecoration: 'none' }}
                >
                  <Text fontWeight="600" noOfLines={1}>
                    {missionDisplayName(l)}
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    {formatNet(l)}
                  </Text>
                </Link>
              ))}
            </SimpleGrid>
          </Box>
        )}

        <Text fontSize="xs" color="text.secondary" textAlign="center">
          Launch times change often. Data from The Space Devs · Times shown in your local timezone.
        </Text>
      </VStack>
    </Container>
  );
}
