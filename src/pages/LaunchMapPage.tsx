import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Link,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import DotGlobe, { type GlobeMarker } from '../components/sky/DotGlobe';
import Card from '../components/Card';
import ErrorState from '../components/ErrorState';
import StaleDataNotice from '../components/StaleDataNotice';
import TrackButton from '../components/TrackButton';
import { StatusDot } from '../components/StatusBadge';
import { statusStyle } from '../data/launchStatus';
import { useNow } from '../hooks/useNow';
import { usePageMeta } from '../hooks/usePageMeta';
import { useUpcomingLaunches } from '../hooks/useUpcomingLaunches';
import { launchPath, launchTime, padCoordinates } from '../utils/launchFields';
import type { AnyLaunch } from '../types/launchLibrary';

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface Site {
  key: string;
  name: string;
  countryCode: string | null;
  lat: number;
  lon: number;
  /** Soonest first. */
  launches: AnyLaunch[];
}

const timeOf = (launch: AnyLaunch) => new Date(launchTime(launch) ?? 0).getTime();

/**
 * Group launches by launch-site location so one marker represents a spaceport
 * (which can have several pads), soonest site first.
 */
function groupBySite(launches: AnyLaunch[]): Site[] {
  const sites = new Map<string, Site>();
  for (const launch of launches) {
    const at = padCoordinates(launch);
    if (!at) continue;
    const key = launch.pad?.location?.name ?? `${at.lat.toFixed(1)},${at.lon.toFixed(1)}`;
    let site = sites.get(key);
    if (!site) {
      site = {
        key,
        name: launch.pad?.location?.name ?? 'Unknown site',
        countryCode: launch.pad?.location?.country_code ?? null,
        lat: at.lat,
        lon: at.lon,
        launches: [],
      };
      sites.set(key, site);
    }
    site.launches.push(launch);
  }
  const list = [...sites.values()];
  for (const site of list) site.launches.sort((a, b) => timeOf(a) - timeOf(b));
  return list.sort((a, b) => timeOf(a.launches[0]) - timeOf(b.launches[0]));
}

const DAY_MS = 24 * 60 * 60_000;

export default function LaunchMapPage() {
  usePageMeta('/map');
  const { launches, loading, error, refresh, stale, fetchedAt } = useUpcomingLaunches();
  const now = useNow(60_000);

  const sites = useMemo(() => groupBySite(launches as AnyLaunch[]), [launches]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = sites.find((s) => s.key === selectedKey) ?? sites[0] ?? null;

  const markers = useMemo<GlobeMarker[]>(
    () =>
      sites.map((site) => {
        const next = site.launches[0];
        const hoursAway = (timeOf(next) - now) / 3_600_000;
        return {
          id: site.key,
          lat: site.lat,
          lon: site.lon,
          color: statusStyle(next.status).dot,
          // Size says how busy the site is
          radius: 3 + Math.min(6, Math.sqrt(site.launches.length) * 1.7),
          // Brighter the sooner something leaves from it
          glow: Math.max(0.2, Math.min(0.9, 1 - hoursAway / 72)),
          selected: site.key === selected?.key,
          label: site.key === selected?.key ? site.name : undefined,
        };
      }),
    [sites, selected?.key, now]
  );

  const home = useMemo(
    () => (selected ? { lat: selected.lat, lon: selected.lon } : { lat: 20, lon: -40 }),
    [selected]
  );

  const pick = useCallback((key: string) => setSelectedKey(key), []);

  return (
    <Container maxW="8xl" py={8}>
      <Box mb={6}>
        <Text
          fontFamily="mono"
          fontSize="xs"
          letterSpacing="0.2em"
          color="accent.terminal"
          textTransform="uppercase"
          mb={2}
        >
          Map
        </Text>
        <Heading as="h1" size="lg" fontWeight="600">
          World launch map
        </Heading>
        <Text color="text.secondary" mt={2} maxW="64ch">
          Every spaceport with an upcoming launch. Drag to turn the Earth, or pick a site. Bright land is
          in daylight, and the glowing lines mark the edge of day and twilight right now.
        </Text>
      </Box>

      {error && launches.length === 0 && (
        <ErrorState
          title="Could not load launch sites"
          message={error}
          onRetry={() => void refresh()}
        />
      )}

      {loading && launches.length === 0 && !error && (
        <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1.2fr) minmax(0, 1fr)' }} gap={6}>
          <Skeleton h="520px" rounded="2xl" />
          <Skeleton h="520px" rounded="2xl" />
        </Grid>
      )}

      {sites.length > 0 && selected && (
        <Grid
          templateColumns={{ base: '1fr', lg: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}
          gap={{ base: 6, lg: 8 }}
          alignItems="start"
        >
          <Card p={{ base: 4, md: 6 }}>
            <Box maxW="640px" mx="auto">
              <DotGlobe
                time={now}
                markers={markers}
                home={home}
                onPick={pick}
                ariaLabel="Dot-matrix globe of launch sites, lit by the Sun as it is right now. The list of sites carries the same information."
                recenterLabel="Back to site"
              />
            </Box>
            <HStack spacing={5} wrap="wrap" justify="center" mt={4} fontSize="xs" color="text.secondary">
              <Text>Larger dot: more launches</Text>
              {(['Go', 'TBC', 'Hold'] as const).map((abbrev) => {
                const style = statusStyle({ abbrev } as never);
                return (
                  <HStack key={abbrev} spacing={1.5}>
                    <Box boxSize="8px" rounded="full" bg={style.dot} />
                    <Text>{style.label}</Text>
                  </HStack>
                );
              })}
            </HStack>
            <StaleDataNotice stale={stale} fetchedAt={fetchedAt} onRefresh={refresh} mt={3} />
          </Card>

          <VStack align="stretch" spacing={4}>
            <Card p={5} borderColor="accent.purple">
              <Flex justify="space-between" align="baseline" gap={3}>
                <Heading as="h2" size="sm" noOfLines={2}>
                  {selected.name}
                </Heading>
                {selected.countryCode && (
                  <Text fontFamily="mono" fontSize="xs" color="text.secondary">
                    {selected.countryCode}
                  </Text>
                )}
              </Flex>
              <Text fontSize="xs" color="text.secondary" mt={1} mb={3}>
                {selected.launches.length} upcoming launch{selected.launches.length === 1 ? '' : 'es'}
                {timeOf(selected.launches[0]) - now < DAY_MS && timeOf(selected.launches[0]) > now
                  ? ', the next within a day'
                  : ''}
              </Text>
              <VStack align="stretch" spacing={2} borderTop="1px solid" borderColor="border.default" pt={3}>
                {selected.launches.slice(0, 8).map((launch) => (
                  <HStack key={launch.id} spacing={2} align="center">
                    <TrackButton launch={launch} size="xs" />
                    <StatusDot status={launch.status} />
                    <Box minW={0}>
                      <Link
                        as={RouterLink}
                        to={launchPath(launch)}
                        fontSize="sm"
                        fontWeight="semibold"
                        color="text.primary"
                        noOfLines={1}
                        _hover={{ color: 'brand.300' }}
                      >
                        {launch.name}
                      </Link>
                      <Text fontSize="xs" color="text.secondary" fontFamily="mono">
                        {shortDate.format(timeOf(launch))}
                      </Text>
                    </Box>
                  </HStack>
                ))}
                {selected.launches.length > 8 && (
                  <Text fontSize="xs" color="text.secondary">
                    + {selected.launches.length - 8} more from this site
                  </Text>
                )}
              </VStack>
            </Card>

            <Card p={4}>
              <Text
                fontFamily="heading"
                fontSize="xs"
                letterSpacing="0.14em"
                textTransform="uppercase"
                mb={3}
              >
                Launch sites
              </Text>
              <VStack align="stretch" spacing={1} maxH={{ lg: '300px' }} overflowY="auto">
                {sites.map((site) => {
                  const active = site.key === selected.key;
                  return (
                    <Flex
                      as="button"
                      type="button"
                      key={site.key}
                      onClick={() => pick(site.key)}
                      aria-pressed={active}
                      justify="space-between"
                      gap={3}
                      textAlign="left"
                      px={3}
                      py={2}
                      rounded="md"
                      bg={active ? 'whiteAlpha.100' : undefined}
                      _hover={{ bg: 'whiteAlpha.50' }}
                      _focusVisible={{ outline: '2px solid', outlineColor: 'brand.300' }}
                    >
                      <Text fontSize="sm" noOfLines={1}>
                        {site.name}
                      </Text>
                      <Text fontFamily="mono" fontSize="xs" color="text.secondary" flexShrink={0}>
                        {site.launches.length}
                      </Text>
                    </Flex>
                  );
                })}
              </VStack>
            </Card>
          </VStack>
        </Grid>
      )}

      {!loading && !error && sites.length === 0 && (
        <Text color="text.secondary">No launch sites with an upcoming launch right now.</Text>
      )}

      <Text fontSize="sm" color="text.secondary" textAlign="center" mt={6}>
        Data from The Space Devs API
      </Text>
    </Container>
  );
}
