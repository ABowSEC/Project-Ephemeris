import { Badge, Box, Button, HStack, Icon, Link, Text, VStack } from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaYoutube, FaVimeo, FaBroadcastTower, FaPlay } from 'react-icons/fa';
import { embeddableVideo, officialWebcast, webcasts } from '../../utils/launchFields';
import { hasFlown } from '../../data/launchStatus';
import Card from '../Card';
import type { AnyLaunch, LaunchDetailed, VideoUrl } from '../../types/launchLibrary';

/**
 * The official webcast. Embedded only for YouTube/Vimeo, which the CSP allows;
 * anything else (often x.com for SpaceX) becomes a link.
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
    <Card overflow="hidden">
      <HStack px={5} py={3} justify="space-between" borderBottom="1px solid" borderColor="border.default">
        <HStack spacing={2}>
          <Icon as={FaBroadcastTower} color="text.secondary" />
          <Text fontWeight="600">{flown ? 'Replay' : 'Official Webcast'}</Text>
        </HStack>
        {isLive && (
          <Badge variant="outline" color="accent.terminal" borderColor="accent.terminal" border="1px solid" boxShadow="none" px={2}>
            <HStack as="span" spacing={1.5}>
              <Box as="span" w="6px" h="6px" borderRadius="full" bg="accent.terminal" />
              <span>Live now</span>
            </HStack>
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
        <OutboundWebcast video={primary} flown={flown} isLive={isLive} />
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
              {video.title ? `: ${video.title}` : ''} <ExternalLinkIcon mx="2px" mb="2px" />
            </Link>
          ))}
        </VStack>
      )}
    </Card>
  );
}

/** Card for a webcast we are not allowed to frame. The page's one solid CTA. */
function OutboundWebcast({ video, flown, isLive }: { video: VideoUrl; flown: boolean; isLive: boolean }) {
  const publisher = video.publisher ?? video.source ?? 'the broadcaster';
  const icon = video.url.includes('vimeo') ? FaVimeo : /youtu.?be/.test(video.url) ? FaYoutube : FaPlay;
  const label = flown ? 'Watch the replay' : isLive ? 'Watch live' : 'Watch the webcast';

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
        variant="solid"
        alignSelf="flex-start"
        _hover={{ textDecoration: 'none' }}
      >
        {label}
      </Button>
    </VStack>
  );
}
