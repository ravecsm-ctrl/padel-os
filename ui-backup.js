// Backups in one tap: on iPhone the share sheet opens, so you can save to Files or iCloud Drive
// (or AirDrop it). Elsewhere it falls back to a normal download.
import { app, S } from './core-app.js';
import * as db from './core-db.js';
import { buildBackup } from './domain-backup.js';
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
  const meta = await db.allMeta(); delete meta.timer;
  const ok = await saveFile(`padel-os-backup-${isoDate()}.json`, JSON.stringify(buildBackup(meta, S.sessions)), 'application/json');
  if (!ok) return;
  S.lastBackup = Date.now(); await app.save('lastBackup'); app.render({ keepScroll: true });
  app.toast(`Backup saved · ${S.sessions.length} sessions`);
}
