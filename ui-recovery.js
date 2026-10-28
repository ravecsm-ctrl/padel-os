// Recovery: a red-to-green body map, rounded hours per muscle, and sore/fine feedback
// that calibrates the estimates to you.
import { app, S } from './core-app.js';
import { esc, navBar, group, row } from './ui-kit.js';
import { bodyMap } from './ui-bodymap.js';
import { recoveryMap, colorFor, calibrate } from './domain-recovery.js';
import { MUSCLES } from './domain-taxonomy.js';

export const currentRecovery = () => recoveryMap(S.sessions, Date.now(), S.recoveryCal);
const levels = rec => Object.fromEntries(Object.entries(rec).map(([m, r]) => [m, r.level]));
const recColor = v => ({ fill: colorFor(v), opacity: v < 0.2 ? 0.55 : 0.95 });
const tip = rec => (m) => `${MUSCLES[m]}: ${rec[m].label}${rec[m].when ? `, ready in ${rec[m].when}` : ''}`;
export const recoveryMapSvg = rec => bodyMap(levels(rec), { color: recColor, max: 1, title: 'Muscle recovery', tip: tip(rec) });
const dot = level => `<span style="width:12px;height:12px;border-radius:50%;background:${colorFor(level)};flex:0 0 auto"></span>`;

// Compact card for Today.
export function recoveryCard() {
  if (!S.sessions.some(s => Date.now() - s.startedAt < 8 * 86400000)) return '';
  const rec = currentRecovery();
  const busy = Object.entries(rec).filter(([, r]) => r.key !== 'ready').sort((a, b) => b[1].level - a[1].level);
  const line = busy.length ? busy.slice(0, 3).map(([m, r]) => `${MUSCLES[m]} ${r.when}`).join(' · ') : 'Every muscle is ready to train';
  return `<section class="grp"><h2 class="grp-h big">Recovery</h2><button class="card" data-action="go" data-to="recovery" style="display:block;width:100%;text-align:left">
    <div style="max-width:240px;margin:0 auto">${recoveryMapSvg(rec)}</div>
    <div class="row" style="padding:10px 0 0"><span class="row-main"><span class="row-title">${busy.length ? `${busy.length} muscle${busy.length > 1 ? 's' : ''} still recovering` : 'Fully recovered'}</span><span class="row-sub">${esc(line)}</span></span><svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg></div></button></section>`;
}

function feedbackSheet(m) {
  const r = currentRecovery()[m];
  app.sheet(`<h2 class="sheet-title">${esc(MUSCLES[m])}</h2>
    <p class="sheet-sub">Estimated: <b style="color:${colorFor(r.level)}">${r.label}</b>${r.when ? `, ready in ${esc(r.when)}` : ''}. How does it actually feel?</p>
    <div class="btns two"><button class="btn gray" data-action="rec-feel" data-m="${m}" data-sore="1">Feels sore</button><button class="btn gray" data-action="rec-feel" data-m="${m}" data-sore="0">Feels fine</button></div>
    <p class="fine" style="margin-top:14px">Your answers tune how fast this muscle recovers for you. Estimates, not medical advice.</p>`);
}

export const recovery = {
  tab: 'overview',
  render() {
    const rec = currentRecovery();
    const rows = Object.keys(MUSCLES).sort((a, b) => rec[b].level - rec[a].level).map(m => {
      const r = rec[m], tuned = S.recoveryCal[m] && S.recoveryCal[m] !== 1;
      return row({ title: `${esc(MUSCLES[m])}${tuned ? ' <span class="t-foot">· tuned to you</span>' : ''}`, right: `<span class="row-value" style="color:${r.key === 'ready' ? 'var(--label-2)' : colorFor(r.level)};font-weight:${r.key === 'ready' ? 400 : 600}">${r.label}${r.when ? ` · ${esc(r.when)}` : ''}</span>`, action: 'rec-sheet', data: { m } })
        .replace('<span class="row-main">', `${dot(r.level)}<span class="row-main">`);
    }).join('');
    return `${navBar({ back: 'Overview', backTo: 'overview', title: 'Recovery' })}
      <h1 class="t-title" style="padding:8px 4px 2px">Recovery</h1><p class="t-sub" style="padding:0 4px 16px">How rested each muscle is, based on your workouts and padel.</p>
      <div class="card">${recoveryMapSvg(rec)}<div class="bm-legend">Tired <i style="background:linear-gradient(90deg,rgb(255,59,48),rgb(255,149,0),rgb(255,204,0),rgb(52,199,89))"></i> Ready</div></div>
      <div style="height:24px"></div>
      ${group(rows, { footer: 'Estimates based on how much and how hard each muscle worked, and how long ago. Tap a muscle to say how it really feels, so the app learns your recovery speed.' })}`;
  },
  actions: {
    'rec-sheet'(el) { feedbackSheet(el.dataset.m); },
    async 'rec-feel'(el) {
      const m = el.dataset.m, sore = el.dataset.sore === '1', lvl = currentRecovery()[m].level;
      const before = S.recoveryCal[m] || 1;
      S.recoveryCal = calibrate(S.recoveryCal, m, sore, lvl);
      await app.save('recoveryCal'); app.closeSheet(); app.render({ keepScroll: true });
      const after = S.recoveryCal[m];
      app.toast(after > before ? `Got it: ${MUSCLES[m].toLowerCase()} will recover more slowly for you` : after < before ? `Got it: ${MUSCLES[m].toLowerCase()} will recover faster for you` : 'Thanks, that matches the estimate');
    },
  },
};
