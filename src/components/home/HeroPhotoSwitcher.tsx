import { HStack, IconButton, Text } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroChoice } from "../../hooks/useHeroPhoto";

/**
 * Caption and previous/next buttons for the Home hero photo. Sits in the
 * page flow (under the next-launch panel), so the sticky nav can never
 * cover it.
 */
export default function HeroPhotoSwitcher({
  current,
  index,
  count,
  step,
}: {
  current: HeroChoice | null;
  index: number;
  count: number;
  step: (delta: number) => void;
}) {
  if (!current) return null;

  const buttonProps = {
    variant: "ghost",
    size: "sm",
    minW: "40px",
    h: "40px",
    color: "text.secondary",
    _hover: { color: "text.primary", bg: "whiteAlpha.100" },
  } as const;

  return (
    <HStack role="group" aria-label="Hero photo" spacing={1} justify="space-between" w="100%" pl={1}>
      <Text fontSize="xs" color="text.secondary" noOfLines={1} minW={0} aria-live="polite">
        Photo: {current.caption}
      </Text>
      {count > 1 && (
        <HStack spacing={0} flexShrink={0}>
          <Text fontSize="xs" color="text.secondary" pr={1} sx={{ fontVariantNumeric: "tabular-nums" }}>
            {index + 1}/{count}
          </Text>
          <IconButton aria-label="Previous photo" icon={<ChevronLeft size={16} />} onClick={() => step(-1)} {...buttonProps} />
          <IconButton aria-label="Next photo" icon={<ChevronRight size={16} />} onClick={() => step(1)} {...buttonProps} />
        </HStack>
      )}
    </HStack>
  );
}
