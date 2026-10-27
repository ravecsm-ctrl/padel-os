// Application state, persistence wiring, hash router, toasts and sheets.
// Views import `app` and `S`; main.js registers views and boots.
import * as db from './core-db.js';
import { DEFAULT_SCHEDULE, resolveRoutine } from './domain-program.js';
import { DEFAULT_PROFILE } from './domain-personalize.js';
import { isoDate, mondayOf, programPosition } from './domain-calendar.js';

export const DEFAULT_SETTINGS = { unit: 'kg', name: '', sound: true, vibrate: true, autoRest: true, readinessPrompt: true, programStart: isoDate(mondayOf()) };

export const S = {
  route: 'today', params: [],
  settings: { ...DEFAULT_SETTINGS },
  schedule: { ...DEFAULT_SCHEDULE },
  profile: { ...DEFAULT_PROFILE },  // equipment, time, level, padel days, injuries, simple mode
  overrides: {},      // routine block customisations
  exNotes: {},        // persistent per-exercise notes ("seat 4")
  lastBackup: 0,
  sessions: [],       // all sessions, newest first
  active: null,       // in-progress workout (autosaved)
  form: {},           // transient form state for chip pickers
  storageOk: true,
};

const views = {};
const $ = s => document.querySelector(s);
let saveTimer = null;

export const app = {
  register(name, view) { views[name] = view; },
  view: () => views[S.route] || views.today,
  get strength() { return S.sessions.filter(s => s.kind === 'strength'); },
  position: () => programPosition(S.settings.programStart),
  routine: id => resolveRoutine(id, S.overrides, S.profile),

  async save(key) { try { await db.setMeta(key, S[key]); } catch { S.storageOk = false; app.toast('Could not save — storage unavailable'); } },
  // Active workout is saved on every change, debounced, and immediately when the app is hidden.
  saveActive(now = false) {
    clearTimeout(saveTimer);
    const run = () => (S.active ? db.setMeta('active', S.active) : db.delMeta('active')).catch(() => {});
    if (now) return run();
    saveTimer = setTimeout(run, 250);
  },
  async reloadSessions() { S.sessions = await db.allSessions(); },

  go(route) { location.hash = '#/' + route; },
  render({ keepScroll = false } = {}) {
    const y = scrollY;
    const v = app.view();
    $('#app').innerHTML = v.render();
    document.querySelectorAll('nav [data-route]').forEach(b => b.setAttribute('aria-current', b.dataset.route === (v.tab || S.route) ? 'page' : 'false'));
    document.body.dataset.route = S.route;
    $('#weekBtn').innerHTML = weekPill();
    v.mounted?.();
    if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
  },

  toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${msg}</span>${undo ? '<button data-undo>Undo</button>' : ''}`;
    el.classList.add('show');
    clearTimeout(el._t);
    el.onclick = async e => { if (e.target.closest('[data-undo]') && undo) { el.classList.remove('show'); await undo(); } };
    el._t = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 2600);
  },

  sheet(html, onMount) {
    const d = $('#sheet');
    $('#sheetBody').innerHTML = html;
    if (!d.open) d.showModal();
    onMount?.($('#sheetBody'));
  },
  closeSheet() { const d = $('#sheet'); if (d.open) d.close(); },

  confirm(message, { ok = 'Confirm', danger = false } = {}) {
    return new Promise(res => {
      app.sheet(`<h3>${message}</h3><div class="row gap"><button class="btn secondary" data-c="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-c="1">${ok}</button></div>`, body => {
        body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { app.closeSheet(); res(b.dataset.c === '1'); });
      });
      $('#sheet').addEventListener('close', () => res(false), { once: true });
    });
  },
};

function weekPill() {
  const p = app.position();
  return `C${p.cycle} · <b>W${p.week}</b>`;
}

export function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  S.route = parts[0] || 'today';
  S.params = parts.slice(1);
  if (S.route === 'workout' && !S.active) S.route = 'today';
}
