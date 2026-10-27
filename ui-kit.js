// Small rendering helpers and dependency-free SVG charts.
export const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
export const attr = o => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(' ');

export const title = (h, eyebrow, right = '') => `<div class="section-title"><div>${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h2>${esc(h)}</h2></div>${right}</div>`;
export const stat = (value, label, cls = '') => `<div class="stat ${cls}"><strong>${value}</strong><small>${esc(label)}</small></div>`;
export const empty = (msg, cta = '') => `<div class="empty"><p>${esc(msg)}</p>${cta}</div>`;
export const chips = (name, values, current, fmt = v => v) =>
  `<div class="chipset" role="radiogroup">${values.map(v => `<button type="button" role="radio" aria-checked="${String(v) === String(current)}" class="chip-btn ${String(v) === String(current) ? 'on' : ''}" data-action="pick" data-name="${esc(name)}" data-value="${esc(v)}">${esc(fmt(v))}</button>`).join('')}</div>`;

// Stacked weekly bars. series: [{label, parts:[{v, cls}]}]
export function barChart(series, { height = 120, unitLabel = '' } = {}) {
  const max = Math.max(1, ...series.map(s => s.parts.reduce((n, p) => n + p.v, 0)));
  const W = 320, H = height, pad = 18, bw = (W - 8) / series.length;
  const bars = series.map((s, i) => {
    let y = H - pad;
    const rects = s.parts.map(p => { const h = (p.v / max) * (H - pad - 14); y -= h; return h > 0 ? `<rect class="${p.cls}" x="${i * bw + 4}" y="${y}" width="${bw - 8}" height="${h}" rx="3"/>` : ''; }).join('');
    const total = s.parts.reduce((n, p) => n + p.v, 0);
    return `${rects}<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${s.label}</text>${total ? `<text class="val" x="${i * bw + bw / 2}" y="${y - 3}" text-anchor="middle">${total}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly chart ${esc(unitLabel)}">${bars}</svg>`;
}

// Line chart over time. pts: [{x (ts), y}]
export function lineChart(pts, { height = 150, fmt = v => v } = {}) {
  if (pts.length < 2) return `<div class="chart-empty">Log this exercise twice to see a trend.</div>`;
  const W = 320, H = height, L = 34, R = 10, T = 12, B = 20;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padY = (hi - lo) * 0.15; lo -= padY; hi += padY;
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const px = x => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R), py = y => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${px(x1)} ${H - B} L${px(x0)} ${H - B} Z`;
  const grid = [hi - padY, (hi + lo) / 2, lo + padY].map(v => `<line x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}"/><text x="${L - 4}" y="${py(v) + 3}" text-anchor="end">${esc(fmt(Math.round(v * 10) / 10))}</text>`).join('');
  const dt = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<svg class="chart line" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress trend">${grid}<path class="area" d="${area}"/><path class="stroke" d="${d}"/>${pts.map(p => `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="3"/>`).join('')}<text x="${L}" y="${H - 4}">${dt(x0)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${dt(x1)}</text></svg>`;
}

export function sparkline(vals) {
  if (vals.length < 2) return '';
  const W = 64, H = 22, lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (vals.length - 1)) * W} ${H - 2 - ((v - lo) / r) * (H - 4)}`).join(' ')}"/></svg>`;
}
