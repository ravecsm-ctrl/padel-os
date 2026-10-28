// Rendering helpers: icons, iOS-style building blocks (large titles, nav bars,
// grouped lists, rows) and dependency-free SVG charts.
export const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
export const attr = o => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(' ');

// Simple line icons on a 24px grid.
const P = {
  today: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/>',
  plan: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.6" cy="17.5" r="1.3" fill="currentColor" stroke="none"/>',
  racket: '<g transform="rotate(-45 12 12)"><ellipse cx="12" cy="8.3" rx="5.4" ry="6" fill="currentColor" fill-opacity=".14"/><path d="M10 14.5h4l-.8 2.7h-2.4zM10.8 17.2h2.4v4.3h-2.4z"/><g fill="currentColor" stroke="none"><circle cx="10" cy="6" r=".7"/><circle cx="12" cy="5.4" r=".7"/><circle cx="14" cy="6" r=".7"/><circle cx="9.6" cy="8.3" r=".7"/><circle cx="12" cy="8.3" r=".7"/><circle cx="14.4" cy="8.3" r=".7"/><circle cx="10" cy="10.6" r=".7"/><circle cx="12" cy="11.2" r=".7"/><circle cx="14" cy="10.6" r=".7"/></g></g>',
  chart: '<path d="M4 20.5h16"/><rect x="5" y="11" width="3.2" height="7" rx="1"/><rect x="10.4" y="6" width="3.2" height="12" rx="1"/><rect x="15.8" y="13.5" width="3.2" height="4.5" rx="1"/>',
  person: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5c1.4-3.3 4-5 7-5s5.6 1.7 7 5"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>', chevL: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>', pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>', back: '<path d="M18 6l-8 6 8 6zM6 6v12"/>', fwd: '<path d="M6 6l8 6-8 6zM18 6v12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>',
  dumbbell: '<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  legs: '<circle cx="14.6" cy="4.6" r="2"/><path d="M10.2 8.6l3.8-.6 2.4 3.4 3 .9M14 8l-2 5.3 3.2 2.8V21M12 13.3l-2.4 3.4H5.5M10.2 8.6L7.3 11"/>',
  bolt: '<path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/><path d="M8 12.5h2.2l1.2-2.2 1.6 4 1.1-1.8H16"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.6 3.2-5.2 3.6-9.4 2.6 1.6 4.2 4 4.4 6.4.9-.6 1.6-1.6 1.8-2.8C17.6 11.2 18 13 18 15.4 18 18.6 15.6 21 12 21z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  note: '<path d="M5 4.5h10l4 4V19.5H5z"/><path d="M15 4.5v4h4M8.5 13h7M8.5 16h5"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>', skip: '<path d="M5 6l8 6-8 6zM16 6v12"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>', share: '<path d="M12 15V4M8 7.5L12 4l4 3.5M6 11v8.5h12V11"/>',
  download: '<path d="M12 4v11M8 11.5l4 3.5 4-3.5M6 19.5h12"/>', shield: '<path d="M12 3.5l7 2.8v5.4c0 4.4-3 7.6-7 8.8-4-1.2-7-4.4-7-8.8V6.3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  speaker: '<path d="M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z"/><path d="M16 9a4.5 4.5 0 0 1 0 6"/>', bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20h4"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>', sliders: '<path d="M5 7h9M18 7h1M5 17h3M12 17h7"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13.5V17M9 20h6M10 17h4"/>',
  wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>', target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
export const chev = '<svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg>';
export const routineLook = id => ({ A: { icon: 'legs', color: 'blue' }, B: { icon: 'dumbbell', color: 'indigo' }, C: { icon: 'bolt', color: 'orange' } }[id] || { icon: 'dumbbell', color: 'blue' });
export const tile = (name, color = 'blue', lg = false) => `<span class="tile ${color} ${lg ? 'lg' : ''}">${icon(name)}</span>`;

// Large title header (top-level tabs).
export const pageHead = (title, { eyebrow = '', sub = '', right = '' } = {}) =>
  `<header class="lt"><div>${eyebrow ? `<p class="lt-eyebrow">${esc(eyebrow)}</p>` : ''}<h1 class="t-large">${esc(title)}</h1>${sub ? `<p class="t-sub lt-sub">${sub}</p>` : ''}</div>${right}</header>`;

// Inline nav bar (pushed screens): back button, centred title, optional right action.
export const navBar = ({ back = '', backTo = '', backAction = '', title = '', sub = '', right = '' } = {}) =>
  `<nav class="nav" aria-label="Navigation">${back ? `<button class="nav-btn" ${backAction ? `data-action="${backAction}"` : `data-action="go" data-to="${esc(backTo)}"`}>${icon('chevL')}${esc(back)}</button>` : '<span></span>'}
    <div class="nav-title">${esc(title)}${sub ? `<small>${sub}</small>` : ''}</div>${right || '<span></span>'}</nav>`;

// Grouped inset list.
export const group = (rows, { header = '', footer = '', big = false, cls = '' } = {}) =>
  `<section class="grp ${cls}">${header ? `<h2 class="grp-h ${big ? 'big' : ''}">${esc(header)}</h2>` : ''}<div class="grp-b">${rows}</div>${footer ? `<p class="grp-f">${footer}</p>` : ''}</section>`;

// One list row. Pass `to` (route) or `action` (+data) to make it tappable.
export function row({ title, sub = '', value = '', icon: ic = '', color = 'blue', to = '', action = '', data = {}, chevron = null, right = '', cls = '', aria = '' }) {
  const tappable = to || action;
  const tag = tappable ? 'button' : 'div';
  const d = { ...data }; if (to) { d.action = 'go'; d.to = to; } else if (action) d.action = action;
  const dattrs = Object.entries(d).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<${tag} class="row ${ic ? 'has-icon' : ''} ${cls}" ${dattrs} ${aria ? `aria-label="${esc(aria)}"` : ''}>${ic ? tile(ic, color) : ''}
    <span class="row-main"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>
    ${value ? `<span class="row-value">${value}</span>` : ''}${right}${(chevron ?? !!tappable) ? chev : ''}</${tag}>`;
}

export const stat = (value, label, unit = '') => `<div class="stat"><small>${esc(label)}</small><strong>${value}${unit ? `<span class="u">${esc(unit)}</span>` : ''}</strong></div>`;
export const empty = (ic, title, msg, cta = '') => `<div class="empty">${icon(ic)}<b>${esc(title)}</b><p>${esc(msg)}</p>${cta}</div>`;
export const seg = (name, items, current) => `<div class="seg" role="tablist">${items.map(([v, l]) => `<button role="tab" aria-selected="${String(v) === String(current)}" data-action="pick" data-name="${esc(name)}" data-value="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
export const chips = (name, values, current, fmt = v => v) =>
  `<div class="chipset" role="radiogroup">${values.map(v => `<button type="button" role="radio" aria-checked="${String(v) === String(current)}" class="chip-btn ${String(v) === String(current) ? 'on' : ''}" data-action="pick" data-name="${esc(name)}" data-value="${esc(v)}">${esc(fmt(v))}</button>`).join('')}</div>`;
// Kept for older call sites.
export const title = (h, eyebrow) => `<h2 class="grp-h big">${esc(h)}</h2>`;

// Stacked weekly bars. series: [{label, parts:[{v, cls}]}]
export function barChart(series, { height = 120, unitLabel = '' } = {}) {
  const max = Math.max(1, ...series.map(s => s.parts.reduce((n, p) => n + p.v, 0)));
  const W = 320, H = height, pad = 18, bw = (W - 8) / series.length;
  const bars = series.map((s, i) => {
    let y = H - pad;
    const rects = s.parts.map(p => { const h = (p.v / max) * (H - pad - 14); y -= h; return h > 0 ? `<rect class="${p.cls}" x="${i * bw + 7}" y="${y}" width="${bw - 14}" height="${h}" rx="4"/>` : ''; }).join('');
    const total = s.parts.reduce((n, p) => n + p.v, 0);
    return `${rects}<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${s.label}</text>${total ? `<text class="val" x="${i * bw + bw / 2}" y="${y - 3}" text-anchor="middle">${total}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly chart ${esc(unitLabel)}">${bars}</svg>`;
}

export function lineChart(pts, { height = 150, fmt = v => v } = {}) {
  if (pts.length < 2) return `<div class="chart-empty">Do this exercise twice to see your trend.</div>`;
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
  const W = 56, H = 22, lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (vals.length - 1)) * W} ${H - 2 - ((v - lo) / r) * (H - 4)}`).join(' ')}"/></svg>`;
}
