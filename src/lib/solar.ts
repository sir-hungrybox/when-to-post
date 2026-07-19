// Subsolar point (the lat/lng where the sun is directly overhead) for a given
// instant — drives the day/night terminator shader. Standard low-precision
// solar ephemeris (Astronomical Almanac approximation, good to ~0.01°).

const RAD = Math.PI / 180;

export function subsolarPoint(date: Date): { lat: number; lng: number } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0; // days since J2000

  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD; // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // ecliptic longitude
  const epsilon = (23.439 - 0.0000004 * n) * RAD; // obliquity

  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda)); // declination = subsolar latitude
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)); // right ascension

  const gmst = (280.46061837 + 360.98564736629 * n) % 360; // Greenwich sidereal time, degrees
  const lng = ((ra / RAD - gmst) % 360 + 540) % 360 - 180;

  return { lat: decl / RAD, lng };
}
