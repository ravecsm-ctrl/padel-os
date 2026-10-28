// Backup format, validation, legacy (PADEL OS v1) migration and CSV export.
import { getExercise, idForName } from './domain-catalog.js';
import { fromDisplay } from './domain-units.js';
import { isoDate } from './domain-calendar.js';

export const SCHEMA = 2;
const num = v => v === '' || v == null || isNaN(v) ? null : Number(v);

export function validateBackup(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['File is not a JSON object.'] };
  if (![1, 2].includes(data.schemaVersion)) errors.push(`Unknown schemaVersion ${data.schemaVersion}.`);
  if (!Array.isArray(data.sessions)) errors.push('Missing sessions array.');
  if (data.meta != null && typeof data.meta !== 'object') errors.push('meta must be an object.');
  if (errors.length) return { ok: false, errors };
  const bad = data.sessions.filter(s => !s || typeof s.id !== 'string' || !Number.isFinite(Number(s.startedAt))).length;
  if (bad) errors.push(`${bad} session(s) lack an id or start time and will be skipped.`);
  // Backups since v34 say how many sessions they hold; a mismatch means the file was cut short or edited.
  const incomplete = Number.isFinite(data.summary?.sessions) && data.summary.sessions !== data.sessions.length;
  if (incomplete) errors.push(`This file should hold ${data.summary.sessions} sessions but has ${data.sessions.length}. It may be incomplete.`);
  return { ok: true, errors, incomplete, version: data.schemaVersion, count: data.sessions.length - bad };
}

// v1 stored the exercise name and string weights in whatever unit was active.
export function migrateV1Session(s, unit = 'kg') {
  return {
    id: s.id, kind: 'strength', routineId: s.routine, title: `Routine ${s.routine}`,
    startedAt: Number(s.startedAt), endedAt: Number(s.endedAt) || Number(s.startedAt),
    durationMin: num(s.duration) || 0, week: num(s.week) || 1, rpe: num(s.rpe), notes: s.notes || '',
    pain: { flag: !!s.pain, location: s.painLocation || '' }, readiness: null, prs: [], migratedFrom: 1,
    exercises: (s.sets || []).map(x => {
      const exId = idForName(x.exercise) || `legacy:${x.exercise}`;
      const ex = getExercise(exId);
      const tf = ex ? ex.fields[ex.fields.length - 1] : 'reps';
      return {
        exId, name: x.exercise,
        sets: (x.sets || []).map(y => ({ w: fromDisplay(num(y.weight), unit), [tf]: num(y.reps), done: !!y.done, rpe: null })),
      };
    }),
  };
}

export function normalizeBackup(data) {
  if (data.schemaVersion === 2) return { meta: data.meta || {}, sessions: data.sessions.filter(s => s?.id && s?.startedAt) };
  const unit = data.meta?.settings?.unit === 'lb' ? 'lb' : 'kg';
  const meta = {};
  if (data.meta?.schedule) meta.schedule = data.meta.schedule;
  if (data.meta?.settings) meta.settings = { unit, name: data.meta.settings.name || '' };
  return { meta, sessions: data.sessions.filter(s => s?.id && s?.startedAt).map(s => migrateV1Session(s, unit)) };
}

// What a backup (or this phone) holds, in plain numbers.
export function backupSummary(sessions) {
  const ts = sessions.map(s => Number(s.startedAt)).filter(Number.isFinite);
  return { sessions: sessions.length, workouts: sessions.filter(s => s.kind === 'strength').length, matches: sessions.filter(s => s.kind === 'activity' && s.activity === 'padel').length,
    first: ts.length ? Math.min(...ts) : null, last: ts.length ? Math.max(...ts) : null };
}
export const buildBackup = (meta, sessions) => ({ app: 'padel-os-pro', schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), summary: backupSummary(sessions), meta, sessions });

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCSV(sessions) {
  const rows = [['date', 'kind', 'routine', 'week', 'session_rpe', 'duration_min', 'exercise', 'set', 'load_kg', 'reps', 'seconds', 'meters', 'set_rpe', 'done']];
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const base = [isoDate(new Date(s.startedAt)), s.kind === 'strength' ? 'strength' : s.activity, s.routineId || '', s.week || '', s.rpe ?? '', s.durationMin ?? ''];
    if (s.kind !== 'strength') { rows.push([...base, '', '', '', '', '', '', '', '']); continue; }
    for (const e of s.exercises || []) (e.sets || []).forEach((x, i) => rows.push([...base, e.name, i + 1, x.w ?? '', x.reps ?? '', x.sec ?? '', x.m ?? '', x.rpe ?? '', x.done ? 1 : 0]));
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

// Which saved settings and data a restore brings back. "replace" takes the backup as is;
// "merge" keeps this device's preferences and adds what the backup has on top.
export const RESTORE_KEYS = ['settings', 'schedule', 'overrides', 'exNotes', 'profile', 'locations', 'activeLocation', 'customEquipment', 'customExercises', 'customRoutines', 'startWeights', 'recoveryCal', 'body', 'supersets', 'painClear', 'feedback', 'exerciseEdits'];
const ADDITIVE = ['exNotes', 'customEquipment', 'customExercises', 'customRoutines', 'startWeights', 'supersets', 'exerciseEdits'];
export function restoreMeta(current, incoming, mode = 'replace', defaults = {}) {
  const out = {};
  for (const k of RESTORE_KEYS) {
    const v = incoming[k];
    if (v == null) { if (mode === 'replace' && ['body', 'supersets', 'painClear', 'feedback'].includes(k)) out[k] = ['body', 'feedback'].includes(k) ? [] : {}; continue; }
    if (k === 'feedback') { const all = mode === 'merge' ? [...(current.feedback || []), ...v] : v; out[k] = [...new Map(all.map(f => [f.ts, f])).values()].sort((a, b) => a.ts - b.ts); continue; }
    if (k === 'settings') { out[k] = mode === 'merge' ? current.settings : { ...defaults, ...current.settings, ...v }; continue; }
    if (k === 'body') {
      // Body log: union by date; on merge this device's entry wins for the same day.
      const byDate = new Map((Array.isArray(v) ? v : []).map(e => [e.date, e]));
      if (mode === 'merge') for (const e of current.body || []) byDate.set(e.date, e);
      out[k] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      continue;
    }
    if (mode === 'merge') { if (ADDITIVE.includes(k)) out[k] = { ...v, ...(current[k] || {}) }; continue; }
    out[k] = v;
  }
  return out;
}
