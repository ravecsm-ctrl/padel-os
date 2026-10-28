// Court tab: warm-up, cool-down and injury-prevention routines with a hands-free player.
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, icon, pageHead, navBar, group, row } from './ui-kit.js';
import { COURT_ROUTINES, expandSteps, routineMinutes } from './domain-court.js';
import { prehabFor } from './domain-padel.js';
import { createActivity } from './domain-workout.js';
import { AREAS } from './domain-personalize.js';

// Player state uses absolute timestamps so it stays correct if the phone throttles timers.
let P = null;
let tick = null, ctx = null, wake = null;
const RING = 2 * Math.PI * 110;
const LOOK = { warmup: ['flame', 'orange'], cooldown: ['wave', 'teal'], elbow: ['heart', 'pink'], shoulder: ['heart', 'pink'], back: ['heart', 'pink'], knee: ['heart', 'pink'], calf: ['heart', 'pink'] };

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

function startStep(i) { P.i = i; P.endAt = Date.now() + P.steps[i].sec * 1000; P.paused = null; P.warned = false; }
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
    const fg = document.querySelector('.ring .fg'); if (fg) fg.style.strokeDashoffset = RING * (1 - r / P.steps[P.i].sec);
  }, 250);
}
async function keepAwake() { try { if (!wake && 'wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch {} }

function listView() {
  const pre = prehabFor(S.profile, S.sessions);
  const item = r => { const [ic, color] = LOOK[r.id] || ['heart', 'pink'];
    return row({ title: esc(r.title), sub: `${routineMinutes(r)} min · ${pre.ids.includes(r.id) ? '<span class="blue">Recommended for you</span>' : esc(r.tag)}`, icon: ic, color, to: `court/${r.id}` }); };
  const all = Object.values(COURT_ROUTINES);
  const flagged = Object.entries(pre.flagged).filter(([, n]) => n >= 2);
  return `${pageHead('Court', { sub: 'Guided routines that run hands-free.' })}
    ${flagged.length ? `<div class="banner warn"><span class="tile orange">${icon('heart')}</span><span><b>You flagged ${flagged.map(([a]) => esc((AREAS[a] || a).toLowerCase())).join(' and ')} recently</b><small>Try the matching routine below. See a professional if pain is sharp or getting worse.</small></span></div>` : ''}
    ${group(all.filter(r => r.kind === 'court').map(item).join(''), { header: 'Match day' })}
    ${group(all.filter(r => r.kind === 'prehab').sort((a, b) => pre.ids.includes(b.id) - pre.ids.includes(a.id)).map(item).join(''), { header: 'Injury prevention', footer: 'Two or three times a week. Mild discomfort that settles by the next day is normal; sharp pain is a reason to stop.' })}`;
}

function playerView(r) {
  if (!P || P.id !== r.id) P = { id: r.id, steps: expandSteps(r), i: -1, startedAt: 0, done: false };
  const nav = navBar({ back: 'Court', backAction: 'cp-exit', title: P.i >= 0 && !P.done ? r.title : '' });
  if (P.i < 0) return `${nav}<h1 class="t-title" style="padding:8px 4px 4px">${esc(r.title)}</h1><p class="t-sub" style="padding:0 4px 20px">${routineMinutes(r)} min · ${esc(r.blurb)}</p>
    ${group(r.steps.map(st => row({ title: esc(st.name), sub: esc(st.cue), value: st.side ? `${st.sec}s × 2` : `${st.sec}s` })).join(''), { cls: 'steps', footer: 'A beep sounds 3 seconds before each change. The screen stays on.' })}
    <button class="btn filled" data-action="cp-start">${icon('play')}Start</button>`;
  if (P.done) return `${nav}<div class="finish-hero"><div class="big-tick">${icon('check')}</div><h1 class="t-title">All done</h1><p class="t-sub" style="margin-top:4px">${esc(r.title)} · ${Math.max(1, Math.round((Date.now() - P.startedAt) / 60000))} min</p></div>
    <div class="btns" style="margin-top:24px"><button class="btn filled" data-action="cp-log">Save to Progress</button><button class="btn plain" data-action="cp-exit">Close</button></div>`;
  const st = P.steps[P.i], next = P.steps[P.i + 1], r0 = remaining();
  return `${nav}<div class="cplayer">
    <p class="t-foot">Step ${P.i + 1} of ${P.steps.length}</p>
    <div class="ring"><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="bg" cx="120" cy="120" r="110"/><circle class="fg" cx="120" cy="120" r="110" stroke-dasharray="${RING}" stroke-dashoffset="${RING * (1 - r0 / st.sec)}"/></svg><div class="cp-time" role="timer">${fmt(r0)}</div></div>
    <h2>${esc(st.name)}</h2><p class="cp-cue">${esc(st.cue)}</p>
    <div class="cp-ctrls"><button data-action="cp-prev" ${P.i === 0 ? 'disabled' : ''} aria-label="Previous step">${icon('back')}</button>
      <button class="main" data-action="cp-pause" aria-label="${P.paused != null ? 'Resume' : 'Pause'}">${icon(P.paused != null ? 'play' : 'pause')}</button>
      <button data-action="cp-next" aria-label="Next step">${icon('fwd')}</button></div>
    <p class="t-foot">${next ? `Next: ${esc(next.name)}` : 'Last step'}</p></div>`;
}

export const court = {
  render() { const r = COURT_ROUTINES[S.params[0]]; return r ? playerView(r) : listView(); },
  mounted() { if (P && P.i >= 0 && !P.done) { keepAwake(); loop(); } },
  actions: {
    'cp-start'() { P.startedAt = Date.now(); startStep(0); beep(true); app.render(); },
    'cp-pause'() { if (P.paused != null) { P.endAt = Date.now() + P.paused * 1000; P.paused = null; } else P.paused = remaining(); app.render({ keepScroll: true }); },
    'cp-next'() { if (P.i >= P.steps.length - 1) P.done = true; else startStep(P.i + 1); app.render({ keepScroll: true }); },
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
