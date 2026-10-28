// Padel match insights. Patterns here are observational: they describe your log,
// they do not prove what causes what.
import { mondayOf, isoDate } from './domain-calendar.js';
import { AREA_ROUTINE } from './domain-court.js';
import { recentPain } from './domain-pain.js';

export const PADEL_TYPES = { match: 'Match', training: 'Training', lesson: 'Lesson', americano: 'Americano' };
export const SIDES = { drive: 'Drive (right)', reves: 'Revés (left)', both: 'Both' };
export const RESULTS = { won: 'Won', lost: 'Lost', none: '—' };

const DAY = 86400000;
const isPadel = s => s.kind === 'activity' && s.activity === 'padel';

export function padelSummary(sessions, now = Date.now(), days = 60) {
  const recent = sessions.filter(s => isPadel(s) && now - s.startedAt <= days * DAY);
  const matches = recent.filter(s => (s.padel?.type || 'match') === 'match' || s.padel?.type === 'americano');
  const won = matches.filter(s => s.padel?.result === 'won').length;
  const lost = matches.filter(s => s.padel?.result === 'lost').length;
  const sides = {};
  const sore = {};
  for (const s of recent) {
    if (s.padel?.side) sides[s.padel.side] = (sides[s.padel.side] || 0) + 1;
    for (const a of s.padel?.sore || []) sore[a] = (sore[a] || 0) + 1;
  }
  const topSore = Object.entries(sore).sort((a, b) => b[1] - a[1])[0] || null;

  // Weeks where soreness was reported vs not: average padel minutes.
  const weeks = new Map();
  for (const s of sessions.filter(isPadel)) {
    const k = isoDate(mondayOf(new Date(s.startedAt)));
    const w = weeks.get(k) || { min: 0, sore: false };
    w.min += s.durationMin || 0; if (s.padel?.sore?.length) w.sore = true;
    weeks.set(k, w);
  }
  const avg = arr => arr.length ? Math.round(arr.reduce((n, w) => n + w.min, 0) / arr.length) : null;
  const soreWeeks = [...weeks.values()].filter(w => w.sore), okWeeks = [...weeks.values()].filter(w => !w.sore);

  return {
    sessions: recent.length, matches: matches.length, won, lost,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    minutes: recent.reduce((n, s) => n + (s.durationMin || 0), 0),
    sides, sore, topSore,
    soreWeekMin: avg(soreWeeks), okWeekMin: avg(okWeeks), weeksCompared: soreWeeks.length >= 2 && okWeeks.length >= 2,
    suggestRoutine: topSore && topSore[1] >= 2 ? AREA_ROUTINE[topSore[0]] : null,
  };
}

// Prehab routines to recommend: from profile injuries plus areas flagged in recent matches.
// Prevention routines worth doing: areas from your profile, padel soreness that repeats, and
// pain you reported after a workout (the same "recently hurt" list workouts use to flag exercises).
export function prehabFor(profile, sessions, now = Date.now(), { cleared = {} } = {}) {
  const ids = new Set((profile?.injuries || []).map(a => AREA_ROUTINE[a]).filter(Boolean));
  const recent = sessions.filter(s => isPadel(s) && now - s.startedAt <= 21 * DAY);
  const flagged = {}, hurt = recentPain(sessions, { now, cleared });
  for (const s of recent) for (const a of s.padel?.sore || []) flagged[a] = (flagged[a] || 0) + 1;
  for (const [a, n] of Object.entries(flagged)) if (n >= 2 && AREA_ROUTINE[a]) ids.add(AREA_ROUTINE[a]);
  for (const a of Object.keys(hurt)) { if (AREA_ROUTINE[a]) ids.add(AREA_ROUTINE[a]); flagged[a] = Math.max(flagged[a] || 0, 2); }
  return { ids: [...ids], flagged, hurt };
}
