// Shared exercise picker: search, what you can do here first (by category), the rest after.
// Used when adding to a workout in progress and when building a new workout in Plan.
import { app } from './core-app.js';
import { esc, icon, group, row } from './ui-kit.js';
import { allExercises } from './domain-catalog.js';
import { canDoWith, CATEGORIES } from './domain-taxonomy.js';

let onPick = null, used = new Set(), note = 'in this workout';

function pickList(q) {
  const owned = app.owned(), norm = s => (s || '').toLowerCase();
  const list = allExercises().filter(x => !q || norm(`${x.name} ${x.muscles} ${x.equipment}`).includes(norm(q.trim())));
  if (!list.length) return `<p class="t-sub" style="text-align:center;margin:20px 0">No exercises match “${esc(q)}”.</p>`;
  const item = x => row({ title: `${esc(x.name)}${used.has(x.id) ? ` <span class="t-foot">· ${esc(note)}</span>` : ''}`, sub: esc(x.muscles || CATEGORIES[x.category] || ''), action: 'picker-pick', data: { id: x.id }, chevron: false, right: `<span class="blue">${icon('plus')}</span>` });
  const here = list.filter(x => canDoWith(x.needs || [], owned)), other = list.filter(x => !here.includes(x));
  const byCat = xs => Object.keys(CATEGORIES).map(c => [c, xs.filter(x => x.category === c)]).filter(([, xs2]) => xs2.length);
  const groups = q ? group(here.map(item).join('')) : byCat(here).map(([c, xs]) => group(xs.map(item).join(''), { header: CATEGORIES[c] })).join('');
  return `${groups}${other.length ? group(other.map(item).join(''), { header: `Needs other equipment${app.location() ? ` than ${esc(app.location().name)}` : ''}` }) : ''}`;
}

export function exercisePicker({ title = 'Add an exercise', sub = 'Sets, reps and weight are suggested for you.', inUse = [], usedNote = 'in this workout', pick }) {
  onPick = pick; used = new Set(inUse); note = usedNote;
  app.sheet(`<h2 class="sheet-title">${esc(title)}</h2><p class="sheet-sub">${esc(sub)}</p>
    <input class="input" id="pickQ" type="search" placeholder="Search, e.g. row, calf, dumbbell" autocomplete="off" style="margin-bottom:16px">
    <div id="pickList">${pickList('')}</div>`, body => {
    const q = body.querySelector('#pickQ'), out = body.querySelector('#pickList');
    q.oninput = () => { out.innerHTML = pickList(q.value); };
  });
}

// Registered globally (main.js) so it works from any screen.
export const pickerActions = { 'picker-pick'(el) { const fn = onPick; onPick = null; app.closeSheet(); fn?.(el.dataset.id); } };
