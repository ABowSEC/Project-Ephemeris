import { lazy, Suspense, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Box, Button, Center, Container, Flex, Grid, Heading, HStack, Spinner, Text, VStack } from "@chakra-ui/react";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { usePageMeta } from "../hooks/usePageMeta";
import ErrorState from "../components/ErrorState";
import SiteMap from "../components/map/SiteMap";
import SiteList from "../components/map/SiteList";
import { filterChip, filterChipActive } from "../components/filterChip";
import { groupBySite, launchesInWindow, MAP_WINDOWS, type LaunchSite, type MapWindow } from "../utils/launchSites";

// The 3D globe pulls in three.js, so it only loads when someone asks for it.
// LaunchGlobe is JS; this pins its props.
const Globe = lazy(() => import("../components/LaunchGlobe")) as unknown as ComponentType<{
  sites: LaunchSite[];
  onSelectSite: (site: LaunchSite | null) => void;
  selectedSite?: LaunchSite | null;
  renderSiteDetails: (site: LaunchSite) => ReactNode;
}>;

type View = "map" | "globe";

/** Segmented chip control, used for the timeframe and the map/globe switch. */
function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <HStack role="group" aria-label={label} spacing={2} flexShrink={0}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            {...filterChip}
            {...(active ? filterChipActive : {})}
            h="40px"
            px={3.5}
            textTransform="none"
            letterSpacing="normal"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </HStack>
  );
}

/**
 * Where upcoming launches lift off: a flat map of launch sites beside a list
 * sorted by next launch, filtered to a timeframe. The 3D globe is an option.
 */
export default function LaunchMapPage() {
  usePageMeta("/map");
  const { launches, loading, error, refetch } = useUpcomingLaunches();
  const [timeframe, setTimeframe] = useState<MapWindow>("30d");
  const [view, setView] = useState<View>("map");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const inWindow = useMemo(() => launchesInWindow(launches, timeframe), [launches, timeframe]);
  const sites = useMemo(() => groupBySite(inWindow), [inWindow]);
  // A selection filtered out of the timeframe no longer applies
  const selected = sites.find((s) => s.key === selectedKey) ?? null;
  const activeKey = selected?.key ?? null;
  const nextKey = sites[0]?.key ?? null;
  const shownLaunches = sites.reduce((n, s) => n + s.launches.length, 0);

  const spinner = (
    <Center h="100%">
      <Spinner color="brand.primary" thickness="3px" />
    </Center>
  );

  return (
    <Container maxW="8xl" py={{ base: 5, md: 8 }}>
      <VStack align="stretch" spacing={{ base: 4, md: 5 }}>
        <Flex justify="space-between" align={{ base: "start", lg: "end" }} gap={4} wrap="wrap">
          <VStack align="start" spacing={1}>
            <Heading as="h1" variant="section">
              Launch map
            </Heading>
            <Text color="text.secondary" fontSize="sm">
              {loading
                ? "Loading launch sites..."
                : `${shownLaunches} launch${shownLaunches === 1 ? "" : "es"} from ${sites.length} site${sites.length === 1 ? "" : "s"}`}
            </Text>
          </VStack>
          <HStack
            spacing={3}
            overflowX={{ base: "auto", md: "visible" }}
            maxW="100%"
            pb={{ base: 0.5, md: 0 }}
            sx={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
          >
            <ChipGroup label="Timeframe" options={MAP_WINDOWS} value={timeframe} onChange={setTimeframe} />
            <Box w="1px" h="24px" bg="border.default" flexShrink={0} />
            <ChipGroup
              label="View"
              options={[
                { value: "map", label: "Map" },
                { value: "globe", label: "Globe" },
              ]}
              value={view}
              onChange={setView}
            />
          </HStack>
        </Flex>

        {error ? (
          <ErrorState title="Launch schedule temporarily unavailable" message={error} onRetry={refetch} />
        ) : (
          <Grid
            layerStyle="card"
            overflow="hidden"
            templateColumns={{ base: "1fr", lg: "380px 1fr" }}
            h={{ lg: "calc(100vh - 210px)" }}
            minH={{ lg: "560px" }}
            maxH={{ lg: "860px" }}
          >
            {/* Map first on phones, list on the left on desktop */}
            <Box
              order={{ base: 0, lg: 1 }}
              h={{ base: "340px", lg: "100%" }}
              position="relative"
              borderLeft={{ lg: "1px solid" }}
              borderBottom={{ base: "1px solid", lg: "none" }}
              borderColor="border.default"
            >
              {loading ? (
                spinner
              ) : view === "map" ? (
                <SiteMap
                  sites={sites}
                  selectedKey={activeKey}
                  hoveredKey={hoveredKey}
                  nextKey={nextKey}
                  onSelect={setSelectedKey}
                  onHover={setHoveredKey}
                />
              ) : (
                <Suspense fallback={spinner}>
                  <Globe
                    sites={sites}
                    selectedSite={selected}
                    onSelectSite={(site) => setSelectedKey(site?.key ?? null)}
                    renderSiteDetails={(site) => (
                      <Text fontSize="xs" color="text.secondary">
                        {site.launches.length} upcoming launch{site.launches.length === 1 ? "" : "es"}
                      </Text>
                    )}
                  />
                </Suspense>
              )}
            </Box>

            <Box order={{ base: 1, lg: 0 }} overflowY={{ lg: "auto" }} minH={0}>
              {!loading && (
                <SiteList
                  sites={sites}
                  selectedKey={activeKey}
                  hoveredKey={hoveredKey}
                  onSelect={setSelectedKey}
                  onHover={setHoveredKey}
                />
              )}
            </Box>
          </Grid>
        )}

        <Text fontSize="xs" color="text.secondary">
          Numbers show upcoming launches per site in the chosen timeframe. Data from The Space Devs.
        </Text>
      </VStack>
    </Container>
  );
}
