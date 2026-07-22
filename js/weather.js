// ---------------------------------------------------------------------------
// weather.js — Open-Meteo forecast + air quality. No API key required.
// Docs: https://open-meteo.com/en/docs
// ---------------------------------------------------------------------------

const WMO = {
  0: { text: "Clear sky", icon: "☀️" },
  1: { text: "Mainly clear", icon: "🌤️" },
  2: { text: "Partly cloudy", icon: "⛅" },
  3: { text: "Overcast", icon: "☁️" },
  45: { text: "Fog", icon: "🌫️" },
  48: { text: "Depositing rime fog", icon: "🌫️" },
  51: { text: "Light drizzle", icon: "🌦️" },
  53: { text: "Drizzle", icon: "🌦️" },
  55: { text: "Dense drizzle", icon: "🌦️" },
  61: { text: "Slight rain", icon: "🌧️" },
  63: { text: "Rain", icon: "🌧️" },
  65: { text: "Heavy rain", icon: "🌧️" },
  66: { text: "Freezing rain", icon: "🌧️" },
  67: { text: "Heavy freezing rain", icon: "🌧️" },
  71: { text: "Slight snow", icon: "🌨️" },
  73: { text: "Snow", icon: "🌨️" },
  75: { text: "Heavy snow", icon: "❄️" },
  77: { text: "Snow grains", icon: "❄️" },
  80: { text: "Slight showers", icon: "🌦️" },
  81: { text: "Showers", icon: "🌦️" },
  82: { text: "Violent showers", icon: "⛈️" },
  85: { text: "Slight snow showers", icon: "🌨️" },
  86: { text: "Heavy snow showers", icon: "🌨️" },
  95: { text: "Thunderstorm", icon: "⛈️" },
  96: { text: "Thunderstorm, slight hail", icon: "⛈️" },
  99: { text: "Thunderstorm, heavy hail", icon: "⛈️" },
};

export function describeWeatherCode(code) {
  return WMO[code] ?? { text: "Unknown", icon: "❔" };
}

export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "dew_point_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "cloud_cover",
      "pressure_msl",
      "uv_index",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
      "visibility",
    ].join(","),
    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "weather_code",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
    ].join(","),
    timezone: "auto",
    forecast_days: "7",
    wind_speed_unit: "kmh",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  return res.json();
}

export async function fetchAirQuality(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: ["us_aqi", "pm2_5"].join(","),
    timezone: "auto",
  });
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`
  );
  if (!res.ok) throw new Error(`Air quality fetch failed (${res.status})`);
  return res.json();
}
