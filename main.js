import { app, S, DEFAULT_SETTINGS, parseHash } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { DEFAULT_SCHEDULE } from './domain-program.js';
import { today } from './ui-today.js';
import { workout, clock } from './ui-workout.js';
import { history } from './ui-history.js';
import { plan } from './ui-plan.js';
import { settings } from './ui-settings.js';

app.register('today', today);
app.register('workout', workout);
app.register('history', history);
app.register('plan', plan);
app.register('settings', settings);

const GLOBAL = {
  ...today.actions,
  go: el => app.go(el.dataset.to),
};

// One delegated listener for every [data-action] in the app and in sheets.
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const name = el.dataset.action;
  if (name === 'pick') {
    const v = el.dataset.value, value = v !== '' && !isNaN(v) ? Number(v) : v;
    el.parentElement.querySelectorAll('.chip-btn').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
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
    S.overrides = meta.overrides || {};
    S.exNotes = meta.exNotes || {};
    S.lastBackup = meta.lastBackup || 0;
    S.active = meta.active || null;
    await app.reloadSessions();
  } catch (err) {
    console.error(err);
    S.storageOk = false;
  }
  await timer.initTimer(document.querySelector('#restbar'), S.settings);
  document.querySelector('#weekBtn').onclick = () => app.go('plan');
  document.querySelector('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') app.closeSheet(); });
  parseHash();
  app.render();
  if (!db.persistent || !S.storageOk) app.toast('Storage unavailable — data will not be kept. Avoid private browsing.');
  else if (S.active && S.route !== 'workout') app.toast('You have a workout in progress');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
