import { Link as RouterLink } from "react-router-dom";
import { Badge, Box, HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import { FaMapMarkerAlt, FaRocket } from "react-icons/fa";
import { useUpcomingLaunches } from "../../hooks/useUpcomingLaunches";
import { useLaunchCountdown } from "../../hooks/useCountdown";
import { formatNet, hasPreciseTime, launchPath } from "../../utils/launchFields";
import StaleDataNotice from "../StaleDataNotice";
import { pulseOpacity } from "../../utils/animations";

const pad = (n: number) => String(n).padStart(2, "0");

// Compact live next-launch panel for the hero; shares the app-wide cached
// launch data so it costs no extra API requests.
export default function NextLaunchPanel() {
  const { nextLaunch: next, loading, stale, fetchedAt, refresh } = useUpcomingLaunches();
  const countdown = useLaunchCountdown(next);

  if (loading) {
    return (
      <Box minW={{ base: "auto", md: "300px" }} textAlign="center" py={8}>
        <Spinner color="accent.terminal" thickness="3px" />
      </Box>
    );
  }
  if (!next) return null;

  return (
    <VStack
      as={RouterLink}
      to={launchPath(next)}
      align="stretch"
      spacing={3}
      bg="rgba(0,255,157,0.04)"
      border="1px solid"
      borderColor="rgba(0,255,157,0.25)"
      rounded="xl"
      p={6}
      w={{ base: "100%", md: "auto" }}
      minW={{ md: "320px" }}
      maxW={{ md: "360px" }}
      transition="all 0.2s"
      _hover={{ borderColor: "rgba(0,255,157,0.55)", bg: "rgba(0,255,157,0.08)", textDecoration: "none" }}
    >
      <HStack spacing={2}>
        <Box as={FaRocket} color="accent.terminal" boxSize="10px" animation={`${pulseOpacity} 2s ease-in-out infinite`} />
        <Text fontSize="10px" color="accent.terminal" fontWeight="bold" letterSpacing="0.2em" textTransform="uppercase">
          Next Launch
        </Text>
        {next.status?.abbrev && (
          <Badge colorScheme={next.status.abbrev === "Go" ? "green" : "gray"} variant="subtle" fontSize="10px" rounded="full" ml="auto">
            {next.status.abbrev}
          </Badge>
        )}
      </HStack>

      <Text fontWeight="bold" color="text.primary" fontSize="md" noOfLines={2}>
        {next.name}
      </Text>

      {countdown ? (
        <Text
          fontFamily="mono"
          fontSize="3xl"
          fontWeight="bold"
          color="accent.terminal"
          letterSpacing="wide"
          lineHeight="1"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {countdown.d > 0 && `${countdown.d}d `}
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </Text>
      ) : hasPreciseTime(next) ? (
        // nextLaunch is never a flown launch, so a passed T-0 means the window
        // is open or upstream hasn't recorded a slip yet, not that it launched
        <Badge colorScheme="orange" alignSelf="start" rounded="full" px={3}>
          Window open
        </Badge>
      ) : (
        <Text fontFamily="mono" fontSize="lg" color="text.secondary">
          {formatNet(next)}
        </Text>
      )}

      {next.pad?.location?.name && (
        <HStack color="text.secondary" fontSize="xs" spacing={2}>
          <Box as={FaMapMarkerAlt} boxSize="10px" flexShrink={0} />
          <Text noOfLines={1}>{next.pad.location.name}</Text>
        </HStack>
      )}

      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} onRefresh={refresh} />
    </VStack>
  );
}
