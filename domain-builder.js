// Program builder: scores every exercise against your focus, equipment, level and
// injury areas, then lays the best ones out into balanced, well-ordered sessions.
// Pure functions; every pick carries a plain-language reason.
import { allExercises, getExercise, targetField } from './domain-catalog.js';
import { MUSCLES, canDoWith } from './domain-taxonomy.js';
import { blockSeconds } from './domain-personalize.js';

export const FOCUS = {
  legs: { label: 'Strong legs', sub: 'Braking, lunging and changing direction', muscles: { quads: 1, glutes: 1, hamstrings: 1, adductors: 0.8, calves: 0.4 }, categories: ['lower-strength'], movements: ['squat', 'hinge', 'single-leg', 'lateral'] },
  upper: { label: 'Upper-body strength', sub: 'Pressing, pulling and grip', muscles: { chest: 1, upper_back: 1, lats: 1, shoulders: 0.8, arms: 0.6, forearms: 0.4 }, categories: ['upper-strength'], movements: ['push', 'pull'] },
  shoulders: { label: 'Healthy shoulders', sub: 'For bandejas, viboras and smashes', muscles: { rotator_cuff: 1, shoulders: 0.9, upper_back: 0.8 }, categories: ['prevention'], movements: ['pull'] },
  power: { label: 'Power & agility', sub: 'Faster first step, explosive shots', muscles: { glutes: 0.5, quads: 0.4, obliques: 0.5 }, categories: ['power'], movements: ['power', 'rotation', 'lateral'] },
  core: { label: 'Core & rotation', sub: 'Stable trunk, powerful rotation', muscles: { core: 1, obliques: 1, lower_back: 0.6 }, categories: ['core'], movements: ['anti-rotation', 'rotation', 'carry'] },
  prevention: { label: 'Stay injury-free', sub: 'Elbows, shoulders, knees, calves', muscles: { rotator_cuff: 0.8, forearms: 0.8, adductors: 0.8, calves: 0.9, shins: 0.9 }, categories: ['prevention'], movements: ['calf-ankle'] },
};
// Injury areas shift the prevention focus toward the muscles that protect them.
const AREA_MUSCLES = { elbow: ['forearms'], shoulder: ['rotator_cuff', 'shoulders'], back: ['core', 'lower_back', 'glutes'], knee: ['quads', 'adductors', 'glutes'], calf: ['calves'], ankle: ['shins', 'calves'] };
const PADEL = new Set(['lateral', 'single-leg', 'power', 'rotation', 'anti-rotation', 'calf-ankle']);
const ORDER = { power: 0, squat: 1, hinge: 1, 'single-leg': 2, push: 2, pull: 2, lateral: 3, rotation: 3, carry: 4, 'anti-rotation': 4, 'calf-ankle': 5, mobility: 6 };
export const PER_SESSION = { 20: 4, 40: 6, 70: 8 };
const same = (a = [], b = []) => a.length === b.length && a.every(x => b.includes(x));
const loaded = ex => ex.fields.includes('w') && ex.weightType !== 'bodyweight';
const hits = (ex, ms) => (ex.primary || []).some(m => ms.includes(m));
// The backbone of each focus, tried in order; the best-scoring match is used.
const ANCHORS = {
  legs: [ex => ['squat', 'hinge'].includes(ex.movement) && ex.category === 'lower-strength' && loaded(ex), ex => ex.movement === 'single-leg'],
  upper: [ex => ex.movement === 'push' && ex.category === 'upper-strength', ex => ex.movement === 'pull' && ex.category === 'upper-strength'],
  shoulders: [ex => hits(ex, ['rotator_cuff']), ex => ex.movement === 'pull' && hits(ex, ['shoulders', 'upper_back'])],
  power: [ex => ex.movement === 'power'],
  core: [ex => ex.movement === 'anti-rotation', ex => ex.movement === 'rotation' || ex.movement === 'carry'],
  prevention: [ex => ex.movement === 'calf-ankle', ex => hits(ex, ['rotator_cuff', 'forearms', 'adductors'])],
};

function focusWeights(focuses, injuries = []) {
  return focuses.map((f, i) => {
    const def = FOCUS[f];
    let muscles = { ...def.muscles };
    if (f === 'prevention' && injuries.length) {
      muscles = Object.fromEntries(Object.entries(muscles).map(([m, w]) => [m, w * 0.5]));
      for (const a of injuries) for (const m of AREA_MUSCLES[a] || []) muscles[m] = 1;
    }
    return { id: f, def, muscles, weight: [1, 0.8, 0.65, 0.5][i] ?? 0.4 };
  });
}

// Score one exercise. Returns { score, focus, reasons[], available }.
export function scoreExercise(ex, { focuses, owned = null, level = 'intermediate', injuries = [] }) {
  const fw = focusWeights(focuses, injuries);
  let best = { s: 0, f: null }, total = 0;
  for (const f of fw) {
    let s = 0;
    for (const m of ex.primary || []) s += f.muscles[m] || 0;
    for (const m of ex.secondary || []) s += (f.muscles[m] || 0) * 0.35;
    if (f.def.categories.includes(ex.category)) s += 0.9;
    if (f.def.movements.includes(ex.movement)) s += 0.5;
    s *= f.weight;
    total += s;
    if (s > best.s) best = { s, f };
  }
  const reasons = [];
  if (best.f) {
    const hits = (ex.primary || []).filter(m => best.f.muscles[m]).map(m => MUSCLES[m].toLowerCase());
    reasons.push(`${best.f.def.label}${hits.length ? `: works ${hits.slice(0, 2).join(' and ')}` : ''}`);
  }
  if (PADEL.has(ex.movement)) { total += 0.35; if (reasons.length < 2) reasons.push('Padel-specific movement'); }
  const available = owned ? canDoWith(ex.needs || [], owned) : true;
  if (level === 'beginner' && ex.level === 'advanced') { total -= 1; reasons.push('Advanced, may be hard to start with'); }
  if (level === 'advanced' && ex.level === 'beginner' && ex.category !== 'prevention') total -= 0.25;
  if (injuries.some(a => a === 'knee' || a === 'ankle') && ex.movement === 'power') { total -= 0.6; reasons.push('Jumping: go gently with a sore knee or ankle'); }
  return { score: Math.round(total * 100) / 100, focus: best.f?.id || null, reasons, available };
}

export function rankExercises(opts, pool = allExercises()) {
  return pool.filter(e => e.primary?.length).map(ex => ({ ex, ...scoreExercise(ex, opts) }))
    .filter(r => r.score > 0.4).sort((a, b) => (b.available - a.available) || (b.score - a.score));
}

// Sensible sets/reps/rest for an exercise, by movement and level (imports keep their own).
export function prescriptionFor(ex, { level = 'intermediate', minutes = 40 } = {}) {
  const d = ex.defaults;
  if (d && d.min != null) return { sets: d.sets || 3, min: d.min, max: d.max ?? d.min, rest: d.rest ?? 90 };
  const tf = targetField(ex);
  let p;
  if (tf === 'sec') p = { sets: 3, min: 20, max: 40, rest: 45 };
  else if (tf === 'm') p = { sets: 3, min: 30, max: 40, rest: 60 };
  else if (ex.movement === 'power') p = { sets: 3, min: 3, max: 5, rest: 90 };
  else if (['squat', 'hinge'].includes(ex.movement) && ex.category === 'lower-strength' && ex.fields.includes('w')) {
    // Low reps only where heavy loading is practical (bars and machines).
    const heavy = (ex.needs || []).some(n => /barbell|trap_bar|leg_press|leg_curl/.test(n));
    p = level === 'beginner' || !heavy ? { sets: 3, min: 8, max: 12, rest: 120 } : { sets: 4, min: 5, max: 8, rest: 150 };
  }
  else if (['single-leg', 'push', 'pull'].includes(ex.movement) && ex.category !== 'prevention') p = { sets: 3, min: 8, max: 10, rest: 90 };
  else if (ex.category === 'prevention' || ex.movement === 'calf-ankle') p = { sets: 2, min: 12, max: 15, rest: 45 };
  else p = { sets: 3, min: 10, max: 12, rest: 60 };
  if (ex.range) [p.min, p.max] = ex.range;
  if (level === 'beginner' && p.sets > 3) p.sets = 3;
  if (minutes <= 20) { p.sets = Math.min(p.sets, 2); p.rest = Math.max(30, Math.round(p.rest * 0.7 / 15) * 15); }
  else if (minutes <= 40) p.sets = Math.min(p.sets, 3);
  return p;
}

const SESSION_NAMES = { legs: 'Legs', upper: 'Upper Body', shoulders: 'Shoulders', power: 'Power', core: 'Core', prevention: 'Prehab' };
const sessionTitle = (fs, i, n) => n === 1 ? fs.slice(0, 2).map(f => SESSION_NAMES[f]).join(' & ') || 'Full Body'
  : `${String.fromCharCode(65 + i)} · ${[fs[i % fs.length], fs[(i + 1) % fs.length]].filter((v, k, a) => a.indexOf(v) === k).slice(0, fs.length > 1 ? 2 : 1).map(f => SESSION_NAMES[f]).join(' & ')}`;

// Build sessions. opts: { focuses[], days, minutes, owned:Set|null, level, injuries[] }
export function buildProgram(opts, pool) {
  const { focuses, days = 2, minutes = 40, level = 'intermediate' } = opts;
  if (!focuses?.length) return { sessions: [], ranked: [] };
  const ranked = rankExercises(opts, pool);
  const budget = minutes * 60 - (minutes <= 20 ? 180 : 360);
  const maxN = PER_SESSION[minutes] || 6;
  const usedAcross = new Map();   // exId -> times used (allow repeats only when the pool runs dry)
  const sessions = [];
  for (let i = 0; i < days; i++) {
    const lead = focuses[i % focuses.length];
    // Re-weight for this session's lead focus so each day has its own emphasis.
    const local = ranked.map(r => ({ ...r, s: r.score * (r.focus === lead ? 1.5 : 1) - (usedAcross.get(r.ex.id) || 0) * 2 }))
      .filter(r => r.available).sort((a, b) => b.s - a.s);
    const picks = [], moves = {}, musc = {};
    let secs = 0;
    // Anchors first: the backbone movement(s) for this session's lead focus (and the
    // next focus), so no session is all accessories.
    const second = focuses.length > 1 ? focuses[(i + 1) % focuses.length] : null;
    const anchorIds = [...ANCHORS[lead], ...(second && second !== lead ? ANCHORS[second].slice(0, 1) : [])]
      .map(test => local.find(r => test(r.ex) && !anchorUsed(r)))
      .filter(Boolean);
    function anchorUsed(r) { return picks.some(p => p.ex.id === r.ex.id); }
    const ordered = [...new Set([...anchorIds, ...local])];
    for (const r of ordered) {
      if (picks.length >= maxN) break;
      const ex = r.ex;
      if ((moves[ex.movement] || 0) >= 2) continue;                       // movement variety
      if ((ex.primary || []).some(m => (musc[m] || 0) >= 3)) continue;     // don't hammer one muscle
      if (picks.some(p => p.ex.movement === ex.movement && same(p.ex.primary, ex.primary))) continue; // near-duplicates
      if (ex.movement === 'power' && picks.some(p => p.ex.movement === 'power') && minutes < 70) continue;
      const rx = prescriptionFor(ex, { level, minutes });
      const blk = { ex: ex.id, ...rx };
      const t = blockSeconds(blk);
      if (picks.length >= 3 && secs + t > budget) continue;
      picks.push({ ...r, blk }); secs += t;
      moves[ex.movement] = (moves[ex.movement] || 0) + 1;
      for (const m of ex.primary || []) musc[m] = (musc[m] || 0) + 1;
    }
    picks.sort((a, b) => (ORDER[a.ex.movement] ?? 5) - (ORDER[b.ex.movement] ?? 5) || b.s - a.s);
    for (const p of picks) usedAcross.set(p.ex.id, (usedAcross.get(p.ex.id) || 0) + 1);
    sessions.push({
      title: sessionTitle(focuses, i, days), lead,
      blocks: picks.map((p, k) => ({ ...p.blk, pri: k + 1, why: p.reasons[0] || '' })),
      minutes: Math.round((secs + (minutes <= 20 ? 180 : 360)) / 60),
    });
  }
  return { sessions, ranked };
}

// Alternatives for one slot, best first, with availability.
export function alternativesFor(exId, opts, exclude = new Set()) {
  const cur = getExercise(exId);
  return rankExercises(opts).filter(r => r.ex.id !== exId && !exclude.has(r.ex.id))
    .map(r => ({ ...r, same: r.ex.movement === cur?.movement }))
    .sort((a, b) => (b.available - a.available) || (b.same - a.same) || (b.score - a.score));
}

export const reorderByMovement = blocks => [...blocks].sort((a, b) => (ORDER[getExercise(a.ex)?.movement] ?? 5) - (ORDER[getExercise(b.ex)?.movement] ?? 5));
