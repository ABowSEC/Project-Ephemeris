// Places worth watching from, offered in the sky view's location picker.
//
// Coordinates are the town or beach, not the pad: the point is the view
// *toward* a pad, so these sit outside it at the distance people really watch
// from.

export interface ViewingSpot {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

export const VIEWING_SPOTS: ViewingSpot[] = [
  { id: 'titusville', label: 'Titusville, FL (Space Coast)', lat: 28.6, lon: -80.8 },
  { id: 'jacksonville', label: 'Jacksonville Beach, FL', lat: 30.3, lon: -81.4 },
  { id: 'orlando', label: 'Orlando, FL', lat: 28.5, lon: -81.4 },
  { id: 'atlanta', label: 'Atlanta, GA', lat: 33.7, lon: -84.4 },
  { id: 'lompoc', label: 'Lompoc, CA (Vandenberg)', lat: 34.6, lon: -120.5 },
  { id: 'los-angeles', label: 'Los Angeles, CA', lat: 34.1, lon: -118.2 },
  { id: 'brownsville', label: 'South Padre Island, TX (Starbase)', lat: 26.1, lon: -97.2 },
  { id: 'chincoteague', label: 'Chincoteague, VA (Wallops)', lat: 37.9, lon: -75.4 },
  { id: 'kourou', label: 'Kourou, French Guiana', lat: 5.2, lon: -52.7 },
  { id: 'mahia', label: 'Mahia Peninsula, New Zealand', lat: -39.1, lon: 177.9 },
  { id: 'london', label: 'London, UK', lat: 51.5, lon: -0.1 },
  { id: 'tokyo', label: 'Tokyo, Japan', lat: 35.7, lon: 139.7 },
];
