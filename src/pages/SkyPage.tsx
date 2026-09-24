import { Box, Container, Text } from '@chakra-ui/react';
import { usePageMeta } from '../hooks/usePageMeta';
import SkySection from '../components/sky/SkySection';

/**
 * The sky section on its own page, with the explorer already open. The
 * homepage carries the same section with the explorer collapsed.
 */
export default function SkyPage() {
  usePageMeta('/sky');

  return (
    <Container maxW="8xl" py={8}>
      <Box mb={6}>
        <Text
          fontFamily="mono"
          fontSize="xs"
          letterSpacing="0.2em"
          color="accent.terminal"
          textTransform="uppercase"
        >
          Sky
        </Text>
      </Box>
      <SkySection defaultOpen />
    </Container>
  );
}
