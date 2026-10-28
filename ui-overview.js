// Progress tab (route 'overview'): what happened, then how you're going. Today is the home screen.
import { app, S } from './core-app.js';
import { esc, icon, pageHead, group, row, tile, ringStat } from './ui-kit.js';
import { padelSummary } from './domain-padel.js';
import { isRoutine, getRoutine } from './domain-program.js';
import { isoDate, mondayOf, parseISO } from './domain-calendar.js';
import { DAYS } from './domain-program.js';
import { monthGrid, monthStats, liftProjections, levelEta, whatIf, trackingSince } from './domain-overview.js';
import { xpEvents } from './domain-stats.js';
import { weekStreak } from './domain-analytics.js';
import { fmtW, fmtNum, toDisplay, fromDisplay } from './domain-units.js';
import { getExercise } from './domain-catalog.js';
import { taperFor, taperText, daysUntil, liftProgress } from './domain-goals.js';
import { exercisePicker } from './ui-picker.js';
import { currentStats, radar } from './ui-stats.js';
import { activitySheet, pastWorkoutSheet } from './ui-today.js';
import { bodySummary } from './ui-body.js';

let monthOffset = 0;
const MONTH = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ── What happened
function calendar() {
  const now = new Date(), view = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const weeks = monthGrid(view.getFullYear(), view.getMonth(), S.sessions, S.schedule, { isRoutine, since: trackingSince(S.sessions, S.settings.programStart), now });
  const st = monthStats(weeks), streak = weekStreak(S.sessions);
  const cell = d => {
    const dots = d.done.map(k => `<i class="cd ${k}"></i>`).join('') || (d.missed ? '<i class="cd missed"></i>' : d.future && d.plan ? `<i class="cd plan ${d.plan}"></i>` : '');
    return `<button class="cday ${d.inMonth ? '' : 'out'} ${d.today ? 'today' : ''}" data-action="cal-day" data-iso="${d.iso}" aria-label="${d.iso}${d.done.length ? ', trained' : d.missed ? ', planned workout missed' : d.future && d.plan ? `, ${d.plan === 'padel' ? 'padel' : 'workout'} planned` : ''}"><span>${d.day}</span><span class="cdots">${dots}</span></button>`;
  };
  return `<section class="grp"><div class="cal-head"><h2 class="grp-h big" style="margin:0">${esc(MONTH(view))}</h2>
      <span><button class="icon-circle" data-action="cal-prev" aria-label="Previous month">${icon('chevL')}</button><button class="icon-circle" data-action="cal-next" ${monthOffset >= 0 ? 'disabled' : ''} aria-label="Next month">${icon('chevR')}</button></span></div>
    <div class="card"><div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<small>${d}</small>`).join('')}${weeks.flat().map(cell).join('')}</div>
      <div class="legend" style="justify-content:center"><span><i class="gym"></i>Workout</span><span><i class="padel"></i>Padel</span><span><i class="cd plan"></i>Planned</span><span><i style="background:none;box-shadow:inset 0 0 0 1.5px var(--label-3)"></i>Missed</span></div></div>
    <p class="grp-f">${plural(st.sessions, 'session')} this month${streak ? ` · 🔥 ${plural(streak, 'week')} in a row` : ''}${st.missed ? ` · ${st.missed} planned missed` : ''}</p></section>`;
}

// ── Court panel: where you stand, in three rings.
function progressPanel() {
  if (!S.sessions.length) return '';
  const now = new Date(), month = S.sessions.filter(s => { const d = new Date(s.startedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const gym = app.strength.length, ready = gym >= SCORES_AFTER, { axes, level } = currentStats(), cons = axes.find(a => a.key === 'consistency')?.score || 0, pd = padelSummary(S.sessions);
  const title = ready ? `Level ${level.level} · ${esc(level.name)}` : 'Getting started', sub = ready ? `${level.into} / ${level.need} points to level ${level.level + 1}` : `${Math.min(gym, SCORES_AFTER)} of ${SCORES_AFTER} workouts until your scores unlock`;
  return `<div class="court-stack" style="margin-bottom:24px"><button class="card hero" data-action="go" data-to="${ready ? 'stats' : 'overview'}" style="display:block;width:100%;text-align:left">
      <p class="t-foot">Your progress</p><h2>${title}</h2><p class="t-sub">${esc(sub)}</p>
      <span class="mbar court-bar"><b style="width:${Math.round((ready ? level.progress : gym / SCORES_AFTER) * 100)}%"></b></span></button>
    <div class="court-rings">${ringStat(Math.min(1, month / 12), '#64D2FF', String(month), '', 'This month')}
      ${ringStat(cons / 100, 'var(--ball)', ready ? String(cons) : '—', '', 'Consistency')}
      ${ringStat((pd.winRate ?? 0) / 100, '#FFFFFF', pd.winRate != null ? `${pd.winRate}%` : '—', '', 'Win rate')}</div></div>`;
}

// ── Goals: a tournament to peak for, and lift targets.
function goals() {
  const t = S.settings.tournament, lifts = S.settings.liftGoals || [], u = S.settings.unit;
  const tRow = t?.date ? (() => {
    const d = daysUntil(t.date), when = parseISO(t.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const sub = d > 0 ? `${when} · in ${plural(d, 'day')}` : d === 0 ? `${when} · today` : `${when} · done`;
    return row({ title: esc(t.name || 'Tournament'), sub: `${esc(sub)}${taperFor(t) ? `<br><span class="orange">${esc(taperText(taperFor(t)))}</span>` : ''}`, icon: 'trophy', color: 'teal', action: 'goal-tour' });
  })() : row({ title: 'Add a tournament', sub: 'Workouts ease off in the week before so you play fresh', icon: 'trophy', color: 'teal', action: 'goal-tour' });
  const lRows = lifts.map((g, i) => { const ex = getExercise(g.exId); if (!ex) return ''; const p = liftProgress(g, app.strength);
    return row({ title: esc(ex.name), sub: `<span class="mbar" style="margin:6px 0 4px"><b style="width:${Math.round(p.pct * 100)}%"></b></span>${p.done ? `Reached ${esc(fmtW(g.kg, u))}!` : p.best ? `Best ${esc(fmtW(p.best, u))} of ${esc(fmtW(g.kg, u))}` : `Goal ${esc(fmtW(g.kg, u))} · not lifted yet`}`, icon: p.done ? 'check' : 'dumbbell', color: p.done ? 'green' : 'blue', action: 'goal-lift', data: { i } }); }).join('');
  return group(tRow + lRows + row({ title: 'Add a lift goal', icon: 'plus', color: 'green', action: 'goal-lift-add', chevron: false, cls: 'action' }), { header: 'Goals', big: true });
}

function tournamentSheet() {
  const t = S.settings.tournament || {};
  app.sheet(`<h2 class="sheet-title">Tournament</h2><p class="sheet-sub">From a week before, workouts get lighter; the two days before are for rest and mobility.</p>
    ${group(`<label class="row"><span class="row-main"><input class="input" id="tName" value="${esc(t.name || '')}" placeholder="Name, e.g. Club Open" maxlength="40" style="padding:0;background:none;min-height:22px" aria-label="Tournament name"></span></label>`
      + row({ title: 'Date', right: `<input class="input" id="tDate" type="date" min="${isoDate()}" value="${esc(t.date || '')}" style="width:150px;text-align:right;background:none;padding:0" aria-label="Tournament date">` }))}
    <div class="btns"><button class="btn filled" id="tSave">Save</button>${t.date ? '<button class="btn destructive" id="tDel">Remove Tournament</button>' : '<button class="btn plain" data-action="close-sheet">Cancel</button>'}</div>`, b => {
    b.querySelector('#tSave').onclick = async () => {
      const date = b.querySelector('#tDate').value;
      if (!date) return app.toast('Pick the date');
      S.settings.tournament = { name: b.querySelector('#tName').value.trim() || 'Tournament', date };
      await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast(taperText(taperFor(S.settings.tournament)) || 'Tournament saved. Training eases off from a week before.');
    };
    b.querySelector('#tDel')?.addEventListener('click', async () => { delete S.settings.tournament; await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Tournament removed'); });
  });
}

function liftSheet(exId, i = -1) {
  const ex = getExercise(exId), u = S.settings.unit, g = (S.settings.liftGoals || [])[i], best = liftProgress({ exId, kg: 1 }, app.strength).best;
  app.sheet(`<h2 class="sheet-title">${esc(ex.name)}</h2><p class="sheet-sub">${best ? `Your best so far: ${esc(fmtW(best, u))}.` : 'You haven’t logged this one yet.'} Progress uses the heaviest weight you log.</p>
    ${group(row({ title: `Goal (${u})`, right: `<input class="input num" id="gKg" type="number" inputmode="decimal" step="any" min="0" value="${g ? fmtNum(toDisplay(g.kg, u)) : ''}" style="width:90px;text-align:right;background:none;padding:0" aria-label="Goal weight">` }))}
    <div class="btns"><button class="btn filled" id="gSave">Save</button>${g ? '<button class="btn destructive" id="gDel">Remove Goal</button>' : '<button class="btn plain" data-action="close-sheet">Cancel</button>'}</div>`, b => {
    setTimeout(() => b.querySelector('#gKg').focus(), 50);
    b.querySelector('#gSave').onclick = async () => {
      const v = Number(String(b.querySelector('#gKg').value).replace(',', '.'));
      if (!(v > 0)) return app.toast('Enter a weight');
      const list = [...(S.settings.liftGoals || [])], goal = { exId, kg: fromDisplay(v, u) };
      if (i >= 0) list[i] = goal; else list.push(goal);
      S.settings.liftGoals = list; await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Goal saved');
    };
    b.querySelector('#gDel')?.addEventListener('click', async () => { S.settings.liftGoals = S.settings.liftGoals.filter((_, k) => k !== i); await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Goal removed'); });
  });
}

// ── Your first few weeks: early wins instead of scores that don't mean much yet.
export const SCORES_AFTER = 4;
export function earlyWins(sessions) {
  const gym = sessions.filter(s => s.kind === 'strength'), perWeek = {};
  for (const s of gym) { const k = isoDate(mondayOf(new Date(s.startedAt))); perWeek[k] = (perWeek[k] || 0) + 1; }
  return [
    { title: 'First workout logged', done: gym.length >= 1 },
    { title: 'First padel match logged', done: sessions.some(s => s.kind === 'activity' && s.activity === 'padel') },
    { title: 'Two workouts in one week', done: Object.values(perWeek).some(n => n >= 2) },
    { title: `${SCORES_AFTER} workouts: your scores and forecasts unlock`, done: gym.length >= SCORES_AFTER, sub: `${Math.min(gym.length, SCORES_AFTER)} of ${SCORES_AFTER} done` },
  ];
}
function gettingStarted() {
  const wins = earlyWins(S.sessions);
  return group(wins.map(w => row({ title: esc(w.title), sub: w.sub || (w.done ? 'Done' : ''), icon: w.done ? 'check' : 'clock', color: w.done ? 'green' : 'gray', cls: w.done ? '' : 'todo' })).join(''),
    { header: 'Getting started', big: true, footer: 'Scores and forecasts need a few workouts before they mean anything. Until then, these are your first goals.' });
}

// ── How you're going: direction
function headed() {
  if (app.strength.length < SCORES_AFTER) return gettingStarted();
  const { axes, before, level } = currentStats();
  const xp = xpEvents(S.sessions, { plannedIds: Object.values(S.schedule).filter(isRoutine) });
  const eta = levelEta(xp, level), proj = liftProjections(app.strength), wi = whatIf(app.strength, xp, level, proj);
  const unit = S.settings.unit, by = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const val = (p, v) => p.metric.load ? fmtNum(toDisplay(v, unit)) : fmtNum(v);
  const rows = [
    row({ title: `Level ${level.level} · ${esc(level.name)}`, sub: `<span class="mbar" style="margin:6px 0 4px"><b style="width:${Math.round(level.progress * 100)}%"></b></span>${eta.weeks ? `Level ${level.level + 1} in ~${plural(eta.weeks, 'week')} at your current pace` : 'Train this week to start levelling up'}`, to: 'stats' }),
    ...proj.map(p => row({ title: esc(p.name), sub: p.steady ? `Holding steady around ${val(p, Math.round(p.current))}${p.metric.load ? ' ' + unit : ''}. Consistent sessions will get it moving.` : `Now ${val(p, Math.round(p.current))} → <b>~${val(p, p.low)}–${val(p, p.high)}${p.metric.load ? ' ' + unit : ''}</b> by ${by(p.by)}${p.metric.key === 'e1rm' ? ' (est. max)' : ''}`, to: `history/ex/${p.exId}` })),
  ];
  if (wi && (wi.levelSooner || wi.liftWeeksSooner)) rows.push(row({ title: `Train ${wi.to}× instead of ${wi.from}× a week`, sub: [wi.levelSooner ? `next level ~${plural(wi.levelSooner, 'week')} sooner` : '', wi.liftWeeksSooner ? `lifts reach those numbers ~${plural(wi.liftWeeksSooner, 'week')} sooner` : ''].filter(Boolean).join(' · '), icon: 'bolt', color: 'blue' }));
  return `<section class="grp"><h2 class="grp-h big">Where you’re headed</h2>
    <button class="card" data-action="go" data-to="stats" style="display:block;width:100%;margin-bottom:12px"><div style="max-width:250px;margin:0 auto">${radar(axes, before)}</div></button>
    <div class="grp-b">${rows.join('')}</div>
    <p class="grp-f">${proj.length ? 'Estimates from your recent sessions, assuming progress slows over time. ' : 'Projections appear after about 4 sessions of a lift. '}“If you keep going”, not a promise.</p></section>`;
}

export const overview = {
  tab: 'overview',
  render() {
    const initial = (S.settings.name || '').trim()[0];
    const avatar = `<button class="avatar" data-action="go" data-to="settings" aria-label="Settings">${initial ? esc(initial.toUpperCase()) : icon('person')}</button>`;
    const empty = !S.sessions.length ? `<div class="banner"><span class="tile blue">${icon('chart')}</span><span><b>Your progress fills in as you train</b><small>Finish a workout or log a match to see your calendar, scores and history here.</small></span></div>` : '';
    return `${pageHead('Progress', { right: avatar })}${empty}
      <div style="height:${empty ? 24 : 8}px"></div>${progressPanel()}${calendar()}${goals()}${headed()}
      ${S.sessions.length ? `<section class="grp"><h2 class="grp-h">Details</h2><div class="tile-grid">${[
        ['History', 'Every session and weekly load', 'note', 'gray', 'history'], ['Recovery', 'How ready each muscle is', 'heart', 'orange', 'recovery'],
        ['Exercises', 'Progress per exercise', 'dumbbell', 'blue', 'history/progress'], ['Muscles', 'Sets per muscle this week', 'target', 'blue', 'history/muscles'],
        ['Padel insights', 'Sides, partners, sore spots', 'racket', 'teal', 'history/padel'], ['Weekly review', 'Your week and next week’s focus', 'chart', 'blue', 'review'],
        ['Body', bodySummary(), 'person', 'gray', 'body/o'], ['Your profile', 'Scores, level, milestones', 'trophy', 'green', 'stats'],
      ].map(([t, sub, ic, c, to]) => `<button data-action="go" data-to="${to}">${tile(ic, c)}<b>${esc(t)}</b><small>${esc(sub)}</small></button>`).join('')}</div></section>` : ''}`;
  },
  actions: {
    'cal-prev'() { monthOffset--; app.render({ keepScroll: true }); },
    'cal-next'() { monthOffset = Math.min(0, monthOffset + 1); app.render({ keepScroll: true }); },
    'cal-day'(el) {
      const iso = el.dataset.iso, list = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === iso);
      const d = new Date(iso + 'T12:00'), plan = S.schedule[DAYS[(d.getDay() + 6) % 7]], future = iso > isoDate();
      const title = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
      app.sheet(`<h2 class="sheet-title">${esc(title)}</h2><p class="sheet-sub">${isRoutine(plan) ? `Planned: ${esc(getRoutine(plan).title)}` : plan === 'Padel' ? 'Planned: padel' : 'No workout planned'}</p>
        ${list.length ? group(list.map(s => row({ title: esc(s.title), sub: `${s.durationMin || '—'} min`, to: `history/session/${s.id}` })).join('')) : `<p class="t-sub" style="text-align:center;margin:8px 0 18px">${future ? 'Coming up.' : 'Nothing logged.'}</p>`}
        ${future ? '' : `<div class="btns">${iso < isoDate() ? `<button class="btn tinted" data-action="cal-past" data-iso="${iso}">Log a Past Workout</button>` : ''}<button class="btn ${iso < isoDate() ? 'gray' : 'tinted'}" data-action="cal-log" data-iso="${iso}">Log Padel or Activity</button></div>`}`);
    },
    'cal-past'(el) { pastWorkoutSheet(el.dataset.iso); },
    'goal-tour'() { tournamentSheet(); },
    'goal-lift'(el) { const g = S.settings.liftGoals[+el.dataset.i]; liftSheet(g.exId, +el.dataset.i); },
    'goal-lift-add'() {
      exercisePicker({ title: 'Lift goal', sub: 'Pick an exercise you lift with weight.', inUse: (S.settings.liftGoals || []).map(g => g.exId), usedNote: 'has a goal', pick: id => {
        if (!getExercise(id).fields.includes('w')) return app.toast('Pick an exercise with a weight');
        const i = (S.settings.liftGoals || []).findIndex(g => g.exId === id);
        setTimeout(() => liftSheet(id, i), 250);
      } });
    },
    'cal-log'(el) { app.closeSheet(); activitySheet('padel', null, el.dataset.iso); },
  },
};
