// Settings → Online copy: set it up, see whether it's saved, save now, restore any earlier copy.
import { app, S } from './core-app.js';
import * as cloud from './core-cloud.js';
import { esc, icon, group, row } from './ui-kit.js';
import { restoreFromData, contents, summaryText } from './ui-backup.js';
import { relDay } from './domain-calendar.js';

const REPO = 'padel-os-data';
const ERRORS = {
  key: 'That key didn’t work. It may have expired, or not all of it was copied.',
  repo: 'This key can’t open that repository. Check its name, and that the key was given access to it.',
  public: 'That repository is public, so anyone could see your workouts. Make it private on GitHub first.',
  readonly: 'This key can read but not save. Set Contents to “Read and write”.',
  access: 'The key no longer has access to the repository.',
  server: 'GitHub didn’t accept the save. It will try again.',
  offline: 'No connection right now. It will save when you’re back online.',
};

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 24 * 60 ? `${Math.round(m / 60)} h ago` : relDay(ts).toLowerCase();
}
// One line for the row and the sheet: "Saved 2 min ago", "Waiting for signal", "Key stopped working".
export function statusText() {
  const st = cloud.status();
  if (!st.on) return '';
  if (st.error === 'key') return 'Key stopped working';
  if (st.error === 'access') return 'Can’t reach the repository';
  if (st.waiting && st.error === 'offline') return 'Waiting for signal';
  if (st.waiting) return 'Saving…';
  return st.lastOk ? `Saved ${ago(st.lastOk)}` : 'Not saved yet';
}
const broken = () => ['key', 'access'].includes(cloud.status().error);

export function cloudRows() {
  if (!cloud.configured()) return row({ title: 'Save a copy online', sub: 'Automatic after every change, to a private GitHub repository you own. Every version is kept.', icon: 'shield', color: 'green', action: 'cloud-setup' });
  const st = cloud.status();
  return row({ title: 'Online copy', sub: esc(st.repo), value: `<span class="${broken() ? 'red' : ''}">${esc(statusText())}</span>`, icon: 'shield', color: broken() ? 'red' : 'green', action: 'cloud-sheet' });
}

function setupSheet() {
  app.sheet(`<h2 class="sheet-title">Save a copy online</h2>
    <p class="sheet-sub">After every change, your workouts, plan and settings are copied to a private GitHub repository. GitHub keeps every version. About 2 minutes, once.</p>
    <ol class="setup-steps">
      <li><b>Make a private repository</b> called ${REPO}. <a class="link" href="https://github.com/new?name=${REPO}&visibility=private" target="_blank" rel="noopener">Open GitHub</a></li>
      <li><b>Make a key</b> for it. Repository access: <i>Only select repositories</i>, then ${REPO}. Permissions: <i>Contents</i>, <i>Read and write</i>. Expiration: the longest offered. <a class="link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Open GitHub</a></li>
      <li><b>Paste the key here.</b> It stays on this phone and is never put in backup files.</li>
    </ol>
    <label class="field-l" for="ghKey">GitHub key</label>
    <input class="input" id="ghKey" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="github_pat_…" aria-label="GitHub key">
    <label class="field-l" for="ghRepo" style="margin-top:12px">Repository</label>
    <input class="input" id="ghRepo" value="${esc(cloud.status().repo?.split('/')[1] || REPO)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Repository name">
    <p class="t-sub red" id="ghErr" style="margin:10px 4px 0"></p>
    <div class="btns"><button class="btn filled" id="ghGo">Connect</button><button class="btn gray" data-action="close-sheet">Cancel</button></div>`, body => {
    const go = body.querySelector('#ghGo'), err = body.querySelector('#ghErr');
    go.onclick = async () => {
      const key = body.querySelector('#ghKey').value, name = body.querySelector('#ghRepo').value || REPO;
      if (!key.trim()) { err.textContent = 'Paste your GitHub key first.'; return; }
      go.disabled = true; go.textContent = 'Checking…'; err.textContent = '';
      const res = await cloud.connect(key, name);
      go.disabled = false; go.textContent = 'Connect';
      if (!res.ok) { err.textContent = ERRORS[res.error] || ERRORS.server; return; }
      // A new key for the same repository: just carry on.
      if (!res.existing || (cloud.configured() && cloud.status().repo === res.repo)) { await cloud.start(key, res.repo, res.branch); app.closeSheet(); app.render({ keepScroll: true }); return app.toast(cloud.status().error ? ERRORS[cloud.status().error] : 'Online copy on · saved'); }
      // A copy is already there: a new phone wants it back; an old phone may want to overwrite it.
      if (!S.sessions.length) { await cloud.start(key, res.repo, res.branch, { saveNow: false }); return restoreFromData(res.existing.data, { online: true }); }
      const made = res.existing.exportedAt ? new Date(res.existing.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'earlier';
      app.sheet(`<h2 class="sheet-title">There’s already a copy online</h2>
        <p class="sheet-sub">Saved ${esc(made)}, with ${esc(summaryText(res.existing.summary))}. This phone has ${esc(contents(S.sessions))}.</p>
        <div class="btns"><button class="btn filled" id="ghRestore">Restore It to This Phone</button><button class="btn tinted" id="ghReplace">Replace It With This Phone</button><button class="btn gray" data-action="close-sheet">Cancel</button></div>
        <p class="fine">Replacing keeps the older copy in GitHub’s history, so nothing is lost either way.</p>`, b2 => {
        b2.querySelector('#ghRestore').onclick = async () => { await cloud.start(key, res.repo, res.branch, { saveNow: false }); restoreFromData(res.existing.data, { online: true }); };
        b2.querySelector('#ghReplace').onclick = async () => { await cloud.start(key, res.repo, res.branch); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Online copy on · saved'); };
      });
    };
  });
}

function statusSheet() {
  const st = cloud.status(), err = st.error && st.error !== 'offline' ? ERRORS[st.error] : '';
  app.sheet(`<h2 class="sheet-title">Online copy</h2>
    <p class="sheet-sub">${esc(st.repo)} · ${esc(statusText())}</p>
    ${err ? `<p class="t-sub red" style="margin:-8px 4px 16px">${esc(err)}</p>` : ''}
    <div class="btns">
      ${broken() ? '<button class="btn filled" data-action="cloud-setup">Add a New Key</button>' : '<button class="btn filled" data-action="cloud-save">Save Now</button>'}
      <button class="btn tinted" data-action="cloud-restore">Restore From GitHub</button>
      <a class="btn plain" href="https://github.com/${esc(st.repo)}/commits/${esc(st.branch)}/${cloud.FILE}" target="_blank" rel="noopener">See Every Version on GitHub</a>
      ${broken() ? '' : '<button class="btn plain" data-action="cloud-setup">Change Key</button>'}
      <button class="btn plain red" data-action="cloud-off">Stop the Online Copy</button>
    </div>`);
}

export const cloudActions = {
  'cloud-setup'() { setupSheet(); },
  'cloud-sheet'() { statusSheet(); },
  async 'cloud-save'() {
    app.closeSheet(); app.toast('Saving…');
    await cloud.save();
    const st = cloud.status();
    app.toast(st.error ? ERRORS[st.error] : 'Online copy saved'); app.render({ keepScroll: true });
  },
  async 'cloud-restore'() {
    let list;
    try { list = await cloud.versions(10); } catch (e) { return app.toast(ERRORS[e.message] || ERRORS.offline); }
    if (!list.length) return app.toast('Nothing saved online yet');
    const when = ts => new Date(ts).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    app.sheet(`<h2 class="sheet-title">Restore from GitHub</h2><p class="sheet-sub">Pick a copy. You’ll see what’s in it before anything changes.</p>
      ${group(list.map((v, i) => row({ title: i === 0 ? 'Latest' : esc(when(v.date)), sub: i === 0 ? esc(when(v.date)) : '', action: 'cloud-pick', data: { sha: v.sha } })).join(''), { header: 'Saved copies' })}
      <button class="btn gray" data-action="close-sheet">Cancel</button>`);
  },
  async 'cloud-pick'(el) {
    try { restoreFromData(await cloud.fetchCopy(el.dataset.sha), { online: true }); } catch (e) { app.toast(ERRORS[e.message] || ERRORS.offline); }
  },
  async 'cloud-off'() {
    if (!(await app.confirm('Stop the online copy on this phone? The copy on GitHub stays, and you can connect again any time.', { ok: 'Stop', danger: true }))) return;
    await cloud.disconnect(); app.render({ keepScroll: true }); app.toast('Online copy stopped on this phone');
  },
};
