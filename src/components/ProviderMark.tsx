import { useState } from 'react';
import { Box, Image, Text } from '@chakra-ui/react';

// Bundled logos, keyed by the provider name exactly as the upcoming feed
// spells it. The feed carries no logo_url (only detailed lookups do, and the
// free tier can't afford one per provider), so anything not listed here gets
// a monogram instead.
const LOGOS: Record<string, string> = {
  'National Aeronautics and Space Administration': '/logos/nasa.jpg',
  NASA: '/logos/nasa.jpg',
  SpaceX: '/logos/spacex.jpeg',
  'United Launch Alliance': '/logos/ula.jpg',
  'European Space Agency': '/logos/esa.jpg',
  'Japan Aerospace Exploration Agency': '/logos/jaxa.jpg',
  'Russian Federal Space Agency (ROSCOSMOS)': '/logos/Roscosmos.jpg',
  'China Aerospace Science and Technology Corporation': '/logos/casc.jpg',
  'Blue Origin': '/logos/blueorigin.jpg',
};

const MINOR_WORDS = new Set(['of', 'and', 'the', 'for', 'de', 'du']);

/**
 * Short initials for a provider: a parenthesized abbreviation when the name
 * carries one ("... (ROSCOSMOS)" is too long, "... (CNES)" is not), else the
 * initials of its significant words ("Mitsubishi Heavy Industries" -> MHI),
 * capped at four. A one-word name gets its first letter.
 */
function providerInitials(name: string): string {
  const paren = name.match(/\(([A-Za-z]{2,5})\)/);
  if (paren) return paren[1].toUpperCase();
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s-]+/)
    .filter((w) => w && !MINOR_WORDS.has(w.toLowerCase()));
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * The provider's logo on a white tile when we have one, otherwise a quiet
 * one-color monogram tile the same size. Replaces the old cartoon-rocket
 * placeholder, which read as clip art next to real launch photography.
 */
export default function ProviderMark({ name, size = 52 }: { name: string | null; size?: number }) {
  const logo = name ? LOGOS[name] : undefined;
  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    return (
      <Box bg="whiteAlpha.900" borderRadius="lg" p={1.5} boxShadow="0 2px 8px rgba(0,0,0,0.4)" flexShrink={0}>
        <Image src={logo} alt="" boxSize={`${size - 12}px`} objectFit="contain" onError={() => setFailed(true)} />
      </Box>
    );
  }

  const initials = name ? providerInitials(name) : '?';
  return (
    <Box
      boxSize={`${size}px`}
      flexShrink={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderRadius="lg"
      bg="bg.elevated"
      border="1px solid"
      borderColor="border.control"
      boxShadow="0 2px 8px rgba(0,0,0,0.4)"
      aria-hidden="true"
    >
      <Text
        fontSize={initials.length > 2 ? 'sm' : 'md'}
        fontWeight="600"
        letterSpacing="0.06em"
        color="text.primary"
        lineHeight="1"
      >
        {initials}
      </Text>
    </Box>
  );
}
