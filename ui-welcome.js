// First-run onboarding (also reachable from Settings to change the plan).
// One question per screen, answered by tapping a row, like iOS setup.
import { app, S } from './core-app.js';
import { esc, icon, group, row, routineLook, seg, chips } from './ui-kit.js';
import { DAYS, ROUTINES, resolveRoutine, isLegHeavy } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { EQUIPMENT, MINUTES, AREAS, generateSchedule } from './domain-personalize.js';
import { PRESET_GEAR, EQUIPMENT_GROUPS, EQUIPMENT as GEAR } from './domain-taxonomy.js';
import { GOALS as BLOCK_GOALS } from './domain-block.js';
import { PADEL_TYPES, PADEL_FOCUS, hasFocus } from './domain-padel.js';
import { MATCH_LEVELS } from './domain-matchlevel.js';
import { openGoal } from './ui-goal.js';
import { usualKinds, followUsualWeek } from './ui-week.js';
import { busyWeek, ANCHOR_ID } from './domain-busy.js';

let step = 0;
const STEPS = 8;   // questions 1–7, then your plan
const F = () => S.form;
const DAY_LONG = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const listDays = ds => ds.length > 1 ? `${ds.slice(0, -1).join(', ')} and ${ds[ds.length - 1]}` : ds[0] || '';

const pick = (name, value, title, sub = '') => row({ title: esc(title), sub: esc(sub), action: 'w-pick', data: { name, value }, chevron: false, right: F()[name] === value ? icon('check', 'check-mark') : '' });
const multi = (name, value, title) => row({ title: esc(title), action: 'w-toggle', data: { name, value }, chevron: false, right: F()[name].includes(value) ? icon('check', 'check-mark') : '' });
const q = (title, sub = '') => `<div class="wiz-q"><h1>${esc(title)}</h1>${sub ? `<p class="t-sub">${esc(sub)}</p>` : ''}</div>`;
// Gym days left once padel days are taken out (padel and gym on the same day isn't planned).
const gymRoom = f => f.trainDays.filter(d => !f.padelDays.includes(d)).length;
const levels = f => Object.fromEntries(f.padelDays.map(d => [d, f.padelLevel]));
const usualOf = f => Object.fromEntries(f.padelDays.map(d => [d, { type: f.padelType, ...(hasFocus(f.padelType) ? { focus: f.padelFocus } : {}) }]));
// Fixed padel days that make every week busy: the usual week gets Strength plus Upper Body, and a rest day.
const usualBusy = f => busyWeek(f.padelDays.map(() => ({ type: f.padelType, focus: f.padelFocus }))).busy;
const schedFor = f => usualBusy(f) ? generateSchedule(2, f.padelDays, [ANCHOR_ID, 'B'], id => id === ANCHOR_ID || isLegHeavy(id), f.trainDays, levels(f), usualKinds(usualOf(f)))
  : generateSchedule(f.days, f.padelDays, null, isLegHeavy, f.trainDays, levels(f), usualKinds(usualOf(f)));

function body() {
  const f = F();
  switch (step) {
    case 0: return `<div class="welcome"><img class="app-icon" src="icon-180.png" alt="" width="92" height="92"><h1>Welcome to<br>PADEL OS</h1>
      <div class="features">
        <div class="feature">${icon('dumbbell')}<div><b>A plan that fits you</b><span>Workouts for your equipment and your schedule, and they get harder as you get stronger.</span></div></div>
        <div class="feature">${icon('flame')}<div><b>Ready for match day</b><span>Guided warm-ups and cool-downs you can follow on court.</span></div></div>
        <div class="feature">${icon('heart')}<div><b>Stay injury-free</b><span>Short routines for elbows, shoulders, knees and calves.</span></div></div>
      </div></div>`;
    case 1: return `${q('What are you training for?', 'You can change this any time on Plan.')}${group(pick('goalBlock', 'none', 'Just train well', 'Your workouts, adjusted day by day around padel')
      + Object.entries(BLOCK_GOALS).map(([k, g]) => pick('goalBlock', k, g.label, g.sub)).join(''), { footer: 'A goal is a 4 to 8 week plan in phases. You’ll see its weeks before it starts.' })}`;
    case 2: return `${q('How much have you lifted weights before?')}${group([['beginner', 'Never or rarely', 'We’ll start gently'], ['intermediate', 'Now and then', 'A few times a month'], ['advanced', 'Regularly', 'Most weeks']].map(([k, t, s]) => pick('level', k, t, s)).join(''))}`;
    case 3: {
      const gear = new Set(f.gear);
      const list = f._gearOpen ? EQUIPMENT_GROUPS.map(([title, ids]) => `<label class="field-l">${esc(title)}</label><div class="chipset">${ids.map(e => `<button type="button" class="chip-btn ${gear.has(e) ? 'on' : ''}" data-action="w-gear" data-gear="${e}" aria-pressed="${gear.has(e)}">${esc(GEAR[e])}</button>`).join('')}</div>`).join('') : '';
      return `${q('Where will you work out?')}${group(pick('equipment', 'gym', EQUIPMENT.gym, 'Machines, cables and barbells') + pick('equipment', 'db', EQUIPMENT.db, 'A pair of dumbbells and a bench or chair') + pick('equipment', 'bw', EQUIPMENT.bw, 'Just your body (a resistance band helps if you have one)'))}
        ${group(row({ title: 'What’s there', sub: `${f.gear.length} item${f.gear.length === 1 ? '' : 's'} · workouts only use what you have`, action: 'w-gear-open', chevron: false, right: `<span class="t-foot">${f._gearOpen ? 'Done' : 'Check'}</span>` }), { header: 'Equipment' })}
        ${list ? `<div style="margin:-8px 4px 24px">${list}</div>` : ''}`;
    }
    case 4: return `${q('How much time do you have?')}${group(MINUTES.map(m => pick('minutes', m, `${m} minutes`, m === 20 ? 'Just the essentials' : m === 40 ? 'A balanced workout' : 'The complete workout')).join(''), { header: 'Each workout' })}
      ${group([1, 2, 3].map(d => pick('days', d, `${d} ${d === 1 ? 'day' : 'days'} a week`, d === 1 ? 'Keep what you have' : d === 2 ? 'Steady progress' : 'Best results')).join(''), { header: 'Workouts per week' })}`;
    case 5: return `${q('Which days can you train?', 'Days you could get to the gym. Workouts only go on these.')}${group(DAYS.map(d => multi('trainDays', d, DAY_LONG[d])).join(''), { footer: f.trainDays.length < f.days ? `<span class="orange">Pick at least ${f.days} days for ${f.days} workouts.</span>` : '' })}`;
    case 6: {
      const room = gymRoom(f);
      return `${q('How do you play padel?', 'Workouts stay away from hard padel. You can add or change sessions for any week on Plan.')}
        <div class="grp"><h2 class="grp-h">Sessions in a usual week</h2>${seg('padelPerWeek', [[0, 'None'], [1, '1'], [2, '2'], [3, '3'], [4, '4+']], f.padelPerWeek)}</div>
        ${f.padelPerWeek ? `${group(DAYS.map(d => multi('padelDays', d, DAY_LONG[d])).join(''), { header: 'Days that are usually fixed (optional)', footer: room < f.days ? `<span class="orange">That leaves ${room} gym day${room === 1 ? '' : 's'} for ${f.days} workouts.</span>` : 'Leave these empty if your games change week to week; you’ll add them on Plan.' })}
        <div class="grp"><h2 class="grp-h">Usually</h2>${chips('padelType', Object.keys(PADEL_TYPES), f.padelType, k => PADEL_TYPES[k])}
        ${hasFocus(f.padelType) ? `<div style="height:10px"></div>${chips('padelFocus', Object.keys(PADEL_FOCUS), f.padelFocus, k => PADEL_FOCUS[k])}` : ''}
        <div style="height:12px"></div>${seg('padelLevel', Object.entries(MATCH_LEVELS), f.padelLevel)}</div>` : ''}`;
    }
    case 7: return `${q('Anything that bothers you?', 'Optional. Workouts go easier on these areas and we’ll suggest short routines.')}${group(Object.entries(AREAS).map(([k, v]) => multi('injuries', k, v)).join(''), { footer: 'This isn’t medical advice.' })}`;
    case 8: {
      const sched = schedFor(f);
      const ids = [...new Set(Object.values(sched).filter(v => ROUTINES[v] || v === ANCHOR_ID))], room = gymRoom(f), busy = usualBusy(f);
      const padelLine = !f.padelPerWeek ? 'No padel planned' : f.padelDays.length ? `${listDays(f.padelDays.map(d => DAY_LONG[d]))} · usually ${PADEL_TYPES[f.padelType].toLowerCase()}, ${MATCH_LEVELS[f.padelLevel].toLowerCase()}`
        : `${f.padelPerWeek}${f.padelPerWeek === 4 ? '+' : ''} a week on changing days · add them each week on Plan`;
      return `${q('Your plan is ready', 'You can change any of this later.')}
        <div class="plan-week" style="margin-bottom:8px">${DAYS.map(d => `<div>${d[0]}<b>${ROUTINES[sched[d]] || sched[d] === ANCHOR_ID ? '●' : sched[d] === 'Padel' ? '<span style="color:var(--teal)">●</span>' : sched[d] === 'Recovery' ? '<span style="color:var(--pink)">●</span>' : '–'}</b></div>`).join('')}</div>
        <p class="t-foot" style="text-align:center;margin-bottom:24px">● Workout &nbsp; <span style="color:var(--teal)">●</span> Padel &nbsp; <span style="color:var(--pink)">●</span> Recovery &nbsp; – Rest</p>
        ${busy ? `<p class="t-sub" style="padding:0 4px 16px">With ${f.padelDays.length} padel days, every week is a busy one: 2 shorter gym sessions and a full rest day keep you fresh for your matches.</p>` : ''}
        ${group(ids.map(id => { const r = resolveRoutine(id, {}, { ...f, owned: f.gear }), look = routineLook(id);
          return row({ title: esc(r.title), sub: `${r.blocks.length} exercise${r.blocks.length === 1 ? "" : "s"} · about ${r.minutes} min · ${DAYS.filter(d => sched[d] === id).map(d => DAY_LONG[d]).join(', ')}`, icon: look.icon, color: look.color }); }).join(''),
 { header: 'Your workouts', footer: !busy && ids.length < f.days ? `<span class="orange">Only ${room} gym day${room === 1 ? '' : 's'} free, so ${ids.length} workout${ids.length === 1 ? '' : 's'} a week. Add training days to fit more.</span>` : '' })}
        ${group(row({ title: 'Padel', sub: esc(padelLine), icon: 'racket', color: 'teal' }) + (f.goalBlock !== 'none' ? row({ title: `Next: ${esc(BLOCK_GOALS[f.goalBlock].label)}`, sub: 'You’ll see the weeks and start it on the next screen', icon: 'target', color: 'teal' }) : ''))}
        ${group(row({ title: 'Simple mode', sub: 'Plain words instead of training terms', right: `<input type="checkbox" class="switch" id="wSimple" ${f.simple ? 'checked' : ''} aria-label="Simple mode">` })
          + (S.profile.onboarded ? row({ title: 'Update my weekly schedule', right: '<input type="checkbox" class="switch" id="wSched" checked aria-label="Update my weekly schedule">' }) : ''))}`;
    }
  }
  return '';
}

// Setup answers start from what you have now (or sensible first-time defaults).
function startForm() {
  const p = structuredClone(S.profile), first = !p.onboarded;
  const place = S.locations.find(l => l.id === (p.equipment === 'gym' ? 'gym' : 'home')) || app.location();
  return { _wizard: true, ...p, ...(first ? { minutes: 40, days: 2 } : {}),
    goalBlock: p.goalBlock || (S.settings.block?.goal && app.blockPos()?.state !== 'done' ? S.settings.block.goal : 'none'),
    trainDays: p.trainDays?.length ? p.trainDays : [...DAYS],
    gear: first || !place ? [...PRESET_GEAR[p.equipment || 'gym']] : [...place.equipment],
    padelPerWeek: p.padelPerWeek ?? Math.min(4, (p.padelDays || []).length), padelType: p.padelType || 'match', padelFocus: p.padelFocus || 'mixed', padelLevel: p.padelLevel || 'normal' };
}

export const welcome = {
  render() {
    // First time: start from a middle-of-the-road week (40 min, twice) rather than the longest option.
    if (!S.form || S.form._wizard !== true) { S.form = startForm(); step = S.profile.onboarded ? 1 : 0; }
    const left = step > (S.profile.onboarded ? 1 : 0) ? `<button class="nav-btn" data-action="w-back">${icon('chevL')}Back</button>` : S.profile.onboarded ? '<button class="nav-btn" data-action="w-cancel">Cancel</button>' : '<span></span>';
    return `<div class="wiz-top">${left}<div class="dots">${step ? Array.from({ length: STEPS }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('') : ''}</div><span></span></div>
      ${body()}
      <div class="wiz-bottom"><div class="inner"><button class="btn filled" data-action="w-next">${step === 0 ? 'Get Started' : step === STEPS ? 'Start Training' : 'Continue'}</button>
      ${step === 0 ? '<button class="btn plain" data-action="w-skip">Skip for now</button>' : ''}</div></div>`;
  },
  // Chips and segments (padel answers) set S.form themselves; just redraw.
  onPick() { app.render({ keepScroll: true }); },
  actions: {
    'w-pick'(el) {
      const v = el.dataset.value, name = el.dataset.name;
      // A different kind of place starts from that place's usual kit.
      if (name === 'equipment' && v !== F().equipment) F().gear = [...PRESET_GEAR[v]];
      F()[name] = isNaN(v) ? v : Number(v); app.render({ keepScroll: true });
    },
    'w-gear-open'() { F()._gearOpen = !F()._gearOpen; app.render({ keepScroll: true }); },
    'w-gear'(el) { const g = el.dataset.gear, f = F(); f.gear = f.gear.includes(g) ? f.gear.filter(x => x !== g) : [...f.gear, g]; app.render({ keepScroll: true }); },
    'w-toggle'(el) { const arr = F()[el.dataset.name], v = el.dataset.value; F()[el.dataset.name] = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; app.render({ keepScroll: true }); },
    'w-back'() { step = Math.max(0, step - 1); app.render(); },
    'w-cancel'() { S.form = {}; app.go('settings'); },
    async 'w-skip'() { S.profile = { ...S.profile, onboarded: true, simple: true }; await app.save('profile'); S.form = {}; app.go('today'); },
    async 'w-next'() {
      const f = F();
      if (step === 5 && f.trainDays.length < f.days) return app.toast(`Pick at least ${f.days} days`);
      if (step < STEPS) { step++; return app.render(); }
      const replace = document.querySelector('#wSched') ? document.querySelector('#wSched').checked : true;
      const { _wizard, _gearOpen, gear, ...answers } = f, firstTime = !S.profile.onboarded;
      if (!answers.padelPerWeek) answers.padelDays = [];
      const goalChanged = answers.goalBlock !== (S.profile.goalBlock || 'none');
      S.profile = { ...answers, simple: document.querySelector('#wSimple').checked, onboarded: true };
      await app.save('profile');
      // The equipment answers set up where you train; edit them any time in Settings → Locations.
      const home = S.locations.find(l => l.id === 'home'), gym = S.locations.find(l => l.id === 'gym');
      const place = answers.equipment === 'gym' ? gym : home;
      if (place) place.equipment = [...gear];
      S.activeLocation = place?.id || S.activeLocation;
      // First setup: keep only the place you said you train (the starter pair is untouched). Add more in Settings → Locations.
      if (firstTime && S.locations.length === 2 && home && gym) S.locations = S.locations.filter(l => l.id === S.activeLocation);
      await app.save('locations'); await app.save('activeLocation');
      // Your usual padel: how hard and what kind, per fixed day (one-off dates are set on Plan).
      S.settings.padelLevel = { ...(S.settings.padelLevel || {}), ...levels(answers) };
      S.settings.padelUsual = usualOf(answers);
      await app.save('settings');
      if (replace) { S.schedule = schedFor(answers); await app.save('schedule'); followUsualWeek(); await app.save('settings'); }
      S.form = {};
      // A goal you picked (or changed): its setup screen shows the weeks before it starts.
      if (answers.goalBlock !== 'none' && (firstTime || goalChanged)) { openGoal(answers.goalBlock); return app.toast('Your plan is ready. Now check your goal’s weeks.'); }
      app.go('today');
      app.toast('Your plan is ready');
    },
  },
};

export { getExercise };
