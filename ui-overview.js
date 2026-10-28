// Overview: the home screen. What needs doing → what happened → how you're going.
import { app, S } from './core-app.js';
import { esc, icon, chev, pageHead, group, row, routineLook } from './ui-kit.js';
import { isRoutine, getRoutine } from './domain-program.js';
import { dayKey, isoDate, relDay } from './domain-calendar.js';
import { DAYS } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { MUSCLES } from './domain-taxonomy.js';
import { recentPain, painHits, areaName } from './domain-pain.js';
import { COURT_ROUTINES, routineMinutes } from './domain-court.js';
import { monthGrid, monthStats, liftProjections, levelEta, whatIf, trackingSince } from './domain-overview.js';
import { xpEvents } from './domain-stats.js';
import { weekStreak } from './domain-analytics.js';
import { fmtW, fmtNum, toDisplay } from './domain-units.js';
import { currentRecovery, recoveryMapSvg } from './ui-recovery.js';
import { currentStats, radar } from './ui-stats.js';
import { banners, activitySheet, pastWorkoutSheet } from './ui-today.js';
import { bodySummary } from './ui-body.js';
import { reviewBanner } from './ui-review.js';

let monthOffset = 0;
const MONTH = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ── What needs doing
function recoveringHint(routineId, rec) {
  const r = app.routine(routineId);
  const pain = recentPain(S.sessions, { cleared: S.painClear }), hurt = [...new Set(r.blocks.flatMap(b => painHits(b.ex, pain)))];
  if (hurt.length) return `Gentler options ready for your ${hurt.slice(0, 2).map(a => areaName(a).toLowerCase()).join(' and ')}`;
  if (S.settings.adaptive === false) return '';
  const tired = [...new Set(r.blocks.flatMap(b => getExercise(b.ex)?.primary || []))].map(m => [m, rec[m]?.level || 0]).filter(([, l]) => l >= 0.35).sort((a, b) => b[1] - a[1]);
  if (!tired.length) return '';
  const names = tired.slice(0, 2).map(([m]) => MUSCLES[m].toLowerCase()).join(' and ');
  return tired[0][1] >= 0.6 ? `Lighter today: ${names} still recovering` : `${names[0].toUpperCase() + names.slice(1)} still recovering`;
}

function upNext(rec) {
  const plan = S.schedule[dayKey()];
  const today = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === isoDate());
  const slim = (ic, color, title, sub, attrs) => `<button class="card upnext" ${attrs}>${`<span class="tile ${color}">${icon(ic)}</span>`}<span class="row-main"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>${chev}</button>`;
  if (today.length) return slim('check', 'green', `Done today · ${esc(today.map(s => s.title).join(' + '))}`, today[0].durationMin ? `${today[0].durationMin} min` : '', `data-action="go" data-to="history/session/${esc(today[0].id)}"`);
  if (isRoutine(plan)) {
    const r = app.routine(plan), look = routineLook(plan), hint = recoveringHint(plan, rec);
    return slim(look.icon, look.color, `${esc(r.title)} · ${r.minutes} min`, hint ? `<span class="orange">${esc(hint)}</span>` : `${plural(r.blocks.length, 'exercise')} · tap to start`, `data-action="start" data-routine="${esc(plan)}"`);
  }
  if (plan === 'Padel') return slim('racket', 'teal', 'Padel day', `Warm up (${routineMinutes(COURT_ROUTINES.warmup)} min) · then log your match`, 'data-action="go" data-to="court/warmup"');
  // Rest or recovery: say what's next.
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(DAYS.indexOf(dayKey()) + i) % 7];
    if (isRoutine(S.schedule[d])) return slim(plan === 'Recovery' ? 'heart' : 'snow', plan === 'Recovery' ? 'pink' : 'gray', plan === 'Recovery' ? 'Recovery day' : 'Rest day', `Next: ${esc(getRoutine(S.schedule[d]).title)} ${i === 1 ? 'tomorrow' : `on ${({ Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' })[d]}`}`, 'data-action="go" data-to="today"');
  }
  return slim('snow', 'gray', 'Rest day', 'Nothing scheduled', 'data-action="go" data-to="plan"');
}

// ── What happened
function calendar() {
  const now = new Date(), view = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const weeks = monthGrid(view.getFullYear(), view.getMonth(), S.sessions, S.schedule, { isRoutine, since: trackingSince(S.sessions, S.settings.programStart), now });
  const st = monthStats(weeks), streak = weekStreak(S.sessions);
  const cell = d => {
    const dots = d.done.map(k => `<i class="cd ${k}"></i>`).join('') || (d.missed ? '<i class="cd missed"></i>' : d.future && d.plan ? `<i class="cd plan ${d.plan}"></i>` : '');
    return `<button class="cday ${d.inMonth ? '' : 'out'} ${d.today ? 'today' : ''}" data-action="cal-day" data-iso="${d.iso}" aria-label="${d.iso}${d.done.length ? ', trained' : d.missed ? ', planned workout missed' : ''}"><span>${d.day}</span><span class="cdots">${dots}</span></button>`;
  };
  return `<section class="grp"><div class="cal-head"><h2 class="grp-h big" style="margin:0">${esc(MONTH(view))}</h2>
      <span><button class="icon-circle" data-action="cal-prev" aria-label="Previous month">${icon('chevL')}</button><button class="icon-circle" data-action="cal-next" ${monthOffset >= 0 ? 'disabled' : ''} aria-label="Next month">${icon('chevR')}</button></span></div>
    <div class="card"><div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<small>${d}</small>`).join('')}${weeks.flat().map(cell).join('')}</div>
      <div class="legend" style="justify-content:center"><span><i class="gym"></i>Workout</span><span><i class="padel"></i>Padel</span><span><i style="background:none;box-shadow:inset 0 0 0 1.5px var(--label-3)"></i>Missed</span></div></div>
    <p class="grp-f">${plural(st.sessions, 'session')} this month${streak ? ` · 🔥 ${plural(streak, 'week')} in a row` : ''}${st.missed ? ` · ${st.missed} planned missed` : ''}</p></section>`;
}

// ── How you're going: body
function recoverySection(rec) {
  if (!S.sessions.some(s => Date.now() - s.startedAt < 8 * 86400000)) return '';
  const busy = Object.entries(rec).filter(([, r]) => r.key !== 'ready').sort((a, b) => b[1].level - a[1].level);
  return `<section class="grp"><h2 class="grp-h big">Recovery</h2><button class="card" data-action="go" data-to="recovery" style="display:block;width:100%;text-align:left">
    <div style="max-width:230px;margin:0 auto">${recoveryMapSvg(rec)}</div>
    <div class="row" style="padding:8px 0 0"><span class="row-main"><span class="row-title">${busy.length ? esc(busy.slice(0, 3).map(([m, r]) => `${MUSCLES[m]} ${r.when}`).join(' · ')) : 'Everything is ready to train'}</span><span class="row-sub">${busy.length ? `${plural(busy.length, 'muscle')} still recovering` : 'Fully recovered'}</span></span>${chev}</div></button></section>`;
}

// ── How you're going: direction
function headed() {
  if (!app.strength.length) return '';
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
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const initial = (S.settings.name || '').trim()[0], loc = app.location();
    const avatar = `<button class="avatar" data-action="go" data-to="settings" aria-label="Settings">${initial ? esc(initial.toUpperCase()) : icon('person')}</button>`;
    const rec = currentRecovery();
    const empty = !S.sessions.length ? `<div class="banner"><span class="tile blue">${icon('chart')}</span><span><b>Your overview fills in as you train</b><small>Finish a workout or log a match to see your calendar, recovery and progress here.</small></span></div>` : '';
    return `${pageHead('Overview', { eyebrow: date, right: avatar, sub: loc ? `Training at <button class="link" data-action="loc-sheet">${esc(loc.name)} ▾</button>` : '' })}
      ${banners()}${reviewBanner()}${upNext(rec)}${empty}
      <div style="height:24px"></div>${calendar()}${recoverySection(rec)}${headed()}
      ${S.sessions.length ? group(row({ title: 'History', sub: 'Every session, weekly load, padel stats', icon: 'note', color: 'gray', to: 'history' })
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
