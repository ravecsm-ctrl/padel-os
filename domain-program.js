// Program: routines (templates of blocks referencing catalog ids), phases and the
// rules that turn a block + week + readiness into today's prescription.
import { getExercise } from './domain-catalog.js';
import { adaptBlocks, estimateMinutes } from './domain-personalize.js';
import { phaseRange } from './domain-block.js';

export const PHASES = [
  { week: 1, name: 'Base', rpe: 7, rir: 3, setMult: 1, loadMult: 1, note: 'Learn the movements and find comfortable weights.' },
  { week: 2, name: 'Build', rpe: 7.5, rir: 2, setMult: 1, loadMult: 1, note: 'Add a rep or a little weight when it feels smooth.' },
  { week: 3, name: 'Push', rpe: 8, rir: 2, setMult: 1, loadMult: 1, note: 'Your hardest week. Push, but never to failure.' },
  { week: 4, name: 'Recovery', rpe: 6, rir: 4, setMult: 0.6, loadMult: 0.88, note: 'Fewer sets and lighter weights so your body can recover.' },
];

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_OPTIONS = ['A', 'B', 'C', 'Padel', 'Recovery', 'Rest'];
export const DEFAULT_SCHEDULE = { Mon: 'A', Tue: 'Padel', Wed: 'B', Thu: 'Recovery', Fri: 'C', Sat: 'Padel', Sun: 'Rest' };

// pri: what to keep first when time is short (1 = most important).
const b = (ex, sets, min, max, rest, pri) => ({ ex, sets, min, max, rest, pri });

export const ROUTINES = {
  A: { id: 'A', title: 'Legs & Footwork', minutes: 75, focus: 'Strong legs for braking, lunging and changing direction.', blocks: [
    b('trap-bar-deadlift', 4, 4, 6, 150, 1), b('rfess', 3, 8, 10, 90, 2), b('lateral-lunge', 3, 8, 10, 75, 4), b('sl-rdl', 3, 8, 10, 75, 6),
    b('copenhagen-short', 3, 20, 30, 60, 3), b('pallof-press', 3, 10, 12, 45, 7), b('standing-calf-raise', 3, 12, 15, 60, 5), b('tibialis-raise', 3, 15, 20, 45, 8) ] },
  B: { id: 'B', title: 'Upper Body & Shots', minutes: 70, focus: 'Healthy shoulders, a strong back and grip for every stroke.', blocks: [
    b('landmine-press', 4, 8, 10, 90, 1), b('chest-supported-row', 4, 8, 10, 90, 2), b('incline-db-press', 3, 8, 10, 90, 4), b('cable-row-rotation', 3, 10, 12, 60, 7),
    b('cable-er', 3, 12, 15, 45, 3), b('face-pull', 3, 15, 20, 45, 6), b('wrist-rotation', 2, 15, 20, 30, 8), b('farmer-carry', 3, 30, 40, 60, 5) ] },
  C: { id: 'C', title: 'Power & Agility', minutes: 65, focus: 'A faster first step and more explosive movement.', blocks: [
    b('cmj', 4, 3, 3, 90, 1), b('lateral-bound', 3, 5, 5, 75, 2), b('mb-scoop-toss', 4, 5, 5, 75, 3), b('goblet-squat', 3, 10, 12, 90, 6),
    b('step-up-knee-drive', 3, 8, 10, 75, 4), b('slider-curl', 3, 8, 12, 60, 5), b('seated-soleus-raise', 3, 15, 20, 45, 7), b('band-ankle', 2, 15, 15, 30, 8) ] },
};

// Workouts you create (e.g. from an import) sit next to the built-in A/B/C.
const CUSTOM_ROUTINES = {};
export function setCustomRoutines(map) { for (const k of Object.keys(CUSTOM_ROUTINES)) delete CUSTOM_ROUTINES[k]; Object.assign(CUSTOM_ROUTINES, map || {}); }
// Workouts worked out from your others (busy weeks' Strength session): the app registers how to build them.
const DERIVED = {};
export const setDerivedRoutine = (id, build) => { DERIVED[id] = build; };
export const getRoutine = id => ROUTINES[id] || CUSTOM_ROUTINES[id] || DERIVED[id]?.() || null;
export const isRoutine = id => !!getRoutine(id);
// Leg-heavy: at least 40% of its exercises work the legs as a main muscle. The weekly plan keeps these off
// the day after padel (and, more strongly, the day before).
const LEG_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'glute_med', 'adductors', 'calves', 'soleus']);
export const legHeavyBlocks = (blocks = []) => blocks.length > 0 && blocks.filter(b => (getExercise(b.ex)?.primary || []).some(m => LEG_MUSCLES.has(m))).length / blocks.length >= 0.4;
export const isLegHeavy = id => legHeavyBlocks(getRoutine(id)?.blocks);
// Mostly upper body (shoulders, chest, back, arms): kept away from a session of overheads (see weekplan).
const UPPER_MUSCLES = new Set(['chest', 'upper_chest', 'lower_chest', 'front_delts', 'side_delts', 'rear_delts', 'rotator_cuff', 'serratus', 'traps', 'mid_back', 'lats', 'biceps', 'triceps', 'forearms']);
export const isUpperHeavy = id => { const b = getRoutine(id)?.blocks || []; return b.length > 0 && b.filter(x => (getExercise(x.ex)?.primary || []).some(m => UPPER_MUSCLES.has(m))).length / b.length >= 0.5; };
export const allRoutineIds = () => [...Object.keys(ROUTINES), ...Object.keys(CUSTOM_ROUTINES)];
export const isCustomRoutine = id => !!CUSTOM_ROUTINES[id];

// While a goal block runs, its phases replace the 4-week cycle (the app registers a source
// that returns the block's phase for a week, or null).
let phaseSource = null;
export const setPhaseSource = fn => { phaseSource = fn; };
export const phaseFor = week => phaseSource?.(week) || PHASES[(week - 1) % 4];

// overrides: { [routineId]: { [blockIndex]: { ex?, sets?, min?, max?, rest? }, _extra?: [block + { after }] } }
// `_extra` holds exercises you added to a built-in workout; each sits after the exercise
// named in `after` (null = first). profile: adapts the routine to equipment, time and level.
export function resolveRoutine(id, overrides = {}, profile = null) {
  const base = getRoutine(id);
  if (!base) return null;
  const o = overrides[id] || {};
  let blocks = base.blocks.map((blk, i) => ({ ...blk, ...(o[i] || {}), baseEx: blk.ex, index: i }));
  (o._extra || []).forEach((x, k) => {
    const blk = { pri: 2, ...x, baseEx: x.ex, index: `x${k}`, extra: true };
    const after = x.after == null ? -1 : blocks.findIndex(b => b.ex === x.after || b.baseEx === x.after);
    blocks.splice(x.after == null ? 0 : after < 0 ? blocks.length : after + 1, 0, blk);
  });
  // Your own order (`_order`: block keys). Exercises it doesn't mention stay where they were.
  if (o._order?.length) {
    const pos = new Map(o._order.map((k, i) => [String(k), i])), has = b => pos.has(String(b.index));
    const known = blocks.filter(has).sort((a, b) => pos.get(String(a.index)) - pos.get(String(b.index)));
    let k = 0; blocks = blocks.map(b => has(b) ? known[k++] : b);
  }
  if (!profile) return { ...base, blocks, dropped: [] };
  const overridden = new Set([...Object.entries(o).filter(([, v]) => v.ex).map(([k]) => +k), ...blocks.filter(b => b.extra).map(b => b.index)]);
  const a = adaptBlocks(blocks, profile, overridden);
  return { ...base, blocks: a.blocks, dropped: a.dropped, minutes: a.minutes };
}

// Turns a block into today's numbers. light = readiness-based trim.
export function prescribe(block, week, { light = false } = {}) {
  const p = phaseFor(week);
  let sets = Math.max(1, Math.round(block.sets * p.setMult));
  if (light && sets > 2) sets -= 1;
  const cap = Math.min(light ? 7 : 10, block.rpeCap || 10);
  const r = phaseRange(block, p) || block;
  return { sets, min: r.min, max: r.max, rest: r.rest, rpe: Math.min(p.rpe, cap), rir: p.rir, loadMult: p.loadMult, phase: p.name };
}

export function rangeLabel(block) {
  const ex = getExercise(block.ex);
  const unit = { reps: '', sec: 's', m: 'm' }[ex.fields[ex.fields.length - 1]];
  const r = block.min === block.max ? `${block.min}${unit}` : `${block.min}–${block.max}${unit}`;
  return ex.perSide ? `${r} / side` : r;
}

export function readinessScore(r) {
  if (!r) return null;
  const score = (r.sleep + r.energy + (6 - r.soreness)) / 3;
  return { score: Math.round(score * 10) / 10, label: score >= 3.7 ? 'Good' : score >= 2.7 ? 'Moderate' : 'Low' };
}

// Keep an exercise you added mid-workout. Built-in workouts store it as an extra in
// overrides; your own workouts get it inserted directly. Returns { overrides, customRoutines }.
export function keepExercise({ overrides = {}, customRoutines = {} }, id, block, after = null) {
  if (CUSTOM_ROUTINES[id] || customRoutines[id]) {
    const r = customRoutines[id] || CUSTOM_ROUTINES[id];
    if (r.blocks.some(b => b.ex === block.ex)) return { overrides, customRoutines };
    const blocks = [...r.blocks], at = after == null ? 0 : blocks.findIndex(b => b.ex === after) + 1 || blocks.length;
    blocks.splice(at, 0, { pri: 2, ...block });
    return { overrides, customRoutines: { ...customRoutines, [id]: { ...r, blocks } } };
  }
  const o = overrides[id] || {}, extra = o._extra || [];
  if (ROUTINES[id]?.blocks.some(b => b.ex === block.ex) || extra.some(x => x.ex === block.ex)) return { overrides, customRoutines };
  return { overrides: { ...overrides, [id]: { ...o, _extra: [...extra, { ...block, after }] } }, customRoutines };
}
export function removeExtra(overrides, id, k) {
  const o = overrides[id] || {}, extra = (o._extra || []).filter((_, i) => i !== k);
  // Extras after the removed one shift down a key; renumber them in your saved order.
  const order = o._order?.filter(x => x !== `x${k}`).map(x => /^x\d+$/.test(x) && +x.slice(1) > k ? `x${+x.slice(1) - 1}` : x);
  const next = { ...o, _extra: extra, ...(order ? { _order: order } : {}) };
  if (!extra.length) delete next._extra;
  return { ...overrides, [id]: next };
}

// Move one exercise of a workout up or down. `blocks` is the workout as you see it.
export function moveBlock(overrides, id, blocks, from, to) {
  if (to < 0 || to >= blocks.length || from === to) return overrides;
  const keys = blocks.map(b => String(b.index));
  const [k] = keys.splice(from, 1); keys.splice(to, 0, k);
  return { ...overrides, [id]: { ...(overrides[id] || {}), _order: keys } };
}

// A workout you did (e.g. a quick workout) saved as one of your workouts, ready to schedule.
export function routineFromWorkout(w, title, id = `q-${Date.now().toString(36)}`) {
  const blocks = w.exercises.filter(e => !e.skipped && (e.sets || []).some(s => s.done))
    .map((e, k) => ({ ex: e.exId, sets: Math.max(2, e.target?.sets || 3), min: e.target?.min ?? 8, max: e.target?.max ?? 12, rest: e.target?.rest ?? 90, pri: k + 1 }));
  return routineFromBlocks(title, blocks, { id, focus: 'Saved from a workout you did.' });
}

// A workout of your own from a list of blocks; time estimated from sets and rest.
// Same estimate the app uses everywhere else (sets, reps, rest, plus a short warm-up).
export const estimateRoutineMinutes = blocks => Math.max(10, estimateMinutes(blocks));
export function routineFromBlocks(title, blocks, { id = `w-${Date.now().toString(36)}`, focus = 'A workout you put together.' } = {}) {
  const bs = blocks.map((b, k) => ({ ...b, pri: k + 1 }));
  return { id, title: (title || '').trim() || 'My workout', custom: true, minutes: estimateRoutineMinutes(bs), focus, blocks: bs };
}
