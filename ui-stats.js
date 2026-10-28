// Progress pentagon, level and badges. Private: nothing here leaves the device.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row } from './ui-kit.js';
import { pentagon, xpEvents, levelFor, achievements } from './domain-stats.js';
import { isRoutine } from './domain-program.js';
import { relDay } from './domain-calendar.js';

const DAY = 86400000;
const planned = () => Math.max(1, Object.values(S.schedule).filter(isRoutine).length);
export const currentStats = () => {
  const now = Date.now();
  return { axes: pentagon(S.sessions, { plannedPerWeek: planned(), now }), before: pentagon(S.sessions, { plannedPerWeek: planned(), now: now - 28 * DAY }), level: levelFor(xpEvents(S.sessions, { plannedIds: Object.values(S.schedule).filter(isRoutine) }).reduce((n, e) => n + e.xp, 0)) };
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
    const [x, y] = pt(i, 128), anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x}" y="${y - 4}" text-anchor="${anchor}" class="rd-label">${esc(a.label)}</text><text x="${x}" y="${y + 12}" text-anchor="${anchor}" class="rd-score">${a.score}</text>`;
  }).join('') : '';
  return `<svg class="radar" viewBox="-62 -12 424 334" width="${size}" role="img" aria-label="Progress pentagon: ${esc(axes.map(a => `${a.label} ${a.score}`).join(', '))}">${rings}${spokes}${prev}${cur}${lab}</svg>`;
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

export const stats = {
  tab: 'history',
  render() {
    const { axes, before, level } = currentStats();
    const xp = xpEvents(S.sessions, { plannedIds: Object.values(S.schedule).filter(isRoutine) }).slice(0, 8);
    const badges = achievements(S.sessions);
    return `${navBar({ back: 'Progress', backTo: 'history', title: 'Your Profile' })}
      <div class="card" style="margin-top:12px"><div style="max-width:320px;margin:0 auto">${radar(axes, before)}</div>
        <div class="bm-legend"><span><i style="width:14px;height:3px;background:var(--blue);display:inline-block;border-radius:2px;margin-right:4px;vertical-align:middle"></i>Now</span><span><i style="width:14px;height:0;border-top:2px dashed var(--label-3);display:inline-block;margin-right:4px;vertical-align:middle"></i>4 weeks ago</span></div></div>
      <div style="height:24px"></div>
      ${group(axes.map(a => { const d = a.score - (before.find(b => b.key === a.key)?.score || 0); return row({ title: esc(a.label), sub: esc(a.parts.map(p => p.detail).join(' · ')), value: `${a.score}${d ? ` <span class="t-foot ${d > 0 ? 'green' : 'red'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : ''}`, action: 'axis-sheet', data: { k: a.key } }); }).join(''),
        { header: 'Scores', footer: 'Out of 100. They compare you with your own training over the last 4 weeks, not with other people.' })}
      <section class="grp"><h2 class="grp-h">Level</h2><div class="card">${levelBar(level)}</div><p class="grp-f">Points come from showing up and training well: finishing workouts, hitting your targets, records, prevention routines, logged matches and active weeks. Extra sets don’t earn more, so there’s no reward for overdoing it.</p></section>
      ${group(badges.map(b => row({ title: esc(b.label), value: b.done ? '' : b.progress, right: b.done ? icon('check', 'check-mark') : '', icon: b.done ? 'trophy' : 'target', color: b.done ? 'orange' : 'gray' })).join(''), { header: 'Milestones' })}
      ${xp.length ? group(xp.map(e => row({ title: esc(e.label), sub: esc(relDay(e.ts)), value: `+${e.xp}` })).join(''), { header: 'Recent points' }) : ''}
      <p class="fine">Private to this device.</p>`;
  },
  actions: { 'axis-sheet'(el) { axisSheet(el.dataset.k); } },
};
