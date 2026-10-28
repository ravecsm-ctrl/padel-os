// Workout runner in focus mode: one exercise, one set at a time.
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { esc, icon, navBar, group, row, stat, tile } from './ui-kit.js';
import { getExercise, targetField, FIELD_UNIT } from './domain-catalog.js';
import { toDisplay, fromDisplay, fmtW, fmtNum, displayStep } from './domain-units.js';
import { lastPerformance, doneSets, detectPRs } from './domain-progression.js';
import { relDay } from './domain-calendar.js';
import { simple, effortTarget, setEffortSeg, setEffortWord, sessionEffortChips } from './ui-words.js';
import { autofill, swapExercise, workoutStats, finalizeWorkout } from './domain-workout.js';
import { allExercises } from './domain-catalog.js';
import { canDoWith, missingFor, equipLabel } from './domain-taxonomy.js';
import { bodyMap } from './ui-bodymap.js';
import { applyAdaptation, revertAdaptation } from './domain-adaptive.js';
import { sessionMuscles, ranked } from './domain-muscles.js';

const W = () => S.active;
const cur = () => W().exercises[W().index];
const unit = () => S.settings.unit;
const touch = (keepScroll = true) => { app.saveActive(); app.render({ keepScroll }); };
let wakeLock = null;

async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch {}
}
document.addEventListener('visibilitychange', () => { if (S.route === 'workout' && S.active) keepAwake(); if (document.hidden && S.active) app.saveActive(true); });

export const clock = t => { const s = Math.floor((Date.now() - t) / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const entryState = e => e.skipped ? 'skip' : e.sets.length && e.sets.every(s => s.done) ? 'done' : e.sets.some(s => s.done) ? 'part' : '';
const restLabel = s => s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
const UNIT_WORD = { reps: 'reps', sec: 'seconds', m: 'metres' };

function fmtSet(s, fields) {
  const tf = fields[fields.length - 1];
  const v = `${fmtNum(s[tf])}${tf === 'reps' ? ' reps' : ` ${FIELD_UNIT[tf]}`}`;
  return fields.includes('w') && s.w ? `${fmtNum(toDisplay(s.w, unit()))} ${unit()} × ${v}` : v;
}

// What the field shows before the user touches it: previous set, else the suggestion.
function defaultVal(e, i, f) {
  const prev = e.sets.slice(0, i).reverse().find(x => x.done);
  const tf = e.fields[e.fields.length - 1];
  if (f === 'w') return prev?.w ?? e.suggestion.w;
  return prev?.[f] ?? (f === tf ? (e.suggestion.target ?? e.target.min) : null);
}

// Banner when today's plan was adjusted (or the adjustment was undone).
function adaptBanner(w) {
  const a = w.adapt;
  if (!a?.changes?.length) return '';
  const n = a.changes.length, up = a.changes.filter(c => c.dir === 'up').length, down = a.changes.filter(c => c.dir === 'down').length;
  const what = down && !up ? 'a little lighter' : up && !down ? 'a bit harder' : 'tuned';
  return a.applied
    ? `<div class="banner" style="margin-bottom:14px">${tile('sliders', up && !down ? 'green' : 'orange')}<span><b>Adjusted for today</b><small>${n} exercise${n > 1 ? 's' : ''} ${what}, based on your recovery.</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="adapt-why" style="font-size:15px">Why?</button><button class="link" data-action="adapt-undo" style="font-size:13px">Use original</button></span></div>`
    : `<div class="banner" style="margin-bottom:14px;background:var(--fill)">${tile('sliders', 'gray')}<span><b>Original plan</b><small>Recovery adjustments are off for this workout.</small></span><button class="link" data-action="adapt-redo" style="margin-left:auto;font-size:15px">Use recommended</button></div>`;
}

function coach(e) {
  const ex = getExercise(e.exId), tf = targetField(ex), sug = e.suggestion;
  const range = e.target.min === e.target.max ? `${e.target.min}` : `${e.target.min}–${e.target.max}`;
  const weight = sug.w != null ? ` at <b>${fmtW(sug.w, unit())}</b>` : e.fields.includes('w') && sug.kind === 'first' ? ', choosing a weight that feels manageable' : '';
  const last = lastPerformance(app.strength, e.exId);
  const tip = e.adjusted ? '' : sug.kind === 'up' ? `${icon('chevR')} Heavier than last time. You’ve earned it.` : sug.kind === 'down' ? 'A little lighter today to rebuild.' : sug.kind === 'deload' ? 'Recovery week: lighter on purpose.' : '';
  return `<div class="coach"><p class="goal"><b>${e.sets.length} sets</b> of <b>${range} ${UNIT_WORD[tf]}</b>${ex.perSide ? ' each side' : ''}${weight}.</p>
    ${e.adjusted ? `<p class="t-foot" style="color:${e.adjusted.dir === 'up' ? 'var(--green)' : 'var(--orange)'};font-weight:600">Adjusted: ${e.adjusted.dir === 'up' ? 'one extra set' : e.adjusted.dir === 'hold' ? 'same weight as last time' : e.adjusted.to.sets < e.adjusted.from.sets ? `one set fewer${e.adjusted.to.w != null && e.adjusted.to.w < e.adjusted.from.w ? ', slightly lighter' : ''}` : 'slightly lighter'}. ${esc(e.adjusted.reason)}.</p>` : ''}
    <p class="t-foot">${tip ? `<span class="blue">${esc(tip.replace(/<[^>]+>/g, '').trim())}</span> ` : ''}${esc(effortTarget(e.target.rpe))}.${last ? ` Last time: ${esc(doneSets(last.entry).map(s => fmtSet(s, e.fields)).join(', '))}.` : ''}</p>
    ${missingHere(ex)}<button class="how" data-action="how">${icon('info')}How to do it</button></div>`;
}

// A gentle note (never a block) when this exercise needs gear the current location lacks.
function missingHere(ex) {
  const miss = missingFor(ex.needs || [], app.owned());
  if (!miss.length || !app.location()) return '';
  return `<p class="t-foot orange" style="margin-top:6px">Needs ${esc(miss.map(n => n.split('|').map(a => equipLabel(a, S.customEquipment)).join(' or ')).join(', '))}, not listed at ${esc(app.location().name)}. <button class="link" data-action="swap">Replace</button></p>`;
}

function stepper(e, i, f) {
  const s = e.sets[i];
  const val = s[f] ?? defaultVal(e, i, f);
  const shown = f === 'w' ? toDisplay(val, unit()) : val;
  const label = f === 'w' ? (val == null ? `${unit()} · choose a weight` : `${unit()}${getExercise(e.exId).loadNote ? ` ${getExercise(e.exId).loadNote}` : ''}`) : UNIT_WORD[f];
  return `<div class="stepper"><button data-action="step" data-field="${f}" data-dir="-1" aria-label="Less ${label}">${icon('minus')}</button>
    <label><input type="number" inputmode="decimal" step="any" min="0" data-field="${f}" data-set="${i}" value="${s[f] != null ? shown : ''}" placeholder="${shown ?? '–'}" aria-label="${label}"><span class="unit">${esc(label)}</span></label>
    <button data-action="step" data-field="${f}" data-dir="1" aria-label="More ${label}">${icon('plus')}</button></div>`;
}

function setArea(e) {
  const next = e.sets.findIndex(s => !s.done);
  const lastDone = e.sets.map(s => s.done).lastIndexOf(true);
  const w = W(), isLast = w.index === w.exercises.length - 1;
  const doneRows = e.sets.map((s, i) => s.done ? row({ title: `Set ${i + 1}`, sub: setEffortWord(s.rpe), value: esc(fmtSet(s, e.fields)), right: '', action: 'undo-set', data: { set: i }, chevron: false, aria: `Set ${i + 1} done. Tap to reopen.` }).replace('<span class="row-main">', `<span class="tick">${icon('check')}</span><span class="row-main">`) : '').join('');
  const feel = lastDone >= 0 && e.sets[lastDone].rpe == null && next >= 0
    ? `<div class="feel"><p>How did set ${lastDone + 1} feel?</p>${setEffortSeg('set-rpe', '')}</div>` : '';
  const card = next < 0
    ? `<section class="card all-done"><div class="big-tick">${icon('check')}</div><p class="t-title2">All sets done</p><p class="t-sub" style="margin:4px 0 16px">${lastDone >= 0 && e.sets[lastDone].rpe == null ? 'How did the last set feel?' : 'Great work.'}</p>
        ${lastDone >= 0 && e.sets[lastDone].rpe == null ? `<div style="margin-bottom:16px">${setEffortSeg('set-rpe', '')}</div>` : ''}
        <button class="btn filled" data-action="${isLast ? 'to-finish' : 'next'}">${isLast ? 'Finish Workout' : 'Next Exercise'}</button></section>`
    : `<section class="card setcard">${feel}<div class="setcard-h"><b>Set ${next + 1} of ${e.sets.length}</b><span class="t-foot">${restLabel(e.target.rest)} rest after</span></div>
        <div class="steppers">${e.fields.map(f => stepper(e, next, f)).join('')}</div>
        <button class="btn filled" data-action="set-done" data-set="${next}">${icon('check')}Done</button></section>`;
  return `${card}${doneRows ? `<div class="done-list">${group(doneRows, { footer: 'Tap a set to change it.' })}</div>` : ''}`;
}

function runner() {
  const w = W(), e = cur(), ex = getExercise(e.exId), n = w.exercises.length, isLast = w.index === n - 1;
  const nextName = isLast ? '' : getExercise(w.exercises[w.index + 1].exId).name;
  const ready = entryState(e) === 'done' || e.skipped;
  return `${navBar({ back: 'Back', backAction: 'leave', title: w.title, sub: `<span class="elapsed num" data-start="${w.startedAt}">${clock(w.startedAt)}</span>`, right: '<button class="nav-btn right" data-action="to-finish">End</button>' })}
    ${w.index === 0 || w.adapt?.applied === false ? adaptBanner(w) : ''}
    <div class="wk-dots" role="tablist">${w.exercises.map((x, i) => `<button role="tab" aria-selected="${i === w.index}" class="${entryState(x)} ${i === w.index ? 'on' : ''}" data-action="jump" data-i="${i}" aria-label="Exercise ${i + 1}: ${esc(x.name)}"></button>`).join('')}</div>
    <div class="ex-head"><div><p class="t-foot">Exercise ${w.index + 1} of ${n}${e.adaptedFrom && !e.swappedFrom ? ' · adapted to your setup' : e.swappedFrom ? ' · replaced' : ''}</p><h1>${esc(ex.name)}</h1></div>
      <button class="icon-circle" data-action="more" aria-label="More options">${icon('more')}</button></div>
    ${e.skipped ? `<section class="card setcard" style="text-align:center"><p class="t-head">Skipped</p><p class="t-sub" style="margin:4px 0 14px">This exercise won’t be counted.</p><button class="btn tinted" data-action="skip">Do It After All</button></section>` : `${coach(e)}${setArea(e)}`}
    <div class="wk-bottom"><button class="btn gray square" data-action="prev" ${w.index === 0 ? 'disabled' : ''} aria-label="Previous exercise">${icon('chevL')}</button>
      <button class="btn ${ready ? 'filled' : 'gray'}" data-action="${isLast ? 'to-finish' : 'next'}"><span>${isLast ? 'Finish Workout' : `Next: ${esc(nextName)}`}</span></button></div>`;
}

function finishView() {
  const w = W(), st = workoutStats(w);
  const prs = w.exercises.flatMap(e => detectPRs({ ...e, sets: doneSets(e) }, app.strength).map(p => ({ ...p, name: e.name })));
  S.form.rpe ??= ''; S.form.pain ??= 'no';
  const missing = w.exercises.filter(e => !e.skipped && !doneSets(e).length).length;
  const vol = Math.round(toDisplay(st.volume, unit()));
  return `${navBar({ back: 'Workout', backAction: 'back-to-runner', title: 'Summary' })}
    <div class="finish-hero"><div class="big-tick">${icon('check')}</div><h1 class="t-title">Workout complete</h1><p class="t-sub" style="margin-top:4px">${esc(w.title)}</p></div>
    <div class="tiles three" style="margin-top:20px">${stat(`<span class="num">${S.form.duration || st.minutes}</span>`, 'Minutes')}${stat(`${st.sets}`, 'Sets')}${stat(vol ? vol.toLocaleString() : '—', 'Volume', vol ? unit() : '')}</div>
    ${(() => { const mm = sessionMuscles({ kind: 'strength', exercises: w.exercises }), top = ranked(mm).slice(0, 4); return top.length ? `<section class="grp"><h2 class="grp-h">Muscles worked</h2><div class="card">${bodyMap(mm)}<p class="t-foot" style="text-align:center;margin-top:8px">${esc(top.map(m => m.label).join(' · '))}</p></div></section>` : ''; })()}
    ${prs.length ? group(prs.map(p => row({ title: esc(p.name), sub: p.type === 'e1RM' ? (simple() ? 'New estimated max' : 'New e1RM') : `New ${esc(p.type.toLowerCase())}`, value: p.type === 'e1RM' || p.type === 'Heaviest' ? fmtW(p.value, unit()) : fmtNum(p.value), icon: 'trophy', color: 'orange' })).join(''), { header: 'Personal records' }) : ''}
    ${missing ? `<p class="fine" style="margin-bottom:20px">${missing} exercise${missing > 1 ? 's were' : ' was'} not done and won’t be counted.</p>` : ''}
    <label class="field-l">How hard was it overall?</label>${sessionEffortChips('rpe', S.form.rpe)}
    <div style="height:24px"></div>
    ${group(row({ title: 'Anything hurt?', right: `<input type="checkbox" class="switch" id="painSw" ${S.form.pain === 'yes' ? 'checked' : ''} aria-label="Anything hurt">` })
      + row({ title: 'Minutes', right: `<input class="input num" id="durIn" type="number" inputmode="numeric" value="${S.form.duration || st.minutes}" style="width:90px;text-align:right;background:none;padding:0" aria-label="Minutes">` }),
      { footer: S.form.pain === 'yes' ? 'Don’t train through sharp or worsening pain. If it persists, see a professional.' : '' })}
    ${S.form.pain === 'yes' ? `<input class="input" id="painLoc" placeholder="Where did it hurt?" value="${esc(S.form.painLoc || '')}" style="margin:-16px 0 24px">` : ''}
    <textarea class="input" id="notesIn" rows="3" placeholder="Notes (optional)">${esc(S.form.notes || '')}</textarea>
    <div style="height:20px"></div>
    <div class="btns"><button class="btn filled" data-action="save-workout">Save Workout</button><button class="btn destructive" data-action="discard">Discard Workout</button></div>`;
}

function howSheet(ex) {
  app.sheet(`<h2 class="sheet-title">${esc(ex.name)}</h2><p class="sheet-sub">${esc(ex.muscles)} · ${esc(ex.equipment)}</p>
    ${group([['Why it helps', ex.why], ['Get set up', ex.setup], ['Do it', ex.execute], ['Breathing', ex.breathe], ['Avoid', ex.avoid]].map(([t, d]) => row({ title: t, sub: esc(d) })).join(''))}
    <a class="btn tinted" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' exercise form')}" target="_blank" rel="noopener">${icon('play')}Watch a Video</a>`);
}

export const workout = {
  tab: 'today',
  render() { return S.params[0] === 'finish' ? finishView() : runner(); },
  mounted() {
    keepAwake();
    if (S.params[0] === 'finish') {
      const p = document.querySelector('#painLoc'); if (p) p.oninput = () => { S.form.painLoc = p.value; };
      document.querySelector('#notesIn').oninput = ev => { S.form.notes = ev.target.value; };
      document.querySelector('#durIn').oninput = ev => { S.form.duration = +ev.target.value; };
      document.querySelector('#painSw').onchange = ev => { S.form.pain = ev.target.checked ? 'yes' : 'no'; app.render({ keepScroll: true }); };
    }
  },
  onInput(el) {
    if (el.dataset.note) { S.exNotes[el.dataset.note] = el.value; clearTimeout(this._n); this._n = setTimeout(() => app.save('exNotes'), 400); return; }
    if (!el.dataset.field || el.dataset.set == null) return;
    const s = cur().sets[+el.dataset.set], f = el.dataset.field;
    const raw = el.value === '' ? null : Number(String(el.value).replace(',', '.'));
    s[f] = f === 'w' ? fromDisplay(raw, unit()) : raw;
    app.saveActive();
  },
  onPick(name, value) {
    if (name === 'set-rpe') {
      const e = cur(), i = e.sets.map(s => s.done).lastIndexOf(true);
      if (i >= 0) { e.sets[i].rpe = value; touch(); }
    }
  },
  actions: {
    step(el) {
      const e = cur(), i = e.sets.findIndex(s => !s.done), f = el.dataset.field, dir = +el.dataset.dir;
      if (i < 0) return;
      const s = e.sets[i], base = s[f] ?? defaultVal(e, i, f) ?? 0;
      if (f === 'w') {
        const stepD = displayStep(getExercise(e.exId).inc, unit());
        s.w = Math.max(0, fromDisplay(Math.max(0, (toDisplay(base, unit()) || 0) + dir * stepD), unit()));
      } else s[f] = Math.max(0, (base || 0) + dir * (f === 'reps' ? 1 : 5));
      touch();
    },
    'set-done'(el) {
      const w = W(), e = cur(), i = +el.dataset.set, s = e.sets[i];
      autofill(e, i);
      const tf = e.fields[e.fields.length - 1];
      if (!s[tf]) return app.toast(`Add the ${UNIT_WORD[tf]} first`);
      s.done = true; s.ts = Date.now();
      const moreHere = e.sets.some(x => !x.done);
      if (S.settings.autoRest) {
        const nextEx = w.exercises.slice(w.index + 1).find(x => !x.skipped);
        const label = moreHere ? `set ${e.sets.findIndex(x => !x.done) + 1}` : nextEx ? getExercise(nextEx.exId).name : '';
        if (moreHere || nextEx) timer.start(e.target.rest, label);
      }
      navigator.vibrate?.(20);
      touch();
    },
    'undo-set'(el) { const s = cur().sets[+el.dataset.set]; s.done = false; s.rpe = null; touch(); app.toast(`Set ${+el.dataset.set + 1} reopened`); },
    how() { howSheet(getExercise(cur().exId)); },
    'adapt-why'() {
      const a = W().adapt, inp = a.inputs;
      const ctx = [inp.readiness && `Check-in: ${inp.readiness.toLowerCase()} readiness`, inp.sore.length && `Sore: ${inp.sore.join(', ').replace(/_/g, ' ')}`, inp.padelTomorrow && 'Padel tomorrow'].filter(Boolean).join(' · ');
      app.sheet(`<h2 class="sheet-title">Why it changed</h2><p class="sheet-sub">${ctx ? esc(ctx) + '. ' : ''}Based on how recently and how hard each muscle worked.</p>
        ${group(a.changes.map(c => row({ title: esc(c.name), sub: esc(c.reason), value: `${c.from.sets}→${c.to.sets} sets${c.to.w != null && c.from.w != null && c.to.w !== c.from.w ? ` · ${fmtW(c.from.w, unit())}→${fmtW(c.to.w, unit())}` : ''}` })).join(''))}
        <div class="btns"><button class="btn filled" data-action="close-sheet">Keep Adjustments</button><button class="btn plain" data-action="adapt-undo">Use Original Plan</button></div>
        <p class="fine">You can turn this off in Settings → Adapt workouts to recovery.</p>`);
    },
    'adapt-undo'() { revertAdaptation(W()); app.closeSheet(); touch(); app.toast('Back to the original plan'); },
    'adapt-redo'() { applyAdaptation(W()); touch(); app.toast('Recommended adjustments applied'); },
    more() {
      const e = cur(), note = S.exNotes[e.exId] || '';
      app.sheet(`<h2 class="sheet-title">${esc(getExercise(e.exId).name)}</h2><div style="height:12px"></div>
        ${group(row({ title: 'Add a set', icon: 'plus', action: 'add-set' }) + row({ title: 'Remove a set', icon: 'minus', color: 'gray', action: 'remove-set' })
          + row({ title: 'Replace exercise', sub: 'Busy equipment or something feels off', icon: 'swap', color: 'indigo', action: 'swap' })
          + row({ title: e.skipped ? 'Don’t skip' : 'Skip exercise', icon: 'skip', color: 'orange', action: 'skip' })
          + row({ title: 'My notes', sub: note ? esc(note.slice(0, 40)) : 'Seat height, grip, reminders', icon: 'note', color: 'gray', action: 'notes' }))}
        <button class="btn gray" data-action="close-sheet">Cancel</button>`);
    },
    'close-sheet'() { app.closeSheet(); },
    notes() {
      const e = cur();
      app.sheet(`<h2 class="sheet-title">My notes</h2><p class="sheet-sub">Saved with ${esc(getExercise(e.exId).name)} and shown next time.</p>
        <textarea class="input" data-note="${esc(e.exId)}" rows="4" placeholder="e.g. seat on 4, narrow grip">${esc(S.exNotes[e.exId] || '')}</textarea>
        <div style="height:16px"></div><button class="btn filled" data-action="close-sheet">Done</button>`);
    },
    'add-set'() { const e = cur(); e.sets.push({ w: null, reps: null, sec: null, m: null, rpe: null, done: false }); app.closeSheet(); touch(); },
    'remove-set'() { const e = cur(); if (e.sets.length > 1) { const i = e.sets.map(s => s.done).lastIndexOf(false); e.sets.splice(i >= 0 ? i : e.sets.length - 1, 1); } app.closeSheet(); touch(); },
    skip() { const e = cur(); e.skipped = !e.skipped; app.closeSheet(); touch(); },
    swap() {
      const e = cur(), ex = getExercise(e.exId);
      const base = e.swappedFrom ? getExercise(e.swappedFrom) : ex;
      // Listed alternatives first, then anything else with the same movement; grouped by what's here.
      const ids = [...new Set([base.id, ...base.subs, ...ex.subs, ...allExercises().filter(x => x.movement && x.movement === (base.movement || ex.movement)).map(x => x.id)])].filter(id => id !== e.exId && getExercise(id));
      const owned = app.owned(), here = ids.filter(id => canDoWith(getExercise(id).needs || [], owned)), other = ids.filter(id => !here.includes(id));
      const item = id => { const x = getExercise(id), miss = missingFor(x.needs || [], owned); return row({ title: esc(x.name), sub: miss.length ? `<span class="orange">Needs ${esc(miss.map(n => n.split('|').map(a => equipLabel(a, S.customEquipment)).join(' or ')).join(', '))}</span>` : esc(x.equipment), action: 'do-swap', data: { id } }); };
      app.sheet(`<h2 class="sheet-title">Replace exercise</h2><p class="sheet-sub">Just for today. To change it permanently, edit the workout in Plan.</p>
        ${here.length ? group(here.map(item).join(''), { header: `Available at ${esc(app.location()?.name || 'this location')}` }) : ''}
        ${other.length ? group(other.map(item).join(''), { header: 'Needs other equipment' }) : ''}
        ${ids.length ? '' : '<p class="t-sub">No alternatives for this one.</p>'}
        <button class="btn gray" data-action="close-sheet">Cancel</button>`);
    },
    'do-swap'(el) {
      if (doneSets(cur()).length) app.toast('Sets you’d logged for the old exercise were cleared');
      swapExercise(W(), W().index, el.dataset.id, app.strength, unit()); app.closeSheet(); touch(false);
    },
    jump(el) { W().index = +el.dataset.i; touch(false); },
    prev() { W().index = Math.max(0, W().index - 1); touch(false); },
    next() { W().index = Math.min(W().exercises.length - 1, W().index + 1); touch(false); },
    leave() { app.saveActive(true); app.go('overview'); app.toast('Workout paused. Continue from Overview or Today.'); },
    'to-finish'() { S.form = {}; app.saveActive(true); app.go('workout/finish'); },
    'back-to-runner'() { app.go('workout'); },
    async discard() {
      if (!(await app.confirm('Discard this workout? Nothing will be saved.', { ok: 'Discard Workout', danger: true }))) return;
      S.active = null; await app.saveActive(true); timer.stop(); app.go('overview');
    },
    async 'save-workout'() {
      const pain = S.form.pain === 'yes' ? { flag: true, location: S.form.painLoc || '' } : { flag: false, location: '' };
      const session = finalizeWorkout(W(), { rpe: S.form.rpe === '' ? null : +S.form.rpe, notes: S.form.notes, pain, durationMin: S.form.duration }, app.strength);
      try { await db.putSession(session); } catch { return app.toast('Couldn’t save. Export a backup in Settings.'); }
      S.active = null; await app.saveActive(true); timer.stop(); wakeLock?.release?.();
      await app.reloadSessions();
      app.go(`history/session/${session.id}`);
      app.toast(session.prs.length ? `Saved · ${session.prs.length} personal record${session.prs.length > 1 ? 's' : ''}` : 'Workout saved');
    },
  },
};

export { tile };
