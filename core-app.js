// Application state, persistence wiring, hash router, toasts and sheets.
// Views import `app` and `S`; main.js registers views and boots.
import * as db from './core-db.js';
import { DEFAULT_SCHEDULE, resolveRoutine, DAYS, setPhaseSource, setDerivedRoutine, isLegHeavy, getRoutine } from './domain-program.js';
import { buildAnchor, ANCHOR_ID } from './domain-busy.js';
import { DEFAULT_PROFILE } from './domain-personalize.js';
import { isoDate, mondayOf, programPosition, parseISO } from './domain-calendar.js';
import { levelOn } from './domain-matchlevel.js';
import { blockPosition, BLOCK_PHASES } from './domain-block.js';
import { recentPain } from './domain-pain.js';
import { legsLikeMatch } from './domain-recovery.js';

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
// Busy weeks' Strength session, built from the leg workouts in your usual week (Legs & Footwork and
// Power & Agility unless you've changed them), with your exercise changes.
setDerivedRoutine(ANCHOR_ID, () => {
  let ids = [...new Set(Object.values(S.schedule))].filter(id => id !== ANCHOR_ID && getRoutine(id) && isLegHeavy(id));
  if (!ids.length) ids = ['A', 'C'];
  return buildAnchor(ids.map(id => resolveRoutine(id, S.overrides).blocks));
});
setPhaseSource(week => {
  const b = app.blockPos();
  if (b?.state !== 'active') return null;
  const id = week === b.week ? b.phaseId : b.plan[week - 1];
  return id ? { week, id, ...BLOCK_PHASES[id] } : null;
});
const $ = s => document.querySelector(s);
let saveTimer = null;

export const app = {
  register(name, view) { views[name] = view; },
  view: () => views[S.route] || views.today,
  get strength() { return S.sessions.filter(s => s.kind === 'strength'); },
  // A running goal block sets the week (week 1 to its length); after one ends, a fresh 4-week cycle starts.
  blockPos(now = new Date()) {
    const b = S.settings.block;
    return b ? blockPosition(b, now, b.goal === 'injury' ? recentPain(S.sessions, { now: now.getTime(), cleared: S.painClear }) : {}) : null;
  },
  position(now = new Date()) {
    const b = app.blockPos(now);
    if (b?.state === 'active') return { week: b.week, cycle: 1, weeksIn: b.week - 1, block: b };
    const start = b?.state === 'done' && b.nextStart > S.settings.programStart ? b.nextStart : S.settings.programStart;
    return programPosition(start, now);
  },
  location: () => S.locations.find(l => l.id === S.activeLocation) || S.locations[0] || null,
  owned: () => new Set(app.location()?.equipment || []),
  // What's planned on a date: the weekly schedule, unless today's workout was swapped with a later day this week.
  // A date's own plan (this week's padel and where workouts moved) comes before the usual week.
  planOn(iso = isoDate()) {
    const sw = S.settings.swap, plan = S.settings.dated?.[iso] ?? S.schedule[DAYS[(parseISO(iso).getDay() + 6) % 7]];
    return sw && iso === sw.date ? sw.to : sw && iso === sw.back ? sw.from : plan;
  },
  // How hard padel is expected to be on a date ('easy' | 'normal' | 'hard'); null if it isn't a padel day.
  matchLevel(iso = isoDate()) { return app.planOn(iso) === 'Padel' ? levelOn(iso, S.settings) : null; },
  // What kind of padel is planned on a date: { type, focus } (a match unless you said otherwise).
  // The date's own details first, then your usual session on that weekday (from setup).
  padelOn(iso = isoDate()) { return app.planOn(iso) === 'Padel' ? { type: 'match', focus: null, ...(S.settings.padelUsual?.[DAYS[(parseISO(iso).getDay() + 6) % 7]] || {}), ...(S.settings.padelPlan?.[iso] || {}) } : null; },
  // The level for leg rules (Match prep, legs before and after): a ball machine or an overheads lesson counts as easy.
  legLevel(iso = isoDate()) { const lv = app.matchLevel(iso); return lv && !legsLikeMatch({ activity: 'padel', padel: app.padelOn(iso) }) ? 'easy' : lv; },
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
