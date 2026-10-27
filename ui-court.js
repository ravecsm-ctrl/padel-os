// Court tab: warm-up, cool-down and injury-prevention routines with a hands-free player.
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, title } from './ui-kit.js';
import { COURT_ROUTINES, expandSteps, routineMinutes } from './domain-court.js';
import { prehabFor } from './domain-padel.js';
import { createActivity } from './domain-workout.js';
import { AREAS } from './domain-personalize.js';

// Player state: absolute timestamps so it stays correct if the phone throttles timers.
let P = null;
let tick = null, ctx = null, wake = null;

function beep(hi = false) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = hi ? 1320 : 880; o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t); o.stop(t + 0.22);
  } catch {}
  if (S.settings.vibrate) navigator.vibrate?.(hi ? [120, 60, 120] : 60);
}

const remaining = () => P.paused != null ? P.paused : Math.max(0, Math.ceil((P.endAt - Date.now()) / 1000));
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function startStep(i) {
  P.i = i; P.endAt = Date.now() + P.steps[i].sec * 1000; P.paused = null; P.warned = false;
}
function loop() {
  clearInterval(tick);
  tick = setInterval(() => {
    if (!P || S.route !== 'court') return clearInterval(tick);
    if (P.paused != null) return;
    const r = remaining();
    if (r <= 3 && r > 0 && !P.warned) { P.warned = true; beep(); }
    if (r === 0) {
      if (P.i >= P.steps.length - 1) { beep(true); P.done = true; clearInterval(tick); return app.render({ keepScroll: true }); }
      beep(true); startStep(P.i + 1); return app.render({ keepScroll: true });
    }
    const t = document.querySelector('.cp-time'); if (t) t.textContent = fmt(r);
    const bar = document.querySelector('.cp-fill'); if (bar) bar.style.transform = `scaleX(${1 - r / P.steps[P.i].sec})`;
  }, 250);
}
async function keepAwake() { try { if (!wake && 'wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch {} }

function listView() {
  const pre = prehabFor(S.profile, S.sessions);
  const routines = Object.values(COURT_ROUTINES);
  const item = r => `<button class="card routine-card" data-action="go" data-to="court/${r.id}"><span class="badge ${r.kind === 'court' ? '' : 'alt'}">${r.kind === 'court' ? '◎' : '✚'}</span><span><b>${esc(r.title)}</b><small>${routineMinutes(r)} min · ${esc(r.tag)}${pre.ids.includes(r.id) ? ' · recommended for you' : ''}</small></span><span aria-hidden="true">›</span></button>`;
  const flagged = Object.entries(pre.flagged).filter(([, n]) => n >= 2);
  return `${title('Court', 'WARM UP · COOL DOWN · STAY HEALTHY')}
    ${flagged.length ? `<div class="card nudge"><b>You flagged ${flagged.map(([a, n]) => `${esc(AREAS[a] || a).toLowerCase()} (${n}×)`).join(', ')} recently</b><small>The matching routine is marked below. If pain is sharp or keeps getting worse, get it checked.</small></div>` : ''}
    <h4 class="group">Match day</h4>${routines.filter(r => r.kind === 'court').map(item).join('')}
    <h4 class="group">Injury prevention · 2–3× a week</h4>${routines.filter(r => r.kind === 'prehab').sort((a, b) => pre.ids.includes(b.id) - pre.ids.includes(a.id)).map(item).join('')}
    <p class="fine">General guidance, not medical advice. Mild discomfort (≤3/10) that settles by the next day is usually OK; sharp or worsening pain is a reason to stop.</p>`;
}

function playerView(r) {
  if (!P || P.id !== r.id) P = { id: r.id, steps: expandSteps(r), i: -1, startedAt: 0, done: false };
  const back = `<button class="link back" data-action="cp-exit">‹ Court</button>`;
  if (P.i < 0) return `${back}${title(r.title, `${routineMinutes(r)} MIN · ${P.steps.length} STEPS`)}<p class="meta">${esc(r.blurb)}</p>
    <ol class="steps">${r.steps.map(st => `<li><b>${esc(st.name)}</b><small>${st.side ? `${st.sec}s each side` : `${st.sec}s`} · ${esc(st.cue)}</small></li>`).join('')}</ol>
    <button class="btn primary big" data-action="cp-start">Start · hands-free</button><p class="fine">Beeps 3 s before each change. The screen stays on.</p>`;
  if (P.done) return `${back}<section class="hero done"><span class="eyebrow">DONE</span><h2>${esc(r.title)} complete ✓</h2><p>${Math.max(1, Math.round((Date.now() - P.startedAt) / 60000))} minutes.</p>
    <div class="row gap"><button class="btn secondary" data-action="cp-exit">Close</button><button class="btn primary" data-action="cp-log">Save to history</button></div></section>`;
  const st = P.steps[P.i], next = P.steps[P.i + 1];
  return `${back}<div class="cplayer">
    <span class="eyebrow">STEP ${P.i + 1} OF ${P.steps.length}</span>
    <h2>${esc(st.name)}</h2><p class="cp-cue">${esc(st.cue)}</p>
    <div class="cp-time" role="timer">${fmt(remaining())}</div><div class="cp-bar"><i class="cp-fill"></i></div>
    <div class="row gap"><button class="btn secondary" data-action="cp-prev" ${P.i === 0 ? 'disabled' : ''}>‹ Back</button><button class="btn secondary" data-action="cp-pause">${P.paused != null ? '▶ Resume' : 'Ⅱ Pause'}</button><button class="btn secondary" data-action="cp-next">Skip ›</button></div>
    ${next ? `<p class="meta">Next: <b>${esc(next.name)}</b></p>` : '<p class="meta">Last step</p>'}</div>`;
}

export const court = {
  render() {
    const r = COURT_ROUTINES[S.params[0]];
    return r ? playerView(r) : listView();
  },
  mounted() { if (P && P.i >= 0 && !P.done) { keepAwake(); loop(); } },
  actions: {
    'cp-start'() { P.startedAt = Date.now(); startStep(0); beep(true); app.render(); },
    'cp-pause'() { if (P.paused != null) { P.endAt = Date.now() + P.paused * 1000; P.paused = null; } else P.paused = remaining(); app.render({ keepScroll: true }); },
    'cp-next'() { if (P.i >= P.steps.length - 1) { P.done = true; } else startStep(P.i + 1); app.render({ keepScroll: true }); },
    'cp-prev'() { startStep(Math.max(0, P.i - 1)); app.render({ keepScroll: true }); },
    'cp-exit'() { P = null; clearInterval(tick); wake?.release?.(); app.go('court'); },
    async 'cp-log'() {
      const r = COURT_ROUTINES[P.id], dur = Math.max(1, Math.round((Date.now() - P.startedAt) / 60000));
      const rec = { ...createActivity({ activity: 'mobility', startedAt: P.startedAt, durationMin: dur, rpe: 3, notes: '' }), title: r.title, routine: r.id };
      await db.putSession(rec); await app.reloadSessions();
      P = null; wake?.release?.(); app.go('court'); app.toast(`${r.title} saved`);
    },
  },
};
