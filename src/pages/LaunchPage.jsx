import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Heading,
  VStack,
  Text,
  Container,
  HStack,
  Icon,
  Flex,
  Link,
  Button,
  Spinner,
} from "@chakra-ui/react";
import { FaRocket, FaMapMarkerAlt } from "react-icons/fa";
import LaunchFeed from "../components/LaunchFeed";
import AlertSettings from "../components/AlertSettings";
import CountdownDisplay from "../components/launch/CountdownDisplay";
import StaleDataNotice from "../components/StaleDataNotice";
import StatusBadge from "../components/StatusBadge";
import LaunchMetaLine from "../components/LaunchMetaLine";
import LaunchHero from "../components/LaunchHero";
import Card from "../components/Card";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatNet, launchPath, providerName, rocketName } from "../utils/launchFields";
import { pulseOpacity } from "../utils/animations";

export default function LaunchPage() {
  usePageMeta("/launches");
  const { launches, loading, stale, fetchedAt } = useUpcomingLaunches();
  const nextLaunch = launches[0] ?? null;

  return (
    <Container maxW="8xl" py={8}>
      <VStack spacing={8} align="stretch">

        {/* Hero // Next Launch */}
        <LaunchHero
          image={nextLaunch?.image}
          bottomVignette
          eyebrow={
            <>
              <Icon
                as={FaRocket}
                color="accent.terminal"
                boxSize="10px"
                animation={`${pulseOpacity} 2s ease-in-out infinite`}
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
                  <StatusBadge status={nextLaunch.status} size="xs" />
                </>
              )}
            </>
          }
          heading={
            loading ? (
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
            )
          }
          metaLine={
            nextLaunch && (
              <LaunchMetaLine
                provider={providerName(nextLaunch)}
                rocket={rocketName(nextLaunch)}
                pad={nextLaunch.pad?.location?.name}
                net={formatNet(nextLaunch)}
              />
            )
          }
          countdown={
            <>
              {loading ? (
                <Spinner color="accent.terminal" size="xl" thickness="3px" />
              ) : nextLaunch ? (
                <CountdownDisplay launch={nextLaunch} />
              ) : null}
              <StaleDataNotice stale={stale} fetchedAt={fetchedAt} />
            </>
          }
        />

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
              {/* The map is no longer a top-level nav tab; this is how it is
                  reached, next to the feed it visualizes. */}
              <HStack spacing={3}>
                <Button
                  as={RouterLink}
                  to="/map"
                  size="sm"
                  variant="outline"
                  colorScheme="teal"
                  leftIcon={<Icon as={FaMapMarkerAlt} boxSize={3} />}
                >
                  World launch map
                </Button>
                <AlertSettings />
              </HStack>
            </Flex>

            <LaunchFeed />
          </VStack>
        </Box>

        {/* Footer note */}
        <Card p={4} borderRadius="md" textAlign="center">
          <Text fontSize="sm" color="text.secondary">
            Launch times are subject to change due to weather, technical issues, or range conflicts ·
            All times in your local timezone · Updated automatically
          </Text>
        </Card>
      </VStack>
    </Container>
  );
}
