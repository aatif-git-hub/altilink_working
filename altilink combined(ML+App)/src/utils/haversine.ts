/**
 * Haversine Formula for calculating geographic distance (in meters)
 * between two GPS coordinates (latitude, longitude).
 *
 * Used for Group Separation Detection in AltiLink.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6371000; // Mean radius of the Earth in meters

export function calculateHaversineDistance(point1: LatLng, point2: LatLng): number {
  const lat1Rad = toRadians(point1.latitude);
  const lat2Rad = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceMeters = EARTH_RADIUS_METERS * c;
  return Math.round(distanceMeters * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Checks whether a member exceeds the maximum separation threshold.
 */
export function checkSeparationStatus(
  distanceMeters: number,
  thresholdMeters: number
): { isExceeded: boolean; ratio: number; statusText: 'Safe' | 'Warning' } {
  const isExceeded = distanceMeters > thresholdMeters;
  const ratio = Math.min(1.5, distanceMeters / thresholdMeters);
  return {
    isExceeded,
    ratio,
    statusText: isExceeded ? 'Warning' : 'Safe',
  };
}
