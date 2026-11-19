import { Box, Button, Container, Flex, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { useImageStatus } from "../hooks/useImageStatus";
import { launchImageUrl } from "../utils/launchFields";
import { withAlpha } from "../utils/color";
import NextLaunchPanel from "../components/home/NextLaunchPanel";
import ComingUpStrip from "../components/home/ComingUpStrip";
import ApodFeature from "../components/home/ApodFeature";
import DiscoverLinks from "../components/home/DiscoverLinks";

/**
 * Full-bleed photo of the next launch, fading into the starfield at the
 * bottom. With no photo (or one that fails), the starfield is the backdrop.
 */
function HeroPhoto() {
  const { nextLaunch } = useUpcomingLaunches();
  const image = launchImageUrl(nextLaunch);
  const status = useImageStatus(image);
  if (!image || status === "failed") return null;

  return (
    <Box
      aria-hidden="true"
      position="absolute"
      inset={0}
      bottom={{ base: "auto", lg: 0 }}
      h={{ base: "380px", lg: "auto" }}
      opacity={status === "ready" ? 1 : 0}
      transition="opacity 0.6s"
      sx={{ maskImage: "linear-gradient(to bottom, #000 60%, transparent 100%)" }}
    >
      <Box
        position="absolute"
        inset={0}
        bgImage={`url(${image})`}
        bgSize="cover"
        bgPos="center"
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
  );
}

/** Home: brand hero over the next launch's photo, then what's coming up. */
export default function Home() {
  usePageMeta("/");

  return (
    <Box>
      <Box as="section" aria-label="Introduction" position="relative" overflow="hidden">
        <HeroPhoto />
        <Container maxW="7xl" position="relative">
          <Flex
            minH={{ lg: "680px" }}
            pt={{ base: "220px", lg: 24 }}
            pb={{ base: 8, lg: 16 }}
            direction={{ base: "column", lg: "row" }}
            align={{ base: "stretch", lg: "flex-end" }}
            justify="space-between"
            gap={{ base: 6, lg: 12 }}
          >
            <VStack align="start" spacing={{ base: 4, md: 6 }} maxW={{ lg: "540px" }}>
              <Text textStyle="label" fontSize="11px" color="text.secondary" letterSpacing="0.1em">
                Ephemeris · Launch tracker
              </Text>

              {/* The tagline is the one long-form use of the brand face */}
              <Heading
                as="h1"
                fontFamily="display"
                fontSize={{ base: "34px", md: "48px", lg: "60px" }}
                fontWeight="700"
                letterSpacing="-0.01em"
                lineHeight="1.06"
                color="text.primary"
                sx={{ textWrap: "balance" }}
              >
                The sky has a schedule.
              </Heading>

              <Text fontSize={{ base: "md", md: "lg" }} color="text.primary" opacity={0.85} maxW="44ch" lineHeight="1.6">
                Every upcoming rocket launch worldwide, with live countdowns,
                webcasts, and alerts for the ones you track.
              </Text>

              <Stack
                direction={{ base: "column", sm: "row" }}
                spacing={3}
                pt={2}
                w={{ base: "full", sm: "auto" }}
              >
                <Button
                  as={RouterLink}
                  to="/launches"
                  size="lg"
                  variant="solid"
                  w={{ base: "full", sm: "auto" }}
                  rightIcon={<Box as={ArrowRight} boxSize={4} />}
                >
                  View launches
                </Button>
                <Button as={RouterLink} to="/map" size="lg" w={{ base: "full", sm: "auto" }}>
                  Launch map
                </Button>
              </Stack>
            </VStack>

            <NextLaunchPanel />
          </Flex>
        </Container>
      </Box>

      <Container maxW="7xl" pb={{ base: 12, md: 16 }}>
        <VStack align="stretch" spacing={{ base: 12, md: 16 }} pt={{ base: 6, md: 10 }}>
          <ComingUpStrip />
          <ApodFeature />
          <DiscoverLinks />
        </VStack>
      </Container>
    </Box>
  );
}
