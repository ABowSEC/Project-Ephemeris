import { Link as RouterLink } from "react-router-dom";
import { Box, HStack, LinkBox, LinkOverlay, Skeleton, Text, VStack } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useUpcomingLaunches } from "../../hooks/useUpcomingLaunches";
import { useLaunchCountdown } from "../../hooks/useCountdown";
import { formatNet, formatNetShort, hasPreciseTime, launchPath, providerName, shortSite } from "../../utils/launchFields";
import StatusBadge from "../StatusBadge";
import TrackButton from "../TrackButton";
import CalendarMenu from "../launch/CalendarMenu";
import DataFreshness from "../DataFreshness";
import { withAlpha } from "../../utils/color";

const pad = (n: number) => String(n).padStart(2, "0");

/** Next-launch panel for the Home hero. Uses the cached feed, so no extra requests. */
export default function NextLaunchPanel() {
  const { nextLaunch: next, loading, fetchedAt, refresh } = useUpcomingLaunches();
  const countdown = useLaunchCountdown(next);

  if (loading) {
    return <Skeleton w={{ base: "100%", md: "380px" }} h="250px" rounded="sm" startColor="bg.card" endColor="bg.elevated" />;
  }
  if (!next) return null;

  const meta = [providerName(next), shortSite(next)].filter(Boolean).join(" · ");

  return (
    <LinkBox
      as="aside"
      aria-label="Next launch"
      w={{ base: "100%", md: "380px" }}
      flexShrink={0}
      bg={withAlpha("bg.body", 82)}
      border="1px solid"
      borderColor="border.default"
      rounded="sm"
      p={5}
      transition="border-color 0.15s"
      _hover={{ borderColor: "border.controlHover" }}
    >
      <VStack align="stretch" spacing={3.5}>
        <HStack justify="space-between">
          <Text textStyle="label" fontSize="11px" color="text.secondary">
            Next launch
          </Text>
          <StatusBadge status={next.status} size="xs" />
        </HStack>

        <Box>
          <LinkOverlay as={RouterLink} to={launchPath(next)} _hover={{ textDecoration: "none" }}>
            <Text fontSize="lg" fontWeight="600" lineHeight="1.3" color="text.primary">
              {next.name}
            </Text>
          </LinkOverlay>
          {meta && (
            <Text fontSize="sm" color="text.secondary" noOfLines={1}>
              {meta}
            </Text>
          )}
        </Box>

        {countdown ? (
          // Green only while ticking toward a precise T-0
          <Text textStyle="telemetry" fontSize={{ base: "28px", md: "36px" }} fontWeight="500" lineHeight="1" color="accent.terminal">
            T-{countdown.d > 0 && `${countdown.d}d `}
            {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
          </Text>
        ) : (
          <Text textStyle="telemetry" fontSize="lg" color="text.secondary">
            {hasPreciseTime(next) ? "Launch window open" : formatNet(next)}
          </Text>
        )}

        {countdown && (
          <Text fontSize="sm" color="text.secondary">
            {formatNetShort(next)}
          </Text>
        )}

        <HStack spacing={2} pt={3.5} borderTop="1px solid" borderColor="border.default">
          <HStack flex={1} spacing={1.5} color="text.primary" fontSize="sm" fontWeight="500" aria-hidden="true">
            <Text as="span">Mission details</Text>
            <Box as={ArrowRight} boxSize={4} />
          </HStack>
          {/* Above the LinkOverlay so these don't navigate */}
          <HStack position="relative" zIndex={1} spacing={0}>
            <CalendarMenu launch={next} />
            <TrackButton launch={next} />
          </HStack>
        </HStack>

        <Box position="relative" zIndex={1}>
          <DataFreshness fetchedAt={fetchedAt} onRefresh={refresh} />
        </Box>
      </VStack>
    </LinkBox>
  );
}
