// Rest timer anchored to an absolute end time, so it survives background throttling,
// reloads and app kills. Renders into its own bar; never re-renders the page.
import { getMeta, setMeta } from './core-db.js';

let t = { endAt: 0, total: 0, paused: null, label: '' };
let opts = { sound: true, vibrate: true };
let el, ctx, firedFor = 0, onDone = () => {};
// Shown when you come back after the rest ended while the screen was off or the app hidden.
let late = null, lateTimer = 0;
const LATE_MIN = 5000, LATE_MAX = 30 * 60000;
export const lateText = (endedAt, now = Date.now()) => { const s = Math.round((now - endedAt) / 1000); return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`; };

const remaining = () => t.paused != null ? t.paused : Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
const active = () => t.paused != null || t.endAt > Date.now();
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const save = () => setMeta('timer', t).catch(() => {});

export async function initTimer(bar, settings, done) {
  el = bar; onDone = done || onDone; configure(settings);
  t = { ...t, ...(await getMeta('timer', t)) };
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-timer]')?.dataset.timer;
    if (a === 'skip') stop();
    else if (a === 'late-ok') dismissLate();
    else if (a === 'toggle') toggle();
    else if (a) adjust(+a);
  });
  // Unlock audio on the first touch (iOS requires a user gesture).
  addEventListener('pointerdown', unlockAudio, { once: true });
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);
  draw();
}
export function configure(s) { opts = { sound: s.sound !== false, vibrate: s.vibrate !== false }; }

function unlockAudio() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch {} }
function beep() {
  if (!opts.sound || !ctx) return;
  try {
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880; o.connect(g); g.connect(ctx.destination);
      const at = ctx.currentTime + d;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.4, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      o.start(at); o.stop(at + 0.2);
    });
  } catch {}
}

export function start(seconds, label = '') {
  late = null; clearTimeout(lateTimer);
  unlockAudio();
  t = { endAt: Date.now() + seconds * 1000, total: seconds, paused: null, label };
  firedFor = 0; save(); draw();
}
export function stop() { t = { endAt: 0, total: 0, paused: null, label: '' }; save(); draw(); }
function toggle() {
  if (t.paused != null) { t.endAt = Date.now() + t.paused * 1000; t.paused = null; }
  else { t.paused = remaining(); }
  save(); draw();
}
function adjust(d) {
  const r = Math.max(0, remaining() + d);
  t.total = Math.max(t.total + d, r);
  if (t.paused != null) t.paused = r; else t.endAt = Date.now() + r * 1000;
  save(); draw();
}

function tick() {
  if (!el) return;
  if (t.endAt && t.paused == null && t.endAt <= Date.now()) {
    if (firedFor !== t.endAt) {
      firedFor = t.endAt;
      const age = Date.now() - t.endAt;
      // Came back after the rest ended (screen locked or app in the background): say so.
      if (age >= LATE_MIN && age < LATE_MAX) {
        late = { endedAt: t.endAt, label: t.label };
        beep(); onDone(); stop();
        clearTimeout(lateTimer); lateTimer = setTimeout(dismissLate, 12000);
        return;
      }
      // Only alert if it finished just now; a stale timer from yesterday should just clear.
      if (age < LATE_MIN) {
        beep();
        if (opts.vibrate) navigator.vibrate?.([200, 100, 200, 100, 300]);
        if (document.hidden && globalThis.Notification?.permission === 'granted') navigator.serviceWorker?.ready.then(r => r.showNotification('Rest over', { body: t.label ? `Next: ${t.label}` : 'Time for your next set', tag: 'rest', renotify: true })).catch(() => {});
        onDone();
      }
      stop();
      return;
    }
  }
  if (active()) {
    const r = remaining();
    const n = el.querySelector('.rest-time'); if (n) n.textContent = fmt(r);
    const p = el.querySelector('.rest-fill'); if (p) p.style.transform = `scaleX(${t.total ? r / t.total : 0})`;
  }
}

function dismissLate() { clearTimeout(lateTimer); late = null; draw(); }

function draw() {
  if (!el) return;
  if (late && !active()) {
    el.hidden = false; document.body.classList.add('resting');
    el.innerHTML = `<div class="rest-main"><span class="lbl-rest">${late.label ? `Next: ${late.label}` : 'Time for your next set'}</span><b class="rest-time late">Rest ended ${lateText(late.endedAt)}</b></div>
      <button data-timer="late-ok" class="rest-skip">OK</button>`;
    return;
  }
  const on = active();
  el.hidden = !on;
  document.body.classList.toggle('resting', on);
  if (!on) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="rest-fill"></div>
    <div class="rest-main"><span class="lbl-rest">Rest${t.label ? ` · next: ${t.label}` : ''}</span><b class="rest-time">${fmt(remaining())}</b></div>
    <button data-timer="15" aria-label="Add 15 seconds">+15</button>
    <button data-timer="toggle" aria-label="${t.paused != null ? 'Resume' : 'Pause'} timer">${t.paused != null ? 'Resume' : 'Pause'}</button>
    <button data-timer="skip" class="rest-skip">Skip</button>`;
  tick();
}
export const isResting = active;
