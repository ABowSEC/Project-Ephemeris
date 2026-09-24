import { Button, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Text, VStack } from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { formatCoords, type Observer } from '../../hooks/useObserver';
import { VIEWING_SPOTS } from '../../data/viewingSpots';

interface ObserverPickerProps {
  observer: Observer;
  locating: boolean;
  locationError: string | null;
  onLocate: () => void;
  onPreset: (id: string) => void;
  onReset: () => void;
}

/** Where you are watching from: device location, a guess, or a well-known spot. */
export default function ObserverPicker({
  observer,
  locating,
  locationError,
  onLocate,
  onPreset,
  onReset,
}: ObserverPickerProps) {
  return (
    <VStack align={{ base: 'stretch', sm: 'flex-start' }} spacing={1}>
      <Menu placement="bottom-start">
        <MenuButton
          as={Button}
          variant="outline"
          size="sm"
          rightIcon={<ChevronDownIcon />}
          whiteSpace="nowrap"
          maxW="100%"
          isLoading={locating}
          loadingText="Locating"
          aria-label={`Watching from ${observer.label}. Change location.`}
        >
          <Text as="span" color="text.secondary" mr={2}>
            Watching from
          </Text>
          <Text as="span">{observer.label}</Text>
          <Text
            as="span"
            display={{ base: 'none', sm: 'inline' }}
            fontFamily="mono"
            fontSize="xs"
            color="text.secondary"
            ml={2}
          >
            {formatCoords(observer.lat, observer.lon)}
          </Text>
        </MenuButton>
        <MenuList maxH="60vh" overflowY="auto">
          <MenuItem onClick={onLocate}>Use my location</MenuItem>
          <MenuItem onClick={onReset}>Guess from my time zone</MenuItem>
          <MenuDivider />
          {VIEWING_SPOTS.map((spot) => (
            <MenuItem key={spot.id} onClick={() => onPreset(spot.id)}>
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
          Your location stays in this browser.
        </Text>
      )}
    </VStack>
  );
}
