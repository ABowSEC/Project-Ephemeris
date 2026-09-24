import { lazy, Suspense } from 'react';
import { Box, Collapse, Flex, Skeleton, Text, VStack, useDisclosure } from '@chakra-ui/react';
import { useSkyModel } from '../../hooks/useSkyModel';
import SkyAnswer from './SkyAnswer';

// The explorer carries the dome, the globe and the timeline. Most visitors want
// the answer and never open it, so it loads only when asked for.
const SkyExplorer = lazy(() => import('./SkyExplorer'));

/**
 * "Can I see a launch from here?": the plain answer first, with the full sky
 * instrument one click below it.
 */
export default function SkySection({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const model = useSkyModel();
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: defaultOpen });

  return (
    <VStack align="stretch" spacing={8}>
      <SkyAnswer model={model} />

      <Box bg="bg.card" border="1px solid" borderColor="border.default" rounded="2xl">
        <Flex
          as="button"
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="sky-explorer"
          w="100%"
          align="baseline"
          gap={{ base: 2, md: 4 }}
          wrap="wrap"
          textAlign="left"
          px={{ base: 4, md: 6 }}
          py={4}
          rounded="2xl"
          _hover={{ bg: 'whiteAlpha.50' }}
          _focusVisible={{ outline: '2px solid', outlineColor: 'brand.300' }}
        >
          <Text
            fontFamily="heading"
            fontSize="xs"
            fontWeight="600"
            letterSpacing="0.14em"
            textTransform="uppercase"
            color="brand.300"
          >
            Explore the sky
          </Text>
          <Text fontSize="sm" color="text.secondary" flex="1" minW="200px">
            Scrub through time, see the whole dome and the Earth
          </Text>
          <Text
            fontFamily="mono"
            fontSize="xs"
            color="text.secondary"
            border="1px solid"
            borderColor="border.default"
            rounded="md"
            px={2}
            py={0.5}
          >
            {isOpen ? 'Hide' : 'Show'}
          </Text>
        </Flex>

        <Collapse in={isOpen} unmountOnExit animateOpacity>
          <Box id="sky-explorer" px={{ base: 4, md: 6 }} pb={6} pt={2}>
            <Suspense fallback={<Skeleton h="420px" rounded="xl" />}>
              <SkyExplorer
                observer={model.observer}
                pads={model.pads}
                skyLaunches={model.skyLaunches}
                selected={model.selected}
                onSelect={model.select}
              />
            </Suspense>
          </Box>
        </Collapse>
      </Box>
    </VStack>
  );
}
