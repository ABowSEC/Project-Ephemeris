import { useState, useCallback, useEffect } from 'react';

/**
 * Fullscreen state and toggle for the element in `elementRef`. State follows
 * the browser's fullscreenchange event only: a request can be refused (an
 * embedded frame, iPhone Safari), and setting it optimistically left callers
 * believing they were fullscreen when they weren't.
 */
export function useFullscreen(elementRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => {
    const el = elementRef.current;
    if (document.fullscreenElement || !el?.requestFullscreen) return;
    el.requestFullscreen().catch(() => {});
  }, [elementRef]);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) exitFullscreen();
    else enterFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === elementRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [elementRef]);

  return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen };
}
