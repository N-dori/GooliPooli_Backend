const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Haversine great-circle distance between two coordinates in meters.
 */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

export const DEFAULT_GPS_VALIDATION_RADIUS_M = 100;

export function isWithinRadius(
  expected: { latitude: number; longitude: number },
  actual: { latitude: number; longitude: number },
  radiusMeters = DEFAULT_GPS_VALIDATION_RADIUS_M,
): boolean {
  return haversineMeters(expected, actual) <= radiusMeters;
}
