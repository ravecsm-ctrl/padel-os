// Plan: the week at a glance, the schedule, and each workout's exercises.
import { app, S } from './core-app.js';
import { esc, icon, pageHead, navBar, group, row, routineLook } from './ui-kit.js';
import { isRoutine, isLegHeavy, PHASES, DAYS, DAY_OPTIONS, ROUTINES, resolveRoutine, prescribe, rangeLabel, phaseFor, getRoutine, allRoutineIds, isCustomRoutine, setCustomRoutines, removeExtra, moveBlock, routineFromBlocks, estimateRoutineMinutes } from './domain-program.js';
import { prescriptionFor } from './domain-builder.js';
import { exercisePicker } from './ui-picker.js';
import { allExercises } from './domain-catalog.js';
import { canDoWith, missingFor, equipLabel } from './domain-taxonomy.js';
import { getExercise } from './domain-catalog.js';
import { startForWeek, dayKey } from './domain-calendar.js';
import { EQUIPMENT, AREAS, bestWeek, scheduleScore } from './domain-personalize.js';
import { MATCH_LEVELS, LEVEL_HINT, suggestLevel } from './domain-matchlevel.js';
import { bodySummary } from './ui-body.js';
import { goalView, goalMounted, goalPick, goalActions, blockHero, blockCard } from './ui-goal.js';

const DAY_NAME = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const usual = d => S.settings.padelLevel?.[d] || 'normal';
// "Padel · Hard" in the schedule; a normal day just says Padel.
const dayLabel = d => S.schedule[d] === 'Padel' && usual(d) !== 'normal' ? `Padel · ${MATCH_LEVELS[usual(d)]}` : optLabel(S.schedule[d]);
const optLabel = v => getRoutine(v) ? getRoutine(v).title : v === 'Padel' ? 'Padel' : v === 'Recovery' ? 'Recovery' : 'Rest';

// ── A better week for the schedule you have: same workouts and padel days, days moved so legs aren't
// the day before (or after) a match. Shown when it's clearly better, until you use it or say Not now.
function betterWeek() {
  const sched = S.schedule, gym = DAYS.filter(d => isRoutine(sched[d]));
  if (!gym.length || S.settings.weekTipOff === JSON.stringify(sched)) return null;
  const padel = DAYS.filter(d => sched[d] === 'Padel');
  const levels = S.settings.padelLevel || {};
  const best = bestWeek(gym.map(d => sched[d]), padel, isLegHeavy, levels);
  if (scheduleScore(sched, isRoutine, isLegHeavy, levels) - best.score < 1.9) return null;
  const next = { ...sched };
  gym.forEach(d => { next[d] = 'Rest'; });
  const hadRecovery = DAYS.filter(d => sched[d] === 'Recovery').length;
  best.days.forEach((d, i) => { next[d] = best.ids[i]; });
  // A workout that landed on your recovery day: put the recovery day on one of the days it left.
  const freed = gym.filter(d => !best.days.includes(d));
  if (DAYS.filter(d => next[d] === 'Recovery').length < hadRecovery && freed.length) next[freed[Math.floor(freed.length / 2)]] = 'Recovery';
  // Say what the new week fixes: the first problem in your week that isn't in the new one.
  const at = (w, d, k) => w[DAYS[(DAYS.indexOf(d) + k + 7) % 7]], lvl = (d, k) => usual(DAYS[(DAYS.indexOf(d) + k + 7) % 7]);
  const problems = w => DAYS.filter(d => isRoutine(w[d])).flatMap(d => [
    isLegHeavy(w[d]) && at(w, d, 1) === 'Padel' && lvl(d, 1) !== 'easy' && `${optLabel(w[d])} is the day before ${lvl(d, 1) === 'hard' ? 'a hard match' : 'padel'}`,
    isLegHeavy(w[d]) && at(w, d, -1) === 'Padel' && lvl(d, -1) !== 'easy' && `${optLabel(w[d])} is the day after ${lvl(d, -1) === 'hard' ? 'a hard match' : 'padel'}`,
    isLegHeavy(w[d]) && isLegHeavy(at(w, d, 1)) && `${optLabel(w[d])} and ${optLabel(at(w, d, 1))} are leg days in a row`,
    isRoutine(at(w, d, 1)) && `${optLabel(w[d])} and ${optLabel(at(w, d, 1))} are on back-to-back days`,
    !isLegHeavy(w[d]) && at(w, d, 1) === 'Padel' && lvl(d, 1) !== 'easy' && `${optLabel(w[d])} is the day before padel`]).filter(Boolean);
  const fixed = problems(next);
  const why = problems(sched).find(p => !fixed.includes(p)) || 'Your workouts can be spread out better around padel';
  const moves = gym.map(d => [d, best.days[best.ids.indexOf(sched[d])]]).filter(([a, b]) => b && a !== b).map(([a, b]) => `${optLabel(sched[a])}: ${DAY_NAME[a]} → ${DAY_NAME[b]}`);
  return moves.length ? { next, why, moves } : null;
}
// Your last three matches on a weekday all went one way that isn't the setting: suggest it (never changed by itself).
function levelTip() {
  for (const d of DAYS) {
    if (S.schedule[d] !== 'Padel') continue;
    const sug = suggestLevel(S.sessions, d, usual(d));
    if (sug && S.settings.levelTipOff?.[d] !== sug) return { d, sug };
  }
  return null;
}
function levelTipCard() {
  const t = levelTip();
  if (!t) return '';
  return `<section class="card week-tip"><div class="hero-top" style="margin-bottom:10px"><span class="tile teal">${icon('racket')}</span><div><b>Your ${DAY_NAME[t.d]} matches</b><p class="t-sub">Your last three were ${MATCH_LEVELS[t.sug].toLowerCase()}. ${DAY_NAME[t.d]} is set to ${MATCH_LEVELS[usual(t.d)].toLowerCase()}.</p></div></div>
    <div class="btns"><button class="btn filled" data-action="set-level" data-day="${t.d}" data-level="${t.sug}" data-tip="1">Set ${DAY_NAME[t.d]} to ${MATCH_LEVELS[t.sug]}</button><button class="btn plain" data-action="level-tip-off" data-day="${t.d}" data-level="${t.sug}">Not now</button></div></section>`;
}
function betterWeekCard() {
  const b = betterWeek();
  if (!b) return '';
  return `<section class="card week-tip"><div class="hero-top" style="margin-bottom:10px">${`<span class="tile orange">${icon('sliders')}</span>`}<div><b>A better week</b><p class="t-sub">${esc(b.why)}.</p></div></div>
    <ul class="week-moves">${b.moves.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
    <div class="btns"><button class="btn filled" data-action="week-better">Use Better Week</button><button class="btn plain" data-action="week-tip-off">Not now</button></div></section>`;
}

function overview() {
  const pos = app.position(), ph = phaseFor(pos.week), today = dayKey();
  const setup = `${app.location()?.name || EQUIPMENT[S.profile.equipment]} · ${S.profile.minutes} min · ${S.profile.days}× a week`;
  return `${pageHead('Plan', { sub: `Week ${pos.week} of ${pos.block ? pos.block.weeks : 4} · ${esc(ph.name)}` })}
    <div class="court-stack">${pos.block ? blockHero(pos.block) : `<button class="card hero" data-action="week-sheet" style="display:block;width:100%;text-align:left">
      <p class="t-foot">This cycle</p><h2>Week ${pos.week}: ${esc(ph.name)}</h2><p class="t-sub">${esc(ph.note)}</p>
      <div class="cycle">${PHASES.map((p, i) => `<span class="${i + 1 === pos.week ? 'on' : i + 1 < pos.week ? 'past' : ''}"><b></b><small>${esc(p.name)}</small></span>`).join('')}</div></button>`}
      <div class="court-days">${DAYS.map(d => { const v = S.schedule[d], kind = isRoutine(v) ? 'gym' : v === 'Padel' ? 'padel' : v === 'Recovery' ? 'rec' : 'rest';
        return `<button class="${kind} ${d === today ? 'today' : ''}" data-action="day-sheet" data-day="${d}" aria-label="${DAY_NAME[d]}: ${esc(optLabel(v))}"><small>${d[0]}</small><span>${kind === 'gym' ? icon(routineLook(v).icon) : kind === 'padel' ? icon('racket') : kind === 'rec' ? icon('heart') : ''}</span></button>`; }).join('')}</div></div>
    <p class="grp-f" style="margin:8px 4px 24px">${pos.block ? 'Your goal block moves forward on its own every Monday.' : 'Each cycle is 4 weeks and moves forward on its own every Monday.'} Tap a day to change it.</p>
    ${blockCard()}${betterWeekCard()}${levelTipCard()}
    ${group(DAYS.map(d => row({ title: DAY_NAME[d], value: esc(dayLabel(d)), action: 'day-sheet', data: { day: d }, cls: d === today ? 'is-today' : '' })).join(''), { header: 'Schedule' })}
    ${group(row({ title: 'Body weight & measurements', sub: esc(bodySummary()), icon: 'person', color: 'gray', to: 'body' }), { header: 'Body' })}
    ${group(row({ title: 'Start a goal', sub: 'A 4 to 8 week plan toward one goal', icon: 'target', color: 'teal', action: 'goal-new' })
      + row({ title: 'New Workout', sub: 'Pick the exercises yourself', icon: 'plus', color: 'green', action: 'new-workout' })
      + row({ title: 'Build a program', sub: 'Choose a focus; get workouts that fit you', icon: 'sliders', color: 'blue', to: 'builder' }), { header: 'New' })}
    ${group(allRoutineIds().map(id => { const r = app.routine(id), look = routineLook(id);
      return row({ title: esc(r.title), sub: `${r.blocks.length} exercise${r.blocks.length === 1 ? "" : "s"} · about ${r.minutes} min${isCustomRoutine(id) ? ' · yours' : ''}`, icon: look.icon, color: look.color, to: `plan/routine/${id}` }); }).join('')
      + row({ title: 'Exercise library', sub: 'Browse, filter by equipment, import your own', icon: 'dumbbell', color: 'gray', to: 'library' }), { header: 'Workouts' })}
    ${group(row({ title: 'Your setup', sub: esc(setup), icon: 'sliders', color: 'gray', to: 'welcome' })
      + row({ title: 'How your plan adapts', icon: 'info', color: 'blue', action: 'how-sheet' }), { header: 'About your plan' })}`;
}

// ── New workout: name it, pick exercises, set the order. Sets and reps come from sensible
// defaults for each exercise and can be changed afterwards like any workout.
let NEW = null;
let ORDER = null;   // the workout whose exercise order you're changing
function newView() {
  if (!NEW) NEW = { title: '', blocks: [] };
  const n = NEW.blocks.length;
  const rows = NEW.blocks.map((b, i) => { const ex = getExercise(b.ex);
    return `<div class="row nw-row"><span class="nw-num">${i + 1}</span><span class="row-main"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${b.sets} sets × ${esc(rangeLabel(b))}</span></span>
      <button class="nw-btn" data-action="nw-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up')}</button>
      <button class="nw-btn down" data-action="nw-down" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down')}</button>
      <button class="nw-btn del" data-action="nw-del" data-i="${i}" aria-label="Remove">${icon('minus')}</button></div>`; }).join('');
  return `${navBar({ back: 'Cancel', backAction: 'nw-cancel', title: 'New Workout', right: '<button class="nav-btn right" data-action="nw-save">Save</button>' })}<div style="height:12px"></div>
    ${group(`<label class="row"><span class="row-main"><input class="input" id="nwName" value="${esc(NEW.title)}" placeholder="Name, e.g. Upper body at home" maxlength="40" style="padding:0;background:none;min-height:22px" aria-label="Workout name"></span></label>`, { header: 'Name' })}
    ${group(rows + row({ title: 'Add Exercise', icon: 'plus', color: 'green', action: 'nw-add', chevron: false, cls: 'action' }), { header: n ? `Exercises · about ${estimateRoutineMinutes(NEW.blocks)} min` : 'Exercises', footer: n ? 'Big lifts first, smaller and prevention work last. You can change sets and reps after saving.' : 'Add the exercises in the order you want to do them.' })}`;
}

function routineView(id) {
  const r = app.routine(id), wk = app.position().week, look = routineLook(id);
  if (!r) return navBar({ back: 'Plan', backTo: 'plan' });
  const edited = Object.keys(S.overrides[id] || {}).length;
  return `${navBar({ back: 'Plan', backTo: 'plan', title: '' })}
    <div class="hero-top" style="padding:8px 4px 16px">${icon(look.icon) && `<span class="tile ${look.color} lg">${icon(look.icon)}</span>`}<div><h1 class="t-title">${esc(r.title)}</h1><p class="t-sub">${r.blocks.length} exercise${r.blocks.length === 1 ? "" : "s"} · about ${r.minutes} min</p></div></div>
    <p class="t-sub" style="padding:0 4px 20px">${esc(r.focus)}</p>
    ${ORDER === id ? group(r.blocks.map((blk, i) => { const ex = getExercise(blk.ex);
      return `<div class="row nw-row"><span class="nw-num">${i + 1}</span><span class="row-main"><span class="row-title">${esc(ex.name)}</span></span>
        <button class="nw-btn" data-action="ord-move" data-r="${esc(id)}" data-i="${i}" data-to="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(ex.name)} up">${icon('up')}</button>
        <button class="nw-btn down" data-action="ord-move" data-r="${esc(id)}" data-i="${i}" data-to="${i + 1}" ${i === r.blocks.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(ex.name)} down">${icon('down')}</button></div>`; }).join(''),
      { header: 'Exercise order', footer: 'Saved as you go. Tap Done when you’re finished.' }) + `<button class="btn filled" data-action="ord-done" style="margin-bottom:20px">Done</button>` : ''}
    ${ORDER === id ? '' : group(r.blocks.map(blk => { const ex = getExercise(blk.ex), rx = prescribe(blk, wk);
      if (blk.extra) return row({ title: esc(ex.name), sub: `${rx.sets} sets × ${esc(rangeLabel({ ...blk, min: rx.min, max: rx.max }))} · added by you`, action: 'extra-sheet', data: { r: id, k: String(blk.index).slice(1) } });
      return row({ title: esc(ex.name), sub: `${rx.sets} sets × ${esc(rangeLabel({ ...blk, min: rx.min, max: rx.max }))}${blk.adaptedFrom ? ' · adapted to your setup' : ''}${S.overrides[id]?.[blk.index] ? ' · edited' : ''}`, action: 'edit-block', data: { r: id, i: blk.index } }); }).join(''),
      { header: 'Exercises', footer: `${r.dropped.length ? `Left out to fit ${S.profile.minutes} minutes: ${r.dropped.map(b => esc(getExercise(b.ex).name)).join(', ')}. ` : ''}Tap an exercise to change it.${r.blocks.length > 1 ? ` <button class="link" data-action="ord-start" data-r="${esc(id)}">Change order</button>` : ''}` })}
    <div class="btns">${S.active ? '<button class="btn tinted" data-action="resume">Continue Current Workout</button>' : `<button class="btn filled" data-action="start" data-routine="${id}">${icon('play')}Start Workout</button>`}
    ${edited ? `<button class="btn plain" data-action="reset-routine" data-r="${id}">Restore Original Exercises</button>` : ''}
    ${isCustomRoutine(id) ? `<button class="btn destructive" data-action="delete-routine" data-r="${id}">Delete Workout</button>` : ''}</div>`;
}

export const plan = {
  tab: 'plan',
  render() { return S.params[0] === 'routine' ? routineView(S.params[1]) : S.params[0] === 'new' ? newView() : S.params[0] === 'goal' ? goalView() : overview(); },
  mounted() { const n = document.querySelector('#nwName'); if (n) n.oninput = () => { NEW.title = n.value; }; goalMounted(); },
  onPick(name, value) { goalPick(name, value); },
  actions: {
    ...goalActions,
    'new-workout'() { NEW = { title: '', blocks: [] }; app.go('plan/new'); },
    'nw-add'() {
      exercisePicker({ title: 'Add to workout', sub: 'Sets and reps are set for you; change them after saving.', inUse: NEW.blocks.map(b => b.ex), pick: id => {
        if (NEW.blocks.some(b => b.ex === id)) return app.toast('Already in this workout');
        NEW.blocks.push({ ex: id, ...prescriptionFor(getExercise(id)) }); app.render({ keepScroll: true });
      } });
    },
    'nw-up'(el) { const i = +el.dataset.i, b = NEW.blocks; [b[i - 1], b[i]] = [b[i], b[i - 1]]; app.render({ keepScroll: true }); },
    'nw-down'(el) { const i = +el.dataset.i, b = NEW.blocks; [b[i + 1], b[i]] = [b[i], b[i + 1]]; app.render({ keepScroll: true }); },
    'nw-del'(el) { NEW.blocks.splice(+el.dataset.i, 1); app.render({ keepScroll: true }); },
    async 'nw-cancel'() {
      if (NEW?.blocks.length && !(await app.confirm('Discard this workout?', { ok: 'Discard', danger: true }))) return;
      NEW = null; app.go('plan');
    },
    async 'nw-save'() {
      if (!NEW.title.trim()) { document.querySelector('#nwName')?.focus(); return app.toast('Give it a name'); }
      if (!NEW.blocks.length) return app.toast('Add at least one exercise');
      const r = routineFromBlocks(NEW.title, NEW.blocks);
      S.customRoutines = { ...S.customRoutines, [r.id]: r }; setCustomRoutines(S.customRoutines); await app.save('customRoutines');
      NEW = null; app.go(`plan/routine/${r.id}`); app.toast(`“${esc(r.title)}” saved. Set a day for it in the schedule.`);
    },
    'week-sheet'() {
      const pos = app.position();
      app.sheet(`<h2 class="sheet-title">Which week are you in?</h2><p class="sheet-sub">Change this if you missed time, for example after illness or travel.</p>
        ${group(PHASES.map(p => row({ title: `Week ${p.week}: ${esc(p.name)}`, sub: esc(p.note), action: 'set-week', data: { w: p.week }, chevron: false, right: p.week === pos.week ? icon('check', 'check-mark') : '' })).join(''))}`);
    },
    async 'set-week'(el) {
      S.settings.programStart = startForWeek(+el.dataset.w, S.settings.programStart);
      await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast(`Now in week ${el.dataset.w}`);
    },
    'day-sheet'(el) {
      const d = el.dataset.day;
      app.sheet(`<h2 class="sheet-title">${DAY_NAME[d]}</h2><div style="height:12px"></div>
        ${group([...DAY_OPTIONS.slice(0, 3), ...allRoutineIds().filter(isCustomRoutine), ...DAY_OPTIONS.slice(3)].map(v => row({ title: esc(optLabel(v)), action: 'set-day', data: { day: d, v }, chevron: false, right: S.schedule[d] === v ? icon('check', 'check-mark') : '' })).join(''),
          { footer: S.schedule[d] === 'Padel' ? '' : 'Tip: avoid your hardest leg workout the day before an important match.' })}
        ${S.schedule[d] === 'Padel' ? group(Object.entries(MATCH_LEVELS).map(([k, label]) => row({ title: label, sub: LEVEL_HINT[k], action: 'set-level', data: { day: d, level: k }, chevron: false, right: usual(d) === k ? icon('check', 'check-mark') : '' })).join(''),
          { header: `How hard is padel on ${DAY_NAME[d]}s?`, footer: 'Hard days keep your legs fresh the day before and give them time after. Change it for one date from the calendar or Today.' }) : ''}`);
    },
    async 'set-level'(el) {
      const d = el.dataset.day, lv = el.dataset.level, map = { ...(S.settings.padelLevel || {}) };
      if (lv === 'normal') delete map[d]; else map[d] = lv;
      S.settings.padelLevel = map; await app.save('settings');
      if (el.dataset.tip) { app.render({ keepScroll: true }); return app.toast(`${DAY_NAME[d]}: ${MATCH_LEVELS[lv].toLowerCase()} padel`); }
      plan.actions['day-sheet']({ dataset: { day: d } }); app.render({ keepScroll: true });
    },
    async 'level-tip-off'(el) { S.settings.levelTipOff = { ...(S.settings.levelTipOff || {}), [el.dataset.day]: el.dataset.level }; await app.save('settings'); app.render({ keepScroll: true }); },
    async 'week-better'() {
      const b = betterWeek(); if (!b) return;
      const old = { ...S.schedule };
      S.schedule = b.next; await app.save('schedule'); app.render({ keepScroll: true });
      app.toast('Week updated', async () => { S.schedule = old; await app.save('schedule'); app.render({ keepScroll: true }); });
    },
    async 'week-tip-off'() { S.settings.weekTipOff = JSON.stringify(S.schedule); await app.save('settings'); app.render({ keepScroll: true }); },
    async 'set-day'(el) { S.schedule[el.dataset.day] = el.dataset.v; await app.save('schedule'); app.closeSheet(); app.render({ keepScroll: true }); },
    'how-sheet'() {
      app.sheet(`<h2 class="sheet-title">How your plan adapts</h2><div style="height:12px"></div>
        ${group(row({ title: 'Getting stronger', sub: 'Each exercise has a target range, like 8–10 reps. When you reach the top on every set, the app suggests a little more weight next time.' })
          + row({ title: 'Bad days', sub: 'Miss the bottom of the range twice and it suggests a bit less, so you can rebuild.' })
          + row({ title: '4-week cycles', sub: 'Three weeks build up, then a lighter recovery week with fewer sets.' })
          + row({ title: 'Your setup', sub: 'Exercises are swapped to match your equipment and the time you have.' })
          + row({ title: 'Warm-up', sub: 'Before your first heavy exercise, do 5 minutes of easy movement and 2–3 lighter practice sets.' }))}`);
    },
    'ord-start'(el) { ORDER = el.dataset.r; app.render({ keepScroll: true }); },
    'ord-done'() { ORDER = null; app.render({ keepScroll: true }); app.toast('Order saved'); },
    async 'ord-move'(el) {
      const id = el.dataset.r;
      S.overrides = moveBlock(S.overrides, id, app.routine(id).blocks, +el.dataset.i, +el.dataset.to);
      await app.save('overrides'); app.render({ keepScroll: true });
    },
    async 'delete-routine'(el) {
      if (!(await app.confirm(`Delete “${esc(getRoutine(el.dataset.r).title)}”? Logged sessions stay in Progress.`, { ok: 'Delete', danger: true }))) return;
      delete S.customRoutines[el.dataset.r]; setCustomRoutines(S.customRoutines);
      for (const d of Object.keys(S.schedule)) if (S.schedule[d] === el.dataset.r) S.schedule[d] = 'Rest';
      await app.save('customRoutines'); await app.save('schedule'); app.go('plan');
    },
    'extra-sheet'(el) {
      const x = S.overrides[el.dataset.r]?._extra?.[+el.dataset.k];
      if (!x) return;
      app.sheet(`<h2 class="sheet-title">${esc(getExercise(x.ex).name)}</h2><p class="sheet-sub">You added this to the workout. Remove it to go back to the original exercises.</p>
        <button class="btn destructive" data-action="extra-remove" data-r="${esc(el.dataset.r)}" data-k="${esc(el.dataset.k)}">Remove from Workout</button><button class="btn plain" data-action="close-sheet">Cancel</button>`);
    },
    async 'extra-remove'(el) { S.overrides = removeExtra(S.overrides, el.dataset.r, +el.dataset.k); await app.save('overrides'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Removed'); },
    async 'reset-routine'(el) {
      if (!(await app.confirm('Restore the original exercises for this workout?', { ok: 'Restore' }))) return;
      delete S.overrides[el.dataset.r]; await app.save('overrides'); app.render({ keepScroll: true });
    },
    'edit-block'(el) {
      const rid = el.dataset.r, i = +el.dataset.i, base = getRoutine(rid).blocks[i];
      const blk = resolveRoutine(rid, S.overrides).blocks[i]; // the slot as edited, before adapting to the profile
      const baseEx = getExercise(base.ex);
      // Same-movement alternatives from the whole library (and yours), grouped by what this location has.
      const owned = app.owned();
      const options = [...new Set([base.ex, ...baseEx.subs, ...allExercises().filter(e => e.movement && e.movement === baseEx.movement).map(e => e.id)])].filter(getExercise);
      const here = options.filter(id => canDoWith(getExercise(id).needs || [], owned)), elsewhere = options.filter(id => !here.includes(id));
      const opt = id => `<option value="${id}" ${id === blk.ex ? 'selected' : ''}>${esc(getExercise(id).name)}${id === base.ex ? ' (original)' : ''}</option>`;
      const tf = baseEx.fields[baseEx.fields.length - 1];
      const unitLbl = tf === 'sec' ? 'seconds' : tf === 'm' ? 'metres' : 'reps';
      const num = (id, label, val, extra = '') => row({ title: label, right: `<input class="input num" id="${id}" type="number" inputmode="numeric" ${extra} value="${val}" style="width:80px;text-align:right;background:none;padding:0" aria-label="${label}">` });
      app.sheet(`<h2 class="sheet-title">Change exercise</h2><div style="height:12px"></div>
        <label class="field-l" for="bEx">Exercise</label><select class="input" id="bEx"><optgroup label="Available at ${esc(app.location()?.name || 'this location')}">${here.map(opt).join('')}</optgroup>${elsewhere.length ? `<optgroup label="Needs other equipment">${elsewhere.map(opt).join('')}</optgroup>` : ''}</select>
        <div style="height:20px"></div>
        ${group(num('bSets', 'Sets', blk.sets, 'min="1" max="10"') + num('bMin', `Fewest ${unitLbl}`, blk.min, 'min="1"') + num('bMax', `Most ${unitLbl}`, blk.max, 'min="1"') + num('bRest', 'Rest (seconds)', blk.rest, 'min="0" step="15"'),
          { footer: 'Recovery weeks still reduce sets automatically.' })}
        <div class="btns"><button class="btn filled" id="bSave">Save</button><button class="btn plain" id="bReset">Use Original</button></div>`, body => {
        const v = id => +body.querySelector(id).value;
        body.querySelector('#bSave').onclick = async () => {
          const o = { ex: body.querySelector('#bEx').value, sets: Math.max(1, v('#bSets')), min: Math.max(1, v('#bMin')), max: Math.max(1, v('#bMax')), rest: Math.max(0, v('#bRest')) };
          if (o.max < o.min) [o.min, o.max] = [o.max, o.min];
          if (getExercise(o.ex).fields.join() !== baseEx.fields.join()) { o.min = base.min; o.max = base.max; }
          const diff = Object.fromEntries(Object.entries(o).filter(([k, val]) => base[k] !== val));
          S.overrides[rid] = { ...(S.overrides[rid] || {}) };
          if (Object.keys(diff).length) S.overrides[rid][i] = diff; else delete S.overrides[rid][i];
          if (!Object.keys(S.overrides[rid]).length) delete S.overrides[rid];
          await app.save('overrides'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Saved');
        };
        body.querySelector('#bReset').onclick = async () => {
          if (S.overrides[rid]) { delete S.overrides[rid][i]; if (!Object.keys(S.overrides[rid]).length) delete S.overrides[rid]; }
          await app.save('overrides'); app.closeSheet(); app.render({ keepScroll: true });
        };
      });
    },
  },
};

export { AREAS };
