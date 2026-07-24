import { CONFIG } from "./config.js";
import { searchPlaces, reverseGeocode } from "./geocode.js";
import { fetchWeather, fetchAirQuality, describeWeatherCode } from "./weather.js";
import { fetchMarineSeaLevel, deriveTideSummary } from "./tide.js";
import { getMoonPhase } from "./moon.js";

const LOCATIONS_KEY = "weatherapp.locations.v1";
const LAST_SELECTED_KEY = "weatherapp.lastSelected.v1";
const UNIT_KEY = "weatherapp.tempUnit.v1";

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Unit preference (persisted separately from config.js, since that file is a
// static default — this overrides it at runtime and remembers the choice).
// ---------------------------------------------------------------------------

const storedUnit = localStorage.getItem(UNIT_KEY);
if (storedUnit === "metric" || storedUnit === "imperial") {
  CONFIG.UNIT_SYSTEM = storedUnit;
}

const isImperial = () => CONFIG.UNIT_SYSTEM === "imperial";

function fmtTemp(celsius) {
  if (celsius == null || Number.isNaN(celsius)) return "—";
  const v = isImperial() ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(v)}°`;
}

// All raw data from the APIs arrives in metric (km/h, km, hPa, m) — these
// convert to imperial for display only, so no refetch is needed on toggle.
function fmtWindSpeed(kmh) {
  if (kmh == null || Number.isNaN(kmh)) return "—";
  return isImperial() ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`;
}

function fmtVisibility(km) {
  if (km == null || Number.isNaN(km)) return "—";
  return isImperial() ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`;
}

function fmtPressure(hPa) {
  if (hPa == null || Number.isNaN(hPa)) return "—";
  return isImperial() ? `${(hPa * 0.0295299830).toFixed(2)} inHg` : `${Math.round(hPa)} hPa`;
}

function fmtTideLevel(meters) {
  if (meters == null || Number.isNaN(meters)) return "";
  return isImperial() ? `${(meters * 3.28084).toFixed(1)} ft` : `${meters.toFixed(2)} m`;
}

// ---------------------------------------------------------------------------
// Location store (saved in localStorage — just place names/coords, nothing
// sensitive, so no encryption concerns here).
// ---------------------------------------------------------------------------

function loadLocations() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt storage */
  }
  return [{ ...CONFIG.DEFAULT_LOCATION, id: "default" }];
}

function saveLocations(locs) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locs));
}

let locations = loadLocations();
let currentId = localStorage.getItem(LAST_SELECTED_KEY) || locations[0].id;

// Cache of the last successful fetch, so toggling units re-renders instantly
// without hitting the network again.
let lastLoc = null;
let lastWeather = null;
let lastAirQuality = null;
let lastTideSummary = null;
let displayTime = null;

const DAY_SKY = [
  [127, 174, 122],
  [91, 143, 176],
  [63, 111, 168],
  [53, 84, 143],
];
const NIGHT_SKY = [
  [20, 35, 67],
  [22, 42, 83],
  [19, 34, 73],
  [13, 23, 55],
];

function currentLocation() {
  return locations.find((l) => l.id === currentId) ?? locations[0];
}

function updateLocationNameDisplay() {
  el("location-name-display").textContent = currentLocation()?.name ?? "—";
}

function renderSavedLocations() {
  const container = el("saved-locations");
  container.innerHTML = "";
  for (const loc of locations) {
    const row = document.createElement("div");
    row.className = "saved-location-item" + (loc.id === currentId ? " active" : "");
    row.textContent = loc.name;
    row.addEventListener("click", () => {
      el("location-panel").classList.add("hidden");
      selectLocation(loc.id);
    });
    container.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function fmtTime(iso, opts = { hour: "numeric" }) {
  return new Date(iso).toLocaleTimeString([], opts);
}

function fmtDay(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: "short" });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "numeric" });
}

function renderCurrent(loc, weather, airQuality) {
  const c = weather.current;
  const desc = describeWeatherCode(c.weather_code);

  el("place-name").textContent = loc.name;
  el("place-coords").textContent = `${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°`;
  el("condition-icon").textContent = desc.icon;
  el("condition-text").textContent = desc.text;
  el("current-temp").textContent = fmtTemp(c.temperature_2m);
  el("current-temp-alt").textContent = `Feels ${fmtTemp(c.apparent_temperature)}`;

  el("qs-precip").textContent = `${c.precipitation_probability ?? 0}%`;
  el("qs-cloud").textContent = `${c.cloud_cover ?? 0}%`;
  el("qs-humidity").textContent = `${c.relative_humidity_2m ?? 0}%`;
  el("qs-wind").textContent = fmtWindSpeed(c.wind_speed_10m);
  el("qs-aqi").textContent = airQuality?.current?.us_aqi ?? "—";
}

function renderHourly(weather, { resetDisplayTime = true } = {}) {
  const container = el("hourly-scroll");
  container.innerHTML = "";
  const { time, temperature_2m, weather_code } = weather.hourly;

  const now = Date.now();
  let startIdx = time.findIndex((t) => new Date(t).getTime() >= now);
  if (startIdx < 0) startIdx = 0;

  for (let i = startIdx; i < Math.min(startIdx + 24, time.length); i++) {
    const desc = describeWeatherCode(weather_code[i]);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "hour-item";
    item.dataset.time = time[i];
    item.setAttribute("aria-label", `${i === startIdx ? "Now" : fmtTime(time[i])}, ${desc.text}, ${fmtTemp(temperature_2m[i])}`);
    item.innerHTML = `
      <div class="h-time">${i === startIdx ? "Now" : fmtTime(time[i])}</div>
      <div class="h-icon">${desc.icon}</div>
      <div class="h-temp">${fmtTemp(temperature_2m[i])}</div>
    `;
    item.addEventListener("click", () => {
      container.scrollTo({ left: item.offsetLeft, behavior: "smooth" });
    });
    container.appendChild(item);
  }

  // A scroll position is the source of truth for display time: the first
  // hourly tile at the left edge is the selected hour. This also makes the
  // initial state unambiguously "Now" after every refresh.
  let pendingFrame = null;
  container.addEventListener("scroll", () => {
    if (pendingFrame != null) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null;
      syncDisplayTimeFromHourlyScroll(container);
    });
  });
  const items = [...container.querySelectorAll(".hour-item")];
  requestAnimationFrame(() => {
    if (resetDisplayTime || !displayTime) {
      container.scrollLeft = 0;
    } else {
      // Unit changes re-render from cached data. Keep the hour the person was
      // exploring instead of unexpectedly returning them to "Now".
      const preserved = items.reduce((closest, item) => {
        const distance = Math.abs(new Date(item.dataset.time) - displayTime);
        return distance < closest.distance ? { item, distance } : closest;
      }, { item: items[0], distance: Infinity }).item;
      container.scrollLeft = preserved.offsetLeft;
    }
    syncDisplayTimeFromHourlyScroll(container);
  });
}

function syncDisplayTimeFromHourlyScroll(container) {
  const items = [...container.querySelectorAll(".hour-item")];
  if (!items.length) return;

  // Interpolating between neighbouring tile positions keeps the sky and moon
  // moving smoothly during a swipe, while the highlighted tile remains the
  // nearest whole display hour.
  let rightIndex = items.findIndex((item) => item.offsetLeft > container.scrollLeft);
  if (rightIndex < 0) rightIndex = items.length - 1;
  const leftIndex = Math.max(0, rightIndex - 1);
  const left = items[leftIndex];
  const right = items[rightIndex];
  const span = Math.max(1, right.offsetLeft - left.offsetLeft);
  const progress = leftIndex === rightIndex ? 0 : Math.min(1, Math.max(0, (container.scrollLeft - left.offsetLeft) / span));
  const start = new Date(left.dataset.time).getTime();
  const end = new Date(right.dataset.time).getTime();
  displayTime = new Date(start + (end - start) * progress);

  let active = leftIndex;
  if (rightIndex !== leftIndex && progress >= 0.5) active = rightIndex;
  items.forEach((item, index) => {
    item.classList.toggle("active", index === active);
    item.setAttribute("aria-current", index === active ? "true" : "false");
  });

  updateDisplayTimePresentation();
}

function updateDisplayTimePresentation() {
  if (!displayTime) return;

  const hour = displayTime.getHours() + displayTime.getMinutes() / 60;
  // The cosine keeps the noon palette untouched while creating a long,
  // natural-looking twilight into a cooler, calmer midnight palette.
  const nightAmount = (1 + Math.cos((2 * Math.PI * hour) / 24)) / 2;
  const skyStops = ["--sky-top", "--sky-upper", "--sky-lower", "--sky-bottom"];
  skyStops.forEach((stop, index) => {
    document.documentElement.style.setProperty(stop, mixSkyColor(DAY_SKY[index], NIGHT_SKY[index], nightAmount));
  });
  positionMoonOnArc(hour);
}

function mixSkyColor(day, night, amount) {
  const channels = day.map((channel, index) => Math.round(channel + (night[index] - channel) * amount));
  return `rgb(${channels.join(", ")})`;
}

function positionMoonOnArc(hour) {
  const moon = el("moon-arc");
  const nightProgress = hour >= 18 ? (hour - 18) / 12 : hour <= 6 ? (hour + 6) / 12 : null;
  if (nightProgress == null) {
    moon.classList.remove("visible");
    return;
  }

  const app = el("app");
  const appBox = app.getBoundingClientRect();
  const quickStatsBox = document.querySelector(".quick-stats")?.getBoundingClientRect();
  const headerBox = document.querySelector(".location-bar")?.getBoundingClientRect();
  const locationBox = document.querySelector(".place-name")?.getBoundingClientRect();
  const lowY = quickStatsBox ? quickStatsBox.top - appBox.top + quickStatsBox.height / 2 : 250;
  const moonRadius = moon.offsetHeight / 2 || 19;
  // Keep the moon's highest point just below the place name. It may overlap
  // the coordinates, but never the selected location itself.
  const peakY = locationBox
    ? locationBox.bottom - appBox.top + moonRadius + 6
    : headerBox
      ? headerBox.bottom - appBox.top + moonRadius + 6
      : 76;
  const arcHeight = Math.max(0, lowY - peakY);
  const x = -20 + nightProgress * (appBox.width + 40);
  const y = lowY - arcHeight * 4 * nightProgress * (1 - nightProgress);

  moon.textContent = getMoonPhase().emoji;
  moon.style.left = `${x}px`;
  moon.style.top = `${y}px`;
  moon.classList.add("visible");
}

function renderDaily(weather) {
  const container = el("daily-list");
  container.innerHTML = "";
  const { time, weather_code, temperature_2m_max, temperature_2m_min } = weather.daily;

  const globalMin = Math.min(...temperature_2m_min);
  const globalMax = Math.max(...temperature_2m_max);
  const range = Math.max(1, globalMax - globalMin);

  for (let i = 0; i < time.length; i++) {
    const desc = describeWeatherCode(weather_code[i]);
    const lo = temperature_2m_min[i];
    const hi = temperature_2m_max[i];
    const leftPct = ((lo - globalMin) / range) * 100;
    const widthPct = ((hi - lo) / range) * 100;

    const row = document.createElement("div");
    row.className = "daily-row";
    row.innerHTML = `
      <div>
        <span class="daily-day">${i === 0 ? "Today" : fmtDay(time[i])}</span>
        <span class="daily-date">${fmtDate(time[i])}</span>
      </div>
      <div class="daily-icon">${desc.icon}</div>
      <div class="temp-bar-track">
        <div class="temp-bar-fill" style="left:${leftPct}%;width:${widthPct}%"></div>
      </div>
      <div class="daily-temps">
        <span class="hi">${fmtTemp(hi)}</span>
        <span class="lo">${fmtTemp(lo)}</span>
      </div>
    `;
    container.appendChild(row);
  }
}

function detailRow(emoji, label, value, sub = "") {
  return `
    <div class="detail-row">
      <div class="detail-label"><span class="emoji">${emoji}</span>${label}</div>
      <div class="detail-value">${value}${sub ? `<span class="sub">${sub}</span>` : ""}</div>
    </div>
  `;
}

function renderDetails(weather, airQuality) {
  const c = weather.current;
  const today = weather.daily;
  el("details-card").innerHTML = [
    detailRow("🌡️", "Feels Like", fmtTemp(c.apparent_temperature)),
    detailRow("💧", "Dew Point", fmtTemp(c.dew_point_2m)),
    detailRow("🌧️", "Precip Chance", `${c.precipitation_probability ?? 0}%`),
    detailRow("☁️", "Cloud Cover", `${c.cloud_cover ?? 0}%`),
    detailRow("〰️", "Humidity", `${c.relative_humidity_2m}%`),
    detailRow("🧭", "Pressure", fmtPressure(c.pressure_msl)),
    detailRow("☀️", "UV Index", `${c.uv_index ?? "—"}`),
    detailRow("▦", "AQI (US)", `${airQuality?.current?.us_aqi ?? "—"}`),
    detailRow("▦", "PM2.5", `${airQuality?.current?.pm2_5 ?? "—"} µg/m³`),
    detailRow("👁️", "Visibility", fmtVisibility((c.visibility ?? 0) / 1000)),
    detailRow("🎐", "Wind", fmtWindSpeed(c.wind_speed_10m), degToCompass(c.wind_direction_10m)),
    detailRow("🌅", "Sunrise", fmtTime(today.sunrise[0], { hour: "numeric", minute: "2-digit" })),
    detailRow("🌇", "Sunset", fmtTime(today.sunset[0], { hour: "numeric", minute: "2-digit" })),
  ].join("");
}

function degToCompass(deg) {
  if (deg == null) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function renderTide(summary) {
  const container = el("tide-content");
  if (!summary) {
    container.textContent = "Tide data unavailable for this location.";
    return;
  }
  const rows = summary.extremes
    .map(
      (e) => `
      <div class="tide-extreme-row">
        <span>${e.type} tide</span>
        <span>${fmtTime(e.time, { hour: "numeric", minute: "2-digit" })}</span>
      </div>`
    )
    .join("");

  container.innerHTML = `
    <div>Currently <strong>${summary.trend}</strong>${
      summary.currentLevel != null ? ` · ${fmtTideLevel(summary.currentLevel)}` : ""
    }</div>
    <div class="tide-extremes">${rows || "<em>No extremes found in window.</em>"}</div>
    <div class="tide-note">Modelled estimate (Open‑Meteo Marine), not a calibrated tide-station prediction — treat as approximate.</div>
  `;
}

function renderMoon() {
  const m = getMoonPhase();
  el("moon-content").innerHTML = `
    <div class="moon-row">
      <div class="moon-emoji">${m.emoji}</div>
      <div>
        <div><strong>${m.name}</strong></div>
        <div class="moon-illum">${m.illumination}% illuminated · day ${m.age} of cycle</div>
      </div>
    </div>
  `;
}

function renderAll({ resetDisplayTime = true } = {}) {
  if (!lastLoc || !lastWeather) return;
  renderCurrent(lastLoc, lastWeather, lastAirQuality);
  renderHourly(lastWeather, { resetDisplayTime });
  renderDaily(lastWeather);
  renderDetails(lastWeather, lastAirQuality);
  renderMoon();
  renderTide(lastTideSummary);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function loadLocationData(loc, { silent = false } = {}) {
  if (!silent) {
    el("loading").classList.remove("hidden");
    el("content").classList.add("hidden");
  }
  hideError();
  updateLocationNameDisplay();

  try {
    const [weather, airQuality, marine] = await Promise.all([
      fetchWeather(loc.lat, loc.lon),
      fetchAirQuality(loc.lat, loc.lon).catch(() => null),
      fetchMarineSeaLevel(loc.lat, loc.lon).catch(() => null),
    ]);

    const tideSummary = marine ? deriveTideSummary(marine) : null;

    lastLoc = loc;
    lastWeather = weather;
    lastAirQuality = airQuality;
    lastTideSummary = tideSummary;

    renderAll();

    el("last-updated").textContent = `Updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;

    el("content").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    showError("Couldn't load weather data. Check your connection and try again.");
  } finally {
    if (!silent) el("loading").classList.add("hidden");
  }
}

function showError(msg) {
  const banner = el("error-banner");
  banner.textContent = msg;
  banner.classList.remove("hidden");
}
function hideError() {
  el("error-banner").classList.add("hidden");
}

function selectLocation(id) {
  currentId = id;
  localStorage.setItem(LAST_SELECTED_KEY, id);
  updateLocationNameDisplay();
  loadLocationData(currentLocation());
}

async function useDeviceLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const name = await reverseGeocode(lat, lon);
      const id = "device-current";
      const existingIdx = locations.findIndex((l) => l.id === id);
      const loc = { id, name, lat, lon };
      if (existingIdx >= 0) locations[existingIdx] = loc;
      else locations.unshift(loc);
      saveLocations(locations);
      selectLocation(id);
    },
    (err) => {
      console.warn("Geolocation denied/failed", err);
      // Fall back silently to whatever location is already selected.
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}

// ---------------------------------------------------------------------------
// Location search panel — tapping the location name opens this directly
// (search-first), with previously saved locations listed below for quick
// switching back.
// ---------------------------------------------------------------------------

let searchDebounce;
function wireLocationPanel() {
  const panel = el("location-panel");
  const input = el("location-search");
  const results = el("location-results");

  el("btn-open-location").addEventListener("click", () => {
    el("settings-panel").classList.add("hidden");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      // Keep this as a search field, rather than echoing the selected location.
      input.value = "";
      results.innerHTML = "";
      renderSavedLocations();
      input.focus();
    }
    requestAnimationFrame(updateDisplayTimePresentation);
  });
  el("btn-close-panel").addEventListener("click", () => {
    panel.classList.add("hidden");
    requestAnimationFrame(updateDisplayTimePresentation);
  });

  input.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 2) return;
      try {
        const matches = await searchPlaces(q);
        for (const m of matches) {
          const row = document.createElement("div");
          row.className = "search-result-item";
          row.textContent = m.label;
          row.addEventListener("click", () => {
            const id = `${m.lat.toFixed(3)},${m.lon.toFixed(3)}`;
            if (!locations.find((l) => l.id === id)) {
              locations.push({ id, name: m.name, lat: m.lat, lon: m.lon });
              saveLocations(locations);
            }
            panel.classList.add("hidden");
            input.value = "";
            results.innerHTML = "";
            selectLocation(id);
          });
          results.appendChild(row);
        }
      } catch (e) {
        console.warn("Search failed", e);
      }
    }, 300);
  });
}

// ---------------------------------------------------------------------------
// Settings panel — temperature unit toggle
// ---------------------------------------------------------------------------

function updateUnitButtons() {
  el("unit-metric").classList.toggle("active", CONFIG.UNIT_SYSTEM === "metric");
  el("unit-imperial").classList.toggle("active", CONFIG.UNIT_SYSTEM === "imperial");
}

function wireSettingsPanel() {
  const panel = el("settings-panel");

  el("btn-open-settings").addEventListener("click", () => {
    el("location-panel").classList.add("hidden");
    panel.classList.toggle("hidden");
    requestAnimationFrame(updateDisplayTimePresentation);
  });
  el("btn-close-settings").addEventListener("click", () => {
    panel.classList.add("hidden");
    requestAnimationFrame(updateDisplayTimePresentation);
  });

  for (const btn of [el("unit-metric"), el("unit-imperial")]) {
    btn.addEventListener("click", () => {
      CONFIG.UNIT_SYSTEM = btn.dataset.unit;
      localStorage.setItem(UNIT_KEY, CONFIG.UNIT_SYSTEM);
      updateUnitButtons();
      renderAll({ resetDisplayTime: false }); // instant re-render from cached data, no refetch needed
    });
  }

  updateUnitButtons();
}

// ---------------------------------------------------------------------------
// Pull-to-refresh — hand-rolled since the browser's native overscroll
// bounce is disabled (see `overscroll-behavior-y: none` in style.css) and
// installed/standalone PWAs don't get a pull-to-reload gesture for free.
// ---------------------------------------------------------------------------

function wirePullToRefresh() {
  const wrapper = el("pull-wrapper");
  const indicator = el("pull-refresh");
  const icon = indicator.querySelector(".pull-refresh-icon");

  const THRESHOLD = 70; // px of (resisted) pull distance needed to trigger a refresh
  const MAX_PULL = 110;

  let startY = null;
  let pulling = false;
  let refreshing = false;
  let currentPull = 0;

  function setPull(px) {
    currentPull = px;
    wrapper.style.transform = px > 0 ? `translateY(${px}px)` : "";
    const progress = Math.min(px / THRESHOLD, 1);
    indicator.style.opacity = progress;
    indicator.style.transform = `translateX(-50%) scale(${0.5 + progress * 0.5})`;
    icon.style.transform = `rotate(${progress * 180}deg)`;
  }

  function reset() {
    wrapper.classList.add("pull-reset");
    setPull(0);
    indicator.classList.remove("spinning");
    setTimeout(() => wrapper.classList.remove("pull-reset"), 250);
  }

  window.addEventListener(
    "touchstart",
    (e) => {
      if (refreshing || window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!pulling || startY == null) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0 || window.scrollY > 0) {
        pulling = false;
        setPull(0);
        return;
      }
      e.preventDefault(); // only for the downward-at-top gesture, so normal scrolling is untouched
      setPull(Math.min(MAX_PULL, delta * 0.5)); // resistance curve
    },
    { passive: false }
  );

  window.addEventListener("touchend", async () => {
    if (!pulling) return;
    pulling = false;
    startY = null;

    if (currentPull >= THRESHOLD && !refreshing) {
      refreshing = true;
      indicator.classList.add("spinning");
      setPull(THRESHOLD);
      try {
        await loadLocationData(currentLocation(), { silent: true });
      } finally {
        refreshing = false;
        reset();
      }
    } else {
      reset();
    }
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  updateLocationNameDisplay();
  wireLocationPanel();
  wireSettingsPanel();
  wirePullToRefresh();

  window.addEventListener("resize", updateDisplayTimePresentation);

  el("btn-locate").addEventListener("click", useDeviceLocation);

  // First load: try device location once, otherwise use last-selected/default.
  loadLocationData(currentLocation());
  useDeviceLocation();
}

document.addEventListener("DOMContentLoaded", init);
