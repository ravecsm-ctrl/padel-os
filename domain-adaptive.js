// Adaptive workouts: adjust today's plan from recovery, soreness and context.
// At most one change per exercise, always with a reason, always undoable.
import { getExercise } from './domain-catalog.js';
import { MUSCLES } from './domain-taxonomy.js';
import { performances, doneSets } from './domain-progression.js';
import { roundLoad } from './domain-units.js';
import { TIRED_FROM } from './domain-recovery.js';

// From here a muscle counts as still recovering and the workout eases off (below TIRED_FROM it keeps every set).
export const RECOVERING_FROM = 0.35;
const LEGS = ['quads', 'hamstrings', 'glutes', 'glute_med', 'calves', 'soleus', 'adductors'];
// Exercises with a landing: jumps, bounds, hops.
export const lands = ex => (ex.quality || ex.pattern === 'power') && /jump|bound|hop|burpee/i.test(`${ex.id} ${ex.name}`);
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);

// How tired the muscles this exercise relies on are (main muscles count fully).
export function exerciseFatigue(ex, rec) {
  let worst = 0, who = null;
  for (const m of ex.primary || []) { const l = rec[m]?.level || 0; if (l > worst) { worst = l; who = m; } }
  for (const m of ex.secondary || []) { const l = (rec[m]?.level || 0) * 0.5; if (l > worst) { worst = l; who = m; } }
  return { level: worst, muscle: who };
}

// ctx: { rec, sore:[muscles], readiness:{label}, padelTomorrow, loadRatio, deload, level, history, unit }
export function adaptEntry(entry, ctx) {
  const ex = getExercise(entry.exId);
  if (!ex || entry.skipped) return null;
  const { level: fat, muscle } = exerciseFatigue(ex, ctx.rec || {});
  const sore = (ex.primary || []).find(m => (ctx.sore || []).includes(m));
  const name = m => lower(MUSCLES[m] || m);
  const sets = entry.sets.length, w = entry.suggestion?.w;
  const lighter = f => w != null ? roundLoad(w * f, ex.inc, ctx.unit || 'kg') : null;
  const down = (reason, opt = {}) => ({ dir: 'down', reason, sets: sets > 1 ? sets - 1 : sets, w: opt.lighter && w != null ? lighter(opt.lighter) : w });

  // Reductions, strongest first.
  if (sore && fat >= 0.3) return down(`${MUSCLES[sore]} feel sore and are still recovering`, { lighter: 0.9 });
  if (sore) return down(`You said your ${name(sore)} feel sore`);
  if (fat >= TIRED_FROM) return down(`${MUSCLES[muscle]} still tired from your last session`, { lighter: fat >= 0.8 ? 0.9 : 0.95 });
  if (ctx.padelTomorrow && (ex.primary || []).some(m => LEGS.includes(m)) && sets > 2) return down('Padel tomorrow: saving your legs');
  // Big week: trim the main work, keep injury-prevention and power work as is.
  if (ctx.loadRatio > 1.5 && sets > 2 && ex.category !== 'prevention' && ex.movement !== 'power') return down('Big training week: one set fewer');
  // Still recovering (not tired): keep the work, take the edge off. Jumps lose a set (tired legs and landings
  // don't mix; throws and swings have no landing, so they're treated like any other exercise), a planned weight jump waits, everything else is done at Solid effort.
  if (fat >= RECOVERING_FROM) {
    const why = `${MUSCLES[muscle]} still recovering${ctx.afterPadel ? ' after your match' : ''}`;
    if (lands(ex) && sets > 1) return { ...down(`${why}: one set fewer on jumps`), muscle };
    if (entry.suggestion?.kind === 'up') {
      const last = performances(ctx.history || [], ex.id, 1)[0];
      const lastTop = last ? Math.max(0, ...doneSets(last.entry).map(s => s.w || 0)) : 0;
      return { dir: 'hold', reason: `${why}, so same weight as last time`, sets, w: lastTop || w, muscle };
    }
    return { dir: 'ease', reason: `${why}: aim for Solid, not Hard`, sets, w, muscle };
  }
  // Challenge: fully recovered, felt easy last time, not a recovery week.
  if (!ctx.deload && ctx.level !== 'beginner' && ctx.readiness?.label !== 'Low' && fat < 0.1 && !ex.quality && entry.suggestion?.kind === 'hold' && sets < 5) {
    const last = performances(ctx.history || [], ex.id, 1)[0];
    const rpes = last ? doneSets(last.entry).map(s => s.rpe).filter(Boolean) : [];
    if (rpes.length && rpes.reduce((a, b) => a + b, 0) / rpes.length <= 7) return { dir: 'up', reason: 'Fully recovered and it felt easy last time: one extra set', sets: sets + 1, w };
  }
  return null;
}

// Apply to a workout in place; keeps originals so the change can be undone.
export function adaptWorkout(w, ctx) {
  const changes = [];
  w.exercises.forEach((e, i) => {
    const c = adaptEntry(e, ctx);
    // An 'ease' keeps sets and weight on purpose: the change is the effort you aim for.
    if (!c || (c.dir !== 'ease' && c.sets === e.sets.length && c.w === e.suggestion?.w)) return;
    changes.push({ i, exId: e.exId, name: e.name, dir: c.dir, reason: c.reason, muscle: c.muscle ?? exerciseFatigue(getExercise(e.exId), ctx.rec || {}).muscle, from: { sets: e.sets.length, w: e.suggestion?.w ?? null }, to: { sets: c.sets, w: c.w ?? null } });
  });
  w.adapt = { changes, applied: false, inputs: { sore: ctx.sore || [], readiness: ctx.readiness?.label || null, padelTomorrow: !!ctx.padelTomorrow } };
  if (changes.length) applyAdaptation(w);
  return w.adapt;
}

const blankSet = () => ({ w: null, reps: null, sec: null, m: null, rpe: null, done: false });
function setTo(e, sets, wt) {
  // Never drop sets you've already completed.
  const doneN = e.sets.filter(s => s.done).length, n = Math.max(sets, doneN);
  while (e.sets.length < n) e.sets.push(blankSet());
  while (e.sets.length > n) { const k = e.sets.map(s => s.done).lastIndexOf(false); if (k < 0) break; e.sets.splice(k, 1); }
  e.target.sets = e.sets.length;
  if (e.suggestion) e.suggestion.w = wt;
}
export function applyAdaptation(w) {
  if (!w.adapt || w.adapt.applied) return;
  for (const c of w.adapt.changes) { const e = w.exercises[c.i]; if (e?.exId === c.exId) { setTo(e, c.to.sets, c.to.w); e.adjusted = c; } }
  w.adapt.applied = true;
}
export function revertAdaptation(w) {
  if (!w.adapt || !w.adapt.applied) return;
  for (const c of w.adapt.changes) { const e = w.exercises[c.i]; if (e?.exId === c.exId) { setTo(e, c.from.sets, c.from.w); delete e.adjusted; } }
  w.adapt.applied = false;
}
