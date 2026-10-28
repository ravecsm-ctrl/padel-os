// Importing exercise lists from CSV or plain text. Pure functions: parse → normalise →
// match against the library → build custom exercises and workouts. Nothing is saved here.
import { allExercises, getExercise } from './domain-catalog.js';
import { MUSCLES, MOVEMENTS, CATEGORIES, EQUIPMENT, LEVELS, WEIGHT_TYPES, UNITS, normalize, normalizeList, norm, MOVEMENT_TO_PATTERN } from './domain-taxonomy.js';

export const COLUMNS = ['name', 'workout', 'order', 'sets', 'reps', 'unit', 'weight', 'weight_type', 'per_side', 'rest_sec', 'primary_muscles', 'secondary_muscles', 'movement', 'category', 'equipment', 'level', 'video_url', 'cues', 'notes'];
const HEADER_ALIAS = {
  name: ['name', 'exercise', 'exercise name', 'movement name', 'title'], workout: ['workout', 'day', 'session', 'group', 'workout group', 'suggested workout group', 'routine'],
  order: ['order', '#', 'no', 'position'], sets: ['sets', 'set'], reps: ['reps', 'rep', 'repetitions', 'rep range', 'duration', 'time', 'distance'],
  unit: ['unit', 'units', 'rep unit'], weight: ['weight', 'kg', 'weight kg', 'load', 'load kg', 'suggested weight'], weight_type: ['weight type', 'weight_type', 'per hand or total', 'load type'],
  per_side: ['per side', 'per_side', 'each side', 'unilateral'], rest_sec: ['rest', 'rest sec', 'rest_sec', 'rest seconds', 'rest s'],
  primary_muscles: ['primary muscles', 'primary_muscles', 'primary', 'muscles', 'main muscles', 'target muscles'], secondary_muscles: ['secondary muscles', 'secondary_muscles', 'secondary'],
  movement: ['movement', 'pattern', 'movement pattern'], category: ['category', 'type', 'library group'], equipment: ['equipment', 'gear', 'kit'],
  level: ['level', 'difficulty'], video_url: ['video url', 'video_url', 'video', 'link', 'url', 'how to', 'demo'], cues: ['cues', 'how to do it', 'instructions', 'technique', 'description'], notes: ['notes', 'note', 'comments'],
};
const headerKey = h => { const n = norm(h); return Object.keys(HEADER_ALIAS).find(k => HEADER_ALIAS[k].some(a => norm(a) === n)) || null; };

// ── CSV (RFC-4180-ish): quotes, escaped quotes, newlines in quotes; comma, semicolon or tab.
export function parseCSV(text) {
  const src = String(text).replace(/^﻿/, '');
  const first = src.split(/\r?\n/)[0] || '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

export function looksLikeCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return false;
  return rows[0].filter(headerKey).length >= 2 && rows[0].map(headerKey).includes('name');
}

export function rowsFromCSV(text) {
  const rows = parseCSV(text);
  const keys = rows[0].map(headerKey);
  return rows.slice(1).map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()]).filter(([k]) => k)));
}

// ── Plain text: "Bulgarian split squat 3x8-10 @ 20kg per hand", "Plank 3 x 30s", "Day 1 – Legs:".
export function rowsFromText(text) {
  const out = []; let workout = '';
  for (let raw of String(text).split(/\r?\n/)) {
    let line = raw.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, '').trim();
    if (!line) continue;
    const isHeader = /:$/.test(line) || /^(day|session|workout|week)\s*\d*\b/i.test(line) && !/\d+\s*[x×]\s*\d+/i.test(line);
    if (isHeader) { workout = line.replace(/:$/, '').replace(/\s+/g, ' ').trim(); continue; }
    const r = { workout };
    const sx = line.match(/(\d+)\s*(?:sets?\s*(?:of|x|×)?|[x×])\s*(\d+(?:\s*[-–]\s*\d+)?)\s*(reps?|s|sec|secs|seconds|m|metres|meters)?\b/i)
      || line.match(/(\d+)\s*sets?\s*(?:of\s*)?(\d+(?:\s*[-–]\s*\d+)?)\s*(reps?|s|sec|secs|seconds|m|metres|meters)?/i);
    if (sx) { r.sets = sx[1]; r.reps = sx[2].replace(/\s/g, '').replace('–', '-'); if (sx[3]) r.unit = sx[3]; }
    const w = line.match(/(?:@|at)?\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\b/i);
    if (w) { r.weight = w[1].replace(',', '.'); r._lb = /lb/i.test(w[2]); }
    if (/per hand|each hand|per dumbbell|\beach\b/i.test(line)) r.weight_type = 'per_hand';
    if (/per side|each side|\/side|each leg|each arm/i.test(line)) r.per_side = 'yes';
    const rest = line.match(/rest\s*(\d+)\s*(s|sec|secs|seconds|min|mins|minutes)?/i);
    if (rest) r.rest_sec = /min/i.test(rest[2] || '') ? String(+rest[1] * 60) : rest[1];
    const url = line.match(/https?:\/\/\S+/i);
    if (url) r.video_url = url[0];
    const cut = [sx?.index, w?.index, url?.index, line.search(/\(|—| - |,/)].filter(i => i != null && i > 0);
    r.name = (cut.length ? line.slice(0, Math.min(...cut)) : line).replace(/[:\-–—@]\s*$/, '').trim();
    if (r.name && (sx || w || url)) out.push(r);
    else if (r.name && r.name.split(' ').length <= 6) out.push(r);
  }
  return out;
}

export const rowsFrom = text => looksLikeCSV(text) ? { source: 'csv', rows: rowsFromCSV(text) } : { source: 'text', rows: rowsFromText(text) };

// ── Normalise one raw row into a typed item with warnings.
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const yes = v => /^(y|yes|true|1|x|✓)$/i.test(String(v ?? '').trim());
export function normalizeRow(raw, i, { customEquipment = {} } = {}) {
  const warn = [];
  const name = String(raw.name || '').trim();
  if (!name) warn.push('Missing exercise name');
  let [min, max] = String(raw.reps || '').split(/[-–]/).map(num);
  if (min == null) min = null; if (max == null) max = min;
  if (min != null && max != null && max < min) [min, max] = [max, min];
  const unit = raw.unit ? normalize('unit', raw.unit) : null;
  if (raw.unit && !unit?.id) warn.push(`Unknown unit “${raw.unit}”`);
  let weight = num(raw.weight);
  if (weight != null && raw._lb) weight = +(weight / 2.2046226218).toFixed(2);
  const wt = raw.weight_type ? normalize('weightType', raw.weight_type) : null;
  if (raw.weight_type && !wt?.id) warn.push(`Unknown weight type “${raw.weight_type}”`);
  const prim = normalizeList('muscle', raw.primary_muscles), sec = normalizeList('muscle', raw.secondary_muscles);
  if (prim.unknown.length || sec.unknown.length) warn.push(`Unknown muscle: ${[...prim.unknown, ...sec.unknown].join(', ')}`);
  const mv = raw.movement ? normalize('movement', raw.movement) : null;
  if (raw.movement && !mv?.id) warn.push(`Unknown movement “${raw.movement}”`);
  const cat = raw.category ? normalize('category', raw.category) : null;
  if (raw.category && !cat?.id) warn.push(`Unknown category “${raw.category}”`);
  const lvl = raw.level ? normalize('level', raw.level) : null;
  const eq = { ids: [], unknown: [] };
  for (const part of String(raw.equipment || '').split(/[,;|+]| and /).map(s => s.trim()).filter(Boolean)) {
    if (/^(none|bodyweight|no equipment|body weight)$/i.test(part)) continue;
    const r = normalize('equipment', part);
    const customId = Object.entries(customEquipment).find(([, l]) => norm(l) === norm(part))?.[0];
    if (r?.id) eq.ids.push(r.id); else if (customId) eq.ids.push(customId); else eq.unknown.push(part);
  }
  let url = String(raw.video_url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) { warn.push('Video link ignored (must start with http:// or https://)'); url = ''; }
  return {
    key: `r${i}`, name, workout: String(raw.workout || '').trim(), order: num(raw.order) ?? i + 1,
    sets: Math.max(1, Math.round(num(raw.sets) ?? 3)), min: min ?? null, max: max ?? null, unit: unit?.id || null,
    weight, weightType: wt?.id || null, perSide: yes(raw.per_side), rest: num(raw.rest_sec),
    primary: prim.ids, secondary: sec.ids.filter(m => !prim.ids.includes(m)), movement: mv?.id || null, category: cat?.id || null,
    level: lvl?.id || null, needs: [...new Set(eq.ids)], newEquipment: [...new Set(eq.unknown)], url, cues: String(raw.cues || '').trim(), notes: String(raw.notes || '').trim(), warn,
  };
}

// ── Match an imported name against the library and your own exercises.
const SYN = { banded: 'band', bands: 'band', dumbbells: 'dumbbell', kettlebells: 'kettlebell', db: 'dumbbell', dbs: 'dumbbell', kb: 'kettlebell', bb: 'barbell', rdl: 'romanian deadlift', sl: 'single leg', rfess: 'rear foot elevated split squat', bulgarian: 'rear foot elevated', 'split squats': 'split squat', ohp: 'overhead press', cmj: 'countermovement jump' };
const tokens = s => norm(s).split(' ').map(t => SYN[t] || t).join(' ').split(' ').filter(t => t && !['the', 'a', 'with', 'and', 'exercise'].includes(t)).map(t => t.replace(/s$/, ''));
export function similarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter(t => B.has(t)).length;
  return inter / (A.size + B.size - inter);
}
export function matchExercise(name) {
  const n = norm(name);
  const exact = allExercises().find(e => norm(e.name) === n);
  if (exact) return { id: exact.id, score: 1 };
  let best = null;
  for (const e of allExercises()) { const s = similarity(name, e.name); if (!best || s > best.score) best = { id: e.id, score: s }; }
  return best && best.score >= 0.5 ? best : null;
}

// ── Build a custom exercise from a normalised item.
const slug = s => norm(s).replace(/ /g, '-').slice(0, 40) || 'exercise';
const GYM = new Set(['barbell', 'trap_bar', 'cable', 'leg_press', 'leg_curl', 'calf_machine', 'landmine', 'med_ball', 'bar', 'hack_squat', 'pendulum_squat', 'belt_squat', 'v_squat', 'leg_extension',
  'hip_abduction', 'glute_machine', 'reverse_hyper', 'back_extension', 'glute_ham_developer', 'chest_press', 'pec_deck', 'shoulder_press', 'lateral_raise_machine', 'row_machine',
  'pullover_machine', 'assisted_pull_up_machine', 'assisted_dip_machine', 'curl_machine', 'triceps_machine', 'sled', 'battle_ropes', 'rope', 'nordic_bench']);
export function buildCustomExercise(item, { customEquipment = {}, idSuffix = Date.now().toString(36) } = {}) {
  const wt = item.weightType || (item.needs.length ? 'total' : item.weight ? 'total' : 'bodyweight');
  const tf = item.unit === 'seconds' ? 'sec' : item.unit === 'metres' ? 'm' : 'reps';
  const fields = wt === 'bodyweight' && !item.weight ? [tf] : ['w', tf];
  const label = ids => ids.map(m => MUSCLES[m]).filter(Boolean).join(' · ');
  const eqLabel = item.needs.length ? item.needs.map(n => EQUIPMENT[n] || customEquipment[n] || n).join(' + ') : 'Bodyweight';
  return {
    id: `c-${slug(item.name)}-${idSuffix}`, name: item.name, custom: true, fields,
    perSide: !!item.perSide, quality: item.movement === 'power', inc: wt === 'per_hand' ? 2 : 2.5, loadNote: wt === 'per_hand' ? 'per hand' : '',
    equipment: eqLabel, muscles: label(item.primary) || 'Custom exercise', pattern: MOVEMENT_TO_PATTERN[item.movement] || 'custom', subs: [],
    why: item.notes || '', setup: '', execute: item.cues || 'Follow your plan’s instructions.', avoid: '', breathe: 'Brace before each rep and breathe out through the effort.',
    kit: item.needs.some(n => GYM.has(n)) ? 'gym' : item.needs.length ? 'db' : 'bw', loadOptional: false, range: item.min != null ? [item.min, item.max] : null,
    needs: item.needs, primary: item.primary, secondary: item.secondary, movement: item.movement, category: item.category, level: item.level || 'intermediate', weightType: wt,
    url: item.url, startW: item.weight ?? null, startTarget: item.min ?? null, defaults: { sets: item.sets, min: item.min, max: item.max, rest: item.rest },
  };
}

// Group items that share a `workout` value into workouts (routine templates).
export function buildWorkouts(items, idFor, idSuffix = Date.now().toString(36)) {
  const groups = new Map();
  for (const it of items) if (it.workout) groups.set(it.workout, [...(groups.get(it.workout) || []), it]);
  return [...groups.entries()].map(([title, list], gi) => ({
    id: `w-${slug(title)}-${idSuffix}${gi}`, title, custom: true, minutes: null, focus: 'Imported workout.',
    blocks: list.sort((a, b) => a.order - b.order).map((it, i) => {
      const ex = getExercise(idFor(it));
      const r = ex?.range || [8, 12];
      return { ex: idFor(it), sets: it.sets, min: it.min ?? r[0], max: it.max ?? it.min ?? r[1], rest: it.rest ?? 90, pri: i + 1 };
    }),
  }));
}

// ── Template + ChatGPT prompt
export const TEMPLATE_CSV = [
  COLUMNS.join(','),
  'Bulgarian split squat,Legs A,1,3,8-10,reps,20,per_hand,yes,90,"quads, glutes",adductors,single-leg,lower-strength,"dumbbells, bench",intermediate,https://www.youtube.com/results?search_query=bulgarian+split+squat,"Front foot flat, drop straight down",',
  'Copenhagen plank,Legs A,2,3,20-30,seconds,,bodyweight,yes,60,adductors,obliques,lateral,prevention,bench,intermediate,,"Top leg on bench, hips in line",Short lever to start',
  'Landmine press,Upper A,1,4,8-10,reps,15,total,yes,90,"front_delts, upper_chest",triceps,push,upper-strength,landmine,intermediate,,"Half kneeling, ribs down",',
].join('\n');

export const ALLOWED_VALUES = {
  unit: Object.keys(UNITS), weight_type: Object.keys(WEIGHT_TYPES), per_side: ['yes', 'no'],
  primary_muscles: Object.keys(MUSCLES), secondary_muscles: Object.keys(MUSCLES), movement: Object.keys(MOVEMENTS),
  category: Object.keys(CATEGORIES), equipment: Object.keys(EQUIPMENT), level: Object.keys(LEVELS),
};

// Your whole exercise library as CSV, using the same names and values the importer reads.
// Attach it to an AI chat so it reuses these exact names instead of inventing duplicates.
export const LIBRARY_COLUMNS = ['name', 'primary_muscles', 'secondary_muscles', 'movement', 'category', 'equipment', 'unit', 'weight_type', 'per_side', 'level', 'source'];
const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function libraryCSV(exercises = allExercises(), { customEquipment = {} } = {}) {
  const unitOf = ex => { const f = ex.fields?.[ex.fields.length - 1]; return f === 'sec' ? 'seconds' : f === 'm' ? 'metres' : 'reps'; };
  const gear = ex => (ex.needs || []).map(n => n.split('|').map(a => customEquipment[a] ? customEquipment[a] : a).join(' or ')).join(', ');
  const rows = [...exercises].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name)).map(ex => [
    ex.name, (ex.primary || []).join(', '), (ex.secondary || []).join(', '), ex.movement || '', ex.category || '', gear(ex) || 'none',
    unitOf(ex), ex.weightType || (ex.fields?.includes('w') ? 'total' : 'bodyweight'), ex.perSide ? 'yes' : 'no', ex.level || '', ex.custom ? 'yours' : 'built-in',
  ].map(cell).join(','));
  return [LIBRARY_COLUMNS.join(','), ...rows].join('\n');
}

export function chatgptPrompt() {
  return `Turn my workout plan into a CSV I can import into my training app. Reply with ONLY the CSV in a code block, no other text.

If I attached my exercise library (a CSV with a "name" column), it lists the exercises my app already has. For any exercise that is already in it, use its name EXACTLY as written there, so it isn't added twice. Only create new exercises for ones that are truly missing.

Use exactly these columns, in this order:
${COLUMNS.join(',')}

Rules:
- One row per exercise. Put the session name (e.g. "Legs A") in "workout"; exercises with the same workout are done together, in "order".
- reps: a number or a range like 8-10. For holds use seconds, for carries use metres, and set "unit" accordingly.
- weight: a suggested starting weight in kg (leave empty for bodyweight).
- weight_type: per_hand (each dumbbell), total (whole bar/machine) or bodyweight.
- Multiple values in one cell go in quotes, separated by commas, e.g. "quads, glutes".
- Use only these values:
${Object.entries(ALLOWED_VALUES).filter(([k]) => k !== 'secondary_muscles').map(([k, v]) => `  ${k}: ${v.join(', ')}`).join('\n')}
- video_url: a YouTube search or video link showing the exercise (https:// only).
- cues: one short sentence on how to do it well.

My plan:
[PASTE YOUR PLAN HERE]`;
}
