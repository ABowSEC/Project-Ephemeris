import { Box, type BoxProps } from '@chakra-ui/react';

/**
 * Standard card surface: the theme's `card` layer style (bg.card, hairline
 * border, 4px corners, no shadow). Any prop can be overridden, including
 * `as` (e.g. as={Flex}).
 */
export default function Card(props: BoxProps) {
  return <Box layerStyle="card" {...props} />;
}
