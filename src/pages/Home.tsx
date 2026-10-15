import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Image,
  Stack,
  Text,
  VStack,
  usePrefersReducedMotion,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { Link as RouterLink } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import Card from "../components/Card";
import NextLaunchPanel from "../components/home/NextLaunchPanel";
import ComingUpStrip from "../components/home/ComingUpStrip";
import ApodFeature from "../components/home/ApodFeature";
import DiscoverLinks from "../components/home/DiscoverLinks";

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

/**
 * Home, ordered by what a visitor came for: the next launch (hero), what's
 * lined up after it, then today's APOD, then the rest of the site.
 */
export default function Home() {
  usePageMeta("/");
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <Box py={{ base: 10, md: 16 }} px={{ base: 4, md: 6 }}>
      <Container maxW="7xl">
        <VStack align="stretch" spacing={{ base: 12, md: 16 }}>
          {/* Mission-control hero: brand + copy left, live countdown right */}
          {/* Transparent so the starfield runs behind the hero; the hairline
              border still frames it */}
          <Card position="relative" bg="transparent" borderRadius="2xl" overflow="hidden" p={{ base: 8, md: 12 }}>
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
                // With the hero transparent, screen blending no longer hides
                // the icon's dark square tile against the starfield; a radial
                // mask feathers it away and leaves only the emblem
                maskImage: "radial-gradient(closest-side, #000 82%, transparent 100%)",
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
                  fontFamily="display"
                  fontSize="10px"
                  color="brand.400"
                  fontWeight="bold"
                  letterSpacing="0.25em"
                  textTransform="uppercase"
                >
                  Ephemeris · Mission Control
                </Text>

                {/* The tagline is the one long-form use of the display face: it
                    is the brand line, short enough to carry Orbitron */}
                <Heading
                  as="h1"
                  fontFamily="display"
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
                  Every upcoming rocket launch worldwide, with live countdowns,
                  webcasts, and alerts for the ones you track.
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
                    Launch Map
                  </Button>
                </Stack>
              </VStack>

              <NextLaunchPanel />
            </Flex>
          </Card>

          <ComingUpStrip />

          <ApodFeature />

          <DiscoverLinks />
        </VStack>
      </Container>
    </Box>
  );
}
