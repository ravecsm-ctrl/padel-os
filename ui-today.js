import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, icon, chev, tile, pageHead, group, row, chips, seg, routineLook, ringStat } from './ui-kit.js';
import { readinessScore, isRoutine, allRoutineIds } from './domain-program.js';
import { dayKey, weekDates, isoDate, relDay, parseISO, mondayOf, breakInfo, startForWeek } from './domain-calendar.js';
import { weeklySeries, loadTrend, trainingDays, weekStreak } from './domain-analytics.js';
import { createWorkout, createActivity, workoutStats, applySupersets, createQuickWorkout } from './domain-workout.js';
import { COURT_ROUTINES, routineMinutes } from './domain-court.js';
import { prehabFor, PADEL_TYPES } from './domain-padel.js';
import { AREAS } from './domain-personalize.js';
import { sessionEffortChips, mname } from './ui-words.js';
import { recoveryCard, currentRecovery } from './ui-recovery.js';
import { adaptWorkout } from './domain-adaptive.js';
import { calibrate, colorFor } from './domain-recovery.js';
import { phaseFor, DAYS } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { MUSCLES } from './domain-taxonomy.js';
import { saveBackup } from './ui-backup.js';
import { reviewBanner } from './ui-review.js';
import { taperFor, taperText, tournamentSummary } from './domain-goals.js';
import { recentPain, painWithProfile, painHits, areaName } from './domain-pain.js';
import { applyPainHolds } from './ui-workout.js';

const lastDone = id => app.strength.find(s => s.routineId === id);
const ACTIVITIES = [['padel', 'Padel'], ['cardio', 'Cardio'], ['mobility', 'Mobility'], ['other', 'Other']];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(ch|sh|s|x)$/.test(w) ? 'es' : 's'}`;

export function banners({ resumeOnly = false } = {}) {
  let out = '';
  if (S.active) {
    const st = workoutStats(S.active);
    out += `<button class="banner" data-action="resume">${tile('play', 'blue')}<span><b>Continue your workout</b><small>${esc(S.active.title)} · ${st.sets} of ${st.planned} sets done</small></span>${chev}</button>`;
  }
  if (resumeOnly) return out;
  if (!S.profile.onboarded) out += `<button class="banner" data-action="go" data-to="welcome">${tile('sliders', 'blue')}<span><b>Personalise your plan</b><small>Takes 30 seconds. Your history is kept.</small></span>${chev}</button>`;
  const br = breakInfo(S.sessions, app.position().week, { acknowledged: S.settings.breakAck || 0 });
  if (br) out += `<div class="banner">${tile('today', 'blue')}<span><b>Welcome back</b><small>${br.days} days since your last workout, and your plan is on week ${app.position().week}. Restart at week 1 to build back up?</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="cycle-restart" style="font-size:15px">Restart</button><button class="link" data-action="cycle-keep" data-ts="${br.lastTs}" style="font-size:13px">Keep week ${app.position().week}</button></span></div>`;
  const tr = loadTrend(weeklySeries(S.sessions, 5));
  if (tr.ratio != null && tr.ratio > 1.5) out += `<div class="banner warn">${tile('flame', 'orange')}<span><b>Big week</b><small>You’ve trained about ${tr.ratio}× more than usual. Consider an easier day.</small></span></div>`;
  const tp = taperFor(S.settings.tournament);
  if (tp && !tp.noGym) {
    const sum = tp.phase === 'recover' ? tournamentSummary(S.sessions, S.settings.tournament) : null;
    const res = sum?.matches ? `${plural(sum.matches, 'match')}${sum.won + sum.lost ? `, ${sum.won}–${sum.lost}` : ''}. ` : '';
    out += `<button class="banner" data-action="go" data-to="overview">${tile('trophy', 'teal')}<span><b>${esc(tp.phase === 'recover' ? `After ${tp.name}` : tp.phase === 'taper' ? 'Tournament week' : `${tp.name} coming up`)}</b><small>${esc(res + taperText(tp))}</small></span>${chev}</button>`;
  }
  // Everything lives on this phone, so nudge a backup from the first saved session, then weekly.
  if (S.sessions.length) {
    const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 86400000) : null;
    const snoozed = Date.now() - (S.settings.backupSnooze || 0) < 7 * 86400000;
    // A slim strip, not a card: it matters, but it shouldn't compete with today's workout.
    if ((days == null || days >= 7) && !snoozed) out += `<div class="strip">${icon('download')}<span>${days == null ? 'Your workouts are only on this phone.' : `Last backup ${days} days ago.`}</span><button data-action="quick-backup">Back Up</button><button class="later" data-action="backup-later">Later</button></div>`;
  }
  return out;
}

// After you log soreness or pain: say what the app will do about it, so you know it listened.
// Workout pain counts straight away; padel soreness once it comes back (see recentPain).
// How long a new session probably lasted: same as your last one of that kind. Tournament
// matches are shorter, so on tournament day it's 45 min unless you've already logged one there.
function defaultMinutes(kind, iso) {
  const last = S.sessions.filter(s => s.kind === 'activity' && s.activity === kind).sort((a, b) => b.startedAt - a.startedAt);
  const t = S.settings.tournament;
  if (kind === 'padel' && t?.date === iso) return last.find(s => isoDate(new Date(s.startedAt)) === iso)?.durationMin || 45;
  return last[0]?.durationMin || (kind === 'padel' ? 90 : 45);
}

export function soreNote(areas) {
  if (!areas?.length) return '';
  const pain = recentPain(S.sessions, { cleared: S.painClear }), names = l => l.map(a => areaName(a).toLowerCase()).join(' and ');
  const on = areas.filter(a => pain[a]), later = areas.filter(a => !pain[a]);
  if (on.length) return `Workouts will offer gentler options for your ${names(on)} for now.`;
  return `Noted. If your ${names(later)} ${later.length > 1 ? 'are' : 'is'} sore after another match, workouts will start going easier on ${later.length > 1 ? 'them' : 'it'}.`;
}

// One line on the workout card when today's plan should go easier: pain first, then recovery.
function recoveringHint(routineId) {
  const r = app.routine(routineId);
  const pain = painWithProfile(S.sessions, S.profile, { cleared: S.painClear }), hurt = [...new Set(r.blocks.flatMap(b => painHits(b.ex, pain)))];
  if (hurt.length) return `Gentler options ready for your ${hurt.slice(0, 2).map(a => areaName(a).toLowerCase()).join(' and ')}`;
  if (S.settings.adaptive === false) return '';
  const rec = currentRecovery();
  const tired = [...new Set(r.blocks.flatMap(b => getExercise(b.ex)?.primary || []))].map(m => [m, rec[m]?.level || 0]).filter(([, l]) => l >= 0.35).sort((a, b) => b[1] - a[1]);
  if (!tired.length) return '';
  const names = tired.slice(0, 2).map(([m]) => mname(m).toLowerCase()).join(' and ');
  return tired[0][1] >= 0.6 ? `Lighter today: ${names} still recovering` : `${names[0].toUpperCase() + names.slice(1)} still recovering`;
}

// The next scheduled workout after today: { id, when: 'Tomorrow' | 'Wednesday' }.
function nextPlanned() {
  const names = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  for (let i = 1; i <= 7; i++) { const d = DAYS[(DAYS.indexOf(dayKey()) + i) % 7]; if (isRoutine(S.schedule[d])) return { id: S.schedule[d], when: i === 1 ? 'Tomorrow' : names[d] }; }
  return null;
}

function hero() {
  const plan = S.schedule[dayKey()];
  const doneToday = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === isoDate());
  const tp = taperFor(S.settings.tournament);
  // On tournament day the tournament card stays up after each match (that's when you need it most).
  // Done: a compact line (the work is behind you), then what's coming next.
  if (doneToday.length && !S.active && tp?.phase !== 'day') {
    const next = nextPlanned();
    // With a workout and a match (or a warm-up) on the same day, the workout leads and is the summary you open.
    const done = [...doneToday].sort((a, b) => (b.kind === 'strength') - (a.kind === 'strength'));
    return `<section class="card"><button class="done-card" data-action="go" data-to="history/session/${esc(done[0].id)}" style="width:100%;text-align:left">${tile('check', 'green')}<span class="row-main"><b>Done today</b><small>${esc(done.map(s => s.title).join(' + '))} · see summary</small></span>${chev}</button>
      ${next ? `<button class="done-next" data-action="go" data-to="plan/routine/${esc(next.id)}">${tile(routineLook(next.id).icon, 'gray')}<span class="row-main"><span class="row-title">Next: ${esc(app.routine(next.id).title)}</span><small>${esc(next.when)}</small></span>${chev}</button>` : ''}</section>`;
  }
  if (tp?.noGym) {
    const day = tp.phase === 'day', sum = day ? tournamentSummary(S.sessions, S.settings.tournament) : null, played = sum?.matches || 0;
    const sore = sum ? Object.keys(sum.sore).map(a => AREAS[a].split(' ')[0].toLowerCase()) : [];
    const so = played ? `<div class="tiles three" style="margin:4px 0 16px">${['Matches', 'Won–lost', 'Minutes'].map((l, i) => `<div class="tile-stat"><b class="num">${[played, `${sum.won}–${sum.lost}`, sum.minutes][i]}</b><small>${l}</small></div>`).join('')}</div>${sore.length ? `<p class="hero-note orange">Sore so far: ${esc(sore.join(', '))}. Ease off where you can.</p>` : ''}` : '';
    return `<section class="card hero"><div class="hero-top">${tile('trophy', 'teal', true)}<div><p class="t-foot">${day ? 'Today' : tp.days === 1 ? 'Tomorrow' : 'In 2 days'}</p><h2>${esc(tp.name)}</h2><p class="t-sub">${day ? 'Tournament day' : 'Rest up before you play'}</p></div></div>
      ${played ? so : `<p class="hero-note">${esc(taperText(tp))}</p>`}
      <div class="btns">${day ? (played
        ? `<button class="btn filled" data-action="log-activity" data-kind="padel">Log Another Match</button><button class="btn tinted" data-action="go" data-to="court/between">${icon('play')}Between Matches · ${routineMinutes(COURT_ROUTINES.between)} min</button>`
        : `<button class="btn filled" data-action="go" data-to="court/warmup">${icon('play')}Warm Up · ${routineMinutes(COURT_ROUTINES.warmup)} min</button><button class="btn tinted" data-action="log-activity" data-kind="padel">Log a Match</button>`)
        : `<button class="btn filled" data-action="go" data-to="court/mobility">${icon('play')}Daily Mobility · ${routineMinutes(COURT_ROUTINES.mobility)} min</button>${isRoutine(plan) && !S.active ? `<button class="btn plain" data-action="start" data-routine="${plan}">Train anyway</button>` : ''}`}</div></section>`;
  }
  if (isRoutine(plan)) {
    const r = app.routine(plan), look = routineLook(plan), last = lastDone(plan);
    return `<section class="card hero"><div class="hero-top">${tile(look.icon, look.color, true)}<div><p class="t-foot">Up next</p><h2>${esc(r.title)}</h2><p class="t-sub">${plural(r.blocks.length, 'exercise')} · about ${r.minutes} min</p></div></div>
      <p class="hero-note">${esc(r.focus)}${last ? '' : ' Your first session sets your starting weights.'}</p>
      ${(() => { const h = recoveringHint(plan); return h ? `<p class="hero-note orange" style="margin-top:-6px">${esc(h)}</p>` : ''; })()}
      ${S.active ? '' : feelCard()}
      ${S.active ? '' : `<button class="btn filled" data-action="start" data-routine="${plan}">${icon('play')}Start Workout</button>`}</section>`;
  }
  if (plan === 'Padel') {
    return `<section class="card hero"><div class="hero-top">${tile('racket', 'teal', true)}<div><p class="t-foot">Today</p><h2>Padel day</h2><p class="t-sub">Warm up, play, then log it</p></div></div>
      <div class="btns"><button class="btn filled" data-action="go" data-to="court/warmup">${icon('play')}Warm Up · ${routineMinutes(COURT_ROUTINES.warmup)} min</button>
      <button class="btn tinted" data-action="log-activity" data-kind="padel">Log Match</button></div></section>`;
  }
  const rec = plan === 'Recovery';
  return `<section class="card hero"><div class="hero-top">${tile(rec ? 'heart' : 'snow', rec ? 'pink' : 'gray', true)}<div><p class="t-foot">Today</p><h2>${rec ? 'Recovery day' : 'Rest day'}</h2><p class="t-sub">${rec ? 'Light movement only' : 'Take it easy'}</p></div></div>
    <p class="hero-note">${rec ? 'A walk, some mobility or an injury-prevention routine is perfect today.' : 'Full rest helps you come back stronger.'}</p>
    <button class="btn tinted" data-action="${rec ? 'go' : 'log-activity'}" ${rec ? 'data-to="court"' : 'data-kind="mobility"'}>${rec ? 'Browse Routines' : 'Log an Activity'}</button></section>`;
}

// ── One-tap check-in on Today: how you feel sets today's workout before you press Start.
// Each answer stands for a full check-in (sleep, energy, soreness: 1–5) so the workout adapts as it did from the sheet.
export const FEELS = {
  great: { label: 'Great', r: { sleep: 5, energy: 5, soreness: 1 }, says: 'Feeling great. Training as planned.' },
  good: { label: 'Good', r: { sleep: 4, energy: 4, soreness: 1 }, says: 'Feeling good. Training as planned.' },
  tired: { label: 'Tired', r: { sleep: 2, energy: 2, soreness: 2 }, says: 'Feeling tired. Today’s workout will be lighter: one fewer set and easier effort.' },
  sore: { label: 'Sore', r: { sleep: 3, energy: 3, soreness: 4 }, says: 'Feeling sore. When you start, tap where so we go easy there.' },
};
// Today's answer, or null (yesterday's doesn't count).
export const todayFeel = () => { const c = S.settings.checkin; return c?.date === isoDate() && FEELS[c.feel] ? c : null; };
function feelCard() {
  if (!S.settings.readinessPrompt) return '';
  const c = todayFeel();
  if (c) return `<p class="hero-note feel-said">${esc(FEELS[c.feel].says)} <button class="link" data-action="feel-clear">Change</button></p>`;
  return `<div class="feel"><p class="feel-q">How do you feel today?</p><div class="feel-row">${Object.entries(FEELS).map(([k, f]) => `<button class="feel-btn" data-action="feel" data-feel="${k}">${f.label}</button>`).join('')}</div></div>`;
}

// ── The court panel's rings: how ready you are for today, this week's workouts, your streak.
const UPPER = ['front_delts', 'side_delts', 'rear_delts', 'rotator_cuff', 'serratus', 'upper_chest', 'chest', 'lower_chest', 'traps', 'mid_back', 'lats', 'biceps', 'triceps', 'forearms'];
const CORE = ['abs', 'obliques', 'lower_back', 'hip_flexors'];
const LEGS = ['glutes', 'glute_med', 'adductors', 'quads', 'hamstrings', 'calves', 'soleus', 'shins'];
const readyPct = (rec, ms) => ms.length ? Math.round(100 * (1 - ms.reduce((n, m) => n + (rec[m]?.level || 0), 0) / ms.length)) : 100;
function rings() {
  if (!S.sessions.length) return '';
  const rec = currentRecovery(), plan = S.schedule[dayKey()];
  const muscles = isRoutine(plan) ? [...new Set(app.routine(plan).blocks.flatMap(b => getExercise(b.ex)?.primary || []))] : [...UPPER, ...CORE, ...LEGS];
  const feel = isRoutine(plan) ? todayFeel()?.feel : null;
  const ready = Math.round(readyPct(rec, muscles) * (feel === 'tired' ? 0.75 : feel === 'sore' ? 0.85 : 1)), planned = Object.values(S.schedule).filter(isRoutine).length;
  const done = app.strength.filter(s => s.startedAt >= mondayOf().getTime()).length, streak = weekStreak(S.sessions);
  const readyColor = ready >= 75 ? 'var(--ball)' : ready >= 50 ? '#FFD60A' : '#FF9F0A';
  return `<button class="court-rings" data-action="go" data-to="recovery" aria-label="Ready ${ready}%, ${done} of ${planned} workouts this week, ${streak} week streak">
    ${ringStat(ready / 100, readyColor, `${ready}%`, '', isRoutine(plan) ? 'Ready for today' : 'Ready')}
    ${ringStat(planned ? done / planned : 0, '#64D2FF', `${done}/${planned || done}`, '', 'This week')}
    ${ringStat(Math.min(1, streak / 8), '#FFFFFF', String(streak), streak === 1 ? 'week' : 'weeks', 'Streak')}</button>`;
}

// Recovery at a glance: three bars instead of the full body map (one tap opens it).
function recoveryStrip() {
  if (!S.sessions.some(s => Date.now() - s.startedAt < 8 * 86400000)) return '';
  const rec = currentRecovery(), part = (label, ms) => { const p = readyPct(rec, ms); return `<div class="rs-part"><span>${label}</span><i><b style="width:${p}%;background:${colorFor(1 - p / 100)}"></b></i><em>${p}%</em></div>`; };
  return `<section class="grp"><h2 class="grp-h big">Recovery</h2><button class="card rec-strip" data-action="go" data-to="recovery">
    ${part('Upper body', UPPER)}${part('Core', CORE)}${part('Legs', LEGS)}<p class="t-foot">Tap for the body map and each muscle ${chev}</p></button></section>`;
}

function weekCard() {
  const days = trainingDays(S.sessions), today = isoDate();
  const planned = Object.values(S.schedule).filter(isRoutine).length;
  const mon = mondayOf().getTime();
  const done = app.strength.filter(s => s.startedAt >= mon).length, matches = S.sessions.filter(s => s.activity === 'padel' && s.startedAt >= mon).length;
  return `<section class="grp"><h2 class="grp-h big">This week</h2><div class="card"><div class="week">${weekDates().map(d => {
    const did = days.get(d.iso) || [], plan = S.schedule[d.key];
    const cls = did.length ? `done ${did.includes('gym') ? '' : 'padel'}` : isRoutine(plan) ? 'plan-gym' : plan === 'Padel' ? 'plan-padel' : 'rest';
    return `<div class="${d.iso === today ? 'today' : ''}"><small>${d.key[0]}</small><span class="dot ${cls}" aria-label="${d.key}: ${did.length ? 'done' : esc(plan)}">${did.length ? icon('check') : ''}</span></div>`;
  }).join('')}</div>
  <p class="week-foot"><b>${done}</b> of ${plural(planned || done, 'workout')}${matches ? ` · <b>${matches}</b> ${matches === 1 ? 'match' : 'matches'}` : ''}</p>
  <div class="week-key"><span><i style="background:var(--blue)"></i>Gym</span><span><i style="background:var(--teal)"></i>Padel</span><span><i class="ring"></i>Planned</span></div></div></section>`;
}

function stayHealthy() {
  const pre = prehabFor(S.profile, S.sessions, Date.now(), { cleared: S.painClear });
  if (!pre.ids.length) return '';
  return group(pre.ids.map(id => { const r = COURT_ROUTINES[id]; const n = pre.flagged[r.areas[0]];
    return row({ title: esc(r.title), sub: `${routineMinutes(r)} min · ${r.areas.some(a => pre.hurt[a]) ? 'you reported pain here recently' : n >= 2 ? `you flagged this ${n}× recently` : 'from your profile'}`, icon: 'heart', color: 'pink', to: `court/${id}` }); }).join(''),
  { header: 'Stay healthy', big: true });
}

export const today = {
  render() {
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const initial = (S.settings.name || '').trim()[0];
    const avatar = `<button class="avatar" data-action="go" data-to="settings" aria-label="Settings">${initial ? esc(initial.toUpperCase()) : icon('person')}</button>`;
    const todays = S.schedule[dayKey()];
    const others = allRoutineIds().filter(id => id !== todays || S.active);
    const loc = app.location();
    return `${pageHead('Today', { eyebrow: date, right: avatar, sub: loc ? `Training at <button class="link" data-action="loc-sheet">${esc(loc.name)} ▾</button>` : '' })}
      ${banners()}${reviewBanner()}<div class="court-stack">${hero()}${rings()}</div>
      <div style="height:28px"></div>${weekCard()}${recoveryStrip()}${stayHealthy()}
      ${group(others.map(id => { const r = app.routine(id), look = routineLook(id), last = lastDone(id);
        return row({ title: esc(r.title), sub: `About ${r.minutes} min · ${last ? `last done ${esc(relDay(last.startedAt).toLowerCase())}` : 'not done yet'}`, icon: look.icon, color: look.color, action: S.active ? 'resume' : 'start', data: { routine: id } }); }).join('')
        + row({ title: 'Quick workout', sub: 'No plan: add exercises as you go', icon: 'bolt', color: 'indigo', action: 'quick-start' })
        + row({ title: 'Log a match or activity', icon: 'racket', color: 'teal', action: 'log-activity' })
        + row({ title: 'Warm up before playing', sub: `${routineMinutes(COURT_ROUTINES.warmup)} min, guided`, icon: 'flame', color: 'orange', to: 'court/warmup' }),
        { header: 'More', big: true })}
      ${S.sessions.length ? `<p class="t-foot" style="text-align:center;margin:8px 0 4px">${S.lastBackup ? `Last backup ${esc(relDay(S.lastBackup).toLowerCase())}` : 'Not backed up yet'} · <button class="link" data-action="quick-backup" style="font-size:inherit">Back up now</button></p>` : ''}`;
  },
  actions: {
    'past-start'(el) { startPast(el.dataset.id, el.dataset.iso); },
    async feel(el) { S.settings.checkin = { date: isoDate(), feel: el.dataset.feel }; await app.save('settings'); app.render({ keepScroll: true }); },
    async 'feel-clear'() { delete S.settings.checkin; await app.save('settings'); app.render({ keepScroll: true }); },
    'quick-backup'() { saveBackup(); },
    async 'backup-later'() { S.settings.backupSnooze = Date.now(); await app.save('settings'); app.render({ keepScroll: true }); app.toast('Reminder again in a week. Back up any time in Settings.'); },
    async 'quick-start'() {
      if (S.active) return app.go('workout');
      S.active = createQuickWorkout({ week: app.position().week });
      await app.saveActive(true); app.go('workout');
    },
    async 'cycle-restart'() { S.settings.programStart = startForWeek(1, S.settings.programStart); await app.save('settings'); app.render({ keepScroll: true }); app.toast('Plan restarted at week 1'); },
    async 'cycle-keep'(el) { S.settings.breakAck = +el.dataset.ts; await app.save('settings'); app.render({ keepScroll: true }); },
    start(el) { startFlow(el.dataset.routine); },
    resume() { app.go('workout'); },
    async 'discard-active'() {
      if (!(await app.confirm('Discard the workout in progress?', { ok: 'Discard', danger: true }))) return;
      const old = S.active; S.active = null; await app.saveActive(true); app.render();
      app.toast('Workout discarded', async () => { S.active = old; await app.saveActive(true); app.render(); });
    },
    'log-activity'(el) { activitySheet(el.dataset.kind || 'padel'); },
  },
};

// ── Start flow with an optional 10-second check-in
const SCALE = {
  sleep: ['How did you sleep?', ['Badly', 'So-so', 'OK', 'Well', 'Great']],
  energy: ['Energy level', ['Empty', 'Low', 'OK', 'Good', 'High']],
  soreness: ['Muscle soreness', ['None', 'A little', 'Some', 'Sore', 'Very']],
};
function startFlow(routineId) {
  if (S.active) return app.go('workout');
  if (!S.settings.readinessPrompt) return begin(routineId, null, false);
  // Answered on Today already: start straight away. Sore still asks where, so it can go easy there.
  const said = todayFeel();
  if (said && said.feel !== 'sore') { const r = FEELS[said.feel].r; return begin(routineId, r, readinessScore(r).label === 'Low'); }
  // Muscles this workout relies on, most tired first, so you can flag soreness.
  const rec = currentRecovery();
  const muscles = [...new Set(app.routine(routineId).blocks.flatMap(b => getExercise(b.ex)?.primary || []))].sort((a, b) => rec[b].level - rec[a].level).slice(0, 8);
  // Nothing is pre-selected: unanswered questions count as average, and if you answer none it's a skip.
  S.form = { sleep: null, energy: null, soreness: null, ...(said ? FEELS[said.feel].r : {}), light: null, sore: [] };
  const answered = () => ['sleep', 'energy', 'soreness'].some(k => S.form[k] != null);
  const filled = () => ({ sleep: +(S.form.sleep ?? 3), energy: +(S.form.energy ?? 3), soreness: +(S.form.soreness ?? 1) });
  const draw = () => {
    const sc = readinessScore(filled()), low = sc.label === 'Low';
    const light = S.form.light ?? low;
    return `<h2 class="sheet-title">How do you feel today?</h2><p class="sheet-sub">We’ll adjust today’s workout if you need a lighter day.</p>
      ${Object.entries(SCALE).map(([k, [q, opts]]) => `<label class="field-l">${q}</label>${seg(k, opts.map((o, i) => [i + 1, o]), S.form[k])}`).join('')}
      ${muscles.length ? `<label class="field-l">Sore anywhere? <small>(optional)</small></label><div class="chipset">${muscles.map(m => `<button type="button" class="chip-btn ${S.form.sore.includes(m) ? 'warn-on' : ''}" data-sore-m="${m}" aria-pressed="${S.form.sore.includes(m)}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colorFor(rec[m].level)};margin-right:6px"></span>${esc(mname(m))}</button>`).join('')}</div>` : ''}
      <div style="height:20px"></div>
      ${group(row({ title: 'Lighter workout today', sub: !answered() ? 'Optional. Answer above and we’ll suggest.' : low ? 'Recommended: one fewer set and easier effort.' : sc.label === 'Moderate' ? 'Optional. You seem OK to train.' : 'You seem ready to train as planned.', right: `<input type="checkbox" class="switch" id="lightToggle" ${light ? 'checked' : ''} aria-label="Lighter workout today">` }))}
      <div class="btns"><button class="btn filled" id="go">${icon('play')}Start Workout</button><button class="btn plain" id="skipCheck">Skip check-in</button></div>`;
  };
  const mount = body => {
    body.querySelector('#lightToggle').onchange = e => { S.form.light = e.target.checked; };
    body.querySelectorAll('[data-sore-m]').forEach(b => b.onclick = () => { const m = b.dataset.soreM; S.form.sore = S.form.sore.includes(m) ? S.form.sore.filter(x => x !== m) : [...S.form.sore, m]; app.sheet(draw(), mount); });
    body.querySelector('#skipCheck').onclick = () => { app.closeSheet(); begin(routineId, null, false, [], []); };
    body.querySelector('#go').onclick = () => { const r = answered() ? filled() : null; app.closeSheet(); begin(routineId, r, S.form.light ?? (r ? readinessScore(r).label === 'Low' : false), S.form.sore, muscles); };
  };
  app.sheet(draw(), mount);
  app.onPick = () => app.sheet(draw(), mount);
}

async function begin(routineId, readiness, light, sore = [], asked = []) {
  const week = app.position().week, tp = taperFor(S.settings.tournament);
  // Before (and just after) a tournament every workout is the lighter version.
  if (tp?.lighter || tp?.noGym) { light = true; app.toast(tp.phase === 'recover' ? 'Easy session while you recover from the tournament' : 'Tournament week: lighter workout today'); }
  const w = createWorkout({ routineId, week, history: app.strength, overrides: S.overrides, unit: S.settings.unit, readiness, light, profile: app.location() ? { ...S.profile, owned: app.location().equipment } : S.profile });
  const rec = currentRecovery();
  // Only explicit answers teach the model: a muscle you marked sore. (Not ticking one isn't the same as "feels fine".)
  if (sore.length) { for (const m of sore) S.recoveryCal = calibrate(S.recoveryCal, m, true, rec[m].level); app.save('recoveryCal'); }
  if (S.settings.adaptive !== false) {
    const tomorrow = DAYS[(DAYS.indexOf(dayKey()) + 1) % 7];
    adaptWorkout(w, { rec, sore, readiness: readiness ? readinessScore(readiness) : null, padelTomorrow: S.schedule[tomorrow] === 'Padel', loadRatio: loadTrend(weeklySeries(S.sessions, 5)).ratio || 0,
      deload: phaseFor(week).loadMult < 1, level: S.profile.level, history: app.strength, unit: S.settings.unit });
  }
  applySupersets(w, S.supersets[routineId]);
  applyPainHolds(w);
  S.active = w;
  await app.saveActive(true);
  db.requestPersistence();
  app.go('workout');
}

// ── Past workouts: log a gym session you forgot, on the day you did it.
export function pastWorkoutSheet(iso) {
  if (S.active) { app.closeSheet(); app.toast('Finish or discard the workout in progress first'); return app.go('workout'); }
  const d = parseISO(iso), planned = S.schedule[DAYS[(d.getDay() + 6) % 7]];
  const ids = [...new Set([...(isRoutine(planned) ? [planned] : []), ...allRoutineIds()])];
  app.sheet(`<h2 class="sheet-title">Which workout?</h2><p class="sheet-sub">${esc(d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}. You’ll fill in your sets next.</p>
    ${group(ids.map(id => { const r = app.routine(id), look = routineLook(id); return row({ title: esc(r.title), sub: `${r.blocks.length} exercise${r.blocks.length === 1 ? "" : "s"}${id === planned ? ' · planned that day' : ''}`, icon: look.icon, color: look.color, action: 'past-start', data: { id, iso } }); }).join('')
      + row({ title: 'Something else', sub: 'Pick the exercises you did', icon: 'bolt', color: 'indigo', action: 'past-start', data: { id: '', iso } }))}
    <button class="btn gray" data-action="close-sheet">Cancel</button>`);
}
export async function startPast(routineId, iso) {
  const d = parseISO(iso); d.setHours(18, 0, 0, 0);
  if (!routineId) { S.active = createQuickWorkout({ week: app.position().week, startedAt: d.getTime() }); app.closeSheet(); await app.saveActive(true); return app.go('workout'); }
  const w = createWorkout({ routineId, week: app.position().week, history: app.strength, overrides: S.overrides, unit: S.settings.unit, startedAt: d.getTime(), profile: app.location() ? { ...S.profile, owned: app.location().equipment } : S.profile });
  applySupersets(w, S.supersets[routineId]);
  S.active = w; app.closeSheet();
  await app.saveActive(true);
  app.go('workout');
}

// ── Activity (padel etc.) logging
export function activitySheet(kind = 'padel', existing = null, date = null) {
  const pd = existing?.padel || {};
  S.form = existing ? { activity: existing.activity, duration: existing.durationMin, rpe: existing.rpe, date: isoDate(new Date(existing.startedAt)), notes: existing.notes,
    ptype: pd.type || 'match', result: pd.result || 'none', score: pd.score || '', partner: pd.partner || '', side: pd.side || '', sore: [...(pd.sore || [])] }
    : { activity: kind, duration: defaultMinutes(kind, date || isoDate()), rpe: 7, date: date || isoDate(), notes: '', ptype: 'match', result: 'none', score: '', partner: '', side: '', sore: [] };
  const f = () => S.form;
  const draw = () => {
    const padel = f().activity === 'padel', match = padel && ['match', 'americano'].includes(f().ptype);
    return `<h2 class="sheet-title">${existing ? 'Edit' : padel ? 'Log Padel' : 'Log Activity'}</h2>
    <div style="height:8px"></div>${seg('activity', ACTIVITIES, f().activity)}
    ${padel ? `<label class="field-l">Type</label>${seg('ptype', Object.entries(PADEL_TYPES), f().ptype)}` : ''}
    ${match ? `<label class="field-l">Result</label>${seg('result', [['won', 'Won'], ['lost', 'Lost'], ['none', 'Skip']], f().result)}
      <div class="grid2"><input class="input" id="scoreIn" placeholder="Score (optional)" value="${esc(f().score)}" aria-label="Score"><input class="input" id="partnerIn" placeholder="Partner (optional)" value="${esc(f().partner)}" aria-label="Partner"></div>` : ''}
    ${padel ? `<label class="field-l">Side you played</label>${seg('side', [['drive', 'Right'], ['reves', 'Left'], ['both', 'Both']], f().side)}` : ''}
    <label class="field-l">How long?</label>${chips('duration', [30, 45, 60, 90, 120], f().duration, v => `${v} min`)}
    <input class="input" id="durIn" type="number" inputmode="numeric" min="1" max="600" value="${esc(f().duration)}" aria-label="Minutes" style="margin-top:8px">
    <label class="field-l">How hard was it?</label>${sessionEffortChips('rpe', f().rpe)}
    ${padel ? `<label class="field-l">Anything sore afterwards?</label><div class="chipset">${Object.entries(AREAS).map(([k, v]) => `<button type="button" class="chip-btn ${f().sore.includes(k) ? 'warn-on' : ''}" data-sore="${k}" aria-pressed="${f().sore.includes(k)}">${esc(v)}</button>`).join('')}</div>` : ''}
    <label class="field-l" for="dateIn">Date</label><input class="input" id="dateIn" type="date" value="${esc(f().date)}" max="${isoDate()}">
    <label class="field-l" for="notesIn">Notes</label><textarea class="input" id="notesIn" rows="2" placeholder="Optional">${esc(f().notes)}</textarea>
    <div style="height:20px"></div><button class="btn filled" id="saveAct">${existing ? 'Save Changes' : 'Save'}</button>`;
  };
  const mount = body => {
    const bind = (id, key, ev = 'oninput') => { const el = body.querySelector(id); if (el) el[ev] = e => { f()[key] = e.target.value; }; };
    body.querySelector('#durIn').oninput = e => { f().duration = +e.target.value; };
    bind('#dateIn', 'date', 'onchange'); bind('#notesIn', 'notes'); bind('#scoreIn', 'score'); bind('#partnerIn', 'partner');
    body.querySelectorAll('[data-sore]').forEach(b => b.onclick = () => { const k = b.dataset.sore; f().sore = f().sore.includes(k) ? f().sore.filter(x => x !== k) : [...f().sore, k]; app.sheet(draw(), mount); });
    body.querySelector('#saveAct').onclick = async () => {
      const dur = +f().duration;
      if (!(dur > 0)) return app.toast('Add how many minutes');
      const d = parseISO(f().date || isoDate()), now = new Date();
      // Logged today = you just finished: it ended now and started `dur` minutes ago (not before midnight).
      if (isoDate(d) === isoDate(now)) d.setTime(Math.max(parseISO(isoDate(now)).getTime(), now.getTime() - dur * 60000));
      else d.setHours(12);
      const t = S.settings.tournament, event = t?.date && t.date === isoDate(d) ? t.name || 'Tournament' : existing?.padel?.event;
      const padel = f().activity === 'padel' ? { type: f().ptype, result: ['match', 'americano'].includes(f().ptype) ? f().result : 'none', score: f().score.trim(), partner: f().partner.trim(), side: f().side, sore: f().sore, ...(event ? { event } : {}) } : undefined;
      const titleFor = () => padel ? (padel.type === 'match' ? 'Padel match' : `Padel ${PADEL_TYPES[padel.type].toLowerCase()}`) : ACTIVITIES.find(a => a[0] === f().activity)[1];
      const base = existing ? { ...existing, activity: f().activity, durationMin: dur, rpe: +f().rpe, notes: f().notes, startedAt: d.getTime(), endedAt: d.getTime() + dur * 60000 }
        : createActivity({ activity: f().activity, startedAt: d.getTime(), durationMin: dur, rpe: +f().rpe, notes: f().notes });
      const rec = { ...base, title: titleFor(), padel };
      await db.putSession(rec); await app.reloadSessions(); app.closeSheet();
      const note = existing ? '' : soreNote(padel?.sore);
      app.toast(`${existing ? 'Saved' : `${rec.title} saved`}${note ? `. ${note}` : ''}`);
      app.render({ keepScroll: true });
    };
  };
  app.onPick = () => app.sheet(draw(), mount);
  app.sheet(draw(), mount);
}
