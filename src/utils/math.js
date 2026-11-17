// Math utility functions for the solar system project

export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

/** Linear interpolation from a to b by t (0-1). */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
} 