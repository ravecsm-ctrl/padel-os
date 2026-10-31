// Keeping the app cheap to use: confirm planned days instead of entering them, a quiet catch-up for days you
// didn't log, a welcome back after a break, and the private signals the app learns from (see domain/habits.js).
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, tile, group, row } from './ui-kit.js';
import { isRoutine } from './domain-program.js';
import { isoDate, parseISO } from './domain-calendar.js';
import { createWorkout, createActivity, autofill, finalizeWorkout, applySupersets } from './domain-workout.js';
import { PADEL_TYPES, hasFocus } from './domain-padel.js';
import { unloggedDays, pruneNotDone, addSignal, isComeback } from './domain-habits.js';

const DAY = 86400000;
const dayName = iso => iso === isoDate(new Date(Date.now() - DAY)) ? 'Yesterday' : parseISO(iso).toLocaleDateString(undefined, { weekday: 'long' });
const planName = (iso, v) => v === 'Padel' ? (PADEL_TYPES[app.padelOn(iso)?.type] || 'Padel') : app.routine(v)?.title || 'Workout';

// Private signals the app learns from (kept 60 days, never uploaded beyond your own backup).
export function recordSignal(k, extra = {}) { S.settings.signals = addSignal(S.settings.signals, k, extra); app.save('settings'); }
// A session just saved: how long after doing it you logged it.
export const recordLog = startedAt => recordSignal('log', { d: Math.max(0, Math.round((Date.now() - startedAt) / DAY * 10) / 10) });

// Planned days in the last week with nothing logged, counted from your first session.
export function catchupItems() {
  if (!S.sessions.length) return [];
  const since = isoDate(new Date(Math.min(...S.sessions.map(s => s.startedAt))));
  return unloggedDays(S.sessions, iso => app.planOn(iso), { isRoutine, notDone: S.settings.notDone || {}, since });
}
const buttons = (iso, v) => v === 'Padel'
  ? `<button class="link" data-action="cu-done" data-iso="${iso}" data-v="Padel" style="font-size:15px;white-space:nowrap">Played as planned</button><button class="link" data-action="cu-edit" data-iso="${iso}" data-v="Padel" style="font-size:13px">Changed</button><button class="link" data-action="cu-skip" data-iso="${iso}" style="font-size:13px;white-space:nowrap">Didn’t play</button>`
  : `<button class="link" data-action="cu-done" data-iso="${iso}" data-v="${esc(v)}" style="font-size:15px;white-space:nowrap">Done as planned</button><button class="link" data-action="cu-edit" data-iso="${iso}" data-v="${esc(v)}" style="font-size:13px">Log sets</button><button class="link" data-action="cu-skip" data-iso="${iso}" style="font-size:13px;white-space:nowrap">Didn’t</button>`;

// Today's heads-up: one day asks inline; more than one opens the catch-up. "Later" waits 3 days.
export function catchupBanner() {
  const items = catchupItems();
  if (!items.length || Date.now() < (S.settings.catchupSnooze || 0) || isComeback(S.sessions, Date.now(), S.settings.backAck || 0)) return '';
  if (items.length === 1) { const { iso, v } = items[0];
    return `<div class="banner">${tile(v === 'Padel' ? 'racket' : 'check', v === 'Padel' ? 'teal' : 'blue')}<span><b>${esc(dayName(iso))}: ${esc(planName(iso, v))}</b><small>Not logged yet. ${v === 'Padel' ? 'Did you play?' : 'Did you do it?'}</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right">${buttons(iso, v)}</span></div>`; }
  return `<div class="banner">${tile('check', 'blue')}<span><b>${items.length} planned days not logged</b><small>A one-tap catch-up keeps your plan accurate.</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="cu-sheet" style="font-size:15px;white-space:nowrap">Catch Up</button><button class="link" data-action="cu-later" style="font-size:13px">Later</button></span></div>`;
}
export function catchupSheet() {
  const items = catchupItems();
  if (!items.length) { app.closeSheet(); return app.toast('All caught up'); }
  app.sheet(`<h2 class="sheet-title">Catch up</h2><p class="sheet-sub">Planned days with nothing logged. Skip any you don’t remember.</p>
    ${group(items.map(({ iso, v }) => row({ title: `${esc(dayName(iso))}: ${esc(planName(iso, v))}`, sub: esc(parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), chevron: false,
      right: `<span style="display:grid;gap:4px;margin-left:auto;text-align:right">${buttons(iso, v)}</span>` })).join(''))}
    <button class="btn gray" data-action="close-sheet">Done</button>`);
}

// Back after 5+ days: no score of what you missed, a lighter first session, and catching up is optional.
export function welcomeBanner() {
  const g = isComeback(S.sessions, Date.now(), S.settings.backAck || 0);
  if (!g) return '';
  const missed = catchupItems().length;
  return `<div class="banner">${tile('today', 'blue')}<span><b>Welcome back</b><small>${g.days} days since your last session. Your first workout back is a little lighter, to ease you in.</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right">${missed ? '<button class="link" data-action="cu-sheet" style="font-size:15px;white-space:nowrap">Add what you did</button>' : ''}<button class="link" data-action="back-ok" data-ts="${g.lastTs}" style="font-size:${missed ? 13 : 15}px">Got it</button></span></div>`;
}

// One tap: the planned session as it was planned. Gym: the suggested weights and reps, every set done.
async function doneAsPlanned(iso, v) {
  const when = parseISO(iso);
  let rec;
  if (v === 'Padel') {
    const p = app.padelOn(iso) || { type: 'match' }, lv = app.matchLevel(iso) || 'normal';
    const same = S.sessions.find(s => s.activity === 'padel' && s.padel?.type === p.type);
    when.setHours(19, 0, 0, 0);
    const base = createActivity({ activity: 'padel', startedAt: when.getTime(), durationMin: same?.durationMin || 90, rpe: { easy: 5, normal: 7, hard: 8 }[lv] || 7, notes: '' });
    rec = { ...base, title: p.type === 'match' ? 'Padel match' : `Padel ${PADEL_TYPES[p.type].toLowerCase()}`, asPlanned: true,
      padel: { type: p.type, ...(hasFocus(p.type) && p.focus ? { focus: p.focus } : {}), result: 'none', score: '', partner: '', side: '', sore: [] } };
  } else {
    when.setHours(18, 0, 0, 0);
    const w = createWorkout({ routineId: v, week: app.position().week, history: app.strength, overrides: S.overrides, unit: S.settings.unit, startedAt: when.getTime(), profile: app.location() ? { ...S.profile, owned: app.location().equipment } : S.profile });
    applySupersets(w, S.supersets[v]);
    // An exercise with no weight to suggest yet (its first time) is left out: guessing would set a wrong starting weight.
    for (const e of w.exercises) {
      if (e.fields.includes('w') && e.suggestion?.w == null) { e.skipped = true; continue; }
      if (!e.skipped) e.sets.forEach((s, i) => { autofill(e, i); s.done = true; });
    }
    rec = { ...finalizeWorkout(w, { rpe: null, notes: '', durationMin: w.minutes }, app.strength.filter(s => s.startedAt < w.startedAt)), asPlanned: true };
  }
  await db.putSession(rec); await app.reloadSessions();
  recordSignal('catchup'); recordLog(rec.startedAt);
  return rec;
}

export const habitActions = {
  async 'cu-done'(el) {
    const rec = await doneAsPlanned(el.dataset.iso, el.dataset.v);
    if (document.querySelector('#sheet[open]')) catchupSheet();
    app.render({ keepScroll: true }); app.toast(`${rec.title} logged as planned. Edit it in History if anything was different.`);
  },
  async 'cu-edit'(el) {
    const { iso, v } = el.dataset; app.closeSheet();
    const { activitySheet, startPast } = await import('./ui-today.js');
    if (v === 'Padel') activitySheet('padel', null, iso); else startPast(v, iso);
  },
  async 'cu-skip'(el) {
    S.settings.notDone = { ...pruneNotDone(S.settings.notDone), [el.dataset.iso]: true };
    await app.save('settings'); recordSignal('catchup');
    if (document.querySelector('#sheet[open]')) catchupSheet();
    app.render({ keepScroll: true });
  },
  'cu-sheet'() { catchupSheet(); },
  async 'cu-later'() { S.settings.catchupSnooze = Date.now() + 3 * DAY; await app.save('settings'); app.render({ keepScroll: true }); },
  async 'back-ok'(el) { S.settings.backAck = +el.dataset.ts; await app.save('settings'); app.render({ keepScroll: true }); },
};
