import { Box, type BoxProps } from '@chakra-ui/react';

/**
 * Standard card surface (bg.card, border, rounded). Any prop can be
 * overridden, including `as` (e.g. as={Flex}).
 */
export default function Card({ borderRadius = 'xl', ...props }: BoxProps) {
  return (
    <Box bg="bg.card" border="1px solid" borderColor="border.default" borderRadius={borderRadius} {...props} />
  );
}
