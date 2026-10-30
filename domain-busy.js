// Busy padel weeks: when padel takes most of the week, the gym drops to two sessions plus a rest day.
// One short Strength session (the anchor: jumps and your main leg lifts, heavy with few sets) and one
// session that's light on the legs (the flex). Pure functions.
import { getExercise } from './domain-catalog.js';
import { padelProfile } from './domain-recovery.js';

export const ANCHOR_ID = 'S';

// padels: [{ type, focus }] for the week. Busy: 4 or more sessions, or 3 with at least 2 that are as
// tough on the legs as a match (a ball machine or an overheads lesson doesn't count).
export function busyWeek(padels = []) {
  const legsLike = padels.filter(p => padelProfile(p?.type, p?.focus).legs >= 0.9).length;
  return { busy: padels.length >= 4 || (padels.length >= 3 && legsLike >= 2), sessions: padels.length, legsLike };
}

const mv = ex => ex.movement || ex.pattern;
const isPower = ex => ex.quality || mv(ex) === 'power';
const loaded = ex => ex.fields.includes('w') && ex.weightType !== 'bodyweight';
const MAIN = ['squat', 'hinge', 'single-leg', 'lateral'];
const byPri = (a, b) => (a.pri ?? 9) - (b.pri ?? 9);

// The Strength session from your leg workouts (their blocks, in order): two jumps, your two most
// important leg lifts, two short injury-prevention exercises. Main lifts come first in priority, so a
// short day keeps them; sets are capped so it stays around 40 minutes.
export function buildAnchor(sources = []) {
  const seen = new Set(), all = [];
  for (const blk of sources.flat()) { const ex = getExercise(blk.ex); if (ex && !seen.has(blk.ex)) { seen.add(blk.ex); all.push({ blk, ex }); } }
  const power = all.filter(x => isPower(x.ex)).sort((a, b) => byPri(a.blk, b.blk)).slice(0, 2);
  const isMain = x => !isPower(x.ex) && loaded(x.ex) && MAIN.includes(mv(x.ex));
  const main = all.filter(isMain).sort((a, b) => byPri(a.blk, b.blk)).slice(0, 2);
  const used = new Set([...power, ...main].map(x => x.blk.ex));
  const prev = all.filter(x => !used.has(x.blk.ex) && !isPower(x.ex) && !isMain(x)).sort((a, b) => byPri(a.blk, b.blk)).slice(0, 2);
  const cap = (x, n) => ({ ...x.blk, sets: Math.min(x.blk.sets || 3, n) });
  // Jumps: 3 sets of the first, 2 of the second (quality, not volume).
  const blocks = [...power.map((x, i) => ({ ...cap(x, i ? 2 : 3), pri: 3 + i })), ...main.map((x, i) => ({ ...cap(x, 3), pri: 1 + i })), ...prev.map((x, i) => ({ ...cap(x, 2), pri: 5 + i }))];
  return { id: ANCHOR_ID, title: 'Strength', minutes: 40, focus: 'Busy padel week: jumps and your main leg lifts, heavy with few sets.', blocks, derived: true };
}
