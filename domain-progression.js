// Double-progression engine. Pure functions over session history (newest first).
// Rule: work inside a rep range; once every working set reaches the top of the range
// at an acceptable effort, add the smallest load increment and restart at the bottom.
import { getExercise, hasLoad, targetField } from './domain-catalog.js';
import { roundLoad } from './domain-units.js';

export const doneSets = entry => (entry?.sets || []).filter(s => s.done);

// e1RM by Epley; only meaningful for sets of ≤12 reps.
export const e1rm = (w, reps) => (w > 0 && reps > 0 && reps <= 12) ? Math.round(w * (1 + reps / 30) * 10) / 10 : null;
// Inverse Epley with reps in reserve: the load you could lift for `reps` with `rir` left in the tank.
export const loadFor = (max, reps, rir = 2) => max > 0 ? max / (1 + Math.min(15, reps + rir) / 30) : null;
export const bestE1rm = entry => Math.max(0, ...doneSets(entry).map(s => e1rm(s.w, s.reps) || 0)) || null;
const DAY = 86400000;

// Most recent performances of an exercise. Deload weeks are skipped as a progression
// baseline unless nothing else exists.
export function performances(history, exId, n = 2) {
  const all = [];
  for (const s of history) {
    if (s.kind !== 'strength') continue;
    const entry = s.exercises?.find(e => e.exId === exId && doneSets(e).length);
    if (entry) all.push({ session: s, entry });
  }
  const normal = all.filter(p => p.session.week !== 4);
  return (normal.length ? normal : all).slice(0, n);
}

export function lastPerformance(history, exId) { return performances(history, exId, 1)[0] || null; }

function topLoadSets(entry) {
  const sets = doneSets(entry).filter(s => s.w > 0);
  if (!sets.length) return { top: null, sets: [] };
  const top = Math.max(...sets.map(s => s.w));
  return { top, sets: sets.filter(s => s.w === top) };
}

// Returns { w, target, reason, kind } where kind ∈ up|hold|down|first|quality|cap.
// fields: the fields actually logged (home workouts may drop the load column).
export function suggest({ exId, rx, history, unit = 'kg', fields = null, now = Date.now() }) {
  const ex = getExercise(exId);
  const tf = targetField(ex);
  const loaded = (fields || ex.fields).includes('w');
  const [last, prev] = performances(history, exId, 2);
  const deload = rx.loadMult < 1;
  const scale = w => w == null ? null : deload ? roundLoad(w * rx.loadMult, ex.inc, unit) : w;

  if (!last && ex.startW != null && loaded) {
    const w = rx.loadMult < 1 ? roundLoad(ex.startW * rx.loadMult, ex.inc, unit) : ex.startW;
    return { w, target: ex.startTarget ?? rx.min, reason: 'Starting weight from your imported plan.', kind: 'first' };
  }
  if (!last) {
    const reason = loaded
      ? tf === 'reps' ? `First time: choose a load you could lift for about ${rx.min + rx.rir} reps.` : `First time: choose a load you can comfortably ${tf === 'm' ? 'carry' : 'hold'} for ${rx.min}${tf === 'm' ? 'm' : 's'}.`
      : `First time: aim for ${rx.min}${tf === 'sec' ? 's' : tf === 'm' ? 'm' : ' reps'} with clean form.`;
    return { w: null, target: rx.min, reason, kind: 'first' };
  }

  const vals = doneSets(last.entry).map(s => s[tf] || 0);
  const hiRpe = doneSets(last.entry).some(s => s.rpe >= 9.5);

  if (ex.quality) {
    const { top } = topLoadSets(last.entry);
    return { w: scale(top), target: rx.max, reason: 'Power work: match last time and keep every rep fast and crisp.', kind: 'quality' };
  }

  if (!loaded) {
    const allTop = vals.length && vals.every(v => v >= rx.max);
    if (allTop) return { w: null, target: rx.max, reason: 'Top of the range last time — make it harder (slower tempo, pause, or a harder variation).', kind: 'cap' };
    const step = tf === 'sec' ? 5 : tf === 'm' ? 5 : 1;
    return { w: null, target: Math.min(rx.max, Math.min(...vals) + step), reason: `Beat last time: ${vals.join(', ')}${tf === 'sec' ? 's' : tf === 'm' ? 'm' : ''}.`, kind: 'hold' };
  }

  const { top, sets: atTop } = topLoadSets(last.entry);
  if (top == null) return { w: null, target: rx.min, reason: 'No load recorded last time — pick a working weight.', kind: 'first' };
  const topVals = atTop.map(s => s[tf] || 0);
  const plannedSets = last.entry.target?.sets || atTop.length;
  const hitTop = atTop.length >= Math.min(plannedSets, rx.sets) && topVals.every(v => v >= rx.max) && !hiRpe;
  const missed = e => { const v = doneSets(e).map(s => s[tf] || 0); return v.filter(x => x < rx.min).length > v.length / 2; };

  let res;
  if (hitTop) res = { w: top + ex.inc, target: rx.min, reason: `Hit ${rx.max} on every set last time → add ${ex.inc}kg.`, kind: 'up' };
  else if (missed(last.entry) && prev && missed(prev.entry)) res = { w: Math.max(0, top - ex.inc), target: rx.min, reason: 'Missed the rep floor twice in a row → back off one step and rebuild.', kind: 'down' };
  else if (missed(last.entry)) res = { w: top, target: rx.min, reason: 'Missed the rep floor last time → repeat the load.', kind: 'hold' };
  else res = { w: top, target: Math.min(rx.max, Math.min(...topVals) + 1), reason: `Same load, add a rep where you can (last: ${topVals.join(', ')}).`, kind: 'hold' };

  // Rep range changed since last time (e.g. sets of 5 → sets of 10): convert through your estimated max.
  const was = last.entry.target;
  if (tf === 'reps' && was?.min && (was.min !== rx.min || was.max !== rx.max)) {
    const w = loadFor(bestE1rm(last.entry), rx.min, rx.rir ?? 2);
    if (w > 0) res = { w, target: rx.min, reason: `New rep range (${was.min}–${was.max} → ${rx.min}–${rx.max}), so the weight is worked out from your estimated max.`, kind: 'retarget' };
  }
  // Long break: strength holds for ~3 weeks, then eases off. Come back a little lighter.
  const gap = (now - last.session.startedAt) / DAY;
  if (gap >= 21 && ['up', 'hold', 'retarget'].includes(res.kind)) {
    const cut = gap >= 42 ? 0.1 : 0.05;
    res = { w: res.w * (1 - cut), target: rx.min, reason: `First time in ${Math.round(gap / 7)} weeks → about ${cut * 100}% lighter to ease back in.`, kind: 'return' };
  }

  if (deload) { res.w = scale(res.w); res.reason = `Deload week: ~${Math.round((1 - rx.loadMult) * 100)}% lighter. ` + res.reason.split('→')[0].trim(); res.kind = 'deload'; }
  else res.w = roundLoad(res.w, ex.inc, unit);
  return res;
}

// Personal records set by `entry` compared with everything in `history` before it.
export function detectPRs(entry, history) {
  const ex = getExercise(entry.exId);
  if (!ex) return [];
  const prior = [];
  for (const s of history) if (s.kind === 'strength') for (const e of s.exercises || []) if (e.exId === entry.exId) prior.push(...doneSets(e));
  if (!prior.length) return [];
  const now = doneSets(entry);
  const prs = [];
  if (hasLoad(ex) && ex.fields.includes('reps')) {
    const best = Math.max(0, ...prior.map(s => e1rm(s.w, s.reps) || 0));
    const mine = Math.max(0, ...now.map(s => e1rm(s.w, s.reps) || 0));
    if (mine > best) prs.push({ type: 'e1RM', value: mine });
  }
  if (hasLoad(ex)) {
    const best = Math.max(0, ...prior.map(s => s.w || 0));
    const mine = Math.max(0, ...now.map(s => s.w || 0));
    if (mine > best) prs.push({ type: 'Heaviest', value: mine });
  } else {
    const tf = targetField(ex);
    const best = Math.max(0, ...prior.map(s => s[tf] || 0));
    const mine = Math.max(0, ...now.map(s => s[tf] || 0));
    if (mine > best) prs.push({ type: tf === 'sec' ? 'Longest' : tf === 'm' ? 'Farthest' : 'Most reps', value: mine });
  }
  return prs;
}

// Records are relative to everything before a session, so changing one session can change
// the records of later ones. Returns only the sessions whose records changed.
export function recomputePRs(sessions) {
  const prior = [], changed = [];
  for (const s of sessions.filter(x => x.kind === 'strength').sort((a, b) => a.startedAt - b.startedAt)) {
    const prs = [];
    for (const e of s.exercises || []) for (const p of detectPRs(e, prior)) prs.push({ exId: e.exId, name: e.name, ...p });
    if (JSON.stringify(prs) !== JSON.stringify(s.prs || [])) changed.push({ ...s, prs });
    prior.push(s);
  }
  return changed;
}

// A weight far above anything you've lifted on this exercise is probably a typo (600 for 60).
export function heaviest(history, exId) {
  let best = 0;
  for (const s of history) if (s.kind === 'strength') for (const e of s.exercises || []) if (e.exId === exId) for (const x of doneSets(e)) best = Math.max(best, x.w || 0);
  return best;
}
export const looksOff = (w, best) => best > 0 && w > Math.max(best * 1.6, best + 20);
