// Which muscles did the work. One completed set counts 1 for each main muscle and
// 0.5 for each secondary muscle. Pure functions over saved sessions.
import { getExercise } from './domain-catalog.js';
import { doneSets } from './domain-progression.js';
import { MUSCLES, LEGACY_MUSCLES, normalize } from './domain-taxonomy.js';
import { mondayOf, isoDate } from './domain-calendar.js';

export const SECONDARY_WEIGHT = 0.5;
const DAY = 86400000;
const add = (map, k, v) => { map[k] = (map[k] || 0) + v; };
const round = v => Math.round(v * 2) / 2;

// { muscleId: sets } for one strength session.
export function sessionMuscles(session) {
  const out = {};
  if (session?.kind !== 'strength') return out;
  for (const e of session.exercises || []) {
    const ex = getExercise(e.exId), n = doneSets(e).length;
    if (!ex || !n) continue;
    for (const m of ex.primary || []) add(out, m, n);
    for (const m of ex.secondary || []) if (!(ex.primary || []).includes(m)) add(out, m, n * SECONDARY_WEIGHT);
  }
  for (const k of Object.keys(out)) out[k] = round(out[k]);
  return out;
}

export function musclesBetween(sessions, from, to) {
  const out = {};
  for (const s of sessions) if (s.startedAt >= from && s.startedAt < to) for (const [m, v] of Object.entries(sessionMuscles(s))) add(out, m, v);
  for (const k of Object.keys(out)) out[k] = round(out[k]);
  return out;
}
export const lastDays = (sessions, days = 7, now = Date.now()) => musclesBetween(sessions, now - days * DAY, now + 1);

// Calendar weeks (Mon–Sun), oldest first: [{ start, iso, map }]
export function weeklyMuscles(sessions, weeks = 8, now = new Date()) {
  const mon = mondayOf(now);
  return Array.from({ length: weeks }, (_, i) => {
    const s = new Date(mon); s.setDate(s.getDate() - (weeks - 1 - i) * 7);
    const e = new Date(s); e.setDate(e.getDate() + 7);
    return { start: s, iso: isoDate(s), map: musclesBetween(sessions, s.getTime(), e.getTime()) };
  });
}

// Sorted list for display: [{ id, label, sets }]
export const ranked = map => Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, sets]) => ({ id, label: MUSCLES[id] || id, sets }));

// Rough weekly guidance. ~10–20 hard sets per muscle per week is a common range for
// building strength; fewer usually maintains it. Small muscles need less.
export const SMALL = new Set(['front_delts', 'side_delts', 'rear_delts', 'rotator_cuff', 'serratus', 'upper_chest', 'lower_chest', 'traps', 'biceps', 'triceps', 'forearms',
  'obliques', 'hip_flexors', 'glute_med', 'calves', 'soleus', 'shins']);
export function weeklyStatus(muscle, sets) {
  const [lo, hi] = SMALL.has(muscle) ? [6, 16] : [10, 20];
  if (!sets) return { key: 'none', label: 'Not trained' };
  if (sets < lo / 2.5) return { key: 'light', label: 'Light' };
  if (sets < lo) return { key: 'maintain', label: 'Maintaining' };
  if (sets <= hi) return { key: 'build', label: 'Building' };
  return { key: 'high', label: 'Very high' };
}

// Exercises that trained a muscle recently: [{ exId, name, sets, ts }]
export function exercisesFor(sessions, muscle, since) {
  const out = new Map();
  for (const s of sessions) {
    if (s.kind !== 'strength' || s.startedAt < since) continue;
    for (const e of s.exercises || []) {
      const ex = getExercise(e.exId), n = doneSets(e).length;
      if (!ex || !n) continue;
      const w = (ex.primary || []).includes(muscle) ? 1 : (ex.secondary || []).includes(muscle) ? SECONDARY_WEIGHT : 0;
      if (!w) continue;
      const cur = out.get(ex.id) || { exId: ex.id, name: ex.name, sets: 0, ts: 0 };
      cur.sets = round(cur.sets + n * w); cur.ts = Math.max(cur.ts, s.startedAt);
      out.set(ex.id, cur);
    }
  }
  return [...out.values()].sort((a, b) => b.sets - a.sets);
}

// ── Converting data saved before the finer muscle split (old ids: shoulders, upper_back, arms, core).
// For an exercise, each old id becomes the most likely finer group given what the exercise is.
const has = (n, ...ks) => ks.some(k => n.includes(k));
export function upgradeMuscle(m, ex = {}) {
  if (MUSCLES[m]) return [m];
  const n = String(ex.name || '').toLowerCase(), mv = ex.movement;
  if (m === 'shoulders') return [has(n, 'lateral raise', 'upright') ? 'side_delts' : has(n, 'face pull', 'reverse fly', 'pull-apart', 'rear') || mv === 'pull' ? 'rear_delts' : 'front_delts'];
  if (m === 'upper_back') return [has(n, 'shrug', 'deadlift', 'carry', 'upright') ? 'traps' : 'mid_back'];
  if (m === 'arms') return [has(n, 'curl', 'chin') ? 'biceps' : has(n, 'tricep', 'pushdown', 'skull', 'kickback', 'dip', 'extension') || mv === 'push' ? 'triceps' : 'biceps'];
  if (m === 'core') return ['abs'];
  const r = normalize('muscle', m);
  return r?.id ? [r.id] : [];
}
export function upgradeExercise(ex) {
  const up = list => [...new Set((list || []).flatMap(m => upgradeMuscle(m, ex)))];
  const primary = up(ex.primary), secondary = up(ex.secondary).filter(m => !primary.includes(m));
  const changed = JSON.stringify([primary, secondary]) !== JSON.stringify([ex.primary || [], ex.secondary || []]);
  return changed ? { ...ex, primary, secondary, muscles: ex.custom ? primary.map(m => MUSCLES[m]).join(' · ') : ex.muscles } : ex;
}
// Upgrades your own exercises, your edits to library exercises, and recovery tuning.
// Safe to run any number of times: only old ids are touched. Returns the keys that changed.
export function upgradeSaved(st) {
  const changed = [];
  const own = Object.fromEntries(Object.entries(st.customExercises || {}).map(([k, e]) => [k, upgradeExercise(e)]));
  if (JSON.stringify(own) !== JSON.stringify(st.customExercises || {})) { st.customExercises = own; changed.push('customExercises'); }
  const eds = Object.fromEntries(Object.entries(st.exerciseEdits || {}).map(([k, e]) => [k, e.primary || e.secondary ? upgradeExercise({ ...e, movement: e.movement }) : e]));
  if (JSON.stringify(eds) !== JSON.stringify(st.exerciseEdits || {})) { st.exerciseEdits = eds; changed.push('exerciseEdits'); }
  const cal = { ...(st.recoveryCal || {}) };
  let calChanged = false;
  for (const [old, news] of Object.entries(LEGACY_MUSCLES)) if (old in cal) { for (const m of news) if (!(m in cal)) cal[m] = cal[old]; delete cal[old]; calChanged = true; }
  // The finer split also added soleus (from calves) and glute med (from glutes): carry the tuning over once.
  if (calChanged) { if (cal.calves && !cal.soleus) cal.soleus = cal.calves; if (cal.glutes && !cal.glute_med) cal.glute_med = cal.glutes; if (cal.chest) { cal.upper_chest ??= cal.chest; cal.lower_chest ??= cal.chest; } }
  if (calChanged) { st.recoveryCal = cal; changed.push('recoveryCal'); }
  return changed;
}
