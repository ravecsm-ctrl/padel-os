import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, title, stat, empty, barChart, lineChart, sparkline, chips } from './ui-kit.js';
import { getExercise, targetField, FIELD_UNIT } from './domain-catalog.js';
import { weeklySeries, loadTrend, setCount, volumeKg, sessionLoad, weekStreak, trainingDays, exerciseSeries, exerciseSummaries, progressMetric } from './domain-analytics.js';
import { doneSets } from './domain-progression.js';
import { isoDate, mondayOf, relDay } from './domain-calendar.js';
import { fmtW, fmtNum, toDisplay } from './domain-units.js';
import { activitySheet } from './ui-today.js';
import { padelSummary, PADEL_TYPES, SIDES } from './domain-padel.js';
import { AREAS } from './domain-personalize.js';
import { COURT_ROUTINES } from './domain-court.js';
import { simple, effortWord, loadUnit, e1rmLabel, sessionEffortChips } from './ui-words.js';

const unit = () => S.settings.unit;
const dateLong = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const tabs = cur => `<div class="seg" role="tablist"><button role="tab" aria-selected="${cur === 'log'}" data-action="go" data-to="history">Log</button><button role="tab" aria-selected="${cur === 'progress'}" data-action="go" data-to="history/progress">Progress</button></div>`;

function fmtSet(s, fields) {
  const tf = fields?.[fields.length - 1] || (s.sec != null ? 'sec' : s.m != null ? 'm' : 'reps');
  const v = `${fmtNum(s[tf])}${tf === 'reps' ? '' : FIELD_UNIT[tf]}`;
  return `${s.w ? `${fmtNum(toDisplay(s.w, unit()))}×` : ''}${v}${s.rpe ? `<i>@${fmtNum(s.rpe)}</i>` : ''}`;
}

function consistency() {
  const days = trainingDays(S.sessions), start = mondayOf(); start.setDate(start.getDate() - 11 * 7);
  const today = isoDate(), cells = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = isoDate(d), v = days.get(k) || [];
    const cls = !v.length ? '' : v.includes('gym') && v.length > 1 ? 'both' : v.includes('gym') ? 'gym' : 'act';
    cells.push(`<i class="${cls} ${k > today ? 'future' : ''}" title="${k}${v.length ? ': ' + v.join(', ') : ''}"></i>`);
  }
  return `<div class="heat" aria-label="Training days, last 12 weeks">${cells.join('')}</div><div class="legend"><span><i class="gym"></i>Gym</span><span><i class="act"></i>Padel/other</span><span><i class="both"></i>Both</span></div>`;
}

function sessionItem(s) {
  const gym = s.kind === 'strength';
  const badge = gym ? s.routineId : { padel: 'P', cardio: 'C', mobility: '✚' }[s.activity] || '•';
  const pd = s.padel, res = pd?.result === 'won' ? 'Won' : pd?.result === 'lost' ? 'Lost' : '';
  const meta = gym ? `${s.durationMin} min · ${setCount(s)} sets${s.rpe ? ` · ${effortWord(s.rpe)}` : ''}`
    : `${[res && `${res}${pd.score ? ' ' + pd.score : ''}`, pd?.partner && `w/ ${pd.partner}`, `${s.durationMin} min`, `${sessionLoad(s)} ${loadUnit()}`].filter(Boolean).join(' · ')}`;
  return `<button class="card session-item" data-action="go" data-to="history/session/${esc(s.id)}"><span class="badge ${gym ? '' : 'alt'}">${esc(badge)}</span>
    <span><b>${esc(s.title)}</b><small>${esc(dateLong(s.startedAt))} · ${meta}</small></span>
    <span class="flags">${pd?.sore?.length ? `<em class="pain-dot" title="Body check: ${esc(pd.sore.join(', '))}">${pd.sore.length}</em>` : ''}${s.prs?.length ? `<em class="pr-dot" title="Personal records">🏆${s.prs.length}</em>` : ''}${s.pain?.flag ? '<em class="pain-dot" title="Pain noted">!</em>' : ''}</span></button>`;
}

function padelCard() {
  const p = padelSummary(S.sessions);
  if (!p.sessions) return '';
  const sides = Object.entries(p.sides).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${SIDES[k].split(' ')[0]} ${n}`).join(' · ');
  const sore = Object.entries(p.sore).sort((a, b) => b[1] - a[1]);
  const insight = p.weeksCompared && p.soreWeekMin > p.okWeekMin * 1.2
    ? `<p class="warn">Pattern in your log: weeks where you flagged soreness averaged ${p.soreWeekMin} min of padel vs ${p.okWeekMin} min in other weeks. Not proof of cause, but worth watching.</p>` : '';
  return `<section class="card"><div class="row between"><h3>Padel · last 60 days</h3><small class="meta">${p.sessions} sessions · ${Math.round(p.minutes / 60)} h</small></div>
    <div class="stats">${stat(p.matches, 'Matches')}${stat(p.winRate == null ? '—' : `${p.winRate}%`, `Win rate${p.won + p.lost ? ` (${p.won}–${p.lost})` : ''}`)}${stat(sore.length ? sore[0][1] : 0, 'Sore flags')}</div>
    ${sides ? `<p class="meta">Side: ${esc(sides)}</p>` : ''}
    ${sore.length ? `<p class="meta">Body check: ${sore.map(([a, n]) => `${esc(AREAS[a])} ${n}×`).join(' · ')}</p>` : ''}
    ${insight}
    ${p.suggestRoutine ? `<button class="btn secondary wide" data-action="go" data-to="court/${p.suggestRoutine}">Try “${esc(COURT_ROUTINES[p.suggestRoutine].title)}” ›</button>` : ''}</section>`;
}

function logView() {
  if (!S.sessions.length) return `${title('History', 'LOCAL TO THIS DEVICE')}${tabs('log')}${empty('No sessions yet. Finish a workout or log a padel match and it shows up here.', '<button class="btn primary" data-action="go" data-to="today">Go to Today</button>')}`;
  const series = weeklySeries(S.sessions, 8), tr = loadTrend(series);
  const groups = new Map();
  for (const s of S.sessions) { const k = isoDate(mondayOf(new Date(s.startedAt))); groups.set(k, [...(groups.get(k) || []), s]); }
  const list = [...groups.entries()].map(([k, arr]) => {
    const load = arr.reduce((n, s) => n + sessionLoad(s), 0);
    return `<h4 class="group">Week of ${new Date(k + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<small>${arr.length} session${arr.length > 1 ? 's' : ''}${load ? ` · ${load} ${loadUnit()}` : ''}</small></h4>${arr.map(sessionItem).join('')}`;
  }).join('');
  return `${title('History', 'LOCAL TO THIS DEVICE')}${tabs('log')}
    <div class="stats four">${stat(S.sessions.length, 'Sessions')}${stat(app.strength.length, 'Workouts')}${stat(weekStreak(S.sessions), 'Streak (wk)')}${stat(S.sessions.reduce((n, s) => n + (s.prs?.length || 0), 0), 'PRs')}</div>
    <section class="card"><div class="row between"><h3>Weekly load</h3><small class="meta">minutes × effort</small></div>
      ${barChart(series.map(w => ({ label: `${w.start.getDate()}/${w.start.getMonth() + 1}`, parts: [{ v: w.gym, cls: 'gym' }, { v: w.padel, cls: 'padel' }, { v: w.other, cls: 'other' }] })))}
      <div class="legend"><span><i class="gym"></i>Gym</span><span><i class="padel"></i>Padel</span><span><i class="other"></i>Other</span></div>
      ${tr.ratio != null ? `<p class="meta">This week ${tr.current} ${loadUnit()} vs 4-week average ${tr.avg} ${loadUnit()} (${tr.ratio}×). Big jumps (&gt;1.5×) are worth managing.</p>` : ''}
    </section>
    ${padelCard()}
    <section class="card"><h3>Consistency · 12 weeks</h3>${consistency()}</section>
    ${list}`;
}

function sessionView(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return `${title('Not found', 'HISTORY')}${empty('This session no longer exists.', '<button class="btn secondary" data-action="go" data-to="history">Back</button>')}`;
  const gym = s.kind === 'strength';
  const back = `<button class="link back" data-action="go" data-to="history">‹ History</button>`;
  if (!gym) { const pd = s.padel; return `${back}${title(s.title, dateLong(s.startedAt).toUpperCase())}
    <div class="stats">${stat(s.durationMin, 'Minutes')}${stat(effortWord(s.rpe), simple() ? 'Effort' : 'RPE')}${stat(sessionLoad(s), `Load ${loadUnit()}`)}</div>
    ${pd ? `<section class="card"><dl class="kv">${[['Type', PADEL_TYPES[pd.type]], ['Result', pd.result === 'won' ? 'Won' : pd.result === 'lost' ? 'Lost' : ''], ['Score', pd.score], ['Partner', pd.partner], ['Side', SIDES[pd.side]], ['Body check', pd.sore?.length ? pd.sore.map(a => AREAS[a]).join(', ') : 'All good']].filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>` : ''}
    ${s.notes ? `<section class="card"><h3>Notes</h3><p>${esc(s.notes)}</p></section>` : ''}
    <div class="row gap"><button class="btn secondary" data-action="edit-activity" data-id="${esc(s.id)}">Edit</button><button class="btn danger" data-action="delete-session" data-id="${esc(s.id)}">Delete</button></div>`; }
  return `${back}${title(s.title, `${dateLong(s.startedAt).toUpperCase()} · WEEK ${s.week}${s.light ? ' · LIGHT' : ''}`)}
    <div class="stats four">${stat(s.durationMin, 'Minutes')}${stat(setCount(s), 'Sets')}${stat(effortWord(s.rpe), simple() ? 'Effort' : 'RPE')}${stat(fmtW(volumeKg(s), unit()).replace(/\.\d+/, ''), 'Volume')}</div>
    ${s.prs?.length ? `<div class="prs">${s.prs.map(p => `<span class="pr">🏆 ${esc(p.name)} · ${esc(p.type)} ${p.type === 'e1RM' || p.type === 'Heaviest' ? fmtW(p.value, unit()) : fmtNum(p.value)}</span>`).join('')}</div>` : ''}
    ${s.pain?.flag ? `<p class="warn">Pain noted${s.pain.location ? `: ${esc(s.pain.location)}` : ''}.</p>` : ''}
    ${s.readiness ? `<p class="meta">Readiness — sleep ${s.readiness.sleep}/5 · energy ${s.readiness.energy}/5 · soreness ${s.readiness.soreness}/5</p>` : ''}
    <section class="card">${s.exercises.map(e => {
      const sets = doneSets(e), ex = getExercise(e.exId);
      return `<div class="ex-log"><div class="row between">${ex ? `<button class="link strong" data-action="go" data-to="history/ex/${esc(e.exId)}">${esc(e.name)}</button>` : `<b>${esc(e.name)}</b>`}<small class="meta">${e.skipped ? 'skipped' : `${sets.length}/${e.sets.length || e.target?.sets || sets.length} sets`}</small></div>
        <p class="set-list">${sets.length ? sets.map(x => `<span>${fmtSet(x, e.fields)}</span>`).join('') : '<span class="meta">not done</span>'}</p></div>`;
    }).join('')}</section>
    <section class="card"><h3>Notes</h3><p>${esc(s.notes || 'No notes.')}</p></section>
    <div class="row gap"><button class="btn secondary" data-action="edit-session" data-id="${esc(s.id)}">Edit</button><button class="btn danger" data-action="delete-session" data-id="${esc(s.id)}">Delete</button></div>`;
}

function progressView() {
  const list = exerciseSummaries(app.strength);
  if (!list.length) return `${title('Progress', 'PER EXERCISE')}${tabs('progress')}${empty('Complete a workout to start tracking progress per exercise.')}`;
  return `${title('Progress', 'PER EXERCISE')}${tabs('progress')}
    <div class="list">${list.map(x => `<button class="list-item ex-sum" data-action="go" data-to="history/ex/${esc(x.id)}">
      <span><b>${esc(x.ex.name)}</b><small>${esc(x.metric.label)} · best ${x.metric.load ? fmtW(x.best, unit()) : fmtNum(x.best)} · ${esc(relDay(x.lastTs))}</small></span>
      ${sparkline(x.pts.map(p => p[x.metric.key]).filter(v => v != null))}
      <span class="chg ${x.change > 0 ? 'up' : x.change < 0 ? 'down' : ''}">${x.change == null ? '' : `${x.change > 0 ? '+' : ''}${x.change}%`}</span></button>`).join('')}</div>`;
}

function exerciseView(id) {
  const ex = getExercise(id);
  if (!ex) return empty('Unknown exercise.');
  const m = progressMetric(ex), pts = exerciseSeries(app.strength, id), tf = targetField(ex);
  const vals = pts.map(p => p[m.key]).filter(v => v != null);
  const heaviest = pts.length ? Math.max(...pts.map(p => p.topW || 0)) : 0;
  const bestE = pts.length ? Math.max(...pts.map(p => p.e1rm || 0)) : 0;
  const bestT = pts.length ? Math.max(...pts.map(p => p.topVal || 0)) : 0;
  const note = S.exNotes[id] || '';
  return `<button class="link back" data-action="go" data-to="history/progress">‹ Progress</button>${title(ex.name, ex.muscles.toUpperCase())}
    <div class="stats">${stat(pts.length, 'Sessions')}${m.load ? stat(fmtW(bestE || heaviest, unit()), bestE ? (simple() ? 'Est. max' : 'Best e1RM') : 'Heaviest') : stat(fmtNum(bestT) + (tf === 'reps' ? '' : FIELD_UNIT[tf]), 'Best')}${stat(heaviest ? fmtW(heaviest, unit()) : '—', 'Heaviest')}</div>
    <section class="card"><h3>${esc(m.key === 'e1rm' ? e1rmLabel() : m.label)}</h3>${lineChart(pts.filter(p => p[m.key] != null).map(p => ({ x: p.ts, y: m.load ? toDisplay(p[m.key], unit()) : p[m.key] })), { fmt: v => v })}</section>
    <section class="card"><h3>My notes</h3><textarea class="input" data-note="${esc(id)}" rows="2" placeholder="Setup details, cues that work…">${esc(note)}</textarea></section>
    <section class="card"><h3>Every session</h3>${pts.length ? [...pts].reverse().map(p => `<div class="ex-log"><div class="row between"><button class="link strong" data-action="go" data-to="history/session/${esc(p.sessionId)}">${esc(dateLong(p.ts))}</button><small class="meta">W${p.week}${p.e1rm ? ` · ${simple() ? 'est. max' : 'e1RM'} ${fmtW(p.e1rm, unit())}` : ''}</small></div><p class="set-list">${p.sets.map(x => `<span>${fmtSet(x, ex.fields)}</span>`).join('')}</p></div>`).join('') : '<p class="meta">Not logged yet.</p>'}</section>
    <details class="card cues"><summary>How to do it</summary><dl><dt>Why</dt><dd>${esc(ex.why)}</dd><dt>Set up</dt><dd>${esc(ex.setup)}</dd><dt>Execute</dt><dd>${esc(ex.execute)}</dd><dt>Avoid</dt><dd>${esc(ex.avoid)}</dd></dl></details>`;
}

export const history = {
  render() {
    const [sub, id] = S.params;
    if (sub === 'session') return sessionView(id);
    if (sub === 'progress') return progressView();
    if (sub === 'ex') return exerciseView(id);
    return logView();
  },
  onInput(el) { if (el.dataset.note) { S.exNotes[el.dataset.note] = el.value; clearTimeout(this._n); this._n = setTimeout(() => app.save('exNotes'), 400); } },
  actions: {
    async 'delete-session'(el) {
      const s = S.sessions.find(x => x.id === el.dataset.id);
      if (!(await app.confirm(`Delete “${esc(s.title)}” from ${dateLong(s.startedAt)}?`, { ok: 'Delete', danger: true }))) return;
      await db.deleteSession(s.id); await app.reloadSessions(); app.go('history');
      app.toast('Session deleted', async () => { await db.putSession(s); await app.reloadSessions(); app.render({ keepScroll: true }); });
    },
    'edit-activity'(el) { activitySheet(null, S.sessions.find(x => x.id === el.dataset.id)); },
    'edit-session'(el) {
      const s = S.sessions.find(x => x.id === el.dataset.id);
      S.form = { rpe: s.rpe ?? '' };
      const draw = () => `<span class="eyebrow">EDIT SESSION</span><h3>${esc(s.title)}</h3>
        <label class="lbl">How hard was it?</label>${sessionEffortChips('rpe', S.form.rpe)}
        <label class="lbl" for="eDur">Duration (minutes)</label><input class="input" id="eDur" type="number" inputmode="numeric" value="${s.durationMin}">
        <label class="lbl" for="eNotes">Notes</label><textarea class="input" id="eNotes" rows="3">${esc(s.notes)}</textarea>
        <label class="toggle"><input type="checkbox" id="ePain" ${s.pain?.flag ? 'checked' : ''}> Pain noted</label>
        <input class="input" id="ePainLoc" placeholder="Pain location" value="${esc(s.pain?.location || '')}">
        <button class="btn primary big" id="eSave">Save</button>`;
      const mount = b => b.querySelector('#eSave').onclick = async () => {
        const upd = { ...s, rpe: S.form.rpe === '' ? null : +S.form.rpe, durationMin: +b.querySelector('#eDur').value || s.durationMin, notes: b.querySelector('#eNotes').value, pain: { flag: b.querySelector('#ePain').checked, location: b.querySelector('#ePainLoc').value } };
        await db.putSession(upd); await app.reloadSessions(); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Session updated');
      };
      app.onPick = () => { const d = { dur: document.querySelector('#eDur').value, notes: document.querySelector('#eNotes').value }; app.sheet(draw(), mount); document.querySelector('#eDur').value = d.dur; document.querySelector('#eNotes').value = d.notes; };
      app.sheet(draw(), mount);
    },
  },
};

