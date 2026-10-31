// This week: the padel you've booked (date, type, level), your workouts placed around it, and the best
// day for another session. Adding or removing padel proposes a re-planned week you accept or not.
// Dates live in S.settings.dated / padelPlan / matchLevel; the usual week (S.schedule) is the fallback.
import { app, S } from './core-app.js';
import { esc, icon, tile, group, row, seg, chips, pageHead } from './ui-kit.js';
import { DAYS, isRoutine, isLegHeavy, isUpperHeavy, allRoutineIds, phaseFor } from './domain-program.js';
import { goalLabel } from './domain-block.js';
import { isoDate, mondayOf, parseISO } from './domain-calendar.js';
import { PADEL_TYPES, PADEL_FOCUS, hasFocus } from './domain-padel.js';
import { MATCH_LEVELS, loggedLevel } from './domain-matchlevel.js';
import { planWeek, withPadel, suggestPadelDays, workoutsLeft } from './domain-weekplan.js';
import { padelProfile } from './domain-recovery.js';
import { busyWeek, ANCHOR_ID } from './domain-busy.js';
import { bestWeek, scheduleScore } from './domain-personalize.js';
import { flip, rise, reduced } from './ui-motion.js';

const OPTS = { legs: id => id === ANCHOR_ID || isLegHeavy(id), upper: isUpperHeavy, anchor: ANCHOR_ID };
// Your usual padel weekdays as load factors, for planning the usual week (personalize.bestWeek).
export const usualKinds = (usual = S.settings.padelUsual || {}) => ({ upper: isUpperHeavy, kinds: Object.fromEntries(Object.entries(usual).map(([d, p]) => [d, padelProfile(p.type, p.focus)])) });
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
    const can = S.profile.trainDays, noGym = !!can?.length && !can.includes(DAYS[(parseISO(d).getDay() + 6) % 7]);
    return { iso: d, v, padel, fixed, noGym };
  });
}

// The gym workouts a week still needs, and whether padel makes it busy. A busy week: Strength plus the
// first of your usual workouts that's light on the legs, less what's already done. Back from busy: the
// Strength session turns back into your usual leg workouts.
const legWork = id => id === ANCHOR_ID || isLegHeavy(id);
export function weekTargets(days) {
  const inWeek = days.slice(1, 8), { busy } = busyWeek(inWeek.filter(d => d.v === 'Padel').map(d => d.padel || {}));
  const usual = DAYS.map(d => S.schedule[d]).filter(isRoutine);
  if (busy) {
    const flex = usual.find(id => !legWork(id)), list = [ANCHOR_ID, ...(flex ? [flex] : [])];
    // Durability can stand in for an upper-body flex session that would land next to overheads.
    const alt = flex && flex !== 'D' && isUpperHeavy(flex) && isRoutine('D') ? { from: flex, to: 'D', cost: 0.5 } : null;
    for (const d of inWeek) if (d.fixed && d.v !== 'Padel' && (isRoutine(d.v) || d.v === 'Quick')) {
      const i = list.indexOf(d.v) >= 0 ? list.indexOf(d.v) : list.findIndex(x => legWork(x) === legWork(d.v));
      if (i >= 0) list.splice(i, 1);
    }
    return { busy, list, alt: list.includes(alt?.from) ? alt : null };
  }
  let list = workoutsLeft(days, isRoutine);
  if (list.includes(ANCHOR_ID) && !usual.includes(ANCHOR_ID)) {
    const done = inWeek.filter(d => d.fixed).map(d => d.v);
    const legs = usual.filter(id => legWork(id) && !done.includes(id));
    list = [...list.filter(id => id !== ANCHOR_ID), ...legs.filter(id => !list.includes(id))];
  }
  return { busy, list };
}
const busyNote = (from, to) => to.busy && !from.busy ? 'Busy padel week: 2 gym sessions, Strength and one that’s light on the legs, and a full rest day.'
  : from.busy && !to.busy ? 'Not a busy padel week any more: your usual workouts are back.' : '';

// Dates and the usual week: a date keeps its own entry only where it differs from your usual weekday, so a
// later change to the usual week still reaches it. Padel you booked for a date always keeps its entry.
const usualOn = iso => S.schedule[DAYS[(parseISO(iso).getDay() + 6) % 7]];
export const isBooked = iso => S.settings.dated?.[iso] === 'Padel' && !!S.settings.padelPlan?.[iso];
function setDated(iso, v) {
  S.settings.dated = { ...(S.settings.dated || {}) };
  if (v === usualOn(iso) && !(v === 'Padel' && S.settings.padelPlan?.[iso])) delete S.settings.dated[iso];
  else S.settings.dated[iso] = v;
}
// Save a planned week: only the days you can still change, and only where they differ from the usual week.
async function applyWeek(days, padelIso = null) {
  days.forEach((d, i) => { if (i > 0 && i < days.length - 1 && (!d.fixed || d.iso === padelIso)) setDated(d.iso, d.v); });
  await app.save('settings');
}
// Your usual week changed (one weekday, or all of it): dates from today on follow it again, except padel
// you booked for a date. Returns this week's booked dates on that weekday, so you can be asked about them.
export function followUsualWeek(weekday = null) {
  const today = isoDate(), dated = S.settings.dated || {}, end = isoAdd(monIso(today), 6), kept = [];
  for (const iso of Object.keys(dated)) {
    if (iso < today || (weekday && DAYS[(parseISO(iso).getDay() + 6) % 7] !== weekday)) continue;
    if (isBooked(iso)) { if (iso <= end && !S.sessions.some(s => isoDate(new Date(s.startedAt)) === iso)) kept.push(iso); continue; }
    delete dated[iso];
  }
  return kept;
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
  // Entries that only repeat the usual week (saved by older versions) would hide later changes to it.
  for (const [iso, v] of Object.entries(S.settings.dated || {})) if (v === usualOn(iso) && !isBooked(iso)) delete S.settings.dated[iso];
}

function strip(days, { mark = null } = {}) {
  const today = isoDate(), seen = {};
  // Each workout or padel pill has a key (data-k), so a re-planned week can show it moving to its new day.
  const key = d => d.v === 'Padel' ? `p-${d.iso}` : isRoutine(d.v) ? `w-${d.v}-${(seen[d.v] = (seen[d.v] ?? -1) + 1)}` : '';
  return `<div class="wk-strip">${days.slice(1, 8).map(d => {
    const k = key(d);
    const kind = d.v === 'Padel' ? 'padel' : isRoutine(d.v) || d.v === 'Quick' ? 'gym' : d.v === 'Recovery' ? 'rec' : 'rest';
    const label = d.v === 'Padel' ? (d.padel?.type === 'machine' ? 'Machine' : PADEL_TYPES[d.padel?.type] || 'Padel') : isRoutine(d.v) ? app.routine(d.v).title.split(/[ &]/)[0] : d.v === 'Quick' ? 'Gym' : d.v === 'Recovery' ? 'Rec' : '–';
    return `<button class="${kind} ${d.iso === today ? 'today' : ''} ${d.iso === mark ? 'mark' : ''} ${d.iso < today ? 'past' : ''}" data-action="wk-day" data-iso="${d.iso}" aria-label="${esc(dayName(d.iso))}: ${esc(titleOf(d.v))}"><small>${shortDay(d.iso).slice(0, 1)}</small><span class="${label.length > 8 ? 'xs' : label.length > 6 ? 's' : ''}"${k ? ` data-k="${k}"` : ''}>${esc(label)}</span></button>`;
  }).join('')}</div>`;
}
const swapLine = r => { const at = r.days.find((d, i) => i > 0 && i < r.days.length - 1 && d.v === r.swapped.to)?.iso;
  return `Durability${at ? ` on ${dayName(at)}` : ''} instead of ${titleOf(r.swapped.from)} this week, so your shoulders are fresh for overheads`; };
const moveLines = r => [...(r.swapped ? [swapLine(r)] : []), ...r.moved.filter(m => !r.swapped || m.id !== r.swapped.to).map(m => `${titleOf(m.id)} ${m.from ? `moves from ${dayName(m.from)} to ${dayName(m.to)}` : `goes on ${dayName(m.to)}`}`),
  ...r.dropped.map(id => id === r.restKept ? `${titleOf(id)} is skipped this week so you keep one full rest day` : `${titleOf(id)} doesn’t fit this week`)];

// ── Plan tab: this week
export const weekStrip = () => strip(weekWindow());

// ── The Week tab: one week at a time (this week and up to 3 ahead), day by day.
let WK_OFF = 0;
// Coming back to the Week tab from elsewhere starts at this week again.
export const resetWeekView = () => { WK_OFF = 0; };
const dayNum = iso => parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const weekTitle = off => off === 0 ? 'This week' : off === 1 ? 'Next week' : `Week of ${dayNum(isoAdd(monIso(isoDate()), 7 * off))}`;
// Goal phase (or the 4-week cycle) and a busy padel week, for the week you're looking at.
function weekContext(mon, days) {
  const pos = app.position(parseISO(isoAdd(mon, 3))), b = pos.block, busy = weekTargets(days).busy;
  const where = b ? `${goalLabel(S.settings.block)} · week ${b.week} of ${b.weeks} · ${b.phase.name}` : `4-week cycle · week ${pos.week} · ${phaseFor(pos.week).name}`;
  return { text: [where, busy && 'busy padel week'].filter(Boolean).join(' · '), action: b ? 'block-sheet' : 'week-sheet' };
}
export function weekView() {
  const today = isoDate(), mon = isoAdd(monIso(today), 7 * WK_OFF), days = weekWindow(mon), ctx = weekContext(mon, days);
  const free = days.some((d, i) => i > 0 && i < 8 && !d.fixed && d.v !== 'Padel');
  const sug = free ? suggestPadelDays(days, { type: 'match', focus: 'mixed', level: 'normal' }, weekTargets, OPTS, 1)[0] : null;
  const rows = days.slice(1, 8).map(d => {
    const logged = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === d.iso), planned = app.planOn(d.iso);
    const missed = d.iso < today && !logged.length && isRoutine(planned), unplayed = d.iso < today && !logged.length && planned === 'Padel';
    const label = logged.length ? logged.map(s => s.title).join(' + ') : missed ? `${titleOf(planned)} · missed` : unplayed ? 'Padel · not logged'
      : d.v === 'Padel' ? `${padelLabel(d.padel)} · ${MATCH_LEVELS[d.padel?.level || 'normal']}` : titleOf(d.v);
    const padel = logged.length ? logged.some(s => s.activity === 'padel') : d.v === 'Padel';
    const gym = logged.length ? logged.some(s => s.kind === 'strength') : !missed && (isRoutine(d.v) || d.v === 'Quick');
    // A day that differs from your usual week says so (the reason this week can look different).
    const changed = !logged.length && d.iso >= today && S.settings.dated?.[d.iso] != null;
    return `<button class="wk-day ${d.iso === today ? 'today' : ''}" data-action="day-edit" data-iso="${d.iso}" aria-label="${esc(dayName(d.iso))}: ${esc(label)}">
      <span class="wk-d"><b>${shortDay(d.iso)}</b>${d.iso === today ? 'today' : dayNum(d.iso)}</span>
      <span class="wk-what ${padel || unplayed ? 'p' : gym ? 'g' : 'r'} ${missed || unplayed ? 'missed' : ''}">${esc(label)}${changed ? '<em>changed</em>' : ''}</span>
      <span class="wk-st">${logged.length ? icon('check') : ''}</span></button>
      ${sug?.iso === d.iso ? `<button class="wk-sug" data-action="week-add" data-iso="${d.iso}" data-type="match">+ Best day for another padel session${sug.moved.length ? ` · ${sug.moved.length} workout${sug.moved.length > 1 ? 's' : ''} would move` : ''}</button>` : ''}`;
  }).join('');
  return `${pageHead('Week')}
    <div class="wk-nav"><button data-action="wk-nav" data-d="-1" ${WK_OFF <= 0 ? 'disabled' : ''} aria-label="Previous week">‹</button><h2>${weekTitle(WK_OFF)}</h2><button data-action="wk-nav" data-d="1" ${WK_OFF >= 3 ? 'disabled' : ''} aria-label="Next week">›</button></div>
    <button class="wk-ctx" data-action="${ctx.action}">${esc(ctx.text)}</button>
    <div class="card wk-list">${rows}</div>
    <div class="quick-row"><button class="btn filled" data-action="week-add">${icon('plus')}Add Padel</button><button class="btn tinted" data-action="usual-week">Your Usual Week</button></div>`;
}

// Change one date: the day becomes what you picked, and the workouts still to do this week are re-placed
// around it. Returns the planned week (r) for a proposal.
export function planDayChange(iso, v) {
  const before = weekWindow(iso), t = weekTargets(before), list = [...t.list];
  if (isRoutine(v) && list.includes(v)) list.splice(list.indexOf(v), 1);
  const next = before.map(d => d.iso === iso ? { ...d, v, padel: null, fixed: true } : d);
  return planWeek(next, list, { ...OPTS, busy: t.busy, alt: t.alt });
}
async function commitDay(iso, v) {
  if (v !== 'Padel') { delete S.settings.padelPlan?.[iso]; if (S.settings.matchLevel) delete S.settings.matchLevel[iso]; }
  setDated(iso, v); await app.save('settings');
}
// Your usual weekday changes, and this week's (and later) matching days follow; padel you booked for this
// week's date stays unless you say so (you're asked).
// A usual weekday becoming padel: re-plan the usual week so the workout that was there gets another day, and
// show it before anything changes. Rest or recovery turning into padel only asks when the week clearly improves.
const WEEKDAY = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
let USUAL = null;
export function usualWithPadel(sched, d) {
  const before = { ...sched, [d]: 'Padel' }, was = sched[d], gym = DAYS.filter(x => isRoutine(before[x]));
  const ids = [...gym.map(x => before[x]), ...(isRoutine(was) ? [was] : [])];
  if (!ids.length) return { next: before, changed: [], skipped: [], worth: false };
  const padelDays = DAYS.filter(x => before[x] === 'Padel'), levels = S.settings.padelLevel || {}, kinds = usualKinds();
  let best = bestWeek(ids, padelDays, isLegHeavy, levels, S.profile.trainDays, kinds);
  // Not enough training days in your setup: use any free day rather than lose a workout.
  if (best.ids.length < ids.length) best = bestWeek(ids, padelDays, isLegHeavy, levels, null, kinds);
  const next = { ...before }; gym.forEach(x => { next[x] = 'Rest'; });
  best.days.forEach((x, i) => { next[x] = best.ids[i]; });
  if (DAYS.some(x => before[x] === 'Recovery') && !DAYS.some(x => next[x] === 'Recovery')) { const free = DAYS.filter(x => next[x] === 'Rest'); if (free.length) next[free[Math.floor(free.length / 2)]] = 'Recovery'; }
  const skipped = [...ids]; best.ids.forEach(id => skipped.splice(skipped.indexOf(id), 1));
  const changed = DAYS.filter(x => x !== d && next[x] !== sched[x]);
  // A workout lost its day: always worth showing. Otherwise only when the week is clearly better (as A Better Week).
  const worth = isRoutine(was) || scheduleScore(before, isRoutine, isLegHeavy, levels, kinds) - best.score >= 1.9;
  return { next, changed, skipped, worth: worth && (changed.length > 0 || skipped.length > 0) };
}
function usualPadelSheet(d) {
  const sched = { ...S.schedule }, was = sched[d], r = usualWithPadel(sched, d);
  if (!r.worth) return null;
  USUAL = { d, next: r.next, plain: { ...sched, [d]: 'Padel' } };
  app.sheet(`<h2 class="sheet-title">Every ${WEEKDAY[d]}: padel</h2><p class="sheet-sub">${isRoutine(was) ? `${esc(titleOf(was))} needs a new day. Here’s your usual week with it moved.` : 'Your workouts fit better around it like this.'}</p>
    ${group(DAYS.map(x => row({ title: WEEKDAY[x], sub: x === d || r.changed.includes(x) ? '<span class="orange">Changed</span>' : '', value: esc(titleOf(r.next[x])), chevron: false })).join(''))}
    ${r.skipped.length ? `<p class="hero-note">${esc(r.skipped.map(titleOf).join(' and '))} doesn’t fit around your padel, so it’s left out.</p>` : ''}
    <div class="btns"><button class="btn filled" data-action="usual-use">Use This Week</button><button class="btn plain" data-action="usual-plain">${isRoutine(was) ? `Just Make ${WEEKDAY[d]} Padel` : 'Keep Workouts Where They Are'}</button></div>
    ${isRoutine(was) ? `<p class="t-foot" style="text-align:center">With “Just make ${WEEKDAY[d]} padel”, ${esc(titleOf(was))} leaves your usual week.</p>` : ''}`);
  // The days that change arrive one after another, so you can follow what moved.
  rise([...document.querySelectorAll('#sheetBody .row')].filter(el => el.querySelector('.row-sub .orange')).map(el => el.querySelector('.row-value')), { delay: 200, stagger: 90 });
  return true;
}
async function applyUsual(next, weekday = null) {
  const old = { ...S.schedule };
  S.schedule = next; await app.save('schedule'); followUsualWeek(weekday); await app.save('settings');
  USUAL = null; app.closeSheet(); app.render({ keepScroll: true });
  app.toast('Usual week updated', async () => { S.schedule = old; await app.save('schedule'); app.render({ keepScroll: true }); });
}

export async function setUsualDay(d, v) {
  if (v === 'Padel' && S.schedule[d] !== 'Padel' && usualPadelSheet(d)) return;
  S.schedule[d] = v; await app.save('schedule');
  const kept = followUsualWeek(d); await app.save('settings');
  app.closeSheet(); app.render({ keepScroll: true });
  const iso = kept[0], name = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }[d];
  if (iso && v !== 'Padel') app.sheet(`<h2 class="sheet-title">This ${name} still has padel</h2><p class="sheet-sub">Your usual ${name} is now ${esc(titleOf(v).toLowerCase())}, but you added padel for this date (${esc(PADEL_TYPES[app.padelOn(iso)?.type] || 'Match')}). Remove it too?</p>
    <div class="btns"><button class="btn destructive" data-action="wk-remove" data-iso="${iso}">Remove This ${name}’s Padel</button><button class="btn plain" data-action="close-sheet">Keep It</button></div>`);
  else app.toast(`Every ${name}: ${titleOf(v)}${v === 'Padel' ? '. Your workouts already fit around it.' : ''}`);
}

// One sheet for a day: what it is, and whether a change is for this week only or every week.
function dayEditSheet(iso) {
  const today = isoDate(), wd = DAYS[(parseISO(iso).getDay() + 6) % 7], done = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === iso);
  if (iso < today || done.length) {
    const planned = app.planOn(iso);
    return app.sheet(`<h2 class="sheet-title">${esc(fmtDay(iso))}</h2><div style="height:12px"></div>
      ${done.length ? group(done.map(s => row({ title: esc(s.title), sub: `${s.durationMin || '—'} min`, to: `history/session/${s.id}` })).join(''))
        : `<p class="t-sub" style="text-align:center;margin:8px 0 18px">${isRoutine(planned) ? `${esc(titleOf(planned))} was planned; nothing logged.` : 'Nothing logged.'}</p>`}
      <div class="btns">${iso === today ? '<button class="btn tinted" data-action="log-activity" data-kind="padel">Log Padel or Activity</button>' : ''}<button class="btn plain" data-action="close-sheet">Close</button></div>`);
  }
  S.form = { dayScope: 'just' };
  const draw = () => {
    const every = S.form.dayScope === 'every', d = weekWindow(iso).find(x => x.iso === iso), cur = every ? S.schedule[wd] : d.v;
    const from = isBooked(iso) ? 'Padel added for this date' : S.settings.dated?.[iso] != null ? 'Changed for this week' : `From your usual ${dayName(iso)}`;
    const opts = [...new Set([...allRoutineIds(), ANCHOR_ID])].filter(isRoutine);
    const tick = v => cur === v ? icon('check', 'check-mark') : '';
    return `<h2 class="sheet-title">${esc(fmtDay(iso))}</h2><p class="sheet-sub">${esc(from)}</p>
      ${seg('dayScope', [['just', `Just this ${dayName(iso)}`], ['every', `Every ${dayName(iso)}`]], S.form.dayScope)}<div style="height:12px"></div>
      ${group(opts.map(v => row({ title: esc(titleOf(v)), action: 'day-set', data: { iso, v }, chevron: false, right: tick(v) })).join('')
        + row({ title: 'Padel', sub: !every && d.v === 'Padel' ? esc(`${padelLabel(d.padel)} · ${MATCH_LEVELS[d.padel?.level || 'normal']} · change`) : every ? 'Your usual padel day' : 'Match, lesson, training or ball machine', action: 'day-set', data: { iso, v: 'Padel' }, chevron: false, right: tick('Padel') })
        + row({ title: 'Recovery', sub: 'Light movement and mobility', action: 'day-set', data: { iso, v: 'Recovery' }, chevron: false, right: tick('Recovery') })
        + row({ title: 'Rest', action: 'day-set', data: { iso, v: 'Rest' }, chevron: false, right: tick('Rest') }),
        { footer: every ? `Changes every ${dayName(iso)} from now on.` : 'If a workout has to move, you see the new week before anything changes.' })}
      ${!every && S.settings.dated?.[iso] != null ? `<button class="btn plain" data-action="day-reset" data-iso="${iso}">Back to Your Usual ${esc(dayName(iso))}</button>` : ''}`;
  };
  app.onPick = () => app.sheet(draw());
  app.sheet(draw());
}

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
  S.form = { wkIso: iso || '', wkType: type || cur?.type || last?.type || 'match', wkFocus: cur?.focus || last?.focus || 'mixed', wkLevel: iso && cur ? app.matchLevel(iso) : 'normal', wkEdit: !!cur };
  const f = () => S.form;
  const days = Array.from({ length: 7 }, (_, k) => isoAdd(today, k));
  const draw = () => `<h2 class="sheet-title">${f().wkEdit ? 'Change padel' : 'Add padel'}</h2><p class="sheet-sub">${f().wkIso ? esc(fmtDay(f().wkIso)) : 'Pick the day it’s booked for.'}</p>
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
  if (!p.iso) return app.toast('Pick the day first');
  if (p.iso < today || p.iso > isoAdd(today, MAX_AHEAD)) return app.toast('Pick a day from today on');
  const before = weekWindow(p.iso), padel = { type: p.type, focus: p.focus, level: p.level };
  const at = before.find(d => d.iso === p.iso);
  if (at?.fixed && at.v !== 'Padel') return app.toast('You’ve already trained that day');
  const was = weekTargets(before), t = weekTargets(before.map(d => d.iso === p.iso ? { ...d, v: 'Padel', padel, fixed: true } : d));
  // The workouts to place: on a busy-week switch, the new set; otherwise what's left (incl. the one on that day).
  const list = was.busy !== t.busy ? t.list : workoutsLeft(before, isRoutine).map(id => !t.busy || id === ANCHOR_ID || !legWork(id) ? id : null).filter(Boolean);
  setPadelDetails(p.iso, p);
  S.settings.dated = { ...(S.settings.dated || {}), [p.iso]: 'Padel' };
  const r = withPadel(before, p.iso, padel, list, { ...OPTS, busy: t.busy, alt: t.busy ? t.alt : null });
  const note = busyNote(was, t);
  if (!r || (!r.moved.length && !r.dropped.length && !note)) {
    await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true });
    return app.toast(`${edit ? 'Saved' : `${padelLabel(p)} on ${dayName(p.iso)} added`}. Your workouts already fit.`);
  }
  await app.save('settings');
  proposal(r, p.iso, `${padelLabel(p)} on ${dayName(p.iso)}`, isRoutine(at?.v) ? at.v : null, note, null, before);
}

// A re-planned week to accept or not.
// lost: the workout that was on the new padel day (skipped this week if you keep the rest as it is).
// keep: what "Keep Workouts Where They Are" does (a day you changed still changes; only the others stay put).
// before: the week as it was (default: as it stands now). The sheet opens on it, then the workouts move to their
// new days, so you see what changed rather than only the result.
function proposal(r, mark, what, lost = null, note = '', keep = null, before = null) {
  const prop = PROPOSAL = { days: r.days, mark, lost, keep }, was = before || weekWindow(mark), animate = !reduced();
  app.sheet(`<h2 class="sheet-title">Your week with ${esc(what)}</h2><p class="sheet-sub">${esc(note || 'Workouts placed around your padel.')}</p>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">${strip(animate ? was : r.days, { mark: animate ? null : mark })}</div>
    <ul class="week-moves">${moveLines(r).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="btns"><button class="btn filled" data-action="wk-use">Use This Week</button><button class="btn plain" data-action="wk-keep">Keep Workouts Where They Are</button></div>`);
  if (!animate) return;
  rise(document.querySelectorAll('#sheetBody .week-moves li'), { delay: 750 });
  setTimeout(() => {
    const box = document.querySelector('#sheet[open] #sheetBody .wk-strip');
    if (!box || PROPOSAL !== prop) return;
    const t = document.createElement('template'); t.innerHTML = strip(r.days, { mark });
    flip(box, () => { box.innerHTML = t.content.firstElementChild.innerHTML; });
  }, 250);
}

async function removePadel(iso) {
  const before = weekWindow(iso);
  delete S.settings.padelPlan?.[iso];
  if (S.settings.matchLevel) delete S.settings.matchLevel[iso];
  setDated(iso, 'Rest');
  const days = before.map(d => d.iso === iso ? { ...d, v: 'Rest', padel: null, fixed: false } : d);
  const was = weekTargets(before), t = weekTargets(days), note = busyNote(was, t);
  const r = planWeek(days, t.list, { ...OPTS, busy: t.busy, alt: t.alt });
  await app.save('settings');
  if (!r.moved.length && !note) { app.closeSheet(); app.render({ keepScroll: true }); return app.toast(`Padel on ${dayName(iso)} removed`); }
  proposal(r, iso, `no padel on ${dayName(iso)}`, null, note, null, before);
}

function daySheet(iso) {
  const today = isoDate(), d = weekWindow(iso).find(x => x.iso === iso), wd = DAYS[(parseISO(iso).getDay() + 6) % 7];
  const done = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === iso);
  // Where the day comes from: booked for this date, re-planned for this week, or your usual weekday.
  const from = done.length ? '' : isBooked(iso) ? 'Added for this date' : S.settings.dated?.[iso] != null ? 'Planned for this week' : `From your usual ${dayName(iso)}`;
  const body = d.v === 'Padel'
    ? group(row({ title: esc(padelLabel(d.padel)), sub: esc([MATCH_LEVELS[d.padel?.level || 'normal'], from].filter(Boolean).join(' · ')), icon: 'racket', color: 'teal', chevron: false }))
    : group(row({ title: esc(titleOf(d.v)), sub: done.length ? 'Done' : iso < today ? 'Not logged' : from, icon: isRoutine(d.v) ? 'dumbbell' : d.v === 'Recovery' ? 'heart' : 'snow', color: isRoutine(d.v) ? 'blue' : 'gray', chevron: false }));
  const can = iso >= today && !done.length;
  app.sheet(`<h2 class="sheet-title">${esc(fmtDay(iso))}</h2><div style="height:12px"></div>${body}
    <div class="btns">${can && d.v === 'Padel' ? `<button class="btn tinted" data-action="week-add" data-iso="${iso}">Change Padel</button><button class="btn destructive" data-action="wk-remove" data-iso="${iso}">Remove Padel</button>` : ''}
    ${can && d.v !== 'Padel' ? `<button class="btn tinted" data-action="week-add" data-iso="${iso}">Add Padel Here</button>` : ''}
    <button class="btn plain" data-action="day-sheet-usual" data-day="${wd}">Change Your Usual ${esc(dayName(iso))}</button></div>`);
}

export const removeBooking = iso => removePadel(iso);
export const weekActions = {
  'wk-nav'(el) { WK_OFF = Math.max(0, Math.min(3, WK_OFF + +el.dataset.d)); app.render(); },
  'day-edit'(el) { dayEditSheet(el.dataset.iso); },
  async 'day-set'(el) {
    const { iso, v } = el.dataset, wd = DAYS[(parseISO(iso).getDay() + 6) % 7];
    if (S.form.dayScope === 'every') return setUsualDay(wd, v);
    if (v === 'Padel') return addPadelSheet(iso);
    const r = planDayChange(iso, v);
    if (!r.moved.length && !r.dropped.length) { await commitDay(iso, v); app.closeSheet(); app.render({ keepScroll: true }); return app.toast(`${dayName(iso)}: ${titleOf(v)} this week`); }
    proposal(r, iso, `${titleOf(v)} on ${dayName(iso)}`, null, '', () => commitDay(iso, v));
  },
  async 'day-reset'(el) {
    const iso = el.dataset.iso;
    delete S.settings.padelPlan?.[iso]; if (S.settings.matchLevel) delete S.settings.matchLevel[iso];
    if (S.settings.dated) delete S.settings.dated[iso];
    await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast(`${dayName(iso)} is back to your usual week`);
  },
  'week-add'(el) { addPadelSheet(el.dataset.iso || null, el.dataset.type || null); },
  'week-ask-off'() { S.settings.weekAsked = monIso(isoDate()); app.save('settings'); app.render({ keepScroll: true }); },
  'wk-day'(el) { daySheet(el.dataset.iso); },
  'wk-remove'(el) { removePadel(el.dataset.iso); },
  async 'usual-use'() { if (USUAL) await applyUsual(USUAL.next); },
  async 'usual-plain'() { if (USUAL) await applyUsual(USUAL.plain, USUAL.d); },
  async 'wk-use'() { if (!PROPOSAL) return app.closeSheet(); await applyWeek(PROPOSAL.days, PROPOSAL.mark); if (PROPOSAL.keep) await PROPOSAL.keep(); PROPOSAL = null; app.closeSheet(); app.render({ keepScroll: true }); app.toast('Week updated'); },
  async 'wk-keep'() {
    // Padel stays; a workout that was on that day is skipped this week.
    const lost = PROPOSAL?.lost, keep = PROPOSAL?.keep; PROPOSAL = null; if (keep) await keep(); app.closeSheet(); app.render({ keepScroll: true });
    app.toast(lost ? `Workouts kept where they were; ${titleOf(lost)} is skipped this week` : 'Workouts kept where they were');
  },
  // Your usual weekday lives on Plan: open its sheet there.
  'day-sheet-usual'(el) {
    app.closeSheet();
    if (S.route === 'plan' && !S.params.length) return app.view().actions['day-sheet'](el);
    S.openDay = el.dataset.day; app.go('plan');
  },
};
