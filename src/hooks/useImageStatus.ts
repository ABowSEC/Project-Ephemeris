import { useEffect, useState } from 'react';

export type ImageStatus = 'loading' | 'ready' | 'failed';

export interface ImageInfo {
  status: ImageStatus;
  /** Natural size once loaded, else 0. */
  width: number;
  height: number;
}

const EMPTY = { width: 0, height: 0 };

/** Preloads an image and reports whether it loaded and how big it is. */
export function useImageInfo(src: string | null | undefined): ImageInfo {
  const [info, setInfo] = useState<{ src: string | null | undefined; value: ImageInfo }>({
    src,
    value: { status: src ? 'loading' : 'failed', ...EMPTY },
  });

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () =>
      !cancelled && setInfo({ src, value: { status: 'ready', width: img.naturalWidth, height: img.naturalHeight } });
    img.onerror = () => !cancelled && setInfo({ src, value: { status: 'failed', ...EMPTY } });
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  // A new src starts over without waiting a render for the effect
  if (info.src !== src) return { status: src ? 'loading' : 'failed', ...EMPTY };
  return info.value;
}

/** Whether a background image loaded. CSS background-image fails silently. */
export function useImageStatus(src: string | null | undefined): ImageStatus {
  return useImageInfo(src).status;
}
