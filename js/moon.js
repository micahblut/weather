// ---------------------------------------------------------------------------
// moon.js — pure-math moon phase, no API call required.
//
// Based on a known new moon reference date and the mean synodic month
// length. Accurate to well within an hour or two, which is plenty for a
// "what phase is the moon in" display.
// ---------------------------------------------------------------------------

const SYNODIC_MONTH_DAYS = 29.530588853;
// A known new moon: 2000-01-06 18:14 UTC
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

const PHASES = [
  { max: 0.0166, name: "New Moon", emoji: "🌑" },
  { max: 0.2416, name: "Waxing Crescent", emoji: "🌒" },
  { max: 0.2666, name: "First Quarter", emoji: "🌓" },
  { max: 0.4916, name: "Waxing Gibbous", emoji: "🌔" },
  { max: 0.5166, name: "Full Moon", emoji: "🌕" },
  { max: 0.7416, name: "Waning Gibbous", emoji: "🌖" },
  { max: 0.7666, name: "Last Quarter", emoji: "🌗" },
  { max: 0.9916, name: "Waning Crescent", emoji: "🌘" },
  { max: 1.0001, name: "New Moon", emoji: "🌑" },
];

/**
 * Returns the moon phase for a given date.
 * @param {Date} date
 * @returns {{ age: number, fraction: number, illumination: number, name: string, emoji: string }}
 *   age: days since last new moon
 *   fraction: 0..1 position through the current synodic cycle
 *   illumination: 0..100, % of the disc illuminated
 */
export function getMoonPhase(date = new Date()) {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
  const cycles = diffDays / SYNODIC_MONTH_DAYS;
  const fraction = cycles - Math.floor(cycles); // 0..1
  const age = fraction * SYNODIC_MONTH_DAYS;

  // Illumination approximated from phase angle (0 at new, 1 at full)
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * fraction)) * 50);

  const phase = PHASES.find((p) => fraction <= p.max) ?? PHASES[PHASES.length - 1];

  return {
    age: Math.round(age * 10) / 10,
    fraction,
    illumination,
    name: phase.name,
    emoji: phase.emoji,
  };
}

/**
 * Finds the next occurrence of a target fraction (0 = new, 0.5 = full)
 * on/after `from`, by stepping forward day by day. Cheap enough at this scale.
 */
export function nextPhaseDate(targetFraction, from = new Date()) {
  let d = new Date(from);
  for (let i = 0; i < 40; i++) {
    const { fraction } = getMoonPhase(d);
    const prev = getMoonPhase(new Date(d.getTime() - 86400000)).fraction;
    const crossesUp = prev < targetFraction && fraction >= targetFraction;
    const crossesWrap = targetFraction === 0 && prev > fraction;
    if (crossesUp || crossesWrap) return d;
    d = new Date(d.getTime() + 86400000);
  }
  return null;
}
