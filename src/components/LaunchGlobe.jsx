import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Flex, HStack, IconButton, Select, Text, usePrefersReducedMotion } from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, CloseIcon } from '@chakra-ui/icons';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import ThreeGlobe from 'three-globe';
import { createBasicScene, createStarfield, setupResizeHandler } from '../utils/sceneSetup';
import { createAtmosphereGlow, createPlanetHalo } from '../utils/threeHelpers';
import { OrbitControls } from '../utils/OrbitControls';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { useFullscreen } from '../hooks/useFullscreen';
import { useSyncedRef } from '../hooks/useSyncedRef';
import { withAlpha } from "../utils/color";

// Pause before the idle spin resumes after a drag.
const IDLE_DELAY_MS = 1500;
const IDLE_SPIN_RAD_PER_SEC = 0.05;

// Neutral sites, teal for the selected one (teal = interactive/selected).
// Green is reserved for launches that are live right now.
const POINT_COLOR = '#F0F0FA';
const HOVER_COLOR = '#FFFFFF';
const SELECTED_COLOR = '#2DD4BF';

function basePointRadius(site) {
  return 0.45 + Math.min(site.launches.length, 10) * 0.06;
}

const FLIGHT_DURATION_MS = 900;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Rotate along the globe's surface instead of cutting through it. */
function slerpDirections(a, b, t) {
  const omega = a.angleTo(b);
  if (omega < 1e-5) return b.clone();
  if (Math.abs(Math.PI - omega) < 1e-3) {
    // Opposite points have no unique path; a straight lerp is fine here.
    return a.clone().lerp(b, t).normalize();
  }
  const sinOmega = Math.sin(omega);
  const scaleA = Math.sin((1 - t) * omega) / sinOmega;
  const scaleB = Math.sin(t * omega) / sinOmega;
  return new THREE.Vector3().addScaledVector(a, scaleA).addScaledVector(b, scaleB);
}

// Space Devs sends ISO alpha-3 codes. Only launch countries are listed;
// anything else shows the raw code.
const COUNTRY_NAMES = {
  USA: 'United States',
  CHN: 'China',
  RUS: 'Russia',
  KAZ: 'Kazakhstan',
  FRA: 'France (French Guiana)',
  IND: 'India',
  JPN: 'Japan',
  NZL: 'New Zealand',
  IRN: 'Iran',
  PRK: 'North Korea',
  ISR: 'Israel',
  BRA: 'Brazil',
  KOR: 'South Korea',
  GBR: 'United Kingdom',
  AUS: 'Australia',
};

function countryLabel(code) {
  return COUNTRY_NAMES[code] ?? code ?? 'Unknown';
}

const MotionBox = motion(Box);

/** Screen position for a site's name tag, or null if it's behind the globe. */
function projectLabel(site, globe, camera, renderer) {
  if (!site || !globe) return null;
  const { x, y, z } = globe.getCoords(site.lat, site.lng, 0.02);
  const worldPos = new THREE.Vector3(x, y, z);
  // On a sphere, position is also the surface normal. Facing away = hidden.
  const normal = worldPos.clone().normalize();
  const viewDir = camera.position.clone().sub(worldPos).normalize();
  if (normal.dot(viewDir) < 0.05) return null;

  const projected = worldPos.project(camera);
  return {
    left: (projected.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
    top: (-projected.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
  };
}

/**
 * 3D Earth with upcoming launch sites. Clicking a site calls onSelectSite.
 * In fullscreen, where the page around it is hidden, the selected site also
 * opens a details panel whose body comes from renderSiteDetails.
 *
 * three-globe has no click handling, so picking uses invisible hit spheres.
 */
export default function LaunchGlobe({ sites, onSelectSite, selectedSite = null, renderSiteDetails }) {
  const mountRef = useRef(null);
  const labelRef = useRef(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(mountRef);
  const prefersReducedMotion = usePrefersReducedMotion();
  const prefersReducedMotionRef = useSyncedRef(prefersReducedMotion);
  const onSelectSiteRef = useSyncedRef(onSelectSite);
  const selectedSiteRef = useSyncedRef(selectedSite);
  const paused = !!selectedSite;
  const pausedRef = useSyncedRef(paused);

  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const controlsRef = useRef();
  const globeRef = useRef();
  const hitTargetsRef = useRef([]);
  const idleSinceRef = useRef(0);
  const hoveredKeyRef = useRef(null);
  const hoveredSiteRef = useRef(null);
  const selectedKeyRef = useRef(null);
  const flightRef = useRef(null);

  const selectedIndex = selectedSite ? sites.findIndex((s) => s.key === selectedSite.key) : -1;

  // Step to the next/previous site, wrapping around either end. Stepping
  // "next" with nothing selected starts at the first (soonest) site.
  function hopBy(delta) {
    if (!sites.length) return;
    const base = selectedIndex === -1 ? (delta > 0 ? -1 : 0) : selectedIndex;
    const next = (((base + delta) % sites.length) + sites.length) % sites.length;
    onSelectSite?.(sites[next]);
  }

  const sitesByCountry = useMemo(() => {
    const groups = new Map();
    for (const site of sites) {
      const code = site.countryCode ?? 'ZZZ';
      if (!groups.has(code)) groups.set(code, []);
      groups.get(code).push(site);
    }
    return [...groups.entries()].sort((a, b) => countryLabel(a[0]).localeCompare(countryLabel(b[0])));
  }, [sites]);

  // Restyle points for hover/selection without rebuilding them.
  const applyPointStyles = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe
      .pointColor((d) =>
        d.key === selectedKeyRef.current
          ? SELECTED_COLOR
          : d.key === hoveredKeyRef.current
            ? HOVER_COLOR
            : POINT_COLOR
      )
      .pointRadius((d) => {
        const base = basePointRadius(d);
        const active = d.key === selectedKeyRef.current || d.key === hoveredKeyRef.current;
        return active ? base * 1.5 : base;
      });
  }, []);

  // Sets the name tag's text. Its position is updated every frame.
  const refreshLabel = useCallback(() => {
    const active = selectedSiteRef.current ?? hoveredSiteRef.current;
    if (labelRef.current) labelRef.current.textContent = active?.name ?? '';
  }, [selectedSiteRef]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mountNode = mountRef.current;
    const width = mountNode.clientWidth;
    const height = mountNode.clientHeight;

    const { scene, camera, renderer } = createBasicScene(width, height, {
      fov: 60,
      far: 10000,
      clearColor: 0x000000,
      shadowMap: false,
    });
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    mountNode.appendChild(renderer.domElement);

    scene.add(createStarfield(2000, 4000));

    // No point light: the globe sits at the origin, so it would be lit evenly
    // from inside. Ambient plus one directional light gives it a day side.
    scene.add(new THREE.AmbientLight(0x9099aa, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(300, 200, 300);
    scene.add(sun);

    // NASA Blue Marble 4096x2048 (from three-globe's examples).
    const globe = new ThreeGlobe().globeImageUrl('/textures/earth-blue-marble.jpg');
    scene.add(globe);
    globeRef.current = globe;

    const radius = globe.getGlobeRadius();
    camera.position.set(0, 0, radius * 2.5);

    // Matches Earth's atmosphere in /solarsim.
    scene.add(createAtmosphereGlow(radius, 0x4488ff, { scale: 1.2, opacity: 0.38 }));
    scene.add(createPlanetHalo(radius, 0x4488ff, { scale: 3.0, opacity: 0.28 }));

    const controls = new OrbitControls(camera, renderer.domElement, {
      minDistance: radius * 1.3,
      maxDistance: radius * 6,
    });
    controlsRef.current = controls;

    const cleanupResize = setupResizeHandler(camera, renderer, mountNode);

    // Picking: one invisible hit sphere per site, placed with the globe's own
    // lat/lng conversion so it always lines up.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function pointerToNdc(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickSite(event) {
      pointerToNdc(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitTargetsRef.current, false);
      return hits[0]?.object ?? null;
    }

    function handlePointerMove(event) {
      const hit = pickSite(event);
      const site = hit?.userData.site ?? null;
      if ((site?.key ?? null) !== hoveredKeyRef.current) {
        hoveredKeyRef.current = site?.key ?? null;
        hoveredSiteRef.current = site;
        renderer.domElement.style.cursor = site ? 'pointer' : '';
        applyPointStyles();
        refreshLabel();
      }
    }

    function handlePointerLeave() {
      if (hoveredKeyRef.current !== null) {
        hoveredKeyRef.current = null;
        hoveredSiteRef.current = null;
        renderer.domElement.style.cursor = '';
        applyPointStyles();
        refreshLabel();
      }
    }

    function handleClick(event) {
      const hit = pickSite(event);
      if (hit) onSelectSiteRef.current?.(hit.userData.site);
    }

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('click', handleClick);

    return () => {
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('click', handleClick);
      cleanupResize();
      controls.dispose();
      globe._destructor?.();

      scene.traverse((obj) => {
        obj.geometry?.dispose();
        const materials = obj.material
          ? (Array.isArray(obj.material) ? obj.material : [obj.material])
          : [];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
          material.dispose();
        });
      });

      if (renderer.domElement && mountNode?.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [applyPointStyles, refreshLabel]); // eslint-disable-line react-hooks/exhaustive-deps -- mount once, mirrors SolarSystemView.jsx

  // Rebuild points, rings, and hit targets when the site list changes.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe
      .pointsData(sites)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.015);
    applyPointStyles();

    // Pulsing rings so the map reads as live.
    globe
      .ringsData(sites)
      .ringColor(() => (t) => `rgba(0, 255, 157, ${(1 - t) * 0.55})`)
      .ringMaxRadius((d) => 2.5 + Math.min(d.launches.length, 10) * 0.6)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(2200);

    // Remove old hit targets so they don't pile up across updates.
    hitTargetsRef.current.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.parent?.remove(mesh);
    });

    const radius = globe.getGlobeRadius();
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    hitTargetsRef.current = sites.map((site) => {
      const { x, y, z } = globe.getCoords(site.lat, site.lng, 0.02);
      // Bigger than the visible point so it's easy to tap.
      const hitGeometry = new THREE.SphereGeometry(radius * 0.06, 8, 8);
      const mesh = new THREE.Mesh(hitGeometry, hitMaterial);
      mesh.position.set(x, y, z);
      mesh.userData.site = site;
      globe.add(mesh);
      return mesh;
    });
  }, [sites, applyPointStyles]);

  // On selection: restyle points, update the label, and fly to the new site.
  useEffect(() => {
    selectedKeyRef.current = selectedSite?.key ?? null;
    applyPointStyles();
    refreshLabel();

    const globe = globeRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!selectedSite || !globe || !camera || !controls) return;

    const { x, y, z } = globe.getCoords(selectedSite.lat, selectedSite.lng, 0);
    const toDir = new THREE.Vector3(x, y, z).normalize();
    const fromDir = camera.position.clone().sub(controls.target).normalize();
    const distance = camera.position.distanceTo(controls.target);

    // Clear any in-flight drag/idle momentum so it doesn't reappear as a
    // sudden jump once the flight hands control back to update().
    controls.sphericalDelta.theta = 0;
    controls.sphericalDelta.phi = 0;
    flightRef.current = { fromDir, toDir, distance, elapsed: 0 };
  }, [selectedSite, applyPointStyles, refreshLabel]);

  const animate = useCallback((deltaTime) => {
    const controls = controlsRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!controls || !renderer || !scene || !camera) return;

    const flight = flightRef.current;
    if (flight) {
      flight.elapsed += deltaTime;
      const t = Math.min(flight.elapsed / FLIGHT_DURATION_MS, 1);
      const dir = slerpDirections(flight.fromDir, flight.toDir, easeInOutCubic(t));
      camera.position.copy(controls.target).addScaledVector(dir, flight.distance);
      camera.lookAt(controls.target);
      if (t >= 1) flightRef.current = null;
      renderer.render(scene, camera);
      positionLabel();
      return;
    }

    const dt = Math.min(deltaTime, 100) * 0.001;

    if (controls.isPointerDown) {
      idleSinceRef.current = 0;
    } else if (pausedRef.current) {
      // Hold still while a panel is open, and restart the idle delay on close.
      idleSinceRef.current = 0;
      controls.sphericalDelta.theta = 0;
      controls.sphericalDelta.phi = 0;
    } else {
      idleSinceRef.current += deltaTime;
      // Assign, don't add: OrbitControls already decays sphericalDelta each
      // frame, so adding to it compounds the speed (about 20x).
      if (!prefersReducedMotionRef.current && idleSinceRef.current > IDLE_DELAY_MS) {
        controls.sphericalDelta.theta = -IDLE_SPIN_RAD_PER_SEC * dt;
      }
    }

    controls.update();
    renderer.render(scene, camera);
    positionLabel();

    function positionLabel() {
      const el = labelRef.current;
      if (!el) return;
      const active = selectedSiteRef.current ?? hoveredSiteRef.current;
      const pos = projectLabel(active, globeRef.current, camera, renderer);
      if (!pos) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${pos.left}px, ${pos.top}px) translate(-50%, -140%)`;
    }
  }, [prefersReducedMotionRef, pausedRef, selectedSiteRef]);

  useAnimationFrame(animate);

  return (
    <Box position="absolute" inset={0} bg="black">
      <Box ref={mountRef} position="absolute" inset={0} />

      {/* Floating name tag, anchored to whichever site is hovered or
          selected — position is written directly to this node's style every
          frame in the animation loop above, bypassing React state so a
          continuously-moving label doesn't force a re-render per frame. */}
      <Box
        ref={labelRef}
        position="absolute"
        top={0}
        left={0}
        px={2}
        py={0.5}
        borderRadius="sm"
        bg="bg.elevated"
        border="1px solid"
        borderColor="border.control"
        color="white"
        fontSize="xs"
        fontWeight="600"
        whiteSpace="nowrap"
        pointerEvents="none"
        display="none"
        zIndex={5}
      />

      {/* HUD bar: site selector + fullscreen, matching SolarSystemView's
          top-bar convention for controls layered over the 3D view. */}
      <Flex
        position="absolute"
        top={0}
        left={0}
        right={0}
        align="center"
        justify="space-between"
        gap={2}
        px={3}
        py={2}
        bg={withAlpha('bg.body', 72)}
        backdropFilter="blur(14px)"
        borderBottom="1px solid rgba(255,255,255,0.06)"
        zIndex={10}
        flexWrap="wrap"
      >
        <HStack spacing={1}>
          <IconButton
            aria-label="Previous launch site"
            icon={<ChevronLeftIcon />}
            onClick={() => hopBy(-1)}
            size="xs"
            variant="ghost"
            color="white"
          />
          <Select
            size="xs"
            maxW="220px"
            bg="whiteAlpha.100"
            color="white"
            borderColor="whiteAlpha.300"
            placeholder="Jump to a launch site..."
            value={selectedSite?.key ?? ''}
            onChange={(e) => {
              const site = sites.find((s) => s.key === e.target.value);
              if (site) onSelectSite?.(site);
            }}
          >
            {sitesByCountry.map(([code, group]) => (
              <optgroup key={code} label={countryLabel(code)}>
                {group.map((site) => (
                  <option key={site.key} value={site.key}>
                    {site.name} ({site.launches.length})
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <IconButton
            aria-label="Next launch site"
            icon={<ChevronRightIcon />}
            onClick={() => hopBy(1)}
            size="xs"
            variant="ghost"
            color="white"
          />
        </HStack>

        <IconButton
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          icon={isFullscreen ? <CloseIcon boxSize={3} /> : <ExternalLinkIcon />}
          onClick={toggleFullscreen}
          size="xs"
          variant="ghost"
          color="white"
        />
      </Flex>

      {/* Site info panel: docked to this component's own canvas rather than
          a page-level Drawer, so it reads as part of the 3D view: it slides
          in from the globe's own right edge at the same moment the camera
          flight (in the selection effect above) rotates that site into
          view, instead of a separate UI element popping over the page. */}
      <AnimatePresence>
        {selectedSite && isFullscreen && renderSiteDetails && (
          <MotionBox
            key={selectedSite.key}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            position="absolute"
            top="44px"
            right={0}
            bottom={0}
            w={{ base: '100%', sm: '320px' }}
            bg={withAlpha('bg.body', 85)}
            backdropFilter="blur(14px)"
            borderLeft="1px solid rgba(255,255,255,0.08)"
            overflowY="auto"
            p={4}
            zIndex={8}
          >
            <HStack justify="space-between" align="start" mb={3} spacing={3}>
              <Text fontWeight="600" lineHeight="1.3" color="text.primary">
                {selectedSite.name}
              </Text>
              <HStack spacing={1} flexShrink={0}>
                <IconButton
                  aria-label="Previous launch site"
                  icon={<ChevronLeftIcon />}
                  onClick={() => hopBy(-1)}
                  size="xs"
                  variant="ghost"
                  color="white"
                />
                <IconButton
                  aria-label="Next launch site"
                  icon={<ChevronRightIcon />}
                  onClick={() => hopBy(1)}
                  size="xs"
                  variant="ghost"
                  color="white"
                />
                <IconButton
                  aria-label="Close"
                  icon={<CloseIcon boxSize={2.5} />}
                  onClick={() => onSelectSite?.(null)}
                  size="xs"
                  variant="ghost"
                  color="white"
                />
              </HStack>
            </HStack>
            {renderSiteDetails(selectedSite)}
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  );
}
