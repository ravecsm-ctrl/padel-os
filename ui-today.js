import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, title, stat, chips } from './ui-kit.js';
import { ROUTINES, phaseFor, readinessScore } from './domain-program.js';
import { dayKey, weekDates, isoDate, relDay, parseISO } from './domain-calendar.js';
import { weeklySeries, loadTrend, trainingDays, weekStreak } from './domain-analytics.js';
import { createWorkout, createActivity, workoutStats } from './domain-workout.js';
import { COURT_ROUTINES, routineMinutes } from './domain-court.js';
import { prehabFor, PADEL_TYPES, SIDES } from './domain-padel.js';
import { AREAS } from './domain-personalize.js';
import { effortTarget, sessionEffortChips, loadUnit } from './ui-words.js';

const lastDone = id => app.strength.find(s => s.routineId === id);
const ACTIVITIES = [['padel', 'Padel'], ['cardio', 'Cardio'], ['mobility', 'Mobility'], ['other', 'Other']];

function resumeCard() {
  const w = S.active, st = workoutStats(w);
  return `<section class="card resume"><span class="eyebrow">IN PROGRESS · STARTED ${esc(relDay(w.startedAt).toUpperCase())}</span>
    <h3>${esc(w.title)}</h3><p>${st.sets} of ${st.planned} sets logged · exercise ${w.index + 1} of ${w.exercises.length}</p>
    <div class="row gap"><button class="btn secondary" data-action="discard-active">Discard</button><button class="btn primary" data-action="resume">Resume workout</button></div></section>`;
}

function hero() {
  const pos = app.position(), ph = phaseFor(pos.week), key = dayKey(), plan = S.schedule[key];
  const r = ROUTINES[plan] ? app.routine(plan) : null;
  const doneToday = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === isoDate());
  const eyebrow = `${key.toUpperCase()} · CYCLE ${pos.cycle} · WEEK ${pos.week} ${ph.name.toUpperCase()}`;
  if (doneToday.length && !S.active) {
    return `<section class="hero done"><span class="eyebrow">${eyebrow}</span><h2>Done for today ✓</h2>
      <p>${doneToday.map(s => esc(s.title)).join(' + ')} logged. Recovery is where adaptation happens.</p>
      <div class="row gap"><button class="btn secondary" data-action="go" data-to="history/session/${esc(doneToday[0].id)}">View session</button><button class="btn secondary" data-action="log-activity">Log activity</button></div></section>`;
  }
  if (r) {
    const last = lastDone(plan);
    return `<section class="hero"><span class="eyebrow">${eyebrow}</span><h2><span class="badge">${plan}</span> ${esc(r.title)}</h2><p>${esc(r.focus)}</p>
      <div class="stats">${stat(r.blocks.length, 'Exercises')}${stat(`~${r.minutes}`, 'Minutes')}${stat({ gym: 'Gym', db: 'Dumbbells', bw: 'Home' }[S.profile.equipment], 'Setup')}</div>
      <p class="meta">${last ? `Last done ${esc(relDay(last.startedAt).toLowerCase())}` : 'Not done yet — first session sets your baselines.'} Effort: ${esc(effortTarget(ph.rpe))}.</p>
      ${S.active ? '' : `<button class="btn primary big" data-action="start" data-routine="${plan}">Start Routine ${plan}</button>`}</section>`;
  }
  if (plan === 'Padel') return `<section class="hero calm"><span class="eyebrow">${eyebrow}</span><h2>Padel day</h2><p>Warm up before you play, then log the match so your load and body check are tracked.</p>
    <button class="btn primary big" data-action="go" data-to="court/warmup">Warm up · ${routineMinutes(COURT_ROUTINES.warmup)} min</button>
    <div class="row gap"><button class="btn secondary" data-action="log-activity" data-kind="padel">Log match</button><button class="btn secondary" data-action="go" data-to="court/cooldown">Cool-down</button></div></section>`;
  const copy = { Padel: ['Padel day', ''], Recovery: ['Recovery day', 'Easy movement, mobility, a walk. Keep it light.'], Rest: ['Rest day', 'Full rest. Sleep and food are training too.'] }[plan] || ['Open day', 'Pick whatever fits your readiness.'];
  return `<section class="hero calm"><span class="eyebrow">${eyebrow}</span><h2>${copy[0]}</h2><p>${copy[1]}</p>
    <button class="btn ${plan === 'Padel' ? 'primary big' : 'secondary'}" data-action="log-activity" data-kind="${plan === 'Padel' ? 'padel' : plan === 'Recovery' ? 'mobility' : ''}">${plan === 'Padel' ? 'Log padel session' : 'Log an activity'}</button></section>`;
}

function weekStrip() {
  const days = trainingDays(S.sessions), today = isoDate();
  return `<div class="week-strip">${weekDates().map(d => {
    const done = days.get(d.iso) || [], plan = S.schedule[d.key];
    return `<div class="day ${d.iso === today ? 'today' : ''} ${done.length ? 'done' : ''}"><small>${d.key[0]}</small><b>${ROUTINES[plan] ? plan : plan === 'Padel' ? 'P' : '·'}</b><i>${done.length ? '✓' : ''}</i></div>`;
  }).join('')}</div>`;
}

function weekSummary() {
  const series = weeklySeries(S.sessions, 5), cur = series[series.length - 1], tr = loadTrend(series);
  let note = '';
  if (tr.ratio != null && tr.ratio > 1.5) note = `<p class="warn">Load is ${tr.ratio}× your 4-week average. Consider trimming accessories or an easier padel day.</p>`;
  else if (tr.ratio != null && tr.ratio < 0.5 && cur.sessions) note = `<p class="meta">Lighter week so far (${tr.ratio}× average).</p>`;
  return `<div class="stats four">${stat(cur.sessions, 'Sessions')}${stat(cur.sets, 'Sets')}${stat(tr.current, `Load ${loadUnit()}`)}${stat(weekStreak(S.sessions), 'Streak (wk)')}</div>${note}`;
}

function prehabCard() {
  const pre = prehabFor(S.profile, S.sessions);
  if (!pre.ids.length) return '';
  return `${title('Stay healthy', 'RECOMMENDED FOR YOU · 2–3× A WEEK')}${pre.ids.map(id => { const r = COURT_ROUTINES[id]; return `<button class="card routine-card" data-action="go" data-to="court/${id}"><span class="badge alt">✚</span><span><b>${esc(r.title)}</b><small>${routineMinutes(r)} min · ${pre.flagged[r.areas[0]] >= 2 ? `flagged ${pre.flagged[r.areas[0]]}× in recent matches` : 'from your profile'}</small></span><span aria-hidden="true">›</span></button>`; }).join('')}`;
}

function personalizeCard() {
  if (S.profile.onboarded) return '';
  return `<button class="card nudge" data-action="go" data-to="welcome"><b>Personalise your plan · 30 s</b><small>Set your equipment, time per session and padel days. Your history is kept.</small></button>`;
}

function backupNudge() {
  if (S.sessions.length < 3) return '';
  const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 86400000) : null;
  if (days != null && days < 14) return '';
  return `<button class="card nudge" data-action="go" data-to="settings"><b>Back up your training data</b><small>${days == null ? 'You have never exported a backup.' : `Last backup ${days} days ago.`} Data lives only in this browser.</small></button>`;
}

export const today = {
  render() {
    const routineList = Object.keys(ROUTINES).map(id => {
      const r = app.routine(id), last = lastDone(id);
      return `<button class="card routine-card" data-action="start" data-routine="${id}" ${S.active ? 'disabled' : ''}><span class="badge">${id}</span><span><b>${esc(r.title)}</b><small>~${r.minutes} min · ${r.blocks.length} exercises · ${last ? esc(relDay(last.startedAt)) : 'never done'}</small></span><span aria-hidden="true">›</span></button>`;
    }).join('');
    return `${S.active ? resumeCard() : ''}${personalizeCard()}${hero()}
      ${title('This week', '')}${weekStrip()}${weekSummary()}
      ${backupNudge()}${prehabCard()}
      ${title('Train', 'ANY SESSION, ANY DAY')}<div class="routine-grid">${routineList}</div>
      <div class="row gap"><button class="btn secondary" data-action="log-activity">＋ Log match / activity</button><button class="btn secondary" data-action="go" data-to="court/warmup">◎ Warm-up</button></div>
      <p class="fine">General training information, not medical advice. Stop for sharp or worsening pain.</p>`;
  },
  actions: {
    start(el) { startFlow(el.dataset.routine); },
    resume() { app.go('workout'); },
    async 'discard-active'() {
      if (!(await app.confirm('Discard the in-progress workout? Logged sets will be lost.', { ok: 'Discard', danger: true }))) return;
      const old = S.active; S.active = null; await app.saveActive(true); app.render();
      app.toast('Workout discarded', async () => { S.active = old; await app.saveActive(true); app.render(); });
    },
    'log-activity'(el) { activitySheet(el.dataset.kind || 'padel'); },
  },
};

// ── Start flow with optional readiness check-in
function startFlow(routineId) {
  if (S.active) return app.go('workout');
  if (!S.settings.readinessPrompt) return begin(routineId, null, false);
  S.form = { sleep: 3, energy: 3, soreness: 2, light: null };
  const draw = () => {
    const sc = readinessScore(S.form), low = sc.label === 'Low';
    const light = S.form.light ?? low;
    return `<span class="eyebrow">READINESS CHECK-IN · 10 SECONDS</span><h3>How are you today?</h3>
      <label class="lbl">Sleep quality</label>${chips('sleep', [1, 2, 3, 4, 5], S.form.sleep, v => ['', 'Poor', 'Meh', 'OK', 'Good', 'Great'][v])}
      <label class="lbl">Energy</label>${chips('energy', [1, 2, 3, 4, 5], S.form.energy, v => ['', 'Drained', 'Low', 'OK', 'Good', 'Fired up'][v])}
      <label class="lbl">Soreness</label>${chips('soreness', [1, 2, 3, 4, 5], S.form.soreness, v => ['', 'None', 'Mild', 'Some', 'Sore', 'Very'][v])}
      <div class="readiness ${sc.label.toLowerCase()}"><b>${sc.label} readiness · ${sc.score}/5</b><span>${low ? 'Suggest the lighter version: one fewer set on bigger lifts, and keep a few reps in the tank.' : sc.label === 'Moderate' ? 'Train as planned; skip the last set if it feels heavy.' : 'Good to go — train as planned.'}</span></div>
      <label class="toggle"><input type="checkbox" id="lightToggle" ${light ? 'checked' : ''}> Use lighter version today</label>
      <div class="row gap"><button class="btn secondary" id="skipCheck">Skip</button><button class="btn primary" id="go">Start workout</button></div>`;
  };
  const mount = body => {
    body.querySelector('#lightToggle').onchange = e => { S.form.light = e.target.checked; };
    body.querySelector('#skipCheck').onclick = () => { app.closeSheet(); begin(routineId, null, false); };
    body.querySelector('#go').onclick = () => { const r = { sleep: +S.form.sleep, energy: +S.form.energy, soreness: +S.form.soreness }; app.closeSheet(); begin(routineId, r, S.form.light ?? readinessScore(r).label === 'Low'); };
  };
  app.sheet(draw(), mount);
  app.onPick = () => app.sheet(draw(), mount);
}

async function begin(routineId, readiness, light) {
  const w = createWorkout({ routineId, week: app.position().week, history: app.strength, overrides: S.overrides, unit: S.settings.unit, readiness, light, profile: S.profile });
  S.active = w;
  await app.saveActive(true);
  db.requestPersistence();
  app.go('workout');
}

// ── Activity (padel etc.) logging
export function activitySheet(kind = 'padel', existing = null) {
  const pd = existing?.padel || {};
  S.form = existing ? { activity: existing.activity, duration: existing.durationMin, rpe: existing.rpe, date: isoDate(new Date(existing.startedAt)), notes: existing.notes,
    ptype: pd.type || 'match', result: pd.result || 'none', score: pd.score || '', partner: pd.partner || '', side: pd.side || '', sore: [...(pd.sore || [])] }
    : { activity: kind, duration: 90, rpe: 7, date: isoDate(), notes: '', ptype: 'match', result: 'none', score: '', partner: S.form?.lastPartner || '', side: S.profile.side || '', sore: [] };
  const f = () => S.form;
  const draw = () => {
    const padel = f().activity === 'padel', match = padel && ['match', 'americano'].includes(f().ptype);
    return `<span class="eyebrow">${existing ? 'EDIT' : 'LOG'}</span><h3>${padel ? 'Log padel' : 'What did you do?'}</h3>
    ${chips('activity', ACTIVITIES.map(a => a[0]), f().activity, v => ACTIVITIES.find(a => a[0] === v)[1])}
    ${padel ? `<label class="lbl">Type</label>${chips('ptype', Object.keys(PADEL_TYPES), f().ptype, v => PADEL_TYPES[v])}` : ''}
    ${match ? `<label class="lbl">Result</label>${chips('result', ['won', 'lost', 'none'], f().result, v => ({ won: 'Won', lost: 'Lost', none: 'Not tracked' })[v])}
      <div class="grid2"><input class="input" id="scoreIn" placeholder="Score e.g. 6-4 3-6 6-2" value="${esc(f().score)}" aria-label="Score"><input class="input" id="partnerIn" placeholder="Partner" value="${esc(f().partner)}" aria-label="Partner"></div>` : ''}
    ${padel ? `<label class="lbl">Side you played</label>${chips('side', Object.keys(SIDES), f().side, v => SIDES[v])}` : ''}
    <label class="lbl">Duration (minutes)</label>${chips('duration', [30, 45, 60, 90, 120], f().duration)}
    <input class="input" id="durIn" type="number" inputmode="numeric" min="1" max="600" value="${esc(f().duration)}" aria-label="Duration in minutes">
    <label class="lbl">How hard overall?</label>${sessionEffortChips('rpe', f().rpe)}
    <p class="meta">Training load: <b>${(+f().duration || 0) * (+f().rpe || 0)} ${loadUnit()}</b> (minutes × effort)</p>
    ${padel ? `<label class="lbl">Body check: anything sore or niggly?</label><div class="chipset">${Object.entries(AREAS).map(([k, v]) => `<button type="button" class="chip-btn ${f().sore.includes(k) ? 'on warn-on' : ''}" data-sore="${k}" aria-pressed="${f().sore.includes(k)}">${esc(v)}</button>`).join('')}</div>` : ''}
    <label class="lbl" for="dateIn">Date</label><input class="input" id="dateIn" type="date" value="${esc(f().date)}" max="${isoDate()}">
    <label class="lbl" for="notesIn">Notes</label><textarea class="input" id="notesIn" rows="2" placeholder="${padel ? 'What worked, what to practise…' : 'Notes'}">${esc(f().notes)}</textarea>
    <button class="btn primary big" id="saveAct">${existing ? 'Save changes' : 'Save'}</button>`;
  };
  const mount = body => {
    const bind = (id, key, ev = 'oninput') => { const el = body.querySelector(id); if (el) el[ev] = e => { f()[key] = e.target.value; }; };
    body.querySelector('#durIn').oninput = e => { f().duration = +e.target.value; };
    bind('#dateIn', 'date', 'onchange'); bind('#notesIn', 'notes'); bind('#scoreIn', 'score'); bind('#partnerIn', 'partner');
    body.querySelectorAll('[data-sore]').forEach(b => b.onclick = () => { const k = b.dataset.sore; f().sore = f().sore.includes(k) ? f().sore.filter(x => x !== k) : [...f().sore, k]; app.sheet(draw(), mount); });
    body.querySelector('#saveAct').onclick = async () => {
      const dur = +f().duration;
      if (!(dur > 0)) return app.toast('Enter a duration');
      const d = parseISO(f().date || isoDate()), now = new Date();
      if (isoDate(d) === isoDate(now)) d.setHours(now.getHours(), now.getMinutes());
      else d.setHours(12);
      const padel = f().activity === 'padel' ? { type: f().ptype, result: ['match', 'americano'].includes(f().ptype) ? f().result : 'none', score: f().score.trim(), partner: f().partner.trim(), side: f().side, sore: f().sore } : undefined;
      const titleFor = () => padel ? PADEL_TYPES[padel.type] === 'Match' ? 'Padel match' : `Padel ${PADEL_TYPES[padel.type].toLowerCase()}` : ACTIVITIES.find(a => a[0] === f().activity)[1];
      const base = existing ? { ...existing, activity: f().activity, durationMin: dur, rpe: +f().rpe, notes: f().notes, startedAt: d.getTime(), endedAt: d.getTime() + dur * 60000 }
        : createActivity({ activity: f().activity, startedAt: d.getTime(), durationMin: dur, rpe: +f().rpe, notes: f().notes });
      const rec = { ...base, title: titleFor(), padel };
      await db.putSession(rec); await app.reloadSessions(); app.closeSheet();
      const sore = padel?.sore?.length ? ` · ${padel.sore.length} area${padel.sore.length > 1 ? 's' : ''} flagged` : '';
      app.toast(existing ? 'Updated' : `${rec.title} logged · ${dur * rec.rpe} ${loadUnit()}${sore}`);
      app.render({ keepScroll: true });
    };
  };
  app.onPick = () => app.sheet(draw(), mount);
  app.sheet(draw(), mount);
}
