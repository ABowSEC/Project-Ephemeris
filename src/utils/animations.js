import { keyframes } from '@emotion/react';

/** Opacity breathe for a small "live" indicator dot (e.g. next to a rocket icon). */
export const pulseOpacity = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`;
