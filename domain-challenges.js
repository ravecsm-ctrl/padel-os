// Padel shot challenges (see PADEL-CHALLENGES.md): each shot climbs training tiers from fed balls and drills.
// Results live on padel sessions as padel.drills: [{ shot, tier, streak } | { shot, tier, made, of, variant? }].
// Pure functions; the thresholds are first guesses, to revisit after a few weeks of real results.
import { isoDate, mondayOf } from './domain-calendar.js';

const DAY = 86400000;

export const SHOTS = { overhead: 'Bandeja / Víbora', smash: 'Smash', fhv: 'Forehand volley', bhv: 'Backhand volley', lob: 'Lob' };
export const SHOT_IDS = Object.keys(SHOTS);          // also the order around the padel pentagon
export const VARIANTS = { bandeja: 'Bandeja', vibora: 'Víbora' };
export const LEVELS = ['Learning', 'Grooved', 'Placed', 'Under pressure'];
export const TOP_TIER = 3;
// Where a ball has to land to count at tier 2 (Placed).
export const TARGETS = { overhead: 'deep, in the last 3 m', smash: 'in and past the service line', fhv: 'past the service line', bhv: 'past the service line', lob: 'in the last 2 m' };
// tier → what clears it. kind 'streak': best run in a row; kind 'made': made out of a fixed number of balls.
export const TIERS = {
  1: { kind: 'streak', target: 10, setting: 'Fed balls', goal: () => '10 in a row into the court' },
  2: { kind: 'made', target: 14, of: 20, setting: 'Fed balls', goal: shot => `14 of 20 ${TARGETS[shot]}` },
  3: { kind: 'made', target: 7, of: 10, setting: 'Live drill, partner calls it', goal: () => '7 of 10 in' },
};
// More overheads than this in one session gets a gentle note (elbow and shoulder).
export const OVERHEAD_NOTE_FROM = 30;
export const FADE_AFTER_DAYS = 56;
export const WEEKLY_XP_CAP = 150;

const ratio = r => { const t = TIERS[r.tier]; if (!t) return 0; return Math.max(0, (t.kind === 'streak' ? +r.streak || 0 : +r.made || 0) / t.target); };
export const passes = r => ratio(r) >= 1;
// Balls hit for one result (a streak of 12 means at least 12).
export const ballsOf = r => TIERS[r.tier]?.kind === 'streak' ? +r.streak || 0 : +r.of || TIERS[r.tier]?.of || 0;
export const resultText = r => TIERS[r.tier]?.kind === 'streak' ? `${+r.streak || 0} in a row` : `${+r.made || 0} of ${+r.of || TIERS[r.tier]?.of}`;

// Every result for one shot, oldest first: [{ ts, ...result }].
export function shotResults(sessions, shot) {
  const out = [];
  for (const s of sessions) for (const r of s.padel?.drills || []) if (r.shot === shot && TIERS[r.tier]) out.push({ ts: s.startedAt, sessionId: s.id, ...r });
  return out.sort((a, b) => a.ts - b.ts);
}

// Where a shot stands. start: the tier you chose to begin at; tiers below it count as cleared once the shot has a
// result (with none, e.g. after deleting them, the shot starts over and a new first result sets the start again).
// Returns { cleared, level, next, progress, best, started, lastAt, faded, score, clears: [{ tier, ts }] }.
export function shotState(sessions, shot, { start = 1, now = Date.now() } = {}) {
  const res = shotResults(sessions, shot);
  let cleared = res.length ? Math.max(0, Math.min(TOP_TIER, (start || 1) - 1)) : 0;
  const clears = [];
  for (const r of res) if (passes(r) && r.tier > cleared) { for (let t = cleared + 1; t <= r.tier; t++) clears.push({ tier: t, ts: r.ts }); cleared = r.tier; }
  const next = cleared < TOP_TIER ? cleared + 1 : null;
  // Progress toward the next tier: your best result at it, whatever date it was logged for.
  const tries = next ? res.filter(r => r.tier === next) : [];
  const best = tries.reduce((b, r) => (!b || ratio(r) > ratio(b) ? r : b), null);
  const progress = best ? Math.min(0.99, ratio(best)) : 0;
  const lastAt = res.length ? res[res.length - 1].ts : null;
  const started = res.length > 0;
  return { cleared, level: LEVELS[cleared], next, progress, best, started, lastAt, clears,
    faded: started && now - lastAt > FADE_AFTER_DAYS * DAY,
    score: Math.round((cleared + (next ? progress : 0)) / TOP_TIER * 100) };
}

export const allShots = (sessions, starts = {}, now = Date.now()) => Object.fromEntries(SHOT_IDS.map(id => [id, shotState(sessions, id, { start: starts[id]?.start || 1, now })]));

// The tier a new result for this shot is aimed at, given everything logged so far (excluding one session when editing).
export function tierFor(sessions, shot, starts = {}, excludeId = null) {
  const st = shotState(excludeId ? sessions.filter(s => s.id !== excludeId) : sessions, shot, { start: starts[shot]?.start || 1 });
  return st.next || TOP_TIER;
}

// A first result far below its tier suggests starting one lower.
export function firstResultNote(sessions, r) {
  if (r.tier <= 1 || shotResults(sessions, r.shot).length) return '';
  return ratio(r) < 0.5 ? `That’s well short of ${LEVELS[r.tier]}. You can start ${SHOTS[r.shot]} one tier lower.` : '';
}

// Overheads in one session's results (Bandeja / Víbora and Smash).
export const overheadBalls = drills => (drills || []).filter(r => r.shot === 'overhead' || r.shot === 'smash').reduce((n, r) => n + ballsOf(r), 0);

// Points: +10 for a shot's first result of the day, +50 for each tier cleared; at most WEEKLY_XP_CAP a week (Mon–Sun).
export function challengeXp(sessions, starts = {}) {
  const raw = [], seen = new Set();
  const sorted = [...sessions].filter(s => s.padel?.drills?.length).sort((a, b) => a.startedAt - b.startedAt);
  for (const s of sorted) for (const r of s.padel.drills) {
    if (!TIERS[r.tier] || !SHOTS[r.shot]) continue;
    const k = `${isoDate(new Date(s.startedAt))}|${r.shot}`;
    if (!seen.has(k)) { seen.add(k); raw.push({ ts: s.startedAt, xp: 10, label: `Padel challenge: ${SHOTS[r.shot]}` }); }
  }
  for (const id of SHOT_IDS) for (const c of shotState(sessions, id, { start: starts[id]?.start || 1 }).clears)
    raw.push({ ts: c.ts + 1, xp: 50, label: `${SHOTS[id]}: ${LEVELS[c.tier]}` });
  raw.sort((a, b) => a.ts - b.ts);
  const used = new Map(), out = [];
  for (const e of raw) {
    const wk = isoDate(mondayOf(new Date(e.ts))), left = WEEKLY_XP_CAP - (used.get(wk) || 0);
    if (left <= 0) continue;
    const xp = Math.min(e.xp, left); used.set(wk, (used.get(wk) || 0) + xp); out.push({ ...e, xp });
  }
  return out;
}

// The padel pentagon: one point per shot, in SHOT_IDS order. A shot with no results scores 0 and is marked not started.
// now: the moment to score at (4 weeks ago for the comparison shape); later results don't count.
export const SHORT = { overhead: 'Bandeja / Víbora', smash: 'Smash', fhv: 'FH volley', bhv: 'BH volley', lob: 'Lob' };
export function padelPentagon(sessions, starts = {}, now = Date.now()) {
  const upTo = sessions.filter(s => s.startedAt <= now);
  return SHOT_IDS.map(id => { const st = shotState(upTo, id, { start: starts[id]?.start || 1, now });
    return { key: id, label: SHORT[id], score: st.started ? st.score : 0, started: st.started, faded: st.faded, level: st.level, next: st.next, best: st.best }; });
}

// For milestones: has any result cleared its tier?
export const anyTierCleared = sessions => sessions.some(s => (s.padel?.drills || []).some(r => TIERS[r.tier] && passes(r)));
