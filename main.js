import { app, S, DEFAULT_SETTINGS, parseHash, applyTheme } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { DEFAULT_SCHEDULE } from './domain-program.js';
import { today } from './ui-today.js';
import { workout, clock } from './ui-workout.js';
import { history } from './ui-history.js';
import { plan } from './ui-plan.js';
import { settings } from './ui-settings.js';
import { court } from './ui-court.js';
import { welcome } from './ui-welcome.js';
import { DEFAULT_PROFILE } from './domain-personalize.js';
import { setCustomExercises, setStartWeights } from './domain-catalog.js';
import { setCustomRoutines } from './domain-program.js';
import { PRESET_GEAR } from './domain-taxonomy.js';
import { library } from './ui-library.js';
import { builder } from './ui-builder.js';
import { recovery } from './ui-recovery.js';
import { stats } from './ui-stats.js';
import { body } from './ui-body.js';
import { overview } from './ui-overview.js';
import { locations, locationSheet, setLocation } from './ui-locations.js';

app.register('today', today);
app.register('workout', workout);
app.register('history', history);
app.register('plan', plan);
app.register('settings', settings);
app.register('court', court);
app.register('welcome', welcome);
app.register('library', library);
app.register('builder', builder);
app.register('recovery', recovery);
app.register('stats', stats);
app.register('body', body);
app.register('overview', overview);
app.register('locations', locations);

const GLOBAL = {
  ...today.actions,
  go: el => app.go(el.dataset.to),
  'close-sheet': () => app.closeSheet(),
  'set-location': el => setLocation(el.dataset.id),
  'loc-sheet': () => locationSheet(),
};

// One delegated listener for every [data-action] in the app and in sheets.
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const name = el.dataset.action;
  if (name === 'pick') {
    const v = el.dataset.value, value = v !== '' && !isNaN(v) ? Number(v) : v;
    el.parentElement.querySelectorAll('button').forEach(b => { const on = b === el; if (b.classList.contains('chip-btn')) { b.classList.toggle('on', on); b.setAttribute('aria-checked', on); } else b.setAttribute('aria-selected', on); });
    S.form[el.dataset.name] = value;
    // A sheet that owns its own picker re-draws itself; otherwise the view handles it.
    if (el.closest('#sheet')) app.onPick?.(el.dataset.name, value);
    else app.view().onPick?.(el.dataset.name, value);
    return;
  }
  const fn = app.view().actions?.[name] || GLOBAL[name];
  if (fn) { e.preventDefault(); await fn(el, e); }
});
document.addEventListener('input', e => app.view().onInput?.(e.target));
// Select the whole value when focusing a number in the set table — faster edits on phones.
document.addEventListener('focusin', e => { if (e.target.matches?.('.set-in')) setTimeout(() => e.target.select?.(), 0); });

addEventListener('hashchange', () => { parseHash(); app.closeSheet(); app.render(); });

// Workout clock.
setInterval(() => {
  const el = document.querySelector('.elapsed');
  if (!el) return;
  el.textContent = clock(+el.dataset.start);
}, 1000);

async function boot() {
  try {
    const meta = await db.allMeta();
    S.settings = { ...DEFAULT_SETTINGS, ...(meta.settings || {}) };
    if (!meta.settings) await db.setMeta('settings', S.settings); // pin the program start date on first run
    S.schedule = { ...DEFAULT_SCHEDULE, ...(meta.schedule || {}) };
    S.profile = { ...DEFAULT_PROFILE, ...(meta.profile || {}) };
    S.overrides = meta.overrides || {};
    S.customEquipment = meta.customEquipment || {};
    S.customExercises = meta.customExercises || {};
    S.customRoutines = meta.customRoutines || {};
    S.startWeights = meta.startWeights || {};
    S.recoveryCal = meta.recoveryCal || {};
    S.painClear = meta.painClear || {};
    S.body = Array.isArray(meta.body) ? meta.body : [];
    S.supersets = meta.supersets || {};
    setCustomExercises(S.customExercises); setCustomRoutines(S.customRoutines); setStartWeights(S.startWeights);
    // Locations: first run (or upgrade) creates two editable examples from the old tier setting.
    if (Array.isArray(meta.locations) && meta.locations.length) { S.locations = meta.locations; S.activeLocation = meta.activeLocation || meta.locations[0].id; }
    else {
      S.locations = [{ id: 'home', name: 'Home', equipment: [...PRESET_GEAR[S.profile.equipment === 'gym' ? 'db' : S.profile.equipment]] }, { id: 'gym', name: 'Gym', equipment: [...PRESET_GEAR.gym] }];
      S.activeLocation = S.profile.equipment === 'gym' ? 'gym' : 'home';
      await db.setMeta('locations', S.locations); await db.setMeta('activeLocation', S.activeLocation);
    }
    S.exNotes = meta.exNotes || {};
    S.lastBackup = meta.lastBackup || 0;
    S.active = meta.active || null;
    await app.reloadSessions();
  } catch (err) {
    console.error(err);
    S.storageOk = false;
  }
  applyTheme();
  await timer.initTimer(document.querySelector('#restbar'), S.settings);
  document.querySelector('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') app.closeSheet(); });
  parseHash();
  // First run: onboarding. Existing users keep their data and get a prompt on Today instead.
  if (!S.profile.onboarded && !S.sessions.length && !S.active && S.route === 'overview') S.route = 'welcome';
  // A workout in progress always opens first.
  if (S.active && S.route !== 'workout') { S.route = 'workout'; S.params = []; window.history.replaceState(null, "", "#/workout"); }
  app.render();
  if (!db.persistent || !S.storageOk) app.toast('Storage unavailable — data will not be kept. Avoid private browsing.');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
