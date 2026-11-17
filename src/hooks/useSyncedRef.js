import { useRef, useEffect } from 'react';

/** A ref that always holds the latest `value`, for use in callbacks and effects. */
export function useSyncedRef(value) {
  const ref = useRef(value);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref;
} 