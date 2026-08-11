import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Heading,
  VStack,
  Text,
  Container,
  HStack,
  Icon,
  Badge,
  Flex,
  Link,
  Spinner,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaRocket, FaMapMarkerAlt, FaSatellite } from "react-icons/fa";
import LaunchFeed from "../components/LaunchFeed";
import AlertSettings from "../components/AlertSettings";
import CountdownDisplay from "../components/launch/CountdownDisplay";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { usePageMeta } from "../hooks/usePageMeta";
import { statusStyle } from "../data/launchStatus";
import { formatNet, launchPath, providerName, rocketName } from "../utils/launchFields";

const pulseAnim = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`;

export default function LaunchPage() {
  usePageMeta("/launches");
  const { launches, loading } = useUpcomingLaunches();
  const nextLaunch = launches[0] ?? null;
  const status = statusStyle(nextLaunch?.status);

  return (
    <Container maxW="8xl" py={8}>
      <VStack spacing={8} align="stretch">

        {/* Hero // Next Launch */}
        <Box position="relative" rounded="2xl" overflow="hidden" minH="300px">

          {/* Blurred mission image background */}
          {nextLaunch?.image && (
            <Box
              position="absolute"
              inset={0}
              bgImage={`url(${nextLaunch.image})`}
              bgSize="cover"
              bgPos="center"
              filter="brightness(0.45) saturate(0.9)"
              transform="scale(1.06)"
            />
          )}

          {/* Dark gradient overlay // heavier on the left so text is legible */}
          <Box
            position="absolute"
            inset={0}
            bgGradient="linear(to-r, rgba(6,9,26,0.95) 25%, rgba(6,9,26,0.6) 55%, rgba(6,9,26,0.2))"
          />

          {/* Bottom vignette */}
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            h="80px"
            bgGradient="linear(to-t, rgba(6,9,26,0.9), transparent)"
          />

          {/* Hero content */}
          <Flex
            position="relative"
            p={{ base: 6, md: 10 }}
            minH="300px"
            align="center"
            justify="space-between"
            gap={{ base: 8, md: 12 }}
            direction={{ base: "column", lg: "row" }}
          >

            {/* Left // launch info */}
            <VStack
              align={{ base: "center", lg: "start" }}
              spacing={4}
              flex={1}
              maxW={{ lg: "540px" }}
            >
              {/* Label row */}
              <HStack spacing={2}>
                <Icon
                  as={FaRocket}
                  color="accent.terminal"
                  boxSize="10px"
                  animation={`${pulseAnim} 2s ease-in-out infinite`}
                />
                <Text
                  fontSize="10px"
                  color="accent.terminal"
                  fontWeight="bold"
                  letterSpacing="0.2em"
                  textTransform="uppercase"
                >
                  Next Launch
                </Text>
                {nextLaunch?.status && (
                  <>
                    <Text color="whiteAlpha.300" fontSize="xs">·</Text>
                    <Badge
                      colorScheme={status.colorScheme}
                      variant="subtle"
                      fontSize="10px"
                      px={2}
                      py={0.5}
                      rounded="full"
                    >
                      {status.label}
                    </Badge>
                  </>
                )}
              </HStack>

              {/* Mission name */}
              <Heading
                as="h1"
                size={{ base: "xl", md: "2xl" }}
                color="text.primary"
                lineHeight="1.15"
                textAlign={{ base: "center", lg: "left" }}
              >
                {loading ? (
                  "Loading…"
                ) : nextLaunch ? (
                  <Link
                    as={RouterLink}
                    to={launchPath(nextLaunch)}
                    _hover={{ color: "brand.300", textDecoration: "none" }}
                  >
                    {nextLaunch.name}
                  </Link>
                ) : (
                  "No upcoming launches"
                )}
              </Heading>

              {/* Details */}
              <VStack align={{ base: "center", lg: "start" }} spacing={1.5}>
                {providerName(nextLaunch) && (
                  <HStack color="text.secondary" fontSize="sm" spacing={2}>
                    <Icon as={FaSatellite} boxSize={3} flexShrink={0} />
                    <Text>{providerName(nextLaunch)}</Text>
                    {rocketName(nextLaunch) && (
                      <>
                        <Text color="whiteAlpha.300">·</Text>
                        <Text color="text.primary" fontWeight="medium">
                          {rocketName(nextLaunch)}
                        </Text>
                      </>
                    )}
                  </HStack>
                )}

                {nextLaunch?.pad?.location?.name && (
                  <HStack color="text.secondary" fontSize="sm" spacing={2}>
                    <Icon as={FaMapMarkerAlt} boxSize={3} flexShrink={0} />
                    <Text>{nextLaunch.pad.location.name}</Text>
                  </HStack>
                )}

                {nextLaunch && (
                  <Text
                    fontSize="xs"
                    color="text.secondary"
                    fontFamily="mono"
                    letterSpacing="wide"
                    mt={1}
                  >
                    {formatNet(nextLaunch)}
                  </Text>
                )}
              </VStack>
            </VStack>

            {/* Right // countdown */}
            <VStack spacing={3} align="center" flexShrink={0}>
              <Text
                fontSize="10px"
                color="text.secondary"
                letterSpacing="0.18em"
                textTransform="uppercase"
                fontWeight="semibold"
              >
                Time to Launch
              </Text>

              {loading ? (
                <Spinner color="accent.terminal" size="xl" thickness="3px" />
              ) : nextLaunch ? (
                <CountdownDisplay launch={nextLaunch} />
              ) : null}
            </VStack>

          </Flex>
        </Box>

        {/* Upcoming Launches feed */}
        <Box>
          <VStack spacing={6} align="stretch">
            <Flex
              direction={{ base: "column", md: "row" }}
              align={{ base: "center", md: "flex-end" }}
              justify="space-between"
              gap={4}
            >
              <Box>
                <Heading
                  as="h2"
                  size="lg"
                  color="text.primary"
                  mb={2}
                  textAlign={{ base: "center", md: "left" }}
                >
                  Upcoming Launches
                </Heading>
                <Text
                  color="text.secondary"
                  fontSize="md"
                  textAlign={{ base: "center", md: "left" }}
                >
                  Every launch. Every countdown. Live.
                </Text>
              </Box>
              <AlertSettings />
            </Flex>

            <LaunchFeed />
          </VStack>
        </Box>

        {/* Footer note */}
        <Box
          bg="bg.card"
          p={4}
          borderRadius="md"
          border="1px solid"
          borderColor="border.default"
          textAlign="center"
        >
          <Text fontSize="sm" color="text.secondary">
            Launch times are subject to change due to weather, technical issues, or range conflicts ·
            All times in your local timezone · Updated automatically
          </Text>
        </Box>
      </VStack>
    </Container>
  );
}
