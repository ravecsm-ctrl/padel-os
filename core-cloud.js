// Online copy. After every change the full backup is saved as one file in a private GitHub repository
// you own; GitHub keeps every version (one commit per save). One-way on purpose: this phone is the only
// place you edit, and the copy is there to restore from after a reset or on a new phone.
// Saves happen while the app is open (iPhone can't run web apps in the background); changes made
// without signal wait and go up the next time the app is open online.
import * as db from './core-db.js';
import { buildBackup, backupSummary } from './domain-backup.js';

const API = 'https://api.github.com';
export const FILE = 'padel-os-backup.json';
export const KEY = 'cloud';   // meta: { token, repo: 'owner/name', branch, sha, rev, savedRev, lastOk, lastTry, error }
const WAIT = 3000;            // a few seconds after the last change, so an edit of several workouts is one save

let state = null, timer = null, running = false, again = false;
const listeners = new Set();
export const onStatus = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => { try { fn(); } catch {} });
// Swappable for tests.
export const net = { fetch: (...a) => globalThis.fetch(...a) };

export async function load() { state = await db.getMeta(KEY, null); return state; }
export const configured = () => !!(state?.token && state?.repo);
const persist = () => db.setMeta(KEY, state);

// { on, waiting, lastOk, error, repo }: waiting means changes not yet online.
export function status() {
  if (!configured()) return { on: false };
  return { on: true, waiting: (state.rev || 0) !== (state.savedRev || 0), lastOk: state.lastOk || 0, error: state.error || null, repo: state.repo, branch: state.branch || 'main' };
}

// UTF-8 safe base64, in chunks (a year of workouts is a few hundred KB).
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function gh(path, { method = 'GET', body, raw = false, token = state?.token } = {}) {
  return net.fetch(API + path, { method, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
}
const errorFor = status => status === 401 ? 'key' : status === 403 || status === 404 ? 'access' : 'server';
const contents = (repo, ref) => `/repos/${repo}/contents/${FILE}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;

// What goes online: everything a backup file has. Never the GitHub key, never a workout still in progress.
export async function snapshot() {
  const meta = await db.allMeta();
  delete meta.timer; delete meta[KEY]; delete meta.active;
  return buildBackup(meta, await db.allSessions());
}

// Something changed on this phone: note it, and save online shortly.
export function markChanged() {
  if (!configured()) return;
  state.rev = (state.rev || 0) + 1;
  persist();
  clearTimeout(timer); timer = setTimeout(() => save(), WAIT);
}

export async function save() {
  if (!configured()) return;
  if (running) { again = true; return; }
  running = true; clearTimeout(timer);
  const rev = state.rev || 0;
  try {
    const data = await snapshot(), s = data.summary;
    const message = `Backup · ${s.workouts} workouts, ${s.matches} matches`;
    const put = sha => gh(contents(state.repo), { method: 'PUT', body: { message, content: toBase64(JSON.stringify(data)), ...(sha ? { sha } : {}), ...(state.branch ? { branch: state.branch } : {}) } });
    let r = await put(state.sha);
    // The file changed online (or was deleted) since our last save: fetch where it is now and retry once.
    if (r.status === 409 || r.status === 422) {
      const cur = await gh(contents(state.repo, state.branch));
      state.sha = cur.ok ? (await cur.json()).sha : null;
      r = await put(state.sha);
    }
    if (r.ok) { state.sha = (await r.json()).content.sha; state.savedRev = rev; state.lastOk = Date.now(); state.error = null; }
    else state.error = errorFor(r.status);
  } catch { if (state) state.error = 'offline'; }
  if (!state) { running = false; return; }   // disconnected while saving
  state.lastTry = Date.now();
  await persist();
  running = false; emit();
  // Changed again while saving: save once more.
  if (again || (state.error == null && (state.rev || 0) !== state.savedRev)) { again = false; if (state.error == null) save(); }
}

// Check a key and repository before using them. Returns { ok, error, repo, branch, existing }.
// existing: the copy already online ({ summary, exportedAt, data }), so a new phone can restore from it.
export async function connect(token, name) {
  token = token.trim(); name = name.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  try {
    let repo = name;
    if (!name.includes('/')) {
      const u = await gh('/user', { token });
      if (!u.ok) return { ok: false, error: errorFor(u.status) };
      repo = `${(await u.json()).login}/${name}`;
    }
    const r = await gh(`/repos/${repo}`, { token });
    if (!r.ok) return { ok: false, error: r.status === 401 ? 'key' : 'repo' };
    const info = await r.json();
    if (!info.private) return { ok: false, error: 'public' };
    if (info.permissions && !info.permissions.push) return { ok: false, error: 'readonly' };
    const f = await gh(contents(info.full_name, info.default_branch), { token, raw: true });
    let existing = null;
    if (f.ok) { try { const data = JSON.parse(await f.text()); existing = { data, exportedAt: data.exportedAt, summary: data.summary || backupSummary(data.sessions || []) }; } catch {} }
    return { ok: true, repo: info.full_name, branch: info.default_branch, existing };
  } catch { return { ok: false, error: 'offline' }; }
}

// Start using a checked key. saveNow: put this phone's data online straight away.
export async function start(token, repo, branch, { saveNow = true } = {}) {
  state = { token: token.trim(), repo, branch, sha: null, rev: 1, savedRev: 0, lastOk: 0, error: null };
  const cur = await gh(contents(repo, branch));
  if (cur.ok) state.sha = (await cur.json()).sha;
  await persist();
  if (saveNow) await save(); else { state.savedRev = state.rev; await persist(); }
  emit();
}

export async function disconnect() { clearTimeout(timer); state = null; await db.delMeta(KEY); emit(); }

// Earlier copies, newest first: [{ sha, date }].
export async function versions(n = 10) {
  const r = await gh(`/repos/${state.repo}/commits?path=${FILE}&per_page=${n}${state.branch ? `&sha=${state.branch}` : ''}`);
  if (!r.ok) throw new Error(errorFor(r.status));
  return (await r.json()).map(c => ({ sha: c.sha, date: Date.parse(c.commit.committer?.date || c.commit.author?.date) }));
}
export async function fetchCopy(ref) {
  const r = await gh(contents(state.repo, ref || state.branch), { raw: true });
  if (!r.ok) throw new Error(errorFor(r.status));
  return JSON.parse(await r.text());
}

// Keep the key across "Replace everything" (which wipes this phone's storage first).
export const keep = () => state ? persist() : null;
