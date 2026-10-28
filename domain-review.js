// Weekly review: what a week (Mon–Sun) looked like, compared with the week before, and a
// short, concrete focus for the next one. Pure function over sessions and the body log.
import { DAYS, isRoutine, PHASES } from './domain-program.js';
import { setCount, volumeKg, isRoutineLog } from './domain-analytics.js';
import { musclesBetween, weeklyStatus } from './domain-muscles.js';
import { MUSCLES } from './domain-taxonomy.js';
import { trend } from './domain-body.js';
import { recentPain, areaName } from './domain-pain.js';
import { mondayOf } from './domain-calendar.js';

const DAY = 86400000;
const BIG = ['quads', 'hamstrings', 'glutes', 'chest', 'upper_back', 'lats', 'shoulders'];

// The week to review by default: this week on Sunday, otherwise last week.
export function reviewWeekStart(now = new Date()) {
  const m = mondayOf(now);
  if (now.getDay() !== 0) m.setDate(m.getDate() - 7);
  return m;
}

function summary(sessions, from, to) {
  const inWeek = sessions.filter(s => s.startedAt >= from && s.startedAt < to);
  const workouts = inWeek.filter(s => s.kind === 'strength');
  return {
    sessions: inWeek, workouts,
    matches: inWeek.filter(s => s.activity === 'padel'),
    routines: inWeek.filter(isRoutineLog),
    minutes: inWeek.filter(s => !isRoutineLog(s)).reduce((n, s) => n + (s.durationMin || 0), 0),
    sets: workouts.reduce((n, s) => n + setCount(s), 0),
    volume: Math.round(workouts.reduce((n, s) => n + volumeKg(s), 0)),
  };
}

// Trend value at or before a moment (null without data).
const trendAt = (pts, t) => [...pts].reverse().find(p => p.x <= t)?.y ?? null;

export function weekReview(sessions, { weekStart, schedule = {}, body = [], week = 1, painClear = {}, now = Date.now() } = {}) {
  const from = mondayOf(weekStart).getTime(), to = from + 7 * DAY, end = Math.min(to, now);
  const cur = summary(sessions, from, to), prev = summary(sessions, from - 7 * DAY, from);
  const planned = DAYS.filter(d => isRoutine(schedule[d])).length;

  // Records: best per exercise this week.
  const prs = new Map();
  for (const s of cur.workouts) for (const p of s.prs || []) if (!prs.has(p.exId) || prs.get(p.exId).value < p.value) prs.set(p.exId, { ...p, ts: s.startedAt });

  // Muscles: big groups that got little or nothing.
  const mm = musclesBetween(sessions, from, to);
  const under = BIG.filter(m => ['none', 'light'].includes(weeklyStatus(m, mm[m] || 0).key)).map(m => MUSCLES[m]);

  // Body: weight trend change across the week.
  const pts = trend(body, 'kg'), w0 = trendAt(pts, from), w1 = trendAt(pts, end);
  const bodyChange = w0 != null && w1 != null && pts.some(p => p.x >= from && p.x < to) ? Math.round((w1 - w0) * 10) / 10 : null;

  const pain = Object.keys(recentPain(sessions, { now: end, cleared: painClear }));
  const nextWeek = (week % 4) + 1, phase = PHASES[nextWeek - 1];

  // Next week's focus: at most three concrete, kind suggestions.
  const focus = [];
  if (planned && cur.workouts.length < planned) focus.push(`Aim for ${planned} workouts. You did ${cur.workouts.length} of ${planned}; even a short session counts.`);
  else if (planned && cur.workouts.length >= planned) focus.push('You hit every planned workout. Keep the same rhythm.');
  if (under.length && cur.workouts.length) focus.push(`${under.slice(0, 2).join(' and ')} got little work. Make sure the next workouts include them.`);
  if (pain.length) focus.push(`Your ${pain.map(a => areaName(a).toLowerCase()).join(' and ')} hurt recently: do the matching prevention routine twice.`);
  if (prev.minutes && cur.minutes > prev.minutes * 1.5) focus.push('A much bigger week than the last. Keep next week similar rather than adding more.');
  focus.push(`Next week is week ${nextWeek}: ${phase.name}. ${phase.note}`);

  return {
    from, to, inProgress: now < to, planned,
    workouts: cur.workouts.length, matches: cur.matches.length, routines: cur.routines.length,
    minutes: cur.minutes, sets: cur.sets, volume: cur.volume,
    prev: { workouts: prev.workouts.length, matches: prev.matches.length, minutes: prev.minutes, volume: prev.volume },
    // Estimated-max records first (they reflect real strength), then heaviest / most reps.
    prs: [...prs.values()].sort((a, b) => (b.type === 'e1RM') - (a.type === 'e1RM')), under, bodyChange, pain, focus: focus.slice(0, 4),
    days: Array.from({ length: 7 }, (_, i) => {
      const d0 = from + i * DAY, list = cur.sessions.filter(s => s.startedAt >= d0 && s.startedAt < d0 + DAY);
      return { day: DAYS[i], gym: list.some(s => s.kind === 'strength'), padel: list.some(s => s.activity === 'padel'), other: list.some(s => s.kind === 'activity' && s.activity !== 'padel'), planned: isRoutine(schedule[DAYS[i]]) };
    }),
  };
}
