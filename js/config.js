// ---------------------------------------------------------------------------
// config.js
//
// IMPORTANT — read before putting anything sensitive in here:
//
// PageCrypt encrypts this file (and the rest of the built page) AT REST —
// i.e. while it's sitting on a server or in a git repo, unreadable without
// the password. It does NOT make secrets safe at RUNTIME. Once you type the
// password into the PageCrypt prompt, your browser decrypts the whole page
// back into plain HTML/JS/CSS in memory and executes it normally. From that
// point on:
//   - Anyone who opens DevTools while the page is unlocked can read this
//     file's contents (including any key below) in plaintext.
//   - Any key used in a fetch() call is visible in the Network tab, in the
//     request URL or headers, regardless of encryption.
//   - If you ever share the decrypted URL/password with someone else, or a
//     browser extension/dev tool captures it, the key is exposed too.
//
// So: PageCrypt protects the file from casual/automated scraping while it's
// at rest (e.g. on GitHub Pages before you type the password). It does NOT
// turn client-side JS into a secure place to hold a billing-linked API key
// for a multi-tenant or public app.
//
// For THIS project (single-user, personal use) that tradeoff is usually
// fine, as long as you pick keys where "someone finds it and burns my quota"
// is the worst case, not "someone racks up a bill on my card":
//   - Open-Meteo (weather, marine/tide, air quality, geocoding): no key at
//     all, so there's nothing to protect.
//   - BigDataCloud reverse geocoding (client-side, free tier): no key.
//   - Stormglass (optional, for real tide extremes): free tier is a flat
//     10 requests/day, no billing attached unless you upgrade — reasonable
//     to keep client-side for personal use, just don't publish the key
//     anywhere public. If you ever upgrade to a paid Stormglass plan, move
//     this behind a tiny serverless proxy instead of embedding it here.
//
// If you later add anything with pay-per-use billing, don't put it here —
// use a serverless function (Cloudflare Worker / Netlify function) as a
// thin proxy that holds the real key server-side instead.
// ---------------------------------------------------------------------------

export const CONFIG = {
  // Optional. Leave blank to use only the free Open-Meteo marine "sea level"
  // model as a tide estimate. Fill in to also show real tide-station
  // high/low extremes from Stormglass (10 free requests/day total across
  // ALL locations you check, so it's best used for 1–2 favourite spots).
  STORMGLASS_API_KEY: "",

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
