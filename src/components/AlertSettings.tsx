import { Box, Button, Tooltip, useToast } from '@chakra-ui/react';
import { FaBell, FaRegBell } from 'react-icons/fa';
import { useAlertsEnabled } from '../hooks/useLaunchAlerts';

/**
 * Bell toggle for launch alerts, sized to sit beside the feed's Tracked
 * filter: alerts only ever fire for tracked launches, so the two controls
 * belong together. Enabling requests browser notification permission; if
 * it's unavailable or denied, alerts still work as in-app toasts while the
 * site is open.
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

  const label = enabled
    ? 'Launch alerts on: tracked launches notify you at T-60min, T-10min, and liftoff'
    : 'Turn on alerts for tracked launches';

  return (
    <Tooltip label={label} hasArrow>
      {/* A toggle keeps one fixed name and lets aria-pressed carry the
          state; the visible label drops to icon-only on phones, where the
          tooltip can't be hovered */}
      <Button
        aria-label="Launch alerts"
        aria-pressed={enabled}
        leftIcon={enabled ? <FaBell /> : <FaRegBell />}
        iconSpacing={{ base: 0, sm: 2 }}
        size="sm"
        variant={enabled ? 'solid' : 'outline'}
        colorScheme="orange"
        onClick={() => (enabled ? setEnabled(false) : enableAlerts())}
      >
        <Box as="span" display={{ base: 'none', sm: 'inline' }}>
          Alerts
        </Box>
      </Button>
    </Tooltip>
  );
}
