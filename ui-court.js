// Mobility tab: stretching, daily mobility, padel warm-up/cool-down and injury prevention,
// with a hands-free player. (The route is still 'court' so old links keep working.)
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, icon, pageHead, navBar, group, row, tile } from './ui-kit.js';
import { COURT_ROUTINES, expandSteps, routineMinutes, stretchFor } from './domain-court.js';
import { isRoutine, allRoutineIds, isCustomRoutine, phaseFor, PHASES } from './domain-program.js';
import { dayKey, relDay } from './domain-calendar.js';
import { routineLook } from './ui-kit.js';
import { blockHero } from './ui-goal.js';
import { prehabFor } from './domain-padel.js';
import { createActivity } from './domain-workout.js';
import { AREAS } from './domain-personalize.js';
import { challengesCard, shotSheet } from './ui-challenges.js';
import { activitySheet } from './ui-today.js';

// Player state uses absolute timestamps so it stays correct if the phone throttles timers.
let P = null;
let tick = null, ctx = null, wake = null;
const RING = 2 * Math.PI * 110;
const LOOK = { 'stretch-upper': ['wave', 'orange'], 'stretch-lower': ['wave', 'orange'], 'stretch-full': ['wave', 'orange'], mobility: ['sun', 'orange'], warmup: ['flame', 'teal'], cooldown: ['wave', 'teal'], between: ['racket', 'teal'], elbow: ['heart', 'pink'], shoulder: ['heart', 'pink'], back: ['heart', 'pink'], knee: ['heart', 'pink'], calf: ['heart', 'pink'] };

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

// The stretch that suits today's workout (done, or planned), if any.
function todaysStretch() {
  const today = new Date().toDateString();
  const done = S.sessions.find(x => x.kind === 'strength' && new Date(x.startedAt).toDateString() === today);
  if (done) return { id: stretchFor(done.exercises.map(e => e.exId)), why: `after today’s ${done.title}` };
  const plan = app.planOn();
  if (isRoutine(plan)) return { id: stretchFor(app.routine(plan).blocks.map(b => b.ex)), why: `after today’s ${app.routine(plan).title}` };
  return null;
}

// The Train tab: your goal, your workouts, the guided routines and the exercise library: everything you
// can do, whatever today's plan says. Routines play hands-free (playerView).
function listView() {
  const pre = prehabFor(S.profile, S.sessions, Date.now(), { cleared: S.painClear }), rec = todaysStretch();
  const all = Object.values(COURT_ROUTINES), of = kind => all.filter(r => r.kind === kind);
  const pos = app.position(), ph = phaseFor(pos.week);
  const goal = pos.block ? blockHero(pos.block)
    : `<button class="card hero" data-action="week-sheet" style="display:block;width:100%;text-align:left">
        <p class="t-foot">No goal · 4-week cycle</p><h2>Week ${pos.week}: ${esc(ph.name)}</h2><p class="t-sub">${esc(ph.note)}</p>
        <div class="cycle">${PHASES.map((p, i) => `<span class="${i + 1 === pos.week ? 'on' : i + 1 < pos.week ? 'past' : ''}"><b></b><small>${esc(p.name)}</small></span>`).join('')}</div></button>`;
  const lastDone = id => app.strength.find(s => s.routineId === id);
  const workouts = allRoutineIds().map(id => { const r = app.routine(id), look = routineLook(id), last = lastDone(id);
    return row({ title: esc(r.title), sub: `About ${r.minutes} min · ${last ? `last done ${esc(relDay(last.startedAt).toLowerCase())}` : 'not done yet'}${isCustomRoutine(id) ? ' · yours' : ''}`, icon: look.icon, color: look.color, to: `plan/routine/${id}` }); }).join('');
  // A routine worth doing now goes first, with why.
  const pick = rec ? { id: rec.id, why: `Recommended ${rec.why}` } : pre.ids[0] ? { id: pre.ids[0], why: 'Recommended for you' } : null;
  const play = (id, sub) => { const r = COURT_ROUTINES[id], [ic, color] = LOOK[id] || ['heart', 'pink']; return row({ title: esc(r.title), sub: `${routineMinutes(r)} min · ${esc(sub)}`, icon: ic, color, to: `court/${id}` }); };
  const more = (kind, title, sub, ic, color) => row({ title: esc(title), sub: esc(sub), value: String(of(kind).length + (kind === 'court' ? -1 : 0)), icon: ic, color, action: 'routines-sheet', data: { kind } });
  return `${pageHead('Train', { sub: 'Your goal, your workouts and guided routines.' })}
    <div class="court-stack" style="margin-bottom:12px">${goal}</div>
    ${pos.block ? '' : `<p style="text-align:center;margin:0 0 20px"><button class="link" data-action="goal-new">Start a goal: a 4 to 8 week plan</button></p>`}
    ${group(workouts + row({ title: 'New workout', sub: 'Pick the exercises yourself', icon: 'plus', color: 'green', to: 'plan/new' })
      + row({ title: 'Build a program', sub: 'Choose a focus; get workouts that fit you', icon: 'sliders', color: 'blue', to: 'builder' }), { header: 'Workouts', footer: 'Tap a workout to see it, change it or start it.' })}
    ${group((pick && !['warmup', 'mobility'].includes(pick.id) ? play(pick.id, pick.why) : '')
      + play('warmup', 'Before you play') + play('mobility', 'Any day')
      + more('court', 'More for padel days', 'Between matches and after playing', 'racket', 'teal')
      + more('prehab', 'Injury prevention', 'Elbow, shoulder, knee, calf and back', 'heart', 'pink')
      + more('stretch', 'Stretches', 'After your workout', 'wave', 'blue'), { header: 'Routines', footer: 'They run hands-free, step by step.' })}
    ${challengesCard()}
    ${group(row({ title: 'Exercise library', sub: 'Browse, filter by equipment, import your own', icon: 'dumbbell', color: 'gray', to: 'library' }))}`;
}
// One kind of routine in a sheet (injury prevention puts yours first).
function routinesSheet(kind) {
  const pre = prehabFor(S.profile, S.sessions, Date.now(), { cleared: S.painClear });
  const list = Object.values(COURT_ROUTINES).filter(r => r.kind === kind && r.id !== 'warmup').sort((a, b) => pre.ids.includes(b.id) - pre.ids.includes(a.id));
  const title = { court: 'Padel days', prehab: 'Injury prevention', stretch: 'Stretches' }[kind];
  app.sheet(`<h2 class="sheet-title">${esc(title)}</h2><div style="height:12px"></div>
    ${group(list.map(r => { const [ic, color] = LOOK[r.id] || ['heart', 'pink'];
      return row({ title: esc(r.title), sub: `${routineMinutes(r)} min · ${pre.ids.includes(r.id) ? '<span class="blue">Recommended for you</span>' : esc(r.tag)}`, icon: ic, color, to: `court/${r.id}` }); }).join(''),
      { footer: kind === 'prehab' ? 'Two or three times a week. Mild discomfort that settles by the next day is normal; sharp pain is not.' : kind === 'stretch' ? 'Gentle holds, never into pain.' : '' })}`);
}

function playerView(r) {
  if (!P || P.id !== r.id) P = { id: r.id, steps: expandSteps(r), i: -1, startedAt: 0, done: false };
  const nav = navBar({ back: 'Train', backAction: 'cp-exit', title: P.i >= 0 && !P.done ? r.title : '' });
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
    'routines-sheet'(el) { routinesSheet(el.dataset.kind); },
    'shot-sheet'(el) { shotSheet(el.dataset.id); },
    'shot-log'(el) { app.closeSheet(); activitySheet('padel', null, null, el.dataset.id); },
    async 'shot-focus'(el) { S.settings.focusShot = el.dataset.id; await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Focus shot set'); },
    'cp-start'() { P.startedAt = Date.now(); startStep(0); beep(true); app.render(); },
    'cp-pause'() { if (P.paused != null) { P.endAt = Date.now() + P.paused * 1000; P.paused = null; } else P.paused = remaining(); app.render({ keepScroll: true }); },
    'cp-next'() { if (P.i >= P.steps.length - 1) P.done = true; else startStep(P.i + 1); app.render({ keepScroll: true }); },
    'cp-prev'() { startStep(Math.max(0, P.i - 1)); app.render({ keepScroll: true }); },
    'cp-exit'() { P = null; clearInterval(tick); wake?.release?.(); app.go('court'); },
    async 'cp-log'() {
      const r = COURT_ROUTINES[P.id], dur = Math.max(1, Math.round((Date.now() - P.startedAt) / 60000));
      const rec = { ...createActivity({ activity: 'mobility', startedAt: P.startedAt, durationMin: dur, rpe: 3, notes: '' }), title: r.title, routine: r.id,
        // Mobility on a recovery day is the day's session: it keeps your weekly streak going.
        ...(app.planOn() === 'Recovery' ? { recoveryDay: true } : {}) };
      await db.putSession(rec); await app.reloadSessions();
      P = null; wake?.release?.(); app.go('court'); app.toast(`${r.title} saved`);
    },
  },
};
