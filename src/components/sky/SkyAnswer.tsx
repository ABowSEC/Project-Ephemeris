import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { launchPath } from '../../utils/launchFields';
import { compass, skyPosition } from '../../utils/sky';
import type { SkyModel } from '../../hooks/useSkyModel';
import Card from '../Card';
import ErrorState from '../ErrorState';
import StaleDataNotice from '../StaleDataNotice';
import HorizonStrip from './HorizonStrip';
import ObserverPicker from './ObserverPicker';
import { VISIBILITY, type SkyLaunch } from './skyLaunches';
import {
  VERDICT,
  directionName,
  fistsAbove,
  fistsUp,
  missionName,
  placeName,
  relativeTime,
} from './skyText';

const whenFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const km = (n: number) => `${Math.round(n).toLocaleString()} km`;

/**
 * The plain answer to "can I see a launch from here?": one launch in focus,
 * what it will look like from where you stand, and a short list of the others
 * worth watching. Everything technical lives in the Explore panel below it.
 */
export default function SkyAnswer({ model }: { model: SkyModel }) {
  const {
    observer,
    locating,
    locationError,
    locate,
    choosePreset,
    resetToGuess,
    loading,
    error,
    launches,
    stale,
    fetchedAt,
    refresh,
    ahead,
    unplaced,
    selected,
    select,
    now,
  } = model;

  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(
    () =>
      ahead
        .map((launch) => ({ launch, position: skyPosition(observer, launch, launch.t) }))
        .filter((row) => showAll || row.position.visibility !== 'below'),
    [ahead, observer, showAll]
  );

  const position = selected ? skyPosition(observer, selected, selected.t) : null;
  const verdict = position ? VERDICT[position.visibility] : null;
  const style = position ? VISIBILITY[position.visibility] : null;
  const place = placeName(observer);

  const picker = (
    <ObserverPicker
      observer={observer}
      locating={locating}
      locationError={locationError}
      onLocate={locate}
      onPreset={choosePreset}
      onReset={resetToGuess}
    />
  );

  return (
    <Grid
      templateColumns={{ base: '1fr', lg: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}
      gap={{ base: 6, lg: 8 }}
      alignItems="start"
    >
      <Card p={{ base: 5, md: 7 }} aria-live="polite">
        <Box mb={5}>{picker}</Box>

        {error && launches.length === 0 && (
          <ErrorState
            status="warning"
            title="The launch schedule is unavailable"
            message="It will appear here as soon as it loads."
            onRetry={() => void refresh()}
          />
        )}

        {loading && launches.length === 0 && (
          <VStack align="stretch" spacing={4}>
            <Skeleton h="14px" w="180px" />
            <Skeleton h="40px" w="70%" />
            <Skeleton h="220px" rounded="lg" />
          </VStack>
        )}

        {!loading && !error && !selected && (
          <Text color="text.secondary">
            No upcoming launches have a firm time and pad yet. Check back soon.
          </Text>
        )}

        {selected && position && verdict && style && (
          <Box>
            <Text
              fontFamily="mono"
              fontSize="xs"
              letterSpacing="0.16em"
              textTransform="uppercase"
              color={style.token}
            >
              {verdict.question}
            </Text>
            <Heading
              as="h1"
              mt={2}
              fontSize="clamp(1.5rem, 3.6vw, 2.25rem)"
              lineHeight="1.15"
              sx={{ textWrap: 'balance' }}
            >
              {missionName(selected.name)}
            </Heading>
            <Text color="text.secondary" mt={1}>
              {[selected.rocket, selected.provider].filter(Boolean).join(' · ')} · from {selected.padName},{' '}
              {km(position.distanceKm)} away
            </Text>
            <Text fontFamily="mono" fontSize="lg" color="accent.terminal" mt={4} mb={4}>
              {selected.t > now
                ? `Lifts off in ${relativeTime(selected.t - now)}`
                : `Lifted off ${relativeTime(now - selected.t)} ago`}
            </Text>

            <HorizonStrip observer={observer} launch={selected} />
            <Text fontSize="xs" color="text.secondary" mt={2}>
              The sky as it will look at liftoff, {whenFormat.format(selected.t)}, from {place}.
            </Text>

            <VStack align="flex-start" spacing={3} mt={5} pt={5} borderTop="1px solid" borderColor="border.default">
              <Flex
                align="center"
                gap={2}
                px={3}
                py={1}
                rounded="full"
                border="1px solid"
                borderColor={style.token}
                color={style.token}
                fontFamily="mono"
                fontSize="xs"
                fontWeight="600"
                letterSpacing="0.06em"
                textTransform="uppercase"
              >
                <Box boxSize="8px" rounded="full" bg="currentColor" />
                {verdict.chip}
              </Flex>
              <Text fontSize="lg" maxW="56ch">
                {position.visibility === 'below'
                  ? `It launches to the ${directionName(position.azimuth)}. Try a different location, or pick another launch.`
                  : `Face ${directionName(position.azimuth)}. Look low, ${fistsAbove(position.elevation)} above the horizon (a fist held at arm's length is about 10°).`}
              </Text>
              <Text color="text.secondary" maxW="58ch">
                {verdict.why} Clouds and terrain are not included.
              </Text>
              <Button as={RouterLink} to={launchPath({ slug: selected.slug })} size="sm" variant="outline">
                Launch details
              </Button>
            </VStack>
          </Box>
        )}
      </Card>

      <Box>
        <Heading
          as="h2"
          fontSize="xs"
          fontFamily="heading"
          letterSpacing="0.14em"
          textTransform="uppercase"
          mb={1}
        >
          Your next chances
        </Heading>
        <Text fontSize="sm" color="text.secondary" mb={3}>
          {showAll
            ? 'Every upcoming launch, with how well you can see it.'
            : 'Launches you can see from here. Pick one to update the view.'}
        </Text>

        <VStack align="stretch" spacing={2}>
          {rows.length === 0 && !loading && (
            <Card p={4} color="text.secondary" fontSize="sm">
              Nothing upcoming is in sight from here. Try another location, or show every launch.
            </Card>
          )}
          {rows.slice(0, showAll ? 12 : 6).map(({ launch, position: p }) => (
            <LaunchRow
              key={launch.id}
              launch={launch}
              position={p}
              selected={launch.id === selected?.id}
              onSelect={select}
            />
          ))}
        </VStack>

        <Checkbox
          mt={4}
          size="sm"
          colorScheme="brand"
          isChecked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        >
          <Text as="span" fontSize="sm" color="text.secondary">
            Also show launches too far to see
          </Text>
        </Checkbox>

        {unplaced > 0 && !loading && (
          <Text fontSize="xs" color="text.secondary" mt={3}>
            {unplaced} more without a firm launch time {unplaced === 1 ? 'is' : 'are'} left out.
          </Text>
        )}
        <StaleDataNotice stale={stale} fetchedAt={fetchedAt} onRefresh={refresh} mt={3} />
      </Box>
    </Grid>
  );
}

function LaunchRow({
  launch,
  position,
  selected,
  onSelect,
}: {
  launch: SkyLaunch;
  position: ReturnType<typeof skyPosition>;
  selected: boolean;
  onSelect: (launch: SkyLaunch) => void;
}) {
  const style = VISIBILITY[position.visibility];
  return (
    <Flex
      as="button"
      type="button"
      onClick={() => onSelect(launch)}
      aria-pressed={selected}
      textAlign="left"
      gap={3}
      align="center"
      w="100%"
      px={4}
      py={3}
      bg={selected ? 'bg.elevated' : 'bg.card'}
      border="1px solid"
      borderColor={selected ? 'accent.purple' : 'border.default'}
      rounded="xl"
      _hover={{ borderColor: selected ? 'accent.purple' : 'border.control' }}
      _focusVisible={{ outline: '2px solid', outlineColor: 'brand.300', outlineOffset: '2px' }}
    >
      <Box boxSize="10px" rounded="full" flexShrink={0} bg={style.hex} />
      <Box flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="600" noOfLines={1}>
          {launch.name}
        </Text>
        <Text fontSize="xs" color="text.secondary" noOfLines={1}>
          {whenFormat.format(launch.t)} · {VERDICT[position.visibility].chip}
        </Text>
      </Box>
      <Box textAlign="right" flexShrink={0}>
        <Text fontSize="sm" fontWeight="600">
          {compass(position.azimuth)}
        </Text>
        <Text fontSize="xs" color="text.secondary">
          {position.visibility === 'below' ? 'hidden' : fistsUp(position.elevation)}
        </Text>
      </Box>
    </Flex>
  );
}
