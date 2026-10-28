// Settings, laid out like iOS Settings: grouped rows, switches, values.
import { app, S, DEFAULT_SETTINGS, applyTheme } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { esc, icon, navBar, group, row, seg } from './ui-kit.js';
import { buildBackup, validateBackup, normalizeBackup, toCSV } from './domain-backup.js';
import { isoDate } from './domain-calendar.js';
import { EQUIPMENT } from './domain-personalize.js';
import { setCustomExercises, setStartWeights } from './domain-catalog.js';
import { setCustomRoutines } from './domain-program.js';

let persist = '…';
const sw = (key, checked, label) => `<input type="checkbox" class="switch" data-setting="${key}" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const settings = {
  tab: 'overview',
  render() {
    const notif = globalThis.Notification ? Notification.permission : 'unsupported';
    const lb = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Never';
    return `${navBar({ back: 'Overview', backTo: 'overview', title: 'Settings' })}
      <div style="height:12px"></div>
      ${group(row({ title: '<input class="input" id="nameIn" value="' + esc(S.settings.name) + '" placeholder="Your name" style="padding:0;background:none;min-height:22px" aria-label="Your name">', icon: 'person', color: 'gray' }), { footer: 'Optional. Shown on Today.' })}
      ${group(row({ title: 'Your plan', sub: `${esc(EQUIPMENT[S.profile.equipment])} · ${S.profile.minutes} min · ${S.profile.days}× a week`, icon: 'sliders', color: 'blue', to: 'welcome' })
        + row({ title: 'Locations & equipment', sub: `Training at ${esc(app.location()?.name || '—')} · ${S.locations.length} location${S.locations.length === 1 ? '' : 's'}`, icon: 'target', color: 'teal', to: 'locations' })
        + row({ title: 'Exercise library', sub: 'Browse and import exercises', icon: 'dumbbell', color: 'gray', to: 'library' })
        + row({ title: 'Simple mode', sub: 'Plain words instead of training terms', icon: 'info', color: 'indigo', right: `<input type="checkbox" class="switch" id="simpleIn" ${S.profile.simple !== false ? 'checked' : ''} aria-label="Simple mode">` }), { header: 'Training' })}
      ${group(row({ title: 'Start rest timer automatically', icon: 'clock', color: 'orange', right: sw('autoRest', S.settings.autoRest, 'Start rest timer automatically') })
        + row({ title: 'Sounds', icon: 'speaker', color: 'pink', right: sw('sound', S.settings.sound, 'Sounds') })
        + row({ title: 'Vibration', icon: 'phone', color: 'gray', right: sw('vibrate', S.settings.vibrate, 'Vibration') })
        + row({ title: 'Check-in before workouts', icon: 'heart', color: 'red', right: sw('readinessPrompt', S.settings.readinessPrompt, 'Check-in before workouts') })
        + row({ title: 'Adapt workouts to recovery', sub: 'Lighter when tired, a bit more when fresh', icon: 'sliders', color: 'green', right: sw('adaptive', S.settings.adaptive !== false, 'Adapt workouts to recovery') })
        + (notif === 'default' ? row({ title: 'Allow notifications', sub: 'Get told when rest is over', icon: 'bell', color: 'red', action: 'notif' }) : ''), { header: 'During workouts' })}
      <section class="grp"><h2 class="grp-h">Weight unit</h2>${seg('unit', [['kg', 'Kilograms'], ['lb', 'Pounds']], S.settings.unit)}</section>
      <section class="grp"><h2 class="grp-h">Appearance</h2>${seg('appearance', [['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], S.settings.appearance || 'system')}</section>
      ${group(row({ title: 'Back up now', sub: `Last backup: ${esc(lb)}`, icon: 'download', color: 'blue', action: 'export-json' })
        + row({ title: 'Export for spreadsheets', sub: 'CSV file of every set', icon: 'share', color: 'green', action: 'export-csv' })
        + `<label class="row has-icon" style="cursor:pointer"><span class="tile teal">${icon('plus')}</span><span class="row-main"><span class="row-title">Restore from backup</span></span><svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg><input id="importIn" type="file" accept="application/json,.json" hidden></label>`
        + (persist !== 'granted' ? row({ title: 'Protect my data', sub: 'Ask the browser not to clear it', icon: 'shield', color: 'indigo', action: 'persist' }) : ''),
        { header: 'Your data', footer: `Everything stays on this device. Nothing is uploaded.${db.persistent ? '' : ' <b class="red">Storage is unavailable, so data won’t be kept.</b>'}` })}
      ${group(row({ title: 'Add to Home Screen', sub: 'In Safari, tap Share, then Add to Home Screen. It then works offline.', icon: 'phone', color: 'gray' })
        + row({ title: 'Health notice', sub: 'General training guidance, not medical advice. Stop if you feel sharp or worsening pain.', icon: 'heart', color: 'red' }), { header: 'About' })}
      ${group(`<button class="row danger" data-action="reset">Erase All Data</button>`)}
      <p class="fine">PADEL OS · ${S.sessions.length} sessions saved</p>`;
  },
  async mounted() {
    const n = document.querySelector('#nameIn');
    n.onchange = async () => { S.settings.name = n.value.trim(); await app.save('settings'); };
    document.querySelectorAll('[data-setting]').forEach(c => c.onchange = async () => { S.settings[c.dataset.setting] = c.checked; timer.configure(S.settings); await app.save('settings'); });
    document.querySelector('#simpleIn').onchange = async e => { S.profile.simple = e.target.checked; await app.save('profile'); };
    document.querySelector('#importIn').onchange = e => importFile(e.target.files[0]);
    const p = await db.persistenceStatus();
    if (p !== persist) { persist = p; if (S.route === 'settings') app.render({ keepScroll: true }); }
  },
  async onPick(name, value) {
    if (name === 'unit') { S.settings.unit = value; await app.save('settings'); }
    if (name === 'appearance') { S.settings.appearance = value; applyTheme(); await app.save('settings'); }
  },
  actions: {
    async notif() { try { await Notification.requestPermission(); } catch {} app.render({ keepScroll: true }); },
    async persist() { persist = await db.requestPersistence(); app.toast(persist === 'granted' ? 'Your data is protected' : 'Not allowed. Add to Home Screen and back up regularly.'); app.render({ keepScroll: true }); },
    async 'export-json'() {
      const meta = await db.allMeta(); delete meta.timer;
      download(`padel-os-backup-${isoDate()}.json`, JSON.stringify(buildBackup(meta, S.sessions), null, 2), 'application/json');
      S.lastBackup = Date.now(); await app.save('lastBackup'); app.render({ keepScroll: true });
    },
    'export-csv'() { download(`padel-os-sets-${isoDate()}.csv`, toCSV(S.sessions), 'text/csv'); },
    async reset() {
      if (!(await app.confirm('Erase all workouts, matches and settings on this device?', { ok: 'Continue', danger: true }))) return;
      if (!(await app.confirm('This can’t be undone without a backup. Erase everything?', { ok: 'Erase Everything', danger: true }))) return;
      await db.clearAll(); location.hash = ''; location.reload();
    },
  },
};

async function importFile(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return app.toast('That file isn’t a backup'); }
  const v = validateBackup(data);
  if (!v.ok) return app.toast(v.errors.join(' '));
  const norm = normalizeBackup(data);
  const existing = new Set(S.sessions.map(s => s.id));
  const fresh = norm.sessions.filter(s => !existing.has(s.id)).length;
  app.sheet(`<h2 class="sheet-title">Restore backup</h2><p class="sheet-sub">${norm.sessions.length} sessions found, ${fresh} new to this device.${v.version === 1 ? ' It’s from the original PADEL OS and will be converted.' : ''} ${v.errors.map(esc).join(' ')}</p>
    ${group(row({ title: 'Add to what’s here', sub: 'Keeps your current data and settings', action: 'noop', data: { mode: 'merge' }, chevron: false }).replace('data-action="noop"', '')
      + row({ title: 'Replace everything', sub: 'Erases this device first', action: 'noop', data: { mode: 'replace' }, chevron: false, cls: 'red' }).replace('data-action="noop"', ''))}
    <button class="btn gray" data-action="close-sheet">Cancel</button>`, body => {
    body.querySelectorAll('[data-mode]').forEach(b => b.onclick = async () => {
      if (b.dataset.mode === 'replace') { await db.clearAll(); }
      const keep = b.dataset.mode === 'merge' ? new Set(S.sessions.map(s => s.id)) : new Set();
      await db.putSessions(norm.sessions.filter(s => !keep.has(s.id)));
      for (const k of ['settings', 'schedule', 'overrides', 'exNotes', 'profile', 'locations', 'activeLocation', 'customEquipment', 'customExercises', 'customRoutines', 'startWeights', 'recoveryCal']) {
        if (norm.meta[k] == null) continue;
        const additive = ['exNotes', 'customEquipment', 'customExercises', 'customRoutines', 'startWeights'];
        if (b.dataset.mode === 'merge' && !additive.includes(k)) continue; // keep current preferences on merge
        S[k] = k === 'settings' ? { ...DEFAULT_SETTINGS, ...S.settings, ...norm.meta[k] } : additive.includes(k) && b.dataset.mode === 'merge' ? { ...norm.meta[k], ...S[k] } : norm.meta[k];
        await app.save(k);
      }
      if (b.dataset.mode === 'replace' && S.active) await app.saveActive(true);
      applyTheme(); setCustomExercises(S.customExercises); setCustomRoutines(S.customRoutines); setStartWeights(S.startWeights);
      await app.reloadSessions(); app.closeSheet(); app.toast('Backup restored'); app.render();
    });
  });
}
