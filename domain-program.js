// Program: routines (templates of blocks referencing catalog ids), phases and the
// rules that turn a block + week + readiness into today's prescription.
import { getExercise } from './domain-catalog.js';

export const PHASES = [
  { week: 1, name: 'Foundation', rpe: 7, rir: 3, setMult: 1, loadMult: 1, note: 'Baseline load and listed volume. Leave ~3 reps in reserve.' },
  { week: 2, name: 'Build', rpe: 7.5, rir: 2, setMult: 1, loadMult: 1, note: 'Add a rep per set or a small load jump — only with crisp technique.' },
  { week: 3, name: 'Peak', rpe: 8, rir: 2, setMult: 1, loadMult: 1, note: 'Heaviest week. Never grind. Trim accessories if padel load is high.' },
  { week: 4, name: 'Deload', rpe: 6, rir: 4, setMult: 0.6, loadMult: 0.88, note: '~40% fewer sets and ~12% less load. Recover, then start a new cycle.' },
];

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_OPTIONS = ['A', 'B', 'C', 'Padel', 'Recovery', 'Rest'];
export const DEFAULT_SCHEDULE = { Mon: 'A', Tue: 'Padel', Wed: 'B', Thu: 'Recovery', Fri: 'C', Sat: 'Padel', Sun: 'Rest' };

const b = (ex, sets, min, max, rest) => ({ ex, sets, min, max, rest });

export const ROUTINES = {
  A: { id: 'A', title: 'Lower Force & Deceleration', minutes: 75, focus: 'Braking strength, lateral control and a resilient trunk.', blocks: [
    b('trap-bar-deadlift', 4, 4, 6, 150), b('rfess', 3, 8, 10, 90), b('lateral-lunge', 3, 8, 10, 75), b('sl-rdl', 3, 8, 10, 75),
    b('copenhagen-short', 3, 20, 30, 60), b('pallof-press', 3, 10, 12, 45), b('standing-calf-raise', 3, 12, 15, 60), b('tibialis-raise', 3, 15, 20, 45) ] },
  B: { id: 'B', title: 'Upper Strength & Rotation', minutes: 70, focus: 'Shoulder-friendly pressing, pulling, rotation and grip.', blocks: [
    b('landmine-press', 4, 8, 10, 90), b('chest-supported-row', 4, 8, 10, 90), b('incline-db-press', 3, 8, 10, 90), b('cable-row-rotation', 3, 10, 12, 60),
    b('cable-er', 3, 12, 15, 45), b('face-pull', 3, 15, 20, 45), b('wrist-rotation', 2, 15, 20, 30), b('farmer-carry', 3, 30, 40, 60) ] },
  C: { id: 'C', title: 'Power & Athletic Resilience', minutes: 65, focus: 'Convert strength into explosive, controlled court movement.', blocks: [
    b('cmj', 4, 3, 3, 90), b('lateral-bound', 3, 5, 5, 75), b('mb-scoop-toss', 4, 5, 5, 75), b('goblet-squat', 3, 10, 12, 90),
    b('step-up-knee-drive', 3, 8, 10, 75), b('slider-curl', 3, 8, 12, 60), b('seated-soleus-raise', 3, 15, 20, 45), b('band-ankle', 2, 15, 15, 30) ] },
};

export const phaseFor = week => PHASES[(week - 1) % 4];

// overrides: { [routineId]: { [blockIndex]: { ex?, sets?, min?, max?, rest? } } }
export function resolveRoutine(id, overrides = {}) {
  const base = ROUTINES[id];
  if (!base) return null;
  const o = overrides[id] || {};
  return { ...base, blocks: base.blocks.map((blk, i) => ({ ...blk, ...(o[i] || {}), baseEx: blk.ex, index: i })) };
}

// Turns a block into today's numbers. light = readiness-based trim.
export function prescribe(block, week, { light = false } = {}) {
  const p = phaseFor(week);
  let sets = Math.max(1, Math.round(block.sets * p.setMult));
  if (light && sets > 2) sets -= 1;
  return { sets, min: block.min, max: block.max, rest: block.rest, rpe: light ? Math.min(p.rpe, 7) : p.rpe, rir: p.rir, loadMult: p.loadMult, phase: p.name };
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
