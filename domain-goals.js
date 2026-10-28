// Goals: a tournament date (training eases off before it) and lift targets.
import { isoDate, parseISO } from './domain-calendar.js';
import { heaviest } from './domain-progression.js';

const DAY = 86400000;
export const daysUntil = (iso, now = new Date()) => Math.round((parseISO(iso) - parseISO(isoDate(now))) / DAY);

// Where you are relative to the tournament:
//   build    8–14 days out: train as normal
//   taper    3–7 days out: lighter workouts (one set fewer, easier effort)
//   rest     1–2 days out: no gym, just mobility and feeling fresh
//   day      tournament day
//   recover  1–2 days after: lighter again
// null when it's further away, or more than two days past.
export function taperFor(t, now = new Date()) {
  if (!t?.date) return null;
  const d = daysUntil(t.date, now);
  const phase = d > 14 || d < -2 ? null : d >= 8 ? 'build' : d >= 3 ? 'taper' : d >= 1 ? 'rest' : d === 0 ? 'day' : 'recover';
  if (!phase) return null;
  return { phase, days: d, name: t.name || 'Tournament', lighter: phase === 'taper' || phase === 'recover', noGym: phase === 'rest' || phase === 'day' };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function taperText(tp) {
  if (!tp) return '';
  return {
    build: `${tp.name} in ${plural(tp.days, 'day')}. Train as normal; workouts get lighter from ${tp.days - 7 === 1 ? 'tomorrow' : `${plural(tp.days - 7, 'day')} from now`}.`,
    taper: `${tp.name} in ${plural(tp.days, 'day')}. Workouts are lighter this week so you arrive fresh.`,
    rest: `${tp.name} ${tp.days === 1 ? 'tomorrow' : 'in 2 days'}. Skip the gym: some mobility and an early night.`,
    day: `${tp.name} today. Warm up well and log your matches afterwards. Good luck!`,
    recover: `${tp.name} is done. Keep the next couple of days easy while your legs recover.`,
  }[tp.phase];
}

// A lift goal: { exId, kg }. Progress uses the heaviest weight you've logged on it.
export function liftProgress(goal, sessions) {
  const best = heaviest(sessions, goal.exId);
  return { best, pct: goal.kg > 0 ? Math.min(1, best / goal.kg) : 0, done: goal.kg > 0 && best >= goal.kg };
}
