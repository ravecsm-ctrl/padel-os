// This week's plan around the padel you've booked: where the gym workouts go, and which day suits
// another padel session best. Works on a 9-day window (last Sunday, Monday to Sunday, next Monday)
// so a Sunday match still counts against Monday's leg day. Pure functions.
import { NEXT_TO } from './domain-matchlevel.js';
import { padelProfile } from './domain-recovery.js';

// days: [{ iso, v, fixed, padel?, noGym? }] — v: routine id | 'Padel' | 'Rest' | 'Recovery';
// padel: { type, focus, level }. fixed days (past, done, swapped, neighbours) never change;
// noGym days (ones you can't train) take padel but no workout.
const isPadel = d => d?.v === 'Padel';
export const SCORE = { backToBack: 1.5, legsTwoDays: 2, armsBefore: 2, armsAfter: 1, padelTwoDays: 1, moved: 0.3 };

// How much a session next to padel costs: the match level's costs, scaled by how much that kind
// of session loads the legs (a ball machine barely does) and, for overheads, the arms.
function padelCost(p = {}) {
  const lv = NEXT_TO[p.level] || NEXT_TO.normal, pf = padelProfile(p.type, p.focus), scale = p.level === 'hard' ? 1.5 : p.level === 'easy' ? 0.5 : 1;
  return { before: lv.before * pf.legs, after: lv.after * pf.legs, other: lv.other * (pf.legs + pf.arms) / 2, arms: pf.arms >= 1.3 ? scale : 0, legs: pf.legs };
}

export function weekPenalty(days, { legs, upper = () => false }) {
  let sc = 0;
  days.forEach((d, i) => {
    const gym = !isPadel(d) && d.v !== 'Rest' && d.v !== 'Recovery' && d.v != null;
    if (gym) {
      const nx = days[i + 1], pv = days[i - 1];
      if (isPadel(nx)) { const c = padelCost(nx.padel); sc += legs(d.v) ? c.before : c.other; if (upper(d.v)) sc += c.arms * SCORE.armsBefore; }
      if (isPadel(pv)) { const c = padelCost(pv.padel); if (legs(d.v)) sc += c.after; if (upper(d.v)) sc += c.arms * SCORE.armsAfter; }
      // Next Monday's workout can still move (that week adapts too), so it counts half.
      const n = days[i + 1], ng = n && !isPadel(n) && n.v !== 'Rest' && n.v !== 'Recovery' && n.v != null, w = i + 1 === days.length - 1 ? 0.5 : 1;
      if (ng) { sc += SCORE.backToBack * w; if (legs(d.v) && legs(n.v)) sc += SCORE.legsTwoDays * w; }
    }
    if (isPadel(d) && isPadel(days[i + 1]) && padelCost(d.padel).legs >= 0.9 && padelCost(days[i + 1].padel).legs >= 0.9) sc += SCORE.padelTwoDays;
  });
  return sc;
}

function* choose(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc; return; }
  for (let i = start; i < arr.length; i++) yield* choose(arr, k, i + 1, [...acc, arr[i]]);
}
function* orders(arr) {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) for (const rest of orders([...arr.slice(0, i), ...arr.slice(i + 1)])) yield [arr[i], ...rest];
}

// Place `workouts` (routine ids still to do this week) on the free days. Keeps workouts where they
// already are unless moving them is clearly better. Returns { days, moved, dropped, score }.
// opts.alt = { from, to, cost }: also try the week with `to` in place of `from` (busy weeks: Durability for
// Upper Body) and keep it only if it's better by more than `cost`. The result then has swapped: { from, to }.
export function planWeek(days, workouts, opts) {
  const alt = opts.alt;
  if (alt && workouts.includes(alt.from)) {
    const keep = planWeek(days, workouts, { ...opts, alt: null });
    const swap = planWeek(days, workouts.map(id => id === alt.from ? alt.to : id), { ...opts, alt: null });
    // A stand-in that ends up skipped for the rest day isn't worth mentioning: keep the original.
    return swap.restKept !== alt.to && swap.score + (alt.cost ?? 0.5) < keep.score ? { ...swap, swapped: { from: alt.from, to: alt.to } } : keep;
  }
  return placeWeek(days, workouts, opts);
}
function placeWeek(days, workouts, opts) {
  const free = days.map((d, i) => i).filter(i => i > 0 && i < days.length - 1 && !days[i].fixed && !isPadel(days[i]) && !days[i].noGym);
  // Where each workout is now (opts.was adds one that sat on a day that just became padel).
  const was = new Map([...days.map((d, i) => [d.v, i]).filter(([v], i) => workouts.includes(v) && !days[i].fixed), ...Object.entries(opts.was || {})]);
  const n = Math.min(workouts.length, free.length);
  // Days you can't train keep what they have (a Recovery day stays), unless it's a workout to re-place.
  const base = days.map(d => !d.fixed && !isPadel(d) && (!d.noGym || workouts.includes(d.v)) ? { ...d, v: 'Rest' } : d);
  let best = null;
  const keep = [...choose(workouts.map((_, i) => i), n)];
  for (const pick of keep) for (const slots of choose(free, n)) for (const order of orders(pick)) {
    const trial = base.map(d => ({ ...d }));
    let moves = 0;
    // The anchor (busy weeks' Strength session) is protected: moving it costs three times as much.
    slots.forEach((s, k) => { const id = workouts[order[k]]; trial[s].v = id; if (was.get(id) !== s) moves += id === opts.anchor ? 3 : 1; });
    const score = weekPenalty(trial, opts) + moves * SCORE.moved;
    if (!best || score < best.score - 1e-9) best = { trial, score, dropped: workouts.filter((_, i) => !pick.includes(i)) };
  }
  if (!best) best = { trial: base, score: weekPenalty(base, opts), dropped: [...workouts] };
  // Keep one Recovery day if the week had one: the same day if it's still free, else the day after padel.
  const orig = free.find(i => days[i].v === 'Recovery');
  if (orig != null || opts.recovery) {
    const rest = free.filter(i => best.trial[i].v === 'Rest');
    const at = rest.includes(orig) ? orig : rest.find(i => isPadel(best.trial[i - 1])) ?? rest[0];
    if (at != null) best.trial[at].v = 'Recovery';
  }
  // A busy week always keeps one day with nothing at all: a recovery day becomes rest, and if every day is
  // taken, the session that's light on the legs is skipped this week (Strength stays).
  let restKept = null;
  if (opts.busy && !best.trial.slice(1, -1).some(d => d.v === 'Rest')) {
    const spare = free.filter(i => best.trial[i].v === 'Recovery').concat(days.map((d, i) => i).filter(i => i > 0 && i < days.length - 1 && !days[i].fixed && days[i].noGym && best.trial[i].v === 'Recovery'));
    const flex = free.find(i => workouts.includes(best.trial[i].v) && best.trial[i].v !== opts.anchor);
    if (spare.length) best.trial[spare[0]].v = 'Rest';
    else if (flex != null) { restKept = best.trial[flex].v; best.dropped = [...best.dropped, restKept]; best.trial[flex].v = 'Rest'; }
  }
  const moved = workouts.filter(id => !best.dropped.includes(id)).map(id => ({ id, from: was.has(id) ? days[was.get(id)].iso : null, to: best.trial.find((d, i) => free.includes(i) && d.v === id)?.iso }))
    .filter(m => m.from !== m.to);
  return { days: best.trial, moved, dropped: best.dropped, score: best.score, restKept };
}

// Routines still to do: planned on days you can still change (today if nothing's logged yet, and later).
export const workoutsLeft = (days, isRoutine) => days.filter((d, i) => i > 0 && i < days.length - 1 && !d.fixed && isRoutine(d.v)).map(d => d.v);

// Put padel on a day (it becomes fixed) and re-plan. The workout that was there gets a new day.
export function withPadel(days, iso, padel, workouts, opts) {
  const at = days.findIndex(d => d.iso === iso);
  if (at < 0) return null;
  const next = days.map((d, i) => i === at ? { ...d, v: 'Padel', padel, fixed: true } : d);
  // Padel on your Recovery day: the Recovery day moves rather than disappears.
  return planWeek(next, workouts, { ...opts, recovery: days[at].v === 'Recovery' && !days[at].fixed, was: workouts.includes(days[at].v) ? { [days[at].v]: at } : {} });
}

// The best days for one more padel session of this kind: each free day tried in turn, best first.
// [{ iso, score, moved, dropped, rank: 'best' | 'good' | 'ok' }], at most `max`.
// targets: the workouts to place, or a function of the week with the new session that returns
// { list, busy } (a session that makes the week busy changes which workouts there are).
export function suggestPadelDays(days, padel, targets, opts, max = 3) {
  const out = [];
  days.forEach((d, i) => {
    if (i === 0 || i === days.length - 1 || d.fixed || isPadel(d)) return;
    const t = typeof targets === 'function' ? targets(days.map(x => x.iso === d.iso ? { ...x, v: 'Padel', padel, fixed: true } : x)) : { list: targets, busy: !!opts.busy };
    const r = withPadel(days, d.iso, padel, t.list, { ...opts, busy: t.busy, alt: t.alt });
    out.push({ iso: d.iso, score: r.score + r.dropped.length * 10, moved: r.moved, dropped: r.dropped, days: r.days, busy: t.busy });
  });
  out.sort((a, b) => a.score - b.score || a.iso.localeCompare(b.iso));
  const top = out[0]?.score ?? 0;
  return out.slice(0, max).map(s => ({ ...s, rank: s.score - top < 0.5 ? 'best' : s.score - top < 2 ? 'good' : 'ok' }));
}
