/** Haversine distance in meters — used to estimate the leg from the chosen
 *  start point to the first stop (the backend engine handles inter-stop legs). */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function walkEstimate(meters: number): string {
  const min = Math.max(1, Math.round(meters / 75));
  return `🚶 ~${min} min (${Math.round(meters)}m) to your first stop`;
}
