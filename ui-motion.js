// Motion that explains a change: things move from where they were to where they are now, never as decoration.
// Web Animations only (transform and opacity), so it stays smooth and needs no library. With Reduce Motion on,
// every helper skips straight to the end state. See ANIMATIONS.md.
export const MS = { fast: 180, med: 320, slow: 550 };
export const EASE = 'cubic-bezier(.2, .8, .2, 1)', BACK = 'cubic-bezier(.3, 1.4, .5, 1)';
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Pure helpers (tested).
export const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const lerp = (a, b, t) => a + (b - a) * t;
// Did any score change since the scores you last saw? First visit (nothing seen) counts as no change.
export const scoresChanged = (seen, now) => !!seen && Object.keys(now).some(k => Math.round(now[k]) !== Math.round(seen[k] ?? 0));

// FLIP: keyed children ([data-k]) move from their old place to their new one when `mutate` re-renders the container.
// New keys drop in; keys that disappear leave a fading copy where they were.
export function flip(container, mutate, { ms = MS.slow, stagger = 40 } = {}) {
  if (!container || reduced()) { mutate(); return; }
  const host = container.getBoundingClientRect();
  const old = new Map([...container.querySelectorAll('[data-k]')].map(el => [el.dataset.k, { r: el.getBoundingClientRect(), html: el.outerHTML }]));
  mutate();
  const seen = new Set();
  [...container.querySelectorAll('[data-k]')].forEach((el, i) => {
    const k = el.dataset.k, o = old.get(k), r = el.getBoundingClientRect(); seen.add(k);
    if (o) {
      const dx = o.r.left - r.left, dy = o.r.top - r.top;
      if (Math.abs(dx) + Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 2 }, { transform: 'none', zIndex: 2 }], { duration: ms, easing: EASE, delay: i * stagger, fill: 'backwards' });
    } else el.animate([{ transform: 'translateY(-16px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: ms, easing: BACK, delay: 120, fill: 'backwards' });
  });
  // Gone: a copy fades and shrinks where it was.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  for (const [k, o] of old) if (!seen.has(k)) {
    const t = document.createElement('template'); t.innerHTML = o.html; const g = t.content.firstElementChild;
    Object.assign(g.style, { position: 'absolute', left: `${o.r.left - host.left}px`, top: `${o.r.top - host.top}px`, width: `${o.r.width}px`, height: `${o.r.height}px`, margin: 0, pointerEvents: 'none' });
    g.removeAttribute('data-k'); container.appendChild(g);
    g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: MS.med, easing: EASE, fill: 'forwards' }).onfinish = () => g.remove();
    setTimeout(() => g.remove(), MS.med + 400);   // never left behind, even if the animation is delayed
  }
}

// One-shot pop for a chip or badge that just changed.
export function stamp(el) {
  if (!el || reduced()) return;
  el.animate([{ transform: 'scale(1.6) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MS.med, easing: BACK });
}
// Fade and rise in, for lines that are new (optionally one after another).
export function rise(els, { delay = 0, stagger = 60 } = {}) {
  if (reduced()) return;
  [...els].forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: MS.med, easing: EASE, delay: delay + i * stagger, fill: 'backwards' }));
}
// Animate t from 0 to 1 over ms, calling step(eased t); jumps to the end with Reduce Motion.
export function tween(ms, step) {
  if (reduced()) { step(1); return; }
  const t0 = performance.now();
  const frame = now => { const t = Math.min(1, (now - t0) / ms); step(easeOut(t)); if (t < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}

// Spotlight: the in-app pop-out. What changed lifts a little with a lime glow while what's around it dims, for about
// half a second, then everything settles where it was. Nothing moves away, covers anything or blocks a tap.
// els: one element or several that changed together (one moment); within: the container whose other children dim.
// With Reduce Motion: a still lime outline for a moment instead.
export function spotlight(els, { within = null, ms = 650, say = '' } = {}) {
  const list = [].concat(els || []).filter(Boolean);
  if (say) announce(say);
  if (!list.length) return;
  if (reduced()) { list.forEach(el => { el.classList.add('spot-still'); setTimeout(() => el.classList.remove('spot-still'), 1200); }); return; }
  const svg = el => el instanceof SVGElement;
  list.forEach(el => {
    if (svg(el)) { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; }
    el.animate(svg(el) ? [{ transform: 'none' }, { transform: 'scale(1.18)', offset: .35 }, { transform: 'none' }]
      : [{ transform: 'none', boxShadow: '0 0 0 0 rgba(210,238,60,0)' }, { transform: 'scale(1.06)', boxShadow: '0 0 0 3px rgba(210,238,60,.9), 0 0 24px rgba(210,238,60,.5)', offset: .35 }, { transform: 'none', boxShadow: '0 0 0 0 rgba(210,238,60,0)' }],
      { duration: ms, easing: EASE });
  });
  if (within) [...within.children].filter(c => !list.some(el => c === el || c.contains(el))).forEach(c =>
    c.animate([{ opacity: 1 }, { opacity: .5, offset: .35 }, { opacity: 1 }], { duration: ms, easing: EASE }));
}
// Say a change out loud for screen readers (motion alone shouldn't carry the information).
export function announce(text) {
  let el = document.getElementById('live');
  if (!el) { el = document.createElement('div'); el.id = 'live'; el.setAttribute('aria-live', 'polite'); el.className = 'sr-only'; document.body.appendChild(el); }
  el.textContent = ''; setTimeout(() => { el.textContent = text; }, 50);
}
