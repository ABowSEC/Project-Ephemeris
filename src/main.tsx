import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import type { ComponentProps } from 'react'
import { registerSW } from 'virtual:pwa-register'
import theme from './theme' // optional custom theme
import App from './App'

// Service worker: offline app shell and data, auto-updating. Also checks
// for updates when the page becomes visible, since long-lived tabs rarely
// navigate.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {})
    })
  },
})

// The site is dark-only, so the color mode is pinned and any stored
// preference is ignored. (ColorModeScript can't be used: the CSP blocks its
// inline script.)
const forceDarkMode: NonNullable<ComponentProps<typeof ChakraProvider>['colorModeManager']> = {
  type: 'localStorage',
  ssr: false,
  get: () => 'dark',
  set: () => {},
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme} colorModeManager={forceDarkMode}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)