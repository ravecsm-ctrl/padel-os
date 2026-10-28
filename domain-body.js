// Body log: weight, body fat and waist over time. Daily weight swings 1–2 kg with water and
// food, so the app shows a smoothed trend, not the raw ups and downs. Weight is stored in kg.
import { getExercise } from './domain-catalog.js';
import { doneSets, e1rm } from './domain-progression.js';

const DAY = 86400000, WEEK = 7 * DAY;

// One entry per day: logging again on the same date replaces it. Oldest first.
export function upsertEntry(log, entry) {
  const clean = Object.fromEntries(Object.entries(entry).filter(([, v]) => v != null && v !== '' && !Number.isNaN(v)));
  const rest = log.filter(e => e.date !== entry.date);
  return [...rest, clean].sort((a, b) => a.date.localeCompare(b.date));
}

const tsOf = e => new Date(`${e.date}T08:00`).getTime();

// Time-aware moving average: each new reading moves the trend by how much time has passed
// (a reading a week after the last counts for ~63%, the next morning for ~13%).
export function trend(log, key = 'kg', { days = 7 } = {}) {
  const pts = [];
  let t = null, last = null;
  for (const e of log) {
    if (e[key] == null) continue;
    const x = tsOf(e);
    t = t == null ? e[key] : t + (1 - Math.exp(-(x - last) / (days * DAY))) * (e[key] - t);
    last = x;
    pts.push({ x, y: Math.round(t * 100) / 100, raw: e[key] });
  }
  return pts;
}

// Trend now vs about `days` ago: { now, then, diff, perWeek }, or null without enough data.
export function change(log, key = 'kg', { days = 28, now = Date.now() } = {}) {
  const pts = trend(log, key);
  if (pts.length < 2) return null;
  const cur = pts[pts.length - 1];
  const past = [...pts].reverse().find(p => p.x <= now - days * DAY) || pts[0];
  if (past === cur) return null;
  const weeks = Math.max(1, (cur.x - past.x) / WEEK);
  const diff = Math.round((cur.y - past.y) * 10) / 10;
  return { now: cur.y, then: past.y, diff, perWeek: Math.round(diff / weeks * 100) / 100, since: past.x };
}

export const latest = (log, key) => [...log].reverse().find(e => e[key] != null) || null;
export const leanMass = (kg, bf) => kg && bf ? Math.round(kg * (1 - bf / 100) * 10) / 10 : null;

// Strength relative to body weight for your main barbell-style lifts (total loads only:
// per-hand dumbbell numbers would be misleading). Best estimated max over the last 8 weeks.
export function relativeStrength(history, bodyKg, { n = 3, now = Date.now() } = {}) {
  if (!bodyKg) return [];
  const best = new Map(), count = new Map();
  for (const s of history) {
    if (s.kind !== 'strength' || s.startedAt < now - 8 * WEEK) continue;
    for (const e of s.exercises || []) {
      const ex = getExercise(e.exId);
      if (!ex || !['lower-strength', 'upper-strength'].includes(ex.category) || ex.weightType !== 'total' || !ex.fields.includes('w')) continue;
      const top = Math.max(0, ...doneSets(e).map(x => e1rm(x.w, x.reps) || 0));
      if (!top) continue;
      best.set(ex.id, Math.max(best.get(ex.id) || 0, top)); count.set(ex.id, (count.get(ex.id) || 0) + 1);
    }
  }
  return [...best.entries()].sort((a, b) => count.get(b[0]) - count.get(a[0])).slice(0, n)
    .map(([id, max]) => ({ exId: id, name: getExercise(id).name, max, ratio: Math.round(max / bodyKg * 100) / 100 }));
}
