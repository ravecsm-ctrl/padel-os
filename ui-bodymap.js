// A simple, original front/back body figure made of rounded shapes. Each muscle area is
// tinted by a value. The colour function is pluggable so recovery can reuse it later.
import { esc } from './ui-kit.js';
import { MUSCLES } from './domain-taxonomy.js';

const E = (cx, cy, rx, ry) => ({ t: 'e', cx, cy, rx, ry });
const R = (x, y, w, h, r = 6) => ({ t: 'r', x, y, w, h, r });
const both = (f, ...a) => [f(...a), f(120 - a[0], ...a.slice(1))];   // mirror an ellipse around x = 60
const bothR = (x, y, w, h, r) => [R(x, y, w, h, r), R(120 - x - w, y, w, h, r)];

// Body parts that are never tinted (head, neck, hands, feet).
const BASE = [E(60, 17, 11, 12.5), R(54, 28, 12, 9, 3),
  R(38, 40, 44, 78, 16),                        // torso
  R(41, 108, 38, 30, 12),                       // hips
  ...bothR(38, 128, 19, 106, 9),                // legs
  ...both(E, 30, 92, 7, 32),                    // arms
  ...both(E, 24, 128, 4.5, 6), ...both(E, 48, 246, 7, 4)];

// 25 muscle groups. Order matters: later shapes are drawn on top.
const FRONT = {
  traps: both(E, 49, 38, 6, 3),
  side_delts: both(E, 30.5, 52, 4, 8.5),
  front_delts: both(E, 38, 50.5, 6.5, 8),
  upper_chest: bothR(44, 53, 15, 7, 4),
  chest: bothR(43, 60.5, 16, 7, 4),
  lower_chest: bothR(44, 68, 15, 5.5, 3),
  biceps: both(E, 30, 79, 6, 13),
  forearms: both(E, 26, 107, 5.5, 14),
  abs: [R(51, 75, 18, 32, 7)],
  obliques: both(E, 44, 93, 5, 14),
  glute_med: both(E, 39.5, 117, 3.5, 7),
  hip_flexors: both(E, 51, 113, 4.5, 6.5),
  quads: both(E, 47, 152, 9.5, 26),
  adductors: both(E, 56, 145, 3.6, 16),
  shins: both(E, 48, 212, 6, 21),
};
const BACK = {
  traps: [R(48, 35, 24, 14, 6)],
  mid_back: [R(44, 50, 32, 17, 7)],
  side_delts: both(E, 30.5, 52, 4, 8.5),
  rear_delts: both(E, 38, 50.5, 6.5, 8),
  rotator_cuff: both(E, 47.5, 60, 5, 4),
  lats: both(E, 45, 85, 8.5, 15),
  lower_back: [R(52, 90, 16, 23, 6)],
  triceps: both(E, 30, 79, 6, 13),
  forearms: both(E, 26, 107, 5.5, 14),
  glute_med: both(E, 42.5, 113.5, 6, 5),
  glutes: both(E, 50, 127, 10.5, 9.5),
  hamstrings: both(E, 48, 163, 8.5, 22),
  adductors: both(E, 56.5, 152, 3, 13),
  calves: both(E, 48, 204, 7, 14),
  soleus: both(E, 48, 224, 5.5, 9),
};

const shape = (s, attrs) => s.t === 'e'
  ? `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`
  : `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ${attrs}/>`;

// Default colouring: shades of blue by share of the busiest muscle.
export function blueScale(v, max) {
  if (!v) return { fill: 'var(--fill-2)', opacity: 1 };
  const t = Math.min(1, v / (max || v));
  return { fill: 'var(--blue)', opacity: (0.3 + 0.7 * t).toFixed(2) };
}

function figure(regions, values, dx, color, max, label, tipFn) {
  const base = BASE.map(s => shape(s, 'fill="var(--fill)"')).join('');
  const parts = Object.entries(regions).map(([m, shapes]) => {
    const c = color(values[m] || 0, max, m);
    const tip = tipFn ? tipFn(m, values[m] || 0) : `${MUSCLES[m]}${values[m] ? `: ${values[m]} set${values[m] === 1 ? '' : 's'}` : ''}`;
    return `<g class="bm-part" data-muscle="${m}"><title>${esc(tip)}</title>${shapes.map(s => shape(s, `fill="${c.fill}" fill-opacity="${c.opacity}"`)).join('')}</g>`;
  }).join('');
  return `<g transform="translate(${dx} 0)">${base}${parts}<text x="60" y="262" text-anchor="middle" class="bm-label">${label}</text></g>`;
}

// values: { muscleId: number }. Returns an accessible SVG.
export function bodyMap(values = {}, { color = blueScale, max = null, title = 'Muscles worked', tip = null } = {}) {
  const m = max ?? Math.max(0, ...Object.values(values));
  const worked = Object.entries(values).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => MUSCLES[k]).join(', ');
  return `<svg class="bodymap" viewBox="0 0 250 268" role="img" aria-label="${esc(title)}: ${esc(worked || 'none')}">
    ${figure(FRONT, values, 0, color, m, 'Front', tip)}${figure(BACK, values, 130, color, m, 'Back', tip)}</svg>`;
}

// One exercise: main muscles strong, secondary ones pale.
const exColor = v => !v ? { fill: 'var(--fill-2)', opacity: 1 } : { fill: 'var(--blue)', opacity: v >= 1 ? 1 : 0.38 };
export function exerciseMap(ex) {
  const values = {};
  for (const m of ex?.secondary || []) values[m] = 0.5;
  for (const m of ex?.primary || []) values[m] = 1;
  return bodyMap(values, { color: exColor, max: 1, title: `${ex?.name || 'Exercise'}: muscles worked`, tip: (m, v) => `${MUSCLES[m]}${v >= 1 ? ' (main)' : v ? ' (secondary)' : ''}` });
}
