// This week: the padel you've booked (date, type, level), your workouts placed around it, and the best
// day for another session. Adding or removing padel proposes a re-planned week you accept or not.
// Dates live in S.settings.dated / padelPlan / matchLevel; the usual week (S.schedule) is the fallback.
import { app, S } from './core-app.js';
import { esc, icon, tile, group, row, seg, chips } from './ui-kit.js';
import { DAYS, isRoutine, isLegHeavy, isUpperHeavy } from './domain-program.js';
import { isoDate, mondayOf, parseISO } from './domain-calendar.js';
import { PADEL_TYPES, PADEL_FOCUS, hasFocus } from './domain-padel.js';
import { MATCH_LEVELS, loggedLevel } from './domain-matchlevel.js';
import { planWeek, withPadel, suggestPadelDays, workoutsLeft } from './domain-weekplan.js';

const OPTS = { legs: isLegHeavy, upper: isUpperHeavy };
export const isoAdd = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
const monIso = iso => isoDate(mondayOf(parseISO(iso)));
const dayName = iso => parseISO(iso).toLocaleDateString(undefined, { weekday: 'long' });
const shortDay = iso => parseISO(iso).toLocaleDateString(undefined, { weekday: 'short' });
const fmtDay = iso => parseISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const titleOf = v => isRoutine(v) ? app.routine(v).title : v === 'Padel' ? 'Padel' : v === 'Recovery' ? 'Recovery' : 'Rest';
const padelLabel = p => `${PADEL_TYPES[p?.type] || 'Match'}${hasFocus(p?.type) && p?.focus && p.focus !== 'mixed' ? ` · ${PADEL_FOCUS[p.focus]}` : ''}`;
const MAX_AHEAD = 27;

// The week around a date as the planner sees it (last Sunday … next Monday). Logged days are what
// happened; today counts as done once you've logged something or a workout is under way.
export function weekWindow(iso = isoDate()) {
  const mon = monIso(iso), today = isoDate(), sw = S.settings.swap;
  return Array.from({ length: 9 }, (_, k) => {
    const d = isoAdd(mon, k - 1), logged = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === d);
    const pad = logged.find(s => s.activity === 'padel'), gym = logged.find(s => s.kind === 'strength');
    const past = d < today || (d === today && (logged.length > 0 || !!S.active));
    let v = app.planOn(d), padel = v === 'Padel' ? { ...app.padelOn(d), level: app.matchLevel(d) } : null;
    if (past) {
      if (pad) { v = 'Padel'; padel = { type: pad.padel?.type || 'match', focus: pad.padel?.focus || null, level: loggedLevel(pad) }; }
      else if (gym) { v = gym.routineId || 'Quick'; padel = null; }
      else if (d < today) { v = 'Rest'; padel = null; }
    }
    const fixed = k === 0 || k === 8 || past || !!(sw && (d === sw.date || d === sw.back)) || v === 'Padel';
    return { iso: d, v, padel, fixed };
  });
}

// Save a planned week: every day you can still change gets its own entry.
async function applyWeek(days, padelIso = null) {
  S.settings.dated = { ...(S.settings.dated || {}) };
  days.forEach((d, i) => { if (i > 0 && i < days.length - 1 && (!d.fixed || d.iso === padelIso)) S.settings.dated[d.iso] = d.v; });
  await app.save('settings');
}
function setPadelDetails(iso, p) {
  S.settings.padelPlan = { ...(S.settings.padelPlan || {}), [iso]: { type: p.type, ...(hasFocus(p.type) ? { focus: p.focus } : {}) } };
  S.settings.matchLevel = { ...(S.settings.matchLevel || {}), [iso]: p.level };
}
// Old dated entries (three weeks back) are dropped so settings stay small.
export function pruneDated(now = isoDate()) {
  const cut = isoAdd(now, -21);
  for (const k of ['dated', 'padelPlan', 'matchLevel']) {
    const m = S.settings[k];
    if (m) for (const iso of Object.keys(m)) if (iso < cut) delete m[iso];
  }
}

function strip(days, { mark = null } = {}) {
  const today = isoDate();
  return `<div class="wk-strip">${days.slice(1, 8).map(d => {
    const kind = d.v === 'Padel' ? 'padel' : isRoutine(d.v) || d.v === 'Quick' ? 'gym' : d.v === 'Recovery' ? 'rec' : 'rest';
    const label = d.v === 'Padel' ? (d.padel?.type === 'machine' ? 'Machine' : PADEL_TYPES[d.padel?.type] || 'Padel') : isRoutine(d.v) ? app.routine(d.v).title.split(/[ &]/)[0] : d.v === 'Quick' ? 'Gym' : d.v === 'Recovery' ? 'Rec' : '–';
    return `<button class="${kind} ${d.iso === today ? 'today' : ''} ${d.iso === mark ? 'mark' : ''} ${d.iso < today ? 'past' : ''}" data-action="wk-day" data-iso="${d.iso}" aria-label="${esc(dayName(d.iso))}: ${esc(titleOf(d.v))}"><small>${shortDay(d.iso).slice(0, 1)}</small><span>${esc(label)}</span></button>`;
  }).join('')}</div>`;
}
const moveLines = r => [...r.moved.map(m => `${titleOf(m.id)} ${m.from ? `moves from ${dayName(m.from)} to ${dayName(m.to)}` : `goes on ${dayName(m.to)}`}`),
  ...r.dropped.map(id => `${titleOf(id)} doesn’t fit this week`)];

// ── Plan tab: this week
export const weekStrip = () => strip(weekWindow());
let SUG = 'match';
export function thisWeekSection() {
  const days = weekWindow(), today = isoDate();
  const padel = days.slice(1, 8).filter(d => d.v === 'Padel');
  const rows = padel.map(d => row({ title: `${dayName(d.iso)} · ${esc(padelLabel(d.padel))}`, sub: d.iso < today || (d.fixed && d.iso === today && S.sessions.some(s => isoDate(new Date(s.startedAt)) === today)) ? 'Done' : esc(MATCH_LEVELS[d.padel?.level || 'normal']), icon: 'racket', color: 'teal', action: 'wk-day', data: { iso: d.iso } })).join('')
    + row({ title: 'Add padel', sub: 'A match, lesson, training or ball machine', icon: 'plus', color: 'green', action: 'week-add', chevron: false, cls: 'action' });
  const left = workoutsLeft(days, isRoutine);
  const sug = days.some((d, i) => i > 0 && i < 8 && !d.fixed && d.v !== 'Padel') ? suggestPadelDays(days, { type: SUG, focus: 'mixed', level: 'normal' }, left, OPTS) : [];
  const sugRows = sug.map(s => row({ title: `${dayName(s.iso)}${s.rank === 'best' ? ' · best' : s.rank === 'good' ? ' · good' : ''}`, sub: esc(moveLines(s).join('. ') || 'Nothing moves'), action: 'week-add', data: { iso: s.iso, type: SUG } })).join('');
  return `${group(rows, { header: 'This week', footer: 'Tap a day to see or change it. Workouts fit around your padel; anything that moves asks you first.' })}
    ${sug.length ? `<div class="grp"><h2 class="grp-h">Best day for another session</h2>${seg('sug-type', [['match', 'Match'], ['lesson', 'Lesson'], ['machine', 'Ball machine']], SUG)}<div style="height:8px"></div>${group(sugRows)}</div>` : ''}`;
}
export function weekPick(name, value) { if (name !== 'sug-type') return false; SUG = value; app.render({ keepScroll: true }); return true; }

// ── Today: once a week, ask what's booked.
export function weekAskCard() {
  const today = isoDate(), mon = monIso(today), dow = (parseISO(today).getDay() + 6) % 7;
  if (dow > 3 || S.settings.weekAsked === mon) return '';
  const booked = Object.keys(S.settings.padelPlan || {}).some(iso => iso >= mon && iso <= isoAdd(mon, 6));
  if (booked) return '';
  const usual = DAYS.filter(d => S.schedule[d] === 'Padel');
  const list = usual.length > 1 ? `${usual.slice(0, -1).join(', ')} and ${usual[usual.length - 1]}` : usual[0];
  return `<div class="banner">${tile('racket', 'teal')}<span><b>Any padel booked this week?</b><small>${usual.length ? `Your usual week has padel on ${list}. ` : ''}Add what’s confirmed and your workouts fit around it.</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="week-add" style="font-size:15px;white-space:nowrap">Add Padel</button><button class="link" data-action="week-ask-off" style="font-size:13px;white-space:nowrap">Usual week</button></span></div>`;
}

// ── Add or change a padel session
export function addPadelSheet(iso = null, type = null) {
  const today = isoDate(), cur = iso && app.planOn(iso) === 'Padel' ? app.padelOn(iso) : null;
  const last = S.sessions.find(s => s.activity === 'padel' && s.padel?.type)?.padel;
  S.form = { wkIso: iso || today, wkType: type || cur?.type || last?.type || 'match', wkFocus: cur?.focus || last?.focus || 'mixed', wkLevel: iso && cur ? app.matchLevel(iso) : 'normal', wkEdit: !!cur };
  const f = () => S.form;
  const days = Array.from({ length: 7 }, (_, k) => isoAdd(today, k));
  const draw = () => `<h2 class="sheet-title">${f().wkEdit ? 'Change padel' : 'Add padel'}</h2><p class="sheet-sub">${esc(fmtDay(f().wkIso))}</p>
    ${f().wkEdit ? '' : `<label class="field-l">Day</label>${chips('wkIso', days, f().wkIso, d => d === today ? 'Today' : shortDay(d))}
    <input class="input" id="wkDate" type="date" min="${today}" max="${isoAdd(today, MAX_AHEAD)}" value="${esc(f().wkIso)}" aria-label="Date" style="margin-top:8px">`}
    <label class="field-l">Type</label>${chips('wkType', Object.keys(PADEL_TYPES), f().wkType, k => PADEL_TYPES[k])}
    ${hasFocus(f().wkType) ? `<label class="field-l">Working on</label>${chips('wkFocus', Object.keys(PADEL_FOCUS), f().wkFocus, k => PADEL_FOCUS[k])}` : ''}
    <label class="field-l">How hard?</label>${seg('wkLevel', Object.entries(MATCH_LEVELS), f().wkLevel)}
    <div style="height:20px"></div><button class="btn filled" id="wkSave">${f().wkEdit ? 'Save' : 'Add Padel'}</button>`;
  const mount = b => {
    const d = b.querySelector('#wkDate');
    if (d) d.onchange = () => { if (d.value) { f().wkIso = d.value; app.sheet(draw(), mount); } };
    b.querySelector('#wkSave').onclick = () => savePadel({ iso: f().wkIso, type: f().wkType, focus: f().wkFocus, level: f().wkLevel }, f().wkEdit);
  };
  app.onPick = () => app.sheet(draw(), mount);
  app.sheet(draw(), mount);
}

let PROPOSAL = null;
async function savePadel(p, edit) {
  const today = isoDate();
  if (!p.iso || p.iso < today || p.iso > isoAdd(today, MAX_AHEAD)) return app.toast('Pick a day from today on');
  const before = weekWindow(p.iso), left = workoutsLeft(before, isRoutine);
  const at = before.find(d => d.iso === p.iso);
  if (at?.fixed && at.v !== 'Padel') return app.toast('You’ve already trained that day');
  setPadelDetails(p.iso, p);
  S.settings.dated = { ...(S.settings.dated || {}), [p.iso]: 'Padel' };
  const r = withPadel(before, p.iso, { type: p.type, focus: p.focus, level: p.level }, left, OPTS);
  if (!r || (!r.moved.length && !r.dropped.length)) {
    await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true });
    return app.toast(`${edit ? 'Saved' : `${padelLabel(p)} on ${dayName(p.iso)} added`}. Your workouts already fit.`);
  }
  await app.save('settings');
  proposal(r, p.iso, `${padelLabel(p)} on ${dayName(p.iso)}`, isRoutine(at?.v) ? at.v : null);
}

// A re-planned week to accept or not.
// lost: the workout that was on the new padel day (skipped this week if you keep the rest as it is).
function proposal(r, mark, what, lost = null) {
  PROPOSAL = { days: r.days, mark, lost };
  app.sheet(`<h2 class="sheet-title">Your week with ${esc(what)}</h2><p class="sheet-sub">Workouts placed around your padel.</p>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">${strip(r.days, { mark })}</div>
    <ul class="week-moves">${moveLines(r).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="btns"><button class="btn filled" data-action="wk-use">Use This Week</button><button class="btn plain" data-action="wk-keep">Keep Workouts Where They Are</button></div>`);
}

async function removePadel(iso) {
  const before = weekWindow(iso);
  delete S.settings.padelPlan?.[iso];
  if (S.settings.matchLevel) delete S.settings.matchLevel[iso];
  S.settings.dated = { ...(S.settings.dated || {}), [iso]: 'Rest' };
  const days = before.map(d => d.iso === iso ? { ...d, v: 'Rest', padel: null, fixed: false } : d);
  const left = workoutsLeft(days, isRoutine);
  const r = planWeek(days, left, OPTS);
  await app.save('settings');
  if (!r.moved.length) { app.closeSheet(); app.render({ keepScroll: true }); return app.toast(`Padel on ${dayName(iso)} removed`); }
  proposal(r, iso, `no padel on ${dayName(iso)}`);
}

function daySheet(iso) {
  const today = isoDate(), d = weekWindow(iso).find(x => x.iso === iso), wd = DAYS[(parseISO(iso).getDay() + 6) % 7];
  const done = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === iso);
  const body = d.v === 'Padel'
    ? group(row({ title: esc(padelLabel(d.padel)), sub: esc(MATCH_LEVELS[d.padel?.level || 'normal']), icon: 'racket', color: 'teal', chevron: false }))
    : group(row({ title: esc(titleOf(d.v)), sub: done.length ? 'Done' : iso < today ? 'Not logged' : 'Planned', icon: isRoutine(d.v) ? 'dumbbell' : d.v === 'Recovery' ? 'heart' : 'snow', color: isRoutine(d.v) ? 'blue' : 'gray', chevron: false }));
  const can = iso >= today && !done.length;
  app.sheet(`<h2 class="sheet-title">${esc(fmtDay(iso))}</h2><div style="height:12px"></div>${body}
    <div class="btns">${can && d.v === 'Padel' ? `<button class="btn tinted" data-action="week-add" data-iso="${iso}">Change Padel</button><button class="btn destructive" data-action="wk-remove" data-iso="${iso}">Remove Padel</button>` : ''}
    ${can && d.v !== 'Padel' ? `<button class="btn tinted" data-action="week-add" data-iso="${iso}">Add Padel Here</button>` : ''}
    <button class="btn plain" data-action="day-sheet-usual" data-day="${wd}">Change Your Usual ${esc(dayName(iso))}</button></div>`);
}

export const weekActions = {
  'week-add'(el) { addPadelSheet(el.dataset.iso || null, el.dataset.type || null); },
  'week-ask-off'() { S.settings.weekAsked = monIso(isoDate()); app.save('settings'); app.render({ keepScroll: true }); },
  'wk-day'(el) { daySheet(el.dataset.iso); },
  'wk-remove'(el) { removePadel(el.dataset.iso); },
  async 'wk-use'() { if (!PROPOSAL) return app.closeSheet(); await applyWeek(PROPOSAL.days, PROPOSAL.mark); PROPOSAL = null; app.closeSheet(); app.render({ keepScroll: true }); app.toast('Week updated'); },
  'wk-keep'() {
    // Padel stays; a workout that was on that day is skipped this week.
    const lost = PROPOSAL?.lost; PROPOSAL = null; app.closeSheet(); app.render({ keepScroll: true });
    app.toast(lost ? `Workouts kept where they were; ${titleOf(lost)} is skipped this week` : 'Workouts kept where they were');
  },
  // Your usual weekday lives on Plan: open its sheet there.
  'day-sheet-usual'(el) {
    app.closeSheet();
    if (S.route === 'plan' && !S.params.length) return app.view().actions['day-sheet'](el);
    S.openDay = el.dataset.day; app.go('plan');
  },
};
