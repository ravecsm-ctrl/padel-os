// Turns a routine template into the version that fits this person: their equipment,
// time per session and level. Pure functions; see tests for the guarantees.
import { getExercise, EXERCISES, PATTERN_FALLBACK, targetField } from './domain-catalog.js';
import { canDoWith } from './domain-taxonomy.js';
import { DAYS } from './domain-program.js';
import { NEXT_TO } from './domain-matchlevel.js';

export const DEFAULT_PROFILE = {
  onboarded: false, goal: 'perform', level: 'intermediate', equipment: 'gym', minutes: 70,
  days: 3, padelDays: ['Tue', 'Sat'], injuries: [], simple: true,
};
export const EQUIPMENT = { gym: 'Full gym', db: 'Dumbbells at home', bw: 'No equipment' };
export const MINUTES = [20, 40, 70];
export const LEVELS = { beginner: 'New to strength training', intermediate: 'Train semi-regularly', advanced: 'Lift regularly' };
export const GOALS = { perform: 'Move better on court', injury: 'Stay injury-free', fitness: 'Get fitter & stronger' };
export const AREAS = { elbow: 'Elbow / forearm', shoulder: 'Shoulder', back: 'Lower back', knee: 'Knee', calf: 'Calf / Achilles', ankle: 'Ankle' };

const RANK = { bw: 0, db: 1, gym: 2 };
// `equipment` is either a tier ('gym' | 'db' | 'bw') or a Set of equipment ids you own.
export const allowed = (ex, equipment) => equipment instanceof Set ? canDoWith(ex.needs || [], equipment) : RANK[ex.kit] <= RANK[equipment];

// Best exercise for a slot given the kit: the original, then its substitutes, then the pattern fallbacks.
export function pickExercise(exId, equipment, used = new Set()) {
  const ex = getExercise(exId);
  if (allowed(ex, equipment)) return exId;
  const queue = [...ex.subs], seen = new Set([exId]), candidates = [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const c = getExercise(id);
    if (!c) continue;
    if (allowed(c, equipment) && !used.has(id)) candidates.push(c);
    queue.push(...c.subs);
  }
  // Same movement pattern first, so a hinge is replaced by a hinge, not a lunge.
  return candidates.find(c => c.pattern === ex.pattern)?.id
    || (PATTERN_FALLBACK[ex.pattern] || []).find(id => allowed(getExercise(id), equipment) && !used.has(id))
    || candidates[0]?.id
    || EXERCISES.find(c => c.pattern === ex.pattern && allowed(c, equipment) && !used.has(c.id))?.id
    || (PATTERN_FALLBACK[ex.pattern] || [])[0] || exId;
}

// Rough time for one block in seconds: work + rest per set, plus a minute to set up.
export function blockSeconds(blk) {
  const ex = getExercise(blk.ex), tf = targetField(ex), sides = ex.perSide ? 2 : 1;
  const work = tf === 'sec' ? blk.max * sides : tf === 'm' ? 45 : 35 * sides;
  return blk.sets * (work + blk.rest) + 60;
}
export const estimateMinutes = (blocks, minutes = 70) => Math.round((blocks.reduce((n, b) => n + blockSeconds(b), 0) + (minutes <= 20 ? 180 : 360)) / 60);

export function adaptBlocks(blocks, profile = DEFAULT_PROFILE, overridden = new Set()) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  // A location's equipment list, when given, replaces the coarse tier.
  const kit = Array.isArray(p.owned) ? new Set(p.owned) : p.equipment;
  const hasWeights = kit instanceof Set ? ['dumbbells', 'kettlebell'].some(k => kit.has(k)) : kit !== 'bw';
  // Reserve exercises that stay as they are, so a substitute never duplicates a later slot.
  const used = new Set(blocks.filter(b => overridden.has(b.index) || allowed(getExercise(b.ex), kit)).map(b => b.ex));
  let out = blocks.map(blk => {
    const b = { ...blk };
    // Equipment: an explicit user choice in Plan always wins.
    if (!overridden.has(b.index)) {
      const id = pickExercise(b.ex, kit, used);
      if (id !== b.ex) {
        const from = getExercise(b.ex), to = getExercise(id);
        if (targetField(to) !== targetField(from) && to.range) [b.min, b.max] = to.range;
        b.adaptedFrom = b.ex; b.ex = id;
      }
    }
    used.add(b.ex);
    const ex = getExercise(b.ex);
    // Without load available, log reps/time only.
    b.noLoad = ex.fields.includes('w') && ex.loadOptional && !hasWeights;
    // Without load, low-rep strength ranges are too easy: move to at least 8–12.
    const unloaded = b.noLoad || (b.adaptedFrom && !ex.fields.includes('w') && getExercise(b.adaptedFrom).fields.includes('w'));
    if (unloaded && targetField(ex) === 'reps' && !ex.quality && b.min < 8) { b.min = 8; b.max = Math.max(b.max, 12); }
    // Level.
    if (p.level === 'beginner') { if (b.sets >= 3) b.sets -= 1; b.rpeCap = 7; }
    // Time.
    if (p.minutes <= 20) { b.sets = Math.min(b.sets, 2); b.rest = Math.max(30, Math.round((b.rest * 0.7) / 15) * 15); }
    else if (p.minutes <= 40) { b.sets = Math.min(b.sets, 3); b.rest = Math.max(30, Math.round((b.rest * 0.85) / 15) * 15); }
    return b;
  });

  // Keep the highest-priority blocks that fit the time budget (minimum three), in original order.
  const budget = p.minutes * 60 - (p.minutes <= 20 ? 180 : 360);
  const byPri = [...out].sort((a, b) => (a.pri ?? a.index) - (b.pri ?? b.index));
  const keep = new Set();
  let total = 0;
  for (const b of byPri) {
    const s = blockSeconds(b);
    if (keep.size < 3 || total + s <= budget) { keep.add(b.index); total += s; }
  }
  const dropped = out.filter(b => !keep.has(b.index));
  out = out.filter(b => keep.has(b.index));
  return { blocks: out, dropped, minutes: estimateMinutes(out, p.minutes) };
}

// The weekly plan. Gym days never go on padel days; where they can, they also stay off the day before
// a match (you'd play on tired legs) and leg-heavy workouts stay off the day after one (legs still recovering).
// Every choice of days and order is scored and the lowest wins; ties keep the earliest days and the given order.
// Next to a padel day, the cost depends on how hard it is (matchlevel.NEXT_TO); these are the rest.
const SCORE = { backToBack: 1.5, legsTwoDays: 2, uneven: 0.3 };
const defaultLegs = id => id === 'A' || id === 'C';
const choose = (arr, k) => k === 0 ? [[]] : arr.flatMap((x, i) => choose(arr.slice(i + 1), k - 1).map(r => [x, ...r]));
const orders = a => a.length <= 1 ? [a] : a.flatMap((x, i) => orders([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));

// Penalty for gym workouts on these day indexes (0 = Monday), given the padel days.
// levels: how hard each padel weekday usually is ({ Sat: 'hard' }); unset days are normal.
// kinds: what each padel weekday usually is, as load factors ({ Thu: { legs: 0.64, arms: 1.54 } }, from
// recovery.padelProfile): a lesson or ball machine weighs less on the legs, and overheads keep
// upper-body pressing (upper) away from the day before and after.
function weekPenalty(dayIdx, ids, padelDays, legs, levels = {}, { kinds = {}, upper = () => false } = {}) {
  const day = i => DAYS[(i + 7) % 7], padel = i => padelDays.includes(day(i)), cost = i => NEXT_TO[levels[day(i)]] || NEXT_TO.normal;
  // Arms count like in weekplan: only for overhead-heavy sessions, more for a hard one, less for an easy one.
  const legsOf = i => kinds[day(i)]?.legs ?? 1, armsOf = i => (kinds[day(i)]?.arms ?? 1) >= 1.3 ? ({ hard: 1.5, easy: 0.5 }[levels[day(i)]] ?? 1) : 0;
  let sc = 0;
  dayIdx.forEach((i, k) => {
    const heavy = legs(ids[k]);
    if (padel(i + 1)) sc += heavy ? cost(i + 1).before * legsOf(i + 1) : cost(i + 1).other;
    if (padel(i - 1) && heavy) sc += cost(i - 1).after * legsOf(i - 1);
    if (upper(ids[k])) sc += (padel(i + 1) ? 2 * armsOf(i + 1) : 0) + (padel(i - 1) ? armsOf(i - 1) : 0);
  });
  if (dayIdx.length > 1) {
    const gaps = dayIdx.map((x, k) => ((dayIdx[(k + 1) % dayIdx.length] - x + 7) % 7) || 7);
    sc += gaps.filter(g => g === 1).length * SCORE.backToBack + (Math.max(...gaps) - Math.min(...gaps)) * SCORE.uneven;
    // Two leg-heavy workouts on consecutive days.
    dayIdx.forEach((x, k) => { const j = dayIdx.indexOf((x + 1) % 7); if (j >= 0 && legs(ids[k]) && legs(ids[j])) sc += SCORE.legsTwoDays; });
  }
  return sc;
}

// Best days and order for these workouts: { days: ['Mon', ...], ids: [...], score }.
// canTrain: the weekdays you can get to the gym (all of them when not set).
export function bestWeek(ids, padelDays = [], legs = defaultLegs, levels = {}, canTrain = null, opts = {}) {
  const free = DAYS.map((_, i) => i).filter(i => !padelDays.includes(DAYS[i]) && (!canTrain?.length || canTrain.includes(DAYS[i])));
  const n = Math.min(ids.length, free.length);
  let best = null;
  for (const set of choose(free, n)) for (const order of orders(ids.slice(0, n))) {
    const score = weekPenalty(set, order, padelDays, legs, levels, opts);
    if (!best || score < best.score - 1e-9) best = { days: set.map(i => DAYS[i]), ids: order, score };
  }
  return best || { days: [], ids: [], score: 0 };
}

// How a schedule you already have scores, on the same scale.
export function scheduleScore(sched, isGym, legs = defaultLegs, levels = {}, opts = {}) {
  const padelDays = DAYS.filter(d => sched[d] === 'Padel'), gym = DAYS.filter(d => isGym(sched[d]));
  return weekPenalty(gym.map(d => DAYS.indexOf(d)), gym.map(d => sched[d]), padelDays, legs, levels, opts);
}

export function generateSchedule(days, padelDays = [], ids = null, legs = defaultLegs, canTrain = null, levels = {}, opts = {}) {
  const sched = Object.fromEntries(DAYS.map(d => [d, padelDays.includes(d) ? 'Padel' : 'Rest']));
  const routines = ids ? ids.slice(0, Math.max(1, days)) : days >= 3 ? ['A', 'B', 'C'] : days === 2 ? ['A', 'B'] : ['A'];
  const w = bestWeek(routines, padelDays, legs, levels, canTrain, opts);
  w.days.forEach((d, i) => { sched[d] = w.ids[i]; });
  // One recovery day in the remaining rest days, if any.
  const rest = DAYS.filter(d => sched[d] === 'Rest');
  if (rest.length > 1) sched[rest[Math.floor(rest.length / 2)]] = 'Recovery';
  return sched;
}
