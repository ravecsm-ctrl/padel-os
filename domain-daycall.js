// Today's call: one of five levels, from how tired today's muscles are and what you said in the check-in.
//   full      train as planned
//   easier    same workout, eased (the adjustments from adaptive.js)
//   reshaped  swap with a fresher workout later this week
//   prep      hard match tomorrow: legs move off today (a swap or a later day)
//   recovery  mobility instead of the gym; the workout moves to a later day
// The recovery numbers are estimates, so on their own they can only make a day easier. A recovery day
// also needs your own word for it: Tired or Sore in the check-in.
import { TIRED_FROM } from './domain-recovery.js';

const DAY = 86400000;

// fatigue: one level (0..1) per exercise in today's workout. changes: adaptWorkout's list.
// feel: today's check-in ('great' | 'good' | 'tired' | 'sore' | null). light: the lighter version was asked for.
// swap: a fresher workout later this week, or null. prep: a way to keep legs off today before a hard match
// (only offered when today is a leg day and tomorrow's match is hard). afterTournament: within two days after one.
export function dayCall({ fatigue = [], changes = [], feel = null, light = false, swap = null, prep = null, afterTournament = false }) {
  const tiredShare = fatigue.length ? fatigue.filter(l => l >= TIRED_FROM).length / fatigue.length : 0;
  const said = feel === 'tired' || feel === 'sore';
  const needsRest = said && (tiredShare >= 0.5 || afterTournament);
  // Tired is the whole body: rest. Sore is a part of it: train the rest if there's a fresher workout to swap in.
  if (needsRest && (feel === 'tired' || !swap)) return { level: 'recovery', tiredShare };
  if (prep) return { level: 'prep', tiredShare };
  if (swap) return { level: 'reshaped', tiredShare };
  if (light || changes.some(c => c.dir !== 'up')) return { level: 'easier', tiredShare };
  return { level: 'full', tiredShare };
}

// Recovery days you took on the app's advice: 3 within 14 days means the plan, not the day, needs changing.
export const recoveryDaysRecently = (dates = [], now = Date.now()) => dates.filter(d => now - new Date(d + 'T12:00').getTime() < 14 * DAY).length;
export const TOO_MANY_RECOVERY_DAYS = 3;
