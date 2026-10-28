// Simple mode: plain language over training jargon. The data underneath is identical
// (RPE numbers are still stored), so switching modes never changes history.
import { S } from './core-app.js';
import { chips, seg } from './ui-kit.js';
import { fmtNum } from './domain-units.js';

export const simple = () => S.profile?.simple !== false;

const SET_EFFORT = [[7, 'Easy'], [8, 'Solid'], [9, 'Hard'], [10, 'Max']];
const SESSION_EFFORT = [[3, 'Very easy'], [5, 'Easy'], [6, 'Moderate'], [7, 'Hard'], [8, 'Very hard'], [10, 'All-out']];

export function effortTarget(rpe) {
  if (!simple()) return `RPE ${fmtNum(rpe)}`;
  return rpe <= 6 ? 'Easy effort' : rpe <= 7 ? '~3 reps left in the tank' : rpe <= 8 ? '~2 reps left in the tank' : '~1 rep left';
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
