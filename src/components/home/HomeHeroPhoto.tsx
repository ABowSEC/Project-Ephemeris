import { useState } from "react";
import { Box, Image, Text } from "@chakra-ui/react";
import { useUpcomingLaunches } from "../../hooks/useUpcomingLaunches";
import { useImageInfo } from "../../hooks/useImageStatus";
import { launchImageUrl } from "../../utils/launchFields";
import { withAlpha } from "../../utils/color";
import { heroPhotoOfTheDay, heroSrc, heroSrcSet } from "../../data/heroPhotos";

// Hero box heights, matching Home's layout (photo band on phones, full hero on lg)
const PHONE_HEIGHT = 380;
const DESKTOP_HEIGHT = 720;
const LG = 992;
// How far a photo may be enlarged on screen before it looks soft
const MAX_UPSCALE = 1.3;

/** True when a photo of this size can cover the hero without visible blur. */
function isSharpEnough(width: number, height: number): boolean {
  if (typeof window === "undefined" || !width || !height) return false;
  const boxW = window.innerWidth;
  const boxH = boxW >= LG ? DESKTOP_HEIGHT : PHONE_HEIGHT;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.max(boxW / width, boxH / height) * dpr;
  return scale <= MAX_UPSCALE;
}

interface Choice {
  src: string;
  srcSet?: string;
  position?: string;
  caption?: string;
}

/**
 * Full-bleed hero photo. Prefers the next launch's own photo when it is
 * sharp enough, then the curated photo of the day, then nothing (the
 * starfield shows through). Fades into the starfield at the bottom.
 */
export default function HomeHeroPhoto() {
  const { nextLaunch } = useUpcomingLaunches();
  const live = launchImageUrl(nextLaunch);
  const liveInfo = useImageInfo(live);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  let choice: Choice | null = null;
  if (live && liveInfo.status === "ready" && isSharpEnough(liveInfo.width, liveInfo.height)) {
    choice = { src: live };
  } else if (!live || liveInfo.status !== "loading") {
    // Don't flash the curated photo while the live one is still being measured
    const curated = heroPhotoOfTheDay();
    if (curated) {
      choice = {
        src: heroSrc(curated, curated.widths[curated.widths.length - 1]),
        srcSet: heroSrcSet(curated),
        position: curated.position,
        caption: `${curated.caption} · ${curated.credit}`,
      };
    }
  }

  if (!choice) return null;
  const visible = loadedSrc === choice.src;

  return (
    <>
      <Box
        aria-hidden="true"
        position="absolute"
        inset={0}
        bottom={{ base: "auto", lg: 0 }}
        h={{ base: `${PHONE_HEIGHT}px`, lg: "auto" }}
        opacity={visible ? 1 : 0}
        transition="opacity 0.6s"
        sx={{ maskImage: "linear-gradient(to bottom, #000 60%, transparent 100%)" }}
      >
        <Image
          key={choice.src}
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
          onLoad={() => setLoadedSrc(choice.src)}
          position="absolute"
          inset={0}
          w="100%"
          h="100%"
          objectFit="cover"
          objectPosition={choice.position ?? "center"}
          filter={{ base: "brightness(0.7)", lg: "brightness(0.85)" }}
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
      {choice.caption && visible && (
        <Text
          position="absolute"
          top={3}
          right={{ base: 4, md: 6 }}
          fontSize="11px"
          color="text.secondary"
          bg={withAlpha("bg.body", 60)}
          px={2}
          py={0.5}
          rounded="sm"
        >
          {choice.caption}
        </Text>
      )}
    </>
  );
}
