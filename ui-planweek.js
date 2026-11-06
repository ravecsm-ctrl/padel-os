// Plan Your Week: tap the days you're playing padel and the week's workouts fit around them while you watch.
// The workouts start in a tray ("This week's workouts") and fly to their days; every tap re-plans from the week as
// it was when the planner opened, so the order you tap in can't change the result. Nothing is saved before
// Looks Good. See PLAN-WEEK.md.
import { app, S } from './core-app.js';
import { esc, seg, chips, icon, group, row } from './ui-kit.js';
import { isRoutine } from './domain-program.js';
import { isoDate, parseISO } from './domain-calendar.js';
import { PADEL_TYPES, PADEL_FOCUS, hasFocus } from './domain-padel.js';
import { MATCH_LEVELS } from './domain-matchlevel.js';
import { planWeek, workoutsLeft, suggestPadelDays } from './domain-weekplan.js';
import { ANCHOR_ID } from './domain-busy.js';
import { flip, reduced, announce } from './ui-motion.js';
import { recordSignal, dropSignal } from './ui-habits.js';
import { dayKind, dayPill, padelPill } from './ui-days.js';
import { OPTS, weekWindow, weekTargets, monIso, isoAdd, dayName, titleOf, legWork, busyNote, moveLines, setDated,
  setPadelDetails, applyWeek, isBooked, showWeekOf, spotDays, rolesOf, shownAs, flexChoices, afterFlex } from './ui-week.js';

const same = (a, b) => !!a === !!b && (!a || (a.type === b.type && (hasFocus(a.type) ? a.focus : '') === (hasFocus(b.type) ? b.focus : '') && (a.level || 'normal') === (b.level || 'normal')));
const padelChanged = (start, padel, open) => open.some(iso => !same(padel[iso], start.find(d => d.iso === iso)?.v === 'Padel' ? start.find(d => d.iso === iso).padel : null));

// The week planned around your padel. start: the week (weekWindow) as it was when the planner opened.
// padel: { iso: { type, focus, level } } for every padel day you can still change; open: the dates you can change.
// Returns planWeek's result plus busy and the busy-week note; no padel change returns the week as it was.
export function plannedWeek(start, padel, open) {
  if (!padelChanged(start, padel, open)) return { days: start, moved: [], dropped: [], busy: weekTargets(start).busy, note: '' };
  const days = start.map(d => !open.includes(d.iso) ? d : padel[d.iso] ? { ...d, v: 'Padel', padel: padel[d.iso], fixed: true }
    : d.v === 'Padel' ? { ...d, v: 'Rest', padel: null, fixed: false } : d);
  const was = weekTargets(start), t = weekTargets(days);
  // As when you add one session: on a busy-week switch the new set of workouts, otherwise the ones the week had
  // (including any on a day that's now padel).
  const list = was.busy !== t.busy ? t.list : workoutsLeft(start, isRoutine).map(id => !t.busy || id === ANCHOR_ID || !legWork(id) ? id : null).filter(Boolean);
  const at = {}; start.forEach((d, i) => { if (open.includes(d.iso) && padel[d.iso] && isRoutine(d.v) && list.includes(d.v)) at[d.v] = i; });
  const recovery = start.some(d => open.includes(d.iso) && padel[d.iso] && d.v === 'Recovery' && !d.fixed);
  const r = planWeek(days, list, { ...OPTS, busy: t.busy, alt: t.busy ? t.alt : null, recovery, was: at });
  return { ...r, busy: t.busy, note: busyNote(was, t) };
}

// Your Flex choices (DAY-ROLES.md) on top of the planned week: a pick stays only while its day is still a Flex day.
export function withPicks(r, picks = {}) {
  if (!Object.keys(picks).length) return r;
  const roles = rolesOf(r.days), applied = [];
  const days = r.days.map((d, i) => { const p = picks[d.iso]; if (!p || roles[i]?.role !== 'flex' || !isRoutine(d.v) || p === d.v) return d; applied.push({ iso: d.iso, was: d.v, id: p }); return { ...d, v: p }; });
  return { ...r, days, picks: applied };
}

// The days you can still change: from today on, nothing logged yet (padel days count, unlike in the planner).
export function openDays(start) {
  const today = isoDate();
  return start.slice(1, 8).filter(d => d.iso >= today && !(d.fixed && d.v !== 'Padel')
    && !S.sessions.some(s => isoDate(new Date(s.startedAt)) === d.iso) && !(d.iso === today && S.active)).map(d => d.iso);
}

// Is this week (or next week, on a Sunday) still waiting to be planned?
export function weekUnsettled(mon) {
  const today = isoDate(), thisMon = monIso(today), dow = (parseISO(today).getDay() + 6) % 7;
  const due = mon === thisMon ? dow <= 3 : mon === isoAdd(thisMon, 7) && dow === 6;
  if (!due || S.settings.weekAsked === mon) return false;
  return !Object.keys(S.settings.padelPlan || {}).some(iso => iso >= mon && iso <= isoAdd(mon, 6));
}
// The week the weekly question is about right now (this week, or next week on a Sunday), or null.
export function weekToAsk() {
  const thisMon = monIso(isoDate());
  return weekUnsettled(thisMon) ? thisMon : weekUnsettled(isoAdd(thisMon, 7)) ? isoAdd(thisMon, 7) : null;
}

// ── The planner sheet
let PW = null;
const shortDay = iso => parseISO(iso).toLocaleDateString(undefined, { weekday: 'short' });
const dayNum = iso => parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fit = l => l.length > 8 ? 'xs' : l.length > 6 ? 's' : '';
function defaultPadel() {
  const last = S.sessions.find(s => s.activity === 'padel' && s.padel?.type)?.padel;
  const type = last?.type && PADEL_TYPES[last.type] ? last.type : 'match';
  return { type, focus: hasFocus(type) ? last?.focus || 'mixed' : null, level: 'normal' };
}

// The board: the tray and the seven days. mode: 'days' (the week as it was), 'tray' (workouts waiting in the tray)
// or 'placed' (the week planned around your padel).
function board(mode, padel) {
  const { start, open } = PW, r = mode === 'placed' ? withPicks(plannedWeek(start, padel, open), PW.picks) : null, seen = {};
  const key = id => `w-${id}-${(seen[id] = (seen[id] ?? -1) + 1)}`;
  const today = isoDate();
  const shown = start.slice(1, 8).map((d, i) => {
    if (!open.includes(d.iso)) return { ...d, locked: true };
    if (mode === 'days') return d;
    if (mode === 'tray') return padel[d.iso] ? { ...d, v: 'Padel', padel: padel[d.iso] } : { ...d, v: '' };
    return r.days[i + 1];
  });
  // ★ the best free day for one more padel session (as on the Week tab).
  const base = mode === 'placed' ? r.days : start.map(d => open.includes(d.iso) && mode === 'tray' && padel[d.iso] ? { ...d, v: 'Padel', padel: padel[d.iso], fixed: true } : d);
  const best = mode !== 'days' && open.some(iso => !padel[iso]) ? suggestPadelDays(base, PW.def, weekTargets, OPTS, 1)[0]?.iso : null;
  const roles = mode === 'tray' ? [] : rolesOf(mode === 'placed' ? r.days : start);
  const slots = shown.map((d0, i) => {
    const role = d0.locked ? null : roles[i + 1], d = { ...d0, v: shownAs(d0, role) }, fx = role?.role === 'flex';
    const usual = d.v === 'Padel' && !d.locked && !isBooked(d.iso) && same(padel[d.iso], PW.init[d.iso]);
    const kind = dayKind(d.v), label = dayPill(d.v, d.padel);
    const k = d.locked ? '' : d.v === 'Padel' ? `p-${d.iso}` : isRoutine(d.v) ? key(d.v) : '';
    const what = d.v === 'Padel' ? `${padelPill(d.padel)}${usual ? ', your usual padel' : ''}` : label ? `${titleOf(d.v)}${fx ? ', Flex day' : ''}` : 'free';
    return `<button class="${kind} ${d.iso === today ? 'today' : ''} ${d.locked ? 'past' : ''} ${d.iso === best ? 'best' : ''}" data-action="pw-day" data-iso="${d.iso}" aria-label="${esc(dayName(d.iso))}: ${esc(what)}${d.locked ? ', can’t change' : ''}">
      <small>${shortDay(d.iso).slice(0, 1)}${d.iso === best ? '<i aria-hidden="true">★</i>' : ''}</small><span class="${label ? fit(label) : d.locked ? '' : 'pw-empty'}"${k ? ` data-k="${k}"` : ''}>${label ? esc(label) : d.locked ? '–' : '+'}</span>${usual ? '<em>usual</em>' : fx ? '<em aria-hidden="true">⇄</em>' : ''}</button>`;
  }).join('');
  const trayIds = mode === 'tray' ? workoutsLeft(start, isRoutine) : mode === 'placed' ? r.dropped : [];
  const tray = trayIds.map(id => `<span class="pw-chip ${mode === 'placed' ? 'off' : ''}" data-k="${key(id)}">${esc(dayPill(id))}</span>`).join('');
  const head = mode === 'placed' ? (trayIds.length ? 'Doesn’t fit this week' : 'Every workout has a day') : 'This week’s workouts';
  return { html: `<div class="pw-tray"><small>${head}</small><div class="pw-chips">${tray}</div></div><div class="wk-strip pw-strip">${slots}</div>`, r };
}
// Under the board: how hard the padel you just added is (one tap re-plans), and the Flex days you can choose for.
function extra(r) {
  const p = PW.last && PW.padel[PW.last];
  const lvl = PW.mode === 'placed' && p ? `<div class="pw-level"><small>${esc(dayName(PW.last))}’s padel: how hard?</small>${seg('pwLvl', Object.entries(MATCH_LEVELS), p.level || 'normal')}</div>` : '';
  const roles = r ? rolesOf(r.days) : [];
  const fx = r ? r.days.map((d, i) => ({ d, i })).filter(({ d, i }) => roles[i]?.role === 'flex' && PW.open.includes(d.iso)) : [];
  const rows = fx.map(({ d }) => `<button class="link pw-fx" data-action="pw-flex" data-iso="${d.iso}">⇄ ${esc(dayName(d.iso))}: ${esc(titleOf(d.v))} · Change</button>`).join('');
  return lvl + (rows ? `<div class="pw-fxs"><small>Flex days: no match either side</small>${rows}</div>` : '');
}
const boardPick = (name, value) => {
  if (name !== 'pwLvl' || !PW?.last || !PW.padel[PW.last]) return;
  PW.padel = { ...PW.padel, [PW.last]: { ...PW.padel[PW.last], level: value } };
  morph('placed');
};
const noteOf = r => r ? [r.note, ...moveLines(r).slice(0, 2)].filter(Boolean).join(' · ') : 'Tap the days you’re playing. Your workouts fit around them.';

function draw() {
  const b = board(PW.mode, PW.padel), last = PW.start[7].iso;
  app.onPick = boardPick;
  return `<h2 class="sheet-title">What’s your padel ${PW.mon === monIso(isoDate()) ? 'this week' : 'next week'}?</h2>
    <p class="sheet-sub">${esc(dayNum(PW.mon))} – ${esc(dayNum(last))}</p>
    <div class="card pw-card"><div class="pw-board">${b.html}</div><div class="pw-extra">${extra(b.r)}</div></div>
    <p class="pw-note">${esc(noteOf(b.r))}</p>
    <div class="btns">${PW.mode === 'placed' ? '<button class="btn filled" data-action="pw-save">Looks Good</button>' : '<button class="btn filled" data-action="pw-usual">Same as Usual</button>'}
    <button class="btn plain" data-action="pw-later">Not Now</button></div>`;
}
// Move from what's on screen to the new state: workouts fly between the tray and the days.
function morph(mode) {
  const box = document.querySelector('#sheet[open] .pw-board');
  PW.mode = mode;
  if (!box) return app.sheet(draw());
  const b = board(mode, PW.padel);
  flip(box, () => { box.innerHTML = b.html; }, { stagger: 40 });
  const ex = document.querySelector('#sheet[open] .pw-extra'); if (ex) ex.innerHTML = extra(b.r);
  app.onPick = boardPick;
  const note = document.querySelector('#sheet[open] .pw-note'), text = noteOf(b.r);
  if (note && note.textContent !== text) { note.textContent = text; if (b.r) announce(text); }
  const btns = document.querySelector('#sheet[open] .btns');
  if (btns && mode === 'placed') btns.firstElementChild.outerHTML = '<button class="btn filled" data-action="pw-save">Looks Good</button>';
}

// off: weeks from this one (0 this week, 1 next week …).
export function planWeekSheet(off = 0) {
  const mon = isoAdd(monIso(isoDate()), 7 * off), start = weekWindow(mon), open = openDays(start);
  if (!open.length) return app.toast('Nothing left to plan this week');
  const init = Object.fromEntries(start.filter(d => open.includes(d.iso) && d.v === 'Padel').map(d => [d.iso, { type: d.padel?.type || 'match', focus: d.padel?.focus || null, level: d.padel?.level || 'normal' }]));
  PW = { mon, start, open, init, padel: { ...init }, def: defaultPadel(), mode: reduced() ? 'tray' : 'days', edit: null, picks: {}, last: null };
  app.onPick = null;
  app.sheet(draw());
  // The workouts lift off their days into the tray, so the week looks empty and ready to plan.
  if (PW.mode === 'days') { const me = PW; setTimeout(() => { if (PW === me && PW.mode === 'days') morph('tray'); }, 250); }
}

// One padel day's details, inside the planner.
function editDraw() {
  const iso = PW.edit, f = S.form;
  return `<h2 class="sheet-title">Padel on ${esc(dayName(iso))}</h2><p class="sheet-sub">The type changes your week: matches are the toughest on your legs.</p>
    <label class="field-l">Type</label>${chips('pwType', Object.keys(PADEL_TYPES), f.pwType, k => PADEL_TYPES[k])}
    ${hasFocus(f.pwType) ? `<label class="field-l">Working on</label>${chips('pwFocus', Object.keys(PADEL_FOCUS), f.pwFocus, k => PADEL_FOCUS[k])}` : ''}
    <label class="field-l">How hard?</label>${seg('pwLevel', Object.entries(MATCH_LEVELS), f.pwLevel)}
    <div style="height:20px"></div><div class="btns"><button class="btn filled" data-action="pw-edit-done">Done</button>
    <button class="btn destructive" data-action="pw-remove">Remove Padel</button></div>`;
}
// Back from the details: the board opens on the week as it was, then moves to the new one.
function backToBoard(prev) {
  const now = PW.padel; PW.edit = null; app.onPick = null;
  PW.padel = prev; app.sheet(draw()); PW.padel = now;
  if (reduced()) return app.sheet(draw());
  requestAnimationFrame(() => morph('placed'));
}

export const planWeekActions = {
  'pw-open'(el) { planWeekSheet(+(el.dataset.off || 0)); },
  'pw-day'(el) {
    if (!PW) return;
    const iso = el.dataset.iso;
    if (!PW.open.includes(iso)) return app.toast(iso < isoDate() ? 'That day has passed' : 'Already logged that day');
    const p = PW.padel[iso];
    if (p && !(PW.init[iso] && !isBooked(iso) && same(p, PW.init[iso]))) {
      // Padel you added or booked: change its type or remove it.
      PW.edit = iso; PW.prev = { ...PW.padel };
      S.form = { pwType: p.type, pwFocus: p.focus || 'mixed', pwLevel: p.level || 'normal' };
      app.onPick = () => {
        PW.padel = { ...PW.padel, [iso]: { type: S.form.pwType, focus: hasFocus(S.form.pwType) ? S.form.pwFocus : null, level: S.form.pwLevel } };
        app.sheet(editDraw());
      };
      return app.sheet(editDraw());
    }
    // A free day becomes padel; your usual padel day taps off for this week (and back on).
    const next = { ...PW.padel };
    if (p) delete next[iso]; else next[iso] = PW.init[iso] || { ...PW.def };
    PW.padel = next;
    PW.last = p ? (PW.last === iso ? null : PW.last) : PW.init[iso] ? PW.last : iso;
    morph('placed');
  },
  'pw-edit-done'() { if (PW?.edit) backToBoard(PW.prev); },
  // A Flex day's choices, inside the planner: the planned workout or one you need more.
  'pw-flex'(el) {
    if (!PW) return;
    const iso = el.dataset.iso, r = plannedWeek(PW.start, PW.padel, PW.open), d = r.days.find(x => x.iso === iso);
    if (!d || !isRoutine(d.v)) return;
    const others = { ...PW.picks }; delete others[iso];
    const opts = flexChoices(withPicks(r, others).days, iso, d.v).slice(0, 4), cur = PW.picks[iso] || d.v;
    const tick = v => cur === v ? icon('check', 'check-mark') : '';
    app.onPick = null;
    app.sheet(`<h2 class="sheet-title">Flex day: ${esc(dayName(iso))}</h2><p class="sheet-sub">No match the day before or after, so anything heavy is fine.</p>
      ${group(row({ title: esc(titleOf(d.v)), sub: 'Planned', action: 'pw-pick', data: { iso, v: d.v }, chevron: false, right: tick(d.v) })
        + opts.map(o => row({ title: esc(titleOf(o.id)), sub: esc(o.reason), action: 'pw-pick', data: { iso, v: o.id }, chevron: false, right: tick(o.id) })).join(''), { footer: 'Picked by what you need most: what doesn’t fit this week, then what you haven’t done for longest.' })}
      <div class="btns"><button class="btn plain" data-action="pw-pick" data-iso="${iso}" data-v="${cur}">Back</button></div>`);
  },
  'pw-pick'(el) {
    if (!PW) return;
    const { iso, v } = el.dataset, next = { ...PW.picks }; next[iso] = v;
    PW.picks = next; PW.mode = 'placed'; app.sheet(draw());
  },
  'pw-remove'() {
    if (!PW?.edit) return;
    const prev = PW.prev, next = { ...PW.padel }; delete next[PW.edit]; PW.padel = next;
    backToBoard(prev);
  },
  'pw-usual'() { if (PW) morph('placed'); },
  'pw-later'() { PW = null; app.onPick = null; recordSignal('pw-later'); app.closeSheet(); },
  async 'pw-save'() {
    if (!PW) return app.closeSheet();
    const { start, open, init, padel, mon } = PW, r = withPicks(plannedWeek(start, padel, open), PW.picks);
    const keys = ['dated', 'padelPlan', 'matchLevel'], undo = Object.fromEntries(keys.map(k => [k, { ...(S.settings[k] || {}) }])), owedWas = S.settings.owed;
    const asked = S.settings.weekAsked, changedPadel = padelChanged(start, padel, open);
    for (const iso of open) {
      const was = init[iso], now = padel[iso];
      if (now && (!was || isBooked(iso) || !same(now, was))) { setPadelDetails(iso, now); S.settings.dated = { ...(S.settings.dated || {}), [iso]: 'Padel' }; }
      else if (!now && was) { delete S.settings.padelPlan?.[iso]; if (S.settings.matchLevel) delete S.settings.matchLevel[iso]; setDated(iso, 'Rest'); }
    }
    S.settings.weekAsked = mon;
    await applyWeek(r.days);
    const notes = []; for (const p of r.picks || []) { const n = await afterFlex(p.iso, p.was); if (n) notes.push(n); }
    const changed = open.filter(iso => { const a = start.find(d => d.iso === iso), b = r.days.find(d => d.iso === iso); return a.v !== b.v || !same(padel[iso], init[iso]); });
    PW = null; app.onPick = null;
    const sig = changedPadel ? 'pw-done' : 'pw-usual';
    recordSignal(sig);
    app.closeSheet();
    if (S.route === 'plan') showWeekOf(mon);
    app.render({ keepScroll: true });
    app.toast(notes[0] || (changed.length ? 'Week planned' : 'Your usual week it is'), async () => {
      keys.forEach(k => { S.settings[k] = undo[k]; }); S.settings.weekAsked = asked; dropSignal(sig);
      (r.picks || []).forEach(() => dropSignal('flex-pick')); if (owedWas) S.settings.owed = owedWas; else delete S.settings.owed; await app.save('settings'); app.render({ keepScroll: true });
    });
    if (changed.length) spotDays(iso => changed.includes(iso));
  },
};
