// Active-workout model: building one from a routine, and turning it into a saved session.
import { getExercise, targetField } from './domain-catalog.js';
import { resolveRoutine, prescribe } from './domain-program.js';
import { suggest, detectPRs, doneSets, lastPerformance } from './domain-progression.js';
import { prescriptionFor } from './domain-builder.js';

const uid = () => (globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function buildEntry(block, week, history, unit, light, now = Date.now()) {
  const ex = getExercise(block.ex);
  const rx = prescribe(block, week, { light });
  const fields = block.noLoad ? ex.fields.filter(f => f !== 'w') : ex.fields;
  const sug = suggest({ exId: ex.id, rx, history, unit, fields, now });
  return {
    exId: ex.id, name: ex.name, fields, perSide: ex.perSide, adaptedFrom: block.adaptedFrom,
    target: { sets: rx.sets, min: rx.min, max: rx.max, rest: rx.rest, rpe: rx.rpe },
    suggestion: sug, skipped: false,
    sets: Array.from({ length: rx.sets }, () => ({ w: null, reps: null, sec: null, m: null, rpe: null, done: false })),
  };
}

// `startedAt` in the past = logging a workout after the fact: suggestions only look at
// what came before that day, and there's no live clock.
export function createWorkout({ routineId, week, history, overrides, unit, readiness = null, light = false, profile = null, startedAt = null }) {
  const r = resolveRoutine(routineId, overrides, profile);
  const past = startedAt != null, ts = past ? startedAt : Date.now();
  const before = past ? history.filter(s => s.startedAt < ts) : history;
  return {
    id: uid(), kind: 'strength', routineId, title: r.title, week, startedAt: ts, index: 0, past, minutes: r.minutes || 60,
    readiness, light, exercises: r.blocks.map(blk => buildEntry(blk, week, before, unit, light, ts)),
  };
}

export function swapExercise(w, i, newExId, history, unit) {
  const old = w.exercises[i];
  const noLoad = !old.fields.includes('w') && getExercise(old.exId).fields.includes('w');
  const entry = buildEntry({ ex: newExId, sets: old.target.sets, min: old.target.min, max: old.target.max, rest: old.target.rest, noLoad: noLoad && getExercise(newExId).loadOptional }, w.week, w.past ? history.filter(s => s.startedAt < w.startedAt) : history, unit, false, w.startedAt);
  entry.target = { ...old.target };
  entry.sets = entry.sets.slice(0, old.target.sets);
  entry.swappedFrom = old.exId;
  w.exercises[i] = entry;
  return entry;
}

// Fill blanks on a set from the suggestion/previous set so one tap logs it.
export function autofill(entry, i) {
  const s = entry.sets[i], prev = entry.sets.slice(0, i).reverse().find(x => x.done);
  const tf = entry.fields[entry.fields.length - 1];
  if (entry.fields.includes('w') && s.w == null) s.w = prev?.w ?? entry.suggestion?.w ?? null;
  if (s[tf] == null) s[tf] = prev?.[tf] ?? entry.suggestion?.target ?? entry.target.min;
  return s;
}

export function workoutStats(w) {
  const sets = w.exercises.reduce((n, e) => n + doneSets(e).length, 0);
  const planned = w.exercises.reduce((n, e) => n + (e.skipped ? 0 : e.sets.length), 0);
  const volume = w.exercises.reduce((n, e) => n + doneSets(e).reduce((m, s) => m + (s.w || 0) * (s.reps || 0), 0), 0);
  return { sets, planned, volume, minutes: w.past ? w.minutes || 60 : Math.max(1, Math.round((Date.now() - w.startedAt) / 60000)) };
}

// Exercises you added yourself and never logged a set for are left out of the saved workout
// (usually added by mistake). Planned ones stay, marked as not done.
export const unusedAdded = w => w.exercises.filter(e => e.added && !doneSets(e).length);

export function finalizeWorkout(w, { rpe, notes, pain, durationMin }, history) {
  const unused = new Set(unusedAdded(w));
  const exercises = w.exercises.filter(e => !unused.has(e))
    .map(e => ({ exId: e.exId, name: e.name, fields: e.fields, perSide: e.perSide, target: e.target, skipped: e.skipped, swappedFrom: e.swappedFrom, note: e.note,
      // What the app suggested, so the weekly review can check how often it was right.
      suggested: e.suggestion ? { w: e.suggestion.w ?? null, target: e.suggestion.target ?? null, kind: e.suggestion.kind || null } : null,
      sets: e.sets.filter(s => s.done || s.w != null || s.reps != null || s.sec != null || s.m != null) }));
  const prs = [];
  for (const e of exercises) for (const p of detectPRs(e, history)) prs.push({ exId: e.exId, name: e.name, ...p });
  return {
    id: w.id, kind: 'strength', routineId: w.routineId, title: w.title, week: w.week,
    startedAt: w.startedAt, endedAt: w.past ? w.startedAt + (durationMin || workoutStats(w).minutes) * 60000 : Date.now(), durationMin: durationMin || workoutStats(w).minutes,
    rpe: rpe ?? null, notes: notes || '', pain: pain || { flag: false, location: '' },
    readiness: w.readiness, light: w.light, prs, exercises,
  };
}

export function createActivity({ activity, startedAt, durationMin, rpe, notes }) {
  return { id: uid(), kind: 'activity', activity, title: activity === 'padel' ? 'Padel' : activity[0].toUpperCase() + activity.slice(1), startedAt, endedAt: startedAt + durationMin * 60000, durationMin, rpe, notes: notes || '' };
}


// ── Supersets: two exercises done back to back, resting only after each pair.
export const partnerIndex = (w, i) => { const id = w.exercises[i]?.pair; return id ? w.exercises.findIndex((x, j) => j !== i && x.pair === id) : -1; };
export function pairExercises(w, i, j) { const id = `ss-${i}-${j}`; w.exercises[i].pair = id; w.exercises[j].pair = id; }
export function unpairExercise(w, i) { const j = partnerIndex(w, i); delete w.exercises[i].pair; if (j >= 0) delete w.exercises[j].pair; }
export const supersetPairs = w => [...new Set(w.exercises.map(x => x.pair).filter(Boolean))].map(id => w.exercises.filter(x => x.pair === id).map(x => x.exId));

// After logging a set on exercise i: where to go next and whether to rest.
export function afterSet(w, i) {
  const j = partnerIndex(w, i), e = w.exercises[i];
  const open = x => !x.skipped && x.sets.some(s => !s.done), n = x => x.sets.filter(s => s.done).length;
  if (j < 0 || !open(w.exercises[j])) return { index: i, rest: true, superset: false };
  if (n(w.exercises[j]) < n(e) || !open(e)) return { index: j, rest: !open(e) && n(w.exercises[j]) >= n(e), superset: true };
  const first = Math.min(i, j), second = Math.max(i, j);
  return { index: open(w.exercises[first]) ? first : second, rest: true, superset: true };
}

// Re-apply pairs you made last time for this workout (matched by exercise).
export function applySupersets(w, pairs = []) {
  for (const [a, b] of pairs) {
    const i = w.exercises.findIndex(x => x.exId === a), j = w.exercises.findIndex(x => x.exId === b);
    if (i >= 0 && j >= 0 && !w.exercises[i].pair && !w.exercises[j].pair) pairExercises(w, i, j);
  }
  return w;
}

// ── Quick workouts and adding exercises on the fly.
// A quick workout has no plan: you add exercises as you go (or log a past one the same way).
export function createQuickWorkout({ week = 1, startedAt = null, title = 'Quick workout' } = {}) {
  const past = startedAt != null;
  return { id: uid(), kind: 'strength', routineId: null, quick: true, title, week, startedAt: past ? startedAt : Date.now(), index: 0, past, minutes: 45, readiness: null, light: false, exercises: [] };
}

// Insert an exercise with sensible sets and reps for it (the program builder's defaults) and a
// weight suggestion from your history before this workout. Returns its index.
export function addExercise(w, exId, history, unit = 'kg', at = w.exercises.length) {
  const ex = getExercise(exId);
  if (!ex) return -1;
  const before = w.past ? history.filter(s => s.startedAt < w.startedAt) : history;
  const entry = buildEntry({ ex: exId, ...prescriptionFor(ex) }, w.week, before, unit, false, w.startedAt);
  entry.added = true;
  w.exercises.splice(Math.max(0, Math.min(at, w.exercises.length)), 0, entry);
  return w.exercises.indexOf(entry);
}

// Take an exercise out of a workout in progress (a superset partner goes back to solo).
export function removeExercise(w, i) {
  if (!w.exercises[i]) return null;
  unpairExercise(w, i);
  const [gone] = w.exercises.splice(i, 1);
  if (i < w.index) w.index--;
  w.index = Math.max(0, Math.min(w.index, w.exercises.length - 1));
  return gone;
}

// A blank exercise to add to a saved workout when editing it afterwards.
export function savedEntry(exId) {
  const ex = getExercise(exId);
  if (!ex) return null;
  const rx = prescriptionFor(ex);
  return { exId, name: ex.name, fields: ex.fields, perSide: ex.perSide, target: { sets: rx.sets, min: rx.min, max: rx.max, rest: rx.rest }, skipped: false, added: true,
    sets: [{ w: null, reps: null, sec: null, m: null, rpe: null, done: true }] };
}

// Move an exercise earlier or later in today's workout; the one you're on stays selected.
export function moveExercise(w, from, to) {
  if (to < 0 || to >= w.exercises.length || from === to) return false;
  const cur = w.exercises[w.index], [e] = w.exercises.splice(from, 1);
  w.exercises.splice(to, 0, e); w.index = w.exercises.indexOf(cur);
  return true;
}

// An exercise that loads a sore area doesn't go heavier: same top weight as last time.
// `areas` are plain names for the message (e.g. "elbow"). Returns true when it changed.
export function holdForPain(entry, history, areas) {
  const s = entry.suggestion;
  if (!areas?.length || s?.kind !== 'up') return false;
  const last = lastPerformance(history, entry.exId), top = last ? Math.max(0, ...doneSets(last.entry).map(x => x.w || 0)) : 0;
  if (!top) return false;
  entry.suggestion = { ...s, w: top, kind: 'hold', reason: `Same weight as last time while your ${areas.join(' and ')} settles.`, painHold: true };
  return true;
}
