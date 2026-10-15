import {
  Box,
  VStack,
  Text,
  Heading,
  Badge,
  Link,
  HStack,
  Button,
  Wrap,
  WrapItem,
  useBreakpointValue,
} from "@chakra-ui/react";
import { ExternalLinkIcon, CalendarIcon } from "@chakra-ui/icons";
import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { timelineData, TYPE_CONFIG } from "../data/timelineData";

const MotionBox = motion(Box);

// A single event: colored node sitting on the central spine, with its card
// pushed to the left or right on desktop. On mobile the spine lives at the far
// left and every card stacks to its right.
function TimelineItem({ item, index, alignLeft, isDesktop, reduceMotion }) {
  const cfg = TYPE_CONFIG[item.type] ?? { color: "gray", label: item.type };

  // Slide the card in from its own side on desktop; a gentle rise on mobile.
  const from = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, x: isDesktop ? (alignLeft ? -48 : 48) : 0, y: isDesktop ? 0 : 24 };

  return (
    <Box position="relative" py={{ base: 3, md: 5 }}>
      {/* Node on the spine */}
      <Box
        position="absolute"
        left={{ base: "20px", md: "50%" }}
        top={{ base: "28px", md: "50%" }}
        transform="translate(-50%, -50%)"
        zIndex={2}
      >
        {/* Pulsing ring (rich motion only) */}
        {!reduceMotion && (
          <MotionBox
            position="absolute"
            inset="-4px"
            borderRadius="full"
            bg={`${cfg.color}.400`}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: index * 0.15 }}
          />
        )}
        <Box
          w="14px"
          h="14px"
          borderRadius="full"
          bg={`${cfg.color}.400`}
          border="2px solid"
          borderColor="bg.card"
          boxShadow={`0 0 12px var(--chakra-colors-${cfg.color}-400)`}
        />
      </Box>

      {/* Card */}
      <Box
        pl={{ base: "48px", md: 0 }}
        display="flex"
        justifyContent={{ base: "flex-start", md: alignLeft ? "flex-start" : "flex-end" }}
      >
        <MotionBox
          initial={from}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          whileHover={reduceMotion ? undefined : { y: -3 }}
          w={{ base: "100%", md: "calc(50% - 40px)" }}
          p={5}
          borderWidth="1px"
          borderRadius="lg"
          bg="bg.card"
          borderColor="border.default"
          shadow="md"
          _hover={{ borderColor: `${cfg.color}.400`, shadow: "lg" }}
        >
          <HStack justify="space-between" mb={3} wrap="wrap" gap={2}>
            <HStack spacing={2}>
              <Badge colorScheme={cfg.color} variant="subtle">
                {cfg.label}
              </Badge>
              <Badge
                colorScheme={item.status === "success" ? "green" : "blue"}
                variant="outline"
              >
                {item.status}
              </Badge>
            </HStack>
            <HStack spacing={1} color="text.secondary">
              <CalendarIcon boxSize={3} />
              <Text fontSize="sm" fontWeight="semibold">
                {item.year}
              </Text>
            </HStack>
          </HStack>

          <Heading size="sm" mb={2} color="text.primary">
            {item.title}
          </Heading>

          <Text fontSize="sm" color="text.secondary" lineHeight="1.7" mb={3}>
            {item.description}
          </Text>

          <Link href={item.link} isExternal color="teal.400" fontSize="sm" fontWeight="medium">
            Learn More <ExternalLinkIcon mx="2px" />
          </Link>
        </MotionBox>
      </Box>
    </Box>
  );
}

export default function Timeline() {
  const [activeFilter, setActiveFilter] = useState("all");
  const reduceMotion = useReducedMotion();
  const isDesktop = useBreakpointValue({ base: false, md: true }) ?? false;

  const spineRef = useRef(null);
  // Draw the spine as the section scrolls through the viewport centre.
  const { scrollYProgress } = useScroll({
    target: spineRef,
    offset: ["start center", "end center"],
  });
  const drawn = useSpring(scrollYProgress, { stiffness: 60, damping: 20, restDelta: 0.001 });

  const filtered =
    activeFilter === "all"
      ? timelineData
      : timelineData.filter((item) => item.type === activeFilter);

  return (
    <VStack spacing={6} align="stretch">
      {/* Filter buttons */}
      <Wrap spacing={2}>
        <WrapItem>
          <Button
            size="sm"
            variant={activeFilter === "all" ? "solid" : "outline"}
            colorScheme="gray"
            onClick={() => setActiveFilter("all")}
          >
            All
          </Button>
        </WrapItem>
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <WrapItem key={type}>
            <Button
              size="sm"
              variant={activeFilter === type ? "solid" : "outline"}
              colorScheme={cfg.color}
              onClick={() => setActiveFilter(type)}
            >
              {cfg.label}
            </Button>
          </WrapItem>
        ))}
      </Wrap>

      <Text fontSize="sm" color="text.secondary">
        {filtered.length} mission{filtered.length !== 1 ? "s" : ""}
      </Text>

      {/* Spine + events */}
      <Box ref={spineRef} position="relative">
        {/* Dim background track */}
        <Box
          position="absolute"
          top={0}
          bottom={0}
          left={{ base: "20px", md: "50%" }}
          transform="translateX(-50%)"
          w="2px"
          bg="border.default"
          borderRadius="full"
        />
        {/* Animated glowing fill */}
        <MotionBox
          position="absolute"
          top={0}
          left={{ base: "20px", md: "50%" }}
          transform="translateX(-50%)"
          w="2px"
          h="100%"
          borderRadius="full"
          bg="brand.400"
          style={{ scaleY: reduceMotion ? 1 : drawn, transformOrigin: "top" }}
        />

        <VStack spacing={0} align="stretch">
          {filtered.map((item, index) => (
            <TimelineItem
              key={`${item.year}-${item.title}`}
              item={item}
              index={index}
              alignLeft={isDesktop && index % 2 === 0}
              isDesktop={isDesktop}
              reduceMotion={reduceMotion}
            />
          ))}
        </VStack>
      </Box>
    </VStack>
  );
}
