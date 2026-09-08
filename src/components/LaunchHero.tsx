import type { ReactNode } from 'react';
import { Box, Flex, HStack, Heading, Text, VStack } from '@chakra-ui/react';

export interface LaunchHeroProps {
  image?: string | null;
  /** LaunchPage's list hero adds a bottom fade so the feed below it doesn't
   * hard-cut against the image; the single-launch hero doesn't need one. */
  bottomVignette?: boolean;
  /** Badge/label row above the heading (status badge, program badges, a
   * pulsing "Next Launch" indicator — genuinely different per page). */
  eyebrow: ReactNode;
  /** The mission name, or whatever a caller wants as the H1's content
   * (LaunchPage conditionally renders a loading state / linked title here). */
  heading: ReactNode;
  metaLine?: ReactNode;
  /** Right-side "Time to Launch" panel's content — a countdown, a spinner, or nothing. */
  countdown: ReactNode;
}

/**
 * The image-backed hero shared by /launches and /launches/:slug: background
 * mission image, dark gradient for legibility, and a two-column layout
 * (mission info left, countdown right). The two pages' actual content
 * (what badges show, what the heading says, whether there's a countdown to
 * show yet) differs enough to stay page-owned — this is just the shell that
 * used to be copied wholesale between them.
 */
export default function LaunchHero({
  image,
  bottomVignette = false,
  eyebrow,
  heading,
  metaLine,
  countdown,
}: LaunchHeroProps) {
  return (
    <Box position="relative" rounded="2xl" overflow="hidden" minH="300px">
      {image && (
        <Box
          position="absolute"
          inset={0}
          bgImage={`url(${image})`}
          bgSize="cover"
          bgPos="center"
          filter="brightness(0.45) saturate(0.9)"
          transform="scale(1.06)"
        />
      )}
      <Box
        position="absolute"
        inset={0}
        bgGradient="linear(to-r, rgba(6,9,26,0.95) 25%, rgba(6,9,26,0.6) 55%, rgba(6,9,26,0.2))"
      />
      {bottomVignette && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="80px"
          bgGradient="linear(to-t, rgba(6,9,26,0.9), transparent)"
        />
      )}

      <Flex
        position="relative"
        p={{ base: 6, md: 10 }}
        minH="300px"
        align="center"
        justify="space-between"
        gap={{ base: 8, md: 12 }}
        direction={{ base: 'column', lg: 'row' }}
      >
        <VStack align={{ base: 'center', lg: 'start' }} spacing={4} flex={1} maxW={{ lg: '560px' }}>
          <HStack spacing={2} flexWrap="wrap" justify={{ base: 'center', lg: 'flex-start' }}>
            {eyebrow}
          </HStack>

          <Heading
            as="h1"
            size={{ base: 'xl', md: '2xl' }}
            lineHeight="1.15"
            textAlign={{ base: 'center', lg: 'left' }}
          >
            {heading}
          </Heading>

          {metaLine}
        </VStack>

        <VStack spacing={3} flexShrink={0}>
          <Text
            fontSize="10px"
            color="text.secondary"
            letterSpacing="0.18em"
            textTransform="uppercase"
            fontWeight="semibold"
          >
            Time to Launch
          </Text>
          {countdown}
        </VStack>
      </Flex>
    </Box>
  );
}
