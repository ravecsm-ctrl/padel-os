// Workout runner in focus mode: one exercise, one set at a time.
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { esc, icon, navBar, group, row, stat, tile } from './ui-kit.js';
import { getExercise, targetField, FIELD_UNIT } from './domain-catalog.js';
import { keepExercise, routineFromWorkout, setCustomRoutines, getRoutine } from './domain-program.js';
import { prescriptionFor } from './domain-builder.js';
import { feedbackSheet } from './ui-feedback.js';
import { exercisePicker } from './ui-picker.js';
import { toDisplay, fromDisplay, fmtW, fmtNum, displayStep } from './domain-units.js';
import { lastPerformance, doneSets, detectPRs, bestE1rm, heaviest, looksOff } from './domain-progression.js';
import { relDay, isoDate, parseISO } from './domain-calendar.js';
import { simple, effortTarget, setEffortSeg, setEffortWord, sessionEffortChips } from './ui-words.js';
import { autofill, swapExercise, workoutStats, finalizeWorkout, addExercise, partnerIndex, pairExercises, unpairExercise, supersetPairs, afterSet } from './domain-workout.js';
import { allExercises } from './domain-catalog.js';
import { canDoWith, missingFor, equipLabel, CATEGORIES } from './domain-taxonomy.js';
import { bodyMap } from './ui-bodymap.js';
import { applyAdaptation, revertAdaptation } from './domain-adaptive.js';
import { sessionMuscles, ranked } from './domain-muscles.js';
import { recentPain, painHits, gentlerFor, areaName } from './domain-pain.js';
import { AREAS } from './domain-personalize.js';
import { barFor, barWeight, platesPerSide, warmupSets, BARS } from './domain-plates.js';

const W = () => S.active;
const cur = () => W().exercises[W().index];
const unit = () => S.settings.unit;
// History as of this workout: for a past-dated workout, only what came before it.
const before = () => W().past ? app.strength.filter(s => s.startedAt < W().startedAt) : app.strength;
const dayLabel = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const touch = (keepScroll = true) => { app.saveActive(); app.render({ keepScroll }); };
let wakeLock = null;

// Keep the screen on during a workout so the phone doesn't lock mid-rest (a locked phone
// can't play the rest beep). `awake` records whether iOS actually granted it, for the indicator.
let awake = null; // 'on' | 'off' (refused) | 'none' (not supported)
async function keepAwake() {
  const was = awake;
  if (!('wakeLock' in navigator)) awake = 'none';
  else if (!wakeLock && document.visibilityState === 'visible') {
    try { wakeLock = await navigator.wakeLock.request('screen'); awake = 'on'; wakeLock.addEventListener('release', () => { wakeLock = null; if (!document.hidden) { awake = 'off'; if (S.route === 'workout') app.render({ keepScroll: true }); } }); }
    catch { awake = 'off'; }
  }
  if (awake !== was && S.route === 'workout' && S.active) app.render({ keepScroll: true });
}
function awakeLine() {
  if (W().past || awake == null) return '';
  return awake === 'on' ? '<p class="awake"><i></i>Screen stays on during your workout</p>'
    : '<p class="awake off"><i></i>Your phone may lock and miss the rest beep. <button data-action="awake-help">Fix this</button></p>';
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
// "60 kg × 8, 8, 7" when the weight didn't change, otherwise each set in full.
function compactSets(sets, fields) {
  const tf = fields[fields.length - 1], ws = new Set(sets.map(s => s.w || 0));
  if (fields.includes('w') && ws.size === 1 && sets[0].w) return `${fmtNum(toDisplay(sets[0].w, unit()))} ${unit()} × ${sets.map(s => fmtNum(s[tf])).join(', ')}${tf === 'reps' ? '' : ` ${FIELD_UNIT[tf]}`}`;
  return sets.map(s => fmtSet(s, fields)).join(' · ');
}

// Your baseline: what you did last time, and your estimated max from it (Epley).
function baseline(e, last) {
  if (!last) return '';
  const max = e.fields.includes('w') ? bestE1rm(last.entry) : null;
  return `<div class="baseline"><div><small>Last time · ${esc(relDay(last.session.startedAt))}</small><b>${esc(compactSets(doneSets(last.entry), e.fields))}</b></div>${max ? `<div class="bl-max"><small>${simple() ? 'Est. max' : 'Est. 1RM'}</small><b>${esc(fmtW(max, unit()))}</b></div>` : ''}</div>`;
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
  const last = lastPerformance(before(), e.exId);
  const why = e.adjusted ? '' : (sug.reason || '').replace(/([\d.]+)kg/g, (_, n) => fmtW(+n, unit()));
  const tip = e.adjusted ? '' : sug.kind === 'up' ? `${icon('chevR')} Heavier than last time. You’ve earned it.` : sug.kind === 'down' ? 'A little lighter today to rebuild.' : sug.kind === 'deload' ? 'Recovery week: lighter on purpose.' : '';
  return `<div class="coach"><p class="goal"><b>${e.sets.length} sets</b> of <b>${range} ${UNIT_WORD[tf]}</b>${ex.perSide ? ' each side' : ''}${weight}.</p>
    ${e.adjusted ? `<p class="t-foot" style="color:${e.adjusted.dir === 'up' ? 'var(--green)' : 'var(--orange)'};font-weight:600">Adjusted: ${e.adjusted.dir === 'up' ? 'one extra set' : e.adjusted.dir === 'hold' ? 'same weight as last time' : e.adjusted.to.sets < e.adjusted.from.sets ? `one set fewer${e.adjusted.to.w != null && e.adjusted.to.w < e.adjusted.from.w ? ', slightly lighter' : ''}` : 'slightly lighter'}. ${esc(e.adjusted.reason)}.</p>` : ''}
    ${baseline(e, last)}${warmupLine(e)}
    <p class="t-foot">${tip ? `<span class="blue">${esc(tip.replace(/<[^>]+>/g, '').trim())}</span> ` : ''}${why ? `${esc(why)} ` : ''}${esc(effortTarget(e.target.rpe))}.</p>
    ${missingHere(ex)}${painNote(e)}<button class="how" data-action="how">${icon('info')}How to do it</button></div>`;
}

// ── Supersets: pair with the next unpaired exercise; remembered per workout.
const nextFree = () => { const w = W(), j = w.index + 1; return j < w.exercises.length && !w.exercises[j].pair && !w.exercises[w.index].pair ? j : -1; };
async function rememberPairs() { const w = W(); if (!w.routineId) return; S.supersets = { ...S.supersets, [w.routineId]: supersetPairs(w) }; await app.save('supersets'); }

// ── Warm-ups and plates
const barKind = e => barFor(getExercise(e.exId));
const barD = kind => barWeight(kind, unit(), S.settings.bars);
function plateText(e, wKg) {
  const kind = barKind(e);
  if (!kind || wKg == null) return '';
  const total = toDisplay(wKg, unit()), bar = barD(kind), { plates, left, under } = platesPerSide(total, bar, unit());
  if (under) return `Lighter than the ${fmtNum(bar)} ${unit()} bar`;
  if (!plates.length) return `Just the bar (${fmtNum(bar)} ${unit()})`;
  return `Per side: ${plates.map(fmtNum).join(' + ')}${left ? ` (+${fmtNum(left)} ${unit()} can’t be made)` : ''} · ${fmtNum(bar)} ${unit()} bar`;
}
// Ramp-up sets for the first strength lift of each movement, before any working set.
function warmupLine(e) {
  const ex = getExercise(e.exId), w = W(), i = w.exercises.indexOf(e);
  if (!e.fields.includes('w') || ex.quality || !['lower-strength', 'upper-strength'].includes(ex.category) || e.sets.some(s => s.done)) return '';
  if (w.exercises.slice(0, i).some(x => !x.skipped && getExercise(x.exId).movement === ex.movement && x.sets.some(s => s.done))) return '';
  const work = e.sets[0].w ?? e.suggestion.w, kind = barKind(e);
  const sets = warmupSets(work, { inc: ex.inc, unit: unit(), barKg: kind ? fromDisplay(barD(kind), unit()) : 0, perHand: ex.weightType === 'per_hand' });
  if (!sets.length) return '';
  return `<div class="warmup"><small>Warm up first · not logged</small><span>${sets.map(s => `${s.bar ? 'Bar' : `${fmtNum(toDisplay(s.w, unit()))}`} × ${s.reps}`).join(' · ')}${sets.some(s => !s.bar) ? ` <i>${unit()}</i>` : ''}</span></div>`;
}

// Pain-aware: when this exercise loads an area that hurt recently, say so and offer a gentler
// swap, a lighter version, or "feels fine now". Never blocks.
const currentPain = () => recentPain(S.sessions, { cleared: S.painClear });
function painNote(e) {
  if (W().past || e.painOk) return '';
  const pain = currentPain(), hits = painHits(e.exId, pain);
  if (!hits.length) return '';
  const a = hits[0], when = relDay(pain[a].ts).toLowerCase();
  const alt = gentlerFor(e.exId, pain, app.owned(), W().exercises.map(x => x.exId));
  const said = pain[a].from === 'padel' ? `sore after padel more than once lately` : `hurt ${when}`;
  return `<div class="pain-note"><p><b>Your ${esc(areaName(a).toLowerCase())} ${said}.</b> This exercise loads it.${e.painLight ? ' Lighter version on: stop if it hurts.' : ''}</p>
    <div class="pain-acts">${alt ? `<button class="btn tinted small" data-action="pain-swap" data-id="${esc(alt)}">Swap for ${esc(getExercise(alt).name)}</button>` : ''}
      ${e.painLight ? '' : `<button class="btn gray small" data-action="pain-light">Go Lighter</button>`}
      <button class="link" data-action="pain-fine" data-a="${esc(a)}">Feels fine now</button></div></div>`;
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
  const lastSets = doneSets(lastPerformance(before(), e.exId)?.entry), lastSet = next >= 0 ? lastSets[next] : null;
  const doneRows = e.sets.map((s, i) => s.done ? row({ title: `Set ${i + 1}`, sub: setEffortWord(s.rpe), value: esc(fmtSet(s, e.fields)), right: '', action: 'undo-set', data: { set: i }, chevron: false, aria: `Set ${i + 1} done. Tap to reopen.` }).replace('<span class="row-main">', `<span class="tick">${icon('check')}</span><span class="row-main">`) : '').join('');
  const feel = lastDone >= 0 && e.sets[lastDone].rpe == null && next >= 0
    ? `<div class="feel"><p>How did set ${lastDone + 1} feel?</p>${setEffortSeg('set-rpe', '')}</div>` : '';
  const card = next < 0
    ? `<section class="card all-done"><div class="big-tick">${icon('check')}</div><p class="t-title2">All sets done</p><p class="t-sub" style="margin:4px 0 16px">${lastDone >= 0 && e.sets[lastDone].rpe == null ? 'How did the last set feel?' : 'Great work.'}</p>
        ${lastDone >= 0 && e.sets[lastDone].rpe == null ? `<div style="margin-bottom:16px">${setEffortSeg('set-rpe', '')}</div>` : ''}
        <button class="btn filled" data-action="${isLast ? 'to-finish' : 'next'}">${isLast ? 'Finish Workout' : 'Next Exercise'}</button>
        ${isLast ? `<button class="btn gray" data-action="pick-ex" style="margin-top:10px">${icon('plus')}Add Another Exercise</button>` : ''}</section>`
    : `<section class="card setcard">${feel}<div class="setcard-h"><b>Set ${next + 1} of ${e.sets.length}</b><span class="t-foot">${partnerIndex(w, w.index) >= 0 ? 'Rest after the pair' : `${restLabel(e.target.rest)} rest after`}</span></div>
        ${lastSet ? `<p class="t-foot bl-set">Last time, set ${next + 1}: ${esc(fmtSet(lastSet, e.fields))}</p>` : ''}
        <div class="steppers">${e.fields.map(f => stepper(e, next, f)).join('')}</div>
        ${barKind(e) ? `<button class="plates" data-action="plates" id="platesLine">${esc(plateText(e, e.sets[next].w ?? defaultVal(e, next, 'w')))}</button>` : ''}
        <button class="btn filled" data-action="set-done" data-set="${next}">${icon('check')}Done</button></section>`;
  return `${card}${doneRows ? `<div class="done-list">${group(doneRows, { footer: 'Tap a set to change it.' })}</div>` : ''}`;
}

function pickerSheet() {
  exercisePicker({ inUse: W().exercises.map(e => e.exId), pick: id => {
    const w = W(), at = w.exercises.length ? w.index + 1 : 0, i = addExercise(w, id, app.strength, unit(), at);
    if (i < 0) return;
    w.index = i; touch(false); app.toast(`${esc(w.exercises[i].name)} added`);
  } });
}

function emptyRunner() {
  const w = W();
  return `${navBar({ back: 'Back', backAction: 'leave', title: w.title, sub: w.past ? `Past workout · ${esc(dayLabel(w.startedAt))}` : `<span class="elapsed num" data-start="${w.startedAt}">${clock(w.startedAt)}</span>`, right: '<button class="nav-btn right" data-action="discard">Cancel</button>' })}
    <section class="card" style="text-align:center;padding:32px 20px;margin-top:24px">${tile('plus', 'blue')}<p class="t-title2" style="margin-top:12px">${w.past ? `Logging ${esc(dayLabel(w.startedAt))}` : 'Quick workout'}</p>
      <p class="t-sub" style="margin:6px 0 20px">Add exercises one at a time. Each gets suggested sets, reps and a weight from your history.</p>
      <button class="btn filled" data-action="pick-ex">${icon('plus')}Add Exercise</button></section>`;
}

function runner() {
  if (!W().exercises.length) return emptyRunner();
  const w = W(), e = cur(), ex = getExercise(e.exId), n = w.exercises.length, isLast = w.index === n - 1;
  const nextName = isLast ? '' : getExercise(w.exercises[w.index + 1].exId).name;
  const ready = entryState(e) === 'done' || e.skipped;
  return `${navBar({ back: 'Back', backAction: 'leave', title: w.title, sub: w.past ? `Past workout · ${esc(dayLabel(w.startedAt))}` : `<span class="elapsed num" data-start="${w.startedAt}">${clock(w.startedAt)}</span>`, right: '<button class="nav-btn right" data-action="to-finish">End</button>' })}
    ${w.past && w.index === 0 ? `<div class="banner" style="margin-bottom:14px">${tile('today', 'blue')}<span><b>Logging ${esc(dayLabel(w.startedAt))}</b><small>Enter what you did that day. Suggestions use only your workouts before it.</small></span></div>` : ''}
    ${w.index === 0 || w.adapt?.applied === false ? adaptBanner(w) : ''}
    <div class="wk-dots" role="tablist">${w.exercises.map((x, i) => `<button role="tab" aria-selected="${i === w.index}" class="${entryState(x)} ${i === w.index ? 'on' : ''} ${x.pair ? 'ss' : ''}" data-action="jump" data-i="${i}" aria-label="Exercise ${i + 1}: ${esc(x.name)}"></button>`).join('')}</div>
    ${awakeLine()}
    <div class="ex-head"><div><p class="t-foot">Exercise ${w.index + 1} of ${n}${e.adaptedFrom && !e.swappedFrom ? ' · adapted to your setup' : e.swappedFrom ? ' · replaced' : ''}</p>${partnerIndex(w, w.index) >= 0 ? `<p class="ss-tag">Superset with ${esc(w.exercises[partnerIndex(w, w.index)].name)}</p>` : ''}<h1>${esc(ex.name)}</h1></div>
      <button class="icon-circle" data-action="more" aria-label="More options">${icon('more')}</button></div>
    ${e.skipped ? `<section class="card setcard" style="text-align:center"><p class="t-head">Skipped</p><p class="t-sub" style="margin:4px 0 14px">This exercise won’t be counted.</p><button class="btn tinted" data-action="skip">Do It After All</button></section>` : `${coach(e)}${setArea(e)}`}
    <div class="wk-bottom"><button class="btn gray square" data-action="prev" ${w.index === 0 ? 'disabled' : ''} aria-label="Previous exercise">${icon('chevL')}</button>
      <button class="btn ${ready ? 'filled' : 'gray'}" data-action="${isLast ? 'to-finish' : 'next'}"><span>${isLast ? 'Finish Workout' : `Next: ${esc(nextName)}`}</span></button></div>`;
}

function finishView() {
  const w = W(), st = workoutStats(w);
  const prs = w.exercises.flatMap(e => detectPRs({ ...e, sets: doneSets(e) }, before()).map(p => ({ ...p, name: e.name })));
  S.form.rpe ??= ''; S.form.pain ??= 'no'; S.form.painAreas ??= [];
  const missing = w.exercises.filter(e => !e.skipped && !doneSets(e).length).length;
  const vol = Math.round(toDisplay(st.volume, unit()));
  return `${navBar({ back: 'Workout', backAction: 'back-to-runner', title: 'Summary' })}
    <div class="finish-hero"><div class="big-tick">${icon('check')}</div><h1 class="t-title">Workout complete</h1><p class="t-sub" style="margin-top:4px">${esc(w.title)}</p></div>
    <div class="tiles three" style="margin-top:20px">${stat(`<span class="num">${S.form.duration || st.minutes}</span>`, 'Minutes')}${stat(`${st.sets}`, 'Sets')}${stat(vol ? vol.toLocaleString() : '—', 'Volume', vol ? unit() : '')}</div>
    ${(() => { const mm = sessionMuscles({ kind: 'strength', exercises: w.exercises }), top = ranked(mm).slice(0, 4); return top.length ? `<section class="grp"><h2 class="grp-h">Muscles worked</h2><div class="card">${bodyMap(mm)}<p class="t-foot" style="text-align:center;margin-top:8px">${esc(top.map(m => m.label).join(' · '))}</p></div></section>` : ''; })()}
    ${prs.length ? group(prs.map(p => row({ title: esc(p.name), sub: p.type === 'e1RM' ? (simple() ? 'New estimated max' : 'New e1RM') : `New ${esc(p.type.toLowerCase())}`, value: p.type === 'e1RM' || p.type === 'Heaviest' ? fmtW(p.value, unit()) : fmtNum(p.value), icon: 'trophy', color: 'orange' })).join(''), { header: 'Personal records' }) : ''}
    ${missing ? `<p class="fine" style="margin-bottom:20px">${missing} exercise${missing > 1 ? 's were' : ' was'} not done and won’t be counted.</p>` : ''}
    ${keepGroup(w)}
    <label class="field-l">How hard was it overall?</label>${sessionEffortChips('rpe', S.form.rpe)}
    <div style="height:24px"></div>
    ${group(row({ title: 'Anything hurt?', right: `<input type="checkbox" class="switch" id="painSw" ${S.form.pain === 'yes' ? 'checked' : ''} aria-label="Anything hurt">` })
      + (w.past ? row({ title: 'Date', right: `<input class="input" id="dateIn" type="date" value="${S.form.date || isoDate(new Date(w.startedAt))}" max="${isoDate()}" style="width:150px;text-align:right;background:none;padding:0" aria-label="Date">` }) : '')
      + row({ title: 'Minutes', right: `<input class="input num" id="durIn" type="number" inputmode="numeric" value="${S.form.duration || st.minutes}" style="width:90px;text-align:right;background:none;padding:0" aria-label="Minutes">` }),
      { footer: S.form.pain === 'yes' ? 'Don’t train through sharp or worsening pain. If it persists, see a professional.' : '' })}
    ${S.form.pain === 'yes' ? `<div style="margin:-14px 0 24px"><label class="field-l">Where?</label><div class="chipset">${Object.entries(AREAS).map(([k, v]) => `<button type="button" class="chip-btn ${S.form.painAreas.includes(k) ? 'warn-on' : ''}" data-pain-a="${k}" aria-pressed="${S.form.painAreas.includes(k)}">${esc(v)}</button>`).join('')}</div>
      <input class="input" id="painLoc" placeholder="Details (optional), e.g. left side" value="${esc(S.form.painLoc || '')}" style="margin-top:10px"></div>` : ''}
    <textarea class="input" id="notesIn" rows="3" placeholder="Notes (optional)">${esc(S.form.notes || '')}</textarea>
    <div style="height:20px"></div>
    <div class="btns"><button class="btn filled" data-action="save-workout">Save Workout</button><button class="btn destructive" data-action="discard">Discard Workout</button></div>`;
}

// Plate breakdown for the current set, plus which bar you're using (trap bars vary).
function platesSheet() {
  const e = cur(), kind = barKind(e), i = Math.max(0, e.sets.findIndex(s => !s.done)), wKg = e.sets[i]?.w ?? defaultVal(e, i, 'w');
  const u = unit(), bar = barD(kind), total = toDisplay(wKg, u), { plates, left } = platesPerSide(total, bar, u);
  const opts = { barbell: { kg: [15, 20], lb: [35, 45] }, trap_bar: { kg: [20, 25, 27, 30], lb: [45, 55, 60, 65] } }[kind][u];
  app.sheet(`<h2 class="sheet-title">${total != null ? `${fmtNum(total)} ${u}` : 'Choose a weight first'}</h2><p class="sheet-sub">${kind === 'trap_bar' ? 'Trap bar' : 'Barbell'} of ${fmtNum(bar)} ${u}, plus on each side:</p>
    <div class="plate-row">${plates.length ? plates.map(p => `<span class="plate" style="--h:${Math.round(44 + 56 * p / PL_MAX[u])}px">${fmtNum(p)}</span>`).join('') : `<span class="t-sub">No plates</span>`}</div>
    ${left ? `<p class="fine">That’s ${fmtNum(left)} ${u} per side short: the nearest you can load with standard plates.</p>` : ''}
    <label class="field-l">Your ${kind === 'trap_bar' ? 'trap bar' : 'bar'} weighs</label>
    <div class="chipset">${opts.map(w => `<button type="button" class="chip-btn ${w === bar ? 'on' : ''}" data-action="set-bar" data-kind="${kind}" data-w="${w}">${w} ${u}</button>`).join('')}</div>
    <div style="height:20px"></div><button class="btn gray" data-action="close-sheet">Done</button>`);
}
const PL_MAX = { kg: 25, lb: 45 };

// Exercises you added: keep them in this planned workout? Quick workout: save it as one of yours?
const keepable = w => w.routineId && getRoutine(w.routineId) ? w.exercises.map((e, i) => [e, i]).filter(([e]) => e.added && !e.skipped && doneSets(e).length) : [];
function keepGroup(w) {
  S.form.keep ??= [];
  if (w.quick) {
    S.form.saveAs ??= false;
    return group(row({ title: 'Save as a workout', sub: 'Shows up in Plan, ready to schedule or repeat', right: `<input type="checkbox" class="switch" id="saveAsSw" ${S.form.saveAs ? 'checked' : ''} aria-label="Save as a workout">` })
      + (S.form.saveAs ? `<label class="row"><span class="row-main"><input class="input" id="saveAsName" value="${esc(S.form.saveAsName ?? '')}" placeholder="Name, e.g. Hotel gym" maxlength="40" style="padding:0;background:none;min-height:22px" aria-label="Workout name"></span></label>` : ''), { header: 'This workout' });
  }
  const rows = keepable(w);
  if (!rows.length) return '';
  return group(rows.map(([e, i]) => row({ title: esc(e.name), sub: `Add to ${esc(w.title)} for next time`, right: `<input type="checkbox" class="switch" data-keep="${i}" ${S.form.keep.includes(i) ? 'checked' : ''} aria-label="Keep ${esc(e.name)}">` })).join(''), { header: 'Added today', footer: 'Kept exercises show up in this workout from now on. Remove them any time in Plan.' });
}

function howSheet(ex) {
  app.sheet(`<h2 class="sheet-title">${esc(ex.name)}</h2><p class="sheet-sub">${esc(ex.muscles)} · ${esc(ex.equipment)}</p>
    ${group([['Why it helps', ex.why], ['Get set up', ex.setup], ['Do it', ex.execute], ['Breathing', ex.breathe], ['Avoid', ex.avoid]].filter(([, d]) => d).map(([t, d]) => row({ title: t, sub: esc(d) })).join(''))}
    <a class="btn tinted" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' exercise form')}" target="_blank" rel="noopener">${icon('play')}Watch a Video</a>`);
}

export const workout = {
  tab: 'today',
  render() { return S.params[0] === 'finish' ? finishView() : runner(); },
  mounted() {
    keepAwake();
    if (S.params[0] === 'finish') {
      const p = document.querySelector('#painLoc'); if (p) p.oninput = () => { S.form.painLoc = p.value; };
      document.querySelectorAll('[data-pain-a]').forEach(b => b.onclick = () => { const k = b.dataset.painA, l = S.form.painAreas; S.form.painAreas = l.includes(k) ? l.filter(x => x !== k) : [...l, k]; app.render({ keepScroll: true }); });
      document.querySelector('#notesIn').oninput = ev => { S.form.notes = ev.target.value; };
      document.querySelector('#durIn').oninput = ev => { S.form.duration = +ev.target.value; };
      const di = document.querySelector('#dateIn'); if (di) di.onchange = ev => { S.form.date = ev.target.value; };
      document.querySelectorAll('[data-keep]').forEach(c => c.onchange = () => { const i = +c.dataset.keep; S.form.keep = c.checked ? [...S.form.keep, i] : S.form.keep.filter(x => x !== i); });
      const sa = document.querySelector('#saveAsSw'); if (sa) sa.onchange = () => { S.form.saveAs = sa.checked; app.render({ keepScroll: true }); };
      const sn = document.querySelector('#saveAsName'); if (sn) { sn.oninput = () => { S.form.saveAsName = sn.value; }; if (S.form.saveAs && !S.form.saveAsName) sn.focus(); }
      document.querySelector('#painSw').onchange = ev => { S.form.pain = ev.target.checked ? 'yes' : 'no'; app.render({ keepScroll: true }); };
    }
  },
  onInput(el) {
    if (el.dataset.note) { S.exNotes[el.dataset.note] = el.value; clearTimeout(this._n); this._n = setTimeout(() => app.save('exNotes'), 400); return; }
    if (!el.dataset.field || el.dataset.set == null) return;
    const s = cur().sets[+el.dataset.set], f = el.dataset.field;
    const raw = el.value === '' ? null : Number(String(el.value).replace(',', '.'));
    s[f] = f === 'w' ? fromDisplay(raw, unit()) : raw;
    if (f === 'w') { const pl = document.querySelector('#platesLine'); if (pl) pl.textContent = plateText(cur(), s.w ?? defaultVal(cur(), +el.dataset.set, 'w')); }
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
    async 'set-done'(el) {
      const w = W(), e = cur(), i = +el.dataset.set, s = e.sets[i];
      autofill(e, i);
      const tf = e.fields[e.fields.length - 1];
      if (!s[tf]) return app.toast(`Add the ${UNIT_WORD[tf]} first`);
      const best = heaviest(before(), e.exId);
      if (looksOff(s.w, best) && !(await app.confirm(`${esc(fmtW(s.w, unit()))} is much heavier than your best on this exercise (${esc(fmtW(best, unit()))}). Is that right?`, { ok: 'Yes, Log It' }))) return;
      s.done = true; s.ts = Date.now();
      const nx = afterSet(w, w.index);
      if (nx.superset) {
        // Superset: straight to the partner, rest only after both, then the next round.
        const to = w.exercises[nx.index], p = w.exercises[partnerIndex(w, w.index)];
        if (nx.rest && S.settings.autoRest && !w.past) timer.start(Math.max(e.target.rest, p.target.rest), `${getExercise(to.exId).name} · set ${to.sets.findIndex(x => !x.done) + 1}`);
        if (nx.index !== w.index) { w.index = nx.index; if (!nx.rest) app.toast(`Superset: now ${esc(to.name)}`); }
        navigator.vibrate?.(20);
        return touch(false);
      }
      const moreHere = e.sets.some(x => !x.done);
      if (S.settings.autoRest && !w.past) {
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
        ${group(row({ title: 'Add an exercise', sub: 'Inserted after this one', icon: 'dumbbell', color: 'blue', action: 'pick-ex' }) + row({ title: 'Add a set', icon: 'plus', action: 'add-set' }) + row({ title: 'Remove a set', icon: 'minus', color: 'gray', action: 'remove-set' })
          + (partnerIndex(W(), W().index) >= 0 ? row({ title: 'Unpair superset', sub: `Do ${esc(W().exercises[partnerIndex(W(), W().index)].name)} on its own`, icon: 'swap', color: 'gray', action: 'unpair' })
            : nextFree() >= 0 ? row({ title: `Superset with ${esc(W().exercises[nextFree()].name)}`, sub: 'Alternate sets, rest after each pair', icon: 'bolt', color: 'orange', action: 'pair' }) : '')
          + row({ title: 'Replace exercise', sub: 'Busy equipment or something feels off', icon: 'swap', color: 'indigo', action: 'swap' })
          + row({ title: e.skipped ? 'Don’t skip' : 'Skip exercise', icon: 'skip', color: 'orange', action: 'skip' })
          + row({ title: 'My notes', sub: note ? esc(note.slice(0, 40)) : 'Seat height, grip, reminders', icon: 'note', color: 'gray', action: 'notes' })
          + row({ title: 'Something feels off', sub: 'Weight, recovery, anything: saved for tuning', icon: 'info', color: 'orange', action: 'feels-off' }))}
        <button class="btn gray" data-action="close-sheet">Cancel</button>`);
    },
    'close-sheet'() { app.closeSheet(); },
    'pick-ex'() { pickerSheet(); },
    'awake-help'() {
      app.sheet(`<h2 class="sheet-title">Keep the screen on</h2><p class="sheet-sub">iPhone didn’t let the app keep the screen on, so it may lock during rests. A locked phone can’t play the rest beep.</p>
        ${group(row({ title: '1. Open Settings', chevron: false }) + row({ title: '2. Display & Brightness → Auto-Lock', chevron: false }) + row({ title: '3. Choose 5 minutes or Never while you train', chevron: false }))}
        <p class="fine">Also make sure your ringer isn’t silenced if you want to hear the beep. If you come back after a rest ended, the app tells you how long ago.</p>
        <button class="btn filled" data-action="awake-retry">Try Again</button><button class="btn plain" data-action="close-sheet">Close</button>`);
    },
    async 'awake-retry'() { app.closeSheet(); wakeLock = null; awake = null; await keepAwake(); app.render({ keepScroll: true }); app.toast(awake === 'on' ? 'Screen will stay on' : 'Still blocked: set Auto-Lock as shown'); },
    'feels-off'() { app.closeSheet(); setTimeout(() => feedbackSheet(), 250); },
    async pair() { const w = W(), j = nextFree(); pairExercises(w, w.index, j); await rememberPairs(); app.closeSheet(); touch(); app.toast(`Paired with ${esc(w.exercises[j].name)}. Remembered for next time.`); },
    async unpair() { unpairExercise(W(), W().index); await rememberPairs(); app.closeSheet(); touch(); app.toast('Superset removed'); },
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
    plates() { platesSheet(); },
    async 'set-bar'(el) {
      const kind = el.dataset.kind, u = unit();
      S.settings.bars = { ...S.settings.bars, [u]: { ...(S.settings.bars?.[u] || {}), [kind]: +el.dataset.w } };
      await app.save('settings'); platesSheet(); app.render({ keepScroll: true });
    },
    'pain-swap'(el) {
      const from = cur().name;
      if (doneSets(cur()).length) app.toast('Sets you’d logged for the old exercise were cleared');
      swapExercise(W(), W().index, el.dataset.id, app.strength, unit()); touch(false);
      app.toast(`Swapped ${esc(from)} for ${esc(getExercise(el.dataset.id).name)}, just for today`);
    },
    'pain-light'() {
      // About 20% lighter at the bottom of the range: enough to train it without pushing into pain.
      const e = cur(), ex = getExercise(e.exId);
      if (e.suggestion.w) e.suggestion = { ...e.suggestion, w: Math.max(0, Math.round(e.suggestion.w * 0.8 / ex.inc) * ex.inc), target: e.target.min };
      e.painLight = true; touch();
    },
    async 'pain-fine'(el) {
      S.painClear = { ...S.painClear, [el.dataset.a]: Date.now() }; await app.save('painClear');
      cur().painOk = true; touch(); app.toast('Good to hear. Flags for it are cleared until it hurts again.');
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
      if (!workoutStats(W()).sets) return app.toast('Log at least one set, or discard the workout');
      const pain = S.form.pain === 'yes' ? { flag: true, areas: S.form.painAreas || [], location: S.form.painLoc || '' } : { flag: false, areas: [], location: '' };
      if (W().past && S.form.date && S.form.date <= isoDate()) { const d = parseISO(S.form.date); d.setHours(new Date(W().startedAt).getHours(), new Date(W().startedAt).getMinutes()); W().startedAt = d.getTime(); }
      const w = W(), session = finalizeWorkout(w, { rpe: S.form.rpe === '' ? null : +S.form.rpe, notes: S.form.notes, pain, durationMin: S.form.duration }, before());
      // Keep added exercises in the planned workout (in the order they appear).
      let kept = 0;
      for (const i of [...(S.form.keep || [])].sort((a, b) => a - b)) {
        const e = w.exercises[i], ex = getExercise(e.exId), after = w.exercises.slice(0, i).reverse().find(x => !x.skipped)?.exId ?? null;
        const r = keepExercise({ overrides: S.overrides, customRoutines: S.customRoutines }, w.routineId, { ex: e.exId, ...prescriptionFor(ex) }, after);
        S.overrides = r.overrides; S.customRoutines = r.customRoutines; kept++;
      }
      if (kept) { setCustomRoutines(S.customRoutines); await app.save('overrides'); await app.save('customRoutines'); }
      // Save a quick workout as one of your workouts, and link this session to it.
      let savedAs = null;
      if (w.quick && S.form.saveAs) {
        const r = routineFromWorkout(w, (S.form.saveAsName || '').trim() || 'My workout');
        if (r.blocks.length) { S.customRoutines = { ...S.customRoutines, [r.id]: r }; setCustomRoutines(S.customRoutines); await app.save('customRoutines'); session.routineId = r.id; session.title = r.title; savedAs = r.title; }
      }
      try { await db.putSession(session); } catch { return app.toast('Couldn’t save. Export a backup in Settings.'); }
      S.active = null; await app.saveActive(true); timer.stop(); wakeLock?.release?.();
      await app.reloadSessions();
      app.go(`history/session/${session.id}`);
      app.toast(savedAs ? `Saved · “${esc(savedAs)}” added to Plan` : kept ? `Saved · ${kept} exercise${kept > 1 ? 's' : ''} kept for next time` : session.prs.length ? `Saved · ${session.prs.length} personal record${session.prs.length > 1 ? 's' : ''}` : 'Workout saved');
    },
  },
};

export { tile };
