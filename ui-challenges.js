// Padel shot challenges on screen: the section in the padel log, the Train-tab card and the shot sheet.
// The rules are in domain/challenges.js; see PADEL-CHALLENGES.md.
import { app, S } from './core-app.js';
import { esc, group, row, chips, seg } from './ui-kit.js';
import { activitySheet } from './ui-today.js';
import { SHOTS, SHOT_IDS, VARIANTS, LEVELS, TIERS, TOP_TIER, shotResults, shotState, allShots, tierFor, firstResultNote, overheadBalls, resultText, passes, OVERHEAD_NOTE_FROM } from './domain-challenges.js';

const starts = () => S.settings.shots || {};
export const focusShot = () => SHOTS[S.settings.focusShot] ? S.settings.focusShot : 'overhead';
// The padel "working on" that fits a shot (it decides which muscles the session tires).
export const focusForShot = id => ['overhead', 'smash'].includes(id) ? 'overheads' : 'groundstrokes';
const dots = n => `${'●'.repeat(n)}${'○'.repeat(TOP_TIER - n)}`;

// A shot with no results elsewhere starts fresh: its first result in this log sets the start (a saved start only
// counts while the shot has results, so deleting them lets you choose again).
const freshShot = (shot, others, drills) => !shotResults(others, shot).length && !drills.some(r => r.shot === shot);
function startFor(shot, others, drills, chosen) {
  if (shotResults(others, shot).length) return starts()[shot]?.start || 1;
  const here = drills.filter(r => r.shot === shot).map(r => r.tier);
  return here.length ? Math.min(...here) : +chosen || 1;
}
// The tier the next result for the picked shot aims at, counting results already added in this log.
function formTier(f, others) {
  const shot = f.cshot, start = startFor(shot, others, f.drills, f.cstart);
  const fresh = freshShot(shot, others, f.drills);
  if (fresh) return start;
  return tierFor([...others, { id: '_form', startedAt: Date.now(), padel: { drills: f.drills } }], shot, { ...starts(), [shot]: { start } });
}

// Form fields for the padel log. existing: the session being edited, if any.
export function challengeForm(existing, shot = null) {
  return { drills: [...(existing?.padel?.drills || [])], cshot: shot || focusShot(), cstart: 1, cvar: 'vibora', cval: '' };
}

// The section shown in the padel log for lessons, training and ball-machine sessions.
export function challengeSection(f, existing) {
  const others = S.sessions.filter(s => s.id !== existing?.id), tier = formTier(f, others), t = TIERS[tier];
  const fresh = freshShot(f.cshot, others, f.drills);
  const added = f.drills.length ? group(f.drills.map((r, i) => row({ title: `${esc(SHOTS[r.shot])}${r.variant ? ` · ${esc(VARIANTS[r.variant])}` : ''}`, sub: `${esc(LEVELS[r.tier])} try · ${esc(resultText(r))}${passes(r) ? ' · cleared' : ''}`,
    right: `<button class="link" data-drill-rm="${i}" style="margin-left:auto">Remove</button>`, chevron: false })).join('')) : '';
  return `<label class="field-l">Shot challenges (optional)</label>${added}
    ${chips('cshot', SHOT_IDS, f.cshot, k => SHOTS[k])}
    ${fresh ? `<label class="field-l">Start ${esc(SHOTS[f.cshot])} at</label>${seg('cstart', [1, 2, 3].map(n => [n, LEVELS[n]]), f.cstart)}` : ''}
    <p class="t-foot" style="margin:10px 4px 8px"><b>${esc(LEVELS[tier])}:</b> ${esc(t.goal(f.cshot))} · ${esc(t.setting.toLowerCase())}</p>
    ${f.cshot === 'overhead' ? seg('cvar', Object.entries(VARIANTS), f.cvar) : ''}
    <div class="grid2" style="margin-top:8px"><input class="input" id="cVal" type="number" inputmode="numeric" min="0" max="${t.kind === 'streak' ? 300 : t.of}" placeholder="${t.kind === 'streak' ? 'Best run in a row' : `Made out of ${t.of}`}" value="${esc(f.cval)}" aria-label="${t.kind === 'streak' ? 'Best run in a row' : `Made out of ${t.of}`}">
    <button type="button" class="btn tinted" id="cAdd" style="margin:0">Add Result</button></div>`;
}

// Picking another shot starts its entry clean (the start tier and number belong to the shot you had picked).
export function onChallengePick(f, name) { if (name === 'cshot') { f.cstart = 1; f.cval = ''; } }

export function bindChallenge(body, f, existing, redraw) {
  const v = body.querySelector('#cVal'); if (!v) return;
  v.oninput = e => { f.cval = e.target.value; };
  body.querySelectorAll('[data-drill-rm]').forEach(b => b.onclick = () => { f.drills.splice(+b.dataset.drillRm, 1); redraw(); });
  body.querySelector('#cAdd').onclick = () => {
    const others = S.sessions.filter(s => s.id !== existing?.id), tier = formTier(f, others), t = TIERS[tier], n = Math.round(+f.cval);
    if (f.cval === '' || !(n >= 0)) return app.toast(t.kind === 'streak' ? 'Add your best run in a row' : `Add how many of ${t.of} you made`);
    if (t.kind === 'made' && n > t.of) return app.toast(`That’s more than ${t.of}`);
    const r = t.kind === 'streak' ? { shot: f.cshot, tier, streak: n } : { shot: f.cshot, tier, made: n, of: t.of };
    if (f.cshot === 'overhead') r.variant = f.cvar;
    const note = firstResultNote([...others, { id: '_form', startedAt: 0, padel: { drills: f.drills } }], r);
    f.drills.push(r); f.cval = ''; redraw();
    if (note) app.toast(note);
  };
}

// After saving: remember chosen starting tiers, and say what changed.
export function afterSave(drills, existing) {
  if (!drills?.length) return '';
  const others = S.sessions.filter(s => s.id !== existing?.id), notes = [];
  for (const shot of new Set(drills.map(r => r.shot))) {
    // Before: as it stood with this session's old results (if editing), so an unchanged edit announces nothing.
    const before = shotState(S.sessions, shot, { start: starts()[shot]?.start || 1 }).cleared;
    if (!shotResults(others, shot).length) {
      const start = Math.min(...drills.filter(r => r.shot === shot).map(r => r.tier)), { [shot]: _, ...rest } = starts();
      S.settings.shots = start > 1 ? { ...rest, [shot]: { start } } : rest;
    }
    const after = shotState([...others, { id: '_new', startedAt: Date.now(), padel: { drills } }], shot, { start: starts()[shot]?.start || 1 }).cleared;
    if (after > before) notes.push(`${SHOTS[shot]}: ${LEVELS[after]}`);
  }
  if (overheadBalls(drills) > OVERHEAD_NOTE_FROM) notes.push('Lots of overheads today: your elbow and shoulder will feel it');
  return notes.join('. ');
}

// Train tab: where each shot stands.
export function challengesCard() {
  const all = allShots(S.sessions, starts()), focus = focusShot();
  return group(SHOT_IDS.map(id => { const st = all[id], t = st.next ? TIERS[st.next] : null;
    const sub = !st.started ? `Not started${id === focus ? ' · your focus' : ''}` : `${st.level}${st.faded ? ' · not practised for 8 weeks' : t ? ` · next: ${t.goal(id)}` : ' · every tier cleared'}${id === focus ? ' · your focus' : ''}`;
    return row({ title: esc(SHOTS[id]), sub: esc(sub), value: st.started ? dots(st.cleared) : '', icon: 'racket', color: st.started && !st.faded ? 'teal' : 'gray', action: 'shot-sheet', data: { id } });
  }).join(''), { header: 'Padel challenges', footer: 'Add a result when you log a lesson, training or ball-machine session.' });
}

export function shotSheet(id) {
  const st = shotState(S.sessions, id, { start: starts()[id]?.start || 1 }), res = shotResults(S.sessions, id);
  const tiers = [1, 2, 3].map(n => row({ title: `${esc(LEVELS[n])}${n === st.next ? ' · next' : ''}`, sub: `${esc(TIERS[n].goal(id))} · ${esc(TIERS[n].setting.toLowerCase())}`, value: n <= st.cleared ? '✓' : '', chevron: false })).join('');
  const recent = res.slice(-3).reverse().map(r => row({ title: `${esc(resultText(r))}${r.variant ? ` · ${esc(VARIANTS[r.variant])}` : ''}`, sub: `${esc(LEVELS[r.tier])} try · ${esc(new Date(r.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}`, value: passes(r) ? 'Cleared' : '', chevron: false })).join('');
  app.sheet(`<h2 class="sheet-title">${esc(SHOTS[id])}</h2><p class="sheet-sub">${st.started ? `${esc(st.level)}${st.best && st.next ? ` · best toward ${esc(LEVELS[st.next])}: ${esc(resultText(st.best))}` : ''}` : 'Not started. Your first result sets where you start.'}</p>
    ${group(tiers, { header: 'Tiers' })}${recent ? group(recent, { header: 'Recent results' }) : ''}
    <div class="btns"><button class="btn filled" data-action="shot-log" data-id="${id}">Log a Result</button>
    ${focusShot() !== id ? `<button class="btn plain" data-action="shot-focus" data-id="${id}">Make This My Focus Shot</button>` : ''}</div>`);
}

// History: a session's results.
export const drillsGroup = drills => drills?.length ? group(drills.map(r => row({ title: `${esc(SHOTS[r.shot] || r.shot)}${r.variant ? ` · ${esc(VARIANTS[r.variant])}` : ''}`, sub: `${esc(LEVELS[r.tier] || '')} try`, value: `${esc(resultText(r))}${passes(r) ? ' ✓' : ''}` })).join(''), { header: 'Shot challenges' }) : '';

// The shot sheet's buttons, for any view that opens it (Train tab, Your Profile).
export const challengeActions = {
  'shot-sheet'(el) { shotSheet(el.dataset.id); },
  'shot-log'(el) { app.closeSheet(); activitySheet('padel', null, null, el.dataset.id); },
  async 'shot-focus'(el) { S.settings.focusShot = el.dataset.id; await app.save('settings'); app.closeSheet(); app.render({ keepScroll: true }); app.toast('Focus shot set'); },
};
