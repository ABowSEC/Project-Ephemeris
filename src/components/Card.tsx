import { Box, type BoxProps } from '@chakra-ui/react';

/**
 * The app's standard surface — bg.card / border.default / rounded corners —
 * as a thin Box wrapper. This trio used to be hand-copied as literal props
 * on a bare Box in a dozen-plus places (LaunchDetailPage's section cards,
 * WebcastPanel, LaunchStats, MissionUpdates, LaunchLighting, the ISS
 * telemetry cards, etc.), occasionally drifting (rounded="xl" in most
 * places, "2xl" or "md" in a few). Everything is still overridable via
 * props, including swapping the rendered element with `as` (e.g.
 * `as={Flex}` or `as={VStack}`) for the handful of call sites that need
 * layout props a plain Box doesn't have.
 */
export default function Card({ borderRadius = 'xl', ...props }: BoxProps) {
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius={borderRadius} {...props} />
  );
}
