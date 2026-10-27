// First-run onboarding (also reachable from Settings to change the plan).
import { app, S } from './core-app.js';
import { esc } from './ui-kit.js';
import { DAYS, ROUTINES, resolveRoutine } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { GOALS, LEVELS, EQUIPMENT, MINUTES, AREAS, generateSchedule } from './domain-personalize.js';

let step = 0;
const STEPS = 6;
const F = () => S.form;

const card = (name, value, label, sub = '') => `<button type="button" class="opt ${F()[name] === value ? 'on' : ''}" data-action="w-pick" data-name="${name}" data-value="${esc(value)}" aria-pressed="${F()[name] === value}"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
const multi = (name, value, label) => { const on = F()[name].includes(value); return `<button type="button" class="chip-btn ${on ? 'on' : ''}" data-action="w-toggle" data-name="${name}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`; };

function body() {
  const f = F();
  switch (step) {
    case 0: return `<div class="welcome-hero"><span class="eyebrow">PADEL OS</span><h2>Training built for padel.</h2>
      <p>Strength, warm-ups and injury prevention that fit your equipment and your week. Private: everything stays on this phone.</p>
      <ul class="ticks"><li>A plan that adapts as you get stronger</li><li>Guided court warm-ups &amp; injury prevention</li><li>Match log that spots overload early</li></ul></div>`;
    case 1: return `<h2>What matters most?</h2><p class="meta">We’ll weigh your plan toward it.</p><div class="opts">${Object.entries(GOALS).map(([k, v]) => card('goal', k, v)).join('')}</div>`;
    case 2: return `<h2>Your gym experience</h2><div class="opts">${Object.entries(LEVELS).map(([k, v]) => card('level', k, k[0].toUpperCase() + k.slice(1), v)).join('')}</div>`;
    case 3: return `<h2>Where will you train?</h2><div class="opts">
      ${card('equipment', 'gym', EQUIPMENT.gym, 'Machines, cables, barbells')}
      ${card('equipment', 'db', EQUIPMENT.db, 'A pair of dumbbells or kettlebells, a bench or chair')}
      ${card('equipment', 'bw', EQUIPMENT.bw, 'Bodyweight + a resistance band')}</div>`;
    case 4: return `<h2>How much time?</h2><label class="lbl">Per gym session</label><div class="opts row3">${MINUTES.map(m => card('minutes', m, `${m} min`, m === 20 ? 'Essentials' : m === 40 ? 'Balanced' : 'Complete')).join('')}</div>
      <label class="lbl">Gym sessions per week</label><div class="opts row3">${[1, 2, 3].map(d => card('days', d, `${d}×`, d === 1 ? 'Maintain' : d === 2 ? 'Improve' : 'Best results')).join('')}</div>`;
    case 5: return `<h2>Your padel week</h2><label class="lbl">Which days do you usually play?</label><div class="chipset">${DAYS.map(d => multi('padelDays', d, d)).join('')}</div>
      <label class="lbl">Anything that bothers you? <small>(optional)</small></label><div class="chipset">${Object.entries(AREAS).map(([k, v]) => multi('injuries', k, v)).join('')}</div>
      <p class="meta">We’ll suggest short prevention routines for these. This isn’t medical advice; see a professional for pain that persists.</p>`;
    case 6: {
      const sched = generateSchedule(f.days, f.padelDays);
      const prof = { ...f };
      const ids = [...new Set(Object.values(sched).filter(v => ROUTINES[v]))];
      return `<h2>Your plan</h2>
        <div class="week-strip">${DAYS.map(d => `<div class="day"><small>${d[0]}</small><b>${ROUTINES[sched[d]] ? sched[d] : sched[d] === 'Padel' ? 'P' : sched[d] === 'Recovery' ? 'R' : '·'}</b></div>`).join('')}</div>
        ${ids.map(id => { const r = resolveRoutine(id, {}, prof); return `<div class="card"><div class="row between"><b><span class="badge sm">${id}</span> ${esc(r.title)}</b><small class="meta">~${r.minutes} min</small></div><p class="meta">${r.blocks.map(b => esc(getExercise(b.ex).name)).join(' · ')}</p></div>`; }).join('')}
        <label class="toggle"><input type="checkbox" id="wSimple" ${f.simple ? 'checked' : ''}> <span>Simple mode<small>Plain words instead of RPE and training jargon. Change anytime.</small></span></label>
        ${S.profile.onboarded ? `<label class="toggle"><input type="checkbox" id="wSched" checked> <span>Replace my weekly schedule<small>Untick to keep your current days.</small></span></label>` : ''}`;
    }
  }
  return '';
}

const canNext = () => ({ 1: 'goal', 2: 'level', 3: 'equipment' }[step] ? F()[{ 1: 'goal', 2: 'level', 3: 'equipment' }[step]] != null : true);

export const welcome = {
  render() {
    if (!S.form || S.form._wizard !== true) { S.form = { _wizard: true, ...structuredClone(S.profile) }; step = S.profile.onboarded ? 1 : 0; }
    return `<div class="wizard">
      <div class="wiz-top">${step > 0 ? `<button class="icon-btn" data-action="w-back" aria-label="Back">‹</button>` : '<span></span>'}
        <div class="dots">${Array.from({ length: STEPS }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>
        ${S.profile.onboarded ? `<button class="link" data-action="w-cancel">Cancel</button>` : '<span></span>'}</div>
      <div class="wiz-body">${body()}</div>
      <div class="wiz-bottom"><button class="btn primary big" data-action="w-next" ${canNext() ? '' : 'disabled'}>${step === 0 ? 'Set up my plan' : step === STEPS ? 'Start training' : 'Continue'}</button>
      ${step === 0 ? '<button class="btn ghost wide" data-action="w-skip">Skip — use the full gym plan</button>' : ''}</div></div>`;
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
