import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Container,
  Heading,
  Link,
  Text,
  VStack,
  HStack,
  Spinner,
  Divider,
} from "@chakra-ui/react";
import LaunchGlobe from "../components/LaunchGlobe";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { usePageMeta } from "../hooks/usePageMeta";
import TrackButton from "../components/TrackButton";
import ErrorState from "../components/ErrorState";
import { StatusDot } from "../components/StatusBadge";
import { launchPath, launchTime } from "../utils/launchFields";

function formatShortDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Group launches by launch-site location so one marker represents a
 * spaceport (which can have several pads), sorted soonest-first.
 */
function groupBySite(launches) {
  const sites = new Map();
  for (const launch of launches) {
    const lat = Number.parseFloat(launch.pad?.latitude);
    const lng = Number.parseFloat(launch.pad?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = launch.pad?.location?.name ?? `${lat.toFixed(1)},${lng.toFixed(1)}`;
    if (!sites.has(key)) {
      sites.set(key, {
        key,
        name: launch.pad?.location?.name ?? "Unknown site",
        countryCode: launch.pad?.location?.country_code ?? null,
        lat,
        lng,
        launches: [],
      });
    }
    sites.get(key).launches.push(launch);
  }

  const list = [...sites.values()];
  for (const site of list) {
    site.launches.sort(
      (a, b) => new Date(launchTime(a)) - new Date(launchTime(b))
    );
  }
  return list;
}

// The site name itself is rendered by LaunchGlobe's panel header, which
// hosts this component — just the count + list here.
function SitePopup({ site }) {
  const shown = site.launches.slice(0, 5);
  const extra = site.launches.length - shown.length;

  return (
    <VStack align="stretch" spacing={2}>
      <Text fontSize="xs" color="text.secondary">
        {site.launches.length} upcoming launch{site.launches.length === 1 ? "" : "es"}
      </Text>
      <Divider borderColor="border.default" />
      {shown.map((launch) => (
        <HStack key={launch.id} spacing={2} align="center">
          <TrackButton launch={launch} size="xs" />
          <StatusDot status={launch.status} />
          <Box minW={0}>
            <Link
              as={RouterLink}
              to={launchPath(launch)}
              fontSize="xs"
              fontWeight="semibold"
              color="text.primary"
              noOfLines={1}
              _hover={{ color: "brand.300" }}
            >
              {launch.name}
            </Link>
            <Text fontSize="10px" color="text.secondary" fontFamily="mono">
              {formatShortDate(launchTime(launch))}
            </Text>
          </Box>
        </HStack>
      ))}
      {extra > 0 && (
        <Text fontSize="10px" color="text.secondary">
          + {extra} more from this site
        </Text>
      )}
    </VStack>
  );
}

export default function LaunchMapPage() {
  usePageMeta("/map");
  const { launches, loading, error, refetch } = useUpcomingLaunches();
  const sites = useMemo(() => groupBySite(launches), [launches]);
  const [selectedSite, setSelectedSite] = useState(null);

  return (
    <Container maxW="8xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Heading as="h1" size="lg" color="text.primary">
          World Launch Map
        </Heading>

        {loading ? (
          <VStack py={16} spacing={6}>
            <Spinner size="xl" color="blue.400" thickness="4px" />
            <Text color="text.secondary">Loading launch sites...</Text>
          </VStack>
        ) : error ? (
          <ErrorState title="Error loading launches!" message={error} onRetry={refetch} />
        ) : (
          <>
            <Box
              borderRadius="xl"
              overflow="hidden"
              border="1px solid"
              borderColor="border.default"
              shadow="lg"
              position="relative"
              h="560px"
            >
              <LaunchGlobe
                sites={sites}
                onSelectSite={setSelectedSite}
                selectedSite={selectedSite}
                renderSiteDetails={(site) => <SitePopup site={site} />}
              />
            </Box>

            <Text fontSize="sm" color="text.secondary" textAlign="center">
              Point size reflects upcoming launches per site · Data from The
              Space Devs API
            </Text>
          </>
        )}
      </VStack>
    </Container>
  );
}
