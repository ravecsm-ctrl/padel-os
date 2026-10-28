// Aggregations for history and progress views. Pure; history is newest-first.
import { getExercise, hasLoad, targetField } from './domain-catalog.js';
import { doneSets, e1rm } from './domain-progression.js';
import { mondayOf, isoDate, daysBetween } from './domain-calendar.js';

export const setCount = s => (s.exercises || []).reduce((n, e) => n + doneSets(e).length, 0);
export const volumeKg = s => (s.exercises || []).reduce((n, e) => n + doneSets(e).reduce((m, x) => m + (x.w > 0 && x.reps > 0 ? x.w * x.reps : 0), 0), 0);
// Session-RPE load (Foster): minutes × session RPE, in arbitrary units.
// Guided routines (stretching, mobility, warm-ups, prevention) are logged too, but they are
// light work: they shouldn't count as training sessions or keep a streak alive on their own.
export const isRoutineLog = s => s.kind === 'activity' && !!s.routine;
export const sessionLoad = s => (s.durationMin > 0 && s.rpe > 0) ? Math.round(s.durationMin * s.rpe) : 0;

export function weeklySeries(history, weeks = 8, now = new Date()) {
  const thisMon = mondayOf(now);
  const out = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisMon); d.setDate(d.getDate() - (weeks - 1 - i) * 7);
    return { start: d, iso: isoDate(d), gym: 0, padel: 0, other: 0, sessions: 0, sets: 0, volume: 0 };
  });
  for (const s of history) {
    const idx = weeks - 1 - Math.floor(daysBetween(mondayOf(new Date(s.startedAt)), thisMon) / 7);
    if (idx < 0 || idx >= weeks) continue;
    const w = out[idx], load = sessionLoad(s);
    if (!isRoutineLog(s)) w.sessions++;
    if (s.kind === 'strength') { w.gym += load; w.sets += setCount(s); w.volume += volumeKg(s); }
    else if (s.activity === 'padel') w.padel += load;
    else w.other += load;
  }
  return out;
}

// This week's load vs the average of the previous four weeks. A rough heuristic only.
export function loadTrend(series) {
  const cur = series[series.length - 1];
  const prev = series.slice(-5, -1);
  const total = w => w.gym + w.padel + w.other;
  const avg = prev.reduce((n, w) => n + total(w), 0) / (prev.length || 1);
  return { current: total(cur), avg: Math.round(avg), ratio: avg > 0 ? Math.round((total(cur) / avg) * 100) / 100 : null };
}

export function trainingDays(history) {
  const m = new Map();
  for (const s of history) { const k = isoDate(new Date(s.startedAt)); m.set(k, [...(m.get(k) || []), s.kind === 'strength' ? 'gym' : s.activity || 'other']); }
  return m;
}

// Consecutive weeks (ending this week or last) with at least one session.
export function weekStreak(history, now = new Date()) {
  const weeks = new Set(history.filter(s => !isRoutineLog(s)).map(s => isoDate(mondayOf(new Date(s.startedAt)))));
  const m = mondayOf(now);
  if (!weeks.has(isoDate(m))) m.setDate(m.getDate() - 7);
  let n = 0;
  while (weeks.has(isoDate(m))) { n++; m.setDate(m.getDate() - 7); }
  return n;
}

export function exerciseSeries(history, exId) {
  const ex = getExercise(exId);
  const tf = targetField(ex);
  const pts = [];
  for (const s of history) {
    if (s.kind !== 'strength') continue;
    for (const e of s.exercises || []) {
      if (e.exId !== exId) continue;
      const sets = doneSets(e);
      if (!sets.length) continue;
      const topW = hasLoad(ex) ? Math.max(0, ...sets.map(x => x.w || 0)) : null;
      const best = Math.max(0, ...sets.map(x => e1rm(x.w, x.reps) || 0)) || null;
      pts.push({ ts: s.startedAt, sessionId: s.id, week: s.week, sets, topW, e1rm: best, topVal: Math.max(0, ...sets.map(x => x[tf] || 0)), volume: sets.reduce((n, x) => n + (x.w || 0) * (x.reps || 0), 0) });
    }
  }
  return pts.reverse();
}

// The metric that best represents progress for this exercise.
export function progressMetric(ex) {
  if (hasLoad(ex) && ex.fields.includes('reps') && !ex.quality) return { key: 'e1rm', label: 'Estimated 1RM', load: true };
  if (hasLoad(ex)) return { key: 'topW', label: 'Top load', load: true };
  const tf = targetField(ex);
  return { key: 'topVal', label: tf === 'sec' ? 'Longest hold (s)' : tf === 'm' ? 'Longest carry (m)' : 'Best reps', load: false };
}

export function exerciseSummaries(history) {
  const ids = new Set();
  for (const s of history) if (s.kind === 'strength') for (const e of s.exercises || []) if (doneSets(e).length) ids.add(e.exId);
  return [...ids].filter(getExercise).map(id => {
    const ex = getExercise(id), m = progressMetric(ex), pts = exerciseSeries(history, id);
    const vals = pts.map(p => p[m.key]).filter(v => v != null);
    const first = vals[0], last = vals[vals.length - 1];
    return { id, ex, metric: m, pts, best: vals.length ? Math.max(...vals) : null, last, change: vals.length > 1 && first ? Math.round(((last - first) / first) * 100) : null, lastTs: pts.length ? pts[pts.length - 1].ts : 0 };
  }).sort((a, b) => b.lastTs - a.lastTs);
}
