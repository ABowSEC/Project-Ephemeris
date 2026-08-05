import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { registerSW } from 'virtual:pwa-register'
import theme from './theme' // optional custom theme
import App from './App.jsx'

// Service worker: precaches the app shell and keeps launch data, map tiles,
// and images available offline. autoUpdate swaps in new versions silently.
registerSW({ immediate: true })

// Ephemeris is a dark interface by design — the palette, the map basemap, the
// star field and the mission-console styling all assume it. There is no light
// theme to fall back to, so the colour mode is pinned rather than offered.
//
// This replaces <ColorModeScript>, which could not work here: it emits an
// inline <script>, and the CSP in public/_headers is `script-src 'self'` with
// no 'unsafe-inline'. The browser blocked it in production, leaving Chakra to
// read localStorage['chakra-ui-color-mode'] on its own — so any visitor whose
// browser had 'light' stored got Chakra's light component defaults (pale Alert
// boxes, white menus) on top of the dark palette.
//
// get() ignores the stored value entirely and set() is a no-op, so nothing a
// user or another tab writes to that key can change the rendering.
const forceDarkMode = {
  type: 'localStorage',
  ssr: false,
  get: () => 'dark',
  set: () => {},
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider theme={theme} colorModeManager={forceDarkMode}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)