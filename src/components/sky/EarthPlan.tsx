import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import type { Observer } from '../../hooks/useObserver';
import { LAND_MASK_BASE64, LAND_MASK_COLS, LAND_MASK_ROWS } from '../../data/landMask';
import {
  PLUME_ALTITUDE_KM,
  angularDistance,
  bearing,
  destination,
  horizonDip,
  skyPosition,
  subsolarPoint,
} from '../../utils/sky';
import { VISIBILITY, nearestLaunch, padGlow, type PadGroup, type SkyLaunch } from './skyLaunches';

// Plan view of the Earth: an orthographic globe drawn as a dot matrix rather
// than a photograph. Land is dots, coloured by how high the Sun stands at that
// spot, so the terminator and the twilight bands read as a gradient of light
// rather than a hard line. Everything on it is computed, not fetched.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DOT_STEP = 2; // degrees between land dots
const SELECT = '#9F7AEA';

interface Dots {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
}

let dotsCache: Dots | null = null;

/** Unit vectors for every land dot, built once from the baked 1-degree mask. */
function landDots(): Dots {
  if (dotsCache) return dotsCache;
  const binary = atob(LAND_MASK_BASE64);
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (let row = 0; row < LAND_MASK_ROWS; row += DOT_STEP) {
    const lat = (90 - row - 0.5) * RAD;
    // Columns shrink with cos(latitude) so every dot covers about the same
    // area. A plain lat/lon grid crowds dots toward the poles and, projected,
    // interferes with itself into visible arcs.
    const columns = Math.max(1, Math.round((LAND_MASK_COLS * Math.cos(lat)) / DOT_STEP));
    for (let i = 0; i < columns; i++) {
      const lonDeg = -180 + ((i + 0.5) * 360) / columns;
      const col = Math.min(LAND_MASK_COLS - 1, Math.floor(lonDeg + 180));
      const bit = row * LAND_MASK_COLS + col;
      if (!(binary.charCodeAt(bit >> 3) & (0x80 >> (bit & 7)))) continue;
      const lon = lonDeg * RAD;
      xs.push(Math.cos(lat) * Math.cos(lon));
      ys.push(Math.cos(lat) * Math.sin(lon));
      zs.push(Math.sin(lat));
    }
  }
  dotsCache = { count: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), z: Float32Array.from(zs) };
  return dotsCache;
}

interface Basis {
  cx: number;
  cy: number;
  cz: number;
  ex: number;
  ey: number;
  nx: number;
  ny: number;
  nz: number;
}

/** Camera basis for a globe centred on a latitude and longitude. */
function basisFor(lat: number, lon: number): Basis {
  const p = lat * RAD;
  const l = lon * RAD;
  return {
    cx: Math.cos(p) * Math.cos(l),
    cy: Math.cos(p) * Math.sin(l),
    cz: Math.sin(p),
    ex: -Math.sin(l),
    ey: Math.cos(l),
    nx: -Math.sin(p) * Math.cos(l),
    ny: -Math.sin(p) * Math.sin(l),
    nz: Math.cos(p),
  };
}

// Dot colour by Sun altitude: bright teal in daylight, through a violet
// twilight, to a dim blue for night. Index = altitude band, brightest first.
const BANDS = [
  { min: 6, color: '101,209,201', alpha: 0.95 },
  { min: 0, color: '110,190,205', alpha: 0.8 },
  { min: -6, color: '150,130,220', alpha: 0.7 },
  { min: -12, color: '110,100,190', alpha: 0.55 },
  { min: -18, color: '80,90,160', alpha: 0.42 },
  { min: -90, color: '60,75,120', alpha: 0.32 },
];

interface EarthPlanProps {
  observer: Observer;
  time: number;
  pads: PadGroup[];
  selected: SkyLaunch | null;
  onSelect: (launch: SkyLaunch) => void;
}

interface Hit {
  x: number;
  y: number;
  launch: SkyLaunch;
}

export default function EarthPlan({ observer, time, pads, selected, onSelect }: EarthPlanProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Hit[]>([]);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  const [size, setSize] = useState(0);
  const [center, setCenter] = useState({ lat: observer.lat, lon: observer.lon });

  // Follow the observer when they change; dragging then moves away from it
  useEffect(() => {
    setCenter({ lat: observer.lat, lon: observer.lon });
  }, [observer.lat, observer.lon]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize(Math.round(el.getBoundingClientRect().width));
    update();
    const observerRO = new ResizeObserver(update);
    observerRO.observe(el);
    return () => observerRO.disconnect();
  }, []);

  const padSky = useMemo(
    () =>
      pads.map((pad) => {
        const launch = nearestLaunch(pad, time);
        return { pad, launch, position: skyPosition(observer, pad, launch.t), glow: padGlow(pad, time) };
      }),
    [pads, observer, time]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const mid = size / 2;
    const radius = mid - 6;
    const basis = basisFor(center.lat, center.lon);
    const sunPoint = subsolarPoint(time);
    const sun = basisFor(sunPoint.lat, sunPoint.lon);

    // Screen position and depth (>0 means facing us) for a place
    const project = (lat: number, lon: number) => {
      const p = lat * RAD;
      const l = lon * RAD;
      const vx = Math.cos(p) * Math.cos(l);
      const vy = Math.cos(p) * Math.sin(l);
      const vz = Math.sin(p);
      return {
        x: mid + radius * (vx * basis.ex + vy * basis.ey),
        y: mid - radius * (vx * basis.nx + vy * basis.ny + vz * basis.nz),
        depth: vx * basis.cx + vy * basis.cy + vz * basis.cz,
      };
    };

    // Ocean disc with a faint limb glow
    const disc = ctx.createRadialGradient(mid, mid, radius * 0.2, mid, mid, radius);
    disc.addColorStop(0, '#0d1730');
    disc.addColorStop(1, '#070c1d');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(mid, mid, radius, 0, Math.PI * 2);
    ctx.fill();

    // A polyline on the sphere, broken wherever it passes behind the limb
    const strokePath = (points: Array<{ lat: number; lon: number }>) => {
      ctx.beginPath();
      let pen = false;
      for (const point of points) {
        const s = project(point.lat, point.lon);
        if (s.depth > 0) {
          if (pen) ctx.lineTo(s.x, s.y);
          else ctx.moveTo(s.x, s.y);
          pen = true;
        } else {
          pen = false;
        }
      }
      ctx.stroke();
    };

    const circleAround = (lat: number, lon: number, angularRadius: number, steps = 144) => {
      const points = [];
      for (let i = 0; i <= steps; i++) {
        points.push(destination(lat, lon, (i / steps) * 360, angularRadius));
      }
      return points;
    };

    // Graticule
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    for (let lat = -60; lat <= 60; lat += 30) {
      const line = [];
      for (let lon = -180; lon <= 180; lon += 3) line.push({ lat, lon });
      strokePath(line);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const line = [];
      for (let lat = -90; lat <= 90; lat += 3) line.push({ lat, lon });
      strokePath(line);
    }

    // Land, dot by dot, lit by the Sun
    const dots = landDots();
    const buckets = BANDS.map(() => new Path2D());
    for (let i = 0; i < dots.count; i++) {
      const vx = dots.x[i];
      const vy = dots.y[i];
      const vz = dots.z[i];
      const depth = vx * basis.cx + vy * basis.cy + vz * basis.cz;
      if (depth <= 0.02) continue;
      const altitude = Math.asin(Math.max(-1, Math.min(1, vx * sun.cx + vy * sun.cy + vz * sun.cz))) * DEG;
      const band = BANDS.findIndex((b) => altitude >= b.min);
      const x = mid + radius * (vx * basis.ex + vy * basis.ey);
      const y = mid - radius * (vx * basis.nx + vy * basis.ny + vz * basis.nz);
      // Foreshortening: dots shrink toward the limb, which is most of the 3D
      const r = 0.55 + 1.15 * Math.sqrt(depth);
      buckets[band].moveTo(x + r, y);
      buckets[band].arc(x, y, r, 0, Math.PI * 2);
    }
    BANDS.forEach((band, i) => {
      ctx.fillStyle = `rgba(${band.color},${band.alpha})`;
      ctx.fill(buckets[i]);
    });

    // Twilight contours: places where the Sun stands at 0, -6, -12, -18 degrees
    // are circles centred on the sub-solar point
    ctx.setLineDash([]);
    [
      { alt: 0, alpha: 0.55, width: 1.25 },
      { alt: -6, alpha: 0.28, width: 1 },
      { alt: -12, alpha: 0.2, width: 1 },
      { alt: -18, alpha: 0.14, width: 1 },
    ].forEach(({ alt, alpha, width }) => {
      ctx.strokeStyle = `rgba(255,220,170,${alpha})`;
      ctx.lineWidth = width;
      strokePath(circleAround(sunPoint.lat, sunPoint.lon, 90 - alt));
    });

    // Sub-solar point
    const sunScreen = project(sunPoint.lat, sunPoint.lon);
    if (sunScreen.depth > 0) {
      const glow = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 0, sunScreen.x, sunScreen.y, 26);
      glow.addColorStop(0, 'rgba(255,226,168,0.95)');
      glow.addColorStop(1, 'rgba(255,226,168,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sunScreen.x, sunScreen.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Limb
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(mid, mid, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Line-of-sight ring: inside it a vehicle at ~100 km is above your horizon
    ctx.strokeStyle = 'rgba(159,122,234,0.75)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 5]);
    strokePath(circleAround(observer.lat, observer.lon, horizonDip(PLUME_ALTITUDE_KM)));
    ctx.setLineDash([]);

    // Route from the observer to the selected launch
    if (selected) {
      const total = angularDistance(observer.lat, observer.lon, selected.lat, selected.lon);
      const heading = bearing(observer.lat, observer.lon, selected.lat, selected.lon);
      const route = [];
      for (let i = 0; i <= 60; i++) route.push(destination(observer.lat, observer.lon, heading, (total * i) / 60));
      ctx.strokeStyle = 'rgba(159,122,234,0.9)';
      ctx.lineWidth = 1.5;
      strokePath(route);
    }

    // Pads
    const nextHits: Hit[] = [];
    for (const { pad, launch, position, glow } of padSky) {
      const s = project(pad.lat, pad.lon);
      if (s.depth <= 0) continue;
      const style = VISIBILITY[position.visibility];
      const isSelected = pad.launches.some((l) => l.id === selected?.id);
      const dotRadius = 2.5 + 3 * glow;

      if (glow > 0.35) {
        ctx.fillStyle = `${style.hex}${Math.round(60 * glow).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8 + 12 * glow, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.35 + 0.65 * glow;
      ctx.fillStyle = style.hex;
      ctx.beginPath();
      ctx.arc(s.x, s.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = SELECT;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, dotRadius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (isSelected || glow > 0.6) {
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#06091A';
        ctx.fillStyle = '#E2E8F0';
        const label = launch.name.length > 30 ? `${launch.name.slice(0, 29)}…` : launch.name;
        const width = ctx.measureText(label).width;
        // Prefer the side facing the centre, then clamp so it never leaves the canvas
        const towardCentre = s.x > mid ? -dotRadius - 8 - width : dotRadius + 8;
        const lx = Math.max(4, Math.min(size - width - 4, s.x + towardCentre));
        ctx.textAlign = 'left';
        ctx.strokeText(label, lx, s.y + 3);
        ctx.fillText(label, lx, s.y + 3);
      }
      nextHits.push({ x: s.x, y: s.y, launch });
    }
    hits.current = nextHits;

    // Observer
    const you = project(observer.lat, observer.lon);
    if (you.depth > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(you.x, you.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(you.x - 9, you.y);
      ctx.lineTo(you.x - 5, you.y);
      ctx.moveTo(you.x + 5, you.y);
      ctx.lineTo(you.x + 9, you.y);
      ctx.moveTo(you.x, you.y - 9);
      ctx.lineTo(you.x, you.y - 5);
      ctx.moveTo(you.x, you.y + 5);
      ctx.lineTo(you.x, you.y + 9);
      ctx.stroke();
    }
  }, [size, center, time, observer, padSky, selected]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || size === 0) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    const degreesPerPixel = DEG / (size / 2);
    setCenter((c) => ({
      lat: Math.max(-85, Math.min(85, c.lat + dy * degreesPerPixel)),
      lon: ((((c.lon - (dx * degreesPerPixel) / Math.max(0.25, Math.cos(c.lat * RAD))) + 180) % 360) + 360) % 360 - 180,
    }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    // A press that barely moved is a click: pick the nearest pad within reach
    if (!d || d.moved > 4) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let best: Hit | null = null;
    let bestDistance = 16;
    for (const hit of hits.current) {
      const distance = Math.hypot(hit.x - px, hit.y - py);
      if (distance < bestDistance) {
        best = hit;
        bestDistance = distance;
      }
    }
    if (best) onSelect(best.launch);
  };

  const recentred = center.lat === observer.lat && center.lon === observer.lon;

  return (
    <Box ref={wrapRef} position="relative" w="100%" sx={{ aspectRatio: '1 / 1' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Dot-matrix globe showing daylight, twilight and night, with launch pads. The launch list carries the same information."
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      {!recentred && (
        <Button
          size="xs"
          variant="outline"
          position="absolute"
          top={2}
          right={2}
          onClick={() => setCenter({ lat: observer.lat, lon: observer.lon })}
        >
          Recenter on me
        </Button>
      )}
    </Box>
  );
}
