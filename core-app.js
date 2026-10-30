// Application state, persistence wiring, hash router, toasts and sheets.
// Views import `app` and `S`; main.js registers views and boots.
import * as db from './core-db.js';
import { DEFAULT_SCHEDULE, resolveRoutine, DAYS } from './domain-program.js';
import { DEFAULT_PROFILE } from './domain-personalize.js';
import { isoDate, mondayOf, programPosition, parseISO } from './domain-calendar.js';

export const DEFAULT_SETTINGS = { unit: 'kg', name: '', sound: true, vibrate: true, autoRest: true, readinessPrompt: true, adaptive: true, appearance: 'system', programStart: isoDate(mondayOf()) };

export const S = {
  route: 'today', params: [],
  settings: { ...DEFAULT_SETTINGS },
  schedule: { ...DEFAULT_SCHEDULE },
  profile: { ...DEFAULT_PROFILE },  // equipment, time, level, padel days, injuries, simple mode
  locations: [],      // [{ id, name, equipment: [ids] }], user-editable
  activeLocation: '', // id of where you're training today
  customEquipment: {},// { id: label } for gear not in the standard list
  customExercises: {},// your own exercises (imported or created)
  customRoutines: {}, // your own workouts
  startWeights: {},   // imported starting weights for library exercises
  body: [],           // body log: [{ date, kg, bf, waist (cm) }]
  feedback: [],
  exerciseEdits: {},  // your changes to library exercises (see catalog.applyExerciseEdits)       // "something feels off" notes with what the app was showing
  supersets: {},      // routineId → [[exIdA, exIdB]] pairs you made
  painClear: {},      // area → when you said it feels fine again
  recoveryCal: {},    // per-muscle recovery speed learned from your feedback
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
  location: () => S.locations.find(l => l.id === S.activeLocation) || S.locations[0] || null,
  owned: () => new Set(app.location()?.equipment || []),
  // What's planned on a date: the weekly schedule, unless today's workout was swapped with a later day this week.
  planOn(iso = isoDate()) {
    const sw = S.settings.swap, plan = S.schedule[DAYS[(parseISO(iso).getDay() + 6) % 7]];
    return sw && iso === sw.date ? sw.to : sw && iso === sw.back ? sw.from : plan;
  },
  routine: id => resolveRoutine(id, S.overrides, app.location() ? { ...S.profile, owned: app.location().equipment } : S.profile),

  async save(key) { try { await db.setMeta(key, S[key]); } catch { S.storageOk = false; app.toast('Could not save — storage unavailable'); } },
  // Active workout is saved on every change, debounced, and immediately when the app is hidden.
  saveActive(now = false) {
    clearTimeout(saveTimer);
    const run = () => (S.active ? db.setMeta('active', S.active) : db.delMeta('active')).catch(() => {});
    if (now) return run();
    saveTimer = setTimeout(run, 250);
  },
  async reloadSessions() { S.sessions = await db.allSessions(); },

  // Same address (e.g. first-run setup shown while the address still says Today): no hashchange fires, so redraw here.
  go(route) { const h = '#/' + route; if (location.hash === h) { parseHash(); app.closeSheet(); app.render(); } else location.hash = h; },
  render({ keepScroll = false } = {}) {
    const y = scrollY;
    const v = app.view();
    $('#app').innerHTML = v.render();
    document.querySelectorAll('nav [data-route]').forEach(b => b.setAttribute('aria-current', b.dataset.route === (v.tab || S.route) ? 'page' : 'false'));
    document.body.dataset.route = S.route;
    v.mounted?.();
    if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
  },

  toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${msg}</span>${undo ? '<button data-undo>Undo</button>' : ''}`;
    el.classList.add('show');
    clearTimeout(el._t);
    el.onclick = async e => { if (e.target.closest('[data-undo]') && undo) { el.classList.remove('show'); await undo(); } };
    el._t = setTimeout(() => el.classList.remove('show'), undo ? 6000 : Math.min(7000, Math.max(2600, String(msg).length * 55)));   // longer messages stay longer
  },

  sheet(html, onMount) {
    const d = $('#sheet');
    $('#sheetBody').innerHTML = html;
    if (!d.open) { d.style.transform = ''; d.style.transition = ''; d.showModal(); }   // never reopen still slid down from a swipe
    onMount?.($('#sheetBody'));
  },
  closeSheet() { const d = $('#sheet'); if (d.open) d.close(); },

  confirm(message, { ok = 'Confirm', danger = false } = {}) {
    return new Promise(res => {
      app.sheet(`<div class="alert-text"><b>${message}</b></div><div class="btns"><button class="btn ${danger ? 'gray red' : 'filled'}" data-c="1">${ok}</button><button class="btn plain" data-c="0">Cancel</button></div>`, body => {
        body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { app.closeSheet(); res(b.dataset.c === '1'); });
      });
      $('#sheet').addEventListener('close', () => res(false), { once: true });
    });
  },
};

// Light / dark / follow the system, like iOS.
export function applyTheme() {
  const a = S.settings.appearance;
  if (a === 'light' || a === 'dark') document.documentElement.dataset.theme = a;
  else delete document.documentElement.dataset.theme;
}

export function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  S.route = parts[0] || 'today';
  S.params = parts.slice(1);
  if (S.route === 'workout' && !S.active) S.route = 'today';
}
