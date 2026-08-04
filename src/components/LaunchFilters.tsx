import {
  Button,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { FaStar } from 'react-icons/fa';
import { FILTERABLE_STATUSES } from '../data/launchStatus';
import type { LaunchFilterState } from '../hooks/useLaunchFilters';

const TIMEFRAMES = [
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
  { value: '90', label: 'Next 90 days' },
  { value: 'all', label: 'All upcoming' },
];

/** The controls themselves. State comes from useLaunchFilters. */
export default function LaunchFilters({ state }: { state: LaunchFilterState }) {
  const { values, setFilter, reset, providers, trackedCount, activeCount, filtered, total } = state;

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
              bg="bg.card"
              borderColor="border.default"
              aria-label="Search launches"
            />
          </InputGroup>
        </WrapItem>

        <WrapItem>
          <Select
            size="sm"
            borderRadius="md"
            bg="bg.card"
            borderColor="border.default"
            value={values.provider}
            onChange={(e) => setFilter('provider', e.target.value)}
            aria-label="Filter by provider"
            maxW="220px"
          >
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </Select>
        </WrapItem>

        <WrapItem>
          <Select
            size="sm"
            borderRadius="md"
            bg="bg.card"
            borderColor="border.default"
            value={values.status}
            onChange={(e) => setFilter('status', e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            {FILTERABLE_STATUSES.map(({ abbrev, label }) => (
              <option key={abbrev} value={abbrev}>
                {label}
              </option>
            ))}
          </Select>
        </WrapItem>

        <WrapItem>
          <Select
            size="sm"
            borderRadius="md"
            bg="bg.card"
            borderColor="border.default"
            value={values.days}
            onChange={(e) => setFilter('days', e.target.value)}
            aria-label="Filter by timeframe"
          >
            {TIMEFRAMES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
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
