// Short guided routines for court days and injury prevention. Each step is timed;
// rep-based moves are given a time window so the player can run hands-free.
const s = (name, sec, cue, side = false) => ({ name, sec, cue, side });

export const COURT_ROUTINES = {
  warmup: {
    id: 'warmup', title: 'Pre-match warm-up', kind: 'court', tag: 'Before you play', areas: [],
    blurb: 'Raise temperature, open hips and shoulders, then wake up fast feet. Do it on court.',
    steps: [
      s('Easy jog + side shuffles', 60, 'Jog the length of the court and back, then shuffle side to side. Stay light.'),
      s('Leg swings, front–back', 30, 'Hold the fence. Swing one leg relaxed through a growing range.', true),
      s('Leg swings, side–side', 30, 'Face the fence, swing across the body and out.', true),
      s('Walking lunge + reach', 45, 'Long step, drop the back knee, reach both arms up and rotate toward the front leg.'),
      s('Lateral lunge rock', 40, 'Wide stance, shift side to side, keep feet flat.'),
      s('Arm circles + band pull-aparts', 45, 'Small to big circles both ways, then pull a band or imaginary band apart.'),
      s('Thoracic rotations', 40, 'Split stance, hands together in front, rotate open as far as is comfortable.'),
      s('Wrist & forearm prep', 30, 'Circle the wrists, then gently stretch palm-up and palm-down.'),
      s('Split-step + reaction', 45, 'Small hop, land on the balls of your feet, explode to a random direction. Reset.'),
      s('Shadow strokes', 60, 'Bandeja, volley, bajada, at 50% then 80%. Move your feet into each one.'),
      s('2 short sprints', 30, 'Net to back glass twice, decelerate under control.'),
    ] },
  cooldown: {
    id: 'cooldown', title: 'Post-match cool-down', kind: 'court', tag: 'After you play', areas: [],
    blurb: 'Bring the heart rate down and ease the areas padel loads most.',
    steps: [
      s('Easy walk + deep breaths', 60, 'Walk slowly, breathe in through the nose for 4, out for 6.'),
      s('Calf stretch against fence', 40, 'Back heel down, knee straight then bent.', true),
      s('Hip flexor stretch', 40, 'Half kneel, squeeze the back glute, lean forward gently.', true),
      s('Adductor rock-backs', 40, 'On hands and knees with one leg out to the side, rock hips back.'),
      s('Doorway / fence chest stretch', 40, 'Forearm on the fence at shoulder height, turn gently away.', true),
      s('Forearm stretches', 40, 'Arm straight, gently pull fingers down then up.', true),
      s('Child’s pose breathing', 60, 'Sit back on heels, arms long, slow breaths into the lower back.'),
    ] },
  elbow: {
    id: 'elbow', title: 'Elbow & forearm', kind: 'prehab', tag: 'Padel elbow', areas: ['elbow'],
    blurb: 'Slow loading for the tendons on the outside of the elbow. Mild discomfort (≤3/10) is OK; sharp pain is not.',
    steps: [
      s('Wrist extension, slow lowering', 60, 'Forearm on knee, palm down, light weight or bottle. Lift with help, lower over 4 s.', true),
      s('Wrist flexion, slow lowering', 45, 'Palm up, same slow lowering.', true),
      s('Pronation / supination', 45, 'Hold a hammer or racket at the end, rotate slowly side to side.', true),
      s('Isometric wrist extension hold', 45, 'Press the back of the hand up into your other hand, 5 × 8 s holds.', true),
      s('Grip squeezes', 40, 'Squeeze a ball or towel 3 s, relax 2 s.', true),
      s('Forearm stretch', 30, 'Gentle stretch, palm down then up.', true),
    ] },
  shoulder: {
    id: 'shoulder', title: 'Shoulder health', kind: 'prehab', tag: 'Overhead shots', areas: ['shoulder'],
    blurb: 'Rotator cuff and shoulder-blade control for bandejas, viboras and smashes.',
    steps: [
      s('Band external rotation', 50, 'Elbow pinned to your side, rotate the forearm out slowly.', true),
      s('Band internal rotation', 40, 'Same position, rotate in, slow return.', true),
      s('Wall slides', 45, 'Forearms on the wall, slide up while keeping ribs down.'),
      s('Prone Y-T-W', 60, 'Face down, thumbs up, lift arms into Y, T then W shapes. Hold 2 s each.'),
      s('Sleeper stretch', 40, 'Lie on your side, gently press the forearm down. No pinching.', true),
      s('Scap push-ups', 40, 'In a plank, let the chest sink between the shoulder blades, then push away.'),
    ] },
  back: {
    id: 'back', title: 'Lower back reset', kind: 'prehab', tag: 'Rotation & bending', areas: ['back'],
    blurb: 'Trunk endurance and hip mobility so rotation comes from hips and upper back.',
    steps: [
      s('Cat–camel', 40, 'Slowly round and arch through the whole spine.'),
      s('Bird dog', 60, 'Opposite arm and leg out, hold 3 s, hips level.', true),
      s('Side plank (knees)', 40, 'Straight line from knees to head, breathe.', true),
      s('Dead bug', 50, 'Low back gently down, extend opposite arm and leg slowly.'),
      s('Glute bridge', 45, 'Drive through heels, squeeze glutes at the top for 2 s.'),
      s('90/90 hip switches', 45, 'Sit with both knees bent at 90°, rotate knees side to side.'),
      s('Open book', 40, 'Lie on your side, knees bent, rotate the top arm open.', true),
    ] },
  knee: {
    id: 'knee', title: 'Knee & hip control', kind: 'prehab', tag: 'Lunges & landings', areas: ['knee'],
    blurb: 'Strength around the knee and hip for deep lunges and quick stops.',
    steps: [
      s('Spanish squat / wall sit', 45, 'Back against a wall, knees at ~70°, hold. Mild effort around the kneecap is normal.'),
      s('Side-lying leg raise', 45, 'Top leg straight, toes slightly down, lift and lower slowly.', true),
      s('Step-downs', 50, 'Off a low step, lower the heel to touch the floor, knee tracking over toes.', true),
      s('Single-leg balance + reach', 45, 'Stand on one leg, reach the other foot forward, side and back.', true),
      s('Monster walks', 40, 'Band above knees, small steps forward and sideways, stay low.'),
      s('Quad stretch', 30, 'Gentle heel to glute, knees together.', true),
    ] },
  calf: {
    id: 'calf', title: 'Calf & Achilles', kind: 'prehab', tag: 'Push-offs', areas: ['calf', 'ankle'],
    blurb: 'Calf strength protects against the classic “tennis leg” strain and Achilles irritation.',
    steps: [
      s('Double-leg calf raise', 45, 'Up in 1 s, pause, down over 3 s.'),
      s('Single-leg calf raise', 50, 'On a step if you can, full range, slow lowering.', true),
      s('Bent-knee calf raise', 45, 'Knee bent ~30° to hit the soleus.', true),
      s('Tibialis raise', 40, 'Back against a wall, lift toes up, lower slowly.'),
      s('Ankle hops', 30, 'Small, quick, quiet hops on the balls of the feet.'),
      s('Single-leg balance', 40, 'Eyes closed if it is easy.', true),
      s('Calf stretch', 30, 'Straight knee, then bent knee.', true),
    ] },
};

export const AREA_ROUTINE = { elbow: 'elbow', shoulder: 'shoulder', back: 'back', knee: 'knee', calf: 'calf', ankle: 'calf' };

// Side-by-side steps run once per side.
export function expandSteps(routine) {
  return routine.steps.flatMap(st => st.side
    ? [{ ...st, name: `${st.name} · left`, sec: st.sec }, { ...st, name: `${st.name} · right`, sec: st.sec }]
    : [st]);
}
export const routineSeconds = r => expandSteps(r).reduce((n, st) => n + st.sec, 0);
export const routineMinutes = r => Math.round(routineSeconds(r) / 60);
