// First-run onboarding (also reachable from Settings to change the plan).
// One question per screen, answered by tapping a row, like iOS setup.
import { app, S } from './core-app.js';
import { esc, icon, group, row, routineLook } from './ui-kit.js';
import { DAYS, ROUTINES, resolveRoutine } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { GOALS, LEVELS, EQUIPMENT, MINUTES, AREAS, generateSchedule } from './domain-personalize.js';

let step = 0;
const STEPS = 6;
const F = () => S.form;
const DAY_LONG = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const pick = (name, value, title, sub = '') => row({ title: esc(title), sub: esc(sub), action: 'w-pick', data: { name, value }, chevron: false, right: F()[name] === value ? icon('check', 'check-mark') : '' });
const multi = (name, value, title) => row({ title: esc(title), action: 'w-toggle', data: { name, value }, chevron: false, right: F()[name].includes(value) ? icon('check', 'check-mark') : '' });
const q = (title, sub = '') => `<div class="wiz-q"><h1>${esc(title)}</h1>${sub ? `<p class="t-sub">${esc(sub)}</p>` : ''}</div>`;

function body() {
  const f = F();
  switch (step) {
    case 0: return `<div class="welcome"><img class="app-icon" src="icon-180.png" alt="" width="92" height="92"><h1>Welcome to<br>PADEL OS</h1>
      <div class="features">
        <div class="feature">${icon('dumbbell')}<div><b>A plan that fits you</b><span>Workouts for your equipment and your schedule, and they get harder as you get stronger.</span></div></div>
        <div class="feature">${icon('flame')}<div><b>Ready for match day</b><span>Guided warm-ups and cool-downs you can follow on court.</span></div></div>
        <div class="feature">${icon('heart')}<div><b>Stay injury-free</b><span>Short routines for elbows, shoulders, knees and calves.</span></div></div>
      </div></div>`;
    case 1: return `${q('What’s your main goal?')}${group(Object.entries(GOALS).map(([k, v]) => pick('goal', k, v)).join(''))}`;
    case 2: return `${q('How much have you lifted weights before?')}${group([['beginner', 'Never or rarely', 'We’ll start gently'], ['intermediate', 'Now and then', 'A few times a month'], ['advanced', 'Regularly', 'Most weeks']].map(([k, t, s]) => pick('level', k, t, s)).join(''))}`;
    case 3: return `${q('Where will you work out?')}${group(pick('equipment', 'gym', EQUIPMENT.gym, 'Machines, cables and barbells') + pick('equipment', 'db', EQUIPMENT.db, 'A pair of dumbbells and a bench or chair') + pick('equipment', 'bw', EQUIPMENT.bw, 'Just your body and a resistance band'))}`;
    case 4: return `${q('How much time do you have?')}${group(MINUTES.map(m => pick('minutes', m, `${m} minutes`, m === 20 ? 'Just the essentials' : m === 40 ? 'A balanced workout' : 'The complete workout')).join(''), { header: 'Each workout' })}
      ${group([1, 2, 3].map(d => pick('days', d, `${d} ${d === 1 ? 'day' : 'days'} a week`, d === 1 ? 'Keep what you have' : d === 2 ? 'Steady progress' : 'Best results')).join(''), { header: 'Workouts per week' })}`;
    case 5: return `${q('When do you play padel?', 'We’ll keep hard workouts away from match days.')}${group(DAYS.map(d => multi('padelDays', d, DAY_LONG[d])).join(''), { header: 'Usual padel days' })}
      ${group(Object.entries(AREAS).map(([k, v]) => multi('injuries', k, v)).join(''), { header: 'Anything that bothers you? (optional)', footer: 'We’ll suggest short routines for these. This isn’t medical advice.' })}`;
    case 6: {
      const sched = generateSchedule(f.days, f.padelDays);
      const ids = [...new Set(Object.values(sched).filter(v => ROUTINES[v]))];
      return `${q('Your plan is ready', 'You can change any of this later.')}
        <div class="plan-week" style="margin-bottom:28px">${DAYS.map(d => `<div>${d[0]}<b>${ROUTINES[sched[d]] ? '●' : sched[d] === 'Padel' ? '<span style="color:var(--teal)">●</span>' : '–'}</b></div>`).join('')}</div>
        ${group(ids.map(id => { const r = resolveRoutine(id, {}, f), look = routineLook(id);
          return row({ title: esc(r.title), sub: `${r.blocks.length} exercises · about ${r.minutes} min · ${DAYS.filter(d => sched[d] === id).map(d => DAY_LONG[d]).join(', ')}`, icon: look.icon, color: look.color }); }).join(''), { header: 'Your workouts' })}
        ${group(row({ title: 'Simple mode', sub: 'Plain words instead of training terms', right: `<input type="checkbox" class="switch" id="wSimple" ${f.simple ? 'checked' : ''} aria-label="Simple mode">` })
          + (S.profile.onboarded ? row({ title: 'Update my weekly schedule', right: '<input type="checkbox" class="switch" id="wSched" checked aria-label="Update my weekly schedule">' }) : ''))}`;
    }
  }
  return '';
}

export const welcome = {
  render() {
    if (!S.form || S.form._wizard !== true) { S.form = { _wizard: true, ...structuredClone(S.profile) }; step = S.profile.onboarded ? 1 : 0; }
    const left = step > (S.profile.onboarded ? 1 : 0) ? `<button class="nav-btn" data-action="w-back">${icon('chevL')}Back</button>` : S.profile.onboarded ? '<button class="nav-btn" data-action="w-cancel">Cancel</button>' : '<span></span>';
    return `<div class="wiz-top">${left}<div class="dots">${step ? Array.from({ length: STEPS }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('') : ''}</div><span></span></div>
      ${body()}
      <div class="wiz-bottom"><div class="inner"><button class="btn filled" data-action="w-next">${step === 0 ? 'Get Started' : step === STEPS ? 'Start Training' : 'Continue'}</button>
      ${step === 0 ? '<button class="btn plain" data-action="w-skip">Skip for now</button>' : ''}</div></div>`;
  },
  actions: {
    'w-pick'(el) { const v = el.dataset.value; F()[el.dataset.name] = isNaN(v) ? v : Number(v); app.render({ keepScroll: true }); },
    'w-toggle'(el) { const arr = F()[el.dataset.name], v = el.dataset.value; F()[el.dataset.name] = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; app.render({ keepScroll: true }); },
    'w-back'() { step = Math.max(0, step - 1); app.render(); },
    'w-cancel'() { S.form = {}; app.go('settings'); },
    async 'w-skip'() { S.profile = { ...S.profile, onboarded: true, simple: true }; await app.save('profile'); S.form = {}; app.go('today'); },
    async 'w-next'() {
      if (step < STEPS) { step++; return app.render(); }
      const f = F();
      const replace = document.querySelector('#wSched') ? document.querySelector('#wSched').checked : true;
      const { _wizard, ...profile } = f;
      S.profile = { ...profile, simple: document.querySelector('#wSimple').checked, onboarded: true };
      await app.save('profile');
      if (replace) { S.schedule = generateSchedule(f.days, f.padelDays); await app.save('schedule'); }
      S.form = {};
      app.go('today');
      app.toast('Your plan is ready');
    },
  },
};

export { getExercise };
