import { app, S, DEFAULT_SETTINGS } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { esc, title, chips } from './ui-kit.js';
import { buildBackup, validateBackup, normalizeBackup, toCSV } from './domain-backup.js';
import { isoDate } from './domain-calendar.js';

let persist = '…';
const toggle = (key, label, sub) => `<label class="toggle row between"><span>${label}<small>${sub}</small></span><input type="checkbox" data-setting="${key}" ${S.settings[key] ? 'checked' : ''}></label>`;

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const settings = {
  render() {
    const notif = globalThis.Notification ? Notification.permission : 'unsupported';
    const lb = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString() : 'never';
    return `${title('Settings', 'PRIVATE · OFFLINE · NO ACCOUNT')}
      <section class="card"><label class="lbl" for="nameIn">Name</label><input class="input" id="nameIn" value="${esc(S.settings.name)}" placeholder="Optional">
        <label class="lbl">Weight unit</label>${chips('unit', ['kg', 'lb'], S.settings.unit)}
        <p class="meta">Loads are stored in kg and converted for display, so switching never corrupts history.</p></section>
      <section class="card"><h3>Workout</h3>
        ${toggle('autoRest', 'Auto-start rest timer', 'Starts when you tick a set')}
        ${toggle('sound', 'Timer sound', 'Beep when rest is over')}
        ${toggle('vibrate', 'Vibration', 'Where supported (not iOS Safari)')}
        ${toggle('readinessPrompt', 'Readiness check-in', '10-second sleep/energy/soreness check before workouts')}
        <div class="row between toggle"><span>Notifications<small>Alert when rest ends while the app is in the background · ${esc(notif)}</small></span>${notif === 'default' ? '<button class="btn small secondary" data-action="notif">Enable</button>' : ''}</div></section>
      <section class="card"><h3>Your data</h3>
        <p class="meta">Everything is stored only in this browser (IndexedDB${db.persistent ? '' : ' unavailable — using memory, data will be lost on reload'}). Persistent storage: <b>${esc(persist)}</b>. Last backup: <b>${esc(lb)}</b>. ${S.sessions.length} sessions.</p>
        ${persist !== 'granted' ? '<button class="btn secondary wide" data-action="persist">Protect data from browser clean-up</button>' : ''}
        <div class="row gap"><button class="btn primary" data-action="export-json">Export backup</button><button class="btn secondary" data-action="export-csv">Export CSV</button></div>
        <label class="btn secondary wide file-btn">Import backup (.json)<input id="importIn" type="file" accept="application/json,.json" hidden></label>
        <p class="meta">Imports accept this app’s backups and original PADEL OS backups (auto-migrated). You’ll choose merge or replace before anything changes.</p></section>
      <section class="card"><h3>Install on iPhone</h3><p>Open in Safari → Share → <b>Add to Home Screen</b>. Launch once online; afterwards it works fully offline. Installed apps also get more durable storage.</p></section>
      <section class="card"><h3>Safety</h3><p>General training information, not medical advice. Use loads you can control. Stop for sharp or worsening pain and consult a qualified professional when needed.</p></section>
      <button class="btn danger wide" data-action="reset">Erase all data on this device</button>
      <p class="fine">PADEL OS Pro · data schema v2</p>`;
  },
  async mounted() {
    const n = document.querySelector('#nameIn');
    n.onchange = async () => { S.settings.name = n.value.trim(); await app.save('settings'); app.toast('Saved'); };
    document.querySelectorAll('[data-setting]').forEach(c => c.onchange = async () => { S.settings[c.dataset.setting] = c.checked; timer.configure(S.settings); await app.save('settings'); });
    document.querySelector('#importIn').onchange = e => importFile(e.target.files[0]);
    const p = await db.persistenceStatus();
    if (p !== persist) { persist = p; if (S.route === 'settings') app.render({ keepScroll: true }); }
  },
  async onPick(name, value) { if (name === 'unit') { S.settings.unit = value; await app.save('settings'); app.toast(`Showing loads in ${value}`); app.render({ keepScroll: true }); } },
  actions: {
    async notif() { try { await Notification.requestPermission(); } catch {} app.render({ keepScroll: true }); },
    async persist() { persist = await db.requestPersistence(); app.toast(persist === 'granted' ? 'Storage protected' : 'Browser declined — install to Home Screen and back up regularly'); app.render({ keepScroll: true }); },
    async 'export-json'() {
      const meta = await db.allMeta(); delete meta.timer;
      download(`padel-os-backup-${isoDate()}.json`, JSON.stringify(buildBackup(meta, S.sessions), null, 2), 'application/json');
      S.lastBackup = Date.now(); await app.save('lastBackup'); app.render({ keepScroll: true });
    },
    'export-csv'() { download(`padel-os-sets-${isoDate()}.csv`, toCSV(S.sessions), 'text/csv'); },
    async reset() {
      if (!(await app.confirm('Erase all sessions, settings and the in-progress workout on this device?', { ok: 'Continue', danger: true }))) return;
      if (!(await app.confirm('This cannot be undone without a backup. Erase everything?', { ok: 'Erase everything', danger: true }))) return;
      await db.clearAll(); location.hash = ''; location.reload();
    },
  },
};

async function importFile(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return app.toast('That file is not valid JSON'); }
  const v = validateBackup(data);
  if (!v.ok) return app.toast(v.errors.join(' '));
  const norm = normalizeBackup(data);
  const existing = new Set(S.sessions.map(s => s.id));
  const fresh = norm.sessions.filter(s => !existing.has(s.id)).length;
  app.sheet(`<span class="eyebrow">VALID BACKUP · SCHEMA V${v.version}${v.version === 1 ? ' (WILL BE MIGRATED)' : ''}</span><h3>${norm.sessions.length} sessions found</h3>
    <p class="meta">${fresh} are new to this device. ${v.errors.map(esc).join(' ')}</p>
    <p><b>Merge</b> adds new sessions and keeps yours. <b>Replace</b> erases this device’s data first.</p>
    <div class="row gap"><button class="btn secondary" data-mode="merge">Merge</button><button class="btn danger" data-mode="replace">Replace</button></div>`, body => {
    body.querySelectorAll('[data-mode]').forEach(b => b.onclick = async () => {
      if (b.dataset.mode === 'replace') { await db.clearAll(); }
      const keep = b.dataset.mode === 'merge' ? new Set(S.sessions.map(s => s.id)) : new Set();
      await db.putSessions(norm.sessions.filter(s => !keep.has(s.id)));
      for (const k of ['settings', 'schedule', 'overrides', 'exNotes']) {
        if (norm.meta[k] == null) continue;
        if (b.dataset.mode === 'merge' && k !== 'exNotes') continue; // keep current preferences on merge
        S[k] = k === 'settings' ? { ...DEFAULT_SETTINGS, ...S.settings, ...norm.meta[k] } : k === 'exNotes' ? { ...norm.meta[k], ...S.exNotes } : norm.meta[k];
        await app.save(k);
      }
      if (b.dataset.mode === 'replace' && S.active) await app.saveActive(true);
      await app.reloadSessions(); app.closeSheet(); app.toast('Backup imported'); app.render();
    });
  });
}
