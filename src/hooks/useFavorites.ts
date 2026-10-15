import { useCallback, useEffect, useState } from 'react';

// Tracked ("starred") launches, persisted in localStorage. Every component
// using this hook stays in sync: same-tab updates broadcast a custom event,
// and the native 'storage' event covers other tabs.

const KEY = 'ephemeris.favorites.v1';
const CHANGE_EVENT = 'ephemeris:favorites-changed';

function readFavorites(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(parsed?.launches) ? parsed.launches : [];
  } catch {
    return [];
  }
}

function writeFavorites(launches: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ launches }));
  } catch {
    // Best-effort persistence
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface FavoritesState {
  /** Launch IDs the user is tracking */
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

export function useFavorites(): FavoritesState {
  const [favorites, setFavorites] = useState(readFavorites);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const current = readFavorites();
    const next = current.includes(id)
      ? current.filter((f) => f !== id)
      : [...current, id];
    writeFavorites(next);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, isFavorite, toggleFavorite };
}

// Non-hook accessor for code that runs outside React rendering (alert checks)
export { readFavorites };
