import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  IconButton,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
} from '@chakra-ui/react';
import { FaPause, FaPlay } from 'react-icons/fa';
import { SPEEDS, type SkyLaunch } from './skyLaunches';

const stamp = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const utcStamp = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface TimeScrubberProps {
  /** Left end of the track, ms. */
  start: number;
  /** Length of the track, minutes. */
  spanMinutes: number;
  time: number;
  live: boolean;
  playing: boolean;
  speed: number;
  launches: SkyLaunch[];
  selectedId: string | null;
  onChange: (time: number) => void;
  onNow: () => void;
  onTogglePlay: () => void;
  onSpeed: (index: number) => void;
  onPick: (launch: SkyLaunch) => void;
}

/**
 * The timeline under both views. Every launch is a tick on the track, so the
 * shape of the next two weeks is visible at a glance and a tick is a jump.
 */
export default function TimeScrubber({
  start,
  spanMinutes,
  time,
  live,
  playing,
  speed,
  launches,
  selectedId,
  onChange,
  onNow,
  onTogglePlay,
  onSpeed,
  onPick,
}: TimeScrubberProps) {
  const minutes = Math.max(0, Math.min(spanMinutes, (time - start) / 60_000));

  return (
    <Box>
      <Flex align="baseline" justify="space-between" wrap="wrap" gap={2} mb={3}>
        <Box>
          <Text
            fontFamily="mono"
            fontSize="lg"
            fontWeight="600"
            color={live ? 'accent.terminal' : 'text.primary'}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {stamp.format(time)}
          </Text>
          <Text fontFamily="mono" fontSize="xs" color="text.secondary">
            {utcStamp.format(time)} UTC{live ? ' · LIVE' : ''}
          </Text>
        </Box>
        <HStack spacing={2}>
          <IconButton
            aria-label={playing ? 'Pause time' : 'Play time forward'}
            icon={playing ? <FaPause /> : <FaPlay />}
            size="sm"
            variant="outline"
            onClick={onTogglePlay}
          />
          <ButtonGroup size="xs" isAttached variant="outline" aria-label="Playback speed">
            {SPEEDS.map((s, i) => (
              <Button
                key={s.label}
                onClick={() => onSpeed(i)}
                aria-pressed={speed === i}
                bg={speed === i ? 'whiteAlpha.200' : undefined}
                fontFamily="mono"
              >
                {s.label}
              </Button>
            ))}
          </ButtonGroup>
          <Button size="sm" variant="outline" onClick={onNow} isDisabled={live}>
            Now
          </Button>
        </HStack>
      </Flex>

      {/* Launch ticks */}
      <Box position="relative" h="16px" mx="7px">
        {launches.map((launch) => {
          const pct = ((launch.t - start) / 60_000 / spanMinutes) * 100;
          if (pct < 0 || pct > 100) return null;
          const selected = launch.id === selectedId;
          return (
            <Box
              as="button"
              key={launch.id}
              type="button"
              aria-label={`Jump to ${launch.name}`}
              title={launch.name}
              onClick={() => onPick(launch)}
              position="absolute"
              left={`${pct}%`}
              bottom={0}
              w="12px"
              h="16px"
              ml="-6px"
              display="flex"
              justifyContent="center"
              alignItems="flex-end"
              _hover={{ '& > span': { bg: 'brand.300', h: '14px' } }}
              _focusVisible={{ outline: '2px solid', outlineColor: 'brand.300' }}
            >
              <Box
                as="span"
                w="2px"
                h={selected ? '16px' : '10px'}
                bg={selected ? '#9F7AEA' : 'whiteAlpha.500'}
                transition="height 0.15s, background 0.15s"
              />
            </Box>
          );
        })}
      </Box>

      <Slider
        aria-label="Time"
        min={0}
        max={spanMinutes}
        step={5}
        value={minutes}
        focusThumbOnChange={false}
        onChange={(m) => onChange(start + m * 60_000)}
      >
        <SliderTrack bg="whiteAlpha.200">
          <SliderFilledTrack bg="brand.400" />
        </SliderTrack>
        <SliderThumb boxSize={4} bg="brand.300" />
      </Slider>
      <Flex justify="space-between" mt={1} fontFamily="mono" fontSize="10px" color="text.secondary">
        <Text>NOW</Text>
        <Text>+{Math.round(spanMinutes / 60 / 24)} DAYS</Text>
      </Flex>
    </Box>
  );
}
