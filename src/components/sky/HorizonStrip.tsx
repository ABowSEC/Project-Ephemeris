import { Box, useBreakpointValue } from '@chakra-ui/react';
import type { Observer } from '../../hooks/useObserver';
import { compass, skyPosition, sunHorizontal } from '../../utils/sky';
import { STAR_FIELD, horizonColor, starOpacity, zenithColor } from './skyColors';
import { VISIBILITY, type SkyLaunch } from './skyLaunches';
import { directionName, fistsAbove } from './skyText';

// What you would see standing there and facing the launch: a flat strip of
// horizon, compass reading left to right in the ordinary way (unlike the dome,
// which looks up and mirrors east and west). Angles are true on both axes, so
// "half a fist up" is drawn half a fist tall.
const H = 250;
const HORIZON_Y = 196;
// Degrees are drawn at one fixed scale; a narrower frame on phones keeps the
// text at a readable size instead of shrinking the whole strip.
const PX_PER_DEGREE = 800 / 140;

interface HorizonStripProps {
  observer: Observer;
  launch: SkyLaunch;
}

export default function HorizonStrip({ observer, launch }: HorizonStripProps) {
  const narrow = useBreakpointValue({ base: true, md: false }) ?? false;
  const FOV = narrow ? 80 : 140; // degrees across
  const W = Math.round(FOV * PX_PER_DEGREE);
  const scale = narrow ? 1.4 : 1;

  const position = skyPosition(observer, launch, launch.t);
  const sun = sunHorizontal(observer.lat, observer.lon, launch.t);
  const style = VISIBILITY[position.visibility];
  const visible = position.visibility !== 'below';

  // Screen x for a bearing, with the launch's own bearing dead centre
  const xFor = (azimuth: number) =>
    W / 2 + ((((azimuth - position.azimuth) % 360) + 540) % 360 - 180) * PX_PER_DEGREE;

  const sunX = xFor(sun.azimuth);
  const sunY = Math.min(HORIZON_Y, HORIZON_Y - sun.altitude * PX_PER_DEGREE);
  const showSunGlow = sun.altitude > -8 && sunX > -200 && sunX < W + 200;

  const markerY =
    HORIZON_Y - Math.min(position.elevation, (HORIZON_Y - 30) / PX_PER_DEGREE) * PX_PER_DEGREE;

  const ticks: number[] = [];
  const first = Math.floor((position.azimuth - FOV / 2) / 5) * 5;
  for (let a = first; a <= position.azimuth + FOV / 2 + 5; a += 5) ticks.push(a);

  const label = visible
    ? `View toward ${directionName(position.azimuth)}: the launch appears ${fistsAbove(position.elevation)} above the horizon.`
    : `View toward ${directionName(position.azimuth)}: the launch is hidden below the horizon.`;

  const name = launch.name.split(' | ')[0].split(' · ')[0];

  return (
    <Box
      as="svg"
      viewBox={`0 0 ${W} ${H}`}
      w="100%"
      h="auto"
      display="block"
      role="img"
      aria-label={label}
      rounded="lg"
      border="1px solid"
      borderColor="border.default"
      sx={{ fontFamily: 'var(--chakra-fonts-mono)' }}
    >
      <defs>
        <linearGradient id="strip-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={zenithColor(sun.altitude)} />
          <stop offset="1" stopColor={horizonColor(sun.altitude)} />
        </linearGradient>
        <radialGradient id="strip-sun">
          <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#F6AD55" stopOpacity="0.4" />
          <stop offset="1" stopColor="#F6AD55" stopOpacity="0" />
        </radialGradient>
        <clipPath id="strip-clip">
          <rect width={W} height={HORIZON_Y} />
        </clipPath>
      </defs>

      <rect width={W} height={HORIZON_Y} fill="url(#strip-sky)" />

      {starOpacity(sun.altitude) > 0 && (
        <g fill="#fff" opacity={starOpacity(sun.altitude)}>
          {STAR_FIELD.map((star, i) => (
            <circle
              key={i}
              cx={((star.x + 1) / 2) * W}
              cy={((star.y + 1) / 2) * (HORIZON_Y - 8)}
              r={star.r}
              fillOpacity={star.o}
            />
          ))}
        </g>
      )}

      {showSunGlow && (
        <g clipPath="url(#strip-clip)" opacity={Math.min(1, (sun.altitude + 8) / 12)}>
          <circle cx={sunX} cy={sunY} r={200} fill="url(#strip-sun)" />
        </g>
      )}
      {sun.altitude > -1 && sunX > -20 && sunX < W + 20 && (
        <circle cx={sunX} cy={sunY} r={13} fill="#FFE2A8" />
      )}

      {/* Ground */}
      <rect y={HORIZON_Y} width={W} height={H - HORIZON_Y} fill="#070b18" />
      <line x1={0} x2={W} y1={HORIZON_Y} y2={HORIZON_Y} stroke="#fff" strokeOpacity="0.5" />

      {/* Compass */}
      {ticks.map((a) => {
        const bearing = ((a % 360) + 360) % 360;
        const x = xFor(bearing);
        if (x < -5 || x > W + 5) return null;
        const major = bearing % 45 === 0;
        const minor = bearing % 15 === 0;
        return (
          <g key={a}>
            <line
              x1={x}
              x2={x}
              y1={HORIZON_Y}
              y2={HORIZON_Y + (major ? 12 : minor ? 7 : 4)}
              stroke="#fff"
              strokeOpacity={major ? 0.7 : 0.35}
            />
            {major && (
              <text x={x} y={HORIZON_Y + 34} fill="#E2E8F0" fontSize={15 * scale} fontWeight="600" textAnchor="middle">
                {compass(bearing)}
              </text>
            )}
            {!major && minor && (
              <text x={x} y={HORIZON_Y + 30} fill="#7A93B8" fontSize={10 * scale} textAnchor="middle">
                {bearing}°
              </text>
            )}
          </g>
        );
      })}

      {/* The launch */}
      {visible ? (
        <g>
          <line
            x1={W / 2}
            x2={W / 2}
            y1={HORIZON_Y}
            y2={markerY}
            stroke={style.hex}
            strokeOpacity="0.6"
            strokeDasharray="3 4"
          />
          <circle cx={W / 2} cy={markerY} r={22} fill={style.hex} fillOpacity="0.18" />
          <circle cx={W / 2} cy={markerY} r={7} fill={style.hex} />
          <circle cx={W / 2} cy={markerY} r={12} fill="none" stroke="#9F7AEA" strokeWidth="1.5" />
          <text
            x={W / 2}
            y={markerY - 20}
            fill="#fff"
            fontSize={13 * scale}
            textAnchor="middle"
            paintOrder="stroke"
            stroke="#06091A"
            strokeWidth="4"
            strokeLinejoin="round"
          >
            {name}
          </text>
        </g>
      ) : (
        <g>
          <circle cx={W / 2} cy={HORIZON_Y} r={7} fill="#0B1120" stroke={style.hex} strokeWidth="2" />
          <text
            x={W / 2}
            y={HORIZON_Y - 18}
            fill="#fff"
            fontSize={13 * scale}
            textAnchor="middle"
            paintOrder="stroke"
            stroke="#06091A"
            strokeWidth="4"
            strokeLinejoin="round"
          >
            Hidden by the curve of the Earth
          </text>
        </g>
      )}

      {/* A fist held at arm's length, for scale */}
      {10 * PX_PER_DEGREE < HORIZON_Y - 30 && (
        <g>
          <path
            d={`M${W - 52} ${HORIZON_Y}H${W - 46}V${HORIZON_Y - 10 * PX_PER_DEGREE}H${W - 52}`}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.75"
          />
          <text
            x={W - 58}
            y={HORIZON_Y - 5 * PX_PER_DEGREE + 4}
            fill="#fff"
            fillOpacity="0.85"
            fontSize={12 * scale}
            textAnchor="end"
          >
            1 fist
          </text>
        </g>
      )}
    </Box>
  );
}
