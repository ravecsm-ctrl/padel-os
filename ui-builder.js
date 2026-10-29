// Program builder screens: focus → setup → preview & edit → save.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row, seg } from './ui-kit.js';
import { FOCUS, buildProgram, alternativesFor, prescriptionFor, rankExercises } from './domain-builder.js';
import { estimateMinutes, generateSchedule, LEVELS } from './domain-personalize.js';
import { getExercise } from './domain-catalog.js';
import { setCustomRoutines, rangeLabel, isLegHeavy } from './domain-program.js';
import { missingFor, equipLabel } from './domain-taxonomy.js';

let B = null;   // builder state
const fresh = () => ({ step: 1, focuses: [], days: Math.min(4, Math.max(1, S.profile.days || 2)), minutes: S.profile.minutes || 40, level: S.profile.level || 'intermediate', location: S.activeLocation, program: null, name: '', schedule: true });
const loc = () => S.locations.find(l => l.id === B.location) || app.location();
const opts = () => ({ focuses: B.focuses, days: B.days, minutes: B.minutes, level: B.level, injuries: S.profile.injuries || [], owned: loc() ? new Set(loc().equipment) : null });
const tick = on => on ? icon('check', 'check-mark') : '';
const used = () => new Set(B.program.sessions.flatMap(s => s.blocks.map(b => b.ex)));
const refreshMinutes = s => { s.minutes = estimateMinutes(s.blocks, B.minutes); };

function stepFocus() {
  const rows = Object.entries(FOCUS).map(([k, f]) => {
    const n = B.focuses.indexOf(k);
    return row({ title: esc(f.label), sub: esc(f.sub), action: 'b-focus', data: { f: k }, chevron: false, right: n >= 0 ? `<span class="pill-count" style="background:var(--blue);color:#fff">${n + 1}</span>` : '' });
  }).join('');
  return `<div class="wiz-q"><h1>What do you want to focus on?</h1><p class="t-sub">Pick up to 3, most important first.</p></div>
    ${group(rows, { footer: S.profile.injuries?.length ? 'Injury prevention will target the areas in your profile.' : 'Your first pick gets the most attention.' })}
    <div class="wiz-bottom"><div class="inner"><button class="btn filled" data-action="b-next" ${B.focuses.length ? '' : 'disabled'}>Continue</button></div></div>`;
}

function stepSetup() {
  return `<div class="wiz-q"><h1>Set up your program</h1></div>
    <label class="field-l">Workouts per week</label>${seg('b-days', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], B.days)}
    <label class="field-l">Minutes per workout</label>${seg('b-min', [[20, '20 min'], [40, '40 min'], [70, '70 min']], B.minutes)}
    <label class="field-l">Experience</label>${seg('b-level', Object.keys(LEVELS).map(k => [k, k[0].toUpperCase() + k.slice(1)]), B.level)}
    <div style="height:20px"></div>
    ${group(S.locations.map(l => row({ title: esc(l.name), sub: `${l.equipment.length} items`, action: 'b-loc', data: { id: l.id }, chevron: false, right: tick(l.id === B.location) })).join(''), { header: 'Where will you train?', footer: 'Exercises are chosen from what’s available there. Other locations still adapt automatically.' })}
    <div class="wiz-bottom"><div class="inner"><button class="btn filled" data-action="b-build">Build My Program</button></div></div>`;
}

function stepPreview() {
  const P = B.program;
  if (!P.sessions.some(s => s.blocks.length)) return `<div class="wiz-q"><h1>Nothing matched</h1><p class="t-sub">No exercises fit that focus with the equipment at ${esc(loc()?.name || 'this location')}. Try another location or focus.</p></div><button class="btn tinted" data-action="b-back">Change Setup</button>`;
  const sess = P.sessions.map((s, si) => group(
    s.blocks.map((b, i) => { const ex = getExercise(b.ex); return row({ title: esc(ex.name), sub: `${b.sets} × ${esc(rangeLabel({ ex: b.ex, min: b.min, max: b.max }))}${b.why ? ` · ${esc(b.why)}` : ''}`, action: 'b-slot', data: { s: si, i } }); }).join('')
    + row({ title: 'Add Exercise', icon: 'plus', color: 'green', action: 'b-add', data: { s: si }, chevron: false, cls: 'action' }),
    { header: `${s.title} · about ${s.minutes} min` })).join('');
  return `<div class="wiz-q"><h1>Your program</h1><p class="t-sub">${B.days} workout${B.days > 1 ? 's' : ''} a week · ${B.minutes} min · ${esc(loc()?.name || '')}. Tap any exercise to replace, move or remove it.</p></div>
    ${sess}
    ${group(`<label class="row"><span class="row-main"><input class="input" id="bName" value="${esc(B.name)}" placeholder="Program name (optional)" style="padding:0;background:none;min-height:22px" aria-label="Program name"></span></label>`
      + row({ title: 'Put on my weekly schedule', sub: 'Keeps your padel days free', right: `<input type="checkbox" class="switch" id="bSched" ${B.schedule ? 'checked' : ''} aria-label="Put on my weekly schedule">` }), { header: 'Save' })}
    <div class="btns"><button class="btn filled" data-action="b-save">Save Program</button><button class="btn plain" data-action="b-rebuild">Start Over</button></div>`;
}

function slotSheet(si, i) {
  const s = B.program.sessions[si], b = s.blocks[i], ex = getExercise(b.ex), owned = new Set(loc()?.equipment || []);
  const alts = alternativesFor(b.ex, opts(), used()).slice(0, 10);
  const altRow = r => { const miss = missingFor(r.ex.needs || [], owned); return row({ title: esc(r.ex.name), sub: miss.length ? `<span class="orange">Needs ${esc(miss.map(n => n.split('|').map(a => equipLabel(a, S.customEquipment)).join(' or ')).join(', '))}</span>` : esc(r.reasons[0] || r.ex.muscles), action: 'b-replace', data: { s: si, i, id: r.ex.id } }); };
  app.sheet(`<h2 class="sheet-title">${esc(ex.name)}</h2><p class="sheet-sub">${b.sets} × ${esc(rangeLabel({ ex: b.ex, min: b.min, max: b.max }))}${b.why ? ` · ${esc(b.why)}` : ''}</p>
    ${group(row({ title: 'Move up', icon: 'up', color: 'gray', action: 'b-move', data: { s: si, i, d: -1 }, chevron: false }) + row({ title: 'Move down', icon: 'down', color: 'gray', action: 'b-move', data: { s: si, i, d: 1 }, chevron: false }) + row({ title: 'Remove', icon: 'trash', color: 'red', action: 'b-remove', data: { s: si, i }, chevron: false, cls: 'red' }))}
    ${alts.filter(r => r.available).length ? group(alts.filter(r => r.available).map(altRow).join(''), { header: 'Replace with (best matches)' }) : ''}
    ${alts.filter(r => !r.available).length ? group(alts.filter(r => !r.available).slice(0, 4).map(altRow).join(''), { header: 'Needs other equipment' }) : ''}`);
}

function addSheet(si) {
  const owned = new Set(loc()?.equipment || []);
  const list = rankExercises(opts()).filter(r => !used().has(r.ex.id)).slice(0, 15);
  app.sheet(`<h2 class="sheet-title">Add exercise</h2><p class="sheet-sub">Best matches for your focus first.</p>
    ${group(list.map(r => { const miss = missingFor(r.ex.needs || [], owned); return row({ title: esc(r.ex.name), sub: miss.length ? `<span class="orange">Needs ${esc(miss.map(n => equipLabel(n.split('|')[0], S.customEquipment)).join(', '))}</span>` : esc(r.reasons[0] || r.ex.muscles), action: 'b-insert', data: { s: si, id: r.ex.id } }); }).join(''))}`);
}

async function save() {
  const n = document.querySelector('#bName'), sw = document.querySelector('#bSched');
  if (n) B.name = n.value.trim(); if (sw) B.schedule = sw.checked;
  const suffix = Date.now().toString(36), name = B.name || 'My program';
  const ids = [];
  B.program.sessions.filter(s => s.blocks.length).forEach((s, i) => {
    const id = `p-${suffix}${i}`;
    S.customRoutines[id] = { id, title: B.name ? `${name} · ${s.title.replace(/^[A-D] · /, '')}` : s.title, custom: true, program: name, minutes: s.minutes,
      focus: `Built for ${B.focuses.map(f => FOCUS[f].label.toLowerCase()).join(', ')}.`, blocks: s.blocks.map(({ why, ...b }, k) => ({ ...b, pri: k + 1 })) };
    ids.push(id);
  });
  setCustomRoutines(S.customRoutines);
  await app.save('customRoutines');
  if (B.schedule) { S.schedule = generateSchedule(ids.length, S.profile.padelDays || [], ids, isLegHeavy); await app.save('schedule'); }
  const count = ids.length; B = null;
  app.go('plan');
  app.toast(`Program saved · ${count} workout${count > 1 ? 's' : ''}${count && S.schedule ? ' on your schedule' : ''}`);
}

export const builder = {
  tab: 'plan',
  render() {
    if (!B) B = fresh();
    const back = B.step > 1 ? `<button class="nav-btn" data-action="b-back">${icon('chevL')}Back</button>` : `<button class="nav-btn" data-action="b-cancel">Cancel</button>`;
    const body = B.step === 1 ? stepFocus() : B.step === 2 ? stepSetup() : stepPreview();
    return `<div class="wiz-top">${back}<div class="dots">${[1, 2, 3].map(i => `<i class="${i <= B.step ? 'on' : ''}"></i>`).join('')}</div><span></span></div>${body}`;
  },
  onPick(name, value) {
    if (name === 'b-days') B.days = value; if (name === 'b-min') B.minutes = value; if (name === 'b-level') B.level = value;
  },
  actions: {
    'b-cancel'() { B = null; app.go('plan'); },
    'b-back'() { B.step = Math.max(1, B.step - 1); app.render(); },
    'b-next'() { B.step = 2; app.render(); },
    'b-focus'(el) {
      const f = el.dataset.f;
      if (B.focuses.includes(f)) B.focuses = B.focuses.filter(x => x !== f);
      else if (B.focuses.length < 3) B.focuses.push(f);
      else app.toast('Pick up to 3. Untick one first.');
      app.render({ keepScroll: true });
    },
    'b-loc'(el) { B.location = el.dataset.id; app.render({ keepScroll: true }); },
    'b-build'() { B.program = buildProgram(opts()); B.step = 3; app.render(); },
    'b-rebuild'() { B = fresh(); app.render(); },
    'b-slot'(el) { slotSheet(+el.dataset.s, +el.dataset.i); },
    'b-add'(el) { addSheet(+el.dataset.s); },
    'b-move'(el) {
      const s = B.program.sessions[+el.dataset.s], i = +el.dataset.i, j = i + +el.dataset.d;
      if (j >= 0 && j < s.blocks.length) [s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
      app.closeSheet(); app.render({ keepScroll: true });
    },
    'b-remove'(el) { const s = B.program.sessions[+el.dataset.s]; s.blocks.splice(+el.dataset.i, 1); refreshMinutes(s); app.closeSheet(); app.render({ keepScroll: true }); },
    'b-replace'(el) {
      const s = B.program.sessions[+el.dataset.s], ex = getExercise(el.dataset.id);
      s.blocks[+el.dataset.i] = { ex: ex.id, ...prescriptionFor(ex, { level: B.level, minutes: B.minutes }), why: 'Your choice' };
      refreshMinutes(s); app.closeSheet(); app.render({ keepScroll: true });
    },
    'b-insert'(el) {
      const s = B.program.sessions[+el.dataset.s], ex = getExercise(el.dataset.id);
      s.blocks.push({ ex: ex.id, ...prescriptionFor(ex, { level: B.level, minutes: B.minutes }), why: 'Your choice' });
      refreshMinutes(s); app.closeSheet(); app.render({ keepScroll: true });
    },
    'b-save'() { save(); },
  },
};
