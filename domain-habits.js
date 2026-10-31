// Habits: what makes the app cheap to keep using. Catching up on planned days you didn't log, the private
// signals it learns from (advice you overrode, how late you log), how much it adjusts your day, and coming
// back after a break. Pure functions.
import { isoDate, parseISO } from './domain-calendar.js';

const DAY = 86400000;

// How much the app changes your day on its own (Settings → Your plan).
//   light     only what you tell it (tired, sore, pain), hard matches and tournaments change the day
//   balanced  recovery estimates can too, until you overrule the same kind of call a few times
//   hands     every call the recovery estimates suggest
export const ADJUST = { light: 'Light', balanced: 'Balanced', hands: 'Hands-on' };
export const ADJUST_HINT = {
  light: 'Your day only changes for what you tell it, hard matches and tournaments. Small weight and set tweaks still happen inside workouts.',
  balanced: 'Recovery estimates can make a day easier or swap it, and the app backs off on calls you keep overruling.',
  hands: 'Every change the recovery estimates suggest.',
};
export const adjustOf = settings => ADJUST[settings?.adjust] ? settings.adjust : 'balanced';

// ── Planned days without a log
// Days in the last `days` (not today) whose plan was a workout or padel, with nothing logged of that kind,
// that you haven't marked as not done. Counts only from `since` (when you started), newest first.
export function unloggedDays(sessions, planOn, { today = isoDate(), days = 7, isRoutine = () => false, notDone = {}, since = null } = {}) {
  const out = [], t0 = parseISO(today);
  for (let i = 1; i <= days; i++) {
    const d = new Date(t0); d.setDate(d.getDate() - i);
    const iso = isoDate(d);
    if ((since && iso < since) || notDone[iso]) continue;
    const v = planOn(iso), padel = v === 'Padel';
    if (!padel && !isRoutine(v)) continue;
    const that = sessions.filter(s => isoDate(new Date(s.startedAt)) === iso);
    if (padel ? that.some(s => s.activity === 'padel') : that.some(s => s.kind === 'strength')) continue;
    out.push({ iso, v });
  }
  return out;
}
// Old "didn't do it" marks don't matter once they're out of the catch-up window.
export const pruneNotDone = (notDone = {}, today = isoDate(), keep = 14) => Object.fromEntries(Object.entries(notDone).filter(([iso]) => (parseISO(today) - parseISO(iso)) / DAY <= keep));

// ── Signals (private, on this device): { t, k, ...extra }
//   'ov-easier' trained the full plan on an Easier day · 'ov-reshaped' kept the planned workout on a Reshaped day
//   'ov-recovery' trained on a Recovery day · 'ov-prep' trained the day before a hard match
//   'log' a session saved, with d = days between doing it and logging it · 'catchup' a day settled from catch-up
export const SIGNAL_DAYS = 60;
export const addSignal = (list = [], k, extra = {}, now = Date.now()) => [...list.filter(s => now - s.t < SIGNAL_DAYS * DAY), { t: now, k, ...extra }];
const recent = (list = [], days, now) => list.filter(s => now - s.t < days * DAY);
export const TUNE_AFTER = 3, TUNE_DAYS = 21;
// Calls you've overruled TUNE_AFTER times in TUNE_DAYS: the app stops making them from estimates alone.
export function tuned(list = [], now = Date.now()) {
  const r = recent(list, TUNE_DAYS, now), n = k => r.filter(s => s.k === k).length;
  return { easier: n('ov-easier') >= TUNE_AFTER, reshaped: n('ov-reshaped') >= TUNE_AFTER };
}
// Your last 4 weeks in three numbers: advice overruled, share of sessions logged the day you did them, catch-ups.
export function habitSummary(list = [], now = Date.now(), days = 28) {
  const r = recent(list, days, now), logs = r.filter(s => s.k === 'log');
  return { overrides: r.filter(s => s.k.startsWith('ov-')).length, logged: logs.length,
    sameDay: logs.length ? Math.round(100 * logs.filter(s => (s.d || 0) < 1).length / logs.length) : null,
    catchups: r.filter(s => s.k === 'catchup').length };
}

// ── How much a day changes
// call: from dayCall. said: you told it something (tired, sore, a lighter day) or a tournament/comeback made it
// lighter. Estimate-only Easier and Reshaped calls are softened for Light, and for Balanced once you've overruled
// them; they come back as a normal day (quiet: true, was: the softened level) with the change one tap away.
export function shapeCall(call, { adjust = 'balanced', said = false, tune = {} } = {}) {
  if (said || adjust === 'hands' || !['easier', 'reshaped'].includes(call.level)) return call;
  const soften = adjust === 'light' || (call.level === 'easier' ? tune.easier : tune.reshaped);
  return soften ? { ...call, level: 'full', quiet: true, was: call.level } : call;
}

// ── Coming back
export const WELCOME_BACK_DAYS = 5;
// Whole days since your last logged session (any kind); null with none.
export function gapDays(sessions, now = Date.now()) {
  const last = Math.max(0, ...sessions.filter(s => s.startedAt <= now).map(s => s.startedAt));
  return last ? { days: Math.floor((now - last) / DAY), lastTs: last } : null;
}
// Back after a break: the first session is lighter and Today says welcome back (until you train or dismiss it).
export const isComeback = (sessions, now = Date.now(), ackTs = 0) => { const g = gapDays(sessions, now); return !!g && g.days >= WELCOME_BACK_DAYS && g.lastTs > ackTs ? g : null; };
