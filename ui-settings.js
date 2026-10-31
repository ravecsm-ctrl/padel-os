// Settings, laid out like iOS Settings: grouped rows, switches, values.
import { app, S, DEFAULT_SETTINGS, applyTheme } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { esc, icon, navBar, group, row, seg } from './ui-kit.js';
import { toCSV } from './domain-backup.js';
import { saveBackup, saveFile, restoreFromData, contents } from './ui-backup.js';
import * as cloud from './core-cloud.js';
import { cloudRows, cloudActions } from './ui-cloudui.js';
import { isoDate } from './domain-calendar.js';
import { EQUIPMENT } from './domain-personalize.js';
import { bodySummary } from './ui-body.js';
import { ADJUST, ADJUST_HINT, adjustOf, tuned, habitSummary } from './domain-habits.js';

let persist = '…';
const sw = (key, checked, label) => `<input type="checkbox" class="switch" data-setting="${key}" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;


export const settings = {
  tab: 'today',
  render() {
    const notif = globalThis.Notification ? Notification.permission : 'unsupported';
    const lb = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Never';
    return `${navBar({ back: 'Back', backAction: 'nav-back', title: 'You' })}
      <div style="height:12px"></div>
      ${group(row({ title: '<input class="input" id="nameIn" value="' + esc(S.settings.name) + '" placeholder="Your name" style="padding:0;background:none;min-height:22px" aria-label="Your name">', icon: 'person', color: 'gray' }), { footer: 'Optional. Shown on Today.' })}
      ${group(row({ title: 'Your setup', sub: `${esc(EQUIPMENT[S.profile.equipment])} · ${S.profile.minutes} min · ${S.profile.days}× a week`, icon: 'sliders', color: 'blue', to: 'welcome' })
        + row({ title: 'Locations & equipment', sub: `Training at ${esc(app.location()?.name || '—')} · ${S.locations.length} location${S.locations.length === 1 ? '' : 's'}`, icon: 'target', color: 'teal', to: 'locations' })
        + row({ title: 'Body weight & measurements', sub: esc(bodySummary()), icon: 'person', color: 'gray', to: 'body' })
        + row({ title: 'How your plan adapts', icon: 'info', color: 'blue', action: 'how-sheet' })
        + row({ title: 'Simple mode', sub: 'Plain words instead of training terms', icon: 'info', color: 'indigo', right: `<input type="checkbox" class="switch" id="simpleIn" ${S.profile.simple !== false ? 'checked' : ''} aria-label="Simple mode">` }), { header: 'Your plan' })}
      <section class="grp"><h2 class="grp-h">How much the app changes your day</h2>${seg('adjust', Object.entries(ADJUST), adjustOf(S.settings))}<p class="grp-f">${esc(ADJUST_HINT[adjustOf(S.settings)])}${adjustOf(S.settings) === 'balanced' && (tuned(S.settings.signals).easier || tuned(S.settings.signals).reshaped) ? ` You’ve trained through ${tuned(S.settings.signals).easier ? 'Easier' : 'Reshaped'} days a few times lately, so the app suggests them less.` : ''}</p></section>
      ${(() => { const h = habitSummary(S.settings.signals); return h.logged || h.overrides || h.catchups ? group(row({ title: 'Advice you overrode', value: String(h.overrides) }) + row({ title: 'Logged the day you did it', value: h.sameDay == null ? '—' : `${h.sameDay}%` }) + row({ title: 'Catch-ups', value: String(h.catchups) }), { header: 'Your last 4 weeks', footer: 'Private to this device. The app uses these to adjust less where you keep overruling it.' }) : ''; })()}
      ${group(row({ title: 'Start rest timer automatically', icon: 'clock', color: 'orange', right: sw('autoRest', S.settings.autoRest, 'Start rest timer automatically') })
        + row({ title: 'Sounds', icon: 'speaker', color: 'pink', right: sw('sound', S.settings.sound, 'Sounds') })
        + row({ title: 'Vibration', icon: 'phone', color: 'gray', right: sw('vibrate', S.settings.vibrate, 'Vibration') })
        + row({ title: 'Check-in before workouts', icon: 'heart', color: 'red', right: sw('readinessPrompt', S.settings.readinessPrompt, 'Check-in before workouts') })
        + row({ title: 'Match-day tips', sub: 'Sleep, food and warm-up around your padel', icon: 'racket', color: 'teal', right: sw('matchTips', S.settings.matchTips !== false, 'Match-day tips') })
        + row({ title: 'Adapt workouts to recovery', sub: 'Lighter when tired, a bit more when fresh', icon: 'sliders', color: 'green', right: sw('adaptive', S.settings.adaptive !== false, 'Adapt workouts to recovery') })
        + (notif === 'default' ? row({ title: 'Allow notifications', sub: 'Get told when rest is over', icon: 'bell', color: 'red', action: 'notif' }) : ''), { header: 'While training' })}
      <section class="grp"><h2 class="grp-h">Weight unit</h2>${seg('unit', [['kg', 'Kilograms'], ['lb', 'Pounds']], S.settings.unit)}</section>
      <section class="grp"><h2 class="grp-h">Appearance</h2>${seg('appearance', [['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], S.settings.appearance || 'system')}</section>
      ${group(cloudRows(), { header: 'Online copy', footer: cloud.configured() ? 'Saved after every change while the app is open. Changes made without signal go up next time you’re online.' : 'Never lose a workout if this phone is reset, lost or replaced.' })}
      ${group(row({ title: 'Back up now', sub: `${esc(contents(S.sessions))}, plus your plan, goals, exercises and settings · last: ${esc(lb)}`, icon: 'download', color: 'blue', action: 'export-json' })
        + row({ title: 'Export for spreadsheets', sub: 'CSV file of every set', icon: 'share', color: 'green', action: 'export-csv' })
        + `<label class="row has-icon" style="cursor:pointer"><span class="tile teal">${icon('plus')}</span><span class="row-main"><span class="row-title">Restore from backup</span></span><svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg><input id="importIn" type="file" accept="application/json,.json" hidden></label>`
        + row({ title: 'Storage on this phone', sub: persist === 'granted' ? '' : 'Tap to ask iPhone to keep it', value: persist === 'granted' ? 'Protected' : persist === '…' ? '…' : 'Not protected', icon: 'shield', color: 'indigo', action: persist === 'granted' ? '' : 'persist', chevron: persist !== 'granted' }),
        { header: 'Your data', footer: `${cloud.configured() ? 'Your data is on this phone, with a copy in your private GitHub repository.' : 'Everything stays on this device. Nothing is uploaded.'}${db.persistent ? '' : ' <b class="red">Storage is unavailable, so data won’t be kept.</b>'}` })}
      ${group(row({ title: 'Feedback notes', sub: S.feedback.length ? `${S.feedback.length} note${S.feedback.length > 1 ? 's' : ''} · share to get the app tuned` : 'Things that felt off while training', icon: 'note', color: 'orange', to: 'feedback' })
        + row({ title: 'Add to Home Screen', sub: 'In Safari, tap Share, then Add to Home Screen. It then works offline.', icon: 'phone', color: 'gray' })
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
    if (name === 'adjust') { S.settings.adjust = value; await app.save('settings'); app.render({ keepScroll: true }); }
  },
  actions: {
    ...cloudActions,
    async notif() { try { await Notification.requestPermission(); } catch {} app.render({ keepScroll: true }); },
    async persist() { persist = await db.requestPersistence(); app.toast(persist === 'granted' ? 'Your data is protected' : 'Not allowed. Add to Home Screen and back up regularly.'); app.render({ keepScroll: true }); },
    'export-json'() { saveBackup(); },
    'export-csv'() { saveFile(`padel-os-sets-${isoDate()}.csv`, toCSV(S.sessions), 'text/csv'); },
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
  restoreFromData(data);
}
