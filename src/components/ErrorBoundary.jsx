import { Component } from 'react';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import Card from './Card';

// A stale tab requesting an old hashed chunk after a redeploy lands here
// too (the lazy import rejects); a reload fetches the new build, so the
// fallback leads with one.
const isStaleChunkError = (error) =>
  /dynamically imported module|Loading chunk|module script failed/i.test(
    error?.message || ''
  );

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isStaleChunkError(error);

    return (
      <Box py={20} px={6}>
        <Card as={VStack} spacing={5} maxW="md" mx="auto" textAlign="center" borderRadius="2xl" p={10}>
          <Heading as="h2" size="md" color="text.primary">
            {stale ? 'Update available' : 'Something went wrong'}
          </Heading>
          <Text color="text.secondary">
            {stale
              ? 'Ephemeris was updated since this page loaded. Reload to get the latest version.'
              : 'An unexpected error kept this page from rendering.'}
          </Text>
          <Button colorScheme="brand" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Card>
      </Box>
    );
  }
}

export default ErrorBoundary;
