// Goal blocks: a 4–8 week plan toward one goal, split into phases. The workouts stay the
// same all block (so weights keep climbing); each phase changes reps, sets, rest and effort.
// While a block runs it replaces the usual 4-week cycle. Pure functions.
import { getExercise, targetField } from './domain-catalog.js';
import { isoDate, parseISO, mondayOf, daysBetween } from './domain-calendar.js';

// Phase shape matches program.PHASES (rpe, rir, setMult, loadMult, note) plus how reps move:
// main = a workout's first two exercises when they're big two-legged or two-armed lifts, acc = the
// rest; null keeps the workout's own reps.
export const BLOCK_PHASES = {
  build:    { name: 'Build',    rpe: 7.5, rir: 2, setMult: 1,    loadMult: 1,    main: [6, 8],   acc: [8, 10],  restMult: 1,    note: 'Heavier, steady reps to build your base.' },
  power:    { name: 'Power',    rpe: 8,   rir: 2, setMult: 0.85, loadMult: 1,    main: [3, 5],   acc: [6, 8],   restMult: 1.25, note: 'Fewer reps, move fast. Rest longer between sets.' },
  sharpen:  { name: 'Sharpen',  rpe: 7.5, rir: 3, setMult: 0.7,  loadMult: 1,    main: [3, 5],   acc: [6, 8],   restMult: 1.25, note: 'Less volume. Stay fast and sharp.' },
  taper:    { name: 'Taper',    rpe: 6.5, rir: 4, setMult: 0.5,  loadMult: 1,    main: [3, 5],   acc: [6, 8],   restMult: 1.25, note: 'Short and quick so you arrive fresh.' },
  strength: { name: 'Strength', rpe: 8,   rir: 2, setMult: 1,    loadMult: 1,    main: [4, 6],   acc: [6, 8],   restMult: 1.25, note: 'Heavier weights, fewer reps.' },
  speed:    { name: 'Speed',    rpe: 7.5, rir: 3, setMult: 0.8,  loadMult: 1,    main: [3, 5],   acc: [6, 8],   restMult: 1.25, note: 'Lighter on volume, every rep fast.' },
  volume:   { name: 'Volume',   rpe: 7.5, rir: 2, setMult: 1,    loadMult: 1,    main: [8, 10],  acc: [10, 12], restMult: 0.9,  note: 'More reps to build muscle.' },
  control:  { name: 'Control',  rpe: 6.5, rir: 4, setMult: 0.85, loadMult: 1,    main: [10, 12], acc: [12, 15], restMult: 1,    note: 'Slow and controlled. Own every rep.' },
  hold:     { name: 'Hold',     rpe: 7.5, rir: 2, setMult: 1,    loadMult: 1,    main: [6, 8],   acc: [10, 12], restMult: 1,    note: 'Keep what you built, a little heavier.' },
  gentle:   { name: 'Gentle',   rpe: 6,   rir: 4, setMult: 0.7,  loadMult: 1,    main: [10, 15], acc: [12, 15], restMult: 1,    note: 'Light and pain-free. Build confidence first.' },
  rebuild:  { name: 'Build',    rpe: 7,   rir: 3, setMult: 0.85, loadMult: 1,    main: [8, 12],  acc: [10, 12], restMult: 1,    note: 'A little more each week, as long as it stays pain-free.' },
  normal:   { name: 'Normal',   rpe: 7.5, rir: 2, setMult: 1,    loadMult: 1,    main: null,     acc: null,     restMult: 1,    note: 'Back to your usual training.' },
  maintain: { name: 'Maintain', rpe: 7.5, rir: 2, setMult: 0.7,  loadMult: 1,    main: [5, 8],   acc: [8, 10],  restMult: 1,    note: 'Fewer sets: keep your strength, save your legs for matches.' },
  lighter:  { name: 'Lighter',  rpe: 6,   rir: 4, setMult: 0.6,  loadMult: 0.88, main: null,     acc: null,     restMult: 1,    note: 'Fewer sets and lighter weights so your body can recover.' },
};

// Each goal: its phases in order (spread over the weeks), the focus used when building new
// workouts, and whether your current workouts already suit it.
export const GOALS = {
  tournament: { label: 'Tournament peak', sub: 'Arrive fast and fresh on a date', phases: ['build', 'power', 'sharpen', 'taper'], focuses: ['legs', 'power', 'upper'], current: true },
  faster:     { label: 'Faster on court', sub: 'First step and change of direction', phases: ['strength', 'power', 'speed'], focuses: ['power', 'legs', 'core'], current: true },
  legs:       { label: 'Stronger legs', sub: 'Brake, lunge and last longer', phases: ['volume', 'strength'], focuses: ['legs', 'prevention', 'core'], current: true },
  shoulders:  { label: 'Healthy shoulders and elbows', sub: 'Smashes and bandejas without pain', phases: ['control', 'strength', 'hold'], focuses: ['shoulders', 'upper', 'prevention'], current: false },
  injury:     { label: 'Back from injury', sub: 'Rebuild one area step by step', phases: ['gentle', 'rebuild', 'normal'], focuses: ['prevention', 'legs', 'upper'], current: false },
  inseason:   { label: 'In-season', sub: 'Keep strength with less fatigue', phases: ['maintain'], focuses: ['legs', 'upper', 'prevention'], current: true },
};
export const WEEK_OPTIONS = [4, 6, 8];
export const MIN_WEEKS = 4, MAX_WEEKS = 8;
// Areas where jumping is a bad idea while you rebuild.
export const JUMP_AREAS = ['knee', 'ankle', 'calf', 'back'];

// The phase of every week. Phases share the weeks in order, earlier ones taking any extra;
// a tournament block always ends Sharpen → Taper. Every 4th week is lighter, except in
// tournament and in-season blocks (the taper and the lower volume do that job).
export function blockWeeks(goal, weeks) {
  const g = GOALS[goal];
  if (!g) return [];
  const n = Math.max(1, Math.round(weeks));
  if (goal === 'tournament') {
    const lead = Math.max(0, n - 2), b = Math.ceil(lead / 2);
    return [...Array(b).fill('build'), ...Array(lead - b).fill('power'), ...(n >= 2 ? ['sharpen'] : []), 'taper'].slice(-n);
  }
  const light = goal !== 'inseason';
  const slots = Array.from({ length: n }, (_, i) => light && (i + 1) % 4 === 0 ? 'lighter' : null);
  const work = slots.filter(s => !s).length, k = g.phases.length;
  const per = g.phases.map((_, i) => Math.floor(work / k) + (i < work % k ? 1 : 0));
  const seq = g.phases.flatMap((p, i) => Array(per[i]).fill(p));
  let j = 0;
  return slots.map(s => s || seq[j++]);
}

// A block starts on a Monday: this week's from Monday to Thursday, next week's from Friday on
// (a week that's nearly over shouldn't count as week 1).
export function firstMonday(now = new Date()) {
  const m = mondayOf(now);
  if ([0, 5, 6].includes(now.getDay())) m.setDate(m.getDate() + 7);
  return m;
}

// A tournament block ends on the tournament's week. Returns { start, weeks } with weeks
// clamped to 4–8 (a later tournament starts the block later); too: 'close' when under 4 weeks.
export function tournamentPlan(dateISO, now = new Date()) {
  const first = firstMonday(now), tMon = mondayOf(parseISO(dateISO));
  if (dateISO < isoDate(now)) return { too: 'past', weeks: 0 };
  const weeks = Math.floor(daysBetween(first, tMon) / 7) + 1;
  if (weeks < MIN_WEEKS) return { too: 'close', weeks };
  const n = Math.min(MAX_WEEKS, weeks), start = new Date(tMon);
  start.setDate(start.getDate() - (n - 1) * 7);
  return { start: isoDate(start), weeks: n };
}

// A new block. start: the Monday it begins (defaults to firstMonday).
export function makeBlock({ goal, weeks = 6, start = null, date = null, name = '', area = null, mode = 'current', routines = [], prev = null, now = new Date() }) {
  let s = start || isoDate(firstMonday(now)), n = weeks;
  if (goal === 'tournament' && date) { const tp = tournamentPlan(date, now); if (tp.start) { s = tp.start; n = tp.weeks; } }
  return { id: `blk-${Date.now().toString(36)}`, goal, start: s, weeks: n, date: goal === 'tournament' ? date : null, name: (name || '').trim(), area, mode, routines, prev, createdAt: Date.now() };
}

// Where you are in a block on a date. null without a block.
// { state: 'upcoming' | 'active' | 'done', week, weeks, phase, phaseId, newPhase, held, startsIn, endedDays }
// pain: recentPain() map; in a Back-from-injury block, recent pain in that area holds you one phase back.
export function blockPosition(block, now = new Date(), pain = {}) {
  if (!block?.goal || !GOALS[block.goal]) return null;
  const plan = blockWeeks(block.goal, block.weeks);
  const d = daysBetween(mondayOf(parseISO(block.start)), mondayOf(now));
  if (d < 0) return { state: 'upcoming', startsIn: daysBetween(new Date(now.getFullYear(), now.getMonth(), now.getDate()), parseISO(block.start)), weeks: block.weeks, plan };
  const wi = Math.floor(d / 7);
  if (wi >= block.weeks) {
    const end = mondayOf(parseISO(block.start)); end.setDate(end.getDate() + block.weeks * 7);
    return { state: 'done', weeks: block.weeks, plan, endedDays: daysBetween(end, now), nextStart: isoDate(end) };
  }
  let phaseId = plan[wi], held = null;
  const order = GOALS[block.goal].phases, at = order.indexOf(phaseId);
  if (block.goal === 'injury' && block.area && pain[block.area] && pain[block.area].ts > 0 && at > 0) { held = phaseId; phaseId = order[at - 1]; }
  // A new phase this week (coming back from a lighter week into the same phase isn't one).
  const before = plan.slice(0, wi).filter(p => p !== 'lighter').pop();
  const newPhase = !held && wi > 0 && (plan[wi] === 'lighter' ? plan[wi - 1] !== 'lighter' : before !== plan[wi]);
  return { state: 'active', week: wi + 1, weeks: block.weeks, plan, phaseId, phase: BLOCK_PHASES[phaseId], held, newPhase };
}

// Phase spans for display: [{ id, name, from, to }] in week order.
export function phaseSpans(plan) {
  const out = [];
  plan.forEach((id, i) => { const last = out[out.length - 1]; if (last && last.id === id) last.to = i + 1; else out.push({ id, name: BLOCK_PHASES[id].name, from: i + 1, to: i + 1 }); });
  return out;
}

const PREVENTION = new Set(['calf-ankle', 'mobility']);
const MAIN = new Set(['squat', 'hinge', 'push', 'pull']);
// How a phase reshapes one block of a workout: reps for loaded strength work only. Power work
// keeps its reps; holds, carries, bodyweight and prevention work keep theirs too.
export function phaseRange(blk, ph) {
  if (!ph?.main) return null;
  const ex = getExercise(blk.ex);
  if (!ex || targetField(ex) !== 'reps') return null;
  if (ex.quality || ex.movement === 'power' || ex.pattern === 'power') return null;
  if (!ex.fields.includes('w') || ex.weightType === 'bodyweight' || blk.noLoad) return null;
  if (ex.category === 'prevention' || PREVENTION.has(ex.movement)) return null;
  const big = (blk.pri ?? 9) <= 2 && MAIN.has(ex.movement || ex.pattern);
  const [min, max] = big ? ph.main : ph.acc;
  return { min, max, rest: Math.max(30, Math.round((blk.rest ?? 90) * ph.restMult / 15) * 15) };
}

export const goalLabel = block => GOALS[block?.goal]?.label || 'Goal';
export const blockTitle = block => block?.goal === 'tournament' && block.name ? `${goalLabel(block)} · ${block.name}` : goalLabel(block);
