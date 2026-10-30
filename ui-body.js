// Body: log weight, body fat and waist; see the trend and strength relative to body weight.
import { app, S } from './core-app.js';
import { esc, icon, navBar, group, row, stat, lineChart } from './ui-kit.js';
import { upsertEntry, trend, change, latest, leanMass, relativeStrength } from './domain-body.js';
import { fromDisplay, fmtNum } from './domain-units.js';
import { isoDate, parseISO } from './domain-calendar.js';

const unit = () => S.settings.unit;
const IN = 2.54;
// Body weight to 0.1 (loads round to 0.25, which is too coarse here).
const wD = kg => kg == null ? null : Math.round((unit() === 'lb' ? kg * 2.2046226 : kg) * 10) / 10;
const waistD = cm => cm == null ? null : unit() === 'lb' ? Math.round(cm / IN * 10) / 10 : cm;
const waistU = () => unit() === 'lb' ? 'in' : 'cm';
const dayLabel = iso => parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
// Changes are small, so show them to 0.1 rather than the 0.25 used for loads.
const delta = kg => unit() === 'lb' ? Math.round(kg * 2.2046226 * 10) / 10 : Math.round(kg * 10) / 10;
const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmtNum(Math.abs(v))}`;

// Summary line for other pages (Plan, Progress).
export function bodySummary() {
  const w = latest(S.body, 'kg');
  if (!w) return 'Log weight, body fat and waist';
  const ch = change(S.body, 'kg');
  return `${fmtNum(wD(w.kg))} ${unit()}${ch ? ` · ${signed(delta(ch.diff))} ${unit()} in 4 weeks` : ''}`;
}

function view() {
  const back = S.params[0] === 'o' ? { back: 'Progress', backTo: 'overview' } : { back: 'You', backTo: 'settings' };
  const w = latest(S.body, 'kg'), bf = latest(S.body, 'bf'), waist = latest(S.body, 'waist');
  const ch = change(S.body, 'kg'), wt = trend(S.body, 'kg');
  const head = `${navBar({ ...back, title: '' })}<h1 class="t-large" style="padding:8px 4px 2px">Body</h1><p class="t-sub" style="padding:0 4px 18px">Weight, body fat and waist over time.</p>`;
  const logBtn = `<button class="btn filled" data-action="body-log">${icon('plus')}Log ${S.body.some(e => e.date === isoDate()) ? 'Again Today' : 'Today'}</button>`;
  if (!w && !bf && !waist) return `${head}<div class="card" style="text-align:center;padding:28px 18px"><p class="t-head">Start your body log</p><p class="t-sub" style="margin:6px 0 18px">Weigh in once or twice a week, in the morning before eating. The trend line smooths out daily water swings.</p>${logBtn}</div>`;
  const lean = w && bf ? leanMass(w.kg, bf.bf) : null;
  const rel = relativeStrength(app.strength, wt.length ? wt[wt.length - 1].y : w?.kg);
  const chart = (key, conv, label, u) => { const pts = trend(S.body, key).map(p => ({ x: p.x, y: conv(p.y) })); return pts.length ? `<section class="grp"><h2 class="grp-h">${label}</h2><div class="card">${lineChart(pts, { fmt: v => fmtNum(v), empty: `Log ${label.toLowerCase()} twice to see the trend.` })}</div></section>` : ''; };
  return `${head}
    <div class="tiles three">${stat(w ? fmtNum(wD(w.kg)) : '—', 'Weight', w ? unit() : '')}${stat(bf ? fmtNum(bf.bf) : '—', 'Body fat', bf ? '%' : '')}${stat(waist ? fmtNum(waistD(waist.waist)) : '—', 'Waist', waist ? waistU() : '')}</div>
    <p class="t-sub" style="padding:10px 4px 18px">${ch ? `Trend ${fmtNum(wD(ch.now))} ${unit()}: <b>${signed(delta(ch.diff))} ${unit()}</b> since ${esc(new Date(ch.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))} (about ${signed(delta(ch.perWeek))} ${unit()} a week).` : 'Log a few more times to see your trend.'}${lean ? ` Lean mass about ${fmtNum(wD(lean))} ${unit()}.` : ''}</p>
    ${logBtn}<div style="height:8px"></div>
    ${chart('kg', wD, 'Weight trend', unit())}${chart('bf', v => v, 'Body fat', '%')}${chart('waist', waistD, 'Waist', waistU())}
    ${rel.length ? group(rel.map(r => row({ title: esc(r.name), sub: `Estimated max ${fmtNum(wD(r.max))} ${unit()}`, value: `${fmtNum(r.ratio)}× body weight`, to: `history/ex/${r.exId}` })).join(''), { header: 'Strength for your size', footer: 'Your best estimated max over the last 8 weeks divided by your body weight. It goes up when you get stronger or leaner.' }) : ''}
    ${group([...S.body].reverse().slice(0, 12).map(e => row({ title: esc(dayLabel(e.date)), value: esc([e.kg != null && `${fmtNum(wD(e.kg))} ${unit()}`, e.bf != null && `${fmtNum(e.bf)}%`, e.waist != null && `${fmtNum(waistD(e.waist))} ${waistU()}`].filter(Boolean).join(' · ')), action: 'body-log', data: { date: e.date } })).join(''), { header: 'Entries', footer: 'Weigh in the same way each time for comparable numbers. Smart-scale body fat is a rough estimate: watch its trend, not single readings.' })}`;
}

function logSheet(date = isoDate()) {
  const e = S.body.find(x => x.date === date) || {};
  const prev = latest(S.body, 'kg');
  const field = (id, label, val, u, ph) => `<label class="row"><span class="row-main"><span class="row-title">${label}</span></span><input class="input num" id="${id}" type="number" inputmode="decimal" step="any" min="0" value="${val ?? ''}" placeholder="${ph ?? ''}" style="width:96px;text-align:right;background:none;padding:0" aria-label="${label}"><span class="t-foot" style="width:30px">${u}</span></label>`;
  app.sheet(`<h2 class="sheet-title">${e.date ? 'Edit entry' : 'Log body'}</h2><p class="sheet-sub">Fill in what you have. Only weight is needed for the trend.</p>
    ${group(row({ title: 'Date', right: `<input class="input" id="bDate" type="date" value="${esc(date)}" max="${isoDate()}" style="width:150px;text-align:right;background:none;padding:0" aria-label="Date">` })
      + field('bKg', 'Weight', e.kg != null ? fmtNum(wD(e.kg)) : '', unit(), prev ? fmtNum(wD(prev.kg)) : '')
      + field('bBf', 'Body fat', e.bf, '%', 'optional') + field('bWaist', 'Waist', e.waist != null ? waistD(e.waist) : '', waistU(), 'optional'))}
    <button class="btn filled" id="bSave">Save</button>
    ${e.date ? `<button class="btn plain red" id="bDel" style="margin-top:8px">Delete Entry</button>` : ''}`, body => {
    const num = id => { const v = body.querySelector(id).value.replace(',', '.'); return v === '' ? null : +v; };
    setTimeout(() => body.querySelector('#bKg').focus(), 50);
    body.querySelector('#bSave').onclick = async () => {
      const d = body.querySelector('#bDate').value || isoDate(), kg = num('#bKg'), bf = num('#bBf'), w = num('#bWaist');
      if (kg == null && bf == null && w == null) return app.toast('Add at least one number');
      if (bf != null && (bf <= 2 || bf >= 70)) return app.toast('Body fat should be a percentage, e.g. 18');
      if (date !== d) S.body = S.body.filter(x => x.date !== date);
      S.body = upsertEntry(S.body, { date: d, kg: kg == null ? null : fromDisplay(kg, unit()), bf, waist: w == null ? null : unit() === 'lb' ? Math.round(w * IN * 10) / 10 : w });
      await app.save('body'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Saved');
    };
    const del = body.querySelector('#bDel');
    if (del) del.onclick = async () => { S.body = S.body.filter(x => x.date !== date); await app.save('body'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Entry deleted'); };
  });
}

export const body = {
  get tab() { return S.params[0] === 'o' ? 'overview' : 'plan'; },
  render: view,
  actions: { 'body-log'(el) { logSheet(el.dataset.date); } },
};
