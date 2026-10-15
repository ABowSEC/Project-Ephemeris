import { Link as RouterLink } from "react-router-dom";
import { Box, Flex, Heading, HStack, Link, Skeleton, Text, VStack } from "@chakra-ui/react";
import { ArrowForwardIcon } from "@chakra-ui/icons";
import { useUpcomingLaunches } from "../../hooks/useUpcomingLaunches";
import { useLaunchCountdown } from "../../hooks/useCountdown";
import { hasFlown } from "../../data/launchStatus";
import { formatNet, launchPath, providerName } from "../../utils/launchFields";
import StatusBadge from "../StatusBadge";
import type { LaunchListItem } from "../../types/launchLibrary";

// How many launches to list after the hero's "next" one
const COUNT = 4;

function ShortCountdown({ launch }: { launch: LaunchListItem }) {
  const t = useLaunchCountdown(launch);
  if (!t) return null;
  const text = t.d > 0 ? `T-${t.d}d ${t.h}h` : `T-${t.h}h ${String(t.m).padStart(2, "0")}m`;
  return (
    <Text
      fontFamily="mono"
      fontSize="sm"
      color="accent.terminal"
      whiteSpace="nowrap"
      sx={{ fontVariantNumeric: "tabular-nums" }}
    >
      {text}
    </Text>
  );
}

/**
 * The launches lined up after the next one, as a compact list. Gives Home
 * something to scan beyond a single countdown, and a direct path into the
 * detail pages. Reads the shared launch cache, so it adds no requests.
 */
export default function ComingUpStrip() {
  const { launches, nextLaunch, loading } = useUpcomingLaunches();

  const upcoming = launches
    .filter((launch) => launch.id !== nextLaunch?.id && !hasFlown(launch.status))
    .slice(0, COUNT);

  if (!loading && upcoming.length === 0) return null;

  return (
    <Box as="section" aria-labelledby="coming-up-heading">
      <Flex align="baseline" justify="space-between" mb={4} gap={4}>
        <Heading id="coming-up-heading" as="h2" size="md" color="text.primary">
          Coming up
        </Heading>
        <Link
          as={RouterLink}
          to="/launches"
          fontSize="sm"
          color="brand.300"
          whiteSpace="nowrap"
          _hover={{ color: "brand.200" }}
        >
          See all launches <ArrowForwardIcon />
        </Link>
      </Flex>

      <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor="border.default">
        {loading
          ? Array.from({ length: COUNT }, (_, i) => (
              <Skeleton key={i} h="64px" my={2} borderRadius="md" />
            ))
          : upcoming.map((launch) => (
              <Flex
                key={launch.id}
                as={RouterLink}
                to={launchPath(launch)}
                data-group
                align="center"
                gap={{ base: 3, md: 5 }}
                py={4}
                px={{ base: 1, md: 2 }}
                borderBottom="1px solid"
                borderColor="border.default"
                transition="background 0.2s"
                _hover={{ bg: "whiteAlpha.50", textDecoration: "none" }}
              >
                <Box flex="1" minW={0}>
                  <Text
                    fontWeight="600"
                    color="text.primary"
                    noOfLines={1}
                    _groupHover={{ color: "brand.300" }}
                    transition="color 0.2s"
                  >
                    {launch.name}
                  </Text>
                  <Text fontSize="xs" color="text.secondary" noOfLines={1} mt={0.5}>
                    {[providerName(launch), formatNet(launch)].filter(Boolean).join(" · ")}
                  </Text>
                </Box>
                <HStack spacing={3} flexShrink={0}>
                  <Box display={{ base: "none", sm: "block" }}>
                    <StatusBadge status={launch.status} size="xs" />
                  </Box>
                  <ShortCountdown launch={launch} />
                </HStack>
              </Flex>
            ))}
      </VStack>
    </Box>
  );
}
