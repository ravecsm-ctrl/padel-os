// Simple mode: plain language over training jargon. The data underneath is identical
// (RPE numbers are still stored), so switching modes never changes history.
import { S } from './core-app.js';
import { chips, seg } from './ui-kit.js';
import { fmtNum } from './domain-units.js';
import { MUSCLES } from './domain-taxonomy.js';

export const simple = () => S.profile?.simple !== false;

const SET_EFFORT = [[7, 'Easy'], [8, 'Solid'], [9, 'Hard'], [10, 'Max']];
const SESSION_EFFORT = [[3, 'Very easy'], [5, 'Easy'], [6, 'Moderate'], [7, 'Hard'], [8, 'Very hard'], [10, 'All-out']];

export function effortTarget(rpe) {
  if (!simple()) return `RPE ${fmtNum(rpe)}`;
  return rpe <= 6 ? 'Easy effort' : rpe <= 7 ? 'Stop with about 3 reps to spare' : rpe <= 8 ? 'Stop with about 2 reps to spare' : 'Stop with about 1 rep to spare';
}
export function setEffortChips(name, current) {
  return simple() ? chips(name, SET_EFFORT.map(e => e[0]), current, v => SET_EFFORT.find(e => e[0] === v)[1])
    : chips(name, [6, 7, 8, 9, 10], current, v => `RPE ${v}`);
}
export function sessionEffortChips(name, current) {
  return simple() ? chips(name, SESSION_EFFORT.map(e => e[0]), current, v => SESSION_EFFORT.find(e => e[0] === v)[1])
    : chips(name, [3, 4, 5, 6, 7, 8, 9, 10], current);
}
export const effortWord = rpe => rpe == null ? '—' : simple() ? (rpe <= 4 ? 'Easy' : rpe <= 6 ? 'Moderate' : rpe <= 7 ? 'Hard' : rpe <= 8 ? 'Very hard' : 'All-out') : `RPE ${fmtNum(rpe)}`;
export const loadUnit = () => simple() ? 'pts' : 'AU';
export const e1rmLabel = () => simple() ? 'Estimated max' : 'Estimated 1RM';
export const setEffortSeg = (name, current) => simple()
  ? seg(name, SET_EFFORT.map(([v, l]) => [v, l]), current)
  : seg(name, [6, 7, 8, 9, 10].map(v => [v, `RPE ${v}`]), current);
export const setEffortWord = rpe => rpe == null ? '' : simple() ? (SET_EFFORT.find(e => e[0] === rpe)?.[1] || `RPE ${rpe}`) : `RPE ${fmtNum(rpe)}`;

// Muscle names: everyday words in Simple mode, the anatomy terms otherwise.
const PLAIN = {
  front_delts: 'Front shoulders', side_delts: 'Side shoulders', rear_delts: 'Rear shoulders', rotator_cuff: 'Shoulder stabilisers', serratus: 'Side ribs',
  traps: 'Upper back & neck', lats: 'Wide back', lower_back: 'Lower back', forearms: 'Forearms & grip', obliques: 'Side abs',
  hip_flexors: 'Front of hips', glute_med: 'Side glutes', adductors: 'Inner thighs', quads: 'Front thighs', hamstrings: 'Back thighs',
  soleus: 'Deep calves', shins: 'Shins',
};
export const mname = m => MUSCLES[m] ? (simple() && PLAIN[m]) || MUSCLES[m] : undefined;
// Sets per muscle count secondary work as half a set: show ½ rather than .5.
export const fmtSets = n => { const w = Math.floor(n), h = Math.round((n - w) * 2) === 1; return w ? `${w}${h ? '½' : ''}` : h ? '½' : '0'; };
