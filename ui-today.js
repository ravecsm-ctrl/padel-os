import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, icon, chev, tile, pageHead, group, row, chips, seg, routineLook } from './ui-kit.js';
import { readinessScore, isRoutine, allRoutineIds } from './domain-program.js';
import { dayKey, weekDates, isoDate, relDay, parseISO, mondayOf } from './domain-calendar.js';
import { weeklySeries, loadTrend, trainingDays } from './domain-analytics.js';
import { createWorkout, createActivity, workoutStats } from './domain-workout.js';
import { COURT_ROUTINES, routineMinutes } from './domain-court.js';
import { prehabFor, PADEL_TYPES } from './domain-padel.js';
import { AREAS } from './domain-personalize.js';
import { sessionEffortChips } from './ui-words.js';

const lastDone = id => app.strength.find(s => s.routineId === id);
const ACTIVITIES = [['padel', 'Padel'], ['cardio', 'Cardio'], ['mobility', 'Mobility'], ['other', 'Other']];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function banners() {
  let out = '';
  if (S.active) {
    const st = workoutStats(S.active);
    out += `<button class="banner" data-action="resume">${tile('play', 'blue')}<span><b>Continue your workout</b><small>${esc(S.active.title)} · ${st.sets} of ${st.planned} sets done</small></span>${chev}</button>`;
  }
  if (!S.profile.onboarded) out += `<button class="banner" data-action="go" data-to="welcome">${tile('sliders', 'blue')}<span><b>Personalise your plan</b><small>Takes 30 seconds. Your history is kept.</small></span>${chev}</button>`;
  const tr = loadTrend(weeklySeries(S.sessions, 5));
  if (tr.ratio != null && tr.ratio > 1.5) out += `<div class="banner warn">${tile('flame', 'orange')}<span><b>Big week</b><small>You’ve trained about ${tr.ratio}× more than usual. Consider an easier day.</small></span></div>`;
  if (S.sessions.length >= 3) {
    const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 86400000) : null;
    if (days == null || days >= 14) out += `<button class="banner" data-action="go" data-to="settings">${tile('download', 'gray')}<span><b>Back up your data</b><small>${days == null ? 'You haven’t made a backup yet.' : `Last backup ${days} days ago.`}</small></span>${chev}</button>`;
  }
  return out;
}

function hero() {
  const plan = S.schedule[dayKey()];
  const doneToday = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === isoDate());
  if (doneToday.length && !S.active) {
    return `<section class="card hero"><div class="hero-top">${tile('check', 'green', true)}<div><h2>Done for today</h2><p class="t-sub">${doneToday.map(s => esc(s.title)).join(' and ')}</p></div></div>
      <p class="hero-note">Nice work. Rest and sleep are when your body gets stronger.</p>
      <button class="btn tinted" data-action="go" data-to="history/session/${esc(doneToday[0].id)}">See Summary</button></section>`;
  }
  if (isRoutine(plan)) {
    const r = app.routine(plan), look = routineLook(plan), last = lastDone(plan);
    return `<section class="card hero"><div class="hero-top">${tile(look.icon, look.color, true)}<div><p class="t-foot">Up next</p><h2>${esc(r.title)}</h2><p class="t-sub">${plural(r.blocks.length, 'exercise')} · about ${r.minutes} min</p></div></div>
      <p class="hero-note">${esc(r.focus)}${last ? '' : ' Your first session sets your starting weights.'}</p>
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

function weekCard() {
  const days = trainingDays(S.sessions), today = isoDate();
  const planned = Object.values(S.schedule).filter(isRoutine).length;
  const mon = mondayOf().getTime();
  const done = app.strength.filter(s => s.startedAt >= mon).length;
  return `<section class="grp"><h2 class="grp-h big">This week</h2><div class="card"><div class="week">${weekDates().map(d => {
    const did = days.get(d.iso) || [], plan = S.schedule[d.key];
    const cls = did.length ? `done ${did.includes('gym') ? '' : 'padel'}` : isRoutine(plan) ? 'plan-gym' : plan === 'Padel' ? 'plan-padel' : '';
    return `<div class="${d.iso === today ? 'today' : ''}"><small>${d.key[0]}</small><span class="dot ${cls}" aria-label="${d.key}: ${did.length ? 'done' : esc(plan)}">${did.length ? icon('check') : ''}</span></div>`;
  }).join('')}</div>
  <p class="week-foot">${planned ? `${done} of ${plural(planned, 'workout')} done` : `${plural(done, 'workout')} done`}</p></div>
  <p class="grp-f"><span class="blue">●</span> Workout day &nbsp; <span style="color:var(--teal)">●</span> Padel day</p></section>`;
}

function stayHealthy() {
  const pre = prehabFor(S.profile, S.sessions);
  if (!pre.ids.length) return '';
  return group(pre.ids.map(id => { const r = COURT_ROUTINES[id]; const n = pre.flagged[r.areas[0]];
    return row({ title: esc(r.title), sub: `${routineMinutes(r)} min · ${n >= 2 ? `you flagged this ${n}× recently` : 'from your profile'}`, icon: 'heart', color: 'pink', to: `court/${id}` }); }).join(''),
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
      ${banners()}${hero()}
      <div style="height:28px"></div>${weekCard()}${stayHealthy()}
      ${group(others.map(id => { const r = app.routine(id), look = routineLook(id), last = lastDone(id);
        return row({ title: esc(r.title), sub: `About ${r.minutes} min · ${last ? `last done ${esc(relDay(last.startedAt).toLowerCase())}` : 'not done yet'}`, icon: look.icon, color: look.color, action: S.active ? 'resume' : 'start', data: { routine: id } }); }).join('')
        + row({ title: 'Log a match or activity', icon: 'racket', color: 'teal', action: 'log-activity' })
        + row({ title: 'Warm up before playing', sub: `${routineMinutes(COURT_ROUTINES.warmup)} min, guided`, icon: 'flame', color: 'orange', to: 'court/warmup' }),
        { header: 'More', big: true })}`;
  },
  actions: {
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
  S.form = { sleep: 4, energy: 3, soreness: 2, light: null };
  const draw = () => {
    const sc = readinessScore(S.form), low = sc.label === 'Low';
    const light = S.form.light ?? low;
    return `<h2 class="sheet-title">How do you feel today?</h2><p class="sheet-sub">We’ll adjust today’s workout if you need a lighter day.</p>
      ${Object.entries(SCALE).map(([k, [q, opts]]) => `<label class="field-l">${q}</label>${seg(k, opts.map((o, i) => [i + 1, o]), S.form[k])}`).join('')}
      <div style="height:20px"></div>
      ${group(row({ title: 'Lighter workout today', sub: low ? 'Recommended: one fewer set and easier effort.' : sc.label === 'Moderate' ? 'Optional. You seem OK to train.' : 'You seem ready to train as planned.', right: `<input type="checkbox" class="switch" id="lightToggle" ${light ? 'checked' : ''} aria-label="Lighter workout today">` }))}
      <div class="btns"><button class="btn filled" id="go">${icon('play')}Start Workout</button><button class="btn plain" id="skipCheck">Skip check-in</button></div>`;
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
    : { activity: kind, duration: 90, rpe: 7, date: isoDate(), notes: '', ptype: 'match', result: 'none', score: '', partner: '', side: '', sore: [] };
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
      if (isoDate(d) === isoDate(now)) d.setHours(now.getHours(), now.getMinutes());
      else d.setHours(12);
      const padel = f().activity === 'padel' ? { type: f().ptype, result: ['match', 'americano'].includes(f().ptype) ? f().result : 'none', score: f().score.trim(), partner: f().partner.trim(), side: f().side, sore: f().sore } : undefined;
      const titleFor = () => padel ? (padel.type === 'match' ? 'Padel match' : `Padel ${PADEL_TYPES[padel.type].toLowerCase()}`) : ACTIVITIES.find(a => a[0] === f().activity)[1];
      const base = existing ? { ...existing, activity: f().activity, durationMin: dur, rpe: +f().rpe, notes: f().notes, startedAt: d.getTime(), endedAt: d.getTime() + dur * 60000 }
        : createActivity({ activity: f().activity, startedAt: d.getTime(), durationMin: dur, rpe: +f().rpe, notes: f().notes });
      const rec = { ...base, title: titleFor(), padel };
      await db.putSession(rec); await app.reloadSessions(); app.closeSheet();
      app.toast(existing ? 'Saved' : `${rec.title} saved`);
      app.render({ keepScroll: true });
    };
  };
  app.onPick = () => app.sheet(draw(), mount);
  app.sheet(draw(), mount);
}
