import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Skeleton,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { useUpcomingLaunches } from '../hooks/useUpcomingLaunches';
import { formatCoords, useObserver } from '../hooks/useObserver';
import { VIEWING_SPOTS } from '../data/viewingSpots';
import { launchPath } from '../utils/launchFields';
import { hasFlown } from '../data/launchStatus';
import { PLUME_ALTITUDE_KM, compass, skyPhase, skyPosition, sunHorizontal } from '../utils/sky';
import Card from '../components/Card';
import StaleDataNotice from '../components/StaleDataNotice';
import ErrorState from '../components/ErrorState';
import SkyDome from '../components/sky/SkyDome';
import EarthPlan from '../components/sky/EarthPlan';
import TimeScrubber from '../components/sky/TimeScrubber';
import {
  SPEEDS,
  VISIBILITY,
  groupByPad,
  toSkyLaunches,
  type SkyLaunch,
} from '../components/sky/skyLaunches';

const SPAN_MINUTES = 14 * 24 * 60;
const LIVE_TICK_MS = 30_000;

type View = 'sky' | 'earth';

const PHASE_LABEL = {
  day: 'Daylight',
  civil: 'Civil twilight',
  nautical: 'Nautical twilight',
  astronomical: 'Astronomical twilight',
  night: 'Night',
} as const;

const whenFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const km = (n: number) => `${Math.round(n).toLocaleString()} km`;

export default function SkyPage() {
  usePageMeta('/sky');

  const { launches, loading, error, stale, fetchedAt, refresh } = useUpcomingLaunches();
  const { observer, locating, locationError, locate, choosePreset, resetToGuess } = useObserver();

  const skyLaunches = useMemo(() => toSkyLaunches(launches), [launches]);
  const pads = useMemo(() => groupByPad(skyLaunches), [skyLaunches]);
  // Upcoming launches left out for lack of a firm time or a real pad
  const unplaced = useMemo(
    () => launches.filter((l) => !hasFlown(l.status)).length - skyLaunches.length,
    [launches, skyLaunches]
  );

  // The track starts at page load. Held in state so it stays put while the
  // clock moves; NOW snaps the cursor back to the real present, not the start.
  const [start] = useState(() => Date.now());
  const [time, setTime] = useState(start);
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View>('sky');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyVisible, setOnlyVisible] = useState(false);

  const end = start + SPAN_MINUTES * 60_000;

  // While live, the sky keeps pace with the real clock
  useEffect(() => {
    if (!live) return;
    setTime(Date.now());
    const id = setInterval(() => setTime(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(id);
  }, [live]);

  // Play: advance scrubbed time by `speed` minutes per real second
  const speedRef = useRef(speed);
  speedRef.current = speed;
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const seconds = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = t + seconds * SPEEDS[speedRef.current].minutesPerSecond * 60_000;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, end]);

  const scrubTo = useCallback(
    (t: number) => {
      setLive(false);
      setTime(Math.max(start, Math.min(end, t)));
    },
    [start, end]
  );

  const pick = useCallback(
    (launch: SkyLaunch) => {
      setSelectedId(launch.id);
      setPlaying(false);
      scrubTo(launch.t);
    },
    [scrubTo]
  );

  const goNow = useCallback(() => {
    setPlaying(false);
    setLive(true);
  }, []);

  const selected = useMemo(
    () => skyLaunches.find((l) => l.id === selectedId) ?? null,
    [skyLaunches, selectedId]
  );

  const sun = sunHorizontal(observer.lat, observer.lon, time);

  // Each launch judged at its own T-0: the question is "can I watch this one",
  // not "could I watch a launch happening at the scrubbed moment"
  const rows = useMemo(
    () =>
      skyLaunches
        .filter((l) => l.t <= end)
        .map((launch) => ({ launch, position: skyPosition(observer, launch, launch.t) })),
    [skyLaunches, observer, end]
  );
  const visibleRows = onlyVisible ? rows.filter((r) => r.position.visibility !== 'below') : rows;
  const inSightCount = rows.filter((r) => r.position.visibility !== 'below').length;

  const selectedPosition = selected ? skyPosition(observer, selected, selected.t) : null;

  return (
    <Container maxW="8xl" py={8}>
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4} mb={6}>
        <Box>
          <Text
            fontFamily="mono"
            fontSize="xs"
            letterSpacing="0.2em"
            color="accent.terminal"
            textTransform="uppercase"
            mb={2}
          >
            Sky
          </Text>
          <Heading as="h1" size="lg" fontWeight="600">
            What launches can you see from here?
          </Heading>
          <Text color="text.secondary" mt={2} maxW="60ch">
            Scrub through the next two weeks. The sky follows the Sun, and every launch shows where to
            look, whether the Earth&apos;s curve hides it, and how the light will fall on the plume.
          </Text>
        </Box>

        <VStack align={{ base: 'stretch', sm: 'flex-end' }} spacing={1}>
          <Menu placement="bottom-end">
            <MenuButton
              as={Button}
              variant="outline"
              size="sm"
              rightIcon={<ChevronDownIcon />}
              isLoading={locating}
              loadingText="Locating"
              aria-label={`Observing from ${observer.label}. Change location.`}
            >
              <Text as="span" noOfLines={1}>
                {observer.label}
              </Text>
              <Text as="span" fontFamily="mono" fontSize="xs" color="text.secondary" ml={2}>
                {formatCoords(observer.lat, observer.lon)}
              </Text>
            </MenuButton>
            <MenuList maxH="60vh" overflowY="auto">
              <MenuItem onClick={locate}>Use my location</MenuItem>
              <MenuItem onClick={resetToGuess}>Guess from my time zone</MenuItem>
              <MenuDivider />
              {VIEWING_SPOTS.map((spot) => (
                <MenuItem key={spot.id} onClick={() => choosePreset(spot.id)}>
                  {spot.label}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
          {locationError ? (
            <Text fontSize="xs" color="orange.300" role="status">
              {locationError}
            </Text>
          ) : (
            <Text fontSize="xs" color="text.secondary">
              Your location never leaves this browser.
            </Text>
          )}
        </VStack>
      </Flex>

      {error && launches.length === 0 && (
        <Box mb={6}>
          <ErrorState
            status="warning"
            title="Launch data is unavailable"
            message="The sky and the Sun still work below; launches will appear once the schedule loads."
            onRetry={() => void refresh()}
          />
        </Box>
      )}
      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} onRefresh={refresh} mb={4} />

      <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1.15fr) minmax(0, 1fr)' }} gap={6} alignItems="start">
        {/* The instrument */}
        <Card p={{ base: 4, md: 6 }}>
          <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
            <ButtonGroup size="sm" isAttached variant="outline" aria-label="View">
              <Button
                onClick={() => setView('sky')}
                aria-pressed={view === 'sky'}
                bg={view === 'sky' ? 'whiteAlpha.200' : undefined}
              >
                Sky
              </Button>
              <Button
                onClick={() => setView('earth')}
                aria-pressed={view === 'earth'}
                bg={view === 'earth' ? 'whiteAlpha.200' : undefined}
              >
                Earth
              </Button>
            </ButtonGroup>
            <HStack spacing={3} fontFamily="mono" fontSize="xs" color="text.secondary">
              <Text>
                SUN {sun.altitude >= 0 ? '+' : '−'}
                {Math.abs(sun.altitude).toFixed(0)}°
              </Text>
              <Text color="text.primary">{PHASE_LABEL[skyPhase(sun.altitude)].toUpperCase()}</Text>
            </HStack>
          </Flex>

          <Box maxW="640px" mx="auto">
            {view === 'sky' ? (
              <SkyDome
                observer={observer}
                time={time}
                pads={pads}
                selectedId={selectedId}
                onSelect={pick}
              />
            ) : (
              <EarthPlan
                observer={observer}
                time={time}
                pads={pads}
                selected={selected}
                onSelect={pick}
              />
            )}
          </Box>

          <HStack spacing={4} wrap="wrap" justify="center" mt={4} fontSize="xs" color="text.secondary">
            {(['plume', 'night', 'day', 'below'] as const).map((key) => (
              <HStack key={key} spacing={1.5}>
                <Box boxSize="8px" rounded="full" bg={VISIBILITY[key].hex} />
                <Text>{VISIBILITY[key].label}</Text>
              </HStack>
            ))}
            {view === 'earth' && (
              <HStack spacing={1.5}>
                <Box w="14px" borderTop="1px dashed" borderColor="accent.purple" />
                <Text>Line of sight</Text>
              </HStack>
            )}
          </HStack>

          <Box mt={6}>
            <TimeScrubber
              start={start}
              spanMinutes={SPAN_MINUTES}
              time={time}
              live={live}
              playing={playing}
              speed={speed}
              launches={skyLaunches}
              selectedId={selectedId}
              onChange={scrubTo}
              onNow={goNow}
              onTogglePlay={() => {
                setLive(false);
                setPlaying((p) => !p);
              }}
              onSpeed={setSpeed}
              onPick={pick}
            />
          </Box>
        </Card>

        {/* The readout */}
        <VStack align="stretch" spacing={4}>
          {selected && selectedPosition && (
            <Card p={5} borderColor="accent.purple">
              <Flex justify="space-between" align="flex-start" gap={3}>
                <Box minW={0}>
                  <Text fontWeight="600" noOfLines={2}>
                    {selected.name}
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    {[selected.rocket, selected.provider].filter(Boolean).join(' · ')}
                  </Text>
                </Box>
                <Badge
                  flexShrink={0}
                  variant="subtle"
                  rounded="full"
                  px={2}
                  color={VISIBILITY[selectedPosition.visibility].token}
                >
                  {VISIBILITY[selectedPosition.visibility].label}
                </Badge>
              </Flex>
              <Text fontFamily="mono" fontSize="sm" mt={3}>
                {whenFormat.format(selected.t)}
              </Text>
              <Text fontSize="sm" color="text.secondary" mt={1}>
                {selected.padName} · {km(selectedPosition.distanceKm)} away, bearing{' '}
                {compass(selectedPosition.azimuth)} ({Math.round(selectedPosition.azimuth)}°)
              </Text>
              <Text fontSize="sm" mt={3}>
                {VISIBILITY[selectedPosition.visibility].detail}
                {selectedPosition.elevation > 0 &&
                  ` At ${PLUME_ALTITUDE_KM} km up the vehicle stands ${selectedPosition.elevation.toFixed(1)}° above your horizon.`}
              </Text>
              <Button
                as={RouterLink}
                to={launchPath({ slug: selected.slug })}
                size="sm"
                variant="outline"
                mt={4}
              >
                Launch details
              </Button>
            </Card>
          )}

          <Card p={{ base: 4, md: 5 }}>
            <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
              <Box>
                <Text fontWeight="600">Next two weeks</Text>
                <Text fontSize="xs" color="text.secondary">
                  {loading
                    ? 'Loading schedule'
                    : `${rows.length} launches, ${inSightCount} in sight from here`}
                </Text>
                {unplaced > 0 && !loading && (
                  <Text fontSize="xs" color="text.secondary">
                    {unplaced} more without a firm launch time {unplaced === 1 ? 'is' : 'are'} left out.
                  </Text>
                )}
              </Box>
              <HStack as="label" spacing={2} fontSize="sm" color="text.secondary" cursor="pointer">
                <Text>In sight only</Text>
                <Switch
                  isChecked={onlyVisible}
                  onChange={(e) => setOnlyVisible(e.target.checked)}
                  colorScheme="brand"
                />
              </HStack>
            </Flex>

            {loading && launches.length === 0 ? (
              <VStack align="stretch" spacing={2}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} h="52px" rounded="md" />
                ))}
              </VStack>
            ) : visibleRows.length === 0 ? (
              <Text fontSize="sm" color="text.secondary" py={4}>
                {onlyVisible
                  ? 'Nothing is in sight from here in the next two weeks. Try another location.'
                  : 'No launches with a pad and a target time are scheduled yet.'}
              </Text>
            ) : (
              <VStack align="stretch" spacing={0} maxH={{ lg: '520px' }} overflowY="auto">
                {visibleRows.map(({ launch, position }) => {
                  const style = VISIBILITY[position.visibility];
                  const isSelected = launch.id === selectedId;
                  return (
                    <Flex
                      as="button"
                      type="button"
                      key={launch.id}
                      onClick={() => pick(launch)}
                      aria-pressed={isSelected}
                      textAlign="left"
                      gap={3}
                      align="center"
                      py={3}
                      px={2}
                      borderTop="1px solid"
                      borderColor="border.default"
                      bg={isSelected ? 'whiteAlpha.100' : undefined}
                      _hover={{ bg: 'whiteAlpha.50' }}
                      _focusVisible={{ outline: '2px solid', outlineColor: 'brand.300', outlineOffset: '-2px' }}
                      opacity={position.visibility === 'below' ? 0.6 : 1}
                    >
                      <Box boxSize="10px" rounded="full" flexShrink={0} bg={style.hex} />
                      <Box flex="1" minW={0}>
                        <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                          {launch.name}
                        </Text>
                        <Text fontSize="xs" color="text.secondary" noOfLines={1}>
                          {whenFormat.format(launch.t)} · {launch.padName}
                        </Text>
                      </Box>
                      <Box textAlign="right" flexShrink={0}>
                        <Text fontSize="xs" color={style.token} fontWeight="600">
                          {style.label}
                        </Text>
                        <Text fontFamily="mono" fontSize="xs" color="text.secondary">
                          {km(position.distanceKm)} · {compass(position.azimuth)}
                        </Text>
                      </Box>
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </Card>
        </VStack>
      </Grid>
    </Container>
  );
}
