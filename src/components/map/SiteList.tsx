import { useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, HStack, Link, Text, VStack } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import StatusBadge from "../StatusBadge";
import TrackButton from "../TrackButton";
import { useLaunchCountdown } from "../../hooks/useCountdown";
import { formatNetShort, launchPath, providerName } from "../../utils/launchFields";
import { shortSiteName, siteRegion, type LaunchSite } from "../../utils/launchSites";
import type { LaunchListItem } from "../../types/launchLibrary";

// Launches listed under an expanded site before "see all"
const EXPANDED_LIMIT = 6;

function ShortCountdown({ launch }: { launch: LaunchListItem }) {
  const t = useLaunchCountdown(launch);
  if (!t) return null;
  return (
    <Text as="span" textStyle="telemetry" fontSize="sm" color="text.primary" whiteSpace="nowrap">
      {t.d > 0 ? `T-${t.d}d ${t.h}h` : `T-${t.h}h ${String(t.m).padStart(2, "0")}m`}
    </Text>
  );
}

/** A site's upcoming launches, also used by the globe's fullscreen panel. */
export function SiteLaunches({ site }: { site: LaunchSite }) {
  const shown = site.launches.slice(0, EXPANDED_LIMIT);
  return (
    <VStack align="stretch" spacing={0} pb={2}>
      {shown.map((launch) => (
        <HStack key={launch.id} spacing={2} px={4} py={2} borderTop="1px solid" borderColor="border.default">
          <TrackButton launch={launch} size="sm" />
          <Box flex={1} minW={0}>
            <Link
              as={RouterLink}
              to={launchPath(launch)}
              fontSize="sm"
              fontWeight="600"
              color="text.primary"
              noOfLines={1}
              title={launch.name}
              _hover={{ color: "accent.primary" }}
            >
              {launch.name}
            </Link>
            <Text fontSize="xs" color="text.secondary" noOfLines={1}>
              {[providerName(launch), formatNetShort(launch)].filter(Boolean).join(" · ")}
            </Text>
          </Box>
          <StatusBadge status={launch.status} size="xs" />
        </HStack>
      ))}
      {site.launches.length > shown.length && (
        <Text fontSize="xs" color="text.secondary" px={4} pt={2}>
          + {site.launches.length - shown.length} more from this site
        </Text>
      )}
    </VStack>
  );
}

export interface SiteListProps {
  sites: LaunchSite[];
  selectedKey: string | null;
  hoveredKey: string | null;
  onSelect: (key: string | null) => void;
  onHover: (key: string | null) => void;
}

/**
 * Launch sites, soonest next launch first. Hovering a row highlights its
 * marker; clicking expands its launches and flies the map there.
 */
export default function SiteList({ sites, selectedKey, hoveredKey, onSelect, onHover }: SiteListProps) {
  const rows = useRef<Record<string, HTMLDivElement | null>>({});

  // A site picked on the map scrolls its row into view
  useEffect(() => {
    if (selectedKey) rows.current[selectedKey]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedKey]);

  if (sites.length === 0) {
    return (
      <Box p={5}>
        <Text fontWeight="600">No launches in this window</Text>
        <Text fontSize="sm" color="text.secondary" mt={1}>
          Try a longer timeframe.
        </Text>
      </Box>
    );
  }

  return (
    <VStack as="ul" align="stretch" spacing={0} listStyleType="none" aria-label="Launch sites">
      {sites.map((site) => {
        const selected = site.key === selectedKey;
        const next = site.launches[0];
        return (
          <Box
            as="li"
            key={site.key}
            ref={(el: HTMLDivElement | null) => {
              rows.current[site.key] = el;
            }}
            borderBottom="1px solid"
            borderColor="border.default"
            bg={selected ? "whiteAlpha.50" : site.key === hoveredKey ? "whiteAlpha.50" : "transparent"}
            boxShadow={selected ? "inset 2px 0 0 var(--chakra-colors-brand-200)" : undefined}
            onMouseEnter={() => onHover(site.key)}
            onMouseLeave={() => onHover(null)}
          >
            <Button
              variant="unstyled"
              display="flex"
              w="100%"
              h="auto"
              minH="72px"
              px={4}
              py={3}
              textAlign="left"
              whiteSpace="normal"
              textTransform="none"
              letterSpacing="normal"
              fontWeight="400"
              alignItems="flex-start"
              gap={3}
              aria-expanded={selected}
              onClick={() => onSelect(selected ? null : site.key)}
            >
              <Box flex={1} minW={0}>
                <Text fontSize="md" fontWeight="600" lineHeight="1.3" color={selected ? "accent.primary" : "text.primary"}>
                  {shortSiteName(site)}
                </Text>
                {siteRegion(site) && (
                  <Text fontSize="xs" color="text.secondary" noOfLines={1}>
                    {siteRegion(site)}
                  </Text>
                )}
                <Text fontSize="sm" color="text.primary" opacity={0.85} noOfLines={1} mt={1.5} title={next.name}>
                  {next.name}
                </Text>
                <HStack spacing={2} mt={0.5}>
                  <ShortCountdown launch={next} />
                  <Text as="span" fontSize="xs" color="text.secondary" noOfLines={1}>
                    {formatNetShort(next)}
                  </Text>
                </HStack>
              </Box>
              <VStack spacing={1} align="end" flexShrink={0}>
                <Text fontSize="sm" fontWeight="600" textStyle="telemetry">
                  {site.launches.length}
                </Text>
                <Text fontSize="10px" color="text.secondary" textTransform="uppercase" letterSpacing="0.08em">
                  {site.launches.length === 1 ? "launch" : "launches"}
                </Text>
                <Box
                  as={ChevronDown}
                  boxSize={4}
                  color="text.secondary"
                  transform={selected ? "rotate(180deg)" : undefined}
                  transition="transform 0.15s"
                  aria-hidden="true"
                />
              </VStack>
            </Button>
            {selected && <SiteLaunches site={site} />}
          </Box>
        );
      })}
    </VStack>
  );
}
