// Backups in one tap: on iPhone the share sheet opens, so you can save to Files or iCloud Drive
// (or AirDrop it). Elsewhere it falls back to a normal download.
import { app, S, DEFAULT_SETTINGS, applyTheme } from './core-app.js';
import * as db from './core-db.js';
import * as cloud from './core-cloud.js';
import { buildBackup, validateBackup, normalizeBackup, restoreMeta, backupSummary } from './domain-backup.js';
import { esc, group, row } from './ui-kit.js';
import { setCustomExercises, setStartWeights, applyExerciseEdits } from './domain-catalog.js';
import { upgradeSaved } from './domain-muscles.js';
import { setCustomRoutines } from './domain-program.js';
import { isoDate } from './domain-calendar.js';

// Returns false only when you cancelled the share sheet.
export async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

export async function saveBackup() {
  const meta = await db.allMeta(); delete meta.timer; delete meta.cloud;   // the GitHub key never goes into a file
  const ok = await saveFile(`padel-os-backup-${isoDate()}.json`, JSON.stringify(buildBackup(meta, S.sessions)), 'application/json');
  if (!ok) return;
  S.lastBackup = Date.now(); await app.save('lastBackup'); app.render({ keepScroll: true });
  app.toast(`Backup saved · ${S.sessions.length} sessions`);
}

// "12 workouts, 5 matches" (and other activities), in plain words.
const n = (k, w) => `${k} ${w}${k === 1 ? '' : w.endsWith('ch') ? 'es' : 's'}`;
export const contents = sessions => summaryText(backupSummary(sessions));
export function summaryText(b) {
  const other = b.sessions - b.workouts - b.matches;
  const parts = [b.workouts && n(b.workouts, 'workout'), b.matches && n(b.matches, 'match'), other && n(other, 'other activity').replace('activitys', 'activities')].filter(Boolean);
  return parts.length ? parts.join(', ') : 'no sessions yet';
}
const day = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Restore from a backup (a file, or the online copy). Shows what's in it, then adds to or replaces this phone.
export async function restoreFromData(data, { online = false } = {}) {
  const v = validateBackup(data);
  if (!v.ok) return app.toast(v.errors.join(' '));
  const norm = normalizeBackup(data);
  const existing = new Set(S.sessions.map(s => s.id)), inFile = new Set(norm.sessions.map(s => s.id));
  const fresh = norm.sessions.filter(s => !existing.has(s.id)).length, lost = S.sessions.filter(s => !inFile.has(s.id)).length;
  const fb = backupSummary(norm.sessions);
  const made = data.exportedAt ? `Made ${day(Date.parse(data.exportedAt))}. ` : '';
  const range = !fb.first ? '' : day(fb.first) === day(fb.last) ? ` on ${day(fb.first)}` : ` from ${day(fb.first)} to ${day(fb.last)}`;
  app.sheet(`<h2 class="sheet-title">${online ? 'Restore online copy' : 'Restore backup'}</h2>
    <p class="sheet-sub">${esc(made)}It holds ${esc(contents(norm.sessions))}${esc(range)}. ${fresh} ${fresh === 1 ? 'is' : 'are'} new to this phone.${v.version === 1 ? ' It’s from the original PADEL OS and will be converted.' : ''}</p>
    ${v.errors.length ? `<p class="t-sub ${v.incomplete ? 'red' : 'orange'}" style="margin:-8px 4px 16px">${v.errors.map(esc).join(' ')}</p>` : ''}
    ${group(row({ title: 'Add to what’s here', sub: 'Keeps everything on this phone and adds what’s missing. Safe.', action: 'noop', data: { mode: 'merge' }, chevron: false }).replace('data-action="noop"', '')
      + row({ title: 'Replace everything', sub: lost ? `Erases this phone first. ${lost} session${lost === 1 ? '' : 's'} here ${lost === 1 ? 'is' : 'are'} not in the backup and will be lost.` : 'Erases this phone first. Everything here is also in the backup.', action: 'noop', data: { mode: 'replace' }, chevron: false, cls: 'red' }).replace('data-action="noop"', ''))}
    ${S.sessions.length ? '<button class="btn tinted" id="safeCopy">Back Up This Phone First</button>' : ''}
    <button class="btn gray" data-action="close-sheet">Cancel</button>`, body => {
    body.querySelector('#safeCopy')?.addEventListener('click', () => saveBackup());
    body.querySelectorAll('[data-mode]').forEach(b => b.onclick = async () => {
      if (b.dataset.mode === 'replace' && (lost || v.incomplete)) {
        const why = [lost ? `${lost} session${lost === 1 ? '' : 's'} on this phone ${lost === 1 ? 'isn’t' : 'aren’t'} in the backup` : '', v.incomplete ? 'the file looks incomplete' : ''].filter(Boolean).join(' and ');
        if (!(await app.confirm(`Replace everything? ${esc(why[0].toUpperCase() + why.slice(1))}. Back up this phone first if you’re not sure.`, { ok: 'Replace Anyway', danger: true }))) return;
      }
      // Replacing wipes this phone first; the online copy's key is kept so it carries on.
      if (b.dataset.mode === 'replace') { await db.clearAll(); await cloud.keep(); }
      const keep = b.dataset.mode === 'merge' ? new Set(S.sessions.map(s => s.id)) : new Set();
      await db.putSessions(norm.sessions.filter(s => !keep.has(s.id)));
      for (const [k, v] of Object.entries(restoreMeta(S, norm.meta, b.dataset.mode, DEFAULT_SETTINGS))) { S[k] = v; await app.save(k); }
      if (b.dataset.mode === 'replace' && S.active) await app.saveActive(true);
      for (const k of upgradeSaved(S)) await app.save(k);
      applyTheme(); setCustomExercises(S.customExercises); applyExerciseEdits(S.exerciseEdits); setCustomRoutines(S.customRoutines); setStartWeights(S.startWeights);
      await app.reloadSessions(); app.closeSheet(); app.toast(online ? 'Online copy restored' : 'Backup restored'); app.render();
    });
  });
}
