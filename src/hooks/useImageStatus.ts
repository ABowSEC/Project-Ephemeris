import { useEffect, useState } from 'react';

export type ImageStatus = 'loading' | 'ready' | 'failed';

/** Whether a background image loaded. CSS background-image fails silently. */
export function useImageStatus(src: string | null | undefined): ImageStatus {
  const [status, setStatus] = useState<{ src: string | null | undefined; value: ImageStatus }>({
    src,
    value: src ? 'loading' : 'failed',
  });

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => !cancelled && setStatus({ src, value: 'ready' });
    img.onerror = () => !cancelled && setStatus({ src, value: 'failed' });
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  // A new src starts over without waiting a render for the effect
  if (status.src !== src) return src ? 'loading' : 'failed';
  return status.value;
}
