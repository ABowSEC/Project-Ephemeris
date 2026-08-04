import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link as RouterLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Box,
  Flex,
  HStack,
  VStack,
  Image,
  IconButton,
  Link,
  Spacer,
  Container,
  Text,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
} from '@chakra-ui/react';
import { HamburgerIcon } from '@chakra-ui/icons';
import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';

// Route pages are code-split so heavy dependencies (Three.js on /solarsim,
// Leaflet on /iss) stay out of the initial bundle and load on demand.
const Home = lazy(() => import('./pages/Home'));
const LaunchPage = lazy(() => import('./pages/LaunchPage'));
const LaunchDetailPage = lazy(() => import('./pages/LaunchDetailPage'));
const LaunchMapPage = lazy(() => import('./pages/LaunchMapPage'));
const MarsPage = lazy(() => import('./pages/MarsPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const SolarSimPage = lazy(() => import('./pages/SolarSimPage'));
const ISSLivePage = lazy(() => import('./pages/issLive'));
import ErrorBoundary from './components/ErrorBoundary';
import MissionTerminal from './components/MissionTerminal';
import StarField from './components/StarField';
import WarpTransition from './components/WarpTransition';
import NavLaunchCountdown from './components/NavLaunchCountdown';
import Footer from './components/Footer';
import { useKonamiCode } from './hooks/useKonamiCode';
import { useLaunchAlerts } from './hooks/useLaunchAlerts';

// Named alias: ESLint's no-unused-vars can't see `motion` used as <motion.div>
const MotionDiv = motion.div;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  enter:   { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -8 },
};

const pageTransition = {
  enter: { duration: 0.22, ease: 'easeOut' },
  exit:  { duration: 0.15, ease: 'easeIn'  },
};

const navigationItems = [
  { path: '/',         label: 'Home' },
  { path: '/launches', label: 'Launches' },
  { path: '/map',      label: 'Map' },
  { path: '/mars',     label: 'Mars' },
  { path: '/explore',  label: 'Explore' },
  { path: '/iss',      label: 'ISS' },
];

// Exact match everywhere except for sections with child routes: a launch
// detail page at /launches/<slug> should still light up the Launches tab.
// '/' is exact-only or it would match every route.
const isActiveNav = (pathname, path) =>
  pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));

// /solarsim is intentionally unlisted // reachable via the Konami code
// (see KonamiWarp below) or a direct link, as a hidden easter egg.

function Navigation() {
  const location = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={100}
      borderBottom="1px solid"
      borderColor="border.default"
      backdropFilter="blur(16px)"
      bg="rgba(6, 9, 26, 0.80)"
    >
      <Container maxW="7xl">
        <Flex as="nav" align="center" h="56px" gap={1}>
          <Link
            as={RouterLink}
            to="/"
            display="flex"
            alignItems="center"
            gap={2}
            fontWeight="700"
            fontSize="sm"
            letterSpacing="widest"
            textTransform="uppercase"
            color="brand.400"
            _hover={{ textDecoration: 'none', color: 'brand.300' }}
            mr={{ base: 3, md: 6 }}
            flexShrink={0}
          >
            {/* Brand emblem (ephemeris-logo artwork, from the app icon set) */}
            <Image
              src="/icons/icon-192.png"
              alt=""
              boxSize="32px"
              borderRadius="full"
              draggable={false}
            />
            {/* Wordmark hides on the narrowest screens; emblem carries the brand */}
            <Text as="span" display={{ base: 'none', sm: 'inline' }}>
              Ephemeris
            </Text>
          </Link>

          {/* Inline links: desktop only; small screens use the drawer */}
          <HStack spacing={1} display={{ base: 'none', md: 'flex' }}>
            {navigationItems.map(({ path, label }) => {
              const isActive = isActiveNav(location.pathname, path);
              return (
                <Link
                  key={path}
                  as={RouterLink}
                  to={path}
                  px={3}
                  py={1}
                  borderRadius="md"
                  fontSize="sm"
                  fontWeight={isActive ? '600' : '400'}
                  color={isActive ? 'brand.300' : 'text.secondary'}
                  _hover={{
                    textDecoration: 'none',
                    color: isActive ? 'brand.200' : 'white',
                    bg: 'whiteAlpha.50',
                  }}
                  transition="all 0.15s"
                >
                  {label}
                </Link>
              );
            })}
          </HStack>

          <Spacer />
          <NavLaunchCountdown />
          <MissionTerminal />

          <IconButton
            aria-label="Open navigation menu"
            icon={<HamburgerIcon />}
            display={{ base: 'inline-flex', md: 'none' }}
            variant="ghost"
            size="sm"
            color="text.secondary"
            _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
            onClick={onOpen}
          />
        </Flex>
      </Container>

      {/* Mobile navigation drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg="bg.card" borderLeft="1px solid" borderColor="border.default">
          <DrawerCloseButton color="text.secondary" />
          <DrawerHeader
            display="flex"
            alignItems="center"
            gap={2}
            fontSize="sm"
            letterSpacing="widest"
            textTransform="uppercase"
            color="brand.400"
          >
            <Image
              src="/icons/icon-192.png"
              alt=""
              boxSize="28px"
              borderRadius="full"
              draggable={false}
            />
            Ephemeris
          </DrawerHeader>
          <DrawerBody>
            <VStack align="stretch" spacing={1}>
              {navigationItems.map(({ path, label }) => {
                const isActive = isActiveNav(location.pathname, path);
                return (
                  <Link
                    key={path}
                    as={RouterLink}
                    to={path}
                    onClick={onClose}
                    px={4}
                    py={3}
                    borderRadius="lg"
                    fontSize="md"
                    fontWeight={isActive ? '600' : '400'}
                    color={isActive ? 'white' : 'text.secondary'}
                    bg={isActive ? 'whiteAlpha.100' : 'transparent'}
                    _hover={{
                      textDecoration: 'none',
                      color: 'white',
                      bg: 'whiteAlpha.50',
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

// Hidden easter egg: enter the Konami code anywhere on the site to warp
// straight to the solar system view.
function KonamiWarp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [warping, setWarping] = useState(false);

  useKonamiCode(() => {
    if (location.pathname !== '/solarsim') setWarping(true);
  });

  if (!warping) return null;

  return (
    <WarpTransition
      onFinished={() => {
        setWarping(false);
        navigate('/solarsim');
      }}
    />
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <MotionDiv
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={pageTransition.enter}
      >
        {/* Keyed by the MotionDiv above, so navigating away from a crashed
            page remounts the boundary and clears its error state */}
        <ErrorBoundary>
        <Suspense fallback={<Text color="text.secondary" p={10}>Loading...</Text>}>
          <Routes location={location}>
            <Route path="/"          element={<Home />} />
            <Route path="/explore"   element={<ExplorePage />} />
            <Route path="/launches"  element={<LaunchPage />} />
            <Route path="/launches/:slug" element={<LaunchDetailPage />} />
            <Route path="/map"       element={<LaunchMapPage />} />
            <Route path="/mars"      element={<MarsPage />} />
            <Route path="/iss"       element={<ISSLivePage />} />
            <Route path="/solarsim"  element={<SolarSimPage />} />
            <Route
              path="*"
              element={
                <Box textAlign="center" py={20}>
                  <Text fontSize="2xl" mb={4} color="text.primary">Page Not Found</Text>
                  <Link as={RouterLink} to="/" color="brand.primary">
                    Return to Home
                  </Link>
                </Box>
              }
            />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </MotionDiv>
    </AnimatePresence>
  );
}

function App() {
  // Fires notifications/toasts for tracked launches while the app is open
  useLaunchAlerts();

  return (
    <MotionConfig reducedMotion="user">
      {/* Last-resort boundary: catches errors outside the routed pages
          (Navigation, StarField, alerts) that the per-route one can't */}
      <ErrorBoundary>
      <Router>
        <Box minH="100vh" bg="bg.body">
          <StarField />
          <KonamiWarp />
          <Box position="relative" zIndex={1}>
            <Navigation />
            <Box as="main">
              <AnimatedRoutes />
            </Box>
            <Footer />
          </Box>
        </Box>
      </Router>
      </ErrorBoundary>
    </MotionConfig>
  );
}

export default App;
