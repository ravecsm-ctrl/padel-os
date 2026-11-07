// Your account (Supabase). Sign in with email and password; after every change the full backup is saved
// to your account, so a new phone gets everything back. Like the GitHub copy this is one-way on purpose:
// the phone is where you edit, the account holds the copy. Only one phone saves at a time: signing in on a
// new phone takes over, and the old phone pauses (error 'other') rather than overwrite newer data.
// Plain fetch, no library: auth is GoTrue (/auth/v1), the table is PostgREST (/rest/v1).
import * as db from './core-db.js';
import { snapshot } from './core-cloud.js';
import { SUPABASE_URL, SUPABASE_KEY } from './core-config.js';

export const KEY = 'account';   // meta: { email, uid, access, refresh, exp, device, rev, savedRev, lastOk, lastTry, error }
const WAIT = 3000;              // a few seconds after the last change, so an edit of several things is one save

let state = null, timer = null, running = false, again = false;
const listeners = new Set();
export const onStatus = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => { try { fn(); } catch {} });
// Swappable for tests.
export const net = { fetch: (...a) => globalThis.fetch(...a), url: SUPABASE_URL, key: SUPABASE_KEY };

export const available = () => !!(net.url && net.key);
export async function load() { state = await db.getMeta(KEY, null); return state; }
export const signedIn = () => !!(available() && state?.uid && state?.refresh);
const persist = () => db.setMeta(KEY, state);

// { on, email, waiting, lastOk, error }: waiting means changes not yet saved to the account.
export function status() {
  if (!signedIn()) return { on: false };
  return { on: true, email: state.email, waiting: (state.rev || 0) !== (state.savedRev || 0), lastOk: state.lastOk || 0, error: state.error || null };
}

function call(path, { method = 'GET', body, token, prefer } = {}) {
  return net.fetch(net.url.replace(/\/+$/, '') + path, { method, cache: 'no-store',
    headers: { apikey: net.key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined });
}
const text = async r => { try { const j = await r.json(); return [j.error_code, j.msg, j.error_description, j.message, j.error].filter(Boolean).join(' '); } catch { return ''; } };
const adopt = s => ({ email: s.user?.email, uid: s.user?.id, access: s.access_token, refresh: s.refresh_token, exp: s.expires_at ? s.expires_at * 1000 : Date.now() + (s.expires_in || 3600) * 1000 });
// GoTrue's answers, in the few kinds the screen explains.
export function authError(status, t = '') {
  if (status === 429 || /rate|too many/i.test(t)) return 'busy';
  if (/already (been )?registered|user_already_exists|email_exists/i.test(t)) return 'exists';
  if (/not confirmed|email_not_confirmed/i.test(t)) return 'unconfirmed';
  if (/weak|password should|at least/i.test(t)) return 'weak';
  if (/otp|token has expired|invalid.*token|expired/i.test(t)) return 'code';
  if (/invalid login|invalid_credentials|invalid_grant/i.test(t) || status === 400) return 'wrong';
  if (/email.*invalid|validate email|email_address_invalid/i.test(t)) return 'email';
  return 'server';
}
// The table's answers: 401 your sign-in ran out, 404 the table isn't there (setup.sql not run yet).
const rowError = s => s === 401 ? 'signedout' : s === 403 ? 'access' : s === 404 ? 'setup' : 'server';

// A session that's about to run out is renewed first. Throws 'signedout' if it can't be.
async function token() {
  if (Date.now() < (state.exp || 0) - 60000) return state.access;
  const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: state.refresh } });
  if (!r.ok) throw new Error(r.status === 400 || r.status === 401 ? 'signedout' : 'server');
  Object.assign(state, adopt(await r.json()));
  await persist();
  return state.access;
}

// The copy in an account: { data, summary, updatedAt } or null. Throws an error kind.
async function latest(uid, t) {
  const r = await call(`/rest/v1/backups?select=data,summary,updated_at&user_id=eq.${uid}`, { token: t });
  if (!r.ok) throw new Error(rowError(r.status));
  const [row] = await r.json();
  return row ? { data: row.data, summary: row.summary, updatedAt: Date.parse(row.updated_at) } : null;
}

// Sign in (or create the account) and look for a copy already saved to it.
// Returns { ok, error, session, existing }. Nothing is saved on this phone until start().
export async function connect(email, password, { create = false } = {}) {
  email = email.trim().toLowerCase();
  try {
    const r = await call(create ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    if (!r.ok) return { ok: false, error: authError(r.status, await text(r)) };
    const s = await r.json();
    // "Confirm email" is on in Supabase: the account exists, and the code emailed to it signs you in (verifySignup).
    if (!s.access_token) return { ok: false, error: 'verify' };
    return await opened(adopt(s));
  } catch { return { ok: false, error: 'offline' }; }
}
async function opened(session) {
  try { return { ok: true, session, existing: await latest(session.uid, session.access) }; }
  catch (e) { return { ok: false, error: ['signedout', 'access', 'setup', 'server'].includes(e.message) ? e.message : 'offline' }; }
}

// Continue with Google (PKCE): the app leaves for Google, Supabase sends it back here with ?code=…,
// and the code plus the secret made before leaving (kept in storage, never sent until then) signs you in.
const OAUTH = 'oauth';   // meta: { verifier, hash, at }, only while you're away at Google
const b64url = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export async function challengeFor(verifier) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))); }
// Which sign-ins the project has turned on: { google, email }. Null when it can't be reached.
let providers = null;
export async function signInOptions() {
  if (providers) return providers;
  try {
    const r = await Promise.race([call('/auth/v1/settings'), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
    if (!r.ok) return null;
    const s = await r.json();
    return (providers = { google: !!s.external?.google, email: s.external?.email !== false });
  } catch { return null; }
}
// Where to send the browser to sign in with Google; back: this app's address (no hash).
export async function googleUrl(back, hash = '') {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  await db.setMeta(OAUTH, { verifier, hash, at: Date.now() });
  return `${net.url.replace(/\/+$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}&code_challenge=${await challengeFor(verifier)}&code_challenge_method=s256`;
}
// Back from Google: null if this isn't a return from Google; otherwise like connect(), plus hash (where you were).
export async function finishGoogle(params) {
  const code = params.get('code'), err = params.get('error_description') || params.get('error');
  if (!code && !err) return null;
  const pending = await db.getMeta(OAUTH, null);
  if (!pending) return null;   // someone else's ?code=: not ours
  await db.delMeta(OAUTH);
  if (err) return { ok: false, hash: pending.hash, error: /cancel|denied|access_denied/i.test(err) ? 'cancelled' : 'google' };
  try {
    const r = await call('/auth/v1/token?grant_type=pkce', { method: 'POST', body: { auth_code: code, code_verifier: pending.verifier } });
    if (!r.ok) return { ok: false, hash: pending.hash, error: 'google' };
    return { ...(await opened(adopt(await r.json()))), hash: pending.hash };
  } catch { return { ok: false, hash: pending.hash, error: 'offline' }; }
}

// Forgotten password: an email with a code, then the code and a new password sign you in.
// New accounts prove their email with the code Supabase emails them ("Confirm signup" template, {{ .Token }}).
export async function verifySignup(email, code) {
  try {
    const v = await call('/auth/v1/verify', { method: 'POST', body: { type: 'signup', email: email.trim().toLowerCase(), token: code.replace(/\s/g, '') } });
    if (!v.ok) return { ok: false, error: authError(v.status, await text(v)) };
    return await opened(adopt(await v.json()));
  } catch { return { ok: false, error: 'offline' }; }
}
// A new code for an account that isn't confirmed yet (the old one ran out, or they signed up on another day).
export async function resendSignup(email) {
  try {
    const r = await call('/auth/v1/resend', { method: 'POST', body: { type: 'signup', email: email.trim().toLowerCase() } });
    return r.ok ? { ok: true } : { ok: false, error: authError(r.status, await text(r)) };
  } catch { return { ok: false, error: 'offline' }; }
}
export async function sendReset(email) {
  try {
    const r = await call('/auth/v1/recover', { method: 'POST', body: { email: email.trim().toLowerCase() } });
    return r.ok ? { ok: true } : { ok: false, error: authError(r.status, await text(r)) };
  } catch { return { ok: false, error: 'offline' }; }
}
export async function resetWithCode(email, code, password) {
  email = email.trim().toLowerCase();
  try {
    const v = await call('/auth/v1/verify', { method: 'POST', body: { type: 'recovery', email, token: code.replace(/\s/g, '') } });
    if (!v.ok) return { ok: false, error: authError(v.status, await text(v)) || 'code' };
    const s = adopt(await v.json());
    const u = await call('/auth/v1/user', { method: 'PUT', token: s.access, body: { password } });
    if (!u.ok) return { ok: false, error: authError(u.status, await text(u)) };
    return await opened(s);
  } catch { return { ok: false, error: 'offline' }; }
}

const newDevice = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
// Start using a signed-in account on this phone. saveNow: put this phone's data in the account straight
// away (this phone takes over). Otherwise the account's copy is about to be restored here: nothing is
// saved until the restore finishes (save({ take: true })), so a cancelled restore never overwrites it.
export async function start(session, { saveNow = true } = {}) {
  state = { ...session, device: newDevice(), rev: 1, savedRev: 0, lastOk: 0, error: null };
  await persist();
  if (saveNow) await save({ take: true }); else { state.savedRev = state.rev; await persist(); }
  emit();
}

// Something changed on this phone: note it, and save shortly.
export function markChanged() {
  if (!signedIn()) return;
  state.rev = (state.rev || 0) + 1;
  persist();
  clearTimeout(timer); timer = setTimeout(() => save(), WAIT);
}

// take: this phone becomes the one that saves (sign-in, or "Use this phone" after another phone took over).
export async function save({ take = false } = {}) {
  if (!signedIn() || (!take && (state.error === 'other' || state.error === 'signedout'))) return;
  if (running) { again = true; return; }
  running = true; clearTimeout(timer);
  const rev = state.rev || 0;
  try {
    const t = await token(), data = await snapshot();
    const row = { data, summary: data.summary, device: state.device };
    // Only overwrite a copy this phone saved; an empty answer means there's no copy yet, or another phone's.
    const insert = () => call('/rest/v1/backups?on_conflict=user_id', { method: 'POST', token: t, body: { user_id: state.uid, ...row }, prefer: 'resolution=merge-duplicates,return=minimal' });
    let r = take ? await insert()
      : await call(`/rest/v1/backups?user_id=eq.${state.uid}&device=eq.${encodeURIComponent(state.device)}&select=user_id`, { method: 'PATCH', token: t, body: row, prefer: 'return=representation' });
    if (r.ok && !take) {
      const rows = await r.json();
      if (!rows.length) {
        const g = await call(`/rest/v1/backups?select=device&user_id=eq.${state.uid}`, { token: t });
        if (!g.ok) r = g;
        else if ((await g.json()).length) r = { ok: false, other: true };
        else r = await insert();   // the copy was deleted online: save a fresh one
      }
    }
    if (r.ok) { state.savedRev = rev; state.lastOk = Date.now(); state.error = null; }
    else state.error = r.other ? 'other' : rowError(r.status);
  } catch (e) { if (state) state.error = ['signedout', 'server'].includes(e.message) ? e.message : 'offline'; }
  if (!state) { running = false; return; }   // signed out while saving
  state.lastTry = Date.now();
  await persist();
  running = false; emit();
  if (again || (state.error == null && (state.rev || 0) !== state.savedRev)) { again = false; if (state.error == null) save(); }
}

// Earlier copies, newest first: [{ id, date, summary }]. The database keeps one per hour of saving, the last 30.
export async function versions(n = 10) {
  const t = await token();
  const r = await call(`/rest/v1/backup_versions?select=id,saved_at,summary&order=saved_at.desc&limit=${n}`, { token: t });
  if (!r.ok) throw new Error(rowError(r.status));
  return (await r.json()).map(v => ({ id: v.id, date: Date.parse(v.saved_at), summary: v.summary }));
}
// One copy's data: an earlier version by id, or the latest.
export async function fetchCopy(id) {
  const t = await token();
  if (!id) { const c = await latest(state.uid, t); if (!c) throw new Error('empty'); return c.data; }
  const r = await call(`/rest/v1/backup_versions?select=data&id=eq.${encodeURIComponent(id)}`, { token: t });
  if (!r.ok) throw new Error(rowError(r.status));
  const [row] = await r.json();
  if (!row) throw new Error('empty');
  return row.data;
}

// Sign out on this phone. Your data stays on the phone and in the account.
export async function signOut() {
  clearTimeout(timer);
  const t = state?.access;
  state = null; await db.delMeta(KEY); emit();
  if (t) call('/auth/v1/logout', { method: 'POST', token: t }).catch(() => {});
}
// Delete the account and everything saved in it (the phone keeps its data).
export async function deleteAccount() {
  const t = await token();
  const r = await call('/rest/v1/rpc/delete_me', { method: 'POST', token: t, body: {} });
  if (!r.ok) throw new Error(rowError(r.status));
  clearTimeout(timer); state = null; await db.delMeta(KEY); emit();
}

// Keep the sign-in across "Replace everything" (which wipes this phone's storage first).
export const keep = () => state ? persist() : null;
