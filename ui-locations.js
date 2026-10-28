// Locations: where you train and what equipment each place has. Fully user-editable.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row } from './ui-kit.js';
import { EQUIPMENT, EQUIPMENT_GROUPS, norm } from './domain-taxonomy.js';

const uid = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const tick = on => on ? icon('check', 'check-mark') : '';
async function saveAll() { await app.save('locations'); await app.save('activeLocation'); await app.save('customEquipment'); }

// Shared sheet: choose where you're training (used by Today too).
export function locationSheet() {
  app.sheet(`<h2 class="sheet-title">Where are you training?</h2><p class="sheet-sub">Workouts adapt to the equipment there. Other exercises stay available.</p>
    ${group(S.locations.map(l => row({ title: esc(l.name), sub: `${l.equipment.length} items`, action: 'set-location', data: { id: l.id }, chevron: false, right: tick(l.id === S.activeLocation) })).join('')
      + row({ title: 'Edit locations', icon: 'sliders', color: 'gray', to: 'locations' }))}`);
}
export async function setLocation(id) {
  S.activeLocation = id; await app.save('activeLocation'); app.closeSheet(); app.render({ keepScroll: true });
  app.toast(`Training at ${esc(app.location().name)}`);
}

function listView() {
  return `${navBar({ back: 'Settings', backTo: 'settings', title: 'Locations' })}<div style="height:12px"></div>
    ${group(S.locations.map(l => row({ title: esc(l.name), sub: `${l.equipment.length} items${l.id === S.activeLocation ? ' · training here' : ''}`, icon: 'target', color: l.id === S.activeLocation ? 'blue' : 'gray', to: `locations/${l.id}` })).join('')
      + row({ title: 'Add Location', icon: 'plus', color: 'green', action: 'add-location', chevron: false, cls: 'action' }),
      { footer: 'Workouts adapt to the equipment at the place you’re training. Exercises that need other equipment are still shown, just further down.' })}`;
}

function detailView(id) {
  const l = S.locations.find(x => x.id === id);
  if (!l) return listView();
  const owned = new Set(l.equipment);
  const groups = EQUIPMENT_GROUPS.map(([title, ids]) => group(ids.map(e => row({ title: esc(EQUIPMENT[e]), action: 'toggle-gear', data: { loc: id, gear: e }, chevron: false, right: tick(owned.has(e)) })).join(''), { header: title })).join('');
  const custom = Object.entries(S.customEquipment);
  return `${navBar({ back: 'Locations', backTo: 'locations', title: esc(l.name) })}<div style="height:12px"></div>
    ${group(`<label class="row"><span class="row-main"><input class="input" id="locName" value="${esc(l.name)}" aria-label="Location name" style="padding:0;background:none;min-height:22px"></span></label>`, { header: 'Name' })}
    ${id !== S.activeLocation ? `<button class="btn tinted" data-action="set-location" data-id="${esc(id)}" style="margin-bottom:28px">Train Here Today</button>` : ''}
    <div class="btns two" style="margin-bottom:20px"><button class="btn gray small" data-action="gear-all" data-loc="${esc(id)}">Select All</button><button class="btn gray small" data-action="gear-none" data-loc="${esc(id)}">Clear All</button></div>
    ${groups}
    ${group((custom.map(([k, v]) => row({ title: esc(v), action: 'toggle-gear', data: { loc: id, gear: k }, chevron: false, right: tick(owned.has(k)) })).join('')) + row({ title: 'Add Your Own Equipment', icon: 'plus', color: 'green', action: 'add-gear', data: { loc: id }, chevron: false, cls: 'action' }),
      { header: 'Your own equipment', footer: 'For anything not listed, like suspension straps or a foam roller.' })}
    ${S.locations.length > 1 ? group(`<button class="row danger" data-action="delete-location" data-id="${esc(id)}">Delete Location</button>`) : ''}`;
}

function promptSheet(title, placeholder, onSave) {
  app.sheet(`<h2 class="sheet-title">${esc(title)}</h2><div style="height:12px"></div>
    <input class="input" id="promptIn" placeholder="${esc(placeholder)}" maxlength="40">
    <div style="height:16px"></div><div class="btns"><button class="btn filled" id="promptOk">Add</button><button class="btn plain" data-action="close-sheet">Cancel</button></div>`, body => {
    const input = body.querySelector('#promptIn'); setTimeout(() => input.focus(), 50);
    const go = () => { const v = input.value.trim(); if (v) onSave(v); };
    body.querySelector('#promptOk').onclick = go;
    input.onkeydown = e => { if (e.key === 'Enter') go(); };
  });
}

export const locations = {
  tab: 'overview',
  render() { return S.params[0] ? detailView(S.params[0]) : listView(); },
  mounted() {
    const n = document.querySelector('#locName');
    if (n) n.onchange = async () => { const l = S.locations.find(x => x.id === S.params[0]); if (l && n.value.trim()) { l.name = n.value.trim().slice(0, 40); await saveAll(); app.render({ keepScroll: true }); } };
  },
  actions: {
    'set-location'(el) { setLocation(el.dataset.id); },
    'add-location'() {
      promptSheet('New location', 'e.g. Club gym, Hotel', async name => {
        const l = { id: uid('loc'), name, equipment: [] };
        S.locations.push(l); await saveAll(); app.closeSheet(); app.go(`locations/${l.id}`);
      });
    },
    async 'toggle-gear'(el) {
      const l = S.locations.find(x => x.id === el.dataset.loc), g = el.dataset.gear;
      l.equipment = l.equipment.includes(g) ? l.equipment.filter(x => x !== g) : [...l.equipment, g];
      await saveAll(); app.render({ keepScroll: true });
    },
    async 'gear-all'(el) { const l = S.locations.find(x => x.id === el.dataset.loc); l.equipment = [...Object.keys(EQUIPMENT), ...Object.keys(S.customEquipment)]; await saveAll(); app.render({ keepScroll: true }); },
    async 'gear-none'(el) { const l = S.locations.find(x => x.id === el.dataset.loc); l.equipment = []; await saveAll(); app.render({ keepScroll: true }); },
    'add-gear'(el) {
      promptSheet('Add equipment', 'e.g. Suspension straps', async label => {
        const existing = Object.entries({ ...EQUIPMENT, ...S.customEquipment }).find(([, v]) => norm(v) === norm(label));
        const id = existing ? existing[0] : uid('x');
        if (!existing) S.customEquipment[id] = label;
        const l = S.locations.find(x => x.id === el.dataset.loc);
        if (!l.equipment.includes(id)) l.equipment.push(id);
        await saveAll(); app.closeSheet(); app.render({ keepScroll: true });
      });
    },
    async 'delete-location'(el) {
      const l = S.locations.find(x => x.id === el.dataset.id);
      if (!(await app.confirm(`Delete “${esc(l.name)}”?`, { ok: 'Delete', danger: true }))) return;
      S.locations = S.locations.filter(x => x.id !== l.id);
      if (S.activeLocation === l.id) S.activeLocation = S.locations[0].id;
      await saveAll(); app.go('locations');
    },
  },
};
