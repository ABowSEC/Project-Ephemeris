import { Fragment, type ReactNode } from 'react';
import { Box, Flex, HStack, Heading, Text, VStack } from '@chakra-ui/react';
import { withAlpha } from '../utils/color';
import { providerInitials } from '../utils/launchFields';
import { useImageStatus } from '../hooks/useImageStatus';

export interface LaunchHeroProps {
  image?: string | null;
  /** Launch provider, for the monogram the hero shows when there's no photo. */
  provider?: string | null;
  /** LaunchPage's list hero adds a bottom fade so the feed below it doesn't
   * hard-cut against the image; the single-launch hero doesn't need one. */
  bottomVignette?: boolean;
  /** Badge/label row above the heading (status badge, program badges, a
   * pulsing "Next Launch" indicator, genuinely different per page). */
  eyebrow: ReactNode;
  /** The mission name, or whatever a caller wants as the H1's content
   * (LaunchPage conditionally renders a loading state / linked title here). */
  heading: ReactNode;
  metaLine?: ReactNode;
  /** Right-side "Time to Launch" panel's content: a countdown, a spinner, or nothing. */
  countdown: ReactNode;
}

/**
 * Image-backed hero shared by /launches and /launches/:slug. Pages supply the
 * content. With no photo, a monochrome fallback keeps the same layout.
 */
export default function LaunchHero({
  image,
  provider,
  bottomVignette = false,
  eyebrow,
  heading,
  metaLine,
  countdown,
}: LaunchHeroProps) {
  const imageStatus = useImageStatus(image);

  return (
    <Box position="relative" rounded="sm" overflow="hidden" minH="300px">
      {imageStatus === 'failed' ? (
        <NoPhotoFallback provider={provider} />
      ) : (
        <Box
          position="absolute"
          inset={0}
          bgImage={`url(${image})`}
          bgSize="cover"
          bgPos="center"
          filter={{ base: 'brightness(0.6) saturate(0.9)', lg: 'brightness(0.85) saturate(0.95)' }}
          transform="scale(1.06)"
          opacity={imageStatus === 'ready' ? 1 : 0}
          transition="opacity 0.4s"
        />
      )}
      {/* Scrim behind the text only. Stacked (centered) text on small screens
          sits over the whole image, so it gets an even wash instead. */}
      <Box
        position="absolute"
        inset={0}
        bgImage={{
          base: `linear-gradient(to bottom, ${withAlpha('bg.body', 55)}, ${withAlpha('bg.body', 80)})`,
          lg: `linear-gradient(to right, ${withAlpha('bg.body', 92)} 0%, ${withAlpha('bg.body', 75)} 35%, ${withAlpha('bg.body', 10)} 70%, transparent)`,
        }}
      />
      {bottomVignette && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="80px"
          bgImage={`linear-gradient(to top, ${withAlpha('bg.body', 90)}, transparent)`}
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
            sx={{ textWrap: 'balance' }}
          >
            {typeof heading === 'string' ? <LaunchName name={heading} /> : heading}
          </Heading>

          {metaLine}
        </VStack>

        {/* Backed panel: the photo behind it is no longer darkened */}
        <VStack
          spacing={3}
          flexShrink={0}
          bg={withAlpha('bg.body', 80)}
          border="1px solid"
          borderColor="border.default"
          rounded="sm"
          px={{ base: 4, md: 6 }}
          py={{ base: 4, md: 5 }}
        >
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

/** Stand-in for a missing photo: a faint grid and the provider's monogram. */
function NoPhotoFallback({ provider }: { provider?: string | null }) {
  const line = withAlpha('text.primary', 4);
  return (
    <Box position="absolute" inset={0} bg="bg.body" aria-hidden="true">
      <Box
        position="absolute"
        inset={0}
        bgImage={`linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`}
        bgSize="48px 48px"
      />
      {provider && (
        <Text
          position="absolute"
          right={{ base: 4, md: 10 }}
          bottom={{ base: 2, md: 4 }}
          fontFamily="headline"
          fontWeight="700"
          fontSize={{ base: '96px', md: '160px' }}
          lineHeight="1"
          letterSpacing="0.02em"
          color="text.primary"
          opacity={0.06}
          userSelect="none"
        >
          {providerInitials(provider)}
        </Text>
      )}
    </Box>
  );
}

/**
 * Launch name that wraps at " | " instead of mid-word ("Falcon 9 Block 5 |
 * USSF-481"). With `clamped`, only the rocket half is held together so a line
 * clamp can still truncate.
 */
export function LaunchName({ name, clamped = false }: { name: string; clamped?: boolean }) {
  const parts = name.split(' | ');
  if (parts.length < 2) return <NoHyphenBreaks text={name} />;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <Box as="span" display={clamped && i === parts.length - 1 ? 'inline' : 'inline-block'}>
            <NoHyphenBreaks text={part} />
            {i < parts.length - 1 && ' |'}
          </Box>
        </Fragment>
      ))}
    </>
  );
}

/**
 * Keeps hyphenated words like "USSF-481" whole. (A non-breaking hyphen would
 * be simpler, but Plex has no glyph for it.)
 */
function NoHyphenBreaks({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\S*\w-\w\S*)/).map((piece, i) =>
        i % 2 ? (
          <Box as="span" key={i} whiteSpace="nowrap">
            {piece}
          </Box>
        ) : (
          piece
        )
      )}
    </>
  );
}
