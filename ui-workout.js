import { app, S } from './core-app.js';
import * as db from './core-db.js';
import * as timer from './core-timer.js';
import { esc, chips } from './ui-kit.js';
import { getExercise, targetField, hasLoad, FIELD_UNIT } from './domain-catalog.js';
import { rangeLabel } from './domain-program.js';
import { toDisplay, fromDisplay, fmtW, fmtNum } from './domain-units.js';
import { lastPerformance, doneSets, detectPRs } from './domain-progression.js';
import { relDay } from './domain-calendar.js';
import { autofill, swapExercise, workoutStats, finalizeWorkout } from './domain-workout.js';

const W = () => S.active;
const cur = () => W().exercises[W().index];
const unit = () => S.settings.unit;
const touch = (keepScroll = true) => { app.saveActive(); app.render({ keepScroll }); };
let wakeLock = null;

async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch {}
}
document.addEventListener('visibilitychange', () => { if (S.route === 'workout' && S.active) keepAwake(); if (document.hidden && S.active) app.saveActive(true); });

const clock = t => { const s = Math.floor((Date.now() - t) / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export { clock };
const fieldLabel = (f) => f === 'w' ? unit().toUpperCase() : f === 'reps' ? 'REPS' : f === 'sec' ? 'SEC' : 'METERS';
const entryState = e => e.skipped ? 'skip' : e.sets.length && e.sets.every(s => s.done) ? 'done' : e.sets.some(s => s.done) ? 'part' : '';

function fmtSet(s, fields) {
  const tf = fields[fields.length - 1];
  const v = `${fmtNum(s[tf])}${tf === 'reps' ? '' : FIELD_UNIT[tf]}`;
  return fields.includes('w') && s.w ? `${fmtNum(toDisplay(s.w, unit()))}×${v}` : v;
}

function suggestionBox(e) {
  const sug = e.suggestion, ex = getExercise(e.exId), tf = targetField(ex);
  const last = lastPerformance(app.strength, e.exId);
  const tgt = `${sug.target}${tf === 'reps' ? ' reps' : FIELD_UNIT[tf]}`;
  const head = sug.w != null ? `${fmtW(sug.w, unit())} × ${tgt}` : hasLoad(ex) && sug.kind === 'first' ? `Find your weight · ${tgt}` : tgt;
  return `<div class="suggest ${sug.kind}"><div><span class="eyebrow">${sug.kind === 'up' ? '▲ PROGRESS' : sug.kind === 'down' ? '▼ BACK OFF' : sug.kind === 'deload' ? 'DELOAD' : 'TODAY'}</span><b>${head}</b></div><p>${esc(sug.reason)}</p>
    ${last ? `<p class="last">Last · ${esc(relDay(last.session.startedAt))}: ${doneSets(last.entry).map(s => fmtSet(s, e.fields)).join(', ')}</p>` : ''}</div>`;
}

function setRows(e) {
  const ex = getExercise(e.exId);
  const tf = targetField(ex);
  const cols = e.fields;
  const lastDoneIdx = e.sets.map(s => s.done).lastIndexOf(true);
  const nextIdx = e.sets.findIndex(s => !s.done);
  return `<div class="sets" style="--cols:${cols.length}">
    <div class="set-row head"><span>SET</span>${cols.map(f => `<span>${fieldLabel(f)}${f === 'w' && ex.loadNote ? `<i>${esc(ex.loadNote)}</i>` : ''}</span>`).join('')}<span></span></div>
    ${e.sets.map((s, i) => {
      const prev = e.sets.slice(0, i).reverse().find(x => x.done);
      const ph = f => f === 'w' ? (prev?.w ?? e.suggestion.w) : (prev?.[f] ?? (f === tf ? e.suggestion.target : null));
      return `<div class="set-row ${s.done ? 'is-done' : ''} ${i === nextIdx ? 'is-next' : ''}">
        <b class="set-n">${i + 1}${s.rpe ? `<i>@${fmtNum(s.rpe)}</i>` : ''}</b>
        ${cols.map(f => {
          const val = f === 'w' ? toDisplay(s.w, unit()) : s[f];
          const p = ph(f), pv = f === 'w' ? toDisplay(p, unit()) : p;
          return `<input class="set-in" type="number" inputmode="decimal" step="any" min="0" data-field="${f}" data-set="${i}" value="${val ?? ''}" placeholder="${pv ?? '–'}" aria-label="Set ${i + 1} ${fieldLabel(f)}">`;
        }).join('')}
        <button class="check" data-action="set-done" data-set="${i}" aria-pressed="${s.done}" aria-label="${s.done ? 'Undo' : 'Complete'} set ${i + 1}">✓</button>
      </div>`;
    }).join('')}
    ${lastDoneIdx >= 0 ? `<div class="rpe-row"><span>Set ${lastDoneIdx + 1} effort</span>${chips('set-rpe', [6, 7, 8, 9, 10], e.sets[lastDoneIdx].rpe ?? '', v => `RPE ${v}`)}</div><p class="hint">RPE 8 ≈ 2 reps left · 9 ≈ 1 left · 10 = nothing left. Today's target: RPE ${fmtNum(e.target.rpe)}.</p>` : ''}
  </div>`;
}

function cues(ex) {
  return `<details class="cues"><summary>How to do it</summary>
    <dl><dt>Why</dt><dd>${esc(ex.why)}</dd><dt>Set up</dt><dd>${esc(ex.setup)}</dd><dt>Execute</dt><dd>${esc(ex.execute)}</dd><dt>Breathe</dt><dd>${esc(ex.breathe)}</dd><dt>Avoid</dt><dd>${esc(ex.avoid)}</dd></dl>
    <a class="link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' exercise form')}" target="_blank" rel="noopener">Watch form demos ↗</a></details>`;
}

function runner() {
  const w = W(), e = cur(), ex = getExercise(e.exId), n = w.exercises.length, last = w.index === n - 1;
  const st = workoutStats(w);
  const note = S.exNotes[e.exId] || '';
  return `<div class="wk-top">
      <button class="icon-btn" data-action="leave" aria-label="Leave workout (progress is saved)">‹</button>
      <div class="wk-title"><span class="eyebrow">ROUTINE ${esc(w.routineId)} · W${w.week}${w.light ? ' · LIGHT' : ''}</span><b><span class="elapsed" data-start="${w.startedAt}">${clock(w.startedAt)}</span> · ${st.sets}/${st.planned} sets</b></div>
      <button class="btn small primary" data-action="to-finish">Finish</button>
    </div>
    <div class="ex-nav" role="tablist">${w.exercises.map((x, i) => `<button role="tab" aria-selected="${i === w.index}" class="pill ${entryState(x)} ${i === w.index ? 'on' : ''}" data-action="jump" data-i="${i}" aria-label="${esc(x.name)}">${i + 1}</button>`).join('')}</div>
    <article class="card ex-card ${e.skipped ? 'skipped' : ''}">
      <span class="eyebrow">EXERCISE ${w.index + 1} OF ${n} · REST ${e.target.rest}s</span>
      <h2>${esc(ex.name)}${e.swappedFrom ? ' <small class="tag">swapped</small>' : ''}</h2>
      <p class="target">${e.target.sets} × ${esc(rangeLabel({ ex: e.exId, min: e.target.min, max: e.target.max }))} · RPE ${fmtNum(e.target.rpe)}</p>
      <div class="tags"><span>${esc(ex.equipment)}</span><span>${esc(ex.muscles)}</span></div>
      ${e.skipped ? `<p class="meta">Skipped. <button class="link" data-action="skip">Undo skip</button></p>` : `${suggestionBox(e)}${setRows(e)}`}
      <div class="ex-tools">
        <button class="tool" data-action="add-set">＋ Set</button>
        <button class="tool" data-action="remove-set" ${e.sets.length <= 1 ? 'disabled' : ''}>− Set</button>
        <button class="tool" data-action="swap">⇄ Swap</button>
        ${e.skipped ? '' : `<button class="tool" data-action="skip">Skip</button>`}
      </div>
      ${cues(ex)}
      <details class="cues" ${note ? 'open' : ''}><summary>My notes${note ? ' ·' : ''} <small>${esc(note.slice(0, 32))}</small></summary>
        <textarea class="input" data-note="${esc(e.exId)}" rows="2" placeholder="Seat height, grip, cues that work for you… (kept for next time)">${esc(note)}</textarea></details>
    </article>
    <div class="wk-bottom">
      <button class="btn secondary" data-action="prev" ${w.index === 0 ? 'disabled' : ''}>‹ Prev</button>
      <button class="btn ${entryState(e) === 'done' || e.skipped ? 'primary' : 'secondary'}" data-action="${last ? 'to-finish' : 'next'}">${last ? 'Finish workout' : `Next: ${esc(getExercise(w.exercises[w.index + 1].exId).name)} ›`}</button>
    </div>`;
}

function finishView() {
  const w = W(), st = workoutStats(w);
  const prs = w.exercises.flatMap(e => detectPRs({ ...e, sets: doneSets(e) }, app.strength).map(p => ({ ...p, name: e.name, ex: getExercise(e.exId) })));
  S.form.rpe ??= ''; S.form.pain ??= 'no';
  const skippedOrEmpty = w.exercises.filter(e => !e.skipped && !doneSets(e).length).length;
  return `<div class="wk-top"><button class="icon-btn" data-action="back-to-runner" aria-label="Back to workout">‹</button><div class="wk-title"><span class="eyebrow">FINISH</span><b>${esc(w.title)}</b></div><span></span></div>
    <section class="hero"><span class="eyebrow">SESSION SUMMARY</span><h2>${st.sets} sets logged</h2>
      <div class="stats">${`<div class="stat"><strong><input class="inline-num" id="durIn" type="number" inputmode="numeric" value="${st.minutes}" aria-label="Duration minutes"></strong><small>Minutes</small></div>`}<div class="stat"><strong>${st.sets}/${st.planned}</strong><small>Sets</small></div><div class="stat"><strong>${fmtW(st.volume, unit()).replace(/\.\d+/, '')}</strong><small>Volume</small></div></div>
      ${prs.length ? `<div class="prs">${prs.map(p => `<span class="pr">🏆 ${esc(p.name)} · ${esc(p.type)} ${p.type === 'e1RM' || p.type === 'Heaviest' ? fmtW(p.value, unit()) : fmtNum(p.value)}</span>`).join('')}</div>` : ''}
      ${skippedOrEmpty ? `<p class="meta">${skippedOrEmpty} exercise(s) have no completed sets — they’ll be saved as not done.</p>` : ''}
    </section>
    <section class="card">
      <label class="lbl">How hard was the whole session? (RPE)</label>${chips('rpe', [5, 6, 7, 8, 9, 10], S.form.rpe)}
      <label class="lbl">Any pain?</label>${chips('pain', ['no', 'yes'], S.form.pain, v => v === 'no' ? 'No pain' : 'Yes, I felt pain')}
      ${S.form.pain === 'yes' ? `<input class="input" id="painLoc" placeholder="Where? e.g. left knee, lateral elbow" value="${esc(S.form.painLoc || '')}"><p class="warn">Don’t train through sharp or worsening pain. If it persists, see a qualified professional.</p>` : ''}
      <label class="lbl" for="notesIn">Notes</label><textarea class="input" id="notesIn" rows="3" placeholder="What went well, what to change next time…">${esc(S.form.notes || '')}</textarea>
      <button class="btn primary big" data-action="save-workout">Save workout</button>
      <button class="btn ghost wide" data-action="discard">Discard workout</button>
    </section>`;
}

export const workout = {
  tab: 'today',
  render() { return S.params[0] === 'finish' ? finishView() : runner(); },
  mounted() {
    keepAwake();
    if (S.params[0] === 'finish') {
      const p = document.querySelector('#painLoc'); if (p) p.oninput = () => { S.form.painLoc = p.value; };
      document.querySelector('#notesIn').oninput = ev => { S.form.notes = ev.target.value; };
      document.querySelector('#durIn').oninput = ev => { S.form.duration = +ev.target.value; };
    }
  },
  onInput(el) {
    if (el.dataset.note) { S.exNotes[el.dataset.note] = el.value; clearTimeout(this._n); this._n = setTimeout(() => app.save('exNotes'), 400); return; }
    if (!el.dataset.field) return;
    const s = cur().sets[+el.dataset.set], f = el.dataset.field;
    const raw = el.value === '' ? null : Number(String(el.value).replace(',', '.'));
    s[f] = f === 'w' ? fromDisplay(raw, unit()) : raw;
    app.saveActive();
  },
  onPick(name, value) {
    if (name === 'set-rpe') {
      const e = cur(), i = e.sets.map(s => s.done).lastIndexOf(true);
      if (i >= 0) { e.sets[i].rpe = e.sets[i].rpe === value ? null : value; touch(); }
    } else if (name === 'pain') app.render({ keepScroll: true });
  },
  actions: {
    'set-done'(el) {
      const w = W(), e = cur(), i = +el.dataset.set, s = e.sets[i];
      if (s.done) { s.done = false; return touch(); }
      autofill(e, i);
      const tf = targetField(getExercise(e.exId));
      if (s[tf] == null) return app.toast('Enter a value first');
      s.done = true; s.ts = Date.now();
      // Pre-fill the next set with what was just done so the next tap is a one-tap log.
      const moreHere = e.sets.some(x => !x.done);
      if (S.settings.autoRest) {
        const nextEx = w.exercises.slice(w.index + 1).find(x => !x.skipped);
        const label = moreHere ? `${e.name} set ${e.sets.findIndex(x => !x.done) + 1}` : nextEx ? getExercise(nextEx.exId).name : '';
        if (moreHere || nextEx) timer.start(e.target.rest, label);
      }
      navigator.vibrate?.(20);
      touch();
    },
    'add-set'() { const e = cur(); e.sets.push({ w: null, reps: null, sec: null, m: null, rpe: null, done: false }); touch(); },
    'remove-set'() { const e = cur(); if (e.sets.length > 1) { const i = e.sets.map(s => s.done).lastIndexOf(false); e.sets.splice(i >= 0 ? i : e.sets.length - 1, 1); touch(); } },
    skip() { const e = cur(); e.skipped = !e.skipped; touch(); },
    swap() {
      const e = cur(), ex = getExercise(e.exId);
      const base = e.swappedFrom ? getExercise(e.swappedFrom) : ex;
      const ids = [...new Set([base.id, ...base.subs, ...ex.subs])].filter(id => id !== e.exId && getExercise(id));
      app.sheet(`<span class="eyebrow">SWAP FOR TODAY</span><h3>Replace ${esc(ex.name)}</h3><p class="meta">Equipment busy or something doesn’t feel right? Pick an alternative. To change it permanently, edit the routine in Plan.</p>
        <div class="list">${ids.map(id => { const x = getExercise(id); return `<button class="list-item" data-swap="${id}"><b>${esc(x.name)}</b><small>${esc(x.equipment)} · ${esc(x.muscles)}</small></button>`; }).join('') || '<p>No alternatives listed.</p>'}</div>`,
        body => body.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => {
          if (doneSets(e).length) app.toast('Logged sets on the old exercise were cleared');
          swapExercise(W(), W().index, b.dataset.swap, app.strength, unit()); app.closeSheet(); touch();
        }));
    },
    jump(el) { W().index = +el.dataset.i; touch(false); },
    prev() { W().index = Math.max(0, W().index - 1); touch(false); },
    next() { W().index = Math.min(W().exercises.length - 1, W().index + 1); touch(false); },
    leave() { app.saveActive(true); app.go('today'); app.toast('Workout saved — resume any time'); },
    'to-finish'() { S.form = {}; app.saveActive(true); app.go('workout/finish'); },
    'back-to-runner'() { app.go('workout'); },
    async discard() {
      if (!(await app.confirm('Discard this workout? Nothing will be saved.', { ok: 'Discard', danger: true }))) return;
      S.active = null; await app.saveActive(true); timer.stop(); app.go('today');
    },
    async 'save-workout'() {
      const pain = S.form.pain === 'yes' ? { flag: true, location: S.form.painLoc || '' } : { flag: false, location: '' };
      const session = finalizeWorkout(W(), { rpe: S.form.rpe === '' ? null : +S.form.rpe, notes: S.form.notes, pain, durationMin: S.form.duration }, app.strength);
      try { await db.putSession(session); } catch { return app.toast('Save failed — export a backup from Settings'); }
      S.active = null; await app.saveActive(true); timer.stop(); wakeLock?.release?.();
      await app.reloadSessions();
      app.go(`history/session/${session.id}`);
      app.toast(session.prs.length ? `Saved · ${session.prs.length} personal record${session.prs.length > 1 ? 's' : ''} 🏆` : 'Workout saved');
    },
  },
};

