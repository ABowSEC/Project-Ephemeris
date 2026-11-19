import { useEffect, useMemo, useState } from "react";
import { Box, HStack, IconButton, Image, Text } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUpcomingLaunches } from "../../hooks/useUpcomingLaunches";
import { useImageInfo } from "../../hooks/useImageStatus";
import { launchImageUrl } from "../../utils/launchFields";
import { withAlpha } from "../../utils/color";
import { HERO_PHOTOS, heroPhotoOfTheDay, heroSrc, heroSrcSet } from "../../data/heroPhotos";

// Hero box heights, matching Home's layout (photo band on phones, full hero on lg)
const PHONE_HEIGHT = 380;
const DESKTOP_HEIGHT = 720;
const LG = 992;
// How far a photo may be enlarged on screen before it looks soft
const MAX_UPSCALE = 1.3;
const FADE_MS = 600;
// The visitor's pick, by id ("live" or a curated slug)
const STORAGE_KEY = "ephemeris.heroPhoto.v1";
const LIVE = "live";

/** True when a photo of this size can cover the hero without visible blur. */
function isSharpEnough(width: number, height: number): boolean {
  if (typeof window === "undefined" || !width || !height) return false;
  const boxW = window.innerWidth;
  const boxH = boxW >= LG ? DESKTOP_HEIGHT : PHONE_HEIGHT;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.max(boxW / width, boxH / height) * dpr;
  return scale <= MAX_UPSCALE;
}

function readPick(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePick(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the pick just won't persist
  }
}

interface Choice {
  id: string;
  src: string;
  srcSet?: string;
  position?: string;
  caption: string;
}

function curatedChoices(): Choice[] {
  return HERO_PHOTOS.map((photo) => ({
    id: photo.slug,
    src: heroSrc(photo, photo.widths[photo.widths.length - 1]),
    srcSet: heroSrcSet(photo),
    position: photo.position,
    caption: `${photo.caption} · ${photo.credit}`,
  }));
}

/** One photo layer: image, filter and scrim. Fades in once loaded. */
function PhotoLayer({ choice, shown, onLoad }: { choice: Choice; shown: boolean; onLoad: () => void }) {
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
 * Full-bleed hero photo, fading into the starfield at the bottom. The
 * options are the next launch's own photo (only when it's sharp enough) and
 * the curated NASA set. Visitors can step through them; their pick is
 * remembered. Default: the live photo if sharp, else the photo of the day.
 */
export default function HomeHeroPhoto() {
  const { nextLaunch } = useUpcomingLaunches();
  const live = launchImageUrl(nextLaunch);
  const liveInfo = useImageInfo(live);
  const [pick, setPick] = useState<string | null>(readPick);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  // The last photo that finished loading, kept underneath while the next one
  // fades in so switching crossfades instead of flashing the starfield
  const [settled, setSettled] = useState<Choice | null>(null);

  const liveSharp = Boolean(live && liveInfo.status === "ready" && isSharpEnough(liveInfo.width, liveInfo.height));
  // Don't offer anything while the live photo is still being measured
  const measuring = Boolean(live) && liveInfo.status === "loading";

  const choices = useMemo<Choice[]>(() => {
    const list = curatedChoices();
    if (liveSharp && live && nextLaunch) {
      list.unshift({ id: LIVE, src: live, caption: `Next launch: ${nextLaunch.name}` });
    }
    return list;
  }, [liveSharp, live, nextLaunch]);

  const defaultId = liveSharp ? LIVE : heroPhotoOfTheDay()?.slug;
  const current = measuring ? null : choices.find((c) => c.id === pick) ?? choices.find((c) => c.id === defaultId) ?? null;
  const index = current ? choices.indexOf(current) : -1;

  // Once the new photo has faded in, drop the one underneath
  useEffect(() => {
    if (!current || loadedSrc !== current.src || settled?.src === current.src) return;
    const timer = setTimeout(() => setSettled(current), FADE_MS);
    return () => clearTimeout(timer);
  }, [current, loadedSrc, settled]);

  if (!current) return null;
  const visible = loadedSrc === current.src;

  const step = (delta: number) => {
    const next = choices[(index + delta + choices.length) % choices.length];
    setPick(next.id);
    savePick(next.id);
  };

  return (
    <>
      <Box
        aria-hidden="true"
        position="absolute"
        inset={0}
        bottom={{ base: "auto", lg: 0 }}
        h={{ base: `${PHONE_HEIGHT}px`, lg: "auto" }}
        sx={{ maskImage: "linear-gradient(to bottom, #000 60%, transparent 100%)" }}
      >
        {settled && settled.src !== current.src && <PhotoLayer key={settled.src} choice={settled} shown onLoad={() => {}} />}
        <PhotoLayer key={current.src} choice={current} shown={visible} onLoad={() => setLoadedSrc(current.src)} />
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

      <HStack
        position="absolute"
        top={2}
        right={{ base: 2, md: 4 }}
        zIndex={1}
        spacing={0}
        bg={withAlpha("bg.body", 70)}
        border="1px solid"
        borderColor="border.default"
        rounded="sm"
        pl={3}
        role="group"
        aria-label="Hero photo"
      >
        <Text fontSize="11px" color="text.secondary" noOfLines={1} maxW={{ base: "180px", md: "320px" }} aria-live="polite">
          {current.caption}
        </Text>
        {choices.length > 1 && (
          <>
            <Text fontSize="11px" color="text.secondary" pl={2} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {index + 1}/{choices.length}
            </Text>
            <IconButton
              aria-label="Previous photo"
              icon={<ChevronLeft size={16} />}
              variant="ghost"
              size="sm"
              minW={{ base: "44px", md: "40px" }}
              h={{ base: "44px", md: "40px" }}
              color="text.primary"
              onClick={() => step(-1)}
            />
            <IconButton
              aria-label="Next photo"
              icon={<ChevronRight size={16} />}
              variant="ghost"
              size="sm"
              minW={{ base: "44px", md: "40px" }}
              h={{ base: "44px", md: "40px" }}
              color="text.primary"
              onClick={() => step(1)}
            />
          </>
        )}
      </HStack>
    </>
  );
}
