import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { esc, icon, chev, tile, pageHead, group, row, chips, seg, routineLook, ringStat } from './ui-kit.js';
import { readinessScore, isRoutine, allRoutineIds, isLegHeavy } from './domain-program.js';
import { dayKey, weekDates, isoDate, relDay, parseISO, mondayOf, breakInfo, startForWeek } from './domain-calendar.js';
import { weeklySeries, loadTrend, trainingDays, weekStreak } from './domain-analytics.js';
import { createWorkout, createActivity, workoutStats, applySupersets, createQuickWorkout } from './domain-workout.js';
import { COURT_ROUTINES, routineMinutes } from './domain-court.js';
import { prehabFor, PADEL_TYPES, PADEL_FOCUS, hasFocus } from './domain-padel.js';
import { AREAS } from './domain-personalize.js';
import { sessionEffortChips, mname } from './ui-words.js';
import { recoveryCard, currentRecovery } from './ui-recovery.js';
import { adaptWorkout, revertAdaptation, exerciseFatigue, RECOVERING_FROM } from './domain-adaptive.js';
import { dayCall, recoveryDaysRecently, TOO_MANY_RECOVERY_DAYS } from './domain-daycall.js';
import { MATCH_LEVELS, LEVEL_HINT, levelOn, harderThanPlanned } from './domain-matchlevel.js';
import { calibrate, colorFor } from './domain-recovery.js';
import { phaseFor, DAYS } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { MUSCLES } from './domain-taxonomy.js';
import { saveBackup } from './ui-backup.js';
import * as cloud from './core-cloud.js';
import { reviewBanner } from './ui-review.js';
import { taperFor, taperText, tournamentSummary } from './domain-goals.js';
import { blockBanner } from './ui-goal.js';
import { weekActions, weekAskCard, weekTargets, weekWindow } from './ui-week.js';
import { recentPain, painWithProfile, painHits, areaName } from './domain-pain.js';
import { applyPainHolds } from './ui-workout.js';

const lastDone = id => app.strength.find(s => s.routineId === id);
const ACTIVITIES = [['padel', 'Padel'], ['cardio', 'Cardio'], ['mobility', 'Mobility'], ['other', 'Other']];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(ch|sh|s|x)$/.test(w) ? 'es' : 's'}`;

export function banners({ resumeOnly = false } = {}) {
  let out = '';
  if (S.active) {
    const st = workoutStats(S.active);
    out += `<button class="banner" data-action="resume">${tile('play', 'blue')}<span><b>Continue your workout</b><small>${esc(S.active.title)} · ${st.sets} of ${st.planned} sets done</small></span>${chev}</button>`;
  }
  if (resumeOnly) return out;
  if (!S.profile.onboarded) out += `<button class="banner" data-action="go" data-to="welcome">${tile('sliders', 'blue')}<span><b>Personalise your plan</b><small>Takes 30 seconds. Your history is kept.</small></span>${chev}</button>`;
  // During a goal block the weeks follow the block, so no "restart at week 1" offer.
  const br = app.position().block ? null : breakInfo(S.sessions, app.position().week, { acknowledged: S.settings.breakAck || 0 });
  if (br) out += `<div class="banner">${tile('today', 'blue')}<span><b>Welcome back</b><small>${br.days} days since your last workout, and your plan is on week ${app.position().week}. Restart at week 1 to build back up?</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="cycle-restart" style="font-size:15px">Restart</button><button class="link" data-action="cycle-keep" data-ts="${br.lastTs}" style="font-size:13px">Keep week ${app.position().week}</button></span></div>`;
  out += weekAskCard();
  const tr = loadTrend(weeklySeries(S.sessions, 5));
  if (tr.ratio != null && tr.ratio > 1.5) out += `<div class="banner warn">${tile('flame', 'orange')}<span><b>Big week</b><small>You’ve trained about ${tr.ratio}× more than usual. Consider an easier day.</small></span></div>`;
  const tp = taperFor(S.settings.tournament);
  if (tp && !tp.noGym) {
    const sum = tp.phase === 'recover' ? tournamentSummary(S.sessions, S.settings.tournament) : null;
    const res = sum?.matches ? `${plural(sum.matches, 'match')}${sum.won + sum.lost ? `, ${sum.won}–${sum.lost}` : ''}. ` : '';
    out += `<button class="banner" data-action="go" data-to="overview">${tile('trophy', 'teal')}<span><b>${esc(tp.phase === 'recover' ? `After ${tp.name}` : tp.phase === 'taper' ? 'Tournament week' : `${tp.name} coming up`)}</b><small>${esc(res + taperText(tp))}</small></span>${chev}</button>`;
  }
  out += blockBanner(!!(tp && !tp.noGym));
  const hm = hardMatchOffer();
  if (hm) out += `<div class="banner warn">${tile('racket', 'orange')}<span><b>That match was harder than planned</b><small>Move ${esc(app.routine(hm.routine).title)} from ${esc(weekday(hm.from))} to ${esc(weekday(hm.to))}, so your legs get more time?</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="hard-move" data-r="${esc(hm.routine)}" data-from="${hm.from}" data-to="${hm.to}" data-id="${esc(hm.match.id)}" style="font-size:15px;white-space:nowrap">Move it</button><button class="link" data-action="hard-keep" data-id="${esc(hm.match.id)}" style="font-size:13px">Keep</button></span></div>`;
  // Recovery days keep coming: the plan is too much for how much padel you play.
  const recent = recoveryDaysRecently(S.settings.recoveryDays);
  if (recent >= TOO_MANY_RECOVERY_DAYS && Date.now() - (S.settings.recWarnSnooze || 0) > 30 * 86400000)
    out += `<div class="banner warn">${tile('heart', 'orange')}<span><b>${recent} recovery days in 2 weeks</b><small>Your gym plan may be too heavy for how much padel you play. Try one fewer gym day, or shorter workouts.</small></span><span style="display:grid;gap:4px;margin-left:auto;text-align:right"><button class="link" data-action="go" data-to="welcome" style="font-size:15px;white-space:nowrap">Change plan</button><button class="link" data-action="rec-warn-later" style="font-size:13px">Later</button></span></div>`;
  // Everything lives on this phone, so nudge a backup from the first saved session, then weekly.
  // With the online copy working, no backup nudge; if it stops, say so (a broken key is the one thing to fix).
  const cs = cloud.status();
  if (cs.on && ['key', 'access'].includes(cs.error)) out += `<button class="banner warn" data-action="go" data-to="settings">${tile('shield', 'orange')}<span><b>Online copy stopped</b><small>${cs.error === 'key' ? 'Your GitHub key no longer works. Add a new one in Settings.' : 'The key can’t reach your repository any more. Check it in Settings.'}</small></span>${chev}</button>`;
  const cloudOk = cs.on && cs.lastOk && Date.now() - cs.lastOk < 7 * 86400000;
  if (S.sessions.length && !cloudOk) {
    const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 86400000) : null;
    const snoozed = Date.now() - (S.settings.backupSnooze || 0) < 7 * 86400000;
    // A slim strip, not a card: it matters, but it shouldn't compete with today's workout.
    if ((days == null || days >= 7) && !snoozed) out += `<div class="strip">${icon('download')}<span>${cs.on ? `Online copy hasn’t saved for ${cs.lastOk ? Math.floor((Date.now() - cs.lastOk) / 86400000) : 'several'} days.` : days == null ? 'Your workouts are only on this phone.' : `Last backup ${days} days ago.`}</span><button data-action="quick-backup">Back Up</button><button class="later" data-action="backup-later">Later</button></div>`;
  }
  return out;
}

// After you log soreness or pain: say what the app will do about it, so you know it listened.
// Workout pain counts straight away; padel soreness once it comes back (see recentPain).
// How long a new session probably lasted: same as your last one of that kind. Tournament
// matches are shorter, so on tournament day it's 45 min unless you've already logged one there.
function defaultMinutes(kind, iso) {
  const last = S.sessions.filter(s => s.kind === 'activity' && s.activity === kind).sort((a, b) => b.startedAt - a.startedAt);
  const t = S.settings.tournament;
  if (kind === 'padel' && t?.date === iso) return last.find(s => isoDate(new Date(s.startedAt)) === iso)?.durationMin || 45;
  return last[0]?.durationMin || (kind === 'padel' ? 90 : 45);
}

export function soreNote(areas) {
  if (!areas?.length) return '';
  const pain = recentPain(S.sessions, { cleared: S.painClear }), names = l => l.map(a => areaName(a).toLowerCase()).join(' and ');
  const on = areas.filter(a => pain[a]), later = areas.filter(a => !pain[a]);
  if (on.length) return `Workouts will offer gentler options for your ${names(on)} for now.`;
  return `Noted. If your ${names(later)} ${later.length > 1 ? 'are' : 'is'} sore after another match, workouts will start going easier on ${later.length > 1 ? 'them' : 'it'}.`;
}

// One line on the workout card when today's plan should go easier: pain first, then recovery.
function recoveringHint(routineId) {
  const r = app.routine(routineId);
  const pain = painWithProfile(S.sessions, S.profile, { cleared: S.painClear }), hurt = [...new Set(r.blocks.flatMap(b => painHits(b.ex, pain)))];
  if (hurt.length) return `Gentler options ready for your ${hurt.slice(0, 2).map(a => areaName(a).toLowerCase()).join(' and ')}`;
  return adjustPreview(routineId)?.text || '';
}

// ── Today's workout as it will start: same build and adjustments as pressing Start, so the card can say what changes.
const DAY_MS = 86400000;
const isoIn = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = iso => DAY_LONG[parseISO(iso).getDay()];
// Recent padel with no gym since: the tiredness is from the match.
const afterPadel = (now = Date.now()) => S.sessions.some(s => s.activity === 'padel' && now - s.startedAt < 2 * DAY_MS) && !S.sessions.some(s => s.kind === 'strength' && now - s.startedAt < 3 * DAY_MS);
function buildWorkout(routineId, { readiness = null, light = false, sore = [] } = {}) {
  const week = app.position().week;
  const w = createWorkout({ routineId, week, history: app.strength, overrides: S.overrides, unit: S.settings.unit, readiness, light, profile: app.location() ? { ...S.profile, owned: app.location().equipment } : S.profile });
  const rec = currentRecovery();
  if (S.settings.adaptive !== false) {
    adaptWorkout(w, { rec, sore, readiness: readiness ? readinessScore(readiness) : null, padelTomorrow: !!app.legLevel(isoIn(1)) && app.legLevel(isoIn(1)) !== 'easy', hardSoon: app.legLevel(isoIn(2)) === 'hard', loadRatio: loadTrend(weeklySeries(S.sessions, 5)).ratio || 0,
      deload: phaseFor(week).loadMult < 1, level: S.profile.level, history: app.strength, unit: S.settings.unit, afterPadel: afterPadel() });
  }
  return { w, rec };
}
const regionOf = m => LEGS.includes(m) ? 'Legs' : CORE.includes(m) ? 'Core' : 'Upper body';
// "Legs still recovering after your match: Solid effort on 3 exercises, one set fewer on Box jump."
function adjustPreview(routineId) {
  if (S.settings.adaptive === false) return null;
  const said = todayFeel(), r = said ? FEELS[said.feel].r : null, tp = taperFor(S.settings.tournament);
  const { w } = buildWorkout(routineId, { readiness: r, light: !!(tp?.lighter || tp?.noGym) || (r ? readinessScore(r).label === 'Low' : false) });
  const ch = w.adapt?.changes || [];
  if (!ch.length) return null;
  const by = d => ch.filter(c => c.dir === d), names = l => l.length <= 2 ? l.map(c => c.name).join(' and ') : `${l.length} exercises`;
  const parts = [by('down').length && `one set fewer on ${names(by('down'))}`, by('hold').length && `same weight on ${names(by('hold'))}`,
    by('ease').length && `Solid effort on ${names(by('ease'))}`, by('up').length && `an extra set on ${names(by('up'))}`].filter(Boolean);
  const regions = [...new Set(ch.filter(c => c.dir !== 'up' && c.muscle).map(c => regionOf(c.muscle)))];
  const head = regions.length ? `${regions.join(' and ')} still recovering${afterPadel() ? ' after padel' : ''}` : 'Fully recovered';
  return { text: `${head}: ${parts.join(', ')}.`, head, parts, changes: ch };
}
// A workout later this week that suits today better: its muscles are ready while today's are still recovering.
// Only a straight swap within this week, and never one that puts the moved workout the day before padel.
function swapOffer(routineId) {
  if (S.active || S.settings.adaptive === false || S.settings.swap?.date === isoDate()) return null;
  const rec = currentRecovery();
  const worst = id => Math.max(0, ...app.routine(id).blocks.map(b => getExercise(b.ex)).filter(Boolean).map(ex => exerciseFatigue(ex, rec).level));
  const mine = worst(routineId);
  if (mine < RECOVERING_FROM) return null;
  for (let i = 1; i < 7; i++) {
    const iso = isoIn(i);
    if (parseISO(iso).getDay() === 1) break;
    const alt = app.planOn(iso);
    if (!isRoutine(alt) || alt === routineId || S.sessions.some(s => isoDate(new Date(s.startedAt)) === iso)) continue;
    if (worst(alt) < RECOVERING_FROM && mine - worst(alt) >= 0.15 && app.planOn(isoIn(i + 1)) !== 'Padel') return { to: alt, back: iso };
  }
  return null;
}

// A later free day this week for a workout you rest from today: not the day before padel, and for legs
// not the day after one if there's a choice. Tomorrow only as a last resort (you're resting for a reason).
// from: days from today of the workout being moved (0 = today).
function moveDay(routineId, from = 0) {
  let fallback = null;
  const beforeMatch = iso => !!app.legLevel(iso) && app.legLevel(iso) !== 'easy';
  for (let i = from + 1; i < 7; i++) {
    const iso = isoIn(i);
    if (parseISO(iso).getDay() === 1) break;
    const v = app.planOn(iso);
    if ((v !== 'Rest' && v !== 'Recovery') || S.sessions.some(s => isoDate(new Date(s.startedAt)) === iso) || beforeMatch(isoIn(i + 1))) continue;
    if (i === from + 1 || (isLegHeavy(routineId) && app.planOn(isoIn(i - 1)) === 'Padel' && app.legLevel(isoIn(i - 1)) !== 'easy')) { fallback ??= iso; continue; }
    return iso;
  }
  return fallback;
}

// Hard match tomorrow and legs planned today: swap in a non-leg workout from later this week, or move
// the leg day to a free one. { to, back } for a swap, { move } for a move, or null.
function prepOffer(routineId) {
  if (S.active || S.settings.adaptive === false || !isLegHeavy(routineId) || app.legLevel(isoIn(1)) !== 'hard' || S.settings.swap?.date === isoDate()) return null;
  for (let i = 2; i < 7; i++) {
    const iso = isoIn(i);
    if (parseISO(iso).getDay() === 1) break;
    const alt = app.planOn(iso);
    if (!isRoutine(alt) || isLegHeavy(alt) || S.sessions.some(s => isoDate(new Date(s.startedAt)) === iso)) continue;
    if (!(app.legLevel(isoIn(i + 1)) && app.legLevel(isoIn(i + 1)) !== 'easy')) return { to: alt, back: iso };
  }
  const move = moveDay(routineId);
  return move && move !== isoIn(1) ? { move } : null;
}

// ── Expected match level for one date: a small picker (the weekday's usual level is set in Plan).
export function levelSheet(iso) {
  const cur = levelOn(iso, S.settings), d = parseISO(iso);
  app.sheet(`<h2 class="sheet-title">How hard will padel be?</h2><p class="sheet-sub">${esc(d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}. Only this date changes.</p>
    ${group(Object.entries(MATCH_LEVELS).map(([k, label]) => row({ title: label, sub: LEVEL_HINT[k], action: 'match-level', data: { iso, level: k }, chevron: false, right: cur === k ? icon('check', 'check-mark') : '' })).join(''))}
    <button class="btn gray" data-action="close-sheet">Cancel</button>`);
}
const levelLine = iso => { const lv = app.matchLevel(iso); return lv ? `<p class="hero-note match-line">${icon('racket')}Padel ${iso === isoIn(1) ? 'tomorrow' : 'today'} · <b>${MATCH_LEVELS[lv]}</b> <button class="link" data-action="level-sheet" data-iso="${iso}">Change</button></p>` : ''; };

// A match logged as hard when it wasn't planned that way: offer to push the next leg day (within two days) back.
function hardMatchOffer() {
  if (S.settings.adaptive === false) return null;
  const sw = S.settings.swap;
  if (sw && (sw.date >= isoDate() || (sw.back && sw.back >= isoDate()))) return null;   // one move at a time
  const m = S.sessions.filter(s => s.activity === 'padel' && Date.now() - s.startedAt < 36 * 3600000 && S.settings.hardSeen !== s.id)
    .find(s => harderThanPlanned(s, levelOn(isoDate(new Date(s.startedAt)), S.settings)));
  if (!m) return null;
  for (let i = 1; i <= 2; i++) {
    const iso = isoIn(i), r = app.planOn(iso);
    if (!isRoutine(r) || !isLegHeavy(r)) continue;
    const to = moveDay(r, i);
    return to ? { match: m, routine: r, from: iso, to } : null;
  }
  return null;
}

// ── Today's call: Full, Easier, Reshaped or Recovery day, with the reason and what changes (see daycall.js).
const CALL = { full: ['bolt', 'Full workout'], easier: ['sliders', 'Easier today'], reshaped: ['swap', 'Reshaped'], prep: ['racket', 'Match prep'], recovery: ['heart', 'Recovery day'] };
// The body area a workout mostly works: Legs, Core or Upper body.
const routineRegion = id => { const n = {}; for (const b of app.routine(id).blocks) for (const m of getExercise(b.ex)?.primary || []) n[regionOf(m)] = (n[regionOf(m)] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Upper body'; };
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
function todayCall(plan) {
  const said = todayFeel(), feel = said?.feel || null, r = feel ? FEELS[feel].r : null, tp = taperFor(S.settings.tournament);
  const light = !!(tp?.lighter || tp?.noGym) || (r ? readinessScore(r).label === 'Low' : false);
  const { w, rec } = buildWorkout(plan, { readiness: r, light });
  const swap = swapOffer(plan), prep = prepOffer(plan);
  const call = S.settings.adaptive === false ? { level: light ? 'easier' : 'full', tiredShare: 0 }
    : dayCall({ fatigue: w.exercises.map(e => exerciseFatigue(getExercise(e.exId), rec).level), changes: w.adapt?.changes || [], feel, light, swap, prep, afterTournament: tp?.phase === 'recover' });
  const r0 = app.routine(plan), pv = adjustPreview(plan);
  let why = '', bullets = [], extra = {};
  if (call.level === 'full') {
    why = !lastDone(plan) ? `${r0.focus} Your first session sets your starting weights.` : feel ? `You're feeling ${feel} and recovered. Train as planned.` : 'You’re recovered. Train as planned.';
    const heavier = w.exercises.filter(e => e.suggestion?.kind === 'up'), extra = (w.adapt?.changes || []).filter(c => c.dir === 'up');
    const list = l => l.length <= 2 ? l.map(x => x.name).join(' and ') : `${l.length} exercises`;
    bullets = [heavier.length && `A little heavier than last time on ${list(heavier)}`, extra.length && `One extra set on ${list(extra)}`].filter(Boolean);
  } else if (call.level === 'easier') {
    why = pv?.head && pv.head !== 'Fully recovered' ? `${pv.head}.` : feel === 'tired' ? 'You said you’re tired.' : feel === 'sore' ? 'You said you’re sore.' : tp?.lighter ? (tp.phase === 'recover' ? 'Just after your tournament.' : 'Tournament week.') : 'A lighter day today.';
    bullets = [...(light ? ['One set fewer on each exercise, easier effort'] : []), ...(pv?.parts || []).map(cap)];
  } else if (call.level === 'prep') {
    why = 'Hard match tomorrow, so your legs stay fresh today.';
    if (prep.to) { const alt = app.routine(prep.to); bullets = [`${alt.title} today`, `${r0.title} moves to ${weekday(prep.back)}`]; extra = { to: prep.to, back: prep.back, alt }; }
    else { bullets = [`${r0.title} moves to ${weekday(prep.move)}`, 'Some easy mobility today if you like']; extra = { move: prep.move }; }
  } else if (call.level === 'reshaped') {
    const alt = app.routine(swap.to);
    const mine = routineRegion(plan), theirs = routineRegion(swap.to);
    why = mine !== theirs ? `Your ${mine.toLowerCase()} ${mine === 'Legs' ? 'are' : 'is'} still recovering${afterPadel() ? ' after padel' : ''}, and your ${theirs.toLowerCase()} ${theirs === 'Legs' ? 'are' : 'is'} ready.`
      : `Today’s muscles are still recovering${afterPadel() ? ' after padel' : ''}; ${alt.title} works ones that are ready.`;
    bullets = [`${alt.title} today`, `${r0.title} moves to ${weekday(swap.back)}`];
    extra = { to: swap.to, back: swap.back, alt };
  } else {
    const back = moveDay(plan), reasons = [];
    if (call.tiredShare >= 0.5) reasons.push(`most of today’s muscles are still tired${afterPadel() ? ' after padel' : ''}`);
    if (tp?.phase === 'recover') reasons.push('you’re just after a tournament');
    // Your check-in answer is shown just above, so the reason line doesn't repeat it.
    why = `${cap(reasons.join(', and ') || (feel === 'tired' ? 'you said you’re tired' : 'you said you’re sore'))}. A gym session today would cost more than it gives.`;
    bullets = [`Daily mobility · ${routineMinutes(COURT_ROUTINES.mobility)} min`, back ? `${r0.title} moves to ${weekday(back)}` : `${r0.title} is skipped this week; your plan continues Monday`, 'Keeps your weekly streak going'];
    extra = { back };
  }
  return { ...call, why, bullets, ...extra };
}
function callCard(plan) {
  const r = app.routine(plan), look = routineLook(plan), c = todayCall(plan), [ic, label] = CALL[c.level];
  const pain = (() => { const h = recoveringHint(plan); return h.startsWith('Gentler') ? `<p class="hero-note orange">${esc(h)}</p>` : ''; })();
  const sw = S.settings.swap, swapped = sw?.date === isoDate() && sw.to === plan;
  const swapIn = c.level === 'reshaped' || (c.level === 'prep' && c.to);
  const title = c.level === 'recovery' ? 'Mobility and stretching' : swapIn ? c.alt.title : c.level === 'prep' ? 'Rest before your match' : r.title;
  const sub = c.level === 'recovery' || (c.level === 'prep' && !c.to) ? `Instead of ${r.title}` : swapIn ? `Swapped in from ${weekday(c.back)}` : `${plural(r.blocks.length, 'exercise')} · about ${r.minutes} min`;
  const tileIc = c.level === 'recovery' ? tile('heart', 'pink', true) : swapIn ? tile(routineLook(c.to).icon, routineLook(c.to).color, true) : c.level === 'prep' ? tile('racket', 'teal', true) : tile(look.icon, look.color, true);
  const main = c.level === 'recovery' ? `<button class="btn filled" data-action="recovery-day" data-back="${c.back || ''}">${icon('play')}Start Mobility</button><button class="link call-alt" data-action="start" data-routine="${plan}">Train anyway, made easier</button>`
    : swapIn ? `<button class="btn filled" data-action="reshape-start" data-r="${esc(c.to)}" data-back="${c.back}">${icon('play')}Start ${esc(c.alt.title)}</button><button class="link call-alt" data-action="start" data-routine="${plan}">Keep ${esc(r.title)}, made easier</button>`
    : c.level === 'prep' ? `<button class="btn filled" data-action="prep-move" data-back="${c.move}">Move ${esc(r.title)} to ${esc(weekday(c.move))}</button><button class="link call-alt" data-action="start" data-routine="${plan}">Train anyway, made easier</button>`
    : `<button class="btn filled" data-action="start" data-routine="${plan}">${icon('play')}Start Workout</button>${c.level === 'easier' && S.settings.adaptive !== false ? `<button class="link call-alt" data-action="start-full" data-routine="${plan}">Use the full plan</button>` : ''}`;
  return `<section class="card hero"><span class="call-chip ${c.level}">${icon(ic)}${label}</span>
    <div class="hero-top">${tileIc}<div><h2>${esc(title)}</h2><p class="t-sub">${esc(sub)}</p></div></div>
    ${S.active ? '' : feelCard()}
    ${levelLine(isoIn(1))}
    <p class="hero-note call-why">${esc(c.why)}</p>
    ${c.bullets.length ? `<ul class="call-list">${c.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${pain}
    ${swapped ? `<p class="hero-note swap-note">Swapped: ${esc(app.routine(sw.from).title)} moves to ${esc(weekday(sw.back))}. <button class="link" data-action="swap-undo">Undo</button></p>` : ''}
    ${S.active ? '' : main}</section>`;
}

// The next scheduled workout after today: { id, when: 'Tomorrow' | 'Wednesday' }.
function nextPlanned() {
  const names = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  for (let i = 1; i <= 7; i++) { const d = DAYS[(DAYS.indexOf(dayKey()) + i) % 7], v = app.planOn(isoIn(i)); if (isRoutine(v)) return { id: v, when: i === 1 ? 'Tomorrow' : names[d] }; }
  return null;
}

// Today's planned padel in words: "Ball machine · Overheads. Warm up, play, then log it".
const padelToday = () => { const p = app.padelOn(); return p && p.type !== 'match' ? `${PADEL_TYPES[p.type]}${p.focus && p.focus !== 'mixed' ? ` · ${PADEL_FOCUS[p.focus]}` : ''}. Warm up, then log it` : 'Warm up, play, then log it'; };
function hero() {
  const plan = app.planOn();
  const doneToday = S.sessions.filter(s => isoDate(new Date(s.startedAt)) === isoDate());
  const tp = taperFor(S.settings.tournament);
  // On tournament day the tournament card stays up after each match (that's when you need it most).
  // Done: a compact line (the work is behind you), then what's coming next.
  if (doneToday.length && !S.active && tp?.phase !== 'day') {
    const next = nextPlanned();
    // With a workout and a match (or a warm-up) on the same day, the workout leads and is the summary you open.
    const done = [...doneToday].sort((a, b) => (b.kind === 'strength') - (a.kind === 'strength'));
    return `<section class="card"><button class="done-card" data-action="go" data-to="history/session/${esc(done[0].id)}" style="width:100%;text-align:left">${tile('check', 'green')}<span class="row-main"><b>Done today</b><small>${esc(done.map(s => s.title).join(' + '))} · see summary</small></span>${chev}</button>
      ${next ? `<button class="done-next" data-action="go" data-to="plan/routine/${esc(next.id)}">${tile(routineLook(next.id).icon, 'gray')}<span class="row-main"><span class="row-title">Next: ${esc(app.routine(next.id).title)}</span><small>${esc(next.when)}</small></span>${chev}</button>` : ''}</section>`;
  }
  if (tp?.noGym) {
    const day = tp.phase === 'day', sum = day ? tournamentSummary(S.sessions, S.settings.tournament) : null, played = sum?.matches || 0;
    const sore = sum ? Object.keys(sum.sore).map(a => AREAS[a].split(' ')[0].toLowerCase()) : [];
    const so = played ? `<div class="tiles three" style="margin:4px 0 16px">${['Matches', 'Won–lost', 'Minutes'].map((l, i) => `<div class="tile-stat"><b class="num">${[played, `${sum.won}–${sum.lost}`, sum.minutes][i]}</b><small>${l}</small></div>`).join('')}</div>${sore.length ? `<p class="hero-note orange">Sore so far: ${esc(sore.join(', '))}. Ease off where you can.</p>` : ''}` : '';
    return `<section class="card hero"><div class="hero-top">${tile('trophy', 'teal', true)}<div><p class="t-foot">${day ? 'Today' : tp.days === 1 ? 'Tomorrow' : 'In 2 days'}</p><h2>${esc(tp.name)}</h2><p class="t-sub">${day ? 'Tournament day' : 'Rest up before you play'}</p></div></div>
      ${played ? so : `<p class="hero-note">${esc(taperText(tp))}</p>`}
      <div class="btns">${day ? (played
        ? `<button class="btn filled" data-action="log-activity" data-kind="padel">Log Another Match</button><button class="btn tinted" data-action="go" data-to="court/between">${icon('play')}Between Matches · ${routineMinutes(COURT_ROUTINES.between)} min</button>`
        : `<button class="btn filled" data-action="go" data-to="court/warmup">${icon('play')}Warm Up · ${routineMinutes(COURT_ROUTINES.warmup)} min</button><button class="btn tinted" data-action="log-activity" data-kind="padel">Log a Match</button>`)
        : `<button class="btn filled" data-action="go" data-to="court/mobility">${icon('play')}Daily Mobility · ${routineMinutes(COURT_ROUTINES.mobility)} min</button>${isRoutine(plan) && !S.active ? `<button class="btn plain" data-action="start" data-routine="${plan}">Train anyway</button>` : ''}`}</div></section>`;
  }
  if (isRoutine(plan)) return callCard(plan);
  if (plan === 'Padel') {
    return `<section class="card hero"><div class="hero-top">${tile('racket', 'teal', true)}<div><p class="t-foot">Today</p><h2>Padel day</h2><p class="t-sub">${esc(padelToday())}</p></div></div>
      ${levelLine(isoDate())}
      <div class="btns"><button class="btn filled" data-action="go" data-to="court/warmup">${icon('play')}Warm Up · ${routineMinutes(COURT_ROUTINES.warmup)} min</button>
      <button class="btn tinted" data-action="log-activity" data-kind="padel">Log ${app.padelOn()?.type === 'match' ? 'Match' : 'Padel'}</button></div></section>`;
  }
  const rec = plan === 'Recovery', sw = S.settings.swap;
  if (plan === 'Rest' && sw?.date === isoDate() && isRoutine(sw.from)) {
    return `<section class="card hero"><span class="call-chip prep">${icon('racket')}Match prep</span>
      <div class="hero-top">${tile('racket', 'teal', true)}<div><h2>Rest before your match</h2><p class="t-sub">Legs fresh for tomorrow</p></div></div>
      ${levelLine(isoIn(1))}
      <p class="hero-note swap-note">${esc(app.routine(sw.from).title)} ${sw.back ? `moves to ${esc(weekday(sw.back))}` : 'is skipped this week'}. <button class="link" data-action="swap-undo">Undo</button></p>
      <button class="btn tinted" data-action="go" data-to="court/mobility">${icon('play')}Daily Mobility · ${routineMinutes(COURT_ROUTINES.mobility)} min</button></section>`;
  }
  if (rec && sw?.date === isoDate() && isRoutine(sw.from)) {
    return `<section class="card hero"><span class="call-chip recovery">${icon('heart')}Recovery day</span>
      <div class="hero-top">${tile('heart', 'pink', true)}<div><h2>Mobility and stretching</h2><p class="t-sub">Daily mobility · ${routineMinutes(COURT_ROUTINES.mobility)} min</p></div></div>
      <p class="hero-note swap-note">${esc(app.routine(sw.from).title)} ${sw.back ? `moves to ${esc(weekday(sw.back))}` : 'is skipped this week; your plan continues Monday'}. <button class="link" data-action="swap-undo">Undo</button></p>
      <button class="btn filled" data-action="go" data-to="court/mobility">${icon('play')}Start Mobility</button></section>`;
  }
  return `<section class="card hero"><div class="hero-top">${tile(rec ? 'heart' : 'snow', rec ? 'pink' : 'gray', true)}<div><p class="t-foot">Today</p><h2>${rec ? 'Recovery day' : 'Rest day'}</h2><p class="t-sub">${rec ? 'Light movement only' : 'Take it easy'}</p></div></div>
    <p class="hero-note">${rec ? 'A walk, some mobility or an injury-prevention routine is perfect today.' : 'Full rest helps you come back stronger.'}</p>
    <button class="btn tinted" data-action="${rec ? 'go' : 'log-activity'}" ${rec ? 'data-to="court"' : 'data-kind="mobility"'}>${rec ? 'Browse Routines' : 'Log an Activity'}</button></section>`;
}

// ── One-tap check-in on Today: how you feel sets today's workout before you press Start.
// Each answer stands for a full check-in (sleep, energy, soreness: 1–5) so the workout adapts as it did from the sheet.
export const FEELS = {
  great: { label: 'Great', r: { sleep: 5, energy: 5, soreness: 1 }, says: 'Feeling great. Training as planned.' },
  good: { label: 'Good', r: { sleep: 4, energy: 4, soreness: 1 }, says: 'Feeling good. Training as planned.' },
  tired: { label: 'Tired', r: { sleep: 2, energy: 2, soreness: 2 }, says: 'Feeling tired. Today’s workout will be lighter: one fewer set and easier effort.' },
  sore: { label: 'Sore', r: { sleep: 3, energy: 3, soreness: 4 }, says: 'Feeling sore. When you start, tap where so we go easy there.' },
};
// Today's answer, or null (yesterday's doesn't count).
export const todayFeel = () => { const c = S.settings.checkin; return c?.date === isoDate() && FEELS[c.feel] ? c : null; };
function feelCard() {
  if (!S.settings.readinessPrompt) return '';
  const c = todayFeel();
  if (c) return `<p class="hero-note feel-said">You said you feel ${esc(FEELS[c.feel].label.toLowerCase())}. <button class="link" data-action="feel-clear">Change</button></p>`;
  return `<div class="feel"><p class="feel-q">How do you feel today?</p><div class="feel-row">${Object.entries(FEELS).map(([k, f]) => `<button class="feel-btn" data-action="feel" data-feel="${k}">${f.label}</button>`).join('')}</div></div>`;
}

// ── The court panel's rings: how ready you are for today, this week's workouts, your streak.
const UPPER = ['front_delts', 'side_delts', 'rear_delts', 'rotator_cuff', 'serratus', 'upper_chest', 'chest', 'lower_chest', 'traps', 'mid_back', 'lats', 'biceps', 'triceps', 'forearms'];
const CORE = ['abs', 'obliques', 'lower_back', 'hip_flexors'];
const LEGS = ['glutes', 'glute_med', 'adductors', 'quads', 'hamstrings', 'calves', 'soleus', 'shins'];
const readyPct = (rec, ms) => ms.length ? Math.round(100 * (1 - ms.reduce((n, m) => n + (rec[m]?.level || 0), 0) / ms.length)) : 100;
function rings() {
  if (!S.sessions.length) return '';
  const rec = currentRecovery(), plan = app.planOn();
  const muscles = isRoutine(plan) ? [...new Set(app.routine(plan).blocks.flatMap(b => getExercise(b.ex)?.primary || []))] : [...UPPER, ...CORE, ...LEGS];
  const feel = isRoutine(plan) ? todayFeel()?.feel : null;
  const ready = Math.round(readyPct(rec, muscles) * (feel === 'tired' ? 0.75 : feel === 'sore' ? 0.85 : 1)), planned = Object.values(S.schedule).filter(isRoutine).length;
  const done = app.strength.filter(s => s.startedAt >= mondayOf().getTime()).length, streak = weekStreak(S.sessions);
  const readyColor = ready >= 75 ? 'var(--ball)' : ready >= 50 ? '#FFD60A' : '#FF9F0A';
  return `<button class="court-rings" data-action="go" data-to="recovery" aria-label="Ready ${ready}%, ${done} of ${planned} workouts this week, ${streak} week streak">
    ${ringStat(ready / 100, readyColor, `${ready}%`, '', isRoutine(plan) ? 'Ready for today' : 'Ready')}
    ${ringStat(planned ? done / planned : 0, '#64D2FF', `${done}/${planned || done}`, '', 'This week')}
    ${ringStat(Math.min(1, streak / 8), '#FFFFFF', String(streak), streak === 1 ? 'week' : 'weeks', 'Streak')}</button>`;
}

// Recovery at a glance: three bars instead of the full body map (one tap opens it).
function recoveryStrip() {
  if (!S.sessions.some(s => Date.now() - s.startedAt < 8 * 86400000)) return '';
  const rec = currentRecovery(), part = (label, ms) => { const p = readyPct(rec, ms); return `<div class="rs-part"><span>${label}</span><i><b style="width:${p}%;background:${colorFor(1 - p / 100)}"></b></i><em>${p}%</em></div>`; };
  return `<section class="grp"><h2 class="grp-h big">Recovery</h2><button class="card rec-strip" data-action="go" data-to="recovery">
    ${part('Upper body', UPPER)}${part('Core', CORE)}${part('Legs', LEGS)}<p class="t-foot">Tap for the body map and each muscle ${chev}</p></button></section>`;
}

function weekCard() {
  const days = trainingDays(S.sessions), today = isoDate();
  // This week's plan (dated changes and busy weeks included), not the usual week.
  const planned = weekDates().filter(d => isRoutine(app.planOn(d.iso))).length, busy = weekTargets(weekWindow()).busy;
  const mon = mondayOf().getTime();
  const done = app.strength.filter(s => s.startedAt >= mon).length, matches = S.sessions.filter(s => s.activity === 'padel' && s.startedAt >= mon).length;
  const restDays = S.sessions.filter(s => s.recoveryDay && s.startedAt >= mon).length;
  return `<section class="grp"><h2 class="grp-h big">This week</h2><div class="card"><div class="week">${weekDates().map(d => {
    const did = days.get(d.iso) || [], plan = app.planOn(d.iso);
    const cls = did.length ? `done ${did.includes('gym') ? '' : 'padel'}` : isRoutine(plan) ? 'plan-gym' : plan === 'Padel' ? 'plan-padel' : 'rest';
    return `<div class="${d.iso === today ? 'today' : ''}"><small>${d.key[0]}</small><span class="dot ${cls}" aria-label="${d.key}: ${did.length ? 'done' : esc(plan)}">${did.length ? icon('check') : ''}</span></div>`;
  }).join('')}</div>
  <p class="week-foot"><b>${done}</b> of ${plural(planned || done, 'workout')}${matches ? ` · <b>${matches}</b> ${matches === 1 ? 'match' : 'matches'}` : ''}${restDays ? ` · <b>${restDays}</b> recovery ${restDays === 1 ? 'day' : 'days'}` : ''}${busy ? ' · busy padel week' : ''}</p>
  <div class="week-key"><span><i style="background:var(--blue)"></i>Gym</span><span><i style="background:var(--teal)"></i>Padel</span><span><i class="ring"></i>Planned</span></div></div></section>`;
}

function stayHealthy() {
  const pre = prehabFor(S.profile, S.sessions, Date.now(), { cleared: S.painClear });
  if (!pre.ids.length) return '';
  return group(pre.ids.map(id => { const r = COURT_ROUTINES[id]; const n = pre.flagged[r.areas[0]];
    return row({ title: esc(r.title), sub: `${routineMinutes(r)} min · ${r.areas.some(a => pre.hurt[a]) ? 'you reported pain here recently' : n >= 2 ? `you flagged this ${n}× recently` : 'from your profile'}`, icon: 'heart', color: 'pink', to: `court/${id}` }); }).join(''),
  { header: 'Stay healthy', big: true });
}

export const today = {
  render() {
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const initial = (S.settings.name || '').trim()[0];
    const avatar = `<button class="avatar" data-action="go" data-to="settings" aria-label="Settings">${initial ? esc(initial.toUpperCase()) : icon('person')}</button>`;
    const todays = app.planOn();
    const others = allRoutineIds().filter(id => id !== todays || S.active);
    const loc = app.location();
    return `${pageHead('Today', { eyebrow: date, right: avatar, sub: loc ? `Training at <button class="link" data-action="loc-sheet">${esc(loc.name)} ▾</button>` : '' })}
      ${banners()}${reviewBanner()}<div class="court-stack">${hero()}${rings()}</div>
      <div style="height:28px"></div>${weekCard()}${recoveryStrip()}${stayHealthy()}
      ${group(others.map(id => { const r = app.routine(id), look = routineLook(id), last = lastDone(id);
        return row({ title: esc(r.title), sub: `About ${r.minutes} min · ${last ? `last done ${esc(relDay(last.startedAt).toLowerCase())}` : 'not done yet'}`, icon: look.icon, color: look.color, action: S.active ? 'resume' : 'start', data: { routine: id } }); }).join('')
        + row({ title: 'Quick workout', sub: 'No plan: add exercises as you go', icon: 'bolt', color: 'indigo', action: 'quick-start' })
        + row({ title: 'Log a match or activity', icon: 'racket', color: 'teal', action: 'log-activity' })
        + row({ title: 'Warm up before playing', sub: `${routineMinutes(COURT_ROUTINES.warmup)} min, guided`, icon: 'flame', color: 'orange', to: 'court/warmup' }),
        { header: 'More', big: true })}
      ${S.sessions.length ? (cloud.status().on && cloud.status().lastOk ? `<p class="t-foot" style="text-align:center;margin:8px 0 4px">Copied online ${esc(relDay(cloud.status().lastOk).toLowerCase())}</p>`
        : `<p class="t-foot" style="text-align:center;margin:8px 0 4px">${S.lastBackup ? `Last backup ${esc(relDay(S.lastBackup).toLowerCase())}` : 'Not backed up yet'} · <button class="link" data-action="quick-backup" style="font-size:inherit">Back up now</button></p>`) : ''}`;
  },
  actions: {
    ...weekActions,
    'past-start'(el) { startPast(el.dataset.id, el.dataset.iso); },
    async 'swap-today'(el) {
      S.settings.swap = { date: isoDate(), from: app.planOn(), to: el.dataset.r, back: el.dataset.back };
      await app.save('settings'); app.render({ keepScroll: true });
      app.toast(`Swapped for this week: ${app.routine(S.settings.swap.from).title} on ${weekday(el.dataset.back)}`);
    },
    async 'swap-undo'() {
      if (S.settings.swap?.to === 'Recovery') S.settings.recoveryDays = (S.settings.recoveryDays || []).filter(d => d !== S.settings.swap.date);
      delete S.settings.swap; await app.save('settings'); app.render({ keepScroll: true }); app.toast('Back to your usual plan');
    },
    async 'prep-move'(el) {
      S.settings.swap = { date: isoDate(), from: app.planOn(), to: 'Rest', back: el.dataset.back || null };
      await app.save('settings'); app.render({ keepScroll: true }); app.toast(`${app.routine(S.settings.swap.from).title} moved to ${weekday(el.dataset.back)}`);
    },
    'level-sheet'(el) { levelSheet(el.dataset.iso); },
    async 'match-level'(el) {
      const { iso, level } = el.dataset, map = { ...(S.settings.matchLevel || {}) };
      for (const k of Object.keys(map)) if (k < isoDate()) delete map[k];          // old dates don't matter any more
      const usual = S.settings.padelLevel?.[DAYS[(parseISO(iso).getDay() + 6) % 7]] || 'normal';
      if (level === usual) delete map[iso]; else map[iso] = level;
      S.settings.matchLevel = map; await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true });
      app.toast(`${weekday(iso)}: ${MATCH_LEVELS[level].toLowerCase()} padel`);
    },
    async 'hard-move'(el) {
      S.settings.swap = { date: el.dataset.from, from: el.dataset.r, to: 'Rest', back: el.dataset.to };
      S.settings.hardSeen = el.dataset.id; await app.save('settings'); app.render({ keepScroll: true });
      app.toast(`${app.routine(el.dataset.r).title} moved to ${weekday(el.dataset.to)}`, async () => { delete S.settings.swap; await app.save('settings'); app.render({ keepScroll: true }); });
    },
    async 'hard-keep'(el) { S.settings.hardSeen = el.dataset.id; await app.save('settings'); app.render({ keepScroll: true }); },
    async 'reshape-start'(el) {
      S.settings.swap = { date: isoDate(), from: app.planOn(), to: el.dataset.r, back: el.dataset.back };
      await app.save('settings'); startFlow(el.dataset.r);
    },
    async 'recovery-day'(el) {
      const today = isoDate();
      S.settings.swap = { date: today, from: app.planOn(), to: 'Recovery', back: el.dataset.back || null };
      S.settings.recoveryDays = [...(S.settings.recoveryDays || []).filter(d => d !== today && recoveryDaysRecently([d]) > 0), today];
      await app.save('settings'); app.go('court/mobility');
    },
    'start-full'(el) { START_ORIGINAL = true; startFlow(el.dataset.routine); },
    async 'rec-warn-later'() { S.settings.recWarnSnooze = Date.now(); await app.save('settings'); app.render({ keepScroll: true }); },
    async feel(el) { S.settings.checkin = { date: isoDate(), feel: el.dataset.feel }; await app.save('settings'); app.render({ keepScroll: true }); },
    async 'feel-clear'() { delete S.settings.checkin; await app.save('settings'); app.render({ keepScroll: true }); },
    'quick-backup'() { saveBackup(); },
    async 'backup-later'() { S.settings.backupSnooze = Date.now(); await app.save('settings'); app.render({ keepScroll: true }); app.toast('Reminder again in a week. Back up any time in Settings.'); },
    async 'quick-start'() {
      if (S.active) return app.go('workout');
      S.active = createQuickWorkout({ week: app.position().week });
      await app.saveActive(true); app.go('workout');
    },
    async 'cycle-restart'() { S.settings.programStart = startForWeek(1, S.settings.programStart); await app.save('settings'); app.render({ keepScroll: true }); app.toast('Plan restarted at week 1'); },
    async 'cycle-keep'(el) { S.settings.breakAck = +el.dataset.ts; await app.save('settings'); app.render({ keepScroll: true }); },
    start(el) { startFlow(el.dataset.routine); },
    resume() { app.go('workout'); },
    async 'discard-active'() {
      if (!(await app.confirm('Discard the workout in progress?', { ok: 'Discard', danger: true }))) return;
      const old = S.active; S.active = null; await app.saveActive(true); app.render();
      app.toast('Workout discarded', async () => { S.active = old; await app.saveActive(true); app.render(); });
    },
    'log-activity'(el) { activitySheet(el.dataset.kind || 'padel'); },
  },
};

// ── Start flow with an optional 10-second check-in
const SCALE = {
  sleep: ['How did you sleep?', ['Badly', 'So-so', 'OK', 'Well', 'Great']],
  energy: ['Energy level', ['Empty', 'Low', 'OK', 'Good', 'High']],
  soreness: ['Muscle soreness', ['None', 'A little', 'Some', 'Sore', 'Very']],
};
function startFlow(routineId) {
  // Carried into begin() only for this start, so a check-in you close doesn't leave it set for the next one.
  const original = START_ORIGINAL; START_ORIGINAL = false;
  const begin = (...a) => { START_ORIGINAL = original; return beginWorkout(...a); };
  if (S.active) return app.go('workout');
  if (!S.settings.readinessPrompt) return begin(routineId, null, false);
  // Answered on Today already: start straight away. Sore still asks where, so it can go easy there.
  const said = todayFeel();
  if (said && said.feel !== 'sore') { const r = FEELS[said.feel].r; return begin(routineId, r, readinessScore(r).label === 'Low'); }
  // Muscles this workout relies on, most tired first, so you can flag soreness.
  const rec = currentRecovery();
  const muscles = [...new Set(app.routine(routineId).blocks.flatMap(b => getExercise(b.ex)?.primary || []))].sort((a, b) => rec[b].level - rec[a].level).slice(0, 8);
  // Nothing is pre-selected: unanswered questions count as average, and if you answer none it's a skip.
  S.form = { sleep: null, energy: null, soreness: null, ...(said ? FEELS[said.feel].r : {}), light: null, sore: [] };
  const answered = () => ['sleep', 'energy', 'soreness'].some(k => S.form[k] != null);
  const filled = () => ({ sleep: +(S.form.sleep ?? 3), energy: +(S.form.energy ?? 3), soreness: +(S.form.soreness ?? 1) });
  const draw = () => {
    const sc = readinessScore(filled()), low = sc.label === 'Low';
    const light = S.form.light ?? low;
    return `<h2 class="sheet-title">How do you feel today?</h2><p class="sheet-sub">We’ll adjust today’s workout if you need a lighter day.</p>
      ${Object.entries(SCALE).map(([k, [q, opts]]) => `<label class="field-l">${q}</label>${seg(k, opts.map((o, i) => [i + 1, o]), S.form[k])}`).join('')}
      ${muscles.length ? `<label class="field-l">Sore anywhere? <small>(optional)</small></label><div class="chipset">${muscles.map(m => `<button type="button" class="chip-btn ${S.form.sore.includes(m) ? 'warn-on' : ''}" data-sore-m="${m}" aria-pressed="${S.form.sore.includes(m)}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colorFor(rec[m].level)};margin-right:6px"></span>${esc(mname(m))}</button>`).join('')}</div>` : ''}
      <div style="height:20px"></div>
      ${group(row({ title: 'Lighter workout today', sub: !answered() ? 'Optional. Answer above and we’ll suggest.' : low ? 'Recommended: one fewer set and easier effort.' : sc.label === 'Moderate' ? 'Optional. You seem OK to train.' : 'You seem ready to train as planned.', right: `<input type="checkbox" class="switch" id="lightToggle" ${light ? 'checked' : ''} aria-label="Lighter workout today">` }))}
      <div class="btns"><button class="btn filled" id="go">${icon('play')}Start Workout</button><button class="btn plain" id="skipCheck">Skip check-in</button></div>`;
  };
  const mount = body => {
    body.querySelector('#lightToggle').onchange = e => { S.form.light = e.target.checked; };
    body.querySelectorAll('[data-sore-m]').forEach(b => b.onclick = () => { const m = b.dataset.soreM; S.form.sore = S.form.sore.includes(m) ? S.form.sore.filter(x => x !== m) : [...S.form.sore, m]; app.sheet(draw(), mount); });
    body.querySelector('#skipCheck').onclick = () => { app.closeSheet(); begin(routineId, null, false, [], []); };
    body.querySelector('#go').onclick = () => { const r = answered() ? filled() : null; app.closeSheet(); begin(routineId, r, S.form.light ?? (r ? readinessScore(r).label === 'Low' : false), S.form.sore, muscles); };
  };
  app.sheet(draw(), mount);
  app.onPick = () => app.sheet(draw(), mount);
}

// "Use the full plan" on an easier day: start without today's adjustments (they can be switched back on in the workout).
let START_ORIGINAL = false;
async function beginWorkout(routineId, readiness, light, sore = [], asked = []) {
  const original = START_ORIGINAL; START_ORIGINAL = false;
  const tp = taperFor(S.settings.tournament);
  // Before (and just after) a tournament every workout is the lighter version.
  if (tp?.lighter || tp?.noGym) { light = true; app.toast(tp.phase === 'recover' ? 'Easy session while you recover from the tournament' : 'Tournament week: lighter workout today'); }
  const { w, rec } = buildWorkout(routineId, { readiness, light: original ? false : light, sore });
  if (original) revertAdaptation(w);
  // Only explicit answers teach the model: a muscle you marked sore. (Not ticking one isn't the same as "feels fine".)
  if (sore.length) { for (const m of sore) S.recoveryCal = calibrate(S.recoveryCal, m, true, rec[m].level); app.save('recoveryCal'); }
  applySupersets(w, S.supersets[routineId]);
  applyPainHolds(w);
  S.active = w;
  await app.saveActive(true);
  db.requestPersistence();
  app.go('workout');
}

// ── Past workouts: log a gym session you forgot, on the day you did it.
export function pastWorkoutSheet(iso) {
  if (S.active) { app.closeSheet(); app.toast('Finish or discard the workout in progress first'); return app.go('workout'); }
  const d = parseISO(iso), planned = app.planOn(iso);
  const ids = [...new Set([...(isRoutine(planned) ? [planned] : []), ...allRoutineIds()])];
  app.sheet(`<h2 class="sheet-title">Which workout?</h2><p class="sheet-sub">${esc(d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}. You’ll fill in your sets next.</p>
    ${group(ids.map(id => { const r = app.routine(id), look = routineLook(id); return row({ title: esc(r.title), sub: `${r.blocks.length} exercise${r.blocks.length === 1 ? "" : "s"}${id === planned ? ' · planned that day' : ''}`, icon: look.icon, color: look.color, action: 'past-start', data: { id, iso } }); }).join('')
      + row({ title: 'Something else', sub: 'Pick the exercises you did', icon: 'bolt', color: 'indigo', action: 'past-start', data: { id: '', iso } }))}
    <button class="btn gray" data-action="close-sheet">Cancel</button>`);
}
export async function startPast(routineId, iso) {
  const d = parseISO(iso); d.setHours(18, 0, 0, 0);
  if (!routineId) { S.active = createQuickWorkout({ week: app.position().week, startedAt: d.getTime() }); app.closeSheet(); await app.saveActive(true); return app.go('workout'); }
  const w = createWorkout({ routineId, week: app.position().week, history: app.strength, overrides: S.overrides, unit: S.settings.unit, startedAt: d.getTime(), profile: app.location() ? { ...S.profile, owned: app.location().equipment } : S.profile });
  applySupersets(w, S.supersets[routineId]);
  S.active = w; app.closeSheet();
  await app.saveActive(true);
  app.go('workout');
}

// ── Activity (padel etc.) logging
// A new padel log starts as what you planned for that day, else as your last one (a weekly lesson stays a lesson).
const lastPadelType = (iso = isoDate()) => {
  const p = S.settings.padelPlan?.[iso]; if (p) return { ptype: p.type, focus: p.focus || 'mixed' };
  const l = S.sessions.find(s => s.activity === 'padel' && s.padel?.type); return { ptype: l?.padel.type || 'match', focus: l?.padel.focus || 'mixed' };
};
export function activitySheet(kind = 'padel', existing = null, date = null) {
  const pd = existing?.padel || {};
  S.form = existing ? { activity: existing.activity, duration: existing.durationMin, rpe: existing.rpe, date: isoDate(new Date(existing.startedAt)), notes: existing.notes,
    ptype: pd.type || 'match', focus: pd.focus || 'mixed', result: pd.result || 'none', score: pd.score || '', partner: pd.partner || '', side: pd.side || '', sore: [...(pd.sore || [])] }
    : { activity: kind, duration: defaultMinutes(kind, date || isoDate()), rpe: 7, date: date || isoDate(), notes: '', ...lastPadelType(date || isoDate()), result: 'none', score: '', partner: '', side: '', sore: [] };
  const f = () => S.form;
  const draw = () => {
    const padel = f().activity === 'padel', match = padel && ['match', 'americano'].includes(f().ptype);
    return `<h2 class="sheet-title">${existing ? 'Edit' : padel ? 'Log Padel' : 'Log Activity'}</h2>
    <div style="height:8px"></div>${seg('activity', ACTIVITIES, f().activity)}
    ${padel ? `<label class="field-l">Type</label>${chips('ptype', Object.keys(PADEL_TYPES), f().ptype, k => PADEL_TYPES[k])}` : ''}
    ${padel && hasFocus(f().ptype) ? `<label class="field-l">What did you work on?</label>${chips('focus', Object.keys(PADEL_FOCUS), f().focus, k => PADEL_FOCUS[k])}` : ''}
    ${match ? `<label class="field-l">Result</label>${seg('result', [['won', 'Won'], ['lost', 'Lost'], ['none', 'Skip']], f().result)}
      <div class="grid2"><input class="input" id="scoreIn" placeholder="Score (optional)" value="${esc(f().score)}" aria-label="Score"><input class="input" id="partnerIn" placeholder="Partner (optional)" value="${esc(f().partner)}" aria-label="Partner"></div>` : ''}
    ${padel && f().ptype !== 'machine' ? `<label class="field-l">Side you played</label>${seg('side', [['drive', 'Right'], ['reves', 'Left'], ['both', 'Both']], f().side)}` : ''}
    <label class="field-l">How long?</label>${chips('duration', [30, 45, 60, 90, 120], f().duration, v => `${v} min`)}
    <input class="input" id="durIn" type="number" inputmode="numeric" min="1" max="600" value="${esc(f().duration)}" aria-label="Minutes" style="margin-top:8px">
    <label class="field-l">How hard was it?</label>${sessionEffortChips('rpe', f().rpe)}
    ${padel ? `<label class="field-l">Anything sore afterwards?</label><div class="chipset">${Object.entries(AREAS).map(([k, v]) => `<button type="button" class="chip-btn ${f().sore.includes(k) ? 'warn-on' : ''}" data-sore="${k}" aria-pressed="${f().sore.includes(k)}">${esc(v)}</button>`).join('')}</div>` : ''}
    <label class="field-l" for="dateIn">Date</label><input class="input" id="dateIn" type="date" value="${esc(f().date)}" max="${isoDate()}">
    <label class="field-l" for="notesIn">Notes</label><textarea class="input" id="notesIn" rows="2" placeholder="Optional">${esc(f().notes)}</textarea>
    <div style="height:20px"></div><button class="btn filled" id="saveAct">${existing ? 'Save Changes' : 'Save'}</button>`;
  };
  const mount = body => {
    const bind = (id, key, ev = 'oninput') => { const el = body.querySelector(id); if (el) el[ev] = e => { f()[key] = e.target.value; }; };
    body.querySelector('#durIn').oninput = e => { f().duration = +e.target.value; };
    bind('#dateIn', 'date', 'onchange'); bind('#notesIn', 'notes'); bind('#scoreIn', 'score'); bind('#partnerIn', 'partner');
    body.querySelectorAll('[data-sore]').forEach(b => b.onclick = () => { const k = b.dataset.sore; f().sore = f().sore.includes(k) ? f().sore.filter(x => x !== k) : [...f().sore, k]; app.sheet(draw(), mount); });
    body.querySelector('#saveAct').onclick = async () => {
      const dur = +f().duration;
      if (!(dur > 0)) return app.toast('Add how many minutes');
      const d = parseISO(f().date || isoDate()), now = new Date();
      // Logged today = you just finished: it ended now and started `dur` minutes ago (not before midnight).
      if (isoDate(d) === isoDate(now)) d.setTime(Math.max(parseISO(isoDate(now)).getTime(), now.getTime() - dur * 60000));
      else d.setHours(12);
      const t = S.settings.tournament, event = t?.date && t.date === isoDate(d) ? t.name || 'Tournament' : existing?.padel?.event;
      const padel = f().activity === 'padel' ? { type: f().ptype, ...(hasFocus(f().ptype) ? { focus: f().focus } : {}), result: ['match', 'americano'].includes(f().ptype) ? f().result : 'none', score: f().score.trim(), partner: f().partner.trim(), side: f().ptype === 'machine' ? '' : f().side, sore: f().sore, ...(event ? { event } : {}) } : undefined;
      const titleFor = () => padel ? (padel.type === 'match' ? 'Padel match' : `Padel ${PADEL_TYPES[padel.type].toLowerCase()}`) : ACTIVITIES.find(a => a[0] === f().activity)[1];
      const base = existing ? { ...existing, activity: f().activity, durationMin: dur, rpe: +f().rpe, notes: f().notes, startedAt: d.getTime(), endedAt: d.getTime() + dur * 60000 }
        : createActivity({ activity: f().activity, startedAt: d.getTime(), durationMin: dur, rpe: +f().rpe, notes: f().notes });
      const rec = { ...base, title: titleFor(), padel };
      await db.putSession(rec); await app.reloadSessions(); app.closeSheet();
      const note = existing ? '' : soreNote(padel?.sore);
      app.toast(`${existing ? 'Saved' : `${rec.title} saved`}${note ? `. ${note}` : ''}`);
      app.render({ keepScroll: true });
    };
  };
  app.onPick = () => app.sheet(draw(), mount);
  app.sheet(draw(), mount);
}
