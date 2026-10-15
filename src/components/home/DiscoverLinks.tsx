import { Link as RouterLink } from "react-router-dom";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowForwardIcon } from "@chakra-ui/icons";

// The rest of the site, below the launch content. Flight-console index:
// numbered hairline rows sharing one accent, not an icon-card grid
const LINKS = [
  {
    to: "/iss",
    title: "ISS Live",
    blurb: "Real-time station tracking and onboard video",
  },
  {
    to: "/mars",
    title: "Mars Rovers",
    blurb: "Imagery from the red planet's rovers",
  },
  {
    to: "/explore",
    title: "Explore",
    blurb: "Search NASA's image library and space history",
  },
];

export default function DiscoverLinks() {
  return (
    <Box as="section" aria-labelledby="discover-heading">
      <Heading id="discover-heading" as="h2" size="md" color="text.primary" mb={4}>
        More to explore
      </Heading>
      <Box borderTop="1px solid" borderColor="border.default">
        {LINKS.map(({ to, title, blurb }, i) => (
          <Flex
            key={to}
            as={RouterLink}
            to={to}
            data-group
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
    </Box>
  );
}
