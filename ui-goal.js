// Goal blocks: pick a goal → set it up and preview the weeks → start. Plus the Plan card,
// the block sheet (phases, stop) and the Today banner. Logic lives in domain/block.js.
import { app, S } from './core-app.js';
import { esc, icon, tile, chev, navBar, group, row, seg, chips } from './ui-kit.js';
import { firstMonday, GOALS, WEEK_OPTIONS, JUMP_AREAS, BLOCK_PHASES, blockWeeks, tournamentPlan, makeBlock, phaseSpans, blockTitle, goalLabel } from './domain-block.js';
import { buildProgram } from './domain-builder.js';
import { allExercises } from './domain-catalog.js';
import { DAYS, isRoutine, legHeavyBlocks, isLegHeavy, setCustomRoutines, PHASES } from './domain-program.js';
import { bestWeek, AREAS } from './domain-personalize.js';
import { isoDate, mondayOf, parseISO, daysBetween, startForWeek } from './domain-calendar.js';
import { lands } from './domain-adaptive.js';
import { usualKinds, followUsualWeek } from './ui-week.js';

const fmtDay = iso => parseISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const weeksLabel = (a, b) => a === b ? `Week ${a}` : `Weeks ${a}–${b}`;
const gymDays = sched => DAYS.filter(d => isRoutine(sched[d]));

// ── Setup state while choosing (null when not on the goal screen).
let G = null;
const fresh = goal => {
  const t = S.settings.tournament, future = t?.date && t.date >= isoDate();
  return { goal, weeks: 6, date: goal === 'tournament' && future ? t.date : '', name: goal === 'tournament' && future ? t.name || '' : '',
    area: goal === 'injury' ? (S.profile.injuries || [])[0] || 'knee' : null, mode: GOALS[goal].current && gymDays(S.schedule).length ? 'current' : 'new' };
};

// Weeks and start for the current setup; { error } when it can't start.
function timing() {
  if (G.goal !== 'tournament') return { start: isoDate(firstMonday()), weeks: G.weeks };
  if (!G.date) return { error: 'Pick the tournament date.' };
  const tp = tournamentPlan(G.date);
  if (tp.too === 'past') return { error: 'That date has passed.' };
  if (tp.too === 'close') return { error: 'Under 4 weeks away: too close for a full block. Add it under Overview → Goals instead; the last week before it gets lighter on its own.' };
  return tp;
}

// New workouts for the goal: the program builder with the goal's focus, as many as your gym
// days. Back from injury in a knee, ankle, calf or back leaves out jumps altogether.
let built = null;
function newSessions() {
  const key = `${G.goal}|${G.area}|${S.activeLocation}`;
  if (built?.key === key) return built.sessions;
  const days = Math.min(4, Math.max(2, gymDays(S.schedule).length || S.profile.days || 3));
  const loc = app.location(), injuries = [...new Set([...(S.profile.injuries || []), ...(G.area ? [G.area] : [])])];
  const noJumps = G.goal === 'injury' && JUMP_AREAS.includes(G.area);
  const pool = noJumps ? allExercises().filter(e => !lands(e) && e.movement !== 'power' && e.pattern !== 'power') : undefined;
  const p = buildProgram({ focuses: GOALS[G.goal].focuses, days, minutes: S.profile.minutes || 70, level: S.profile.level, injuries, owned: loc ? new Set(loc.equipment) : null }, pool);
  built = { key, sessions: p.sessions.filter(s => s.blocks.length) };
  return built.sessions;
}

// Your week with the new workouts: padel stays where it is, the workouts go on the best free days.
function placeNew(ids, legs) {
  const padel = DAYS.filter(d => S.schedule[d] === 'Padel');
  const w = bestWeek(ids, padel, legs, S.settings.padelLevel || {}, S.profile.trainDays, usualKinds());
  const sched = Object.fromEntries(DAYS.map(d => [d, S.schedule[d] === 'Padel' ? 'Padel' : 'Rest']));
  w.days.forEach((d, i) => { sched[d] = w.ids[i]; });
  const rest = DAYS.filter(d => sched[d] === 'Rest');
  if (DAYS.some(d => S.schedule[d] === 'Recovery') && rest.length > 1) sched[rest[Math.floor(rest.length / 2)]] = 'Recovery';
  return sched;
}

// One-week phases in a long block get a narrow column on a phone.
const SHORT = { sharpen: 'Sharp', lighter: 'Light', strength: 'Str.', control: 'Ctrl', maintain: 'Keep' };
function phaseBar(plan, week = 0) {
  const spans = phaseSpans(plan);
  return `<div class="blk-bar" style="grid-template-columns:repeat(${plan.length},1fr)">${plan.map((id, i) => `<b class="ph-${id} ${i + 1 === week ? 'on' : i + 1 < week ? 'past' : ''}"></b>`).join('')}
    ${spans.map(s => `<small style="grid-column:span ${s.to - s.from + 1}">${esc(s.from === s.to && plan.length >= 7 ? SHORT[s.id] || s.name : s.name)}</small>`).join('')}</div>`;
}
const phaseRows = (plan, week = 0) => phaseSpans(plan).map(s => row({ title: `${weeksLabel(s.from, s.to)} · ${esc(s.name)}`, sub: esc(BLOCK_PHASES[s.id].note), chevron: false,
  right: week >= s.from && week <= s.to ? icon('check', 'check-mark') : '' })).join('');

function pickView() {
  const b = S.settings.block, pos = app.blockPos();
  return `${navBar({ back: 'Plan', backTo: 'plan', title: 'Start a Goal' })}<div style="height:12px"></div>
    ${group(Object.entries(GOALS).map(([id, g]) => row({ title: esc(g.label), sub: esc(g.sub), icon: id === 'tournament' ? 'trophy' : id === 'faster' ? 'bolt' : id === 'legs' ? 'legs' : id === 'shoulders' ? 'dumbbell' : id === 'injury' ? 'heart' : 'racket',
      color: id === 'injury' ? 'pink' : id === 'tournament' ? 'teal' : 'blue', action: 'goal-pick', data: { goal: id } })).join(''),
      { header: 'What are you training for?', footer: `A 4 to 8 week plan in phases. Your workouts stay the same all block, so your weights keep climbing; reps, sets and rest change with each phase.${b && pos?.state !== 'done' ? ` Starting a new goal ends ${esc(blockTitle(b))}.` : ''}` })}`;
}

function setupView() {
  const g = GOALS[G.goal], t = timing(), plan = t.error ? [] : blockWeeks(G.goal, t.weeks);
  const setup = G.goal === 'tournament'
    ? group(`<label class="row"><span class="row-main"><input class="input" id="gName" value="${esc(G.name)}" placeholder="Name, e.g. Club Open" maxlength="40" style="padding:0;background:none;min-height:22px" aria-label="Tournament name"></span></label>`
      + row({ title: 'Date', chevron: false, right: `<input class="input" id="gDate" type="date" min="${isoDate()}" value="${esc(G.date)}" style="width:150px;text-align:right;background:none;padding:0" aria-label="Tournament date">` }),
      { header: 'Tournament', footer: t.error ? `<span class="orange">${esc(t.error)}</span>` : `${t.weeks} weeks, ending the week of the tournament${t.start > isoDate() ? `. Starts ${esc(fmtDay(t.start))}; your current plan runs until then` : ''}.` })
    : `<div class="grp"><h2 class="grp-h">How long</h2>${seg('g-weeks', WEEK_OPTIONS.map(w => [w, `${w} weeks`]), G.weeks)}<p class="grp-f">${t.start > isoDate() ? `Starts ${esc(fmtDay(t.start))}, the start of next week.` : 'Starts this week.'}</p></div>`;
  const area = G.goal === 'injury' ? `<div class="grp"><h2 class="grp-h">Which area?</h2>${chips('g-area', Object.keys(AREAS), G.area, a => AREAS[a])}
    <p class="grp-f">${JUMP_AREAS.includes(G.area) ? 'No jumps in this block. ' : ''}If you log pain there, the plan stays a phase back until it settles. This guides your training; it doesn’t replace a physio.</p></div>` : '';
  const cur = gymDays(S.schedule);
  const mode = `<div class="grp"><h2 class="grp-h">Workouts</h2>${seg('g-mode', [['current', 'Your current ones'], ['new', 'New for this goal']], G.mode)}</div>`;
  let list;
  if (G.mode === 'current') {
    list = cur.length ? group(cur.map(d => row({ title: esc(app.routine(S.schedule[d]).title), value: d, chevron: false })).join(''), { footer: g.current ? 'These suit this goal. Your week stays as it is.' : 'Your current workouts don’t focus on this goal; new ones would suit it better.' })
      : group(row({ title: 'No gym days in your week', sub: 'Choose “New for this goal”, or add gym days on Plan.', chevron: false }));
  } else {
    const ss = newSessions();
    const sched = placeNew(ss.map((_, i) => i), i => legHeavyBlocks(ss[i].blocks));
    list = ss.length ? group(DAYS.filter(d => typeof sched[d] === 'number').map(d => { const s = ss[sched[d]];
      return row({ title: esc(s.title), sub: `${s.blocks.length} exercises · about ${s.minutes} min`, value: d, chevron: false }); }).join(''),
      { footer: 'Built for this goal from your equipment, time and level. Padel stays on its days. Your current workouts are kept.' })
      : group(row({ title: 'Couldn’t build workouts', sub: 'Check your equipment under Your setup.', chevron: false }));
  }
  const preview = plan.length ? `<div class="grp"><h2 class="grp-h">The weeks</h2><div class="card">${phaseBar(plan)}</div></div>${group(phaseRows(plan))}` : '';
  return `${navBar({ back: 'Goals', backAction: 'goal-back', title: g.label })}<div style="height:12px"></div>
    ${setup}${area}${preview}${mode}${list}
    <div class="btns" style="margin:8px 0 24px"><button class="btn filled" data-action="goal-start">Start Block</button></div>
    <p class="grp-f" style="margin:-12px 4px 32px">Your current week plan is saved. You can stop the block and switch back any time.</p>`;
}

export const goalView = () => G?.goal ? setupView() : pickView();

export function goalMounted() {
  const n = document.querySelector('#gName'), d = document.querySelector('#gDate');
  if (n) n.oninput = () => { G.name = n.value; };
  if (d) d.onchange = () => { G.date = d.value; app.render({ keepScroll: true }); };
}

export function goalPick(name, value) {
  if (!G) return false;
  if (name === 'g-weeks') G.weeks = +value;
  else if (name === 'g-area') G.area = value;
  else if (name === 'g-mode') G.mode = value;
  else return false;
  app.render({ keepScroll: true });
  return true;
}

async function startBlock() {
  const t = timing();
  if (t.error) return app.toast(t.error);
  const old = S.settings.block;
  // Switching back always returns to the plan from before your first block.
  const prev = old?.prev || { schedule: { ...S.schedule } };
  let routines = [];
  if (G.mode === 'new') {
    const ss = newSessions();
    if (!ss.length) return app.toast('Couldn’t build workouts for this goal');
    const suffix = Date.now().toString(36);
    const label = GOALS[G.goal].label;
    // The builder's A/B/C letters would read out of order on your week; keep them only to tell twins apart.
    const plain = ss.map(s => s.title.replace(/^[A-D] · /, ''));
    ss.forEach((s, i) => {
      const id = `g-${suffix}${i}`;
      S.customRoutines[id] = { id, title: plain.filter(t => t === plain[i]).length > 1 ? s.title : plain[i], custom: true, program: label, minutes: s.minutes, focus: `Built for ${label.toLowerCase()}.`,
        blocks: s.blocks.map(({ why, ...b }, k) => ({ ...b, pri: k + 1 })) };
      routines.push(id);
    });
    setCustomRoutines(S.customRoutines);
    await app.save('customRoutines');
  } else if (!gymDays(S.schedule).length) return app.toast('Add gym days first, or choose new workouts');
  if (G.goal === 'tournament') S.settings.tournament = { name: G.name.trim() || 'Tournament', date: G.date };
  const b = makeBlock({ goal: G.goal, weeks: t.weeks, start: t.start, date: G.date || null, name: G.name, area: G.area, mode: G.mode, routines, prev });
  // New workouts go on your week when the block starts (now, or on its first Monday).
  if (routines.length) b.pending = placeNew(routines, isLegHeavy);
  S.settings.block = b;
  await startPendingBlock();
  await app.save('settings');
  G = null; built = null;
  const pos = app.blockPos();
  app.go('plan');
  app.toast(pos?.state === 'upcoming' ? `${goalLabel(b)} starts ${fmtDay(b.start)}` : `${goalLabel(b)} started · week 1: ${pos.phase.name}`);
}

// ── Plan: the block in place of the 4-week cycle card.
export function blockHero(pos) {
  const b = S.settings.block;
  return `<button class="card hero" data-action="block-sheet" style="display:block;width:100%;text-align:left">
    <p class="t-foot">${esc(blockTitle(b))}</p><h2>Week ${pos.week} of ${pos.weeks}: ${esc(pos.phase.name)}</h2>
    <p class="t-sub">${pos.held ? `Staying in ${esc(pos.phase.name)} while your ${esc(AREAS[b.area].toLowerCase())} settles. ` : ''}${esc(pos.phase.note)}</p>
    ${phaseBar(pos.plan, pos.week)}</button>`;
}
// Plan: a block that hasn't started yet, or one that just finished.
export function blockCard() {
  const b = S.settings.block, pos = app.blockPos();
  if (!b || pos?.state === 'active') return '';
  if (pos.state === 'upcoming') return group(row({ title: esc(blockTitle(b)), sub: `Starts ${esc(fmtDay(b.start))} · ${b.weeks} weeks${b.pending ? ' · new workouts on your week from then' : ''}`, icon: 'trophy', color: 'teal', action: 'block-sheet' }), { header: 'Goal' });
  return `<section class="card week-tip"><div class="hero-top" style="margin-bottom:10px">${tile('trophy', 'teal')}<div><b>${esc(blockTitle(b))} finished</b><p class="t-sub">${b.weeks} weeks done. What’s next?</p></div></div>
    <div class="btns"><button class="btn filled" data-action="goal-new">Start Another Goal</button>
    ${b.mode === 'new' && b.prev?.schedule ? '<button class="btn tinted" data-action="block-revert">Back to My Previous Week</button>' : ''}
    <button class="btn plain" data-action="block-end">Keep This Week</button></div></section>`;
}

// Today: where you are in the block (the tournament banner covers the last two weeks before one).
export function blockBanner(tournamentShown) {
  const b = S.settings.block, pos = app.blockPos();
  if (!pos) return '';
  if (pos.state === 'done') return pos.endedDays < 14 ? `<button class="banner" data-action="go" data-to="plan">${tile('trophy', 'teal')}<span><b>${esc(blockTitle(b))} finished</b><small>Pick what’s next on Plan.</small></span>${chev}</button>` : '';
  // The phase itself sits on Today's card; a heads-up only when it changes (or pain holds you back).
  if (pos.state !== 'active' || (b.goal === 'tournament' && tournamentShown) || (!pos.newPhase && !pos.held)) return '';
  const why = pos.held ? `Staying in ${pos.phase.name} while your ${AREAS[b.area].toLowerCase()} settles.` : `${pos.newPhase ? 'New phase. ' : ''}${pos.phase.note}`;
  return `<button class="banner" data-action="go" data-to="plan">${tile(b.goal === 'tournament' ? 'trophy' : 'target', 'teal')}<span><b>${esc(goalLabel(b))} · week ${pos.week} of ${pos.weeks} · ${esc(pos.phase.name)}</b><small>${esc(why)}</small></span>${chev}</button>`;
}

// The block has started and its new week is still waiting: put it on your schedule. True when it did.
export async function startPendingBlock() {
  const b = S.settings.block;
  if (!b?.pending || app.blockPos()?.state === 'upcoming') return false;
  if (app.blockPos()?.state === 'active') { S.schedule = b.pending; await app.save('schedule'); followUsualWeek(); }
  delete b.pending;
  await app.save('settings');
  return true;
}

// Ending a block: the 4-week cycle starts again at week 1 (or right after a finished block).
async function endBlock(revert) {
  const b = S.settings.block, pos = app.blockPos();
  if (revert && b?.prev?.schedule) {
    S.schedule = Object.fromEntries(DAYS.map(d => { const v = b.prev.schedule[d]; return [d, ['Padel', 'Recovery', 'Rest'].includes(v) || isRoutine(v) ? v : 'Rest']; }));
    await app.save('schedule'); followUsualWeek();
  }
  S.settings.programStart = pos?.state === 'done' ? pos.nextStart : isoDate(mondayOf());
  delete S.settings.block;
  await app.save('settings');
  app.closeSheet(); app.render({ keepScroll: true });
  app.toast(revert ? 'Your previous week is back' : 'Block ended. Your 4-week cycle starts at week 1.');
}

// The 4-week cycle (no goal running): which week you're in, changeable after time off.
export const goalActions = {
  'week-sheet'() {
    const pos = app.position();
    app.sheet(`<h2 class="sheet-title">Which week are you in?</h2><p class="sheet-sub">Change this if you missed time, for example after illness or travel.</p>
      ${group(PHASES.map(p => row({ title: `Week ${p.week}: ${esc(p.name)}`, sub: esc(p.note), action: 'set-week', data: { w: p.week }, chevron: false, right: p.week === pos.week ? icon('check', 'check-mark') : '' })).join(''))}`);
  },
  async 'set-week'(el) {
    S.settings.programStart = startForWeek(+el.dataset.w, S.settings.programStart);
    await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast(`Now in week ${el.dataset.w}`);
  },
  'how-sheet'() {
    app.sheet(`<h2 class="sheet-title">How your plan adapts</h2><div style="height:12px"></div>
      ${group(row({ title: 'Getting stronger', sub: 'Each exercise has a target range, like 8–10 reps. When you reach the top on every set, the app suggests a little more weight next time.' })
        + row({ title: 'Bad days', sub: 'Miss the bottom of the range twice and it suggests a bit less, so you can rebuild.' })
        + row({ title: '4-week cycles', sub: 'Three weeks build up, then a lighter recovery week with fewer sets. A goal block replaces this with its own phases.' })
        + row({ title: 'Around your padel', sub: 'Leg work stays away from hard matches, busy padel weeks drop to two gym sessions, and each day adjusts to how you feel and recover.' })
        + row({ title: 'Your setup', sub: 'Exercises are swapped to match your equipment and the time you have.' })
        + row({ title: 'Warm-up', sub: 'Before your first heavy exercise, do 5 minutes of easy movement and 2–3 lighter practice sets.' }))}`);
  },
  'goal-new'() { G = null; built = null; app.go('plan/goal'); },
  'goal-pick'(el) { G = fresh(el.dataset.goal); built = null; app.render(); },
  'goal-back'() { G = null; app.render(); },
  'goal-start'() { startBlock(); },
  'block-sheet'() {
    const b = S.settings.block, pos = app.blockPos();
    if (!b) return;
    const plan = blockWeeks(b.goal, b.weeks), active = pos.state === 'active';
    app.sheet(`<h2 class="sheet-title">${esc(blockTitle(b))}</h2><p class="sheet-sub">${active ? `Week ${pos.week} of ${pos.weeks}` : pos.state === 'upcoming' ? `Starts ${esc(fmtDay(b.start))}` : 'Finished'}${b.date ? ` · tournament ${esc(fmtDay(b.date))}` : ''}${b.goal === 'injury' && b.area ? ` · ${esc(AREAS[b.area])}` : ''}</p>
      <div class="card" style="margin-bottom:16px">${phaseBar(plan, active ? pos.week : 0)}</div>
      ${group(phaseRows(plan, active ? pos.week : 0), { footer: 'Reps, sets and rest change with each phase; the exercises stay the same. Check-ins, recovery and match days still adjust each workout.' })}
      <div class="btns"><button class="btn destructive" data-action="block-stop">${pos.state === 'upcoming' ? 'Cancel This Block' : 'Stop This Block'}</button><button class="btn plain" data-action="close-sheet">Close</button></div>`);
  },
  'block-stop'() {
    const b = S.settings.block;
    if (!b) return;
    const back = b.mode === 'new' && b.prev?.schedule;
    app.sheet(`<h2 class="sheet-title">Stop ${esc(goalLabel(b))}?</h2><p class="sheet-sub">Your history stays.${back ? ' The workouts made for this goal stay in your list.' : ''} Your 4-week cycle starts again at week 1.</p>
      <div class="btns">${back ? '<button class="btn filled" data-action="block-revert">Stop and Bring Back My Previous Week</button><button class="btn tinted" data-action="block-end">Stop, Keep This Week</button>' : '<button class="btn destructive" data-action="block-end">Stop Block</button>'}
      <button class="btn plain" data-action="close-sheet">Cancel</button></div>`);
  },
  'block-end'() { endBlock(false); },
  'block-revert'() { endBlock(true); },
};
// The tournament changed on Overview: a tournament block moves with it (or ends if it's now too close).
export function retimeTournamentBlock() {
  const b = S.settings.block, t = S.settings.tournament;
  if (b?.goal !== 'tournament' || !t?.date || t.date === b.date || app.blockPos()?.state === 'done') return null;
  // Already under way: keep the start and end on the new week when that still fits; otherwise re-plan.
  const span = Math.floor(daysBetween(mondayOf(parseISO(b.start)), mondayOf(parseISO(t.date))) / 7) + 1;
  const started = b.start <= isoDate(mondayOf());
  const tp = started && span >= 1 && span <= 8 ? { start: b.start, weeks: span } : tournamentPlan(t.date);
  if (!tp.start) return 'close';
  S.settings.block = { ...b, date: t.date, name: t.name || b.name, start: tp.start, weeks: tp.weeks };
  return 'moved';
}
export const resetGoal = () => { G = null; built = null; };
// Straight to one goal's setup (from the end of first-run setup).
export function openGoal(goal) { if (!GOALS[goal]) return; G = fresh(goal); built = null; app.go('plan/goal'); }
