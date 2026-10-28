// Plan: the week at a glance, the schedule, and each workout's exercises.
import { app, S } from './core-app.js';
import { esc, icon, pageHead, navBar, group, row, routineLook } from './ui-kit.js';
import { PHASES, DAYS, DAY_OPTIONS, ROUTINES, resolveRoutine, prescribe, rangeLabel, phaseFor, getRoutine, allRoutineIds, isCustomRoutine, setCustomRoutines, removeExtra, routineFromBlocks, estimateRoutineMinutes } from './domain-program.js';
import { prescriptionFor } from './domain-builder.js';
import { exercisePicker } from './ui-picker.js';
import { allExercises } from './domain-catalog.js';
import { canDoWith, missingFor, equipLabel } from './domain-taxonomy.js';
import { getExercise } from './domain-catalog.js';
import { startForWeek, dayKey } from './domain-calendar.js';
import { EQUIPMENT, AREAS } from './domain-personalize.js';
import { bodySummary } from './ui-body.js';

const DAY_NAME = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const optLabel = v => getRoutine(v) ? getRoutine(v).title : v === 'Padel' ? 'Padel' : v === 'Recovery' ? 'Recovery' : 'Rest';

function overview() {
  const pos = app.position(), ph = phaseFor(pos.week), today = dayKey();
  const setup = `${app.location()?.name || EQUIPMENT[S.profile.equipment]} · ${S.profile.minutes} min · ${S.profile.days}× a week`;
  return `${pageHead('Plan', { sub: `Week ${pos.week} of 4 · ${esc(ph.name)}` })}
    ${group(row({ title: `Week ${pos.week}: ${esc(ph.name)}`, sub: esc(ph.note), icon: 'target', color: 'indigo', action: 'week-sheet' }),
      { header: 'This cycle', footer: 'Each cycle is 4 weeks. Weeks move forward on their own every Monday.' })}
    ${group(DAYS.map(d => row({ title: DAY_NAME[d], value: esc(optLabel(S.schedule[d])), action: 'day-sheet', data: { day: d }, cls: d === today ? 'is-today' : '' })).join(''), { header: 'Schedule' })}
    ${group(row({ title: 'Body weight & measurements', sub: esc(bodySummary()), icon: 'person', color: 'teal', to: 'body' }), { header: 'Body' })}
    ${group(row({ title: 'New Workout', sub: 'Pick the exercises yourself', icon: 'plus', color: 'green', action: 'new-workout' })
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
    ${group(r.blocks.map(blk => { const ex = getExercise(blk.ex), rx = prescribe(blk, wk);
      if (blk.extra) return row({ title: esc(ex.name), sub: `${rx.sets} sets × ${esc(rangeLabel(blk))} · added by you`, action: 'extra-sheet', data: { r: id, k: String(blk.index).slice(1) } });
      return row({ title: esc(ex.name), sub: `${rx.sets} sets × ${esc(rangeLabel(blk))}${blk.adaptedFrom ? ' · adapted to your setup' : ''}${S.overrides[id]?.[blk.index] ? ' · edited' : ''}`, action: 'edit-block', data: { r: id, i: blk.index } }); }).join(''),
      { header: 'Exercises', footer: `${r.dropped.length ? `Left out to fit ${S.profile.minutes} minutes: ${r.dropped.map(b => esc(getExercise(b.ex).name)).join(', ')}. ` : ''}Tap an exercise to change it.` })}
    <div class="btns">${S.active ? '<button class="btn tinted" data-action="resume">Continue Current Workout</button>' : `<button class="btn filled" data-action="start" data-routine="${id}">${icon('play')}Start Workout</button>`}
    ${edited ? `<button class="btn plain" data-action="reset-routine" data-r="${id}">Restore Original Exercises</button>` : ''}
    ${isCustomRoutine(id) ? `<button class="btn destructive" data-action="delete-routine" data-r="${id}">Delete Workout</button>` : ''}</div>`;
}

export const plan = {
  tab: 'plan',
  render() { return S.params[0] === 'routine' ? routineView(S.params[1]) : S.params[0] === 'new' ? newView() : overview(); },
  mounted() { const n = document.querySelector('#nwName'); if (n) n.oninput = () => { NEW.title = n.value; }; },
  actions: {
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
          { footer: 'Tip: avoid your hardest leg workout the day before an important match.' })}`);
    },
    async 'set-day'(el) { S.schedule[el.dataset.day] = el.dataset.v; await app.save('schedule'); app.closeSheet(); app.render({ keepScroll: true }); },
    'how-sheet'() {
      app.sheet(`<h2 class="sheet-title">How your plan adapts</h2><div style="height:12px"></div>
        ${group(row({ title: 'Getting stronger', sub: 'Each exercise has a target range, like 8–10 reps. When you reach the top on every set, the app suggests a little more weight next time.' })
          + row({ title: 'Bad days', sub: 'Miss the bottom of the range twice and it suggests a bit less, so you can rebuild.' })
          + row({ title: '4-week cycles', sub: 'Three weeks build up, then a lighter recovery week with fewer sets.' })
          + row({ title: 'Your setup', sub: 'Exercises are swapped to match your equipment and the time you have.' })
          + row({ title: 'Warm-up', sub: 'Before your first heavy exercise, do 5 minutes of easy movement and 2–3 lighter practice sets.' }))}`);
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
