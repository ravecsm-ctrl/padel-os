// Local-date helpers. The program week is derived from a start date, never stored
// directly, so it advances on its own and survives app restarts.
import { DAYS } from './domain-program.js';

const DAY_MS = 86400000;
export const dayKey = (d = new Date()) => DAYS[(d.getDay() + 6) % 7];
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function mondayOf(d = new Date()) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; }
// Whole days between two local dates, immune to DST shifts.
export const daysBetween = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);

export function programPosition(startISO, now = new Date()) {
  const start = mondayOf(parseISO(startISO));
  const weeks = Math.max(0, Math.floor(daysBetween(start, mondayOf(now)) / 7));
  return { week: (weeks % 4) + 1, cycle: Math.floor(weeks / 4) + 1, weeksIn: weeks };
}

// Pick a start date so that `now` falls in program week `week` of the current cycle.
export function startForWeek(week, currentStartISO, now = new Date()) {
  const { cycle } = currentStartISO ? programPosition(currentStartISO, now) : { cycle: 1 };
  const m = mondayOf(now);
  m.setDate(m.getDate() - ((cycle - 1) * 4 + (week - 1)) * 7);
  return isoDate(m);
}

export function weekDates(now = new Date()) {
  const m = mondayOf(now);
  return DAYS.map((k, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return { key: k, date: d, iso: isoDate(d) }; });
}

export function relDay(ts, now = new Date()) {
  const n = daysBetween(new Date(ts), now);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return `${n} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
