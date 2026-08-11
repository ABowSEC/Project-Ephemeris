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

// A single-select dropdown that looks like the rest of the UI.
//
// This exists because a native <select> can't be made to. Its list is drawn by
// the operating system, outside the page's DOM, and browsers apply CSS to it
// inconsistently — `color` usually lands, `background` usually doesn't, so
// styling it produces washed-out text on a system-white popup rather than a
// dark list. A Menu renders ordinary elements, which style like anything else.
//
// The trade: on phones a native select opens the OS picker, with its big touch
// targets. This is an in-page popup instead — still touch-friendly, but not
// the platform control.

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
  /** What this filters, e.g. "provider". Used for the accessible name. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  maxW?: string;
}) {
  // Falls back to the first option, which is the "no filter" entry
  // ("All providers", "Any status", "All upcoming").
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <Menu placement="bottom-start" autoSelect={false} matchWidth={false}>
      <MenuButton
        type="button"
        aria-label={`Filter by ${label}`}
        // Styled to impersonate the search Input beside it rather than to look
        // like a menu trigger, so the filter row reads as one set of controls.
        // Matches Chakra's size="sm" field metrics.
        h="32px"
        minW="140px"
        maxW={maxW}
        px={3}
        display="flex"
        alignItems="center"
        gap={2}
        borderRadius="md"
        border="1px solid"
        bg="bg.elevated"
        borderColor="border.control"
        color="text.primary"
        fontSize="sm"
        textAlign="left"
        transition="border-color 0.15s"
        _hover={{ borderColor: 'border.controlHover' }}
        _focusVisible={{
          borderColor: 'brand.400',
          boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)',
          outline: 'none',
        }}
        _expanded={{ borderColor: 'brand.400' }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Text as="span" noOfLines={1} flex={1} minW={0}>
            {selected?.label}
          </Text>
          <ChevronDownIcon boxSize={4} flexShrink={0} color="text.secondary" />
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
