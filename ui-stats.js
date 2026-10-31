// Progress pentagon, level and badges. Private: nothing here leaves the device.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row, seg } from './ui-kit.js';
import { pentagon, xpEvents, levelFor, achievements } from './domain-stats.js';
import { isRoutine } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { relDay } from './domain-calendar.js';
import { headed } from './ui-overview.js';
import { padelPentagon, SHOTS, TIERS } from './domain-challenges.js';
import { challengeActions } from './ui-challenges.js';

const DAY = 86400000;
const planned = () => Math.max(1, Object.values(S.schedule).filter(isRoutine).length);
// Power needs jumps and throws. If none of your scheduled workouts has any and you haven't
// done any, the score isn't a judgement: it's just not part of your plan (shown as "—").
const powerInPlan = () => Object.values(S.schedule).filter(isRoutine).some(id => app.routine(id)?.blocks.some(b => getExercise(b.ex)?.category === 'power'));
const markPlan = axes => axes.map(a => a.key === 'power' && a.score === 0 && !powerInPlan() ? { ...a, notInPlan: true } : a);
export const currentStats = () => {
  const now = Date.now();
  return { axes: markPlan(pentagon(S.sessions, { plannedPerWeek: planned(), now })), before: pentagon(S.sessions, { plannedPerWeek: planned(), now: now - 28 * DAY }), level: levelFor(xpEvents(S.sessions, { plannedIds: Object.values(S.schedule).filter(isRoutine), shotStarts: S.settings.shots || {} }).reduce((n, e) => n + e.xp, 0)) };
};

// Original radar chart: five axes, rings at 25/50/75/100, now vs 4 weeks ago.
export function radar(axes, before = null, { size = 300, labels = true } = {}) {
  const cx = 150, cy = 150, R = 96, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = R * v / 100; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = vals => vals.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
  const rings = [25, 50, 75, 100].map(v => `<polygon points="${poly(axes.map(() => v))}" class="rd-ring"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="rd-ring"/>`; }).join('');
  const prev = before && before.some(a => a.score > 0) ? `<polygon points="${poly(before.map(a => a.score))}" class="rd-prev"/>` : '';
  const cur = `<polygon points="${poly(axes.map(a => Math.max(3, a.score)))}" class="rd-cur"/>` + axes.map((a, i) => { const [x, y] = pt(i, Math.max(3, a.score)); return `<circle cx="${x}" cy="${y}" r="3.5" class="rd-dot"/>`; }).join('');
  const lab = labels ? axes.map((a, i) => {
    const [x, y] = pt(i, 122), anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x}" y="${y - 6}" text-anchor="${anchor}" class="rd-label">${esc(a.label)}</text><text x="${x}" y="${y + 18}" text-anchor="${anchor}" class="rd-score">${a.notInPlan || a.dash ? '—' : a.score}</text>`;
  }).join('') : '';
  return `<svg class="radar" viewBox="-104 -26 508 360" width="${size}" role="img" aria-label="Progress pentagon: ${esc(axes.map(a => `${a.label} ${a.score}`).join(', '))}">${rings}${spokes}${prev}${cur}${lab}</svg>`;
}

function levelBar(L) {
  return `<div class="lvl"><div class="lvl-top"><span class="lvl-badge">${L.level}</span><span><b>${esc(L.name)}</b><small>${L.into} / ${L.need} points to level ${L.level + 1}</small></span></div><div class="mbar" style="margin-top:10px"><b style="width:${Math.round(L.progress * 100)}%"></b></div></div>`;
}

// Card at the top of Progress.
export function statsCard() {
  if (!S.sessions.length) return '';
  const { axes, before, level } = currentStats();
  return `<button class="card" data-action="go" data-to="stats" style="display:block;width:100%;text-align:left;margin-bottom:24px">
    <div style="max-width:250px;margin:0 auto">${radar(axes, before)}</div>${levelBar(level)}</button>`;
}

function axisSheet(key) {
  const a = currentStats().axes.find(x => x.key === key), b = currentStats().before.find(x => x.key === key);
  const diff = a.score - b.score;
  app.sheet(`<h2 class="sheet-title">${esc(a.label)} · ${a.score}</h2><p class="sheet-sub">${b.score || a.score ? `${diff > 0 ? `Up ${diff}` : diff < 0 ? `Down ${-diff}` : 'Same as'} vs 4 weeks ago.` : ''} Based on your last 4 weeks.</p>
    ${group(a.parts.map(p => row({ title: esc(p.label), sub: esc(p.detail), value: `${p.points}` })).join(''), { header: 'How it’s calculated' })}
    ${group(row({ title: esc(a.tip) }), { header: 'How to raise it' })}`);
}

// Which pentagon Your Profile shows: your gym scores or your padel shots.
let VIEW = 'gym';
const legend = `<div class="bm-legend"><span><i style="width:14px;height:3px;background:var(--blue);display:inline-block;border-radius:2px;margin-right:4px;vertical-align:middle"></i>Now</span><span><i style="width:14px;height:0;border-top:2px dashed var(--label-3);display:inline-block;margin-right:4px;vertical-align:middle"></i>4 weeks ago</span></div>`;
const diffTag = d => d ? ` <span class="t-foot ${d > 0 ? 'green' : 'red'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : '';

// The padel pentagon: one point per shot from its challenge tiers (fed balls and drills).
function padelView() {
  const now = Date.now(), starts = S.settings.shots || {}, axes = padelPentagon(S.sessions, starts, now).map(a => ({ ...a, dash: !a.started })), before = padelPentagon(S.sessions, starts, now - 28 * DAY);
  const none = axes.every(a => !a.started);
  return `<div class="card" style="margin-top:12px"><div style="max-width:320px;margin:0 auto">${radar(axes, before)}</div>${none ? '<p class="t-foot" style="text-align:center;margin:4px 0 0">No shot results yet. Add one when you log a lesson, training or ball-machine session.</p>' : legend}</div>
      <div style="height:24px"></div>
      ${group(axes.map(a => { const was = before.find(b => b.key === a.key), t = a.next ? TIERS[a.next] : null;
        // A shot started in the last 4 weeks shows "new": its score includes the starting tier you chose, so a ▲ would overstate it.
        const change = !a.started ? '' : was?.started ? diffTag(a.score - was.score) : ' <span class="t-foot green">new</span>';
        const sub = !a.started ? 'Not started' : `${a.level}${a.faded ? ' · not practised for 8 weeks' : t ? ` · next: ${t.goal(a.key)}` : ' · every tier cleared'}`;
        return row({ title: esc(SHOTS[a.key]), sub: esc(sub), value: a.started ? `${a.score}${change}` : '—', action: 'shot-sheet', data: { id: a.key } }); }).join(''),
        { header: 'Shots', footer: 'Out of 100 from your challenge tiers: each tier cleared is a third, and your best result toward the next tier fills in between. They compare you with your own results, not with other people.' })}`;
}

export const stats = {
  tab: 'overview',
  onPick(name, v) { if (name === 'profileView') { VIEW = v; app.render({ keepScroll: true }); } },
  render() {
    const { axes, before, level } = currentStats();
    const xp = xpEvents(S.sessions, { plannedIds: Object.values(S.schedule).filter(isRoutine), shotStarts: S.settings.shots || {} }).slice(0, 8);
    const badges = achievements(S.sessions);
    const gym = `<div class="card" style="margin-top:12px"><div style="max-width:320px;margin:0 auto">${radar(axes, before)}</div>${legend}</div>
      <div style="height:24px"></div>
      ${group(axes.map(a => { const d = a.score - (before.find(b => b.key === a.key)?.score || 0); return row({ title: esc(a.label), sub: a.notInPlan ? 'Not in your plan yet: none of your scheduled workouts has jumps or throws. Add Power & Agility to a day in Plan if you want it.' : esc(a.parts.map(p => p.detail).join(' · ')), value: a.notInPlan ? '—' : `${a.score}${diffTag(d)}`, action: 'axis-sheet', data: { k: a.key } }); }).join(''),
        { header: 'Scores', footer: 'Out of 100. They compare you with your own training over the last 4 weeks, not with other people.' })}`;
    return `${navBar({ back: 'Progress', backTo: 'overview', title: 'Your Profile' })}
      <div style="margin-top:12px">${seg('profileView', [['gym', 'Gym'], ['padel', 'Padel']], VIEW)}</div>
      ${VIEW === 'padel' ? padelView() : gym}
      <section class="grp"><h2 class="grp-h">Level</h2><div class="card">${levelBar(level)}</div><p class="grp-f">Points come from showing up and training well: finishing workouts, hitting your targets, records, prevention routines, logged matches and active weeks. Extra sets don’t earn more, so there’s no reward for overdoing it.</p></section>
      ${group(badges.map(b => row({ title: esc(b.label), value: b.done ? '' : b.progress, right: b.done ? icon('check', 'check-mark') : '', icon: b.done ? 'trophy' : 'target', color: b.done ? 'orange' : 'gray' })).join(''), { header: 'Milestones' })}
      ${xp.length ? group(xp.map(e => row({ title: esc(e.label), sub: esc(relDay(e.ts)), value: `+${e.xp}` })).join(''), { header: 'Recent points' }) : ''}
      <p class="fine">Private to this device.</p>
      ${headed()}`;
  },
  actions: { 'axis-sheet'(el) { axisSheet(el.dataset.k); }, ...challengeActions },
};
