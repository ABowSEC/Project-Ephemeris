import { Container, Heading, Text, VStack } from "@chakra-ui/react";
import LaunchFeed from "../components/LaunchFeed";
import NextLaunchStrip from "../components/NextLaunchStrip";
import { useUpcomingLaunches } from "../hooks/useUpcomingLaunches";
import { usePageMeta } from "../hooks/usePageMeta";

export default function LaunchPage() {
  usePageMeta("/launches");
  const { nextLaunch, loading, fetchedAt, refresh } = useUpcomingLaunches();

  return (
    <Container maxW="7xl" py={{ base: 5, md: 10 }}>
      <VStack spacing={{ base: 4, md: 6 }} align="stretch">
        <VStack align="start" spacing={1.5}>
          <Heading as="h1" variant="section">
            Upcoming launches
          </Heading>
          <Text color="text.secondary" fontSize="md" display={{ base: "none", md: "block" }}>
            Every launch, every countdown, live.
          </Text>
        </VStack>

        {/* Compact so the feed starts near the top, even on phones */}
        <NextLaunchStrip launch={nextLaunch} loading={loading} fetchedAt={fetchedAt} onRefresh={refresh} />

        <LaunchFeed />
      </VStack>
    </Container>
  );
}
