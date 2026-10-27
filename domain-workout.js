// Active-workout model: building one from a routine, and turning it into a saved session.
import { getExercise, targetField } from './domain-catalog.js';
import { resolveRoutine, prescribe } from './domain-program.js';
import { suggest, detectPRs, doneSets } from './domain-progression.js';

const uid = () => (globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function buildEntry(block, week, history, unit, light) {
  const ex = getExercise(block.ex);
  const rx = prescribe(block, week, { light });
  const sug = suggest({ exId: ex.id, rx, history, unit });
  return {
    exId: ex.id, name: ex.name, fields: ex.fields, perSide: ex.perSide,
    target: { sets: rx.sets, min: rx.min, max: rx.max, rest: rx.rest, rpe: rx.rpe },
    suggestion: sug, skipped: false,
    sets: Array.from({ length: rx.sets }, () => ({ w: null, reps: null, sec: null, m: null, rpe: null, done: false })),
  };
}

export function createWorkout({ routineId, week, history, overrides, unit, readiness = null, light = false }) {
  const r = resolveRoutine(routineId, overrides);
  return {
    id: uid(), kind: 'strength', routineId, title: r.title, week, startedAt: Date.now(), index: 0,
    readiness, light, exercises: r.blocks.map(blk => buildEntry(blk, week, history, unit, light)),
  };
}

export function swapExercise(w, i, newExId, history, unit) {
  const old = w.exercises[i];
  const entry = buildEntry({ ex: newExId, sets: old.target.sets, min: old.target.min, max: old.target.max, rest: old.target.rest }, w.week, history, unit, false);
  entry.target = { ...old.target };
  entry.sets = entry.sets.slice(0, old.target.sets);
  entry.swappedFrom = old.exId;
  w.exercises[i] = entry;
  return entry;
}

// Fill blanks on a set from the suggestion/previous set so one tap logs it.
export function autofill(entry, i) {
  const s = entry.sets[i], prev = entry.sets.slice(0, i).reverse().find(x => x.done);
  const tf = targetField(getExercise(entry.exId));
  if (entry.fields.includes('w') && s.w == null) s.w = prev?.w ?? entry.suggestion?.w ?? null;
  if (s[tf] == null) s[tf] = prev?.[tf] ?? entry.suggestion?.target ?? entry.target.min;
  return s;
}

export function workoutStats(w) {
  const sets = w.exercises.reduce((n, e) => n + doneSets(e).length, 0);
  const planned = w.exercises.reduce((n, e) => n + (e.skipped ? 0 : e.sets.length), 0);
  const volume = w.exercises.reduce((n, e) => n + doneSets(e).reduce((m, s) => m + (s.w || 0) * (s.reps || 0), 0), 0);
  return { sets, planned, volume, minutes: Math.max(1, Math.round((Date.now() - w.startedAt) / 60000)) };
}

export function finalizeWorkout(w, { rpe, notes, pain, durationMin }, history) {
  const exercises = w.exercises
    .map(e => ({ exId: e.exId, name: e.name, fields: e.fields, perSide: e.perSide, target: e.target, skipped: e.skipped, swappedFrom: e.swappedFrom, note: e.note,
      sets: e.sets.filter(s => s.done || s.w != null || s.reps != null || s.sec != null || s.m != null) }));
  const prs = [];
  for (const e of exercises) for (const p of detectPRs(e, history)) prs.push({ exId: e.exId, name: e.name, ...p });
  return {
    id: w.id, kind: 'strength', routineId: w.routineId, title: w.title, week: w.week,
    startedAt: w.startedAt, endedAt: Date.now(), durationMin: durationMin || workoutStats(w).minutes,
    rpe: rpe ?? null, notes: notes || '', pain: pain || { flag: false, location: '' },
    readiness: w.readiness, light: w.light, prs, exercises,
  };
}

export function createActivity({ activity, startedAt, durationMin, rpe, notes }) {
  return { id: uid(), kind: 'activity', activity, title: activity === 'padel' ? 'Padel' : activity[0].toUpperCase() + activity.slice(1), startedAt, endedAt: startedAt + durationMin * 60000, durationMin, rpe, notes: notes || '' };
}

