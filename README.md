# Pocket Weather

A no-backend weather + tide + moon-phase PWA, styled after the Fahrenheit
weather app. Bookmark it to your iOS home screen; everything runs client-side
against free APIs.

## APIs used

| Data | Provider | Key required? | Notes |
|---|---|---|---|
| Current + hourly + daily weather | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | No | Free, no rate limit for personal use, global coverage including Ireland |
| Air quality (AQI, PM2.5) | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | No | Same account, separate endpoint |
| Place search ("Galway" → coordinates) | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | No | |
| Reverse geocode (coordinates → place name) | [BigDataCloud client-side reverse geocode](https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocoding-to-city-api) | No | Designed to be called straight from the browser |
| Tide (estimate) | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api), `sea_level_height_msl` | No | Modelled sea-surface height (SMOC model). Good for "rising/falling and roughly how high," **not** calibrated to a real tide station or chart datum — Open-Meteo's own docs recommend caution for anything more precise, especially in complex coastlines |
| Tide (real station extremes, optional) | [Stormglass Tide API](https://docs.stormglass.io/#/tide) | Yes | Free tier = 10 requests/day **total**. Gives real high/low timestamps from the nearest tide station. Worth it if you mostly check 1–2 coastal spots; too limited if you're flipping between many locations daily |
| Moon phase | Calculated locally (`js/moon.js`) | No | Simple synodic-month math, no network call, no API to break |