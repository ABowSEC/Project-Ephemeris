import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, HStack, Image, Link, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { FaGithub, FaRegStar } from "react-icons/fa";
import { SiKofi } from "react-icons/si";
import { DISCOVER_NAV, PRIMARY_NAV } from "../data/navigation";

const CREDITS = [
  { label: "The Space Devs", href: "https://thespacedevs.com" },
  { label: "NASA", href: "https://science.nasa.gov/apod/" },
  { label: "OpenFreeMap / OSM", href: "https://openfreemap.org" },
];

// Every section, as plain crawlable links: the top nav hides Discover's
// items behind a menu, so this is also their always-visible route in.
const SITE_LINKS = [...PRIMARY_NAV, ...DISCOVER_NAV];

const columnHeading = {
  fontSize: "10px",
  fontWeight: "bold",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "text.secondary",
  mb: 3,
} as const;

export default function Footer() {
  return (
    <Box
      as="footer"
      mt={16}
      borderTop="1px solid"
      borderColor="border.default"
      bg="rgba(6, 9, 26, 0.80)"
    >
      <Container maxW="7xl" py={10}>
        <SimpleGrid
          columns={{ base: 1, md: 3 }}
          spacing={{ base: 10, md: 8 }}
          textAlign={{ base: "center", md: "left" }}
        >
          {/* Brand + one-line pitch, doubling as the site's About blurb.
              screen blend melts the logo's near-black field into the footer,
              leaving the teal→purple mark glowing. */}
          <VStack align={{ base: "center", md: "start" }} spacing={3} maxW={{ md: "340px" }}>
            <Image
              src="/icons/ephemeris-logo.png"
              alt="Project Ephemeris"
              w="auto"
              maxW="220px"
              h="auto"
              mixBlendMode="screen"
              draggable={false}
            />
            <Text fontSize="sm" color="text.secondary" lineHeight="1.6">
              Live countdowns for every upcoming rocket launch, plus ISS
              tracking and NASA imagery. An independent, open-source project,
              not affiliated with or endorsed by NASA, SpaceX, or any space
              agency.
            </Text>
          </VStack>

          <Box as="nav" aria-label="Site sections">
            <Text {...columnHeading}>Sections</Text>
            <VStack align={{ base: "center", md: "start" }} spacing={2}>
              {SITE_LINKS.map(({ path, label }) => (
                <Link
                  key={path}
                  as={RouterLink}
                  to={path}
                  fontSize="sm"
                  color="text.secondary"
                  _hover={{ color: "text.primary", textDecoration: "none" }}
                >
                  {label}
                </Link>
              ))}
            </VStack>
          </Box>

          <VStack align={{ base: "center", md: "start" }} spacing={4}>
            <Box>
              <Text {...columnHeading}>Never miss a launch</Text>
              <Text fontSize="sm" color="text.secondary" mb={3}>
                Star any mission to track it, then turn on alerts for a heads-up
                at T-60, T-10, and liftoff.
              </Text>
              <Button
                as={RouterLink}
                to="/launches"
                size="sm"
                colorScheme="orange"
                variant="outline"
                leftIcon={<FaRegStar />}
              >
                Track a launch
              </Button>
            </Box>

            <HStack spacing={5} pt={2}>
              <Link
                href="https://github.com/ABowSEC/Project-Ephemeris"
                isExternal
                fontSize="sm"
                color="text.secondary"
                _hover={{ color: "text.primary" }}
                display="inline-flex"
                alignItems="center"
                gap={1.5}
              >
                <FaGithub /> Source
              </Link>
              <Link
                href="https://ko-fi.com/abowsec"
                isExternal
                fontSize="sm"
                color="text.secondary"
                _hover={{ color: "text.primary" }}
                display="inline-flex"
                alignItems="center"
                gap={1.5}
              >
                <SiKofi /> Support
              </Link>
            </HStack>

            <Text fontSize="xs" color="text.secondary" opacity={0.65}>
              Data &amp; imagery:{" "}
              {CREDITS.map(({ label, href }, i) => (
                <Text as="span" key={href}>
                  <Link href={href} isExternal _hover={{ color: "text.primary" }}>
                    {label}
                  </Link>
                  {i < CREDITS.length - 1 ? " · " : ""}
                </Text>
              ))}
            </Text>
          </VStack>
        </SimpleGrid>
      </Container>
    </Box>
  );
}
