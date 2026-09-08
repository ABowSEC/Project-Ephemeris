import { HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { FaMapMarkerAlt, FaSatellite } from 'react-icons/fa';

export interface LaunchMetaLineProps {
  provider?: string | null;
  rocket?: string | null;
  /** Pre-formatted pad/site text — callers vary on how much detail to include
   * (full pad description vs. just the site name), so this takes the string
   * directly rather than a launch object. */
  pad?: string | null;
  /** Pre-formatted NET text (see utils/launchFields' formatNet). */
  net: string;
}

/** Provider · rocket / pad / NET — the summary line under a mission heading. */
export default function LaunchMetaLine({ provider, rocket, pad, net }: LaunchMetaLineProps) {
  return (
    <VStack align={{ base: 'center', lg: 'start' }} spacing={1.5}>
      {provider && (
        <HStack color="text.secondary" fontSize="sm" spacing={2}>
          <Icon as={FaSatellite} boxSize={3} flexShrink={0} />
          <Text>{provider}</Text>
          {rocket && (
            <>
              <Text color="whiteAlpha.300">·</Text>
              <Text color="text.primary" fontWeight="medium">
                {rocket}
              </Text>
            </>
          )}
        </HStack>
      )}
      {pad && (
        <HStack color="text.secondary" fontSize="sm" spacing={2}>
          <Icon as={FaMapMarkerAlt} boxSize={3} flexShrink={0} />
          <Text>{pad}</Text>
        </HStack>
      )}
      <Text fontSize="xs" color="text.secondary" fontFamily="mono" letterSpacing="wide" mt={1}>
        {net}
      </Text>
    </VStack>
  );
}
