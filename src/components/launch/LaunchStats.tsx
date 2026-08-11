import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import type { LaunchDetailed } from '../../types/launchLibrary';

/**
 * Context numbers from the detailed payload — how many times this provider,
 * pad, and site have flown, and how quickly the pad turned around.
 *
 * Every field is optional and several are routinely null, so the grid renders
 * only what exists and the whole block disappears when nothing does. Showing
 * "Pad turnaround: —" is worse than showing nothing.
 */
export default function LaunchStats({ launch }: { launch: LaunchDetailed }) {
  const stats = [
    {
      label: 'Provider launch attempt',
      value: ordinal(launch.agency_launch_attempt_count),
      hint: launch.launch_service_provider?.name,
    },
    {
      label: 'Pad launch attempt',
      value: ordinal(launch.pad_launch_attempt_count),
      hint: launch.pad?.name,
    },
    {
      label: 'Site launch attempt',
      value: ordinal(launch.location_launch_attempt_count),
      hint: launch.pad?.location?.name,
    },
    {
      label: 'Orbital launch of all time',
      value: ordinal(launch.orbital_launch_attempt_count),
      hint: 'Worldwide',
    },
    {
      label: 'Pad turnaround',
      value: formatTurnaround(launch.pad_turnaround),
      hint: 'Since the previous launch here',
    },
  ].filter((stat) => stat.value !== null);

  if (!stats.length) return null;

  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius="xl" p={5}>
      <Text fontWeight="600" mb={4}>
        By the Numbers
      </Text>
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={5}>
        {stats.map((stat) => (
          <Box key={stat.label}>
            <Text fontSize="xl" fontFamily="mono" color="accent.terminal" lineHeight="1.2">
              {stat.value}
            </Text>
            <Text fontSize="sm" mt={1}>
              {stat.label}
            </Text>
            {stat.hint && (
              <Text fontSize="xs" color="text.secondary" noOfLines={1}>
                {stat.hint}
              </Text>
            )}
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function ordinal(n: number | null | undefined): string | null {
  if (n == null || n < 1) return null;
  // 11th/12th/13th are the exceptions the naive rule gets wrong
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** Upstream sends an ISO 8601 duration ("P24DT4H12M"), not something readable. */
function formatTurnaround(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!match) return null;
  const [, days, hours, minutes] = match.map((v) => (v ? Number(v) : 0));

  if (days) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return minutes ? `${minutes}m` : null;
}
