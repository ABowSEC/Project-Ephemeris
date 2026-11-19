import { Box, Button, Container, Flex, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useHeroPhoto } from "../hooks/useHeroPhoto";
import HomeHeroPhoto from "../components/home/HomeHeroPhoto";
import HeroPhotoSwitcher from "../components/home/HeroPhotoSwitcher";
import NextLaunchPanel from "../components/home/NextLaunchPanel";
import ComingUpStrip from "../components/home/ComingUpStrip";
import ApodFeature from "../components/home/ApodFeature";
import DiscoverLinks from "../components/home/DiscoverLinks";

/** Home: brand hero over the next launch's photo, then what's coming up. */
export default function Home() {
  usePageMeta("/");
  const heroPhoto = useHeroPhoto();

  return (
    <Box>
      <Box as="section" aria-label="Introduction" position="relative" overflow="hidden">
        <HomeHeroPhoto current={heroPhoto.current} />
        <Container maxW="7xl" position="relative">
          <Flex
            minH={{ lg: "600px" }}
            pt={{ base: "200px", lg: 16 }}
            pb={{ base: 8, lg: 16 }}
            direction={{ base: "column", lg: "row" }}
            align={{ base: "stretch", lg: "center" }}
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

            <VStack spacing={2} w={{ base: "100%", md: "380px" }} flexShrink={0} align="stretch">
              <NextLaunchPanel />
              <HeroPhotoSwitcher {...heroPhoto} />
            </VStack>
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
