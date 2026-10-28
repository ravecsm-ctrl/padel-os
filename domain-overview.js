// Overview data: a month calendar (done / planned / missed), lift projections with
// honest ranges, level ETA and a "train more often" what-if. Pure functions.
import { DAYS } from './domain-program.js';
import { isoDate, mondayOf, parseISO } from './domain-calendar.js';
import { getExercise } from './domain-catalog.js';
import { exerciseSeries, progressMetric } from './domain-analytics.js';
import { roundTo } from './domain-units.js';

const DAY = 86400000, WEEK = 7 * DAY;
const kindOf = s => s.kind === 'strength' ? 'gym' : s.activity === 'padel' ? 'padel' : 'other';

// Weeks (Mon–Sun) covering a month. Each day: { iso, day, inMonth, today, future, done[], plan, missed }.
// "Missed" = a planned workout day in the past with no workout logged, counted only from
// when you started (first session or program start), so old dates aren't held against you.
export function monthGrid(year, month, sessions, schedule, { isRoutine = () => false, since = null, now = new Date() } = {}) {
  const byDay = new Map();
  for (const s of sessions) { const k = isoDate(new Date(s.startedAt)); byDay.set(k, [...(byDay.get(k) || []), s]); }
  const first = new Date(year, month, 1), start = mondayOf(first);
  const last = new Date(year, month + 1, 0);
  const todayIso = isoDate(now), sinceIso = since || todayIso;
  const weeks = [];
  for (let d = new Date(start); d <= last || d.getDay() !== 1; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 1) weeks.push([]);
    const iso = isoDate(d), list = byDay.get(iso) || [], plan = schedule[DAYS[(d.getDay() + 6) % 7]];
    const done = [...new Set(list.map(kindOf))];
    const past = iso < todayIso;
    weeks[weeks.length - 1].push({
      iso, day: d.getDate(), inMonth: d.getMonth() === month, today: iso === todayIso, future: iso > todayIso, sessions: list, done,
      plan: isRoutine(plan) ? 'gym' : plan === 'Padel' ? 'padel' : null,
      missed: past && iso >= sinceIso && isRoutine(plan) && !done.includes('gym'),
    });
    if (weeks.length > 6) break;
  }
  return weeks;
}

export function monthStats(weeks) {
  const days = weeks.flat().filter(d => d.inMonth);
  return { sessions: days.reduce((n, d) => n + d.sessions.length, 0), workouts: days.filter(d => d.done.includes('gym')).length, missed: days.filter(d => d.missed).length };
}

// Least-squares slope (value per week) and residual spread.
function fit(pts) {
  const x0 = pts[0].x, xs = pts.map(p => (p.x - x0) / WEEK), ys = pts.map(p => p.y);
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = sxx ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0;
  const resid = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + slope * (xs[i] - mx))) ** 2, 0) / Math.max(1, n - 2));
  return { slope, resid, last: my + slope * (xs[n - 1] - mx) };
}

// Project a lift `weeks` ahead. Needs ≥4 sessions over ≥2 weeks. Gains are damped
// (progress slows over time), and the range widens with how noisy your numbers are.
export function projectLift(history, exId, { weeks = 6, now = Date.now() } = {}) {
  const ex = getExercise(exId), m = progressMetric(ex);
  const pts = exerciseSeries(history, exId).filter(p => p[m.key] != null && p.ts > now - 12 * WEEK).map(p => ({ x: p.ts, y: p[m.key] })).sort((a, b) => a.x - b.x);
  if (pts.length < 4 || pts[pts.length - 1].x - pts[0].x < 2 * WEEK) return null;
  const { slope, resid, last } = fit(pts);
  const current = Math.max(...pts.slice(-2).map(p => p.y));
  const damp = 1 / (1 + weeks / 16);
  const gain = Math.max(0, slope) * weeks * damp;
  const mid = Math.max(current, last + gain), spread = Math.max(current * 0.025, resid * 1.5);
  const step = m.load ? 2.5 : 1;
  return { exId, name: ex.name, metric: m, current, perWeek: slope, steady: slope <= 0.05 * step,
    low: roundTo(Math.max(current, mid - spread), step), high: roundTo(mid + spread, step), weeks, by: now + weeks * WEEK,
    freq: pts.filter(p => p.x > now - 4 * WEEK).length / 4 };
}

// The lifts worth projecting: most-logged recently, up to `n`.
export function liftProjections(history, { n = 3, weeks = 6, now = Date.now() } = {}) {
  const counts = new Map();
  for (const s of history) if (s.kind === 'strength' && s.startedAt > now - 12 * WEEK) for (const e of s.exercises || []) {
    const ex = getExercise(e.exId);
    if (ex && ex.fields.includes('w') && ['lower-strength', 'upper-strength'].includes(ex.category)) counts.set(ex.id, (counts.get(ex.id) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => projectLift(history, id, { weeks, now })).filter(Boolean).slice(0, n);
}

// Weeks to the next level at your recent pace (points earned over the last 4 weeks).
export function levelEta(xpEvents, level, now = Date.now()) {
  const recent = xpEvents.filter(e => e.ts > now - 4 * WEEK && e.ts <= now);
  const perWeek = recent.reduce((n, e) => n + e.xp, 0) / 4;
  const left = level.need - level.into;
  return { perWeek: Math.round(perWeek), weeks: perWeek > 0 ? Math.ceil(left / perWeek) : null, left };
}

// What changes with one more workout a week. Lift gains scale with the square root of
// the extra frequency (diminishing returns); points scale with your average workout.
export function whatIf(history, xpEvents, level, projections, now = Date.now()) {
  const workouts = history.filter(s => s.kind === 'strength' && s.startedAt > now - 4 * WEEK && s.startedAt <= now);
  const perWeek = workouts.length / 4;
  if (perWeek < 0.5) return null;
  const from = Math.round(perWeek), to = from + 1;
  const eta = levelEta(xpEvents, level, now);
  const workoutXp = xpEvents.filter(e => e.ts > now - 4 * WEEK && /^Workout:|targets|record/.test(e.label)).reduce((n, e) => n + e.xp, 0) / Math.max(1, workouts.length);
  const fasterEta = eta.perWeek > 0 ? Math.ceil(eta.left / (eta.perWeek + workoutXp)) : null;
  const ratio = Math.min(1.5, to / Math.max(1, perWeek));
  const lifts = projections.filter(p => !p.steady).map(p => ({ name: p.name, weeksSooner: Math.max(0, Math.round(p.weeks - p.weeks / Math.sqrt(ratio))) }));
  return { from, to, levelWeeks: eta.weeks, levelWeeksIf: fasterEta, levelSooner: eta.weeks && fasterEta ? Math.max(0, eta.weeks - fasterEta) : null,
    liftWeeksSooner: lifts.length ? Math.max(...lifts.map(l => l.weeksSooner)) : null };
}

// The earliest date that counts toward "missed" days.
export function trackingSince(sessions, programStart) {
  const firstTs = sessions.length ? Math.min(...sessions.map(s => s.startedAt)) : Date.now();
  const first = isoDate(new Date(firstTs));
  return programStart && programStart > first ? programStart : first;
}

export { parseISO };
