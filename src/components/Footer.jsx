import { Box, Container, Flex, HStack, Image, Link, Text, VStack } from "@chakra-ui/react";
import { FaGithub } from "react-icons/fa";
import { SiKofi } from "react-icons/si";

const CREDITS = [
  { label: "The Space Devs", href: "https://thespacedevs.com" },
  { label: "NASA", href: "https://apod.nasa.gov/apod/astropix.html" },
  { label: "OpenFreeMap / OSM", href: "https://openfreemap.org" },
];

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
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "center", md: "start" }}
          justify="space-between"
          gap={8}
        >
          {/* Brand + one-line pitch, doubling as the site's About blurb.
              screen blend melts the logo's near-black field into the footer,
              leaving the teal→purple mark glowing. */}
          <VStack
            align={{ base: "center", md: "start" }}
            textAlign={{ base: "center", md: "left" }}
            spacing={3}
            maxW={{ md: "380px" }}
          >
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
              Live launch countdowns, a world map, ISS tracking, and NASA
              imagery in one place. An independent, open-source project, not
              affiliated with or endorsed by NASA, SpaceX, or any space
              agency.
            </Text>
          </VStack>

          <VStack
            align={{ base: "center", md: "end" }}
            textAlign={{ base: "center", md: "right" }}
            spacing={3}
          >
            <HStack spacing={5}>
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

            <Text fontSize="xs" color="text.secondary" opacity={0.65} maxW={{ md: "300px" }}>
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
        </Flex>
      </Container>
    </Box>
  );
}
