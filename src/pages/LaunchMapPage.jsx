import { useMemo } from "react";
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
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Divider,
} from "@chakra-ui/react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import VectorBasemap from "../components/VectorBasemap";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { usePageMeta } from "../hooks/usePageMeta";
import TrackButton from "../components/TrackButton";
import ErrorState from "../components/ErrorState";
import { statusStyle } from "../data/launchStatus";
import { launchPath, launchTime } from "../utils/launchFields";

// Orange glowing marker showing how many upcoming launches fly from a site
function siteIcon(count) {
  return L.divIcon({
    className: "",
    html:
      `<div style="width:30px;height:30px;border-radius:50%;` +
      `background:rgba(251,146,60,0.92);border:2px solid #FDBA74;` +
      `box-shadow:0 0 14px rgba(251,146,60,0.75);color:#0B1120;` +
      `font:700 13px/26px sans-serif;text-align:center;">${count}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

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

function SitePopup({ site }) {
  const shown = site.launches.slice(0, 5);
  const extra = site.launches.length - shown.length;

  return (
    <VStack align="stretch" spacing={2}>
      <Box>
        <Text fontWeight="bold" fontSize="sm" color="#E2E8F0">
          {site.name}
        </Text>
        <Text fontSize="xs" color="#7A93B8">
          {site.launches.length} upcoming launch{site.launches.length === 1 ? "" : "es"}
        </Text>
      </Box>
      <Divider borderColor="#1E2D45" />
      {shown.map((launch) => (
        <HStack key={launch.id} spacing={2} align="center">
          <TrackButton launch={launch} size="xs" />
          <Box
            w="8px"
            h="8px"
            borderRadius="full"
            flexShrink={0}
            bg={statusStyle(launch.status).dot}
            title={statusStyle(launch.status).label}
          />
          <Box minW={0}>
            {/* react-leaflet portals popup content, and portals keep React
                context, so the router link works from inside the map. */}
            <Link
              as={RouterLink}
              to={launchPath(launch)}
              fontSize="xs"
              fontWeight="semibold"
              color="#E2E8F0"
              noOfLines={1}
              _hover={{ color: "#4FD1C5" }}
            >
              {launch.name}
            </Link>
            <Text fontSize="10px" color="#7A93B8" fontFamily="mono">
              {formatShortDate(launchTime(launch))}
            </Text>
          </Box>
        </HStack>
      ))}
      {extra > 0 && (
        <Text fontSize="10px" color="#7A93B8">
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

  const stats = useMemo(() => {
    const mapped = sites.reduce((n, s) => n + s.launches.length, 0);
    const countries = new Set(sites.map((s) => s.countryCode).filter(Boolean));
    const providers = new Set(
      launches.map((l) => l.launch_service_provider?.name).filter(Boolean)
    );
    return { mapped, sites: sites.length, countries: countries.size, providers: providers.size };
  }, [sites, launches]);

  return (
    <Container maxW="8xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading as="h1" size="lg" color="text.primary" mb={2}>
            World Launch Map
          </Heading>
          <Text color="text.secondary">
            Every launch site with a mission on the schedule. Click a marker to
            see what is flying from there and star launches to track them.
          </Text>
        </Box>

        {loading ? (
          <VStack py={16} spacing={6}>
            <Spinner size="xl" color="blue.400" thickness="4px" />
            <Text color="text.secondary">Loading launch sites...</Text>
          </VStack>
        ) : error ? (
          <ErrorState title="Error loading launches!" message={error} onRetry={refetch} />
        ) : (
          <>
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
              {[
                { label: "Upcoming Launches", value: stats.mapped },
                { label: "Launch Sites", value: stats.sites },
                { label: "Countries", value: stats.countries },
                { label: "Providers", value: stats.providers },
              ].map(({ label, value }) => (
                <Stat
                  key={label}
                  bg="bg.card"
                  border="1px solid"
                  borderColor="border.default"
                  borderRadius="xl"
                  px={5}
                  py={4}
                >
                  <StatNumber color="accent.terminal" fontSize="2xl">
                    {value}
                  </StatNumber>
                  <StatLabel color="text.secondary" fontSize="xs">
                    {label}
                  </StatLabel>
                </Stat>
              ))}
            </SimpleGrid>

            <Box
              borderRadius="xl"
              overflow="hidden"
              border="1px solid"
              borderColor="border.default"
              shadow="lg"
              sx={{
                ".leaflet-container": { bg: "#03050D", fontFamily: "inherit" },
                ".leaflet-popup-content-wrapper": {
                  bg: "#0B1120",
                  color: "#E2E8F0",
                  border: "1px solid #1E2D45",
                  borderRadius: "12px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                },
                ".leaflet-popup-tip": { bg: "#0B1120" },
                ".leaflet-popup-content": { m: "12px 14px", minW: "230px" },
                ".leaflet-popup-close-button": { color: "#7A93B8" },
              }}
            >
              <MapContainer
                center={[22, 10]}
                zoom={2}
                minZoom={2}
                worldCopyJump
                style={{ height: "560px", width: "100%" }}
              >
                <VectorBasemap />
                {sites.map((site) => (
                  <Marker
                    key={site.key}
                    position={[site.lat, site.lng]}
                    icon={siteIcon(site.launches.length)}
                  >
                    <Popup>
                      <SitePopup site={site} />
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Box>

            <Text fontSize="sm" color="text.secondary" textAlign="center">
              Marker numbers show upcoming launches per site · Data from The
              Space Devs API
            </Text>
          </>
        )}
      </VStack>
    </Container>
  );
}
