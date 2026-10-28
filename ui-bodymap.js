// An original front/back body figure: a smooth silhouette with 25 muscle shapes on top.
// Each muscle is tinted by a value; the colour function is pluggable (sets, recovery, one
// exercise). Shapes are drawn for the figure's left half and mirrored around x = 60.
import { esc } from './ui-kit.js';
import { MUSCLES } from './domain-taxonomy.js';

const MIRROR = 'matrix(-1 0 0 1 120 0)';
const R = (x, y, w, h, r) => `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;

// Silhouette (never tinted): torso and leg, arm and hand, head.
const TORSO = 'M60,29 L54.6,29 C54.8,33.5 53.4,37 49.5,38.6 C45.5,40.1 41.5,40.8 38.6,42.6 C37.4,48 38.2,53.5 39.6,58 C40.2,66 40.6,76 41.6,86 C42.1,94 41.6,101.5 40.4,108 C39.1,114 38.6,120 38.8,127 C39.1,140 40.6,155 42.6,170 C43.5,176 44,181 44,186 C42.5,195 42.3,205 43.5,214 C44.7,224 46.4,232 47,238 C45.2,240.5 43.6,243 44.2,246.5 L55.6,246.5 C56.4,243 55.4,240.5 54.6,238 C55,230 56.4,220 57,210 C57.5,200 56.6,192 56,186 C56.4,178 57.6,168 58.6,155 C59.2,147 59.5,140 59.6,134 L60,133.5 Z';
const ARM = 'M38.6,42.4 C33.5,41.8 29.6,45 29,51 C28.3,58 27.6,66 27.8,75 C28,82 27.2,88 26.6,94 C25.4,103 24.8,112 26,121 L27.4,128 C26.4,131 25.8,135 27,139 C28.4,142.4 32,142.4 33.1,139 C33.9,135 33.6,131 33.4,128 L35.2,124 C36.2,114 36.6,104 36.6,95 C37.2,88 37.6,80 37.8,72 C38,66 38.8,61 39.4,57 C39.6,51.5 39.6,46.5 38.6,42.4 Z';
const HEAD = '<ellipse cx="60" cy="16.5" rx="10" ry="12.5"/>';

// Joins a left-half outline (M, L and C only, running from the centre line back to it) with
// its mirror image into one closed shape, so the silhouette has no seam down the middle.
function whole(d) {
  const segs = [...d.matchAll(/([MLC])([^MLCZ]*)/g)].map(([, c, n]) => [c, n.trim().split(/[ ,]+/).map(Number)]);
  const pts = [], out = [];
  for (const [c, n] of segs) pts.push([c, n]);
  const end = pts.at(-1)[1].slice(-2), fx = n => n.map((v, i) => i % 2 ? v : +(120 - v).toFixed(2));
  for (let i = pts.length - 1; i > 0; i--) {
    const [c, n] = pts[i], prev = pts[i - 1][1].slice(-2);
    out.push(c === 'C' ? `C${fx([n[2], n[3], n[0], n[1], ...prev]).join(',')}` : `L${fx(prev).join(',')}`);
  }
  return `${d.replace(/Z\s*$/, '')} L${fx(end).join(',')} ${out.join(' ')} Z`;
}

// Shared shapes (same outline on the front and the back).
const DELT = 'M42.6,43.4 C38,42.2 34.4,45 33.8,51 C33.6,55 34,58.5 35.2,61.6 C36.6,57 38.6,53 40.9,50 C41.9,48 42.6,45.6 42.6,43.4 Z';
const SIDE_DELT = 'M34.4,44.4 C30.6,46 28.8,50.6 28.9,56.6 C29,58.8 29.5,60.8 30.4,62.2 L34.8,62.8 C33.4,58 33,52 35.4,45.6 Z';
const FOREARM = 'M33,92.4 C29,93.4 26.6,99 26.1,106 C25.8,113 27,120 28.6,126 L33.2,126 C34.6,118 35.6,110 35.6,102 C35.6,97 34.8,93.6 33,92.4 Z';
const UPPER_ARM = 'M33.6,61.4 C30.4,63.4 28.8,69.4 28.8,76.4 C28.8,82.6 30.4,87.4 33,89.4 C35.6,87.4 36.9,82.4 36.9,76.4 C36.9,69.4 35.8,64 33.6,61.4 Z';

// 25 muscle groups, as left-half paths. Order matters: later shapes are drawn on top.
const FRONT = {
  traps: ['M54.4,32.8 C51,37 46,39.6 41.6,41.4 L51.6,41.6 C53.8,39.4 54.8,36.4 54.4,32.8 Z'],
  side_delts: [SIDE_DELT],
  front_delts: [DELT],
  upper_chest: ['M59.2,43.6 C53,43.6 47.4,44 43.6,45.6 C42.2,46.8 41.4,47.8 41,49 C47,49.6 53,50.4 59.2,51 Z'],
  chest: ['M59.2,52.2 C53,51.6 47,50.8 41,50.2 C40.8,53 41,55.6 41.6,57.8 C47,58.6 53,60 59.2,61 Z'],
  lower_chest: ['M59.2,62.2 C53,61.2 47,59.8 42,59 C43.4,63.6 46,68.4 50,70 C53.6,71 57,70.6 59.2,69.6 Z'],
  biceps: [UPPER_ARM],
  forearms: [FOREARM],
  obliques: ['M42,64.4 C45.2,66.6 48.8,70 51,73.4 L51,103.6 C48.6,105.8 45.2,107.8 42.2,109.6 C42.6,100 42.6,92 42.2,84 C41.8,77 41.6,70.4 42,64.4 Z'],
  abs: [R(52.4, 72.2, 6.8, 7.6, 2.2), R(52.2, 81.4, 7, 7.6, 2.2), R(52, 90.6, 7.2, 7.6, 2.2), 'M52.2,99.8 L59.2,99.8 L59.2,112.4 C57,111.2 54,108.2 52.2,103.6 Z'],
  glute_med: ['M40.2,110.6 C42.4,112 43.8,114.4 44.4,118 C44,121.6 42.8,124.6 41.2,126.8 C39.8,122 39.4,116 40.2,110.6 Z'],
  hip_flexors: ['M45.6,113 C48.8,116 52.2,121 55,127.4 L58.6,133 C56.2,134 53.4,133.4 51.8,131.4 C49,127 46.6,121 45.6,113 Z'],
  quads: ['M43.2,124.6 C46.2,122 51,126.4 53.8,133 C56.2,140 57,150 56.4,159.6 C55.8,166 54.6,171.6 52.8,175.6 C50.6,177.6 48.4,179.4 46.6,180.4 C44.4,174 42.6,164 41.6,152 C40.9,142 41.2,131 43.2,124.6 Z',
    'M51.2,167.6 C53.8,166.2 56,168.4 56,173 C55.6,177 53.6,180.4 50.8,180.6 C49.6,176.4 49.6,171 51.2,167.6 Z'],
  adductors: ['M58.8,135.4 C57,137.4 56,141.4 55.4,147 C55,153 55.4,158 56.4,162.4 C57.8,157.4 58.8,150.4 59.2,143.4 Z'],
  calves: ['M53.2,190.4 C55.6,195.4 56.3,203 55.6,212 C55,218 53.8,222 52.6,224 C51.8,214 51.8,200 53.2,190.4 Z'],
  shins: ['M46,190.4 C44.6,196 44.4,204 45.2,212 C46,220 47,228 48,234.4 L50.2,234.4 C50.4,226 50.6,216 50.4,206 C50.2,199 49,193 46,190.4 Z'],
};
const BACK = {
  traps: ['M60,29.4 L54.6,31 C53.6,35 50,38 44,41 C48,42.6 52,44.6 55,47.2 C57,52 58.6,57 60,62.4 Z'],
  side_delts: [SIDE_DELT],
  rear_delts: [DELT],
  rotator_cuff: ['M44.2,46.8 C48,45.8 52,47.8 54.4,51.6 C53.6,55.8 50.6,58.8 46.6,59.4 C43.6,57 42.6,51 44.2,46.8 Z'],
  lats: ['M41.4,59 C44.4,61 47.6,64.4 49.6,68.2 C53,72.6 56.4,76 59.2,78.2 L59.2,86 C55.6,92 51,98 46.2,102.8 C44.2,99.6 42.6,94 42.2,86 C41.9,77 41.6,68 41.4,59 Z'],
  mid_back: ['M55.8,50.2 C57.2,54.4 58.6,59 59.2,64 L59.2,76.2 C55,75 51.2,72 48.4,68 C49.6,64.4 52.4,61.4 54.6,58 C55.4,55.4 55.7,52.6 55.8,50.2 Z'],
  lower_back: ['M54.2,80.4 C56.6,82.2 58.4,84.2 59.2,86.4 L59.2,111.6 L53.2,111.6 C52.6,104 52.6,96 53,89 C53.2,85.4 53.6,82.4 54.2,80.4 Z'],
  triceps: [UPPER_ARM],
  forearms: [FOREARM],
  glute_med: ['M40.6,108.4 C44.2,107.8 49,108.8 52.8,111 C50,114 46,116.2 41.6,118 C40.2,114.8 39.9,111.2 40.6,108.4 Z'],
  glutes: ['M41.6,119 C46,115.8 52,113.2 59.2,113.2 L59.2,134.8 C55,137.8 49,138.4 44,136 C41,132 40.4,125.4 41.6,119 Z'],
  hamstrings: ['M42.2,140 C45,139 48,138.8 50,139 C50.2,152 50,166 49.6,182.6 L47,182.6 C44.6,176 42.6,165 41.9,155 C41.5,149 41.6,144 42.2,140 Z',
    'M51,139 C52.8,138.8 54.8,138.8 56.6,139.2 C57.2,148 56.8,160 55.6,170 C54.8,176 54,180 52.8,182.6 L50.6,182.6 C51,168 51.2,153 51,139 Z'],
  adductors: ['M57.8,138.4 C59,139.6 59.5,143.4 59.4,148.4 C59.2,153 58.6,157 57.8,160.4 C57.3,153 57.3,145 57.8,138.4 Z'],
  calves: ['M45.6,188.4 C43,193.4 42.3,201 43.3,208 C44.3,213 46.4,217 49,218.2 L49.8,192 C48.6,189.8 47.2,188.6 45.6,188.4 Z',
    'M51,191 C53.4,189.6 55.4,191.2 56.2,196 C56.9,203 56.2,210 54.4,215 C53.4,218 52,219.6 50.8,219 Z'],
  soleus: ['M44.4,214.4 C45.6,219 47.6,221.4 50,221.4 C52.4,221.4 54.4,218.8 55.4,214.6 C55.6,221 54.8,228 53.4,233 L48,233 C46,228 44.6,221 44.4,214.4 Z'],
};

// Where each muscle's name points (left-half coordinates), and which view shows it best.
const ANCHOR = {
  front_delts: ['f', 38.4, 51], side_delts: ['f', 31, 54], upper_chest: ['f', 49, 47.2], chest: ['f', 48, 55.2], lower_chest: ['f', 50, 65],
  biceps: ['f', 33, 76], forearms: ['f', 30.5, 108], abs: ['f', 55.5, 86], obliques: ['f', 46.5, 88], hip_flexors: ['f', 51.5, 124],
  quads: ['f', 48.5, 150], adductors: ['f', 57.2, 148], shins: ['f', 47.6, 212],
  traps: ['b', 54, 40], rear_delts: ['b', 38.4, 51], rotator_cuff: ['b', 48.5, 53], mid_back: ['b', 55.5, 66], lats: ['b', 46, 82],
  lower_back: ['b', 56, 98], triceps: ['b', 33, 76], glute_med: ['b', 46, 112], glutes: ['b', 50.5, 126], hamstrings: ['b', 48, 160],
  calves: ['b', 49, 203], soleus: ['b', 50, 227],
};

const W = 76, CROP = 22, SIDE = 70, H = 262;   // each figure is cropped to the body's width
const BODY = whole(TORSO);
const path = (d, attrs) => d.startsWith('<') ? d.replace('/>', ` ${attrs}/>`) : `<path d="${d}" ${attrs}/>`;
const pair = (d, attrs = '') => path(d, attrs) + path(d, `${attrs} transform="${MIRROR}"`);

// Unworked muscles share this colour (opaque, so overlapping shapes don't darken).
export const IDLE = 'var(--bm-idle)';

// Default colouring: shades of blue by share of the busiest muscle.
export function blueScale(v, max) {
  if (!v) return { fill: IDLE, opacity: 1 };
  const t = Math.min(1, v / (max || v));
  return { fill: 'var(--blue)', opacity: (0.3 + 0.7 * t).toFixed(2) };
}

function figure(regions, values, dx, color, max, label, tipFn) {
  const body = `<g class="bm-body">${path(BODY)}${pair(ARM)}${HEAD}</g>`;
  const parts = Object.entries(regions).map(([m, shapes]) => {
    const c = color(values[m] || 0, max, m);
    const tip = tipFn ? tipFn(m, values[m] || 0) : `${MUSCLES[m]}${values[m] ? `: ${values[m]} set${values[m] === 1 ? '' : 's'}` : ''}`;
    return `<g class="bm-part" data-muscle="${m}" fill="${c.fill}" fill-opacity="${c.opacity}"><title>${esc(tip)}</title>${shapes.map(d => pair(d)).join('')}</g>`;
  }).join('');
  return `<g transform="translate(${dx - CROP} 0)">${body}${parts}<text x="60" y="${H - 2}" text-anchor="middle" class="bm-label">${label}</text></g>`;
}

// Names beside the figure with a thin line to the muscle: front ones on the left, back ones
// on the right. Labels are spread out so they never overlap.
function callouts(values, backX) {
  const items = Object.entries(values).filter(([m, v]) => v > 0 && ANCHOR[m]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const out = [];
  for (const view of ['f', 'b']) {
    const list = items.filter(([m]) => ANCHOR[m][0] === view).map(([m, v]) => {
      const [, ax, ay] = ANCHOR[m];
      return { m, main: v >= 1, ax: view === 'f' ? SIDE + ax - CROP : backX + 120 - CROP - ax, ay, y: ay + 3.5 };
    }).sort((a, b) => a.ay - b.ay);
    for (let i = 1; i < list.length; i++) list[i].y = Math.max(list[i].y, list[i - 1].y + 13);
    for (let i = list.length - 1, lim = H - 14; i >= 0; i--, lim -= 13) list[i].y = Math.min(list[i].y, lim);
    for (const l of list) {
      const tx = view === 'f' ? SIDE - 5 : backX + W + 5, lx = view === 'f' ? SIDE - 3 : backX + W + 3;
      out.push(`<g class="bm-callout${l.main ? ' main' : ''}"><path d="M${lx},${l.y - 3.6} L${l.ax},${l.ay}"/><circle cx="${l.ax}" cy="${l.ay}" r="1.5"/>`
        + `<text x="${tx}" y="${l.y}" text-anchor="${view === 'f' ? 'end' : 'start'}">${esc(MUSCLES[l.m])}</text></g>`);
    }
  }
  return out.join('');
}

// values: { muscleId: number }. Returns an accessible SVG. `labels` names the worked muscles.
export function bodyMap(values = {}, { color = blueScale, max = null, title = 'Muscles worked', tip = null, labels = false } = {}) {
  const m = max ?? Math.max(0, ...Object.values(values));
  const worked = Object.entries(values).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => MUSCLES[k]).join(', ');
  const side = labels ? SIDE : 0, backX = side + W + (labels ? 14 : 40), width = backX + W + side;
  return `<svg class="bodymap${labels ? ' labelled' : ''}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${esc(title)}: ${esc(worked || 'none')}">
    ${figure(FRONT, values, side, color, m, 'Front', tip)}${figure(BACK, values, backX, color, m, 'Back', tip)}${labels ? callouts(values, backX) : ''}</svg>`;
}

// One exercise: main muscles strong, secondary ones pale, all of them named.
const exColor = v => !v ? { fill: IDLE, opacity: 1 } : { fill: 'var(--blue)', opacity: v >= 1 ? 1 : 0.38 };
export function exerciseMap(ex) {
  const values = {};
  for (const m of ex?.secondary || []) values[m] = 0.5;
  for (const m of ex?.primary || []) values[m] = 1;
  return bodyMap(values, { color: exColor, max: 1, labels: true, title: `${ex?.name || 'Exercise'}: muscles worked`, tip: (m, v) => `${MUSCLES[m]}${v >= 1 ? ' (main)' : v ? ' (secondary)' : ''}` });
}

// Tap a muscle to see its name in a small bubble; tap anywhere else on the map to hide it.
// Maps inside a button (a card that opens another page) are left alone.
function showTip(svg, part) {
  svg.querySelector('.bm-tip')?.remove();
  svg.querySelectorAll('.bm-part.on').forEach(p => p.classList.remove('on'));
  if (!part) return;
  part.classList.add('on');
  const inv = svg.getScreenCTM()?.inverse(), r = part.getBoundingClientRect();
  if (!inv) return;
  const pt = (x, y) => new DOMPoint(x, y).matrixTransform(inv);
  const a = pt(r.left, r.top), b = pt(r.right, r.bottom), vb = svg.viewBox.baseVal;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'bm-tip');
  g.innerHTML = `<rect rx="6" height="17"/><text y="12">${esc(part.querySelector('title')?.textContent || '')}</text>`;
  svg.appendChild(g);
  const tw = g.querySelector('text').getComputedTextLength() + 14;
  const x = Math.max(2, Math.min(vb.width - tw - 2, (a.x + b.x) / 2 - tw / 2)), y = Math.max(2, a.y - 20);
  g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  g.querySelector('rect').setAttribute('width', tw.toFixed(1));
  g.querySelector('text').setAttribute('x', (tw / 2).toFixed(1));
}
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const svg = e.target.closest?.('svg.bodymap');
  if (!svg || svg.closest('button, a')) return;
  const part = e.target.closest('.bm-part');
  showTip(svg, part && !part.classList.contains('on') ? part : null);
});
