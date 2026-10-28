// Pain-aware training: which areas hurt recently, which exercises load them, and a gentler
// alternative. Suggestions only: nothing is blocked, and none of this is medical advice.
import { getExercise, allExercises } from './domain-catalog.js';
import { canDoWith } from './domain-taxonomy.js';
import { AREAS } from './domain-personalize.js';

const DAY = 86400000;
export const PAIN_DAYS = 14;        // workout pain counts for two weeks
const PADEL_DAYS = 21, PADEL_TIMES = 2;   // padel soreness counts once it repeats (same rule as prehab)

// Older workouts only have a free-text location ("left shoulder"); read areas out of it.
const WORDS = { shoulder: /shoulder|rotator/i, elbow: /elbow|forearm|wrist|tennis|golf/i, back: /back|spine|lumbar/i, knee: /knee|patell/i, calf: /calf|achilles|soleus/i, ankle: /ankle|foot|feet/i };
export const areasFromText = text => Object.keys(WORDS).filter(a => WORDS[a].test(text || ''));
export const painAreasOf = s => s.pain?.flag ? [...new Set([...(s.pain.areas || []), ...areasFromText(s.pain.location)])] : [];

// { area: { ts, from: 'workout' | 'padel' } } for areas that hurt recently and that you
// haven't since marked as fine (`cleared`: { area: ts }).
export function recentPain(sessions, { now = Date.now(), cleared = {} } = {}) {
  const out = {}, seen = (a, ts, from) => { if (ts > (cleared[a] || 0) && (!out[a] || out[a].ts < ts)) out[a] = { ts, from }; };
  const padel = {};
  for (const s of sessions) {
    const age = now - s.startedAt;
    if (age < 0) continue;
    if (age <= PAIN_DAYS * DAY) for (const a of painAreasOf(s)) seen(a, s.startedAt, 'workout');
    if (age <= PADEL_DAYS * DAY) for (const a of s.padel?.sore || []) if (s.startedAt > (cleared[a] || 0)) (padel[a] ||= []).push(s.startedAt);
  }
  for (const [a, ts] of Object.entries(padel)) if (ts.length >= PADEL_TIMES) seen(a, Math.max(...ts), 'padel');
  return out;
}

// Areas an exercise puts real load through. Prevention and mobility work is left out on
// purpose: that's usually the gentle work that helps.
export function loadsAreas(ex) {
  if (!ex || ['prevention', 'mobility'].includes(ex.category)) return [];
  const mv = ex.movement || ex.pattern, prim = ex.primary || [], all = [...prim, ...(ex.secondary || [])];
  const has = (list, ...m) => m.some(x => list.includes(x));
  const out = new Set();
  const press = mv === 'push' || mv === 'press', pull = mv === 'pull';
  const throwing = ['power', 'rotation'].includes(mv) && has(all, 'shoulders') && !has(prim, 'quads', 'calves');
  const jump = mv === 'power' && has(all, 'quads', 'calves', 'adductors') && !throwing;
  if (press || throwing) out.add('shoulder');
  if (press || pull || mv === 'carry' || has(prim, 'forearms')) out.add('elbow');
  if ((mv === 'hinge' && has(all, 'lower_back')) || mv === 'carry' || (throwing && has(prim, 'obliques'))) out.add('back');
  if (['squat', 'single-leg', 'lateral'].includes(mv) || jump) out.add('knee');
  if (jump) { out.add('calf'); out.add('ankle'); }
  if (mv === 'lateral') out.add('ankle');
  return [...out];
}

// Which of your sore areas this exercise loads.
export const painHits = (exId, pain) => loadsAreas(getExercise(exId)).filter(a => pain[a]);

// A gentler swap: listed substitutes first, then the same category, preferring the same
// movement and equipment you have here. Null when nothing avoids the area.
export function gentlerFor(exId, pain, owned = null, exclude = []) {
  const ex = getExercise(exId);
  if (!ex) return null;
  const pool = [...ex.subs, ...allExercises().filter(x => x.category === ex.category).sort((a, b) => (b.movement === ex.movement) - (a.movement === ex.movement)).map(x => x.id)];
  const ok = id => { const x = getExercise(id); return x && id !== exId && !exclude.includes(id) && !loadsAreas(x).some(a => pain[a]); };
  const ids = [...new Set(pool)].filter(ok);
  return (owned ? ids.find(id => canDoWith(getExercise(id).needs || [], owned)) : null) || ids[0] || null;
}

export const areaName = a => (AREAS[a] || a).split(' /')[0];
