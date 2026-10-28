// Progress tab: sessions, charts, padel insights and per-exercise trends.
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, icon, pageHead, navBar, group, row, stat, empty, barChart, lineChart, sparkline, routineLook } from './ui-kit.js';
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
import { bodyMap } from './ui-bodymap.js';
import { sessionMuscles, lastDays, weeklyMuscles, ranked, weeklyStatus, exercisesFor } from './domain-muscles.js';
import { MUSCLES } from './domain-taxonomy.js';

const unit = () => S.settings.unit;
const dateLong = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const dateShort = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const tabs = cur => `<div class="seg" role="tablist" style="margin-bottom:20px"><button role="tab" aria-selected="${cur === 'log'}" data-action="go" data-to="history">Sessions</button><button role="tab" aria-selected="${cur === 'ex'}" data-action="go" data-to="history/progress">Exercises</button></div>`;

function fmtSet(s, fields) {
  const tf = fields?.[fields.length - 1] || (s.sec != null ? 'sec' : s.m != null ? 'm' : 'reps');
  const v = `${fmtNum(s[tf])}${tf === 'reps' ? '' : FIELD_UNIT[tf]}`;
  return `${s.w ? `${fmtNum(toDisplay(s.w, unit()))}×` : ''}${v}`;
}

function sessionRow(s) {
  const gym = s.kind === 'strength', pd = s.padel;
  const look = gym ? routineLook(s.routineId) : s.activity === 'padel' ? { icon: 'racket', color: 'teal' } : s.routine ? { icon: 'heart', color: 'pink' } : { icon: 'wave', color: 'indigo' };
  const res = pd?.result === 'won' ? 'Won' : pd?.result === 'lost' ? 'Lost' : '';
  const sub = gym ? `${dateShort(s.startedAt)} · ${s.durationMin} min · ${setCount(s)} sets`
    : `${dateShort(s.startedAt)} · ${[res && `${res}${pd.score ? ' ' + esc(pd.score) : ''}`, `${s.durationMin} min`].filter(Boolean).join(' · ')}`;
  const right = `${s.prs?.length ? `<span class="badge-pr">${icon('trophy')}${s.prs.length}</span>` : ''}${pd?.sore?.length || s.pain?.flag ? '<span class="pill-count" title="Something was sore">!</span>' : ''}`;
  return row({ title: esc(s.title), sub, icon: look.icon, color: look.color, to: `history/session/${s.id}`, right });
}

function consistency() {
  const days = trainingDays(S.sessions), start = mondayOf(); start.setDate(start.getDate() - 11 * 7);
  const today = isoDate(), cells = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = isoDate(d), v = days.get(k) || [];
    const cls = !v.length ? '' : v.includes('gym') && v.length > 1 ? 'both' : v.includes('gym') ? 'gym' : 'act';
    cells.push(`<i class="${cls} ${k > today ? 'future' : ''}" title="${k}"></i>`);
  }
  return `<div class="heat" aria-label="Training days, last 12 weeks">${cells.join('')}</div><div class="legend"><span><i class="gym"></i>Workout</span><span><i class="act"></i>Padel & other</span></div>`;
}

function padelGroup() {
  const p = padelSummary(S.sessions);
  if (!p.sessions) return '';
  const side = Object.entries(p.sides).sort((a, b) => b[1] - a[1])[0];
  const sore = Object.entries(p.sore).sort((a, b) => b[1] - a[1]);
  const rows = row({ title: 'Matches', value: String(p.matches) })
    + (p.winRate != null ? row({ title: 'Win rate', value: `${p.winRate}% <span class="t-foot">(${p.won}–${p.lost})</span>` }) : '')
    + (side ? row({ title: 'Usual side', value: esc(SIDES[side[0]].split(' ')[0] === 'Drive' ? 'Right' : SIDES[side[0]].startsWith('Rev') ? 'Left' : 'Both') }) : '')
    + (sore.length ? row({ title: 'Sore after playing', value: sore.map(([a, n]) => `${esc(AREAS[a].split(' ')[0])} ${n}×`).join(', ') }) : '')
    + (p.suggestRoutine ? row({ title: `Try “${esc(COURT_ROUTINES[p.suggestRoutine].title)}”`, icon: 'heart', color: 'pink', to: `court/${p.suggestRoutine}` }) : '');
  const note = p.weeksCompared && p.soreWeekMin > p.okWeekMin * 1.2 ? `In weeks you felt sore, you played about ${p.soreWeekMin} min of padel vs ${p.okWeekMin} min otherwise. A pattern worth watching, not proof.` : '';
  return group(rows, { header: 'Padel · last 60 days', footer: note });
}

// Body map + sets per muscle for one session.
function musclesCard(map, header) {
  const list = ranked(map);
  if (!list.length) return '';
  return `<section class="grp"><h2 class="grp-h">${esc(header)}</h2><div class="card">${bodyMap(map)}
    <div class="mchips">${list.map(m => `<span class="${m.sets < 1 ? 'sec' : ''}">${esc(m.label)} · ${m.sets}</span>`).join('')}</div></div>
    <p class="grp-f">Sets per muscle. Secondary muscles count as half a set.</p></section>`;
}

function weekMusclesCard() {
  const map = lastDays(app.strength, 7), list = ranked(map);
  if (!app.strength.length) return '';
  const top = list.slice(0, 3).map(m => `${esc(m.label)} ${m.sets}`).join(' · ');
  return `<section class="grp"><h2 class="grp-h">Muscles · last 7 days</h2><button class="card" data-action="go" data-to="history/muscles" style="display:block;width:100%;text-align:left">
    ${bodyMap(map)}<div class="row" style="padding:12px 0 0"><span class="row-main"><span class="row-title">${list.length ? top : 'Nothing trained this week'}</span><span class="row-sub">See sets per muscle</span></span><svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg></div></button></section>`;
}

function musclesView() {
  const map = lastDays(app.strength, 7);
  const zone = m => ['rotator_cuff', 'forearms', 'shins', 'calves', 'obliques', 'arms'].includes(m) ? [6, 16] : [10, 20];
  const scale = 24;
  const rows = Object.keys(MUSCLES).map(id => ({ id, label: MUSCLES[id], sets: map[id] || 0 })).sort((a, b) => b.sets - a.sets).map(m => {
    const st = weeklyStatus(m.id, m.sets), [lo, hi] = zone(m.id);
    return row({ title: esc(m.label), value: `<span class="mstat ${st.key}">${m.sets ? `${m.sets} · ` : ''}${st.label}</span>`, action: 'muscle-sheet', data: { m: m.id },
      sub: `<span class="mbar"><span class="zone" style="left:${lo / scale * 100}%;width:${(hi - lo) / scale * 100}%"></span><b style="width:${Math.min(100, m.sets / scale * 100)}%"></b></span>` });
  }).join('');
  return `${navBar({ back: 'Progress', backTo: 'history', title: 'Muscles' })}
    <h1 class="t-title" style="padding:8px 4px 2px">Muscles</h1><p class="t-sub" style="padding:0 4px 16px">Sets per muscle over the last 7 days.</p>
    <div class="card">${bodyMap(map)}<div class="bm-legend">Fewer sets <i></i> More sets</div></div>
    <div style="height:24px"></div>
    ${group(rows, { footer: 'The green band is a common weekly range for getting stronger: about 10–20 hard sets for big muscles, a bit less for small ones. Fewer usually keeps what you have. It’s a rough guide, not a rule, and padel counts too.' })}`;
}

function muscleSheet(m) {
  const weeks = weeklyMuscles(app.strength, 8);
  const ex = exercisesFor(app.strength, m, Date.now() - 28 * 86400000);
  app.sheet(`<h2 class="sheet-title">${esc(MUSCLES[m])}</h2><p class="sheet-sub">Sets per week</p>
    <div class="card">${barChart(weeks.map(w => ({ label: `${w.start.getDate()}/${w.start.getMonth() + 1}`, parts: [{ v: w.map[m] || 0, cls: 'gym' }] })))}</div>
    <div style="height:20px"></div>
    ${ex.length ? group(ex.map(x => row({ title: esc(x.name), value: `${x.sets} sets`, sub: `Last done ${esc(relDay(x.ts).toLowerCase())}` })).join(''), { header: 'Last 4 weeks' }) : '<p class="t-sub" style="text-align:center">Not trained in the last 4 weeks.</p>'}`);
}

function logView() {
  if (!S.sessions.length) return `${pageHead('Progress')}${tabs('log')}${empty('chart', 'No sessions yet', 'Finish a workout or log a match and your progress shows up here.', '<button class="btn filled" data-action="go" data-to="today" style="max-width:260px">Go to Today</button>')}`;
  const series = weeklySeries(S.sessions, 8), tr = loadTrend(series), cur = series[series.length - 1];
  const groups = new Map();
  for (const s of S.sessions) { const k = isoDate(mondayOf(new Date(s.startedAt))); groups.set(k, [...(groups.get(k) || []), s]); }
  const thisMon = isoDate(mondayOf());
  const lists = [...groups.entries()].slice(0, 12).map(([k, arr]) => group(arr.map(sessionRow).join(''), { header: k === thisMon ? 'This week' : `Week of ${new Date(k + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}` })).join('');
  return `${pageHead('Progress')}${tabs('log')}
    <div class="tiles">${stat(cur.sessions, 'This week', cur.sessions === 1 ? 'session' : 'sessions')}${(n => stat(n, 'Streak', n === 1 ? 'week' : 'weeks'))(weekStreak(S.sessions))}</div>
    ${weekMusclesCard()}
    <section class="grp"><h2 class="grp-h">Training load</h2><div class="card">${barChart(series.map(w => ({ label: `${w.start.getDate()}/${w.start.getMonth() + 1}`, parts: [{ v: w.gym, cls: 'gym' }, { v: w.padel, cls: 'padel' }, { v: w.other, cls: 'other' }] })))}
      <div class="legend"><span><i class="gym"></i>Workouts</span><span><i class="padel"></i>Padel</span><span><i class="other"></i>Other</span></div></div>
      <p class="grp-f">Load is minutes × how hard it felt.${tr.ratio != null ? ` This week is ${tr.ratio}× your recent average${tr.ratio > 1.5 ? ', a big jump' : ''}.` : ''}</p></section>
    ${padelGroup()}
    <section class="grp"><h2 class="grp-h">Last 12 weeks</h2><div class="card">${consistency()}</div></section>
    ${lists}`;
}

function sessionView(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return `${navBar({ back: 'Progress', backTo: 'history' })}${empty('chart', 'Not found', 'This session no longer exists.')}`;
  const gym = s.kind === 'strength';
  const nav = navBar({ back: 'Progress', backTo: 'history', title: '' });
  const head = `<h1 class="t-title" style="padding:8px 4px 2px">${esc(s.title)}</h1><p class="t-sub" style="padding:0 4px 20px">${esc(dateLong(s.startedAt))}</p>`;
  const actions = `<div class="btns"><button class="btn tinted" data-action="${gym ? 'edit-session' : 'edit-activity'}" data-id="${esc(s.id)}">Edit</button><button class="btn destructive" data-action="delete-session" data-id="${esc(s.id)}">Delete</button></div>`;
  if (!gym) {
    const pd = s.padel;
    const details = pd ? [['Type', PADEL_TYPES[pd.type]], ['Result', pd.result === 'won' ? 'Won' : pd.result === 'lost' ? 'Lost' : ''], ['Score', pd.score], ['Partner', pd.partner], ['Side', pd.side === 'drive' ? 'Right' : pd.side === 'reves' ? 'Left' : pd.side === 'both' ? 'Both' : ''], ['Sore', pd.sore?.length ? pd.sore.map(a => AREAS[a]).join(', ') : 'Nothing']].filter(r => r[1]) : [];
    return `${nav}${head}<div class="tiles three">${stat(s.durationMin, 'Minutes')}${stat(esc(effortWord(s.rpe)), 'Effort')}${stat(sessionLoad(s), 'Load')}</div>
      ${details.length ? group(details.map(([k, v]) => row({ title: k, value: esc(v) })).join('')) : ''}
      ${s.notes ? group(row({ title: esc(s.notes) }), { header: 'Notes' }) : ''}${actions}`;
  }
  const vol = Math.round(toDisplay(volumeKg(s), unit()));
  return `${nav}${head}
    <div class="tiles three">${stat(s.durationMin, 'Minutes')}${stat(setCount(s), 'Sets')}${stat(vol ? vol.toLocaleString() : '—', 'Volume', vol ? unit() : '')}</div>
    ${musclesCard(sessionMuscles(s), 'Muscles worked')}
    ${s.prs?.length ? group(s.prs.map(p => row({ title: esc(p.name), sub: p.type === 'e1RM' ? (simple() ? 'New estimated max' : 'New e1RM') : `New ${esc(p.type.toLowerCase())}`, value: p.type === 'e1RM' || p.type === 'Heaviest' ? fmtW(p.value, unit()) : fmtNum(p.value), icon: 'trophy', color: 'orange' })).join(''), { header: 'Personal records' }) : ''}
    ${group(s.exercises.map(e => { const sets = doneSets(e), ex = getExercise(e.exId);
      return row({ title: esc(e.name), sub: e.skipped ? 'Skipped' : sets.length ? sets.map(x => fmtSet(x, e.fields)).join(' · ') : 'Not done', to: ex ? `history/ex/${e.exId}` : '' }); }).join(''), { header: 'Exercises' })}
    ${s.pain?.flag || s.rpe || s.notes ? group((s.rpe ? row({ title: 'Effort', value: esc(effortWord(s.rpe)) }) : '') + (s.pain?.flag ? row({ title: 'Pain', value: esc(s.pain.location || 'Yes'), cls: 'red' }) : '') + (s.notes ? row({ title: esc(s.notes) }) : ''), { header: 'Notes' }) : ''}
    ${actions}`;
}

function exercisesView() {
  const list = exerciseSummaries(app.strength);
  if (!list.length) return `${pageHead('Progress')}${tabs('ex')}${empty('dumbbell', 'Nothing to show yet', 'Complete a workout to start tracking each exercise.')}`;
  return `${pageHead('Progress')}${tabs('ex')}
    ${group(list.map(x => row({ title: esc(x.ex.name), sub: `Best ${x.metric.load ? fmtW(x.best, unit()) : fmtNum(x.best)} · ${esc(relDay(x.lastTs))}`, to: `history/ex/${x.id}`,
      right: `${sparkline(x.pts.map(p => p[x.metric.key]).filter(v => v != null))}<span class="chg ${x.change > 0 ? 'up' : x.change < 0 ? 'down' : ''}">${x.change == null ? '' : `${x.change > 0 ? '+' : ''}${x.change}%`}</span>` })).join(''),
      { footer: 'Change compares your first and latest session.' })}`;
}

function exerciseView(id) {
  const ex = getExercise(id);
  if (!ex) return empty('dumbbell', 'Unknown exercise', '');
  const m = progressMetric(ex), pts = exerciseSeries(app.strength, id), tf = targetField(ex);
  const heaviest = pts.length ? Math.max(...pts.map(p => p.topW || 0)) : 0;
  const bestE = pts.length ? Math.max(...pts.map(p => p.e1rm || 0)) : 0;
  const bestT = pts.length ? Math.max(...pts.map(p => p.topVal || 0)) : 0;
  return `${navBar({ back: 'Exercises', backTo: 'history/progress' })}
    <h1 class="t-title" style="padding:8px 4px 2px">${esc(ex.name)}</h1><p class="t-sub" style="padding:0 4px 20px">${esc(ex.muscles)}</p>
    <div class="tiles three">${stat(pts.length, 'Sessions')}${m.load ? stat(bestE ? fmtNum(toDisplay(bestE, unit())) : '—', simple() ? 'Est. max' : 'Best e1RM', bestE ? unit() : '') : stat(fmtNum(bestT), 'Best', tf === 'reps' ? 'reps' : FIELD_UNIT[tf])}${stat(heaviest ? fmtNum(toDisplay(heaviest, unit())) : '—', 'Heaviest', heaviest ? unit() : '')}</div>
    <section class="grp"><h2 class="grp-h">${esc(m.key === 'e1rm' ? e1rmLabel() : m.label)}</h2><div class="card">${lineChart(pts.filter(p => p[m.key] != null).map(p => ({ x: p.ts, y: m.load ? toDisplay(p[m.key], unit()) : p[m.key] })))}</div></section>
    <section class="grp"><h2 class="grp-h">My notes</h2><textarea class="input" data-note="${esc(id)}" rows="2" placeholder="Seat height, grip, reminders…">${esc(S.exNotes[id] || '')}</textarea></section>
    ${pts.length ? group([...pts].reverse().map(p => row({ title: esc(dateShort(p.ts)), sub: p.sets.map(x => fmtSet(x, ex.fields)).join(' · '), to: `history/session/${p.sessionId}` })).join(''), { header: 'History' }) : ''}`;
}

export const history = {
  tab: 'history',
  render() {
    const [sub, id] = S.params;
    if (sub === 'session') return sessionView(id);
    if (sub === 'progress') return exercisesView();
    if (sub === 'ex') return exerciseView(id);
    if (sub === 'muscles') return musclesView();
    return logView();
  },
  onInput(el) { if (el.dataset.note) { S.exNotes[el.dataset.note] = el.value; clearTimeout(this._n); this._n = setTimeout(() => app.save('exNotes'), 400); } },
  actions: {
    async 'delete-session'(el) {
      const s = S.sessions.find(x => x.id === el.dataset.id);
      if (!(await app.confirm(`Delete “${esc(s.title)}” from ${esc(dateShort(s.startedAt))}?`, { ok: 'Delete', danger: true }))) return;
      await db.deleteSession(s.id); await app.reloadSessions(); app.go('history');
      app.toast('Deleted', async () => { await db.putSession(s); await app.reloadSessions(); app.render({ keepScroll: true }); });
    },
    'muscle-sheet'(el) { muscleSheet(el.dataset.m); },
    'edit-activity'(el) { activitySheet(null, S.sessions.find(x => x.id === el.dataset.id)); },
    'edit-session'(el) {
      const s = S.sessions.find(x => x.id === el.dataset.id);
      S.form = { rpe: s.rpe ?? '' };
      const draw = () => `<h2 class="sheet-title">Edit workout</h2>
        <label class="field-l">How hard was it?</label>${sessionEffortChips('rpe', S.form.rpe)}
        <div style="height:20px"></div>
        ${group(row({ title: 'Minutes', right: `<input class="input num" id="eDur" type="number" inputmode="numeric" value="${s.durationMin}" style="width:80px;text-align:right;background:none;padding:0" aria-label="Minutes">` })
          + row({ title: 'Something hurt', right: `<input type="checkbox" class="switch" id="ePain" ${s.pain?.flag ? 'checked' : ''} aria-label="Something hurt">` }))}
        <input class="input" id="ePainLoc" placeholder="Where? (optional)" value="${esc(s.pain?.location || '')}">
        <label class="field-l" for="eNotes">Notes</label><textarea class="input" id="eNotes" rows="3">${esc(s.notes)}</textarea>
        <div style="height:20px"></div><button class="btn filled" id="eSave">Save</button>`;
      const mount = b => b.querySelector('#eSave').onclick = async () => {
        const upd = { ...s, rpe: S.form.rpe === '' ? null : +S.form.rpe, durationMin: +b.querySelector('#eDur').value || s.durationMin, notes: b.querySelector('#eNotes').value, pain: { flag: b.querySelector('#ePain').checked, location: b.querySelector('#ePainLoc').value } };
        await db.putSession(upd); await app.reloadSessions(); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Saved');
      };
      app.onPick = () => { const keep = { dur: document.querySelector('#eDur').value, notes: document.querySelector('#eNotes').value }; app.sheet(draw(), mount); document.querySelector('#eDur').value = keep.dur; document.querySelector('#eNotes').value = keep.notes; };
      app.sheet(draw(), mount);
    },
  },
};

export { loadUnit, icon };
