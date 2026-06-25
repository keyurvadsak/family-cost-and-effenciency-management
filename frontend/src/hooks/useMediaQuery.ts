import { useState, useEffect } from 'react';

/**
 * CSS-first responsive hook.
 * Returns true if the viewport matches the given media query.
 * Replaces JS-based `window.innerWidth < 768` checks.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** Convenience: true when viewport is <= 640px */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)');
}

/** Convenience: true when viewport is <= 1024px */
export function useIsTablet(): boolean {
  return useMediaQuery('(max-width: 1024px)');
}
