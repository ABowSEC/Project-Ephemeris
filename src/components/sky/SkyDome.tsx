import { useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import type { Observer } from '../../hooks/useObserver';
import { skyPosition, sunHorizontal } from '../../utils/sky';
import { STAR_FIELD, horizonColor, starOpacity, zenithColor } from './skyColors';
import { missionName } from './skyText';
import {
  VISIBILITY,
  nearestLaunch,
  padGlow,
  type PadGroup,
  type SkyLaunch,
} from './skyLaunches';

// The sky as you would see it lying on your back looking up: zenith at the
// centre, horizon at the rim, north at the top and east on the LEFT (the
// convention of every star chart, which looks mirrored on a map and correct
// overhead).
const R = 240; // horizon radius
const LAUNCH_RING = R + 24; // where launches beyond the horizon sit
const SUN_RING = R + 54; // where the Sun sits while it is below the horizon
const SELECT = '#9F7AEA';

const RAD = Math.PI / 180;

/** Screen position for a compass bearing and a radius; east is to the left. */
function polar(azimuth: number, radius: number): { x: number; y: number } {
  return { x: -radius * Math.sin(azimuth * RAD), y: -radius * Math.cos(azimuth * RAD) };
}

/** Screen position for a point in the sky. */
function skyPoint(azimuth: number, altitude: number) {
  return polar(azimuth, ((90 - altitude) / 90) * R);
}

interface SkyDomeProps {
  observer: Observer;
  time: number;
  pads: PadGroup[];
  selectedId: string | null;
  onSelect: (launch: SkyLaunch) => void;
}

export default function SkyDome({ observer, time, pads, selectedId, onSelect }: SkyDomeProps) {
  const sun = sunHorizontal(observer.lat, observer.lon, time);

  const marks = useMemo(
    () =>
      pads.map((pad) => {
        const launch = nearestLaunch(pad, time);
        return { pad, launch, position: skyPosition(observer, pad, launch.t), glow: padGlow(pad, time) };
      }),
    [pads, observer, time]
  );

  const sunUp = sun.altitude >= 0;
  const sunOnDome = skyPoint(sun.azimuth, Math.max(sun.altitude, 0));
  const sunBelow = polar(sun.azimuth, SUN_RING);
  const glowStrength = Math.max(0, Math.min(1, (sun.altitude + 8) / 14));

  return (
    <Box
      as="svg"
      viewBox="-320 -320 640 640"
      w="100%"
      h="auto"
      display="block"
      role="img"
      aria-label={`Sky above ${observer.label}. The Sun is ${Math.abs(sun.altitude).toFixed(0)} degrees ${
        sunUp ? 'above' : 'below'
      } the horizon.`}
      sx={{ fontFamily: 'var(--chakra-fonts-mono)', userSelect: 'none' }}
    >
      <defs>
        <radialGradient id="sky-fill" cx="0" cy="0" r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={zenithColor(sun.altitude)} />
          <stop offset="0.62" stopColor={zenithColor(sun.altitude - 2)} />
          <stop offset="1" stopColor={horizonColor(sun.altitude)} />
        </radialGradient>
        <radialGradient id="sun-glow">
          <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.9" />
          <stop offset="0.25" stopColor="#F6AD55" stopOpacity="0.45" />
          <stop offset="1" stopColor="#F6AD55" stopOpacity="0" />
        </radialGradient>
        <clipPath id="sky-clip">
          <circle r={R} />
        </clipPath>
      </defs>

      {/* Dome */}
      <circle r={R} fill="url(#sky-fill)" />
      {glowStrength > 0 && (
        <g clipPath="url(#sky-clip)" opacity={glowStrength}>
          <circle
            cx={sunOnDome.x}
            cy={sunOnDome.y}
            r={sunUp ? 150 : 170}
            fill="url(#sun-glow)"
          />
        </g>
      )}

      {/* Stars, fading in through twilight */}
      {starOpacity(sun.altitude) > 0 && (
        <g fill="#fff" opacity={starOpacity(sun.altitude)}>
          {STAR_FIELD.map((star, i) => (
            <circle key={i} cx={star.x * (R - 6)} cy={star.y * (R - 6)} r={star.r} fillOpacity={star.o} />
          ))}
        </g>
      )}

      {/* Altitude rings and azimuth spokes */}
      <g fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1">
        <circle r={(R * 2) / 3} />
        <circle r={R / 3} />
        {[0, 45, 90, 135].map((az) => {
          const p = polar(az, R);
          return <line key={az} x1={p.x} y1={p.y} x2={-p.x} y2={-p.y} />;
        })}
      </g>
      <g fill="#fff" fillOpacity="0.32" fontSize="9" textAnchor="middle">
        <text x={4} y={-(R * 2) / 3 + 3} textAnchor="start">30°</text>
        <text x={4} y={-R / 3 + 3} textAnchor="start">60°</text>
      </g>

      {/* Horizon */}
      <circle r={R} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle
        r={LAUNCH_RING}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.14"
        strokeDasharray="2 5"
      />
      <g fill="#fff" fillOpacity="0.7" fontSize="13" fontWeight="600" textAnchor="middle">
        <text x={0} y={-R - 62}>N</text>
        <text x={0} y={R + 72}>S</text>
        <text x={-(R + 66)} y={5}>E</text>
        <text x={R + 66} y={5}>W</text>
      </g>
      <text
        x={0}
        y={-R - 44}
        fill="#fff"
        fillOpacity="0.3"
        fontSize="8"
        letterSpacing="0.18em"
        textAnchor="middle"
      >
        BEYOND THE HORIZON
      </text>

      {/* The Sun */}
      {sunUp ? (
        <g>
          <circle cx={sunOnDome.x} cy={sunOnDome.y} r={11} fill="#FFE2A8" />
          <circle cx={sunOnDome.x} cy={sunOnDome.y} r={17} fill="none" stroke="#FFE2A8" strokeOpacity="0.5" />
        </g>
      ) : (
        <g>
          <circle
            cx={sunBelow.x}
            cy={sunBelow.y}
            r={7}
            fill="none"
            stroke="#FFE2A8"
            strokeOpacity="0.8"
            strokeDasharray="2 2"
          />
          <text
            x={sunBelow.x}
            y={sunBelow.y + (sunBelow.y > 0 ? 20 : -13)}
            fill="#FFE2A8"
            fillOpacity="0.75"
            fontSize="9"
            textAnchor="middle"
          >
            SUN {sun.altitude.toFixed(0)}°
          </text>
        </g>
      )}

      {/* Launches */}
      {marks.map(({ pad, launch, position, glow }) => {
        const style = VISIBILITY[position.visibility];
        const inSight = position.elevation > 0;
        const selected = pad.launches.some((l) => l.id === selectedId);
        const point = inSight
          ? skyPoint(position.azimuth, position.elevation)
          : polar(position.azimuth, LAUNCH_RING);
        const rim = polar(position.azimuth, R);
        const opacity = 0.55 + 0.45 * glow;
        const labelled = selected || glow > 0.55;
        // Face the centre so the label stays inside the frame
        const anchorEnd = point.x > 0;
        const text = `${missionName(launch.name)}${pad.launches.length > 1 ? ` (+${pad.launches.length - 1} more here)` : ''}`;

        return (
          <g
            key={pad.key}
            role="button"
            tabIndex={0}
            aria-label={`${launch.name} from ${pad.name}: ${style.label}, ${Math.round(position.distanceKm)} kilometres away`}
            style={{ cursor: 'pointer', outline: 'none' }}
            onClick={() => onSelect(launch)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(launch);
              }
            }}
          >
            <title>{`${text}\n${pad.name}\n${style.label} · ${Math.round(position.distanceKm).toLocaleString()} km`}</title>
            {/* Generous invisible target so thin marks are still easy to hit */}
            <circle cx={point.x} cy={point.y} r={14} fill="transparent" />
            {inSight && (
              <line
                x1={rim.x}
                y1={rim.y}
                x2={point.x}
                y2={point.y}
                stroke={style.hex}
                strokeOpacity={0.35 + 0.5 * glow}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
            {glow > 0.4 && (
              <circle
                cx={point.x}
                cy={point.y}
                r={8 + 10 * glow}
                fill={style.hex}
                fillOpacity={0.18 * glow}
              />
            )}
            {inSight ? (
              <circle cx={point.x} cy={point.y} r={3.5 + 3 * glow} fill={style.hex} fillOpacity={opacity} />
            ) : (
              <circle
                cx={point.x}
                cy={point.y}
                r={3 + 2 * glow}
                fill="#0B1120"
                stroke={style.hex}
                strokeOpacity={opacity}
                strokeWidth="1.5"
              />
            )}
            {selected && (
              <circle cx={point.x} cy={point.y} r={12} fill="none" stroke={SELECT} strokeWidth="1.5" />
            )}
            {labelled && (
              <text
                x={point.x + (anchorEnd ? -16 : 16)}
                y={point.y + 3}
                fill="#E2E8F0"
                fontSize="10"
                textAnchor={anchorEnd ? 'end' : 'start'}
                paintOrder="stroke"
                stroke="#06091A"
                strokeWidth="3"
                strokeLinejoin="round"
              >
                {text.length > 34 ? `${text.slice(0, 33)}…` : text}
              </text>
            )}
          </g>
        );
      })}

      {/* Observer, at the zenith */}
      <circle r={2.5} fill="#fff" fillOpacity="0.6" />
    </Box>
  );
}
