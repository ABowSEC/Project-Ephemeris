import { useState } from 'react';
import { Box, Image, Text } from '@chakra-ui/react';

// Bundled logos, keyed by provider name as the feed spells it. (The feed has
// no logo URLs.) Anything not listed gets a monogram.
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
 * Provider initials: a short parenthesized abbreviation if there is one
 * ("CNES"), else initials of the main words ("MHI"), max four letters.
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

/** Provider logo on a white tile, or a monogram tile if we don't have one. */
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
