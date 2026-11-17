import { useEffect, useState } from 'react';
import { Box, HStack, Icon, Text } from '@chakra-ui/react';
import { FaMoon, FaRegSun, FaSun } from 'react-icons/fa';
import { getLighting, type Lighting } from '../../utils/orbital';
import { launchDate, padCoordinates } from '../../utils/launchFields';
import { hasFlown } from '../../data/launchStatus';
import Card from '../Card';
import type { AnyLaunch } from '../../types/launchLibrary';

/**
 * Whether the launch is in darkness, daylight, or twilight, when the plume
 * lights up and is visible for hundreds of miles. Computed by the Rust module
 * from pad coordinates and T-0. Renders nothing if the module or coordinates
 * are missing.
 */
export default function LaunchLighting({ launch }: { launch: AnyLaunch }) {
  const [lighting, setLighting] = useState<Lighting | null>(null);

  // Pulled apart into primitives: padCoordinates returns a fresh object each
  // render, so depending on it directly would re-run the effect forever.
  const coordinates = padCoordinates(launch);
  const lat = coordinates?.lat;
  const lon = coordinates?.lon;
  const timestamp = launchDate(launch)?.getTime();

  useEffect(() => {
    if (lat == null || lon == null || timestamp == null) {
      setLighting(null);
      return;
    }
    let cancelled = false;
    getLighting(lat, lon, timestamp).then((result) => {
      if (!cancelled) setLighting(result);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon, timestamp]);

  if (!lighting) return null;

  const flown = hasFlown(launch.status);
  const { icon, color, headline, detail } = describe(lighting, flown);

  return (
    <Card borderColor={lighting.twilightLaunch ? 'accent.terminal' : 'border.default'} p={5}>
      <HStack spacing={3} align="flex-start">
        <Icon as={icon} color={color} boxSize={5} mt={0.5} />
        <Box>
          <Text fontWeight="600">{headline}</Text>
          <Text fontSize="sm" color="text.secondary" mt={1}>
            {detail}
          </Text>
        </Box>
      </HStack>
    </Card>
  );
}

function describe(lighting: Lighting, flown: boolean) {
  const was = flown ? 'was' : 'is';
  const sunPosition = `The Sun ${was} ${Math.abs(lighting.altitude).toFixed(0)}° ${
    lighting.altitude >= 0 ? 'above' : 'below'
  } the horizon at the pad.`;

  if (lighting.twilightLaunch) {
    return {
      icon: FaRegSun,
      color: 'accent.terminal',
      headline: flown ? 'This was a twilight launch' : 'This is a twilight launch',
      detail:
        `${sunPosition} With the ground dark and the rocket climbing into sunlight, ` +
        `the exhaust plume can bloom into the "space jellyfish" effect — visible for ` +
        `hundreds of miles.`,
    };
  }

  if (lighting.phase === 'day') {
    return {
      icon: FaSun,
      color: 'yellow.400',
      headline: flown ? 'Daytime launch' : 'Daytime launch',
      detail: `${sunPosition} Expect a bright vehicle against the sky and a short visible arc.`,
    };
  }

  return {
    icon: FaMoon,
    color: 'blue.300',
    headline: 'Night launch',
    detail: `${sunPosition} The vehicle climbs through darkness, so it stays visible as a moving flame rather than a lit plume.`,
  };
}
