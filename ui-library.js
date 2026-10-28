// Exercise library (built-in + yours), grouped by category, plus CSV/text import.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row, seg, chips } from './ui-kit.js';
import { mname } from './ui-words.js';
import { allExercises, getExercise, setCustomExercises, setStartWeights, applyExerciseEdits, isEdited } from './domain-catalog.js';
import { setCustomRoutines } from './domain-program.js';
import { MUSCLES, MOVEMENTS, CATEGORIES, EQUIPMENT, LEVELS, WEIGHT_TYPES, canDoWith, missingFor, equipLabel, norm } from './domain-taxonomy.js';
import { rowsFrom, normalizeRow, matchExercise, buildCustomExercise, buildWorkouts, TEMPLATE_CSV, ALLOWED_VALUES, chatgptPrompt, libraryCSV } from './domain-importer.js';
import { saveFile } from './ui-backup.js';
import { exerciseMap } from './ui-bodymap.js';
import { isoDate } from './domain-calendar.js';

let showAll = false, query = '';
let IMP = null;   // { source, items, opts }
let draft = '';   // text pasted on the import page

const muscleText = ex => (ex.primary || []).map(m => mname(m)).join(' · ');
const missingText = ex => missingFor(ex.needs || [], app.owned()).map(n => n.split('|').map(a => equipLabel(a, S.customEquipment)).join(' or ')).join(', ');

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Add your own exercise
const MEASURES = [['wreps', 'Weight'], ['reps', 'Reps'], ['time', 'Time'], ['dist', 'Distance']];
const toggleChip = (attr, k, label, on) => `<button type="button" class="chip-btn ${on ? 'on' : ''}" data-${attr}="${esc(k)}" aria-pressed="${on}">${esc(label)}</button>`;
function newExerciseView() {
  const f = S.form;
  const gear = { ...EQUIPMENT, ...S.customEquipment };
  const editing = !!f.editId;
  return `${navBar({ back: 'Cancel', backTo: 'library', title: editing ? 'Edit Exercise' : 'New Exercise', right: '<button class="nav-btn right" data-action="nx-save">Save</button>' })}<div style="height:12px"></div>
    ${group(`<label class="row"><span class="row-main"><input class="input" id="nxName" value="${esc(f.name)}" placeholder="e.g. Bulgarian split squat jump" maxlength="60" style="padding:0;background:none;min-height:22px" aria-label="Exercise name"></span></label>`, { header: 'Name' })}
    ${editing ? `<p class="fine" style="margin:-8px 0 12px">Logged as ${esc(f.loggedAs)}. That can’t change, so your history stays comparable.${f.builtIn ? ' Your edits sit on top of the original; you can reset them any time.' : ''}</p>`
      : `<label class="field-l">How do you log it? <small>(weight = weight and reps)</small></label>${seg('measure', MEASURES, f.measure)}
    ${f.measure === 'wreps' ? `<label class="field-l">Weight is</label>${seg('weightType', [['total', 'Total'], ['per_hand', 'Per hand']], f.weightType)}` : ''}
    <div style="height:16px"></div>
    ${group(row({ title: 'Each side separately', sub: 'For single-arm or single-leg work', right: `<input type="checkbox" class="switch" id="nxSide" ${f.perSide ? 'checked' : ''} aria-label="Each side separately">` }))}`}
    <label class="field-l">Main muscles <small>(pick 1–3)</small></label><div class="chipset">${Object.entries(MUSCLES).map(([k, v]) => toggleChip('nx-m', k, v, f.primary.includes(k))).join('')}</div>
    <label class="field-l">Also works <small>(optional)</small></label><div class="chipset">${Object.entries(MUSCLES).filter(([k]) => !f.primary.includes(k)).map(([k, v]) => toggleChip('nx-s', k, v, f.secondary.includes(k))).join('')}</div>
    <label class="field-l">Type</label><div class="chipset">${Object.entries(CATEGORIES).map(([k, v]) => toggleChip('nx-c', k, v, f.category === k)).join('')}</div>
    <label class="field-l">Movement <small>(optional, helps pain flags and swaps)</small></label><div class="chipset">${Object.entries(MOVEMENTS).map(([k, v]) => toggleChip('nx-mv', k, v, f.movement === k)).join('')}</div>
    <label class="field-l">Equipment <small>(none = bodyweight)</small></label><div class="chipset">${Object.entries(gear).map(([k, v]) => toggleChip('nx-g', k, v, f.needs.includes(k))).join('')}</div>
    <label class="field-l" for="nxUrl">Video link <small>(optional)</small></label><input class="input" id="nxUrl" type="url" value="${esc(f.url)}" placeholder="https://…">
    <label class="field-l" for="nxCues">How to do it <small>(optional)</small></label><textarea class="input" id="nxCues" rows="2" placeholder="Cues you want to see during the set">${esc(f.cues)}</textarea>
    <div style="height:20px"></div><button class="btn filled" data-action="nx-save">${editing ? 'Save Changes' : 'Save Exercise'}</button>
    ${editing && f.builtIn && isEdited(f.editId) ? `<button class="btn plain" data-action="ex-reset" data-id="${esc(f.editId)}" style="margin-top:8px">Reset to Original</button>` : ''}`;
}
function bindNewExercise() {
  const f = S.form, rer = () => app.render({ keepScroll: true });
  const bind = (id, key, ev = 'oninput') => { const el = document.querySelector(id); if (el) el[ev] = () => { f[key] = el.value; }; };
  bind('#nxName', 'name'); bind('#nxUrl', 'url'); bind('#nxCues', 'cues');
  const side = document.querySelector('#nxSide'); if (side) side.onchange = () => { f.perSide = side.checked; };
  document.querySelectorAll('[data-nx-m]').forEach(b => b.onclick = () => { const k = b.dataset.nxM; f.primary = f.primary.includes(k) ? f.primary.filter(x => x !== k) : [...f.primary, k].slice(-3); f.secondary = f.secondary.filter(x => !f.primary.includes(x)); rer(); });
  document.querySelectorAll('[data-nx-s]').forEach(b => b.onclick = () => { const k = b.dataset.nxS; f.secondary = f.secondary.includes(k) ? f.secondary.filter(x => x !== k) : [...f.secondary, k]; rer(); });
  document.querySelectorAll('[data-nx-c]').forEach(b => b.onclick = () => { f.category = b.dataset.nxC; rer(); });
  document.querySelectorAll('[data-nx-mv]').forEach(b => b.onclick = () => { f.movement = f.movement === b.dataset.nxMv ? null : b.dataset.nxMv; rer(); });
  document.querySelectorAll('[data-nx-g]').forEach(b => b.onclick = () => { const k = b.dataset.nxG; f.needs = f.needs.includes(k) ? f.needs.filter(x => x !== k) : [...f.needs, k]; rer(); });
}
// Edit an existing exercise: library ones keep your changes separately (resettable),
// your own exercises are updated directly.
export function startEdit(id, { returnTo = 'library' } = {}) {
  const e = getExercise(id);
  if (!e) return;
  const tf = e.fields[e.fields.length - 1];
  S.form = { nx: true, editId: id, builtIn: !e.custom, name: e.name, primary: [...(e.primary || [])], secondary: [...(e.secondary || [])], category: e.category || 'lower-strength',
    movement: e.movement || null, needs: [...(e.needs || [])].map(n => n.split('|')[0]), url: e.url || '', cues: e.execute || '',
    loggedAs: `${e.fields.includes('w') ? 'weight × ' : ''}${tf === 'sec' ? 'time' : tf === 'm' ? 'distance' : 'reps'}${e.perSide ? ', each side' : ''}`, returnTo };
  app.closeSheet(); app.go('library/new');
}
async function saveEdit() {
  const f = S.form, id = f.editId, e = getExercise(id), name = (f.name || '').trim();
  if (!name) return app.toast('Give it a name');
  if (!f.primary.length) return app.toast('Pick at least one main muscle');
  const gear = { ...EQUIPMENT, ...S.customEquipment };
  // Keep "a or b" alternatives you didn't touch; otherwise use what you ticked.
  const keptAlt = (e.needs || []).filter(n => n.includes('|') && f.needs.includes(n.split('|')[0]));
  const needs = [...keptAlt, ...f.needs.filter(n => !keptAlt.some(k => k.split('|')[0] === n))];
  const ed = { name, primary: f.primary, secondary: f.secondary.filter(m => !f.primary.includes(m)), movement: f.movement || null, category: f.category, needs,
    url: (f.url || '').trim() || null, execute: (f.cues || '').trim() || e.execute || '', muscles: f.primary.map(m => MUSCLES[m]).join(' · '),
    equipment: needs.length ? needs.map(n => n.split('|').map(a => gear[a] || a).join(' or ')).join(' + ') : 'Bodyweight' };
  if (f.builtIn) { S.exerciseEdits = { ...S.exerciseEdits, [id]: ed }; await app.save('exerciseEdits'); applyExerciseEdits(S.exerciseEdits); }
  else { S.customExercises = { ...S.customExercises, [id]: { ...S.customExercises[id], ...ed } }; setCustomExercises(S.customExercises); await app.save('customExercises'); }
  app.go(f.returnTo || 'library'); app.toast(`“${esc(name)}” updated`);
}

async function saveNewExercise() {
  if (S.form.editId) return saveEdit();
  const f = S.form, name = (f.name || '').trim();
  if (!name) { document.querySelector('#nxName')?.focus(); return app.toast('Give it a name'); }
  if (!f.primary.length) return app.toast('Pick at least one main muscle');
  const same = matchExercise(name);
  if (same && same.score >= 0.9 && !(await app.confirm(`“${esc(getExercise(same.id).name)}” is already in the library. Add yours anyway?`, { ok: 'Add Anyway' }))) return;
  const item = { name, unit: f.measure === 'time' ? 'seconds' : f.measure === 'dist' ? 'metres' : 'reps', weight: null, weightType: f.measure === 'wreps' ? f.weightType : 'bodyweight',
    perSide: f.perSide, primary: f.primary, secondary: (f.secondary || []).filter(m => !f.primary.includes(m)), movement: f.movement || null, category: f.category, needs: f.needs, level: 'intermediate',
    cues: (f.cues || '').trim(), notes: '', url: (f.url || '').trim() || null, sets: null, min: null, max: null, rest: null };
  const ex = buildCustomExercise(item, { customEquipment: S.customEquipment });
  S.customExercises = { ...S.customExercises, [ex.id]: ex }; setCustomExercises(S.customExercises); await app.save('customExercises');
  app.go('library'); app.toast(`“${esc(ex.name)}” added. Find it under ${esc(CATEGORIES[ex.category] || 'your exercises')}.`);
}

// ── Library list
function libraryView() {
  const owned = app.owned(), loc = app.location();
  const q = norm(query);
  const all = allExercises().filter(e => !q || norm(e.name).includes(q) || norm(muscleText(e)).includes(q));
  const avail = e => canDoWith(e.needs || [], owned);
  const byCat = Object.keys(CATEGORIES).map(c => [c, all.filter(e => (e.category || 'prevention') === c)]).filter(([, l]) => l.length);
  const hiddenTotal = all.filter(e => !avail(e)).length;
  const exRow = e => row({ title: `${esc(e.name)}${e.custom ? ' <span class="t-foot blue">· Yours</span>' : ''}`, sub: avail(e) ? esc(muscleText(e) || e.muscles) : `<span class="orange">Needs ${esc(missingText(e))}</span>`, action: 'ex-sheet', data: { id: e.id } });
  const groups = byCat.map(([c, list]) => {
    const ok = list.filter(avail), no = list.filter(e => !avail(e));
    const rows = [...ok, ...(showAll ? no : [])].map(exRow).join('');
    if (!rows) return group(row({ title: `<span class="muted">${no.length} need other equipment</span>`, action: 'lib-toggle', chevron: false }), { header: CATEGORIES[c] });
    return group(rows, { header: CATEGORIES[c], footer: !showAll && no.length ? `${no.length} more need other equipment.` : '' });
  }).join('');
  return `${navBar({ back: 'Plan', backTo: 'plan', title: 'Exercises' })}
    <h1 class="t-large" style="padding:8px 4px 2px">Exercises</h1>
    <p class="t-sub" style="padding:0 4px 16px">${allExercises().length} exercises · training at <button class="link" data-action="loc-sheet">${esc(loc?.name || 'anywhere')}</button></p>
    <input class="input" id="libSearch" type="search" placeholder="Search by name or muscle" value="${esc(query)}" aria-label="Search exercises" style="margin-bottom:12px">
    ${seg('lib-filter', [['here', `Can do here`], ['all', `Show all (${hiddenTotal} more)`]], showAll ? 'all' : 'here')}
    <div style="height:20px"></div>
    ${group(row({ title: 'Add Your Own Exercise', sub: 'Name it, say what it works and how you log it', icon: 'plus', color: 'green', action: 'nx-start' })
      + row({ title: 'Import exercises', sub: 'From a CSV file or a pasted list', icon: 'download', color: 'blue', to: 'library/import' })
      + row({ title: 'Export library as CSV', sub: 'Give it to ChatGPT so it reuses your exercise names', icon: 'share', color: 'teal', action: 'lib-export' }))}
    ${groups || '<p class="t-sub" style="text-align:center;padding:24px">No exercises match.</p>'}`;
}

function exerciseSheet(id) {
  const e = getExercise(id);
  if (!e) return;
  const owned = app.owned(), miss = missingFor(e.needs || [], owned);
  const info = [
    ['Main muscles', muscleText(e) || '—'],
    ['Also works', (e.secondary || []).map(m => mname(m)).join(' · ') || '—'],
    ['Movement', MOVEMENTS[e.movement] || '—'], ['Category', CATEGORIES[e.category] || '—'], ['Level', LEVELS[e.level] || '—'],
    ['Equipment', (e.needs || []).length ? e.needs.map(n => n.split('|').map(a => equipLabel(a, S.customEquipment)).join(' or ')).join(' + ') : 'None'],
    ['Weight', WEIGHT_TYPES[e.weightType] || '—'],
  ];
  app.sheet(`<h2 class="sheet-title">${esc(e.name)}</h2><p class="sheet-sub">${miss.length ? `<span class="orange">Not available at ${esc(app.location()?.name || 'this location')}: needs ${esc(missingText(e))}</span>` : `Available at ${esc(app.location()?.name || 'this location')}`}</p>
    <div class="card" style="margin-bottom:16px">${exerciseMap(e)}<div class="bm-legend"><span><i class="lg main"></i>Main</span><span><i class="lg sec"></i>Secondary</span></div></div>
    ${group(info.map(([k, v]) => row({ title: k, value: esc(v) })).join(''))}
    ${e.execute ? group(row({ title: esc(e.execute) }), { header: 'How to do it' }) : ''}
    <div class="btns">${e.url ? `<a class="btn tinted" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${icon('play')}Watch Video</a>` : `<a class="btn tinted" href="https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + ' exercise form')}" target="_blank" rel="noopener noreferrer">${icon('play')}Find a Video</a>`}
    <button class="btn gray" data-action="ex-edit" data-id="${esc(e.id)}">Edit Exercise</button>
    ${e.custom ? `<button class="btn destructive" data-action="delete-custom" data-id="${esc(e.id)}">Delete Exercise</button>` : ''}</div>
    ${isEdited(e.id) ? '<p class="fine" style="text-align:center">You edited this exercise. Edit it to reset to the original.</p>' : ''}`);
}

// ── Import page
function importView() {
  return `${navBar({ back: 'Exercises', backTo: 'library', title: 'Import' })}
    <h1 class="t-large" style="padding:8px 4px 2px">Import</h1><p class="t-sub" style="padding:0 4px 20px">Add exercises from a plan, with sets, reps, starting weights, muscles and video links.</p>
    ${group(row({ title: 'Download my exercise library', sub: 'Attach it in ChatGPT so it reuses your names: no duplicates', icon: 'share', color: 'teal', action: 'lib-export' })
      + row({ title: 'Copy prompt for ChatGPT', sub: 'Paste it with your plan; ChatGPT replies in the right format', icon: 'note', color: 'green', action: 'copy-prompt' })
      + row({ title: 'Download CSV template', sub: 'Open in Numbers, Excel or Google Sheets', icon: 'download', color: 'blue', action: 'dl-template' })
      + row({ title: 'Allowed values', sub: 'Muscles, movements, categories, equipment', icon: 'info', color: 'gray', action: 'allowed-sheet' }), { header: '1 · Get the format' })}
    ${group(`<label class="row has-icon" style="cursor:pointer"><span class="tile indigo">${icon('share')}</span><span class="row-main"><span class="row-title">Choose a CSV file</span></span><svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg><input id="csvIn" type="file" accept=".csv,text/csv,text/plain" hidden></label>`, { header: '2 · Upload a file…' })}
    <h2 class="grp-h">…or paste a list or CSV</h2>
    <textarea class="input" id="pasteIn" rows="7" placeholder="Bulgarian split squat 3x8-10 @ 20kg per hand&#10;Copenhagen plank 3 x 30s&#10;&#10;…or paste CSV rows including the header">${esc(draft)}</textarea>
    <div style="height:16px"></div><button class="btn filled" data-action="preview-import">Preview</button>
    <p class="fine">Nothing is saved until you confirm on the next screen.</p>`;
}

function startReview(text) {
  const { source, rows } = rowsFrom(text);
  if (!rows.length) return app.toast('No exercises found in that text');
  const items = rows.map((r, i) => normalizeRow(r, i, { customEquipment: S.customEquipment })).filter(it => it.name);
  for (const it of items) { const m = matchExercise(it.name); it.match = m?.id || null; it.matchScore = m?.score || 0; it.useMatch = !!m && m.score >= 0.8; it.skip = false; }
  IMP = { source, items, createWorkouts: true, addGear: true };
  app.go('library/review');
}

const status = it => it.skip ? ['Skipped', 'muted'] : it.useMatch ? ['Library', 'blue'] : (it.warn.length || !it.primary.length || it.newEquipment.length) ? ['Check', 'orange'] : ['New', 'green'];
function reviewView() {
  if (!IMP) return importView();
  const items = IMP.items, active = items.filter(i => !i.skip);
  const lib = active.filter(i => i.useMatch).length, needs = active.filter(i => status(i)[0] === 'Check').length;
  const workouts = [...new Set(active.map(i => i.workout).filter(Boolean))];
  const newGear = [...new Set(active.filter(i => !i.useMatch).flatMap(i => i.newEquipment))];
  const line = it => {
    const ex = it.useMatch ? getExercise(it.match) : null;
    const reps = it.min != null ? `${it.sets} × ${it.min}${it.max !== it.min ? `–${it.max}` : ''}${it.unit === 'seconds' ? 's' : it.unit === 'metres' ? 'm' : ''}` : `${it.sets} sets`;
    const w = it.weight != null ? ` · ${it.weight} kg${it.weightType === 'per_hand' ? ' per hand' : ''}` : '';
    const [label, color] = status(it);
    return row({ title: esc(it.name), sub: `${reps}${w}${ex ? ` · as “${esc(ex.name)}”` : it.primary.length ? ` · ${esc(it.primary.map(m => MUSCLES[m]).join(', '))}` : ''}`, action: 'edit-item', data: { key: it.key }, right: `<span class="t-foot ${color}" style="font-weight:600">${label}</span>` });
  };
  return `${navBar({ back: 'Import', backAction: 'back-import', title: 'Review' })}
    <h1 class="t-title" style="padding:8px 4px 4px">${active.length} exercise${active.length === 1 ? '' : 's'}</h1>
    <p class="t-sub" style="padding:0 4px 20px">${lib} match your library · ${active.length - lib} new${needs ? ` · <span class="orange">${needs} to check</span>` : ''}. Tap any row to change it.</p>
    ${group(items.map(line).join(''), { footer: '“Library” keeps that exercise’s history and progress. “Check” means a muscle, unit or equipment needs a look.' })}
    ${group((workouts.length ? row({ title: `Create ${workouts.length} workout${workouts.length > 1 ? 's' : ''}`, sub: esc(workouts.join(', ')), right: `<input type="checkbox" class="switch" id="optWorkouts" ${IMP.createWorkouts ? 'checked' : ''} aria-label="Create workouts">` }) : '')
      + (newGear.length ? row({ title: `Add ${newGear.length} new equipment to ${esc(app.location()?.name || 'your location')}`, sub: esc(newGear.join(', ')), right: `<input type="checkbox" class="switch" id="optGear" ${IMP.addGear ? 'checked' : ''} aria-label="Add new equipment">` }) : ''), { header: 'Options' })}
    <button class="btn filled" data-action="commit-import" ${active.length ? '' : 'disabled'}>Import ${active.length} Exercise${active.length === 1 ? '' : 's'}</button>`;
}

function itemSheet(key) {
  const it = IMP.items.find(i => i.key === key);
  const m = it.match ? getExercise(it.match) : null;
  const pickMany = (name, ids, labels) => `<div class="chipset">${Object.entries(labels).map(([k, v]) => `<button type="button" class="chip-btn ${ids.includes(k) ? 'on' : ''}" data-multi="${name}" data-v="${k}" aria-pressed="${ids.includes(k)}">${esc(v)}</button>`).join('')}</div>`;
  const select = (id, labels, val) => `<select class="input" id="${id}"><option value="">—</option>${Object.entries(labels).map(([k, v]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  const draw = () => `<h2 class="sheet-title">Edit exercise</h2><div style="height:8px"></div>
    ${m ? `<label class="field-l">Is this “${esc(m.name)}” from the library?</label>${seg('use-match', [['yes', 'Yes, use it'], ['no', 'No, it’s new']], it.useMatch ? 'yes' : 'no')}` : ''}
    <label class="field-l" for="iName">Name</label><input class="input" id="iName" value="${esc(it.name)}">
    <div class="grid2"><div><label class="field-l" for="iSets">Sets</label><input class="input" id="iSets" type="number" inputmode="numeric" value="${it.sets}"></div>
      <div><label class="field-l" for="iRest">Rest (s)</label><input class="input" id="iRest" type="number" inputmode="numeric" value="${it.rest ?? ''}" placeholder="90"></div>
      <div><label class="field-l" for="iMin">Fewest</label><input class="input" id="iMin" type="number" inputmode="numeric" value="${it.min ?? ''}"></div>
      <div><label class="field-l" for="iMax">Most</label><input class="input" id="iMax" type="number" inputmode="numeric" value="${it.max ?? ''}"></div></div>
    <label class="field-l">Counted in</label>${seg('i-unit', [['reps', 'Reps'], ['seconds', 'Seconds'], ['metres', 'Metres']], it.unit || 'reps')}
    <div class="grid2"><div><label class="field-l" for="iW">Weight (kg)</label><input class="input" id="iW" type="number" inputmode="decimal" step="any" value="${it.weight ?? ''}"></div>
      <div><label class="field-l">Per side</label>${seg('i-side', [['yes', 'Yes'], ['no', 'No']], it.perSide ? 'yes' : 'no')}</div></div>
    <label class="field-l">Weight is</label>${seg('i-wt', Object.entries(WEIGHT_TYPES), it.weightType || (it.weight ? 'total' : 'bodyweight'))}
    ${it.useMatch ? '' : `<label class="field-l">Main muscles</label>${pickMany('primary', it.primary, MUSCLES)}
    <label class="field-l">Also works</label>${pickMany('secondary', it.secondary, MUSCLES)}
    <label class="field-l" for="iMove">Movement</label>${select('iMove', MOVEMENTS, it.movement)}
    <label class="field-l" for="iCat">Category</label>${select('iCat', CATEGORIES, it.category)}
    <label class="field-l">Equipment</label>${pickMany('needs', it.needs, { ...EQUIPMENT, ...S.customEquipment })}
    ${it.newEquipment.length ? `<p class="t-foot" style="margin:8px 4px">Not in your list yet: ${esc(it.newEquipment.join(', '))}</p>` : ''}
    <label class="field-l" for="iUrl">Video link</label><input class="input" id="iUrl" type="url" value="${esc(it.url)}" placeholder="https://">
    <label class="field-l" for="iCues">How to do it</label><textarea class="input" id="iCues" rows="2">${esc(it.cues)}</textarea>`}
    <label class="field-l" for="iWorkout">Workout</label><input class="input" id="iWorkout" value="${esc(it.workout)}" placeholder="Optional, e.g. Legs A">
    ${it.warn.length ? `<p class="t-foot orange" style="margin:12px 4px 0">${it.warn.map(esc).join('<br>')}</p>` : ''}
    <div style="height:20px"></div><div class="btns"><button class="btn filled" id="iDone">Done</button><button class="btn destructive" id="iSkip">${it.skip ? 'Include in Import' : 'Leave Out'}</button></div>`;
  const read = b => {
    const v = id => b.querySelector(id)?.value;
    const n = id => { const x = parseFloat(v(id)); return Number.isFinite(x) ? x : null; };
    it.name = (v('#iName') || it.name).trim(); it.sets = Math.max(1, Math.round(n('#iSets') ?? it.sets)); it.rest = n('#iRest');
    it.min = n('#iMin'); it.max = n('#iMax') ?? it.min; if (it.min != null && it.max < it.min) [it.min, it.max] = [it.max, it.min];
    it.weight = n('#iW'); it.workout = (v('#iWorkout') || '').trim();
    if (!it.useMatch) { it.movement = v('#iMove') || null; it.category = v('#iCat') || null; const u = (v('#iUrl') || '').trim(); it.url = /^https?:\/\//i.test(u) ? u : ''; it.cues = (v('#iCues') || '').trim(); }
    // Fixing a field clears the matching warning.
    it.warn = it.warn.filter(w => !(/muscle/i.test(w) && it.primary.length) && !(/movement/i.test(w) && it.movement) && !(/category/i.test(w) && it.category));
  };
  const mount = b => {
    b.querySelectorAll('[data-multi]').forEach(btn => btn.onclick = () => { read(b); const f = btn.dataset.multi, k = btn.dataset.v; it[f] = it[f].includes(k) ? it[f].filter(x => x !== k) : [...it[f], k]; app.sheet(draw(), mount); });
    b.querySelector('#iDone').onclick = () => { read(b); app.closeSheet(); app.render({ keepScroll: true }); };
    b.querySelector('#iSkip').onclick = () => { it.skip = !it.skip; app.closeSheet(); app.render({ keepScroll: true }); };
  };
  app.onPick = (name, value) => {
    const b = document.querySelector('#sheetBody'); read(b);
    if (name === 'use-match') it.useMatch = value === 'yes';
    if (name === 'i-unit') it.unit = value;
    if (name === 'i-side') it.perSide = value === 'yes';
    if (name === 'i-wt') it.weightType = value;
    app.sheet(draw(), mount);
  };
  app.sheet(draw(), mount);
}

async function commit() {
  const wOpt = document.querySelector('#optWorkouts'), gOpt = document.querySelector('#optGear');
  if (wOpt) IMP.createWorkouts = wOpt.checked; if (gOpt) IMP.addGear = gOpt.checked;
  const items = IMP.items.filter(i => !i.skip);
  const suffix = Date.now().toString(36);
  // New equipment named in the import becomes your own equipment.
  const loc = app.location();
  for (const it of items) for (const label of (it.useMatch ? [] : it.newEquipment)) {
    let id = Object.entries({ ...EQUIPMENT, ...S.customEquipment }).find(([, l]) => norm(l) === norm(label))?.[0];
    if (!id) { id = `x-${norm(label).replace(/ /g, '-')}-${suffix}`; S.customEquipment[id] = label; }
    if (!it.needs.includes(id)) it.needs.push(id);
    if (IMP.addGear && loc && !loc.equipment.includes(id)) loc.equipment.push(id);
  }
  const ids = new Map();
  S.startWeights ||= {};
  items.forEach((it, i) => {
    if (it.useMatch && it.match) { ids.set(it.key, it.match); if (it.weight != null && getExercise(it.match) && !getExercise(it.match).custom) S.startWeights[it.match] = it.weight; return; }
    const ex = buildCustomExercise(it, { customEquipment: S.customEquipment, idSuffix: `${suffix}${i}` });
    S.customExercises[ex.id] = ex; ids.set(it.key, ex.id);
  });
  setCustomExercises(S.customExercises); setStartWeights(S.startWeights);
  let made = 0;
  if (IMP.createWorkouts) for (const w of buildWorkouts(items, it => ids.get(it.key), suffix)) { S.customRoutines[w.id] = w; made++; }
  setCustomRoutines(S.customRoutines);
  for (const k of ['customExercises', 'customRoutines', 'customEquipment', 'locations', 'startWeights']) await app.save(k);
  const n = items.length; IMP = null; draft = '';
  app.go(made ? 'plan' : 'library');
  app.toast(`Imported ${n} exercise${n === 1 ? '' : 's'}${made ? ` and ${made} workout${made > 1 ? 's' : ''}` : ''}`);
}

export const library = {
  tab: 'plan',
  render() { const p = S.params[0]; return p === 'import' ? importView() : p === 'review' ? reviewView() : p === 'new' && S.form?.nx ? newExerciseView() : libraryView(); },
  mounted() {
    if (S.params[0] === 'new') bindNewExercise();
    const s = document.querySelector('#libSearch');
    if (s) s.oninput = () => { query = s.value; clearTimeout(this._q); this._q = setTimeout(() => { app.render({ keepScroll: true }); const el = document.querySelector('#libSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250); };
    const p = document.querySelector('#pasteIn'); if (p) p.oninput = () => { draft = p.value; };
    const f = document.querySelector('#csvIn'); if (f) f.onchange = async () => { const file = f.files[0]; if (!file) return; if (file.size > 2e6) return app.toast('That file is too large'); startReview(await file.text()); };
  },
  onPick(name, value) { if (name === 'lib-filter') { showAll = value === 'all'; app.render({ keepScroll: true }); } if (name === 'measure') app.render({ keepScroll: true }); },
  actions: {
    'nx-start'() { S.form = { nx: true, name: '', measure: 'wreps', weightType: 'total', perSide: false, primary: [], secondary: [], category: 'lower-strength', movement: null, needs: [], url: '', cues: '' }; app.go('library/new'); },
    'ex-edit'(el) { startEdit(el.dataset.id); },
    async 'ex-reset'(el) {
      if (!(await app.confirm('Reset this exercise to the original?', { ok: 'Reset' }))) return;
      const next = { ...S.exerciseEdits }; delete next[el.dataset.id]; S.exerciseEdits = next; await app.save('exerciseEdits'); applyExerciseEdits(S.exerciseEdits);
      app.go('library'); app.toast('Back to the original');
    },
    'nx-save'() { saveNewExercise(); },
    async 'lib-export'() { await saveFile(`padel-os-exercise-library-${isoDate()}.csv`, libraryCSV(allExercises(), { customEquipment: S.customEquipment }), 'text/csv'); },
    'lib-toggle'() { showAll = !showAll; app.render({ keepScroll: true }); },
    'ex-sheet'(el) { exerciseSheet(el.dataset.id); },
    async 'delete-custom'(el) {
      const ex = getExercise(el.dataset.id);
      const inUse = Object.values(S.customRoutines).filter(r => r.blocks.some(b => b.ex === ex.id));
      if (!(await app.confirm(`Delete “${esc(ex.name)}”?${inUse.length ? ` It’s used in ${inUse.length} workout${inUse.length > 1 ? 's' : ''}, which will lose it.` : ''} Logged history stays.`, { ok: 'Delete', danger: true }))) return;
      delete S.customExercises[ex.id];
      for (const r of inUse) r.blocks = r.blocks.filter(b => b.ex !== ex.id);
      setCustomExercises(S.customExercises); setCustomRoutines(S.customRoutines);
      await app.save('customExercises'); await app.save('customRoutines'); app.render({ keepScroll: true });
    },
    async 'copy-prompt'() {
      const text = chatgptPrompt();
      try { await navigator.clipboard.writeText(text); app.toast('Prompt copied. Paste it into ChatGPT with your plan.'); }
      catch { app.sheet(`<h2 class="sheet-title">Copy this prompt</h2><p class="sheet-sub">Select all and copy, then paste into ChatGPT with your plan.</p><textarea class="input" rows="12" readonly>${esc(text)}</textarea>`); }
    },
    'dl-template'() { download('padel-os-import-template.csv', TEMPLATE_CSV, 'text/csv'); },
    'allowed-sheet'() {
      app.sheet(`<h2 class="sheet-title">Allowed values</h2><p class="sheet-sub">Use these words in the CSV. Close matches like “glute” or “DB” are understood too.</p>
        ${Object.entries(ALLOWED_VALUES).filter(([k]) => k !== 'secondary_muscles').map(([k, v]) => group(row({ title: `<span class="t-sub" style="color:var(--label)">${esc(v.join(', '))}</span>` }), { header: k.replace('_', ' ') })).join('')}`);
    },
    'preview-import'() { const t = document.querySelector('#pasteIn')?.value || draft; if (!t.trim()) return app.toast('Paste a list or choose a file first'); draft = t; startReview(t); },
    'back-import'() { app.go('library/import'); },
    'edit-item'(el) { itemSheet(el.dataset.key); },
    'commit-import'() { commit(); },
    'loc-sheet'() { import('./ui-locations.js').then(m => m.locationSheet()); },
  },
};

export { chips };
