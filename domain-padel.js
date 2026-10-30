// Padel match insights. Patterns here are observational: they describe your log,
// they do not prove what causes what.
import { mondayOf, isoDate } from './domain-calendar.js';
import { AREA_ROUTINE } from './domain-court.js';
import { recentPain } from './domain-pain.js';

export const PADEL_TYPES = { match: 'Match', americano: 'Americano', lesson: 'Lesson', training: 'Training', machine: 'Ball machine' };
// What a lesson, training or ball-machine session worked on (it changes which muscles it tires).
export const PADEL_FOCUS = { overheads: 'Overheads', groundstrokes: 'Groundstrokes and volleys', footwork: 'Footwork', mixed: 'Mixed' };
export const hasFocus = type => ['lesson', 'training', 'machine'].includes(type);
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

  const practice = recent.filter(s => hasFocus(s.padel?.type));
  return {
    sessions: recent.length, matches: matches.length, won, lost,
    practice: practice.length, practiceMin: practice.reduce((n, s) => n + (s.durationMin || 0), 0),
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

// Deeper look at your matches. Everything here describes your log; small numbers are noisy,
// so each comparison needs a few matches on both sides before it says anything.
const decided = list => list.filter(s => ['won', 'lost'].includes(s.padel?.result));
const rate = list => { const d = decided(list), w = d.filter(s => s.padel.result === 'won').length; return d.length ? { won: w, lost: d.length - w, pct: Math.round(w / d.length * 100), n: d.length } : null; };
export function padelInsights(sessions, { minEach = 3 } = {}) {
  const padel = sessions.filter(isPadel).sort((a, b) => a.startedAt - b.startedAt);
  const matches = padel.filter(s => ['match', 'americano'].includes(s.padel?.type || 'match'));
  const bySide = Object.keys(SIDES).map(k => [k, rate(matches.filter(s => s.padel?.side === k))]).filter(([, r]) => r);
  const names = new Map();
  for (const s of matches) { const raw = (s.padel?.partner || '').trim(); if (!raw) continue; const k = raw.toLowerCase(); if (!names.has(k)) names.set(k, raw); }
  const byPartner = [...names].map(([k, label]) => ({ label, ...rate(matches.filter(s => (s.padel?.partner || '').trim().toLowerCase() === k)) })).filter(p => p.n >= 2).sort((a, b) => b.n - a.n);
  // Gym in the 48 hours before a match, or not.
  const gymBefore = m => sessions.some(s => s.kind === 'strength' && s.startedAt < m.startedAt && m.startedAt - s.startedAt <= 2 * DAY);
  const afterGym = rate(matches.filter(gymBefore)), fresh = rate(matches.filter(m => !gymBefore(m)));
  const gymCompare = afterGym && fresh && afterGym.n >= minEach && fresh.n >= minEach ? { afterGym, fresh } : null;
  // Sore spots across your last 10 padel sessions, and whether they're coming up less often.
  const last = padel.slice(-10), half = Math.floor(last.length / 2), count = (list, a) => list.filter(s => s.padel?.sore?.includes(a)).length;
  const areas = [...new Set(last.flatMap(s => s.padel?.sore || []))];
  const recurring = areas.map(a => ({ area: a, n: count(last, a), of: last.length, trend: last.length >= 6 ? Math.sign(count(last.slice(half), a) - count(last.slice(0, half), a)) : 0 })).filter(r => r.n >= 2).sort((a, b) => b.n - a.n);
  return { total: rate(matches), matches: matches.length, bySide, byPartner, gymCompare, gymCounts: { afterGym: afterGym?.n || 0, fresh: fresh?.n || 0 }, recurring, minEach };
}
