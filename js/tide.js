// ---------------------------------------------------------------------------
// tide.js
//
// Default: Open-Meteo Marine API, sea_level_height_msl (hourly). No key.
//   This is a modelled sea-surface height (SMOC model), not a calibrated
//   tide-station prediction — good for "is it roughly high or low water"
//   and a rough curve, not for navigation.
//   Docs: https://open-meteo.com/en/docs/marine-weather-api
// ---------------------------------------------------------------------------

export async function fetchMarineSeaLevel(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: "sea_level_height_msl",
    timezone: "auto",
    // A two-day window ensures there are usually two future extremes even
    // when the request is made late in the day.
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
  if (!Array.isArray(times) || !Array.isArray(levels) || times.length !== levels.length || times.length < 2) {
    return null;
  }

  // Keep the paired time/value shape intact and reject malformed values from
  // the API before looking for a curve direction or extrema.
  const samples = times
    .map((time, index) => ({ time, timestamp: new Date(time).getTime(), level: levels[index] }))
    .filter(({ timestamp, level }) => Number.isFinite(timestamp) && Number.isFinite(level));
  if (samples.length < 2) return null;

  const now = Date.now();
  let nowIdx = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].timestamp <= now) nowIdx = i;
  }

  let nextIdx = nowIdx + 1;
  while (nextIdx < samples.length && samples[nextIdx].level === samples[nowIdx].level) nextIdx++;
  const trend =
    nextIdx < samples.length && samples[nextIdx].level > samples[nowIdx].level ? "rising" : "falling";

  // Find local extrema, treating runs of equal hourly values as one flat
  // peak/trough. Strict single-point checks can skip a flat high, leaving two
  // lows displayed in a row.
  const extremes = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const start = i;
    while (i < samples.length - 1 && samples[i].level === samples[i + 1].level) i++;

    const end = i;
    if (end === samples.length - 1) break;
    const level = samples[start].level;
    const isHigh = level > samples[start - 1].level && level > samples[end + 1].level;
    const isLow = level < samples[start - 1].level && level < samples[end + 1].level;
    if (isHigh || isLow) {
      const sample = samples[Math.floor((start + end) / 2)];
      extremes.push({ time: sample.time, timestamp: sample.timestamp, type: isHigh ? "High" : "Low", level });
    }
  }

  return {
    currentLevel: samples[nowIdx].level,
    trend,
    extremes: extremes.filter((extreme) => extreme.timestamp > now).slice(0, 2),
  };
}
