// ---------------------------------------------------------------------------
// config.js
//

export const CONFIG = {
  // Default location used on first launch before geolocation resolves,
  // and as a fallback if the user denies location permission.
  DEFAULT_LOCATION: {
    name: "Dublin",
    lat: 53.3498,
    lon: -6.2603,
  },

  // Units — controls temperature, wind speed, visibility, pressure, and
  // tide height together, app-wide.
  UNIT_SYSTEM: "metric", // "metric" (°C, km/h, km, hPa, m) | "imperial" (°F, mph, mi, inHg, ft)
};
