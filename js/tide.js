// ---------------------------------------------------------------------------
// tide.js
//
// Default: Open-Meteo Marine API, sea_level_height_msl (hourly). No key.
//   This is a modelled sea-surface height (SMOC model), not a calibrated
//   tide-station prediction — good for "is it roughly high or low water"
//   and a rough curve, not for navigation.
//   Docs: https://open-meteo.com/en/docs/marine-weather-api
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";

export async function fetchMarineSeaLevel(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: "sea_level_height_msl",
    timezone: "auto",
    forecast_days: "2",
  });
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`);
  if (!res.ok) throw new Error(`Marine fetch failed (${res.status})`);
  return res.json();
}

/**
 * Derives simple rising/falling + approximate high/low points from the
 * hourly sea-level curve returned by Open-Meteo Marine.
 */
export function deriveTideSummary(marineData) {
  const times = marineData?.hourly?.time ?? [];
  const levels = marineData?.hourly?.sea_level_height_msl ?? [];
  if (!times.length) return null;

  const now = Date.now();
  let nowIdx = 0;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]).getTime() <= now) nowIdx = i;
  }

  const trend =
    levels[nowIdx + 1] > levels[nowIdx] ? "rising" : "falling";

  // find local extrema over the loaded window for a rough high/low list
  const extremes = [];
  for (let i = 1; i < levels.length - 1; i++) {
    const isHigh = levels[i] > levels[i - 1] && levels[i] > levels[i + 1];
    const isLow = levels[i] < levels[i - 1] && levels[i] < levels[i + 1];
    if (isHigh) extremes.push({ time: times[i], type: "High", level: levels[i] });
    if (isLow) extremes.push({ time: times[i], type: "Low", level: levels[i] });
  }

  return {
    currentLevel: levels[nowIdx],
    trend,
    extremes: extremes.slice(0, 4),
    source: "estimate",
  };
}

/**
 * Optional: real tide station extremes via Stormglass, only called if a key
 * is configured. Caller is responsible for not calling this more than
 * necessary given the 10/day free-tier cap.
 */
export async function fetchStormglassExtremes(lat, lon) {
  if (!CONFIG.STORMGLASS_API_KEY) return null;
  const start = new Date();
  const end = new Date(Date.now() + 2 * 86400000);
  const params = new URLSearchParams({
    lat,
    lng: lon,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const res = await fetch(`https://api.stormglass.io/v2/tide/extremes/point?${params}`, {
    headers: { Authorization: CONFIG.STORMGLASS_API_KEY },
  });
  if (!res.ok) throw new Error(`Stormglass fetch failed (${res.status})`);
  const data = await res.json();
  return {
    extremes: (data.data ?? []).map((e) => ({
      time: e.time,
      type: e.type === "high" ? "High" : "Low",
      level: e.height,
    })),
    station: data.meta?.station?.name,
    source: "station",
  };
}
