// Progress tab (route 'overview'): what happened, then how you're going. Today is the home screen.
import { app, S } from './core-app.js';
import { esc, icon, pageHead, group, row } from './ui-kit.js';
import { isRoutine, getRoutine } from './domain-program.js';
import { isoDate, mondayOf } from './domain-calendar.js';
import { DAYS } from './domain-program.js';
import { monthGrid, monthStats, liftProjections, levelEta, whatIf, trackingSince } from './domain-overview.js';
import { xpEvents } from './domain-stats.js';
import { weekStreak } from './domain-analytics.js';
import { fmtW, fmtNum, toDisplay } from './domain-units.js';
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
  if (wi && (wi.levelSooner || wi.liftWeeksSooner)) rows.push(row({ title: `Train ${wi.to}× instead of ${wi.from}× a week`, sub: [wi.levelSooner ? `next level ~${plural(wi.levelSooner, 'week')} sooner` : '', wi.liftWeeksSooner ? `lifts reach those numbers ~${plural(wi.liftWeeksSooner, 'week')} sooner` : ''].filter(Boolean).join(' · '), icon: 'bolt', color: 'orange' }));
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
      <div style="height:${empty ? 24 : 8}px"></div>${calendar()}${headed()}
      ${S.sessions.length ? group(row({ title: 'History', sub: 'Every session, weekly load, padel stats', icon: 'note', color: 'gray', to: 'history' })
        + row({ title: 'Recovery', sub: 'How ready each muscle is', icon: 'heart', color: 'pink', to: 'recovery' })
        + row({ title: 'Exercises', sub: 'Progress per exercise', icon: 'dumbbell', color: 'indigo', to: 'history/progress' })
        + row({ title: 'Muscles', sub: 'Sets per muscle this week', icon: 'target', color: 'blue', to: 'history/muscles' })
        + row({ title: 'Weekly review', sub: 'Your week vs the last, and next week’s focus', icon: 'chart', color: 'indigo', to: 'review' })
        + row({ title: 'Body', sub: esc(bodySummary()), icon: 'person', color: 'teal', to: 'body/o' })
        + row({ title: 'Your profile', sub: 'Scores, level and milestones', icon: 'trophy', color: 'orange', to: 'stats' }), { header: 'Details' }) : ''}`;
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
    'cal-log'(el) { app.closeSheet(); activitySheet('padel', null, el.dataset.iso); },
  },
};
