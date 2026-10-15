import { useState } from "react";
import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Skeleton,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useImage,
  usePrefersReducedMotion,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { ArrowForwardIcon, CalendarIcon, DownloadIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { fetchLatestApod } from "../../services/apod";
import { useApi } from "../../hooks/useApi";
import ErrorState from "../ErrorState";
import Card from "../Card";

/** The normalized entry services/apod.js produces. */
interface Apod {
  date?: string;
  title: string;
  explanation?: string;
  copyright?: string;
  alt?: string;
  media_type: "image" | "video";
  url?: string;
  hdurl?: string;
  thumbnail_url?: string;
  permalink?: string;
}

// Characters of the explanation shown before "Read more". Kept short: on
// Home the APOD is a secondary feature, below the launch content.
const DESCRIPTION_PREVIEW = 240;

// Content-arrival reveal: APOD data lands a beat after the page; a short
// fade-and-rise acknowledges it without page-load choreography.
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

async function fetchApod(signal: AbortSignal): Promise<Apod> {
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

  // services/apod.js is JS, so its media_type infers as a plain string
  const data = (await fetchLatestApod({ signal })) as Apod;

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
function cleanCopyright(raw: string | undefined): string {
  if (!raw) return "";
  return raw.split(/\s*Text:/)[0].replace(/\s+/g, " ").trim();
}

// media_type "video" covers two different things: a player embed (YouTube,
// Vimeo) and a bare video file hosted on apod.nasa.gov. The second kind must
// go in a <video> tag, not an iframe - our CSP frame-src only allows the
// embed hosts, so framing an .mp4 gets blocked outright.
function isVideoFile(url: string | undefined): boolean {
  return /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(url || "");
}

/** NASA's Astronomy Picture of the Day, with a fullscreen viewer. */
export default function ApodFeature() {
  const { data: apod, loading, error, refetch } = useApi(fetchApod);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Reveal only when motion is allowed; otherwise content is simply present.
  const revealAnim = prefersReducedMotion
    ? undefined
    : `${fadeUp} 0.45s cubic-bezier(0.16, 1, 0.3, 1) both`;

  // apod.url points at a video embed (e.g. YouTube) when media_type is video,
  // so the modal must not treat it as an image source or download target.
  const isVideoApod = apod?.media_type === "video";

  // Track image readiness with a detached probe (Chakra's useImage) instead
  // of onLoad on the rendered img: the load event on a display:none element
  // proved unreliable on the first data commit, leaving the skeleton stuck.
  const imgStatus = useImage({ src: !isVideoApod ? apod?.url : undefined });
  const imgLoaded = imgStatus === "loaded";
  const imgError = imgStatus === "failed";

  const renderContent = () => {
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
        <Box maxW="lg" mx="auto">
          <ErrorState
            title="Couldn't load today's picture"
            message={error}
            onRetry={() => refetch()}
          />
        </Box>
      );
    }

    if (!apod) return <Text>No content available</Text>;

    const isVideo = apod.media_type === "video";//NASA API occasionally labels video as image; check media_type first.
    const isImage = apod.media_type === "image" || /\.(gif|jpe?g|png)$/i.test(apod.url ?? "");//Falls through to the non-image branch when neither matches (e.g. interactive embeds).

    const description = apod.explanation || "";
    const shouldTruncate = description.length > DESCRIPTION_PREVIEW;
    const displayDescription = showFullDescription || !shouldTruncate
      ? description
      : `${description.slice(0, DESCRIPTION_PREVIEW)}...`;

    const photographer = cleanCopyright(apod.copyright);
    const credit = photographer ? `Photography by ${photographer}` : "Courtesy of NASA";

    return (
      <Card
        display="flex"
        flexDirection={{ base: "column", lg: "row" }}
        borderRadius="2xl"
        overflow="hidden"
        shadow="lg"
        animation={revealAnim}
      >
        {/* Media side */}
        <Box
          position="relative"
          overflow="hidden"
          flex={{ lg: 1.25 }}
          minH={{ base: "260px", md: "340px", lg: "380px" }}
          bg="black"
        >
          {isVideo ? (
            isVideoFile(apod.url) ? (
              <Box
                as="video"
                src={apod.url}
                controls
                loop
                muted
                autoPlay
                playsInline
                poster={apod.thumbnail_url}
                position="absolute"
                inset={0}
                w="100%"
                h="100%"
                objectFit="contain"
              />
            ) : apod.thumbnail_url ? (
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
                alt={apod.alt || apod.title}
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
                href={apod.permalink || "https://science.nasa.gov/apod/"}
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
          p={{ base: 6, md: 8 }}
          spacing={3}
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

          <Text fontSize="sm" color="text.primary" lineHeight="1.7" sx={{ textWrap: 'pretty' }}>
            {displayDescription}
          </Text>

          {shouldTruncate && (
            <Button
              variant="link"
              colorScheme="brand"
              size="sm"
              onClick={() => setShowFullDescription((prev) => !prev)}
            >
              {showFullDescription ? "Show Less" : "Read More"}
            </Button>
          )}

          <Text fontSize="xs" color="text.secondary">
            {credit}
          </Text>
        </VStack>
      </Card>
    );
  };

  return (
    <Box as="section" aria-labelledby="apod-heading">
      {/* Section header: says what this feature is before the photo title */}
      <Box mb={5}>
        <Text
          fontSize="10px"
          color="brand.400"
          fontWeight="bold"
          letterSpacing="0.25em"
          textTransform="uppercase"
          mb={1}
        >
          NASA · Astronomy Picture of the Day
        </Text>
        <Heading id="apod-heading" as="h2" size="md" color="text.primary">
          Today's view of the cosmos
        </Heading>
      </Box>

      {renderContent()}

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
                  onClick={() => window.open(apod?.permalink || apod?.url, '_blank')}
                  colorScheme="brand"
                >
                  Open Original
                </Button>
                {/* Download only for NASA-owned (public domain) images; APODs
                    with a copyright field belong to the photographer and we
                    shouldn't distribute them. The science.nasa.gov feed
                    fills copyright on every entry, so this stays hidden
                    unless NASA starts leaving it blank again. */}
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
                    {isVideoFile(apod.url) ? (
                      <Box
                        as="video"
                        src={apod.url}
                        controls
                        loop
                        playsInline
                        poster={apod.thumbnail_url}
                        borderRadius="lg"
                        sx={{ objectFit: "contain", bg: "black" }}
                      />
                    ) : (
                      <Box
                        as="iframe"
                        src={apod.url}
                        title={apod.title}
                        allowFullScreen
                        borderRadius="lg"
                      />
                    )}
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
