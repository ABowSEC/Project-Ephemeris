import {
  Box,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Portal,
  Text,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { filterChip, filterChipActive } from './filterChip';

// Dropdown built on Menu, since a native <select>'s popup can't be styled
// dark reliably. Trade-off: phones get an in-page list, not the OS picker.

export interface FilterOption {
  value: string;
  label: string;
}

export default function FilterSelect({
  label,
  value,
  options,
  onChange,
  maxW,
}: {
  /** What this filters, e.g. "Provider". Shown while unset, and the accessible name. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  maxW?: string;
}) {
  // Falls back to the first option, which is the "no filter" entry
  // ("All providers", "Any status", "All upcoming").
  const selected = options.find((option) => option.value === value) ?? options[0];
  const active = selected !== options[0];

  return (
    // isLazy: a closed list would otherwise still render every option in the
    // portal, and long provider names widen the page on phones
    <Menu placement="bottom-start" autoSelect={false} matchWidth={false} isLazy>
      <MenuButton
        type="button"
        aria-label={`Filter by ${label.toLowerCase()}: ${selected?.label}`}
        maxW={maxW}
        {...filterChip}
        {...(active ? filterChipActive : {})}
        _expanded={{ borderColor: 'accent.primary' }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Text as="span" noOfLines={1} flex={1} minW={0}>
            {active ? selected?.label : label}
          </Text>
          <ChevronDownIcon boxSize={4} flexShrink={0} color={active ? 'accent.primary' : 'text.secondary'} />
        </Box>
      </MenuButton>

      {/* Portalled so the list escapes the Wrap's stacking context instead of
          being clipped by it. */}
      <Portal>
        <MenuList
          // The provider list is built from whatever is in the 50-launch feed
          // and can run well past 30 entries.
          maxH="320px"
          overflowY="auto"
          minW="200px"
        >
          <MenuOptionGroup
            type="radio"
            value={value}
            // Chakra types this as string | string[] for the shared checkbox
            // case; radio groups always hand back a single value.
            onChange={(next) => onChange(next as string)}
          >
            {options.map((option) => (
              <MenuItemOption key={option.value} value={option.value} fontSize="sm">
                {option.label}
              </MenuItemOption>
            ))}
          </MenuOptionGroup>
        </MenuList>
      </Portal>
    </Menu>
  );
}
