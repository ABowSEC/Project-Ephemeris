import {
  Button,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Tooltip,
  type ButtonProps,
} from '@chakra-ui/react';
import type { MouseEvent } from 'react';
import { FaGoogle, FaRegCalendarPlus } from 'react-icons/fa';
import { downloadIcs, googleCalendarUrl } from '../../utils/calendar';
import type { AnyLaunch } from '../../types/launchLibrary';

interface CalendarMenuProps {
  launch: AnyLaunch;
  /** `icon` for tight spots like feed cards; `button` shows a labelled button. */
  variant?: 'icon' | 'button';
  size?: ButtonProps['size'];
}

/**
 * "Add to calendar" with a choice of Google Calendar or an .ics download
 * (Apple Calendar, Outlook, anything else). Clicks stop propagating so it can
 * sit on top of a card-wide link without navigating.
 */
export default function CalendarMenu({ launch, variant = 'icon', size = 'sm' }: CalendarMenuProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <Menu placement="bottom-end" isLazy>
      {({ isOpen }) => (
        <>
          {variant === 'icon' ? (
            <Tooltip label="Add to calendar" hasArrow>
              <MenuButton
                as={IconButton}
                aria-label="Add to calendar"
                icon={<FaRegCalendarPlus />}
                size={size}
                variant="ghost"
                color="text.secondary"
                _hover={{ color: 'brand.300', bg: 'whiteAlpha.100' }}
                onClick={stop}
              />
            </Tooltip>
          ) : (
            <MenuButton
              as={Button}
              size={size}
              variant="outline"
              colorScheme="brand"
              leftIcon={<FaRegCalendarPlus />}
              onClick={stop}
            >
              Add to calendar
            </MenuButton>
          )}
          {/* Portalled so a card's overflow:hidden doesn't clip the list, and
              mounted only while open: a closed popper still sits in the portal
              at its last position, widening the page on narrow screens */}
          {isOpen && (
            <Portal>
              <MenuList bg="bg.card" borderColor="border.default" zIndex="popover" onClick={stop}>
                <MenuItem
                  as="a"
                  href={googleCalendarUrl(launch)}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<FaGoogle />}
                  bg="transparent"
                  _hover={{ bg: 'whiteAlpha.100' }}
                >
                  Google Calendar
                </MenuItem>
                <MenuItem
                  icon={<FaRegCalendarPlus />}
                  onClick={() => downloadIcs(launch)}
                  bg="transparent"
                  _hover={{ bg: 'whiteAlpha.100' }}
                >
                  Apple / Outlook (.ics)
                </MenuItem>
              </MenuList>
            </Portal>
          )}
        </>
      )}
    </Menu>
  );
}
