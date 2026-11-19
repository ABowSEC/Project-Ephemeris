import { useMemo, type ReactNode } from 'react';
import { Box, Button, Flex, HStack, Input, InputGroup, InputLeftElement, Text, VStack } from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { FaRegStar, FaStar } from 'react-icons/fa';
import FilterSelect from './FilterSelect';
import { filterChip } from './filterChip';
import { FILTERABLE_STATUSES } from '../data/launchStatus';
import type { LaunchFilterState } from '../hooks/useLaunchFilters';

// The first entry of each list is the "no filter" state, and FilterSelect
// shows its own label while that is selected.
const TIMEFRAMES = [
  { value: 'all', label: 'All upcoming' },
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
  { value: '90', label: 'Next 90 days' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...FILTERABLE_STATUSES.map(({ abbrev, label }) => ({ value: abbrev, label })),
];

interface LaunchFiltersProps {
  state: LaunchFilterState;
  /** Rendered after the Tracked toggle (the alerts bell), so tracking controls stay together. */
  trackingControls?: ReactNode;
}

/**
 * Search plus one row of filter chips. On phones the chips scroll sideways
 * instead of stacking. State comes from useLaunchFilters.
 */
export default function LaunchFilters({ state, trackingControls }: LaunchFiltersProps) {
  const { values, setFilter, reset, providers, trackedCount, activeCount, filtered, total } = state;
  const trackedOn = values.tracked === '1';

  // providers is rebuilt whenever the feed changes; this keeps the option
  // array stable between those changes.
  const providerOptions = useMemo(
    () => [
      { value: '', label: 'All providers' },
      ...providers.map((provider) => ({ value: provider, label: provider })),
    ],
    [providers]
  );

  return (
    <VStack align="stretch" spacing={3} role="search">
      <Flex gap={2.5} direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }} wrap={{ md: 'wrap' }}>
        <InputGroup flex={{ md: '1 1 260px' }} minW={{ md: '220px' }}>
          <InputLeftElement pointerEvents="none" h="44px">
            <SearchIcon color="text.secondary" boxSize={3.5} />
          </InputLeftElement>
          <Input
            h="44px"
            value={values.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder="Search missions, rockets, providers"
            aria-label="Search launches"
          />
        </InputGroup>

        <HStack
          spacing={2}
          overflowX={{ base: 'auto', md: 'visible' }}
          flexWrap={{ base: 'nowrap', md: 'wrap' }}
          mx={{ base: -4, md: 0 }}
          px={{ base: 4, md: 0 }}
          pb={{ base: 0.5, md: 0 }}
          sx={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
        >
          <FilterSelect
            label="Timeframe"
            value={values.days}
            options={TIMEFRAMES}
            onChange={(value) => setFilter('days', value)}
          />
          <FilterSelect
            label="Provider"
            value={values.provider}
            options={providerOptions}
            onChange={(value) => setFilter('provider', value)}
            maxW="220px"
          />
          <FilterSelect
            label="Status"
            value={values.status}
            options={STATUS_OPTIONS}
            onChange={(value) => setFilter('status', value)}
          />
          <Button
            {...filterChip}
            textTransform="none"
            letterSpacing="normal"
            aria-pressed={trackedOn}
            leftIcon={<Box as={trackedOn ? FaStar : FaRegStar} color="accent.tracked" boxSize={3.5} />}
            borderColor={trackedOn ? 'accent.tracked' : 'border.control'}
            color={trackedOn ? 'accent.tracked' : 'text.primary'}
            onClick={() => setFilter('tracked', trackedOn ? '' : '1')}
          >
            Tracked
            {trackedCount > 0 && (
              <Text as="span" color="text.secondary" ml={1.5}>
                {trackedCount}
              </Text>
            )}
          </Button>
          {trackingControls}
        </HStack>
      </Flex>

      <HStack spacing={3} fontSize="sm" color="text.secondary" minH="24px">
        <Text as="span" aria-live="polite">
          <Text as="span" color="text.primary" fontWeight="600">
            {filtered.length}
          </Text>{' '}
          of {total} launches
        </Text>
        {activeCount > 0 && (
          <Button variant="link" size="sm" color="accent.primary" textTransform="none" letterSpacing="normal" fontWeight="500" onClick={reset}>
            Clear filters
          </Button>
        )}
      </HStack>
    </VStack>
  );
}
