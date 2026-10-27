import { app, S } from './core-app.js';
import { esc, title } from './ui-kit.js';
import { PHASES, DAYS, DAY_OPTIONS, ROUTINES, resolveRoutine, prescribe, rangeLabel, phaseFor } from './domain-program.js';
import { getExercise } from './domain-catalog.js';
import { startForWeek, dayKey } from './domain-calendar.js';

function routineCard(id) {
  const r = resolveRoutine(id, S.overrides), wk = app.position().week;
  const custom = Object.keys(S.overrides[id] || {}).length;
  return `<section class="card"><div class="row between"><span class="eyebrow">ROUTINE ${id} · ~${r.minutes} MIN${custom ? ' · CUSTOMISED' : ''}</span>${custom ? `<button class="link" data-action="reset-routine" data-r="${id}">Reset</button>` : ''}</div>
    <h3>${esc(r.title)}</h3><p class="meta">${esc(r.focus)}</p>
    <div class="list">${r.blocks.map(blk => {
      const ex = getExercise(blk.ex), rx = prescribe(blk, wk), changed = S.overrides[id]?.[blk.index];
      return `<button class="list-item block" data-action="edit-block" data-r="${id}" data-i="${blk.index}"><span><b>${esc(ex.name)}${changed ? ' <small class="tag">edited</small>' : ''}</b><small>${rx.sets} × ${esc(rangeLabel(blk))} · rest ${blk.rest}s</small></span><span aria-hidden="true">✎</span></button>`;
    }).join('')}</div>
    <button class="btn primary" data-action="start" data-routine="${id}" ${S.active ? 'disabled' : ''}>Start Routine ${id}</button></section>`;
}

export const plan = {
  render() {
    const pos = app.position(), ph = phaseFor(pos.week), today = dayKey();
    return `${title('Program', `CYCLE ${pos.cycle} · PROGRAM WEEK ${pos.weeksIn + 1}`)}
      <section class="card"><span class="eyebrow">4-WEEK WAVE · AUTO-ADVANCES EVERY MONDAY</span>
        <div class="seg four">${PHASES.map(p => `<button aria-selected="${p.week === pos.week}" data-action="set-week" data-w="${p.week}"><b>W${p.week}</b><small>${p.name}</small></button>`).join('')}</div>
        <h3>Week ${pos.week} · ${ph.name}</h3><p>Target RPE ${ph.rpe} (~${ph.rir} reps in reserve). ${esc(ph.note)}</p>
        <p class="meta">Tap a week if you need to shift the cycle (e.g. after illness or travel). Suggested loads and set counts update automatically.</p></section>
      ${title('Weekly schedule', 'TAP TO CHANGE')}
      <section class="card schedule">${DAYS.map(d => `<label for="day-${d}" class="${d === today ? 'today' : ''}">${d}</label><select id="day-${d}" class="input" data-day="${d}">${DAY_OPTIONS.map(v => `<option value="${v}" ${S.schedule[d] === v ? 'selected' : ''}>${ROUTINES[v] ? `${v} · ${ROUTINES[v].title}` : v}</option>`).join('')}</select>`).join('')}
        <p class="meta">Keep the heaviest lower-body day away from the day before an important match, and keep at least one true rest day.</p></section>
      ${title('Routines', 'TAP AN EXERCISE TO CUSTOMISE')}
      ${Object.keys(ROUTINES).map(routineCard).join('')}
      <section class="card"><h3>Warm-up (8–10 min)</h3><p>5 min easy cardio → ankle rocks, adductor rock-backs, thoracic rotations, scapular wall slides → 2–4 ramp-up sets for the first big lift (e.g. 50% × 5, 70% × 3, 85% × 1).</p></section>
      <section class="card"><h3>How progression works</h3><p>Each exercise has a rep range. Stay at a load until you hit the top of the range on every set without grinding (RPE ≤ 9), then the app suggests the next increment and you restart at the bottom. Miss the bottom of the range twice in a row and it backs off one step. Deload weeks automatically drop sets and load. Power work (jumps, throws) never chases reps — quality first.</p></section>`;
  },
  mounted() {
    document.querySelectorAll('[data-day]').forEach(s => s.onchange = async () => { S.schedule[s.dataset.day] = s.value; await app.save('schedule'); app.toast('Schedule saved'); });
  },
  actions: {
    async 'set-week'(el) {
      S.settings.programStart = startForWeek(+el.dataset.w, S.settings.programStart);
      await app.save('settings'); app.render({ keepScroll: true }); app.toast(`Now in week ${el.dataset.w}`);
    },
    async 'reset-routine'(el) {
      if (!(await app.confirm(`Reset Routine ${el.dataset.r} to the default exercises and numbers?`, { ok: 'Reset' }))) return;
      delete S.overrides[el.dataset.r]; await app.save('overrides'); app.render({ keepScroll: true });
    },
    'edit-block'(el) {
      const rid = el.dataset.r, i = +el.dataset.i, base = ROUTINES[rid].blocks[i];
      const blk = resolveRoutine(rid, S.overrides).blocks[i];
      const baseEx = getExercise(base.ex);
      const options = [base.ex, ...baseEx.subs].filter(getExercise);
      const tf = baseEx.fields[baseEx.fields.length - 1];
      const unitLbl = tf === 'sec' ? 'seconds' : tf === 'm' ? 'meters' : 'reps';
      app.sheet(`<span class="eyebrow">ROUTINE ${rid} · SLOT ${i + 1}</span><h3>Customise exercise</h3>
        <label class="lbl" for="bEx">Exercise</label><select class="input" id="bEx">${options.map(id => `<option value="${id}" ${id === blk.ex ? 'selected' : ''}>${esc(getExercise(id).name)}${id === base.ex ? ' (default)' : ''}</option>`).join('')}</select>
        <div class="grid3"><div><label class="lbl" for="bSets">Sets</label><input class="input" id="bSets" type="number" inputmode="numeric" min="1" max="10" value="${blk.sets}"></div>
        <div><label class="lbl" for="bMin">Min ${unitLbl}</label><input class="input" id="bMin" type="number" inputmode="numeric" min="1" value="${blk.min}"></div>
        <div><label class="lbl" for="bMax">Max ${unitLbl}</label><input class="input" id="bMax" type="number" inputmode="numeric" min="1" value="${blk.max}"></div></div>
        <label class="lbl" for="bRest">Rest (seconds)</label><input class="input" id="bRest" type="number" inputmode="numeric" min="0" step="15" value="${blk.rest}">
        <p class="meta">Deload weeks still scale sets automatically. Alternatives share the same movement pattern and units.</p>
        <div class="row gap"><button class="btn secondary" id="bReset">Default</button><button class="btn primary" id="bSave">Save</button></div>`, body => {
        const v = id => +body.querySelector(id).value;
        body.querySelector('#bSave').onclick = async () => {
          const o = { ex: body.querySelector('#bEx').value, sets: Math.max(1, v('#bSets')), min: Math.max(1, v('#bMin')), max: Math.max(1, v('#bMax')), rest: Math.max(0, v('#bRest')) };
          if (o.max < o.min) [o.min, o.max] = [o.max, o.min];
          if (getExercise(o.ex).fields.join() !== baseEx.fields.join()) { o.min = base.min; o.max = base.max; }
          const diff = Object.fromEntries(Object.entries(o).filter(([k, val]) => base[k] !== val));
          S.overrides[rid] = { ...(S.overrides[rid] || {}) };
          if (Object.keys(diff).length) S.overrides[rid][i] = diff; else delete S.overrides[rid][i];
          if (!Object.keys(S.overrides[rid]).length) delete S.overrides[rid];
          await app.save('overrides'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Routine updated');
        };
        body.querySelector('#bReset').onclick = async () => {
          if (S.overrides[rid]) { delete S.overrides[rid][i]; if (!Object.keys(S.overrides[rid]).length) delete S.overrides[rid]; }
          await app.save('overrides'); app.closeSheet(); app.render({ keepScroll: true });
        };
      });
    },
  },
};
