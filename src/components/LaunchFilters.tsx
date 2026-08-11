import { useMemo } from 'react';
import {
  Button,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { FaStar } from 'react-icons/fa';
import FilterSelect from './FilterSelect';
import { FILTERABLE_STATUSES } from '../data/launchStatus';
import type { LaunchFilterState } from '../hooks/useLaunchFilters';

// The first entry of each list is the "no filter" state, and FilterSelect
// falls back to it when nothing is selected.
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

/** The controls themselves. State comes from useLaunchFilters. */
export default function LaunchFilters({ state }: { state: LaunchFilterState }) {
  const { values, setFilter, reset, providers, trackedCount, activeCount, filtered, total } = state;

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
    <>
      <Wrap spacing={3} align="center">
        <WrapItem flex="1 1 240px" minW="200px">
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="text.secondary" boxSize={3} />
            </InputLeftElement>
            <Input
              value={values.q}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="Search missions, rockets, providers"
              borderRadius="md"
              aria-label="Search launches"
            />
          </InputGroup>
        </WrapItem>

        <WrapItem>
          <FilterSelect
            label="provider"
            value={values.provider}
            options={providerOptions}
            onChange={(value) => setFilter('provider', value)}
            maxW="220px"
          />
        </WrapItem>

        <WrapItem>
          <FilterSelect
            label="status"
            value={values.status}
            options={STATUS_OPTIONS}
            onChange={(value) => setFilter('status', value)}
          />
        </WrapItem>

        <WrapItem>
          <FilterSelect
            label="timeframe"
            value={values.days}
            options={TIMEFRAMES}
            onChange={(value) => setFilter('days', value)}
          />
        </WrapItem>

        <WrapItem>
          <Button
            size="sm"
            variant={values.tracked === '1' ? 'solid' : 'outline'}
            colorScheme="orange"
            leftIcon={<Icon as={FaStar} boxSize={3} />}
            onClick={() => setFilter('tracked', values.tracked === '1' ? '' : '1')}
          >
            Tracked{trackedCount > 0 ? ` (${trackedCount})` : ''}
          </Button>
        </WrapItem>

        {activeCount > 0 && (
          <WrapItem>
            <Button size="sm" variant="ghost" leftIcon={<CloseIcon boxSize={2} />} onClick={reset}>
              Clear
            </Button>
          </WrapItem>
        )}
      </Wrap>

      {activeCount > 0 && (
        <HStack spacing={1}>
          <Text fontSize="sm" color="text.secondary">
            {filtered.length} of {total} launches match
          </Text>
        </HStack>
      )}
    </>
  );
}
