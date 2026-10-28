// Muscle recovery estimates. Each session adds fatigue to the muscles it used; fatigue
// fades linearly over a recovery window that depends on muscle size and dose, scaled by
// a personal factor learned from "sore / fine" feedback. These are estimates, not
// measurements: recovery varies a lot between people.
import { getExercise } from './domain-catalog.js';
import { doneSets } from './domain-progression.js';
import { MUSCLES } from './domain-taxonomy.js';
import { SECONDARY_WEIGHT } from './domain-muscles.js';

const HOUR = 3600000;
export const STANDARD_DOSE = 6;   // "a solid session" for one muscle, in weighted sets
// Bigger muscles take longer; small ones bounce back faster.
const BASE_HOURS = {
  quads: 60, hamstrings: 60, glutes: 60, adductors: 54, lower_back: 54, glute_med: 48, hip_flexors: 36,
  upper_chest: 48, chest: 48, lower_chest: 48, mid_back: 48, lats: 48, traps: 40, front_delts: 44, side_delts: 40, rear_delts: 40,
  biceps: 36, triceps: 36, forearms: 36, calves: 36, soleus: 36, shins: 30, rotator_cuff: 36, abs: 30, obliques: 30,
};
// Padel: weighted "sets" per 30 minutes at a moderate effort. Lots of lunging, lateral
// pushing and push-offs; overheads and volleys load the front of the shoulder and grip.
const PADEL_LOAD = { calves: 1.2, soleus: 1.0, quads: 1.1, adductors: 1.1, glutes: 0.8, glute_med: 0.9, hip_flexors: 0.5, front_delts: 0.6, side_delts: 0.3, rear_delts: 0.3,
  forearms: 0.9, rotator_cuff: 0.6, obliques: 0.7, abs: 0.5, shins: 0.6 };
export const READY_BELOW = 0.2;     // fatigue level under which a muscle counts as ready
export const TIRED_FROM = 0.6;

const effort = rpe => rpe == null ? 1 : rpe <= 6 ? 0.85 : rpe <= 7 ? 1 : rpe <= 8 ? 1.15 : rpe <= 9 ? 1.3 : 1.45;
// Bigger doses stretch the recovery window a little (capped); the fatigue they add is
// capped at "fully tired". Targets: very hard ~60 h, solid ~48 h, light ~1 day (big muscles).
const windowHours = (m, dose, cal = {}) => (BASE_HOURS[m] || 48) * Math.min(1.25, Math.max(0.6, 0.55 + 0.45 * dose / STANDARD_DOSE)) * (cal[m] || 1);

// Fatigue "events": [{ t, muscle, dose }]
export function events(sessions, since) {
  const out = [];
  for (const s of sessions) {
    if (s.startedAt < since) continue;
    const t = s.endedAt || s.startedAt;
    if (s.kind === 'strength') {
      const by = {};
      for (const e of s.exercises || []) {
        const ex = getExercise(e.exId), sets = doneSets(e);
        if (!ex || !sets.length) continue;
        const dose = sets.reduce((n, x) => n + effort(x.rpe ?? s.rpe), 0);
        for (const m of ex.primary || []) by[m] = (by[m] || 0) + dose;
        for (const m of ex.secondary || []) if (!(ex.primary || []).includes(m)) by[m] = (by[m] || 0) + dose * SECONDARY_WEIGHT;
      }
      for (const [m, dose] of Object.entries(by)) out.push({ t, muscle: m, dose });
    } else if (s.kind === 'activity' && (s.activity === 'padel' || s.activity === 'cardio')) {
      const k = (s.durationMin || 0) / 30 * effort(s.rpe) * (s.activity === 'cardio' ? 0.5 : 1);
      for (const [m, w] of Object.entries(PADEL_LOAD)) if (s.activity === 'padel' || ['calves', 'soleus', 'quads', 'glutes'].includes(m)) out.push({ t, muscle: m, dose: w * k });
    }
  }
  return out;
}

// Fatigue level 0..1 for one muscle at time `now`.
export function fatigueAt(evts, muscle, now, cal = {}) {
  let F = 0;
  for (const e of evts) {
    if (e.muscle !== muscle || e.t > now) continue;
    const h = windowHours(muscle, e.dose, cal), left = 1 - (now - e.t) / (h * HOUR);
    if (left > 0) F += Math.min(1, e.dose / STANDARD_DOSE) * left;
  }
  return Math.min(1, F);
}

export function hoursUntilReady(evts, muscle, now, cal = {}) {
  if (fatigueAt(evts, muscle, now, cal) < READY_BELOW) return 0;
  for (let h = 1; h <= 168; h++) if (fatigueAt(evts, muscle, now + h * HOUR, cal) < READY_BELOW) return h;
  return 168;
}

export function stateFor(level) {
  if (level < READY_BELOW) return { key: 'ready', label: 'Ready' };
  if (level < TIRED_FROM) return { key: 'recovering', label: 'Recovering' };
  return { key: 'tired', label: 'Tired' };
}

export const roundHours = h => h <= 0 ? '' : h < 1 ? 'ready soon' : h < 48 ? `~${Math.max(1, Math.round(h))} h` : `~${Math.round(h / 24)} days`;

// Full picture: { muscleId: { level, state, hours, label } }
export function recoveryMap(sessions, now = Date.now(), cal = {}) {
  const evts = events(sessions, now - 8 * 24 * HOUR);
  return Object.fromEntries(Object.keys(MUSCLES).map(m => {
    const level = Math.round(fatigueAt(evts, m, now, cal) * 100) / 100, st = stateFor(level), hours = hoursUntilReady(evts, m, now, cal);
    return [m, { level, ...st, hours, when: roundHours(hours) }];
  }));
}

// Red → orange → yellow → green, using Apple's system colours.
const STOPS = [[0, [52, 199, 89]], [0.2, [52, 199, 89]], [0.4, [255, 204, 0]], [0.6, [255, 149, 0]], [1, [255, 59, 48]]];
export function colorFor(level) {
  const l = Math.max(0, Math.min(1, level));
  for (let i = 1; i < STOPS.length; i++) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
    if (l <= b) { const t = (l - a) / (b - a || 1); return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`; }
  }
  return 'rgb(255,59,48)';
}

// Learn from feedback. Sore while the model says ready → recover slower; fine while it
// says tired → recover faster. Bounded so one answer can't swing it far.
export function calibrate(cal, muscle, feltSore, level) {
  const k = cal[muscle] || 1;
  let next = k;
  if (feltSore && level < 0.35) next = k * 1.15;
  else if (!feltSore && level >= 0.4) next = k * 0.88;
  return { ...cal, [muscle]: Math.round(Math.min(1.8, Math.max(0.6, next)) * 100) / 100 };
}
