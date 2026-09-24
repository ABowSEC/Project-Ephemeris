import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Grid, HStack, Text, VStack } from '@chakra-ui/react';
import type { Observer } from '../../hooks/useObserver';
import { skyPhase, sunHorizontal } from '../../utils/sky';
import EarthPlan from './EarthPlan';
import SkyDome from './SkyDome';
import TimeScrubber from './TimeScrubber';
import { SPEEDS, VISIBILITY, type PadGroup, type SkyLaunch } from './skyLaunches';
import { VERDICT } from './skyText';

const SPAN_MINUTES = 14 * 24 * 60;
const LIVE_TICK_MS = 30_000;

const PHASE_LABEL = {
  day: 'daylight',
  civil: 'civil twilight',
  nautical: 'nautical twilight',
  astronomical: 'deep twilight',
  night: 'night',
} as const;

interface SkyExplorerProps {
  observer: Observer;
  pads: PadGroup[];
  skyLaunches: SkyLaunch[];
  selected: SkyLaunch | null;
  onSelect: (launch: SkyLaunch) => void;
}

/**
 * The instrument: the whole sky overhead, the Earth with its day/night line,
 * and a timeline to scrub through the next two weeks. It follows the launch in
 * focus, so picking one anywhere jumps the clock to its liftoff.
 */
export default function SkyExplorer({
  observer,
  pads,
  skyLaunches,
  selected,
  onSelect,
}: SkyExplorerProps) {
  // The track starts when the panel opens and stays put while the clock moves
  const [start] = useState(() => Date.now());
  const end = start + SPAN_MINUTES * 60_000;
  const [time, setTime] = useState(start);
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const scrubTo = useCallback(
    (t: number) => {
      setLive(false);
      setTime(Math.max(start, Math.min(end, t)));
    },
    [start, end]
  );

  // Follow the launch in focus, but not on first paint: opening the panel
  // should show the sky as it is now, not jump somewhere.
  const selectedId = selected?.id ?? null;
  const selectedTime = selected?.t ?? null;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (selectedTime != null) {
      setPlaying(false);
      scrubTo(selectedTime);
    }
  }, [selectedId, selectedTime, scrubTo]);

  useEffect(() => {
    if (!live) return;
    setTime(Date.now());
    const id = setInterval(() => setTime(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(id);
  }, [live]);

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

  const sun = sunHorizontal(observer.lat, observer.lon, time);

  return (
    <VStack align="stretch" spacing={6}>
      <Text color="text.secondary" maxW="70ch">
        The dome is the sky straight above you: the centre is overhead and the edge is the horizon.
        Dots on the ring outside it are launches hidden by the curve of the Earth. Picking a launch here
        updates the answer above.
      </Text>

      <Grid
        templateColumns={{ base: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 1fr)' }}
        gap={{ base: 6, lg: 8 }}
        alignItems="center"
      >
        <Box maxW="640px" w="100%" mx="auto">
          <SkyDome
            observer={observer}
            time={time}
            pads={pads}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </Box>

        <VStack spacing={4}>
          <Box w="100%" maxW="340px">
            <EarthPlan
              observer={observer}
              time={time}
              pads={pads}
              selected={selected}
              onSelect={onSelect}
            />
          </Box>
          <Text fontSize="sm" color="text.secondary" textAlign="center" maxW="44ch">
            <Text as="span" color="text.primary" fontWeight="500">
              Sun {sun.altitude >= 0 ? '+' : '−'}
              {Math.abs(sun.altitude).toFixed(0)}°
            </Text>{' '}
            where you are: {PHASE_LABEL[skyPhase(sun.altitude)]}. Bright dots are in daylight, purple in
            twilight, dim in night. The dashed ring is how far a rocket is still above your horizon.
          </Text>
          <HStack spacing={4} wrap="wrap" justify="center" fontSize="xs" color="text.secondary">
            {(['plume', 'night', 'day', 'below'] as const).map((key) => (
              <HStack key={key} spacing={1.5}>
                <Box boxSize="8px" rounded="full" bg={VISIBILITY[key].hex} />
                <Text>{VERDICT[key].chip}</Text>
              </HStack>
            ))}
          </HStack>
        </VStack>
      </Grid>

      <Box bg="bg.body" border="1px solid" borderColor="border.default" rounded="xl" p={4}>
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
          onNow={() => {
            setPlaying(false);
            setLive(true);
          }}
          onTogglePlay={() => {
            setLive(false);
            setPlaying((p) => !p);
          }}
          onSpeed={setSpeed}
          onPick={onSelect}
        />
      </Box>
    </VStack>
  );
}
