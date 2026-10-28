// "Something feels off": one tap saves a note with what the app was showing at that moment
// (screen, exercise, suggested weight, what you logged), so tuning is based on real use.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row } from './ui-kit.js';
import { fmtW } from './domain-units.js';
import { isoDate } from './domain-calendar.js';
import { saveFile } from './ui-backup.js';

export const TAGS = { heavy: 'Weight too heavy', light: 'Weight too light', recovery: 'Recovery estimate off', confusing: 'Confusing', bug: 'Something broke', other: 'Other' };

// Context from the current screen, kept short and readable.
export function context() {
  const c = { route: [S.route, ...S.params].join('/') };
  const w = S.active;
  if (S.route === 'workout' && w?.exercises?.length) {
    const e = w.exercises[w.index], set = e.sets.find(s => !s.done) || e.sets[e.sets.length - 1];
    c.workout = w.title; c.exercise = e.name; c.exId = e.exId;
    if (e.suggestion?.w != null) c.suggested = `${fmtW(e.suggestion.w, S.settings.unit)} × ${e.suggestion.target ?? e.target.min}`;
    const done = e.sets.filter(s => s.done).map(s => `${s.w != null ? fmtW(s.w, S.settings.unit) + ' × ' : ''}${s.reps ?? s.sec ?? s.m ?? ''}${s.rpe ? ` (${s.rpe})` : ''}`);
    if (done.length) c.logged = done.join(', ');
    else if (set?.w != null) c.entering = fmtW(set.w, S.settings.unit);
  }
  return c;
}

export function feedbackSheet(extra = {}) {
  const ctx = { ...context(), ...extra };
  let tag = null;
  const draw = () => `<h2 class="sheet-title">Something feels off?</h2><p class="sheet-sub">${ctx.exercise ? `About ${esc(ctx.exercise)}. ` : ''}Saved on this phone with what the app was showing, so it can be tuned later.</p>
    <div class="chipset" style="margin-bottom:12px">${Object.entries(TAGS).map(([k, v]) => `<button type="button" class="chip-btn ${tag === k ? 'on' : ''}" data-fb-tag="${k}">${esc(v)}</button>`).join('')}</div>
    <textarea class="input" id="fbNote" rows="3" placeholder="What happened? e.g. 60 kg felt like a warm-up"></textarea>
    <div style="height:16px"></div><button class="btn filled" id="fbSave">Save Note</button><button class="btn plain" data-action="close-sheet">Cancel</button>`;
  const mount = b => {
    const note = b.querySelector('#fbNote');
    b.querySelectorAll('[data-fb-tag]').forEach(c => c.onclick = () => { tag = tag === c.dataset.fbTag ? null : c.dataset.fbTag; const keep = note.value; app.sheet(draw(), mount); document.querySelector('#fbNote').value = keep; });
    b.querySelector('#fbSave').onclick = async () => {
      const text = b.querySelector('#fbNote').value.trim();
      if (!text && !tag) return app.toast('Pick what felt off, or write a note');
      S.feedback = [...S.feedback, { ts: Date.now(), tag, note: text, ...ctx }];
      await app.save('feedback'); app.closeSheet(); app.toast('Noted. Find your notes in Settings.');
    };
  };
  app.sheet(draw(), mount);
}

const asText = list => list.map(f => [
  `${new Date(f.ts).toLocaleString()} · ${f.tag ? TAGS[f.tag] : 'Note'}`,
  f.note && `  “${f.note}”`,
  f.workout && `  ${f.workout}${f.exercise ? ` · ${f.exercise}` : ''}`,
  f.suggested && `  Suggested: ${f.suggested}`, f.logged && `  Logged: ${f.logged}`, f.entering && `  Entering: ${f.entering}`,
  `  Screen: ${f.route}`,
].filter(Boolean).join('\n')).join('\n\n');

function view() {
  const list = [...S.feedback].reverse();
  return `${navBar({ back: 'Settings', backTo: 'settings', title: '' })}<h1 class="t-large" style="padding:8px 4px 2px">Feedback notes</h1>
    <p class="t-sub" style="padding:0 4px 18px">Things that felt off while training. Share them to get the app tuned to you.</p>
    ${list.length ? `<div class="btns" style="margin-bottom:20px"><button class="btn filled" data-action="fb-share">${icon('share')}Share All Notes</button><button class="btn tinted" data-action="fb-new">${icon('plus')}New Note</button></div>
      ${group(list.map(f => row({ title: esc(f.note || (f.tag ? TAGS[f.tag] : 'Note')), sub: esc([new Date(f.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), f.tag && f.note ? TAGS[f.tag] : '', f.exercise, f.suggested && `suggested ${f.suggested}`].filter(Boolean).join(' · ')), action: 'fb-del', data: { ts: f.ts }, chevron: false, right: `<span class="t-foot">Delete</span>` })).join(''), { footer: 'Notes stay on this phone and are included in backups.' })}`
      : `<div class="card" style="text-align:center;padding:28px 18px"><p class="t-head">No notes yet</p><p class="t-sub" style="margin:6px 0 18px">During a workout, tap ⋯ then “Something feels off”. It saves the exercise and suggested weight with your note.</p><button class="btn tinted" data-action="fb-new">${icon('plus')}New Note</button></div>`}`;
}

export const feedback = {
  tab: 'today',
  render: view,
  actions: {
    'fb-new'() { feedbackSheet(); },
    async 'fb-share'() { await saveFile(`padel-os-feedback-${isoDate()}.txt`, asText(S.feedback), 'text/plain'); },
    async 'fb-del'(el) {
      if (!(await app.confirm('Delete this note?', { ok: 'Delete', danger: true }))) return;
      S.feedback = S.feedback.filter(f => f.ts !== +el.dataset.ts); await app.save('feedback'); app.render({ keepScroll: true });
    },
  },
};
export { asText };
