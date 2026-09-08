import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Spinner,
  Divider,
  VStack,
  HStack,
  Badge,
  Link
} from "@chakra-ui/react";
import { TimeIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import VectorBasemap from "../components/VectorBasemap";
import Card from "../components/Card";
import { usePageMeta } from "../hooks/usePageMeta";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchJson } from "../utils/fetchJson";
import ErrorState from "../components/ErrorState";

// ── ISS marker icon ───────────────────────────────────────────────────────────
const issIcon = L.divIcon({
  html: '<div style="font-size:30px;line-height:1;filter:drop-shadow(0 0 6px #63b3ed);">🛰️</div>',
  className: "",
  iconAnchor: [15, 15],
});

// ── Keeps map centred on the ISS as it moves ──────────────────────────────────
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

// Split the ground track into separate segments wherever the path crosses the
// antimeridian. Without this, Leaflet draws a single straight line across the whole map connecting +180° back to -180°.
// without random straight line appears on x axis
function splitAtAntimeridian(positions) {
  const segments = [];
  let current = [];
  for (let i = 0; i < positions.length; i++) {
    if (i > 0) {
      const prevLng = positions[i - 1][1];
      const lng = positions[i][1];
      if (Math.abs(lng - prevLng) > 180) {
        segments.push(current);
        current = [];
      }
    }
    current.push(positions[i]);
  }
  if (current.length) segments.push(current);
  return segments.filter(seg => seg.length > 1);
}

// ── Live map component ────────────────────────────────────────────────────────
function ISSMap({ lat, lng, positions }) {
  if (lat === null || lng === null) return null;
  const trackSegments = splitAtAntimeridian(positions);
  return (
    <Box
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="border.default"
      shadow="lg"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={3}
        style={{ height: "420px", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <VectorBasemap />
        {trackSegments.map((segment, i) => (
          <Polyline key={i} positions={segment} color="#63B3ED" weight={2} opacity={0.7} />
        ))}
        <Marker position={[lat, lng]} icon={issIcon} />
        <RecenterMap lat={lat} lng={lng} />
      </MapContainer>
    </Box>
  );
}

// ── YouTube live feed ─────────────────────────────────────────────────────────
// NASA's external-camera Earth views, live from the ISS. YouTube live IDs
// rot when NASA restarts a broadcast (the old one shows "recording is not
// available"); the current ID lives at youtube.com/@NASA/streams.
function ISSVideoFeed() {
  return (
    <Box>
      <Box
        as="iframe"
        title="ISS Live Feed"
        src="https://www.youtube.com/embed/awQzjn72bI0?autoplay=1&mute=1"
        width="100%"
        sx={{ aspectRatio: "16 / 9" }}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        borderRadius="xl"
        shadow="md"
        backgroundColor="black"
      />
      {/* Escape hatch for when NASA rotates the stream and the embed dies */}
      <Text fontSize="xs" color="text.secondary" mt={2} textAlign="right">
        Stream not playing?{" "}
        <Link
          href="https://www.youtube.com/@NASA/streams"
          isExternal
          color="brand.400"
          _hover={{ color: "brand.300" }}
        >
          Watch NASA's live streams on YouTube <ExternalLinkIcon boxSize={3} mb={0.5} />
        </Link>
      </Text>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ISSLivePage() {
  usePageMeta("/iss");
  const [issData, setIssData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Polls every 5 s and keeps showing stale telemetry through failures, so
  // this page owns its loop instead of using useApi (which is load-once).
  const fetchISS = async () => {
    try {
      setError(null);

      // wheretheiss.at is reliable but slow on first contact; the default
      // 8 s timeout produced spurious first-load failures
      const data = await fetchJson("https://api.wheretheiss.at/v1/satellites/25544", {
        timeoutMs: 15000,
      });
      setIssData(data);
      setLastUpdated(new Date());
      setRetryCount(0);
      setLoading(false);

      // Append to ground track, cap at 90 positions (~7.5 min at 5s intervals)
      setPositions(prev => {
        const next = [...prev, [data.latitude, data.longitude]];
        return next.length > 90 ? next.slice(-90) : next;
      });
    } catch (err) {
      console.error("Failed to fetch ISS data", err);
      setError(err.message || "Failed to fetch ISS data.");
      setLoading(false);
      setRetryCount(prev => prev + 1);
    }
  };

  useEffect(() => {
    fetchISS();
    const interval = setInterval(fetchISS, 5000); // 5 s // ISS moves ~40 km per interval
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) =>
    date?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "—";

  return (
    <Container maxW="6xl" py={10}>
      <VStack spacing={8} align="stretch">

        {/* Header */}
        <Box textAlign="center">
          <Heading
            size="2xl"
            bgGradient="linear(to-r, cyan.400, blue.500)"
            bgClip="text"
            mb={3}
          >
            International Space Station
          </Heading>
          <Text fontSize="md" color="text.secondary" maxW="2xl" mx="auto">
            Live position tracking, real-time telemetry, and onboard video feed.
            The ISS orbits Earth every ~92 minutes at ~28,000 km/h.
          </Text>
        </Box>

        <Divider borderColor="border.default" />

        {/* Telemetry cards */}
        <Card p={6}>
          <HStack justify="space-between" mb={4} align="center">
            <Heading size="sm" color="text.primary">Real-Time Telemetry</Heading>
            <HStack spacing={3}>
              {lastUpdated && (
                <HStack spacing={1}>
                  <TimeIcon color="text.secondary" boxSize={3} />
                  <Text fontSize="xs" color="text.secondary">
                    Updated {formatTime(lastUpdated)}
                  </Text>
                </HStack>
              )}
              <Badge colorScheme="green" variant="subtle" px={2} py={1} borderRadius="full">
                Live
              </Badge>
            </HStack>
          </HStack>

          {error && (
            <ErrorState
              status="warning"
              mb={4}
              title="API Issue"
              message={`${error}${retryCount > 0 ? ` (Attempt ${retryCount})` : ''}`}
              onRetry={fetchISS}
              isRetrying={loading}
            />
          )}

          {loading && !issData ? (
            <HStack justify="center" py={6}>
              <Spinner size="xl" color="blue.400" thickness="4px" />
              <Text color="text.secondary">Acquiring ISS position…</Text>
            </HStack>
          ) : (
            <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={6}>
              <GridItem>
                <Stat>
                  <StatLabel color="text.secondary">Latitude</StatLabel>
                  <StatNumber color="cyan.400">{issData?.latitude?.toFixed(4) ?? "—"}°</StatNumber>
                  <StatHelpText>{issData?.latitude >= 0 ? "North" : "South"}</StatHelpText>
                </Stat>
              </GridItem>
              <GridItem>
                <Stat>
                  <StatLabel color="text.secondary">Longitude</StatLabel>
                  <StatNumber color="cyan.400">{issData?.longitude?.toFixed(4) ?? "—"}°</StatNumber>
                  <StatHelpText>{issData?.longitude >= 0 ? "East" : "West"}</StatHelpText>
                </Stat>
              </GridItem>
              <GridItem>
                <Stat>
                  <StatLabel color="text.secondary">Altitude</StatLabel>
                  <StatNumber color="accent.terminal">{issData?.altitude?.toFixed(1) ?? "—"}</StatNumber>
                  <StatHelpText>km above Earth</StatHelpText>
                </Stat>
              </GridItem>
              <GridItem>
                <Stat>
                  <StatLabel color="text.secondary">Velocity</StatLabel>
                  <StatNumber color="accent.terminal">{issData?.velocity?.toFixed(0) ?? "—"}</StatNumber>
                  <StatHelpText>km/h</StatHelpText>
                </Stat>
              </GridItem>
            </Grid>
          )}
        </Card>

        {/* Live map */}
        <Box>
          <Heading size="sm" color="text.primary" mb={3}>Live Ground Track</Heading>
          {issData ? (
            <ISSMap
              lat={issData.latitude}
              lng={issData.longitude}
              positions={positions}
            />
          ) : (
            <Card h="420px" display="flex" alignItems="center" justifyContent="center">
              <Spinner size="xl" color="blue.400" thickness="4px" />
            </Card>
          )}
          <Text fontSize="xs" color="text.secondary" mt={2} textAlign="right">
            Blue trail = last 7.5 min of orbital path · Map auto-centres every 5 s
          </Text>
        </Box>

        {/* Video feed */}
        <Box>
          <Heading size="sm" color="text.primary" mb={3}>Live Video Feed</Heading>
          <ISSVideoFeed />
        </Box>

      </VStack>
    </Container>
  );
}
