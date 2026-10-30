// How hard a padel day is expected to be. Set per weekday in Plan (your usual Tuesday social game,
// Saturday league match) and changed for one date from the calendar or Today. Unset counts as normal,
// which is how the app treated every match before.
//   easy    social game, lesson, drilling: train as usual around it
//   normal  a regular match
//   hard    competitive, league, Americano or a long session: keep legs fresh before, give them time after
export const MATCH_LEVELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const LEVEL_HINT = { easy: 'Social game, lesson, drilling', normal: 'A regular match', hard: 'Competitive, league, Americano or long' };
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = 86400000;
export const weekdayOf = iso => WEEK[new Date(iso + 'T12:00').getDay()];

// settings: { padelLevel: { Sat: 'hard' }, matchLevel: { '2026-11-07': 'easy' } }
export const levelOn = (iso, settings = {}) => settings.matchLevel?.[iso] || settings.padelLevel?.[weekdayOf(iso)] || 'normal';

// How a logged match actually went, on the same scale (effort: Easy 5 · Moderate 6 · Hard 7 · Very hard 8 · All-out 10).
export function loggedLevel(s) {
  const rpe = s.rpe ?? 7, min = s.durationMin || 0;
  return rpe >= 8 || (rpe >= 7 && min >= 110) ? 'hard' : rpe <= 5 ? 'easy' : 'normal';
}
// Only a match that turned out hard when it wasn't planned that way changes the days after it.
export const harderThanPlanned = (s, expected) => loggedLevel(s) === 'hard' && expected !== 'hard';

// Your last three matches on this weekday (within 6 weeks) all went one way that isn't the setting:
// suggest it. Returns 'easy' | 'normal' | 'hard' | null.
export function suggestLevel(sessions, weekday, current = 'normal', now = Date.now()) {
  const recent = sessions.filter(s => s.activity === 'padel' && now - s.startedAt < 42 * DAY && WEEK[new Date(s.startedAt).getDay()] === weekday)
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  if (recent.length < 3) return null;
  const lv = recent.map(loggedLevel);
  return lv.every(l => l === lv[0]) && lv[0] !== current ? lv[0] : null;
}

// Penalties for the weekly plan (see personalize.weekPenalty): how much a leg workout
// next to this match costs. Normal matches keep the weights the plan has always used.
export const NEXT_TO = { easy: { before: 0.5, after: 0, other: 0.3 }, normal: { before: 4, after: 2, other: 1 }, hard: { before: 7, after: 3.5, other: 1.5 } };
