// ---------------------------------------------------------------------------
// geocode.js — location name search + reverse geocoding.
// Both providers are free and keyless, so nothing to protect here.
// ---------------------------------------------------------------------------

/**
 * Forward search: "Galway" -> list of candidate places with lat/lon.
 * Open-Meteo Geocoding API: https://open-meteo.com/en/docs/geocoding-api
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=8&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding search failed (${res.status})`);
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
}

/**
 * Reverse geocode lat/lon -> a friendly place name.
 * BigDataCloud's client-side reverse geocode endpoint is free and requires
 * no API key when called from a browser: https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocoding-to-city-api
 */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    const name =
      data.city || data.locality || data.principalSubdivision || "Current Location";
    return name;
  } catch {
    return "Current Location";
  }
}
