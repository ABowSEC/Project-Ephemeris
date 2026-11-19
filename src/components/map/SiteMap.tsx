import { useEffect, useMemo, useRef } from "react";
import { Box } from "@chakra-ui/react";
import { MapContainer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import VectorBasemap from "../VectorBasemap";
import { shortSiteName, type LaunchSite } from "../../utils/launchSites";

const MIN_DOT = 26;
const MAX_DOT = 44;

function dotSize(count: number) {
  return Math.round(MIN_DOT + (Math.min(count, 12) / 12) * (MAX_DOT - MIN_DOT));
}

/**
 * A site marker: a dark disc with the launch count, white hairline ring.
 * Selected gets the teal ring (interactive/selected), the next launch's site
 * a slow pulse. Built as HTML so the count stays crisp at any zoom.
 */
function siteIcon(site: LaunchSite, state: { selected: boolean; hovered: boolean; next: boolean }) {
  const size = dotSize(site.launches.length);
  const classes = ["ep-site", state.selected && "is-selected", state.hovered && "is-hovered", state.next && "is-next"]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "ep-site-wrap",
    html: `<div class="${classes}" style="width:${size}px;height:${size}px">${site.launches.length}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Fits the view to the shown sites, and flies to the selected one. */
function MapController({ sites, selectedKey }: { sites: LaunchSite[]; selectedKey: string | null }) {
  const map = useMap();
  const boundsKey = sites.map((s) => s.key).join("|");
  const first = useRef(true);

  // The map mounts before the grid gives its box a final size, and Leaflet
  // (and the vector basemap under it) only measures on mount. Re-measure
  // whenever the container resizes, or the basemap draws in one corner.
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (sites.length === 0) return;
    const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 5, animate: !first.current });
    first.current = false;
    // Only refit when the set of sites changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, boundsKey]);

  useEffect(() => {
    const site = sites.find((s) => s.key === selectedKey);
    if (!site) return;
    map.flyTo([site.lat, site.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
    // Fly only when the selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedKey]);

  return null;
}

export interface SiteMapProps {
  sites: LaunchSite[];
  selectedKey: string | null;
  hoveredKey: string | null;
  nextKey: string | null;
  onSelect: (key: string | null) => void;
  onHover: (key: string | null) => void;
}

/** Flat, zoomable map of launch sites on the dark vector basemap. */
export default function SiteMap({ sites, selectedKey, hoveredKey, nextKey, onSelect, onHover }: SiteMapProps) {
  const markers = useRef<Record<string, L.Marker | null>>({});

  // Leaflet markers are focusable divs, and it swaps the element whenever
  // the icon changes, so name them after every render
  useEffect(() => {
    for (const site of sites) {
      const el = markers.current[site.key]?.getElement();
      if (!el) continue;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${site.name}, ${site.launches.length} upcoming launches`);
      el.setAttribute("aria-pressed", String(site.key === selectedKey));
    }
  });

  // Selected and hovered markers draw on top of their neighbours
  const ordered = useMemo(
    () =>
      [...sites].sort((a, b) => {
        const rank = (s: LaunchSite) => (s.key === selectedKey ? 2 : s.key === hoveredKey ? 1 : 0);
        return rank(a) - rank(b);
      }),
    [sites, selectedKey, hoveredKey]
  );

  return (
    <Box
      position="relative"
      h="100%"
      w="100%"
      bg="bg.body"
      sx={{
        ".leaflet-container": { bg: "bg.body", fontFamily: "body" },
        // Fiord is a light slate blue; darken it toward the site's near-black
        // so the markers, not the basemap, carry the contrast
        ".maplibregl-canvas": { filter: "brightness(0.7) saturate(0.7)" },
        ".ep-site-wrap": { bg: "transparent", border: "none" },
        ".ep-site": {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "full",
          bg: "rgba(10, 11, 13, 0.88)",
          border: "1.5px solid",
          borderColor: "text.primary",
          color: "text.primary",
          fontSize: "12px",
          fontWeight: "600",
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
          transition: "background 0.15s, color 0.15s, transform 0.15s",
          position: "relative",
        },
        ".ep-site.is-hovered": { bg: "text.primary", color: "bg.body", transform: "scale(1.08)" },
        ".ep-site.is-selected": {
          borderColor: "accent.primary",
          color: "accent.primary",
          outline: "2px solid",
          outlineColor: "accent.primary",
          outlineOffset: "3px",
        },
        ".ep-site.is-selected.is-hovered": { bg: "accent.primary", color: "bg.body" },
        // Slow pulse on the next launch's site
        ".ep-site.is-next::after": {
          content: '""',
          position: "absolute",
          inset: "-6px",
          borderRadius: "full",
          border: "1.5px solid",
          borderColor: "text.primary",
          opacity: 0,
          animation: "epSitePulse 2.4s ease-out infinite",
        },
        "@keyframes epSitePulse": {
          "0%": { transform: "scale(0.8)", opacity: 0.7 },
          "100%": { transform: "scale(1.6)", opacity: 0 },
        },
        ".leaflet-marker-icon:focus-visible": { outline: "none" },
        ".leaflet-marker-icon:focus-visible .ep-site": {
          outline: "2px solid",
          outlineColor: "accent.primary",
          outlineOffset: "3px",
        },
        ".leaflet-tooltip": {
          bg: "bg.elevated",
          color: "text.primary",
          border: "1px solid",
          borderColor: "border.control",
          borderRadius: "sm",
          boxShadow: "none",
          fontSize: "12px",
          px: 2,
          py: 1,
        },
        ".leaflet-tooltip-top::before": { borderTopColor: "border.control" },
        ".leaflet-bar": { border: "1px solid", borderColor: "border.control", borderRadius: "sm", boxShadow: "none" },
        ".leaflet-bar a": {
          bg: "bg.elevated",
          color: "text.primary",
          borderBottomColor: "border.default",
          w: "36px",
          h: "36px",
          lineHeight: "36px",
        },
        ".leaflet-bar a:hover": { bg: "bg.card", color: "text.primary" },
        ".leaflet-control-attribution": { bg: "rgba(10, 11, 13, 0.7)", color: "text.secondary", fontSize: "10px" },
        ".leaflet-control-attribution a": { color: "text.secondary" },
      }}
    >
      <MapContainer
        center={[20, -40]}
        zoom={2}
        // Low enough that a phone-width map can fit every site
        minZoom={0}
        maxZoom={12}
        worldCopyJump
        zoomSnap={0.25}
        style={{ height: "100%", width: "100%" }}
      >
        <VectorBasemap />
        <MapController sites={sites} selectedKey={selectedKey} />
        {ordered.map((site) => {
          const selected = site.key === selectedKey;
          return (
            <Marker
              key={site.key}
              ref={(marker) => {
                markers.current[site.key] = marker;
              }}
              position={[site.lat, site.lng]}
              icon={siteIcon(site, { selected, hovered: site.key === hoveredKey, next: site.key === nextKey })}
              keyboard
              zIndexOffset={selected ? 1000 : site.key === hoveredKey ? 500 : 0}
              eventHandlers={{
                click: () => onSelect(selected ? null : site.key),
                mouseover: () => onHover(site.key),
                mouseout: () => onHover(null),
              }}
            >
              <Tooltip direction="top" offset={[0, -dotSize(site.launches.length) / 2]}>
                {shortSiteName(site)} · {site.launches.length} upcoming
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}
