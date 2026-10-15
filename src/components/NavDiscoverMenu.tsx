import { Link as RouterLink } from 'react-router-dom';
import { Button, Menu, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { DISCOVER_NAV } from '../data/navigation';

/**
 * Secondary sections of the site, grouped under one "Discover" tab so the
 * top bar stays focused on launches. The mobile drawer lists the same items
 * under a heading instead.
 */
export default function NavDiscoverMenu({ isActive }: { isActive: boolean }) {
  return (
    <Menu placement="bottom-start" isLazy>
      <MenuButton
        as={Button}
        rightIcon={<ChevronDownIcon />}
        variant="ghost"
        size="sm"
        px={3}
        fontSize="sm"
        fontWeight={isActive ? '600' : '400'}
        color={isActive ? 'brand.300' : 'text.secondary'}
        _hover={{ color: isActive ? 'brand.200' : 'white', bg: 'whiteAlpha.50' }}
        _active={{ bg: 'whiteAlpha.100' }}
      >
        Discover
      </MenuButton>
      <MenuList bg="bg.card" borderColor="border.default" py={1} minW="240px">
        {DISCOVER_NAV.map(({ path, label, blurb }) => (
          <MenuItem
            key={path}
            as={RouterLink}
            to={path}
            bg="transparent"
            _hover={{ bg: 'whiteAlpha.100' }}
            _focus={{ bg: 'whiteAlpha.100' }}
            flexDirection="column"
            alignItems="start"
            py={2}
          >
            <Text fontSize="sm" color="text.primary">{label}</Text>
            {blurb && <Text fontSize="xs" color="text.secondary">{blurb}</Text>}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}
