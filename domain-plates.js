// Warm-up sets and plate maths. Pure functions; loads are in kg unless noted.
import { roundLoad, toDisplay } from './domain-units.js';

// Bars, in display units. Trap bars vary a lot, so these can be changed (`custom`: { unit: { kind: w } }).
export const BARS = { barbell: { kg: 20, lb: 45 }, trap_bar: { kg: 25, lb: 55 } };
export const barWeight = (kind, unit, custom = {}) => custom?.[unit]?.[kind] ?? BARS[kind][unit];
export const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };

// Which bar an exercise is loaded on, if any.
export function barFor(ex) {
  const needs = (ex?.needs || []).join('|').split('|');
  return needs.includes('trap_bar') ? 'trap_bar' : needs.includes('barbell') ? 'barbell' : null;
}

// Plates per side for a total load, all in display units. Greedy works for standard plate
// sets. `left` > 0 means the exact load can't be made with these plates.
export function platesPerSide(total, bar, unit = 'kg') {
  if (total == null || total < bar) return { plates: [], left: 0, under: total != null };
  let side = (total - bar) / 2;
  const plates = [];
  for (const p of PLATES[unit]) while (side >= p - 1e-9) { plates.push(p); side -= p; }
  return { plates, left: Math.round(side * 100) / 100, under: false };
}

// Warm-up ramp before the first working set: lighter sets that get you ready without
// tiring you. Heavier work gets more steps. Returns [{ w (kg), reps, bar? }].
export function warmupSets(workKg, { inc = 2.5, unit = 'kg', barKg = 0, perHand = false } = {}) {
  if (!(workKg > 0)) return [];
  const minW = perHand ? 12 : 30;
  if (workKg < minW) return [];
  const steps = perHand ? [[0.5, 8]] : workKg >= 100 ? [[0.4, 5], [0.6, 3], [0.8, 2]] : workKg >= 60 ? [[0.5, 5], [0.75, 3]] : [[0.5, 6], [0.75, 3]];
  const out = [];
  if (barKg && barKg < workKg * 0.4) out.push({ w: barKg, reps: 8, bar: true });
  for (const [pct, reps] of steps) {
    const w = Math.max(barKg, roundLoad(workKg * pct, inc, unit));
    if (w < workKg && !out.some(o => Math.abs(toDisplay(o.w, unit) - toDisplay(w, unit)) < 0.01)) out.push({ w, reps });
  }
  return out;
}
