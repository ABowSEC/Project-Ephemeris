import { Button, HStack, Icon, Text, useToast } from '@chakra-ui/react';
import { FaBell, FaRegBell } from 'react-icons/fa';
import { useAlertsEnabled } from '../hooks/useLaunchAlerts';

/**
 * Toggle for launch alerts. Enabling requests browser notification
 * permission; if it's unavailable or denied, alerts still work as
 * in-app toasts while the site is open.
 */
export default function AlertSettings() {
  const { enabled, setEnabled } = useAlertsEnabled();
  const toast = useToast();

  const enableAlerts = async () => {
    setEnabled(true);

    if (typeof Notification === 'undefined') {
      toast({
        title: 'Alerts enabled (in-app only)',
        description: 'This browser does not support system notifications.',
        status: 'info',
        duration: 6000,
        isClosable: true,
      });
      return;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = Notification.permission;
      }
    }

    toast({
      title: 'Launch alerts enabled',
      description:
        permission === 'granted'
          ? 'Tracked launches will notify you at T-60min, T-10min, and liftoff.'
          : 'Notifications are blocked, so alerts will appear as in-app messages only.',
      status: permission === 'granted' ? 'success' : 'warning',
      duration: 6000,
      isClosable: true,
    });
  };

  return (
    <HStack spacing={3} flexShrink={0}>
      <Text fontSize="sm" color="text.secondary" display={{ base: 'none', sm: 'block' }}>
        Launch alerts
      </Text>
      <Button
        size="sm"
        variant={enabled ? 'solid' : 'outline'}
        colorScheme="orange"
        leftIcon={<Icon as={enabled ? FaBell : FaRegBell} />}
        onClick={() => (enabled ? setEnabled(false) : enableAlerts())}
      >
        {enabled ? 'On' : 'Off'}
      </Button>
    </HStack>
  );
}
