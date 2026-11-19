import { useEffect, useState } from "react";
import { Box, Image } from "@chakra-ui/react";
import { withAlpha } from "../../utils/color";
import { HERO_PHONE_HEIGHT, type HeroChoice } from "../../hooks/useHeroPhoto";

const FADE_MS = 600;

/** One photo layer. Fades in once loaded. */
function PhotoLayer({ choice, shown, onLoad }: { choice: HeroChoice; shown: boolean; onLoad?: () => void }) {
  return (
    <Box position="absolute" inset={0} opacity={shown ? 1 : 0} transition={`opacity ${FADE_MS}ms`}>
      <Image
        src={choice.src}
        srcSet={choice.srcSet}
        // On phones the photo band is ~380px tall, so a 16:9 photo is drawn
        // ~680px wide and cropped at the sides
        sizes="(max-width: 991px) 680px, 100vw"
        alt=""
        // The hero image is the page's largest paint. Lowercase because
        // React 18 doesn't know the camelCase prop.
        {...{ fetchpriority: "high" }}
        decoding="async"
        onLoad={onLoad}
        position="absolute"
        inset={0}
        w="100%"
        h="100%"
        objectFit="cover"
        objectPosition={choice.position ?? "center"}
        filter={{ base: "brightness(0.7)", lg: "brightness(0.85)" }}
      />
    </Box>
  );
}

/**
 * Full-bleed hero photo, fading into the starfield at the bottom. Switching
 * photos crossfades: the last loaded one stays underneath until the new one
 * has faded in. Which photo to show comes from useHeroPhoto.
 */
export default function HomeHeroPhoto({ current }: { current: HeroChoice | null }) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [settled, setSettled] = useState<HeroChoice | null>(null);

  // Once the new photo has faded in, drop the one underneath
  useEffect(() => {
    if (!current || loadedSrc !== current.src || settled?.src === current.src) return;
    const timer = setTimeout(() => setSettled(current), FADE_MS);
    return () => clearTimeout(timer);
  }, [current, loadedSrc, settled]);

  if (!current) return null;

  return (
    <Box
      aria-hidden="true"
      position="absolute"
      inset={0}
      bottom={{ base: "auto", lg: 0 }}
      h={{ base: `${HERO_PHONE_HEIGHT}px`, lg: "auto" }}
      pointerEvents="none"
      sx={{ maskImage: "linear-gradient(to bottom, #000 60%, transparent 100%)" }}
    >
      {settled && settled.src !== current.src && <PhotoLayer key={settled.src} choice={settled} shown />}
      <PhotoLayer
        key={current.src}
        choice={current}
        shown={loadedSrc === current.src}
        onLoad={() => setLoadedSrc(current.src)}
      />
      {/* Scrim behind the text column only (DESIGN.md, Elevation) */}
      <Box
        position="absolute"
        inset={0}
        bgImage={{
          base: `linear-gradient(to bottom, ${withAlpha("bg.body", 20)}, ${withAlpha("bg.body", 60)})`,
          lg: `linear-gradient(to right, ${withAlpha("bg.body", 92)} 0%, ${withAlpha("bg.body", 70)} 35%, transparent 62%)`,
        }}
      />
    </Box>
  );
}
