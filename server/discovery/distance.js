const EARTH_RADIUS_MILES = 3958.7613;
const KILOMETRES_PER_MILE = 1.609344;

export function milesToKilometres(miles) {
  return miles * KILOMETRES_PER_MILE;
}

export function haversineMiles(origin, destination) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) * Math.cos(toRadians(destination.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Both radius bounds are inclusive; an unknown distance stays eligible rather than rejected.
export function classifyDistance(distanceMiles, preferredRadiusMiles, maximumRadiusMiles) {
  if (distanceMiles == null) return 'unknown';
  if (distanceMiles <= preferredRadiusMiles) return 'preferred';
  if (distanceMiles <= maximumRadiusMiles) return 'expanded';
  return 'rejected';
}

export function roundMiles(distanceMiles) {
  return distanceMiles == null ? null : Math.round(distanceMiles * 100) / 100;
}
