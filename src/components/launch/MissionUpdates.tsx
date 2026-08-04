import { Box, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import type { LaunchUpdate } from '../../types/launchLibrary';

/**
 * The mission's change history, newest first.
 *
 * This is where "accurate status changes" actually comes from. Space Devs
 * curators annotate every slip, scrub, hold and target change by hand
 * ("Tweaked T-0.", "Scrubbed due to upper level winds."), which is far better
 * than anything we could infer by diffing the payload ourselves — and it
 * explains *why* a date moved, which a diff never could.
 */
export default function MissionUpdates({ updates }: { updates: LaunchUpdate[] }) {
  if (!updates.length) return null;

  const sorted = [...updates].sort(
    (a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
  );

  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius="xl" p={5}>
      <Text fontWeight="600" mb={4}>
        Mission Updates
      </Text>

      <VStack align="stretch" spacing={0}>
        {sorted.map((update, index) => (
          <HStack key={update.id} align="stretch" spacing={4}>
            {/* Timeline rail: a dot per entry, joined by a line except at the end */}
            <VStack spacing={0} flexShrink={0} pt={1.5}>
              <Box
                boxSize="9px"
                borderRadius="full"
                bg={index === 0 ? 'accent.terminal' : 'border.default'}
                flexShrink={0}
              />
              {index < sorted.length - 1 && <Box w="1px" flex={1} bg="border.default" />}
            </VStack>

            <Box pb={index < sorted.length - 1 ? 5 : 0} flex={1} minW={0}>
              <Text fontSize="sm" lineHeight="1.6">
                {update.comment}
              </Text>
              <HStack spacing={2} mt={1} flexWrap="wrap">
                <Text fontSize="xs" color="text.secondary">
                  {new Date(update.created_on).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Text>
                <Text fontSize="xs" color="text.secondary">
                  · {update.created_by}
                </Text>
                {update.info_url && (
                  <Link
                    href={update.info_url}
                    isExternal
                    fontSize="xs"
                    color="brand.300"
                    _hover={{ color: 'brand.200' }}
                  >
                    Source <ExternalLinkIcon mx="1px" mb="2px" />
                  </Link>
                )}
              </HStack>
            </Box>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
