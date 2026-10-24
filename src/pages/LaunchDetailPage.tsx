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
import { ExternalLinkIcon } from '@chakra-ui/icons';
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
import {
  buildLaunchDescription,
  buildLaunchTitle,
  buildMissionSummary,
  formatNet,
  infoLinks,
  launchImageUrl,
  launchPath,
  missionDisplayName,
  padDescription,
  providerName,
  rocketFamily,
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
          image: launchImageUrl(launch) ?? undefined,
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
    const candidates = upcoming.filter((l) => l.slug !== launch.slug);

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

  const provider = providerName(launch);
  const rocket = rocketName(launch);
  const family = rocketFamily(launch);
  const info = infoLinks(launch);
  const pad = padDescription(launch);
  const probability = weatherProbability(launch);
  const displayName = missionDisplayName(launch);
  const summary = buildMissionSummary(launch);
  const hasPatches = Boolean(launch.mission_patches?.length);

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

        {/* Hero */}
        <LaunchHero
          image={launchImageUrl(launch)}
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

        {/* Watch: what most visitors come for around launch time */}
        <Box as="section" aria-label="Webcast">
          <WebcastPanel launch={launch} />
        </Box>

        {/* Mission: the overview, its patch, and outside reading */}
        <Box as="section">
          <Heading as="h2" size="md" mb={4}>
            Mission
          </Heading>
          <SimpleGrid columns={{ base: 1, md: hasPatches ? 3 : 1 }} spacing={6}>
            <Card p={5} gridColumn={{ md: hasPatches ? 'span 2' : undefined }}>
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
              {info.length > 0 && (
                <Box mt={4} pt={4} borderTop="1px solid" borderColor="border.default">
                  <Text fontSize="xs" color="text.secondary" mb={2} textTransform="uppercase" letterSpacing="wider">
                    More information
                  </Text>
                  <VStack align="stretch" spacing={1.5}>
                    {info.map((link) => (
                      <Link key={link.url} href={link.url} isExternal fontSize="sm" color="brand.300">
                        {link.title ?? link.url} <ExternalLinkIcon mx="2px" mb="2px" />
                      </Link>
                    ))}
                  </VStack>
                </Box>
              )}
            </Card>

            {hasPatches && (
              <Card p={5}>
                <Heading as="h3" size="sm" mb={4}>
                  Mission Patch
                </Heading>
                <HStack spacing={4} flexWrap="wrap">
                  {launch.mission_patches?.map((patch) => (
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
          </SimpleGrid>
        </Box>

        {/* Launch day: lighting conditions and the upstream update log */}
        <Box as="section">
          <Heading as="h2" size="md" mb={4}>
            Launch Day
          </Heading>
          <VStack align="stretch" spacing={6}>
            <LaunchLighting launch={launch} />
            {launch.updates && launch.updates.length > 0 && (
              <MissionUpdates updates={launch.updates} />
            )}
          </VStack>
        </Box>

        {/* Vehicle & Site: two thin sections merged into one */}
        {(rocket || provider || launch.pad) && (
          <Box as="section">
            <Heading as="h2" size="md" mb={4}>
              Vehicle &amp; Site
            </Heading>
            <VStack align="stretch" spacing={6}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                {(rocket || provider) && (
                  <Card p={5}>
                    <Text fontSize="xs" color="text.secondary" textTransform="uppercase" letterSpacing="wider" mb={1}>
                      Rocket
                    </Text>
                    <Heading as="h3" size="sm" mb={2}>
                      {rocket ?? 'Rocket'}
                    </Heading>
                    {family && (
                      <Text fontSize="sm" color="text.secondary">
                        Family: <Text as="span" color="text.primary">{family}</Text>
                      </Text>
                    )}
                    {provider && (
                      <Text fontSize="sm" color="text.secondary">
                        Operated by <Text as="span" color="text.primary">{provider}</Text>
                      </Text>
                    )}
                  </Card>
                )}

                {launch.pad && (
                  <Card p={5}>
                    <Text fontSize="xs" color="text.secondary" textTransform="uppercase" letterSpacing="wider" mb={1}>
                      Launch site
                    </Text>
                    <Heading as="h3" size="sm" mb={2}>
                      {launch.pad.name}
                    </Heading>
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
                )}
              </SimpleGrid>
              <LaunchStats launch={launch} />
            </VStack>
          </Box>
        )}

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
