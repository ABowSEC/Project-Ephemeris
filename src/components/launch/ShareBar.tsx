import { useState } from 'react';
import { Button, HStack, Icon, Link, useToast } from '@chakra-ui/react';
import { CheckIcon, LinkIcon } from '@chakra-ui/icons';
import { FaRegCalendarPlus, FaGoogle, FaShareAlt } from 'react-icons/fa';
// calendar.js is untyped JS; both helpers take a launch object
import { downloadIcs, googleCalendarUrl } from '../../utils/calendar';
import TrackButton from '../TrackButton';
import type { AnyLaunch } from '../../types/launchLibrary';

/**
 * Share, track, and calendar actions for a launch.
 *
 * Uses the native share sheet where it exists (which is where sharing is
 * actually convenient — phones) and falls back to copying the link. Note that
 * navigator.share is only present in secure contexts, so it is absent over
 * plain-HTTP LAN preview; the copy fallback covers that.
 */
export default function ShareBar({ launch }: { launch: AnyLaunch }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Could not copy the link',
        description: shareUrl,
        status: 'info',
        duration: 6000,
        isClosable: true,
      });
    }
  };

  const share = async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({
        title: launch.name,
        text: `${launch.name} — live countdown and mission details`,
        url: shareUrl,
      });
    } catch {
      // The user dismissed the share sheet. Not an error, and not worth a toast.
    }
  };

  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  return (
    <HStack spacing={2} flexWrap="wrap">
      <TrackButton launch={launch} size="md" />

      <Button
        size="sm"
        variant="outline"
        colorScheme="brand"
        leftIcon={<Icon as={canShare ? FaShareAlt : copied ? CheckIcon : LinkIcon} />}
        onClick={canShare ? share : copyLink}
      >
        {canShare ? 'Share' : copied ? 'Copied' : 'Copy link'}
      </Button>

      <Button
        size="sm"
        variant="outline"
        colorScheme="brand"
        leftIcon={<Icon as={FaRegCalendarPlus} />}
        onClick={() => downloadIcs(launch)}
      >
        Add to calendar
      </Button>

      <Button
        as={Link}
        href={googleCalendarUrl(launch)}
        isExternal
        size="sm"
        variant="outline"
        colorScheme="blue"
        leftIcon={<Icon as={FaGoogle} />}
        _hover={{ textDecoration: 'none' }}
      >
        Google Calendar
      </Button>
    </HStack>
  );
}
