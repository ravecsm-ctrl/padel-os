// Progress pentagon, XP and levels. Scores compare you with your own training (last
// 4 weeks; lifts against your own starting point), never with other people. Every
// score breaks down into parts with plain-language explanations.
import { getExercise } from './domain-catalog.js';
import { doneSets, e1rm } from './domain-progression.js';
import { mondayOf, isoDate } from './domain-calendar.js';
import { COURT_ROUTINES } from './domain-court.js';

const isRoutineLog = s => s.kind === 'activity' && !!s.routine;
const isPrehab = s => isRoutineLog(s) && COURT_ROUTINES[s.routine]?.kind === 'prehab';

const DAY = 86400000, WINDOW = 28 * DAY;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = v => Math.round(v);
const inWindow = (s, now) => s.startedAt > now - WINDOW && s.startedAt <= now;
const weeksIn = (list, now) => new Set(list.filter(s => inWindow(s, now)).map(s => isoDate(mondayOf(new Date(s.startedAt))))).size;

function setsWhere(sessions, now, test) {
  let n = 0;
  for (const s of sessions) if (s.kind === 'strength' && inWindow(s, now)) for (const e of s.exercises || []) { const ex = getExercise(e.exId); if (ex && test(ex)) n += doneSets(e).length; }
  return n;
}

// Median change of each lift's best e1RM (or top weight) from its first session to its best in the window.
function liftProgress(sessions, now) {
  const by = new Map();
  for (const s of [...sessions].filter(x => x.kind === 'strength' && x.startedAt <= now).sort((a, b) => a.startedAt - b.startedAt)) {
    for (const e of s.exercises || []) {
      const ex = getExercise(e.exId);
      if (!ex || !ex.fields.includes('w') || !['lower-strength', 'upper-strength'].includes(ex.category)) continue;
      const v = Math.max(0, ...doneSets(e).map(x => e1rm(x.w, x.reps) || x.w || 0));
      if (!v) continue;
      const r = by.get(ex.id) || { first: v, recent: 0, n: 0 };
      r.n++; if (inWindow(s, now)) r.recent = Math.max(r.recent, v);
      by.set(ex.id, r);
    }
  }
  const changes = [...by.values()].filter(r => r.n >= 2 && r.recent).map(r => (r.recent - r.first) / r.first);
  if (!changes.length) return null;
  changes.sort((a, b) => a - b);
  return { change: changes[Math.floor(changes.length / 2)], lifts: changes.length };
}

const part = (label, points, detail) => ({ label, points: round(points), detail });

// opts: { plannedPerWeek, now }
export function pentagon(sessions, { plannedPerWeek = 3, now = Date.now() } = {}) {
  const recent = sessions.filter(s => inWindow(s, now));
  const strength = recent.filter(s => s.kind === 'strength');

  // Strength
  const sSets = setsWhere(sessions, now, ex => ['lower-strength', 'upper-strength'].includes(ex.category)) / 4;
  const prog = liftProgress(sessions, now);
  const sVol = clamp(sSets / 20 * 100), sProg = prog ? clamp(40 + prog.change * 240) : null;
  const strengthAxis = {
    key: 'strength', label: 'Strength', score: round(sProg == null ? sVol * 0.7 : sVol * 0.5 + sProg * 0.5),
    parts: [part('Strength work', sVol, `${sSets.toFixed(1)} sets a week (100 at 20)`),
      part('Getting stronger', sProg ?? 0, prog ? `Main lifts ${prog.change >= 0 ? '+' : ''}${Math.round(prog.change * 100)}% since you started (${prog.lifts} lift${prog.lifts > 1 ? 's' : ''})` : 'Do a lift twice to measure progress')],
    tip: 'Train your main lifts twice a week and let the app add weight when you hit the top of the range.',
  };

  // Power
  const pSets = setsWhere(sessions, now, ex => ex.movement === 'power') / 4;
  const pWeeks = weeksIn(strength.filter(s => (s.exercises || []).some(e => getExercise(e.exId)?.movement === 'power' && doneSets(e).length)), now);
  const pPrac = clamp(pSets / 8 * 100), pReg = pWeeks / 4 * 100;
  const powerAxis = { key: 'power', label: 'Power', score: round(pPrac * 0.6 + pReg * 0.4),
    parts: [part('Explosive work', pPrac, `${pSets.toFixed(1)} jump or throw sets a week (100 at 8)`), part('Regularity', pReg, `${pWeeks} of the last 4 weeks`)],
    tip: 'Add jumps or throws at the start of a workout, a few sets every week. Quality over quantity.' };

  // Resilience
  const routines = recent.filter(isPrehab).length / 4;
  const prevSets = setsWhere(sessions, now, ex => ex.category === 'prevention') / 4;
  const prevention = clamp(routines / 2 * 60 + prevSets / 12 * 40);
  const flags = recent.reduce((n, s) => n + (s.padel?.sore?.length || 0) + (s.pain?.flag ? 1 : 0), 0);
  const body = recent.length ? clamp(100 - flags * 15) : 0;   // no free points for not training
  const resilienceAxis = { key: 'resilience', label: 'Resilience', score: round(prevention * 0.6 + body * 0.4),
    parts: [part('Prevention work', prevention, `${routines.toFixed(1)} routines and ${prevSets.toFixed(1)} prevention sets a week`), part('Body check', body, flags ? `${flags} sore or pain flag${flags > 1 ? 's' : ''} in 4 weeks` : 'No sore or pain flags in 4 weeks')],
    tip: 'Do an injury-prevention routine from the Mobility tab twice a week, and flag soreness honestly so the app can help.' };

  // Conditioning
  const cond = recent.filter(s => s.kind === 'activity' && (s.activity === 'padel' || s.activity === 'cardio'));
  const mins = cond.reduce((n, s) => n + (s.durationMin || 0), 0) / 4;
  const steadyWeeks = (() => { const w = {}; for (const s of cond) { const k = isoDate(mondayOf(new Date(s.startedAt))); w[k] = (w[k] || 0) + (s.durationMin || 0); } return Object.values(w).filter(m => m >= 60).length; })();
  const cVol = clamp(mins / 180 * 100), cSteady = steadyWeeks / 4 * 100;
  const conditioningAxis = { key: 'conditioning', label: 'Conditioning', score: round(cVol * 0.7 + cSteady * 0.3),
    parts: [part('Court & cardio time', cVol, `${Math.round(mins)} min a week (100 at 180)`), part('Steadiness', cSteady, `${steadyWeeks} of 4 weeks with an hour or more`)],
    tip: 'Keep playing or doing cardio most weeks; steady beats occasional big weeks.' };

  // Consistency
  const planned = Math.max(1, plannedPerWeek) * 4;
  const done = strength.length;
  const streak = (() => { const weeks = new Set(sessions.filter(s => s.startedAt <= now && !isRoutineLog(s)).map(s => isoDate(mondayOf(new Date(s.startedAt))))); const m = mondayOf(new Date(now)); if (!weeks.has(isoDate(m))) m.setDate(m.getDate() - 7); let n = 0; while (weeks.has(isoDate(m))) { n++; m.setDate(m.getDate() - 7); } return n; })();
  const cDone = clamp(done / planned * 100), cStreak = Math.min(streak, 8) / 8 * 100;
  const consistencyAxis = { key: 'consistency', label: 'Consistency', score: round(cDone * 0.7 + cStreak * 0.3),
    parts: [part('Workouts done', cDone, `${done} of ${planned} planned in 4 weeks`), part('Weekly streak', cStreak, `${streak} week${streak === 1 ? '' : 's'} in a row (100 at 8)`)],
    tip: 'Show up for the workouts on your schedule; short sessions count.' };

  return [strengthAxis, powerAxis, resilienceAxis, conditioningAxis, consistencyAxis];
}

// ── XP for good habits (never raw volume) ───────────────────────────────────────
export function xpEvents(sessions, { plannedIds = [] } = {}) {
  const out = [], sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const weeks = new Map(), lightDays = new Set();
  for (const s of sorted) {
    const wk = isoDate(mondayOf(new Date(s.startedAt)));
    if (!isRoutineLog(s)) weeks.set(wk, (weeks.get(wk) || 0) + 1);
    if (s.kind === 'strength') {
      const sets = (s.exercises || []).reduce((n, e) => n + doneSets(e).length, 0);
      if (!sets) continue;
      const hit = (s.exercises || []).filter(e => { const d = doneSets(e), tf = e.fields?.[e.fields.length - 1] || 'reps'; return d.length && e.target?.min != null && d.every(x => (x[tf] || 0) >= e.target.min); }).length;
      out.push({ ts: s.startedAt, xp: (plannedIds.includes(s.routineId) ? 100 : 80) + Math.min(60, sets * 2), label: `Workout: ${s.title}` });
      if (hit) out.push({ ts: s.startedAt, xp: hit * 10, label: `Hit your targets on ${hit} exercise${hit > 1 ? 's' : ''}` });
      if (s.prs?.length) out.push({ ts: s.startedAt, xp: s.prs.length * 25, label: `${s.prs.length} personal record${s.prs.length > 1 ? 's' : ''}` });
    } else if (s.kind === 'activity') {
      // Prevention routines earn 30; stretches and warm-ups 10, once a day, so they can't be farmed.
      if (isRoutineLog(s) && !isPrehab(s)) { const day = isoDate(new Date(s.startedAt)); if (lightDays.has(day)) continue; lightDays.add(day); out.push({ ts: s.startedAt, xp: 10, label: `Routine: ${s.title}` }); continue; }
      out.push({ ts: s.startedAt, xp: s.routine ? 30 : 20, label: s.routine ? `Routine: ${s.title}` : `Logged: ${s.title}` });
    }
  }
  for (const [wk, n] of weeks) if (n >= 2) out.push({ ts: new Date(wk + 'T23:00').getTime() + 6 * DAY, xp: 50, label: 'Active week (2+ sessions)' });
  return out.sort((a, b) => b.ts - a.ts);
}

// Level n needs 1000 × n more XP than the last: 0, 1000, 3000, 6000, 10000…
// At ~3 workouts a week plus padel that's roughly 2 weeks to level 2 and ~4 months to Advanced.
export const LEVEL_NAMES = ['Beginner', 'Regular', 'Club Player', 'Competitor', 'Advanced', 'Elite', 'Pro'];
export function levelFor(xp) {
  let level = 1, floor = 0;
  while (xp >= floor + 1000 * level) { floor += 1000 * level; level++; }
  const need = 1000 * level;
  return { level, name: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1], xp, into: xp - floor, need, progress: (xp - floor) / need };
}

export function achievements(sessions) {
  const strength = sessions.filter(s => s.kind === 'strength');
  const routines = sessions.filter(isPrehab).length;
  const matches = sessions.filter(s => s.activity === 'padel').length;
  const prs = strength.reduce((n, s) => n + (s.prs?.length || 0), 0);
  const weeks = new Set(sessions.filter(s => !isRoutineLog(s)).map(s => isoDate(mondayOf(new Date(s.startedAt)))));
  let best = 0, run = 0;
  for (const w of [...weeks].sort()) { const prev = new Date(w + 'T12:00'); prev.setDate(prev.getDate() - 7); run = weeks.has(isoDate(prev)) ? run + 1 : 1; best = Math.max(best, run); }
  return [
    { key: 'first', label: 'First workout', done: strength.length >= 1, progress: `${Math.min(1, strength.length)}/1` },
    { key: 'ten', label: '10 workouts', done: strength.length >= 10, progress: `${Math.min(10, strength.length)}/10` },
    { key: 'streak4', label: '4-week streak', done: best >= 4, progress: `${Math.min(4, best)}/4` },
    { key: 'pr', label: 'First personal record', done: prs >= 1, progress: `${Math.min(1, prs)}/1` },
    { key: 'prehab', label: '5 prevention routines', done: routines >= 5, progress: `${Math.min(5, routines)}/5` },
    { key: 'matches', label: '10 matches logged', done: matches >= 10, progress: `${Math.min(10, matches)}/10` },
  ];
}
