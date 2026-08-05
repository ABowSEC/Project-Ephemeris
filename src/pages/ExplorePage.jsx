import {
  Box,
  Heading,
  Text,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Container,
  SimpleGrid,
  Image,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Flex,
  Button,
  IconButton,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";
import Timeline from "../components/Timeline";
import { usePageMeta } from "../hooks/usePageMeta";

const PAGE_SIZE = 24;

function SearchResults({ activeQuery }) {
  const [photos, setPhotos] = useState([]);
  const [totalHits, setTotalHits] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (!activeQuery) return;
    setPage(1);
    fetchResults(activeQuery, 1);
  }, [activeQuery]);

  const fetchResults = async (q, p) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(q);
      const url = `https://images-api.nasa.gov/search?q=${encoded}&media_type=image&page_size=${PAGE_SIZE}&page=${p}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setPhotos(data.collection.items || []);
      setTotalHits(data.collection.metadata?.total_hits || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (p) => {
    setPage(p);
    fetchResults(activeQuery, p);
  };

  const thumbnailFor = (photo) => photo?.links?.[0]?.href ?? "";
  const metaFor = (photo) => photo?.data?.[0] ?? {};
  const totalPages = Math.ceil(totalHits / PAGE_SIZE);

  if (!activeQuery) return null;

  if (loading) {
    return (
      <Flex justify="center" py={16}>
        <Spinner size="xl" color="teal.400" thickness="4px" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <AlertTitle>Search failed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (photos.length === 0) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <AlertTitle>No results found</AlertTitle>
        <AlertDescription>Try a different search term.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Box>
      <Text fontSize="sm" color="text.secondary" mb={4}>
        {totalHits.toLocaleString()} results for "{activeQuery}"
      </Text>

      <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing={3} mb={6}>
        {photos.map((photo) => {
          const meta = metaFor(photo);
          return (
            <Box
              key={meta.nasa_id}
              cursor="pointer"
              borderRadius="md"
              overflow="hidden"
              bg="bg.card"
              _hover={{ opacity: 0.85, transform: "scale(1.02)" }}
              transition="all 0.15s"
              onClick={() => { setSelected(photo); onOpen(); }}
            >
              <Image
                src={thumbnailFor(photo)}
                alt={meta.title}
                w="100%"
                h="120px"
                objectFit="cover"
                loading="lazy"
              />
            </Box>
          );
        })}
      </SimpleGrid>

      <Flex justify="center" align="center" gap={4}>
        <Button
          size="sm"
          onClick={() => goToPage(page - 1)}
          isDisabled={page <= 1}
          colorScheme="teal"
          variant="outline"
        >
          Prev
        </Button>
        <Text color="text.secondary" fontSize="sm">
          Page {page} of {totalPages.toLocaleString()}
        </Text>
        <Button
          size="sm"
          onClick={() => goToPage(page + 1)}
          isDisabled={page >= totalPages}
          colorScheme="teal"
          variant="outline"
        >
          Next
        </Button>
      </Flex>

      <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader pr={10} fontSize="md">
            {metaFor(selected)?.title}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Image
              src={thumbnailFor(selected)}
              alt={metaFor(selected)?.title}
              w="100%"
              borderRadius="md"
              mb={4}
            />
            {metaFor(selected)?.date_created && (
              <Badge colorScheme="teal" mb={2}>
                {new Date(metaFor(selected).date_created).toLocaleDateString()}
              </Badge>
            )}
            {metaFor(selected)?.description && (
              <Text color="text.secondary" fontSize="sm" mt={2}>
                {metaFor(selected).description}
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default function ExplorePage() {
  usePageMeta("/explore");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <Container maxW="7xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="2xl" bgGradient="linear(to-r, green.400, teal.500)" bgClip="text">
            Explore the Cosmos
          </Heading>
          <Text fontSize="lg" color="text.secondary" mt={2}>
            Search NASA's image library: missions, planets, astronauts, and more.
          </Text>
        </Box>

        <Box maxW="600px" mx="auto" w="100%">
          <InputGroup size="lg">
            <Input
              placeholder="Search NASA content (e.g., Mars, Apollo, ISS)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              borderRadius="md"
              boxShadow="md"
            />
            <InputRightElement>
              <IconButton
                aria-label="Search"
                icon={<SearchIcon />}
                size="sm"
                colorScheme="teal"
                variant="ghost"
                onClick={handleSearch}
              />
            </InputRightElement>
          </InputGroup>
        </Box>

        <SearchResults activeQuery={activeQuery} />

        {!activeQuery && (
          <Container maxW="6xl" py={4} px={0}>
            <Heading size="xl" mb={4} color="brand.primary">
              Explore Missions & Discoveries
            </Heading>
            <Text fontSize="lg" mb={8} color="text.primary">
              Dive into NASA's legacy. From early Apollo missions to modern Mars exploration.
            </Text>
            <Timeline />
          </Container>
        )}
      </VStack>
    </Container>
  );
}
