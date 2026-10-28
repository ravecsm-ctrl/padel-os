// Program: routines (templates of blocks referencing catalog ids), phases and the
// rules that turn a block + week + readiness into today's prescription.
import { getExercise } from './domain-catalog.js';
import { adaptBlocks } from './domain-personalize.js';

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

export const phaseFor = week => PHASES[(week - 1) % 4];

// overrides: { [routineId]: { [blockIndex]: { ex?, sets?, min?, max?, rest? } } }
// profile: adapts the routine to equipment, time and level (see personalize.js).
export function resolveRoutine(id, overrides = {}, profile = null) {
  const base = ROUTINES[id];
  if (!base) return null;
  const o = overrides[id] || {};
  const blocks = base.blocks.map((blk, i) => ({ ...blk, ...(o[i] || {}), baseEx: blk.ex, index: i }));
  if (!profile) return { ...base, blocks, dropped: [] };
  const overridden = new Set(Object.entries(o).filter(([, v]) => v.ex).map(([k]) => +k));
  const a = adaptBlocks(blocks, profile, overridden);
  return { ...base, blocks: a.blocks, dropped: a.dropped, minutes: a.minutes };
}

// Turns a block into today's numbers. light = readiness-based trim.
export function prescribe(block, week, { light = false } = {}) {
  const p = phaseFor(week);
  let sets = Math.max(1, Math.round(block.sets * p.setMult));
  if (light && sets > 2) sets -= 1;
  const cap = Math.min(light ? 7 : 10, block.rpeCap || 10);
  return { sets, min: block.min, max: block.max, rest: block.rest, rpe: Math.min(p.rpe, cap), rir: p.rir, loadMult: p.loadMult, phase: p.name };
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
