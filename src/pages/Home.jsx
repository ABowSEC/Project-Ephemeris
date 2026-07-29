import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  VStack,
  HStack,
  Stack,
  Text,
  Heading,
  SimpleGrid,
  Spinner,
  Skeleton,
  Image,
  IconButton,
  Divider,
  Badge,
  AspectRatio,
  Container,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useImage,
  usePrefersReducedMotion
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
  ExternalLinkIcon,
  CalendarIcon,
  ArrowForwardIcon,
  DownloadIcon
} from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";
import { FaRocket, FaMapMarkerAlt } from "react-icons/fa";
import { fetchJson } from "../utils/fetchJson";
import { useApi } from "../hooks/useApi";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { useCountdown } from "../hooks/useCountdown";
import { usePageMeta } from "../hooks/usePageMeta";
import ErrorState from "../components/ErrorState";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`;

// Slow opacity breathe for the hero watermark; deliberately its own
// keyframes rather than reusing `pulse` (that one swings 1 <-> 0.4, tuned
// for a small fully-opaque status dot, not a large low-opacity watermark -
// animating opacity overrides a static opacity prop on the same element
// rather than multiplying with it, so the intended low-opacity range has to
// be baked into the keyframes directly).
const breathe = keyframes`
  0%, 100% { opacity: 0.14; }
  50%       { opacity: 0.30; }
`;

// Compact live next-launch panel for the hero; shares the app-wide cached
// launch data so it costs no extra API requests.
// Quick links to the sections the hero CTAs don't cover. Flight-console
// index: numbered hairline rows sharing one accent, not an icon-card grid
const QUICK_LINKS = [
  {
    to: "/mars",
    title: "Mars Rovers",
    blurb: "Imagery from the red planet's rovers",
  },
  {
    to: "/iss",
    title: "ISS Live",
    blurb: "Real-time station tracking and onboard video",
  },
  {
    to: "/explore",
    title: "Explore",
    blurb: "Search NASA's image library and space history",
  },
];

function QuickLinks() {
  return (
    <Box borderTop="1px solid" borderColor="border.default">
      {QUICK_LINKS.map(({ to, title, blurb }, i) => (
        <Flex
          key={to}
          as={RouterLink}
          to={to}
          role="group"
          gap={{ base: 3, md: 6 }}
          py={5}
          px={{ base: 1, md: 2 }}
          borderBottom="1px solid"
          borderColor="border.default"
          transition="background 0.2s"
          _hover={{ bg: "whiteAlpha.50" }}
        >
          <Text fontFamily="mono" fontSize="sm" color="accent.terminal" pt="1px">
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Box flex="1" minW={0}>
            <Text
              fontFamily="heading"
              fontSize="sm"
              fontWeight="600"
              letterSpacing="0.14em"
              textTransform="uppercase"
              color="text.primary"
              _groupHover={{ color: "brand.300" }}
              transition="color 0.2s"
            >
              {title}
            </Text>
            <Text fontSize="sm" color="text.secondary" mt={1}>
              {blurb}
            </Text>
          </Box>
          <ArrowForwardIcon
            alignSelf="center"
            color="text.secondary"
            transition="transform 0.2s, color 0.2s"
            _groupHover={{ color: "brand.300", transform: "translateX(4px)" }}
          />
        </Flex>
      ))}
    </Box>
  );
}

function NextLaunchPanel() {
  const { launches, loading } = useUpcomingLaunches();
  const next = launches[0] ?? null;
  const countdown = useCountdown(next?.window_start);

  if (loading) {
    return (
      <Box minW={{ base: "auto", md: "300px" }} textAlign="center" py={8}>
        <Spinner color="accent.terminal" thickness="3px" />
      </Box>
    );
  }
  if (!next) return null;

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <VStack
      as={RouterLink}
      to="/launches"
      align="stretch"
      spacing={3}
      bg="rgba(0,255,157,0.04)"
      border="1px solid"
      borderColor="rgba(0,255,157,0.25)"
      rounded="xl"
      p={6}
      minW={{ base: "100%", md: "320px" }}
      maxW="360px"
      transition="all 0.2s"
      _hover={{ borderColor: "rgba(0,255,157,0.55)", bg: "rgba(0,255,157,0.08)", textDecoration: "none" }}
    >
      <HStack spacing={2}>
        <Box as={FaRocket} color="accent.terminal" boxSize="10px" animation={`${pulse} 2s ease-in-out infinite`} />
        <Text fontSize="10px" color="accent.terminal" fontWeight="bold" letterSpacing="0.2em" textTransform="uppercase">
          Next Launch
        </Text>
        {next.status?.abbrev && (
          <Badge colorScheme={next.status.abbrev === "Go" ? "green" : "gray"} variant="subtle" fontSize="10px" rounded="full" ml="auto">
            {next.status.abbrev}
          </Badge>
        )}
      </HStack>

      <Text fontWeight="bold" color="text.primary" fontSize="md" noOfLines={2}>
        {next.name}
      </Text>

      {countdown ? (
        <Text
          fontFamily="mono"
          fontSize="3xl"
          fontWeight="bold"
          color="accent.terminal"
          letterSpacing="wide"
          lineHeight="1"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {countdown.d > 0 && `${countdown.d}d `}
          {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
        </Text>
      ) : (
        <Badge colorScheme="green" alignSelf="start" rounded="full" px={3}>
          Launched!
        </Badge>
      )}

      {next.pad?.location?.name && (
        <HStack color="text.secondary" fontSize="xs" spacing={2}>
          <Box as={FaMapMarkerAlt} boxSize="10px" flexShrink={0} />
          <Text noOfLines={1}>{next.pad.location.name}</Text>
        </HStack>
      )}
    </VStack>
  );
}

// Content-arrival reveal: APOD data lands a beat after the page; a short
// fade-and-rise acknowledges it without page-load choreography.
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

async function fetchApod(signal) {
  // Local calendar date (en-CA gives YYYY-MM-DD). APOD publishes on US
  // Eastern time, so using UTC here can roll the date forward a day early
  // and cache yesterday's image under today's key.
  const today = new Date().toLocaleDateString('en-CA');
  const cacheKey = `apod_${today}`;

  // A corrupt or wrong-day cache entry should fall through to a refetch,
  // not error out. NASA can still be serving yesterday's APOD early in the
  // morning, so an entry under today's key must also carry today's date.
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.date === today) return parsed;
      localStorage.removeItem(cacheKey);
    }
  } catch {
    localStorage.removeItem(cacheKey);
  }

  const apiKey = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
  if (apiKey === 'DEMO_KEY') {
    console.warn('Using DEMO_KEY - limited to 30 requests per hour');
  }

  const data = await fetchJson(
    `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`,
    { signal }
  );

  // Cache failures (quota, private browsing) must not fail the fetch.
  // Key the entry by the APOD's own date: if NASA returned yesterday's
  // picture, caching it under today's key would pin it for the whole day.
  const storeKey = `apod_${data.date ?? today}`;
  try {
    // Evict any stale APOD entries before writing the new one
    Object.keys(localStorage)
      .filter(k => k.startsWith('apod_') && k !== storeKey)
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem(storeKey, JSON.stringify(data));
  } catch {
    // Ignore: worst case we refetch on the next visit
  }
  return data;
}

// Copyright strings from the APOD API can contain newlines and an embedded
// "Text: <author>" attribution after the photographer; keep only the
// photographer part, whitespace-collapsed.
function cleanCopyright(raw) {
  if (!raw) return "";
  return raw.split(/\s*Text:/)[0].replace(/\s+/g, " ").trim();
}

export default function Home() {
  usePageMeta("/");
  const { data: apod, loading, error, refetch } = useApi(fetchApod);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Reveal only when motion is allowed; otherwise content is simply present.
  const revealAnim = prefersReducedMotion
    ? undefined
    : `${fadeUp} 0.45s cubic-bezier(0.16, 1, 0.3, 1) both`;

  const toggleDescription = () => setShowFullDescription((prev) => !prev);

  // apod.url points at a video embed (e.g. YouTube) when media_type is video,
  // so the modal must not treat it as an image source or download target.
  const isVideoApod = apod?.media_type === "video";

  // Track image readiness with a detached probe (Chakra's useImage) instead
  // of onLoad on the rendered img: the load event on a display:none element
  // proved unreliable on the first data commit, leaving the skeleton stuck.
  const imgStatus = useImage({ src: !isVideoApod ? apod?.url : undefined });
  const imgLoaded = imgStatus === "loaded";
  const imgError = imgStatus === "failed";

  const renderAPODContent = () => {
    if (loading) {
      return (
        <VStack spacing={4} py={10}>
          <Spinner size="xl" color="brand.primary" thickness="4px" />
          <Text color="text.secondary">Loading today's cosmic wonder...</Text>
        </VStack>
      );
    }
  
    if (error) {
      return (
        <ErrorState
          maxW="lg"
          mx="auto"
          title="Couldn't load today's picture"
          message={error}
          onRetry={() => refetch()}
        />
      );
    }
  
    if (!apod) return <Text>No content available</Text>;
  
    const isVideo = apod.media_type === "video";//NASA API occasionally labels video as image; check media_type first.
    const isImage = apod.media_type === "image" || /\.(gif|jpe?g|png)$/i.test(apod.url);//Falls through to the non-image branch when neither matches (e.g. interactive embeds).

    const description = apod.explanation || "";
    const shouldTruncate = description.length > 320;
    const displayDescription = showFullDescription || !shouldTruncate ? description : `${description.slice(0, 320)}...`;

    const photographer = cleanCopyright(apod.copyright);
    const credit = photographer ? `Photography by ${photographer}` : "Courtesy of NASA";
  
    return (
      <VStack spacing={8} align="stretch" animation={revealAnim}>
        {/* Section header: says what this feature is before the photo title */}
        <Box textAlign={{ base: "center", lg: "left" }}>
          <Text
            fontSize="10px"
            color="brand.400"
            fontWeight="bold"
            letterSpacing="0.25em"
            textTransform="uppercase"
            mb={2}
          >
            NASA · Astronomy Picture of the Day
          </Text>
          <Heading as="h2" size="lg" color="text.primary">
            Today's view of the cosmos
          </Heading>
        </Box>

        <Flex
          bg="bg.card"
          border="1px solid"
          borderColor="border.default"
          rounded="2xl"
          overflow="hidden"
          shadow="lg"
          direction={{ base: "column", lg: "row" }}
        >
          {/* Media side */}
          <Box
            position="relative"
            overflow="hidden"
            flex={{ lg: 1.25 }}
            minH={{ base: "300px", md: "420px", lg: "520px" }}
            bg="black"
          >
            {isVideo ? (
              apod.thumbnail_url ? (
                <Box position="absolute" inset={0} onClick={onOpen} cursor="pointer">
                  <Image
                    src={apod.thumbnail_url}
                    alt="Video thumbnail"
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    fallbackSrc="/hal9000.png"
                  />
                  <IconButton
                    icon={<ArrowForwardIcon />}
                    aria-label="Play video"
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    colorScheme="brand"
                    size="lg"
                    isRound
                    bg="whiteAlpha.800"
                  />
                </Box>
              ) : (
                <Box
                  as="iframe"
                  src={apod.url}
                  title={apod.title}
                  allowFullScreen
                  position="absolute"
                  top={0}
                  left={0}
                  w="100%"
                  h="100%"
                />
              )
            ) : isImage ? (
              <>
                {!imgLoaded && !imgError && (
                  <Skeleton position="absolute" inset={0} rounded="none" />
                )}
                {/* Ambient backdrop: blurred cover copy fills the letterbox
                    bars so any aspect ratio fits without cropping */}
                {imgLoaded && !imgError && (
                  <Image
                    src={apod.url}
                    alt=""
                    aria-hidden="true"
                    position="absolute"
                    inset={0}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    filter="blur(28px) brightness(0.4) saturate(1.1)"
                    transform="scale(1.15)"
                    pointerEvents="none"
                  />
                )}
                <Image
                  src={imgError ? "/hal9000.png" : apod.url}
                  alt={apod.title}
                  position="absolute"
                  inset={0}
                  w="100%"
                  h="100%"
                  objectFit="contain"
                  cursor="pointer"
                  display={imgLoaded || imgError ? "block" : "none"}
                  onClick={onOpen}
                  transition="transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease"
                  _hover={
                    prefersReducedMotion
                      ? { filter: "brightness(1.08)" }
                      : { transform: "scale(1.03)" }
                  }
                />
                <IconButton
                  position="absolute"
                  top={4}
                  right={4}
                  aria-label="View fullscreen"
                  icon={<ExternalLinkIcon />}
                  onClick={onOpen}
                  colorScheme="brand"
                  variant="solid"
                  opacity={0.85}
                  _hover={{ opacity: 1 }}
                  transition="opacity 0.3s ease"
                />
              </>
            ) : (
              <VStack position="absolute" inset={0} justify="center" spacing={4} p={6}>
                <Image
                  src="/hal9000.png"
                  alt="No media available"
                  maxH="200px"
                  objectFit="contain"
                />
                <Text color="text.secondary" fontStyle="italic">
                  No image or video available for this APOD.
                </Text>
                <Button
                  as="a"
                  href="https://apod.nasa.gov/apod/astropix.html"
                  target="_blank"
                  leftIcon={<ExternalLinkIcon />}
                  colorScheme="brand"
                  size="sm"
                >
                  View on NASA APOD
                </Button>
              </VStack>
            )}
          </Box>
  
          {/* Story side */}
          <VStack
            flex={1}
            align={{ base: "center", lg: "start" }}
            textAlign={{ base: "center", lg: "left" }}
            justify="center"
            p={{ base: 6, md: 10 }}
            spacing={4}
          >
            {apod.date && (
              <Badge bg="bg.elevated" color="text.primary" px={3} py={1} borderRadius="full" textTransform="none">
                <CalendarIcon mr={2} />
                {/* apod.date is a plain calendar date; format in UTC so it
                    isn't shifted back a day in timezones behind UTC. */}
                {new Date(apod.date).toLocaleDateString("en-US", { timeZone: "UTC" })}
              </Badge>
            )}

            <Heading as="h3" size="md" fontWeight="700" sx={{ textWrap: 'balance' }}>
              {apod.title}
            </Heading>

            <Text fontSize="md" color="text.primary" lineHeight="1.7" sx={{ textWrap: 'pretty' }}>
              {displayDescription}
            </Text>

            {shouldTruncate && (
              <Button variant="link" colorScheme="brand" size="sm" onClick={toggleDescription}>
                {showFullDescription ? "Show Less" : "Read More"}
              </Button>
            )}

            <Text fontSize="sm" color="text.secondary">
              {credit}
            </Text>
          </VStack>
        </Flex>
      </VStack>
    );
  };
  

  return (
    <Box py={16} px={6}>
      <Container maxW="7xl">
        {/* Mission-control hero: brand + copy left, live countdown right */}
        <Box
          position="relative"
          bg="bg.card"
          border="1px solid"
          borderColor="border.default"
          rounded="2xl"
          overflow="hidden"
          p={{ base: 8, md: 12 }}
        >
          {/* Emblem watermark: the logo, static (no rotation/reshaping),
              breathing slowly in place. Screen blend melts its black field
              into the card, same as the original watermark. Centered while
              the hero is stacked (below lg) so the card's overflow clip
              never crops it at mid-size windows. */}
          <Image
            src="/icons/icon-512.png"
            alt=""
            aria-hidden="true"
            position="absolute"
            right={{ base: "50%", lg: "340px" }}
            top="50%"
            transform={{ base: "translate(50%, -50%)", lg: "translateY(-50%)" }}
            boxSize={{ base: "360px", md: "460px" }}
            opacity={prefersReducedMotion ? 0.22 : undefined}
            mixBlendMode="screen"
            pointerEvents="none"
            draggable={false}
            sx={{
              animation: prefersReducedMotion ? undefined : `${breathe} 6s ease-in-out infinite`,
            }}
          />

          <Flex
            position="relative"
            direction={{ base: "column", lg: "row" }}
            align="center"
            justify="space-between"
            gap={{ base: 10, lg: 12 }}
          >
            <VStack
              align={{ base: "center", lg: "start" }}
              textAlign={{ base: "center", lg: "left" }}
              spacing={5}
              maxW={{ lg: "560px" }}
            >
              <Text
                fontSize="10px"
                color="brand.400"
                fontWeight="bold"
                letterSpacing="0.25em"
                textTransform="uppercase"
              >
                Ephemeris · Mission Control
              </Text>

              <Heading
                as="h1"
                fontSize="clamp(2rem, 4.5vw, 2.75rem)"
                fontWeight="700"
                letterSpacing="-0.02em"
                lineHeight="1.12"
                color="text.primary"
                sx={{ textWrap: 'balance' }}
              >
                The sky has a schedule.
              </Heading>

              <Text fontSize="lg" color="text.secondary" maxW="44ch">
                Live launch countdowns, a world launch map, and imagery from
                Earth orbit and beyond.
              </Text>

              {/* CTAs stack on phones: side by side they overflow the card */}
              <Stack
                direction={{ base: "column", sm: "row" }}
                spacing={4}
                pt={2}
                w={{ base: "full", sm: "auto" }}
              >
                <Button
                  as={RouterLink}
                  to="/launches"
                  size="lg"
                  colorScheme="brand"
                  _hover={
                    prefersReducedMotion
                      ? { boxShadow: '0 8px 25px rgba(56,178,172,0.35)' }
                      : { transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(56,178,172,0.35)' }
                  }
                  _active={prefersReducedMotion ? undefined : { transform: 'translateY(0)' }}
                  transition="transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease"
                >
                  View Launches
                </Button>
                <Button
                  as={RouterLink}
                  to="/map"
                  size="lg"
                  variant="outline"
                  colorScheme="brand"
                  _hover={
                    prefersReducedMotion
                      ? { bg: 'whiteAlpha.50' }
                      : { transform: 'translateY(-2px)', bg: 'whiteAlpha.50' }
                  }
                  transition="transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease"
                >
                  World Map
                </Button>
              </Stack>
            </VStack>

            <NextLaunchPanel />
          </Flex>
        </Box>

        {/* Quick links to the rest of the site */}
        <Box mt={6}>
          <QuickLinks />
        </Box>

        <Divider my={12} />

        <Box>{renderAPODContent()}</Box>
      </Container>

      {/* Fullscreen Image Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent bg="bg.card" color="text.primary" border="1px solid" borderColor="border.default">
          <ModalHeader>
            <HStack justify="space-between" align="center">
              <Text>{apod?.title}</Text>
              <HStack spacing={2}>
                <Button
                  leftIcon={<ExternalLinkIcon />}
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(apod?.url, '_blank')}
                  colorScheme="brand"
                >
                  Open Original
                </Button>
                {/* Download only for NASA-owned (public domain) images; APODs
                    with a copyright field belong to the photographer and we
                    shouldn't distribute them */}
                {!isVideoApod && !cleanCopyright(apod?.copyright) && (
                  <Button
                    leftIcon={<DownloadIcon />}
                    size="sm"
                    onClick={() => window.open(apod?.hdurl || apod?.url, '_blank')}
                    colorScheme="brand"
                  >
                    Download
                  </Button>
                )}
              </HStack>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {apod && (
              <VStack spacing={4}>
                {isVideoApod ? (
                  <AspectRatio ratio={16 / 9} w="100%">
                    <Box
                      as="iframe"
                      src={apod.url}
                      title={apod.title}
                      allowFullScreen
                      borderRadius="lg"
                    />
                  </AspectRatio>
                ) : (
                  <Image
                    src={apod.url}
                    alt={apod.title}
                    maxH="70vh"
                    objectFit="contain"
                    borderRadius="lg"
                    fallback={<Skeleton height="60vh" width="100%" borderRadius="lg" />}
                  />
                )}
                <VStack spacing={3} w="100%" textAlign="left">
                  <Box w="100%" p={4} bg="bg.elevated" border="1px solid" borderColor="border.default" borderRadius="lg">
                    <Heading as="h3" size="sm" mb={3} color="text.primary">
                      Image Information
                    </Heading>
                    <SimpleGrid columns={[1, 2]} spacing={4}>
                      <Box>
                        <Text fontSize="sm" color="text.secondary">Date</Text>
                        <Text fontWeight="bold">{apod.date}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="text.secondary">Type</Text>
                        <Text fontWeight="bold">{apod.media_type}</Text>
                      </Box>
                      {cleanCopyright(apod.copyright) !== "" && (
                        <Box>
                          <Text fontSize="sm" color="text.secondary">Photographer</Text>
                          <Text fontWeight="bold" color="text.primary">{cleanCopyright(apod.copyright)}</Text>
                        </Box>
                      )}
                    </SimpleGrid>
                  </Box>

                  <Box w="100%" p={4} bg="bg.elevated" border="1px solid" borderColor="border.default" borderRadius="lg">
                    <Heading as="h3" size="sm" mb={3} color="text.primary">
                      Description
                    </Heading>
                    <Text fontSize="md" color="text.primary" lineHeight="1.625" sx={{ textWrap: 'pretty' }}>
                      {apod.explanation}
                    </Text>
                  </Box>
                </VStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
