import { Badge, Box, Button, HStack, Icon, Link, Text, VStack } from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaYoutube, FaVimeo, FaBroadcastTower } from 'react-icons/fa';
import { embeddableVideo, officialWebcast, webcasts } from '../../utils/launchFields';
import { hasFlown } from '../../data/launchStatus';
import type { AnyLaunch, LaunchDetailed, VideoUrl } from '../../types/launchLibrary';

/**
 * The official webcast, embedded where the CSP allows it.
 *
 * public/_headers permits frames only from YouTube and Vimeo. Webcasts are
 * frequently hosted elsewhere — SpaceX has largely moved to x.com broadcasts —
 * and an iframe pointing at one of those is silently blank in production while
 * working fine in dev. So embeddability is checked, never assumed, and
 * anything else becomes a labelled outbound link.
 */
export default function WebcastPanel({ launch }: { launch: AnyLaunch }) {
  const primary = officialWebcast(launch);
  const all = webcasts(launch);
  const others = all.filter((v) => v !== primary);

  if (!primary) return null;

  const flown = hasFlown(launch.status);
  const isLive = Boolean((launch as LaunchDetailed).webcast_live);
  const embed = embeddableVideo(primary.url);

  return (
    <Box
      bg="bg.card"
      border="1px solid"
      borderColor="border.default"
      borderRadius="xl"
      overflow="hidden"
    >
      <HStack px={5} py={3} justify="space-between" borderBottom="1px solid" borderColor="border.default">
        <HStack spacing={2}>
          <Icon as={FaBroadcastTower} color="text.secondary" />
          <Text fontWeight="600">{flown ? 'Replay' : 'Official Webcast'}</Text>
        </HStack>
        {isLive && (
          <Badge colorScheme="red" borderRadius="full" px={3}>
            Live now
          </Badge>
        )}
      </HStack>

      {embed ? (
        <Box position="relative" pt="56.25%">
          <Box
            as="iframe"
            src={embed.embedUrl}
            title={primary.title ?? 'Launch webcast'}
            position="absolute"
            inset={0}
            w="100%"
            h="100%"
            border="none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </Box>
      ) : (
        <OutboundWebcast video={primary} flown={flown} />
      )}

      {others.length > 0 && (
        <VStack align="stretch" spacing={1} px={5} py={3} borderTop="1px solid" borderColor="border.default">
          <Text fontSize="xs" color="text.secondary" textTransform="uppercase" letterSpacing="wider">
            Other coverage
          </Text>
          {others.map((video) => (
            <Link
              key={video.url}
              href={video.url}
              isExternal
              fontSize="sm"
              color="brand.300"
              _hover={{ color: 'brand.200' }}
            >
              {video.publisher ?? video.source ?? 'Stream'}
              {video.title ? ` — ${video.title}` : ''} <ExternalLinkIcon mx="2px" mb="2px" />
            </Link>
          ))}
        </VStack>
      )}
    </Box>
  );
}

/** Card for a webcast we are not allowed to frame. */
function OutboundWebcast({ video, flown }: { video: VideoUrl; flown: boolean }) {
  const publisher = video.publisher ?? video.source ?? 'the broadcaster';
  const icon = video.url.includes('vimeo') ? FaVimeo : FaYoutube;

  return (
    <VStack align="stretch" spacing={3} p={5}>
      <Text fontSize="sm" color="text.secondary">
        {flown ? 'The replay is hosted by' : 'This webcast streams on'} {publisher}, which does not
        allow embedding here.
      </Text>
      <Button
        as={Link}
        href={video.url}
        isExternal
        leftIcon={<Icon as={icon} />}
        rightIcon={<ExternalLinkIcon />}
        colorScheme="red"
        alignSelf="flex-start"
        _hover={{ textDecoration: 'none' }}
      >
        {flown ? 'Watch the replay' : 'Watch the webcast'}
      </Button>
    </VStack>
  );
}
