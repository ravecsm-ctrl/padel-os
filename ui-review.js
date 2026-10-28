// Weekly review: the week at a glance, against the week before, and next week's focus.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row, stat } from './ui-kit.js';
import { mname } from './ui-words.js';
import { weekReview, reviewWeekStart } from './domain-review.js';
import { fmtW, fmtNum, toDisplay, fmtEst } from './domain-units.js';
import { isoDate, programPosition } from './domain-calendar.js';

let offset = 0; // weeks back from the default review week
const unit = () => S.settings.unit;
const range = (from, to) => { const f = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); return `${f(from)} – ${f(to - 86400000)}`; };
const delta = (a, b, fmt = String) => b == null || a === b ? '' : ` <span class="t-foot ${a > b ? 'green' : 'red'}">${a > b ? '▲' : '▼'}${fmt(Math.abs(a - b))}</span>`;

export const currentReview = (off = 0) => {
  const start = reviewWeekStart(); start.setDate(start.getDate() - 7 * off);
  return weekReview(S.sessions, { weekStart: start, schedule: S.schedule, body: S.body, week: programPosition(S.settings.programStart, start).week, painClear: S.painClear, name: mname });
};

// For Today: a nudge on Sunday and Monday until you've opened the latest review.
export function reviewBanner() {
  const d = new Date().getDay(), key = isoDate(reviewWeekStart());
  if (![0, 1].includes(d) || S.settings.reviewSeen === key || !S.sessions.length) return '';
  const r = currentReview();
  return `<button class="banner" data-action="go" data-to="review">${`<span class="tile indigo">${icon('chart')}</span>`}<span><b>Your week in review</b><small>${r.workouts} workout${r.workouts === 1 ? '' : 's'}${r.planned ? ` of ${r.planned} planned` : ''}${r.matches ? ` · ${r.matches} padel` : ''}${r.prs.length ? ` · ${r.prs.length} record${r.prs.length > 1 ? 's' : ''}` : ''}</small></span><svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg></button>`;
}

function view() {
  const r = currentReview(offset), u = unit();
  const dots = r.days.map(d => `<div class="rv-day"><span class="rv-dot ${d.gym ? 'gym' : d.padel ? 'padel' : d.other ? 'other' : d.planned ? 'missed' : ''}"></span><small>${d.day[0]}</small></div>`).join('');
  const vol = Math.round(toDisplay(r.volume, u)), pvol = Math.round(toDisplay(r.prev.volume, u));
  return `${navBar({ back: 'Progress', backTo: 'overview', title: '' })}
    <div class="cal-head" style="padding:8px 4px 4px"><h1 class="t-title">${offset === 0 ? 'Weekly review' : 'Week of'}</h1>
      <span><button class="icon-circle" data-action="rv-prev" aria-label="Previous week">${icon('chevL')}</button> <button class="icon-circle" data-action="rv-next" ${offset === 0 ? 'disabled' : ''} aria-label="Next week">${icon('chevR')}</button></span></div>
    <p class="t-sub" style="padding:0 4px 16px">${esc(range(r.from, r.to))}${r.inProgress ? ' · in progress' : ''}</p>
    <div class="card rv-week">${dots}</div>
    <div class="tiles three" style="margin-top:16px">${stat(`${r.workouts}${r.planned ? `<span class="u">/${r.planned}</span>` : ''}`, 'Workouts')}${stat(r.matches, 'Padel')}${stat(fmtNum(Math.round(r.minutes / 6) / 10), 'Hours')}</div>
    ${group(row({ title: 'Workouts', value: `${r.workouts}${delta(r.workouts, r.prev.workouts)}` })
      + row({ title: 'Padel sessions', value: `${r.matches}${delta(r.matches, r.prev.matches)}` })
      + row({ title: 'Sets', value: `${r.sets}` })
      + row({ title: 'Volume lifted', value: `${vol ? `${vol.toLocaleString()} ${u}` : '—'}${vol && pvol ? delta(vol, pvol, v => v.toLocaleString()) : ''}` })
      + (r.bodyChange != null ? row({ title: 'Weight trend', value: `${r.bodyChange > 0 ? '+' : r.bodyChange < 0 ? '−' : '±'}${fmtNum(Math.abs(u === 'lb' ? Math.round(r.bodyChange * 22.046) / 10 : r.bodyChange))} ${u}` }) : '')
      + (r.routines ? row({ title: 'Stretching & mobility', value: `${r.routines}` }) : ''), { header: 'Compared with the week before', footer: 'Arrows compare with the previous week.' })}
    ${r.accuracy || r.checkins ? group((r.accuracy ? row({ title: 'Suggested weights', sub: `${r.accuracy.matched} of ${r.accuracy.checked} lifts matched${r.accuracy.heavier ? ` · ${r.accuracy.heavier} heavier` : ''}${r.accuracy.lighter ? ` · ${r.accuracy.lighter} lighter` : ''}`, value: `${Math.round(r.accuracy.matched / r.accuracy.checked * 100)}%` }) : '')
      + (r.checkins ? row({ title: 'Check-ins', sub: `Sleep ${fmtNum(r.checkins.sleep)} · energy ${fmtNum(r.checkins.energy)} · soreness ${fmtNum(r.checkins.soreness)} (out of 5)`, value: `${r.checkins.count}` }) : ''),
      { header: 'How the app did', footer: 'Suggested weights count as matched within one weight step. Rate your sets so suggestions learn from how they felt.' }) : ''}
    ${r.prs.length ? group(r.prs.slice(0, 5).map(p => row({ title: esc(p.name), sub: p.type === 'e1RM' ? 'New estimated max' : `New ${esc(p.type.toLowerCase())}`, value: p.type === 'e1RM' ? esc(fmtEst(p.value, u)) : p.type === 'Heaviest' ? esc(fmtW(p.value, u)) : fmtNum(p.value), icon: 'trophy', color: 'green', to: `history/ex/${p.exId}` })).join(''), { header: `Records · ${r.prs.length}`, footer: r.prs.length > 5 ? `And ${r.prs.length - 5} more this week.` : '' }) : ''}
    ${group(r.focus.map((f, i) => row({ title: esc(f), icon: i === r.focus.length - 1 ? 'target' : 'chevR', color: i === r.focus.length - 1 ? 'indigo' : 'blue' })).join(''), { header: offset === 0 ? 'Focus for next week' : 'What would have helped' })}
    <p style="text-align:center;margin:4px 0 8px"><button class="link" data-action="go" data-to="feedback">Feedback notes${S.feedback.length ? ` (${S.feedback.length})` : ''}</button></p>`;
}

export const review = {
  tab: 'overview',
  render: view,
  async mounted() {
    if (offset === 0) { const key = isoDate(reviewWeekStart()); if (S.settings.reviewSeen !== key) { S.settings.reviewSeen = key; await app.save('settings'); } }
  },
  actions: {
    'rv-prev'() { offset++; app.render(); },
    'rv-next'() { offset = Math.max(0, offset - 1); app.render(); },
  },
};
