// Settings → Your account: sign in or create one, see whether it's saved, restore an earlier copy, sign out.
// Also opened from the first screen ("I Have an Account") so a new phone gets everything back.
import { app, S } from './core-app.js';
import * as account from './core-account.js';
import { esc, group, row } from './ui-kit.js';
import { restoreFromData, contents, summaryText } from './ui-backup.js';
import { ago } from './ui-cloudui.js';

export const ERRORS = {
  wrong: 'That email and password don’t match.',
  exists: 'There’s already an account with this email. Sign in instead.',
  weak: 'Pick a longer password: at least 6 characters.',
  email: 'That doesn’t look like an email address.',
  confirm: 'Account made. Tap the link in the email we just sent, then sign in here.',
  unconfirmed: 'Confirm your email first (tap the link we sent), then sign in.',
  code: 'That code didn’t work. Check it, or send a new one.',
  busy: 'Too many tries. Wait a minute and try again.',
  offline: 'No connection right now. Try again when you’re online.',
  server: 'The account server didn’t answer. Try again in a moment.',
  setup: 'The account database isn’t set up yet.',
  access: 'The account database refused this. Its privacy rules may be missing.',
  signedout: 'You were signed out. Sign in again to keep saving.',
  other: 'Your account is now saving from another phone, so saving here is paused.',
  empty: 'Nothing saved in your account yet.',
};

// One line for the row and the sheet: "Saved 2 min ago", "Waiting for signal", "Paused".
export function statusText() {
  const st = account.status();
  if (!st.on) return '';
  if (st.error === 'signedout') return 'Signed out';
  if (st.error === 'other') return 'Paused';
  if (st.error === 'setup' || st.error === 'access') return 'Not saving';
  if (st.waiting && st.error === 'offline') return 'Waiting for signal';
  if (st.waiting) return 'Saving…';
  return st.lastOk ? `Saved ${ago(st.lastOk)}` : 'Not saved yet';
}
const broken = () => ['signedout', 'other', 'setup', 'access'].includes(account.status().error);

export function accountRows() {
  if (!account.signedIn()) return row({ title: 'Sign in or create an account', sub: 'Your workouts and plan saved to your account, so a new phone gets everything back.', icon: 'person', color: 'blue', action: 'acct-sign' });
  const st = account.status();
  return row({ title: esc(st.email), sub: 'Your account', value: `<span class="${broken() ? 'red' : ''}">${esc(statusText())}</span>`, icon: 'person', color: broken() ? 'red' : 'blue', action: 'acct-sheet' });
}
export const accountFooter = () => account.signedIn() ? 'Saved to your account after every change while the app is open. Only you can see it.' : 'Optional. Without an account, everything stays on this phone.';

const field = (id, label, type, auto, value = '') => `<label class="field-l" for="${id}">${label}</label>
  <input class="input" id="${id}" type="${type}" autocomplete="${auto}" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(value)}" aria-label="${label}">`;

let email = '';
// After restoring your account's copy, this phone has the same data, so it becomes the one that saves.
const takeOver = () => account.save({ take: true });
export const openSignIn = () => { email = account.status().email || email; signSheet('in'); };
function signSheet(mode = 'in', msg = '') {
  const create = mode === 'new';
  app.sheet(`<h2 class="sheet-title">${create ? 'Create your account' : 'Sign in'}</h2>
    <p class="sheet-sub">${create ? 'Your workouts, plan and settings are saved to it after every change. Only you can see them.' : 'Sign in to save this phone’s data to your account, or to get it back on a new phone.'}</p>
    ${field('acEmail', 'Email', 'email', 'email', email)}
    <div style="height:12px"></div>
    ${field('acPass', 'Password', 'password', create ? 'new-password' : 'current-password')}
    <p class="t-sub ${msg && !ERRORS[msg] ? '' : 'red'}" id="acErr" style="margin:10px 4px 0">${esc(ERRORS[msg] || msg)}</p>
    <div class="btns"><button class="btn filled" id="acGo">${create ? 'Create Account' : 'Sign In'}</button>
      <button class="btn plain" id="acMode">${create ? 'I already have an account' : 'Create an account'}</button>
      ${create ? '' : '<button class="btn plain" id="acForgot">Forgot password?</button>'}
      <button class="btn gray" data-action="close-sheet">Cancel</button></div>`, body => {
    const go = body.querySelector('#acGo'), err = body.querySelector('#acErr'), em = body.querySelector('#acEmail'), pw = body.querySelector('#acPass');
    em.oninput = () => { email = em.value; };
    body.querySelector('#acMode').onclick = () => signSheet(create ? 'in' : 'new');
    body.querySelector('#acForgot')?.addEventListener('click', () => resetSheet());
    pw.onkeydown = e => { if (e.key === 'Enter') go.click(); };
    go.onclick = async () => {
      email = em.value.trim();
      if (!email.includes('@')) { err.textContent = ERRORS.email; return; }
      if (pw.value.length < (create ? 6 : 1)) { err.textContent = create ? ERRORS.weak : 'Type your password.'; return; }
      go.disabled = true; go.textContent = create ? 'Creating…' : 'Signing in…'; err.textContent = '';
      const res = await account.connect(email, pw.value, { create });
      go.disabled = false; go.textContent = create ? 'Create Account' : 'Sign In';
      if (!res.ok) { err.textContent = ERRORS[res.error] || ERRORS.server; return; }
      opened(res);
    };
  });
}

function resetSheet(sent = false, msg = '') {
  app.sheet(`<h2 class="sheet-title">Reset your password</h2>
    <p class="sheet-sub">${sent ? `We emailed a code to ${esc(email)}. Type it here with a new password.` : 'We’ll email you a code to set a new password.'}</p>
    ${field('acEmail', 'Email', 'email', 'email', email)}
    ${sent ? `<div style="height:12px"></div>${field('acCode', 'Code from the email', 'text', 'one-time-code')}<div style="height:12px"></div>${field('acPass', 'New password', 'password', 'new-password')}` : ''}
    <p class="t-sub red" id="acErr" style="margin:10px 4px 0">${esc(ERRORS[msg] || msg)}</p>
    <div class="btns"><button class="btn filled" id="acGo">${sent ? 'Set Password and Sign In' : 'Email Me a Code'}</button>
      ${sent ? '<button class="btn plain" id="acAgain">Send a new code</button>' : ''}
      <button class="btn gray" id="acBack">Back</button></div>`, body => {
    const go = body.querySelector('#acGo'), err = body.querySelector('#acErr'), em = body.querySelector('#acEmail');
    if (sent) body.querySelector('#acCode').setAttribute('inputmode', 'numeric');
    em.oninput = () => { email = em.value; };
    body.querySelector('#acBack').onclick = () => signSheet('in');
    body.querySelector('#acAgain')?.addEventListener('click', () => resetSheet(false));
    go.onclick = async () => {
      email = em.value.trim();
      if (!email.includes('@')) { err.textContent = ERRORS.email; return; }
      go.disabled = true; err.textContent = '';
      if (!sent) {
        const r = await account.sendReset(email);
        go.disabled = false;
        return r.ok ? resetSheet(true) : (err.textContent = ERRORS[r.error] || ERRORS.server);
      }
      const code = body.querySelector('#acCode').value, pw = body.querySelector('#acPass').value;
      if (pw.length < 6) { go.disabled = false; err.textContent = ERRORS.weak; return; }
      const res = await account.resetWithCode(email, code, pw);
      go.disabled = false;
      if (!res.ok) { err.textContent = ERRORS[res.error] || ERRORS.server; return; }
      opened(res);
    };
  });
}

// Signed in. A copy already in the account: a new phone wants it back; a phone with its own data chooses.
async function opened(res) {
  const done = msg => { app.closeSheet(); app.render({ keepScroll: true }); app.toast(account.status().error ? ERRORS[account.status().error] : msg); };
  if (!res.existing) { await account.start(res.session); return done('Signed in · saved to your account'); }
  if (!S.sessions.length) { await account.start(res.session, { saveNow: false }); return restoreFromData(res.existing.data, { online: true, after: takeOver }); }
  const made = new Date(res.existing.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  app.sheet(`<h2 class="sheet-title">Your account already has data</h2>
    <p class="sheet-sub">Saved ${esc(made)}, with ${esc(summaryText(res.existing.summary || { sessions: 0, workouts: 0, matches: 0 }))}. This phone has ${esc(contents(S.sessions))}.</p>
    <div class="btns"><button class="btn filled" id="acRestore">Restore It to This Phone</button><button class="btn tinted" id="acReplace">Replace It With This Phone</button><button class="btn gray" data-action="close-sheet">Cancel</button></div>
    <p class="fine">Replacing keeps earlier copies for a while, so you can still restore one from Settings.</p>`, b => {
    b.querySelector('#acRestore').onclick = async () => { await account.start(res.session, { saveNow: false }); restoreFromData(res.existing.data, { online: true, after: takeOver }); };
    b.querySelector('#acReplace').onclick = async () => { await account.start(res.session); done('Saved to your account'); };
  });
}

function statusSheet() {
  const st = account.status(), err = st.error && st.error !== 'offline' ? ERRORS[st.error] : '';
  app.sheet(`<h2 class="sheet-title">Your account</h2>
    <p class="sheet-sub">${esc(st.email)} · ${esc(statusText())}</p>
    ${err ? `<p class="t-sub red" style="margin:-8px 4px 16px">${esc(err)}</p>` : ''}
    <div class="btns">
      ${st.error === 'signedout' ? '<button class="btn filled" data-action="acct-sign">Sign In Again</button>'
        : st.error === 'other' ? '<button class="btn filled" data-action="acct-take">Save From This Phone Instead</button>'
        : '<button class="btn filled" data-action="acct-save">Save Now</button>'}
      <button class="btn tinted" data-action="acct-restore">Restore From Your Account</button>
      <button class="btn plain" data-action="acct-out">Sign Out</button>
      <button class="btn plain red" data-action="acct-delete">Delete Account</button>
    </div>
    ${st.error === 'other' ? '<p class="fine">Saving from this phone replaces what the other phone saved. To keep that instead, restore it here first.</p>' : ''}`);
}

export const accountActions = {
  'acct-sign'() { openSignIn(); },
  'acct-sheet'() { statusSheet(); },
  async 'acct-save'() {
    app.closeSheet(); app.toast('Saving…');
    await account.save();
    const st = account.status();
    app.toast(st.error ? ERRORS[st.error] : 'Saved to your account'); app.render({ keepScroll: true });
  },
  async 'acct-take'() {
    if (!(await app.confirm('Save this phone’s data to your account? It replaces what the other phone saved.', { ok: 'Save From This Phone' }))) return;
    await account.save({ take: true });
    const st = account.status();
    app.toast(st.error ? ERRORS[st.error] : 'Saved from this phone'); app.render({ keepScroll: true });
  },
  async 'acct-restore'() {
    let list;
    try { list = await account.versions(10); } catch (e) { return app.toast(ERRORS[e.message] || ERRORS.offline); }
    if (!list.length) return app.toast(ERRORS.empty);
    const when = ts => new Date(ts).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    app.sheet(`<h2 class="sheet-title">Restore from your account</h2><p class="sheet-sub">Pick a copy. You’ll see what’s in it before anything changes.</p>
      ${group(row({ title: 'Latest', sub: 'What your account has now', action: 'acct-pick', data: { id: '' } })
        + list.map(v => row({ title: esc(when(v.date)), sub: v.summary ? esc(summaryText(v.summary)) : '', action: 'acct-pick', data: { id: v.id } })).join(''), { header: 'Saved copies', footer: 'One copy is kept for each hour you used the app, the last 30.' })}
      <button class="btn gray" data-action="close-sheet">Cancel</button>`);
  },
  async 'acct-pick'(el) {
    try { restoreFromData(await account.fetchCopy(el.dataset.id), { online: true, after: takeOver }); } catch (e) { app.toast(ERRORS[e.message] || ERRORS.offline); }
  },
  async 'acct-out'() {
    if (!(await app.confirm('Sign out on this phone? Your data stays on this phone and in your account.', { ok: 'Sign Out', danger: true }))) return;
    await account.signOut(); app.render({ keepScroll: true }); app.toast('Signed out');
  },
  async 'acct-delete'() {
    if (!(await app.confirm('Delete your account and everything saved in it? This phone keeps its data.', { ok: 'Continue', danger: true }))) return;
    if (!(await app.confirm('This can’t be undone. Delete your account?', { ok: 'Delete Account', danger: true }))) return;
    try { await account.deleteAccount(); app.render({ keepScroll: true }); app.toast('Account deleted'); } catch (e) { app.toast(ERRORS[e.message] || ERRORS.offline); }
  },
};
