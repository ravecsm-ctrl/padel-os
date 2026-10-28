// Exercise catalog. Every exercise has a stable id so history survives renames.
// fields: what gets logged per set. 'w' = load (kg, canonical), 'reps', 'sec', 'm'.
// The last field is the "target" field that the rep/time/distance range applies to.
// inc: smallest sensible load jump in kg. quality: power work — never chase reps.

const x = (id, name, fields, o) => ({
  id, name, fields,
  perSide: false, quality: false, inc: 2.5, loadNote: '', equipment: 'Gym equipment',
  muscles: '', pattern: '', subs: [],
  why: '', setup: '', execute: '', avoid: '',
  breathe: 'Brace before the rep; exhale through the effort without losing position.',
  ...o,
});

const LIST = [
  // ── Routine A — Lower force & deceleration
  x('trap-bar-deadlift', 'Trap-bar deadlift', ['w', 'reps'], { inc: 5, equipment: 'Trap bar', pattern: 'hinge', muscles: 'Quads · glutes · hamstrings · back', subs: ['romanian-deadlift', 'leg-press', 'goblet-squat'],
    why: 'Stronger first step and braking base.', setup: 'Stand centered in the bar, feet hip-width, brace, then grip.', execute: 'Push the floor away; finish tall without leaning back.', avoid: 'Rounding the back; hips shooting up; bouncing the plates.' }),
  x('rfess', 'Rear-foot-elevated split squat', ['w', 'reps'], { perSide: true, inc: 2, loadNote: 'per hand', equipment: 'Bench + dumbbells', pattern: 'single-leg', muscles: 'Quads · glutes · adductors', subs: ['reverse-lunge', 'step-up-knee-drive'],
    why: 'Single-leg force for lunges and recovery steps.', setup: 'Rear foot supported; front foot far enough to keep balance.', execute: 'Lower straight down; drive through the whole front foot.', avoid: 'Front knee collapsing inward; pushing off the rear leg.' }),
  x('lateral-lunge', 'Lateral lunge', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Dumbbell optional', pattern: 'lateral', muscles: 'Adductors · glute med · quads', subs: ['cossack-squat'],
    why: 'Strengthens wide defensive positions.', setup: 'Take a wide stance with toes mostly forward.', execute: 'Sit into one hip while the other leg stays long; push back.', avoid: 'Heel lifting; knee caving; torso collapsing.' }),
  x('sl-rdl', 'Single-leg Romanian deadlift', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Dumbbell or kettlebell', pattern: 'hinge', muscles: 'Hamstrings · glutes · foot', subs: ['kickstand-rdl', 'romanian-deadlift'],
    why: 'Posterior-chain control and balance.', setup: 'Soft knee, tripod foot, weight close to the body.', execute: 'Reach the free leg back while hinging; keep hips square.', avoid: 'Opening the hip; rounding; reaching weight away.' }),
  x('copenhagen-short', 'Copenhagen plank (short lever)', ['sec'], { perSide: true, equipment: 'Bench', pattern: 'adductor', muscles: 'Adductors · obliques', subs: ['side-plank', 'cable-adduction'],
    why: 'Adductor capacity for lateral pushes.', setup: 'Top knee on bench, elbow under shoulder.', execute: 'Lift hips into a straight line and hold steadily.', avoid: 'Shoulder shrugging; hips sagging; progressing too fast.' }),
  x('pallof-press', 'Pallof press', ['w', 'reps'], { perSide: true, equipment: 'Cable or band', pattern: 'anti-rotation', muscles: 'Obliques · deep trunk', subs: ['side-plank', 'dead-bug'],
    why: 'Resists unwanted rotation during strokes.', setup: 'Stand side-on to cable, feet stable, handle at sternum.', execute: 'Press straight out without letting torso rotate.', avoid: 'Leaning; flared ribs; rushing.' }),
  x('standing-calf-raise', 'Standing calf raise', ['w', 'reps'], { inc: 5, equipment: 'Machine or step', pattern: 'calf', muscles: 'Gastrocnemius · soleus', subs: ['sl-calf-raise', 'seated-soleus-raise'],
    why: 'Ankle stiffness and repeated court movement.', setup: 'Balls of feet secure, knees softly unlocked.', execute: 'Rise fully, pause, lower under control.', avoid: 'Bouncing; rolling ankles outward; partial range.' }),
  x('tibialis-raise', 'Tibialis raise', ['reps'], { equipment: 'Wall', pattern: 'calf', muscles: 'Tibialis anterior',
    why: 'Supports braking and shin/ankle capacity.', setup: 'Back against wall, heels down, feet forward.', execute: 'Lift toes toward shins; pause; lower slowly.', avoid: 'Heels lifting; rocking; rushing.' }),

  // ── Routine B — Upper strength & rotation
  x('landmine-press', 'Half-kneeling landmine press', ['w', 'reps'], { perSide: true, equipment: 'Landmine', pattern: 'press', muscles: 'Deltoid · serratus · triceps', subs: ['hk-db-press', 'incline-db-press'],
    why: 'Overhead strength with scapular upward rotation.', setup: 'Inside knee down; ribs stacked; bar at shoulder.', execute: 'Press up and forward, letting shoulder blade rotate.', avoid: 'Arching low back; shrugging; twisting.' }),
  x('chest-supported-row', 'Chest-supported row', ['w', 'reps'], { inc: 2, loadNote: 'per hand', equipment: 'Bench + dumbbells', pattern: 'pull', muscles: 'Lats · mid-back · rear delts', subs: ['seated-cable-row', 'inverted-row'],
    why: 'Scapular control and stroke balance.', setup: 'Chest on inclined bench, arms long.', execute: 'Pull elbows toward hips; pause without shrugging.', avoid: 'Lifting chest; jerking; shoulders to ears.' }),
  x('incline-db-press', 'Incline dumbbell press, neutral grip', ['w', 'reps'], { inc: 2, loadNote: 'per hand', equipment: 'Bench + dumbbells', pattern: 'press', muscles: 'Chest · triceps · front delts', subs: ['push-up', 'landmine-press'],
    why: 'Pressing strength in a shoulder-friendly path.', setup: 'Low incline, palms facing, shoulder blades comfortable.', execute: 'Lower with control to a pain-free depth; press evenly.', avoid: 'Elbows flared; bouncing; excessive arch.' }),
  x('cable-row-rotation', 'Single-arm cable row with rotation', ['w', 'reps'], { perSide: true, equipment: 'Cable', pattern: 'pull', muscles: 'Back · obliques', subs: ['sa-db-row'],
    why: 'Coordinates upper-back rotation with pulling.', setup: 'Athletic stance facing cable, arm long.', execute: 'Row while rotating through the upper back; return slowly.', avoid: 'Twisting lumbar spine; yanking; shoulder shrug.' }),
  x('cable-er', 'Cable external rotation at side', ['w', 'reps'], { perSide: true, inc: 1.25, equipment: 'Cable or band', pattern: 'cuff', muscles: 'Rotator cuff', subs: ['side-lying-er'],
    why: 'Improves shoulder capacity for repeated shots.', setup: 'Elbow pinned to side at 90°, very light load.', execute: 'Rotate forearm outward without moving elbow.', avoid: 'Too much load; wrist bending; torso turning.' }),
  x('face-pull', 'Face pull', ['w', 'reps'], { equipment: 'Cable rope', pattern: 'pull', muscles: 'Rear delts · mid-back · external rotators', subs: ['band-face-pull', 'band-pull-apart'],
    why: 'Balances pressing and supports shoulder position.', setup: 'Rope at eye height; stand tall.', execute: 'Pull toward face and separate rope ends.', avoid: 'Lumbar lean; shrugging; elbows dropping.' }),
  x('wrist-rotation', 'Wrist pronation / supination', ['w', 'reps'], { perSide: true, inc: 1, equipment: 'Light dumbbell', pattern: 'forearm', muscles: 'Forearm rotators',
    why: 'Racket control and forearm endurance.', setup: 'Support forearm; hold one end of a light dumbbell.', execute: 'Rotate palm down then up through controlled range.', avoid: 'Heavy load; moving elbow; fast drops.' }),
  x('farmer-carry', 'Farmer carry', ['w', 'm'], { inc: 2, loadNote: 'per hand', equipment: 'Heavy dumbbells', pattern: 'carry', muscles: 'Grip · trunk · scapular stabilizers', subs: ['suitcase-carry'],
    why: 'Grip endurance and whole-body stiffness.', setup: 'Pick up evenly, shoulders relaxed, stand tall.', execute: 'Walk with short controlled steps and quiet trunk.', avoid: 'Leaning; rushing; holding breath.' }),

  // ── Routine C — Power & athletic resilience
  x('cmj', 'Countermovement jump', ['reps'], { quality: true, equipment: 'Bodyweight', pattern: 'power', muscles: 'Quads · glutes · calves', subs: ['box-jump'],
    why: 'High-quality lower-body power.', setup: 'Stand tall with clear landing space.', execute: 'Dip quickly, jump hard, land softly and reset fully.', avoid: 'Fatigue reps; knees caving; stiff landings.' }),
  x('lateral-bound', 'Lateral bound to stick', ['reps'], { perSide: true, quality: true, equipment: 'Bodyweight', pattern: 'power', muscles: 'Glutes · quads · ankle', subs: ['skater-hop'],
    why: 'Lateral power plus deceleration control.', setup: 'Balance on one leg with space to the side.', execute: 'Bound laterally; land on opposite foot and hold 2 seconds.', avoid: 'Chasing distance; unstable knee; immediate rebound.' }),
  x('mb-scoop-toss', 'Medicine-ball rotational scoop toss', ['w', 'reps'], { perSide: true, quality: true, inc: 1, equipment: 'Medicine ball', pattern: 'power', muscles: 'Hips · trunk · shoulder', subs: ['cable-woodchop'],
    why: 'Ground-up rotational power for strokes.', setup: 'Stand side-on to solid wall, ball near back hip.', execute: 'Drive from ground and hips; release fast; reset.', avoid: 'Arming the throw; lumbar twisting; unsafe wall.' }),
  x('goblet-squat', 'Goblet squat', ['w', 'reps'], { inc: 2, equipment: 'Dumbbell or kettlebell', pattern: 'squat', muscles: 'Quads · glutes · trunk', subs: ['leg-press', 'rfess'],
    why: 'Robust squat pattern and leg capacity.', setup: 'Hold weight at chest; stable shoulder-width stance.', execute: 'Sit between hips, keep full foot down, stand tall.', avoid: 'Heels lifting; knees caving; losing brace.' }),
  x('step-up-knee-drive', 'Step-up with knee drive', ['w', 'reps'], { perSide: true, inc: 2, loadNote: 'per hand', equipment: 'Box', pattern: 'single-leg', muscles: 'Quads · glutes · hip flexors', subs: ['rfess', 'reverse-lunge'],
    why: 'Single-leg drive and balance.', setup: 'Whole working foot on a stable box.', execute: 'Drive through box leg and finish with opposite knee up.', avoid: 'Pushing off floor foot; uncontrolled descent.' }),
  x('slider-curl', 'Hamstring slider curl', ['reps'], { equipment: 'Sliders or towels', pattern: 'hamstring', muscles: 'Hamstrings · glutes', subs: ['nordic-assisted', 'leg-curl'],
    why: 'Hamstring resilience for acceleration and braking.', setup: 'Lie down, heels on sliders, hips lifted.', execute: 'Extend legs slowly, then curl heels in while hips stay up.', avoid: 'Hips dropping; arching back; moving too fast.' }),
  x('seated-soleus-raise', 'Seated soleus raise', ['w', 'reps'], { inc: 5, equipment: 'Machine or plate', pattern: 'calf', muscles: 'Soleus', subs: ['standing-calf-raise'],
    why: 'Repeated movement and ankle endurance.', setup: 'Sit with knees bent, forefeet supported, load over knees.', execute: 'Raise heels, pause at top, lower fully.', avoid: 'Bouncing; short range; feet rolling.' }),
  x('band-ankle', 'Band ankle inversion / eversion', ['reps'], { perSide: true, equipment: 'Resistance band', pattern: 'ankle', muscles: 'Ankle stabilizers', subs: ['sl-balance'],
    why: 'Builds controlled ankle strength in both directions.', setup: 'Sit with lower leg still and band anchored safely.', execute: 'Move forefoot inward/outward through a small clean range.', avoid: 'Moving knee; snapping band; excessive range.' }),

  // ── Substitutes
  x('romanian-deadlift', 'Romanian deadlift', ['w', 'reps'], { inc: 5, equipment: 'Barbell', pattern: 'hinge', muscles: 'Hamstrings · glutes · back', subs: ['trap-bar-deadlift'],
    why: 'Hinge strength when no trap bar is free.', setup: 'Bar at hips, soft knees, lats tight.', execute: 'Push hips back until hamstrings load; stand by driving hips forward.', avoid: 'Rounding; bar drifting from legs; squatting it down.' }),
  x('leg-press', 'Leg press', ['w', 'reps'], { inc: 10, equipment: 'Leg press machine', pattern: 'squat', muscles: 'Quads · glutes', subs: ['goblet-squat'],
    why: 'Heavy leg force with low technical demand.', setup: 'Feet shoulder-width mid-platform, low back flat on pad.', execute: 'Lower until hips start to tuck, press through whole foot.', avoid: 'Butt lifting off pad; locking knees hard; knees caving.' }),
  x('reverse-lunge', 'Reverse lunge', ['w', 'reps'], { perSide: true, inc: 2, loadNote: 'per hand', equipment: 'Dumbbells', pattern: 'single-leg', muscles: 'Quads · glutes', subs: ['rfess'],
    why: 'Knee-friendly single-leg strength.', setup: 'Stand tall, dumbbells at sides.', execute: 'Step back, lower rear knee softly, drive up through front foot.', avoid: 'Short step; front heel lifting; torso folding.' }),
  x('cossack-squat', 'Cossack squat', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Bodyweight or kettlebell', pattern: 'lateral', muscles: 'Adductors · glutes', subs: ['lateral-lunge'],
    why: 'Deep lateral range for low defensive shots.', setup: 'Very wide stance, toes slightly out.', execute: 'Shift into one hip while the other leg straightens, toes up.', avoid: 'Forcing depth; heel lifting; rounding.' }),
  x('kickstand-rdl', 'Kickstand RDL', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Dumbbells', pattern: 'hinge', muscles: 'Hamstrings · glutes', subs: ['sl-rdl'],
    why: 'Single-leg hinge with less balance demand.', setup: 'Back foot toes lightly down beside front heel.', execute: 'Hinge over the front leg, keep 80% weight there.', avoid: 'Pushing off the back foot; rounding.' }),
  x('side-plank', 'Side plank', ['sec'], { perSide: true, equipment: 'Bodyweight', pattern: 'anti-rotation', muscles: 'Obliques · glute med',
    why: 'Lateral trunk stiffness.', setup: 'Elbow under shoulder, feet stacked or staggered.', execute: 'Lift hips into a straight line and breathe steadily.', avoid: 'Hips sagging or piking; shrugging.' }),
  x('cable-adduction', 'Cable hip adduction', ['w', 'reps'], { perSide: true, inc: 2.5, equipment: 'Cable ankle strap', pattern: 'adductor', muscles: 'Adductors',
    why: 'Loadable adductor work.', setup: 'Stand side-on, strap on inside ankle, hold support.', execute: 'Sweep the leg across the body under control.', avoid: 'Leaning; swinging; rotating hips.' }),
  x('dead-bug', 'Dead bug', ['reps'], { perSide: true, equipment: 'Bodyweight', pattern: 'anti-rotation', muscles: 'Deep trunk',
    why: 'Trunk control with limbs moving.', setup: 'On back, knees and hips 90°, low back gently down.', execute: 'Extend opposite arm and leg slowly, return, switch.', avoid: 'Low back arching; rushing.' }),
  x('sl-calf-raise', 'Single-leg calf raise', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Step + dumbbell', pattern: 'calf', muscles: 'Gastrocnemius · soleus',
    why: 'Unilateral ankle capacity.', setup: 'Ball of foot on step edge, hold support.', execute: 'Full rise, pause, slow lower below step level.', avoid: 'Bouncing; ankle rolling out.' }),
  x('hk-db-press', 'Half-kneeling dumbbell press', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Dumbbell', pattern: 'press', muscles: 'Deltoid · triceps',
    why: 'Overhead press with trunk control.', setup: 'Down-knee same side as weight, glute squeezed.', execute: 'Press straight up, biceps by ear, lower slowly.', avoid: 'Leaning away; arching.' }),
  x('seated-cable-row', 'Seated cable row', ['w', 'reps'], { inc: 2.5, equipment: 'Cable', pattern: 'pull', muscles: 'Lats · mid-back',
    why: 'Stable horizontal pull.', setup: 'Sit tall, slight knee bend, arms long.', execute: 'Pull to lower ribs, pause, return slowly.', avoid: 'Rocking torso; shrugging.' }),
  x('inverted-row', 'Inverted row', ['reps'], { equipment: 'Smith bar or rings', pattern: 'pull', muscles: 'Lats · mid-back · biceps',
    why: 'Bodyweight pull with scapular control.', setup: 'Body straight under bar, heels down.', execute: 'Pull chest to bar, pause, lower slowly.', avoid: 'Hips sagging; chin poking.' }),
  x('push-up', 'Push-up', ['reps'], { equipment: 'Bodyweight', pattern: 'press', muscles: 'Chest · triceps · serratus',
    why: 'Shoulder-friendly press, anywhere.', setup: 'Hands under shoulders, body in a plank.', execute: 'Lower chest between hands, push the floor away.', avoid: 'Hips sagging; elbows flared wide.' }),
  x('sa-db-row', 'Single-arm dumbbell row', ['w', 'reps'], { perSide: true, inc: 2, equipment: 'Bench + dumbbell', pattern: 'pull', muscles: 'Lats · mid-back',
    why: 'Unilateral pulling strength.', setup: 'Hand and knee on bench, back flat.', execute: 'Row elbow toward hip, pause, lower fully.', avoid: 'Twisting open; jerking.' }),
  x('side-lying-er', 'Side-lying external rotation', ['w', 'reps'], { perSide: true, inc: 1, equipment: 'Light dumbbell', pattern: 'cuff', muscles: 'Rotator cuff',
    why: 'Cuff strength with no cable.', setup: 'Lie on side, towel under elbow, elbow at 90°.', execute: 'Rotate forearm up slowly, lower over 3 seconds.', avoid: 'Rolling back; too much load.' }),
  x('band-pull-apart', 'Band pull-apart', ['reps'], { equipment: 'Band', pattern: 'pull', muscles: 'Rear delts · mid-back',
    why: 'Upper-back endurance and posture.', setup: 'Arms straight at shoulder height, band taut.', execute: 'Pull band to chest by squeezing shoulder blades.', avoid: 'Shrugging; bending elbows.' }),
  x('suitcase-carry', 'Suitcase carry', ['w', 'm'], { perSide: true, inc: 2, equipment: 'Dumbbell or kettlebell', pattern: 'carry', muscles: 'Obliques · grip',
    why: 'Anti-lateral-flexion and grip.', setup: 'One weight at side, stand tall.', execute: 'Walk without leaning toward or away from the weight.', avoid: 'Leaning; shrugging.' }),
  x('box-jump', 'Box jump', ['reps'], { quality: true, equipment: 'Box', pattern: 'power', muscles: 'Quads · glutes · calves',
    why: 'Power with reduced landing impact.', setup: 'Stand close to a box of modest height.', execute: 'Swing, jump, land softly on box, step down.', avoid: 'Box too high; jumping down.' }),
  x('skater-hop', 'Skater hop', ['reps'], { perSide: true, quality: true, equipment: 'Bodyweight', pattern: 'power', muscles: 'Glutes · ankle',
    why: 'Lateral elastic power.', setup: 'Athletic stance, space to both sides.', execute: 'Hop sideways, land and stick briefly, hop back.', avoid: 'Knee caving; sloppy landings.' }),
  x('cable-woodchop', 'Cable woodchop', ['w', 'reps'], { perSide: true, inc: 2.5, equipment: 'Cable', pattern: 'power', muscles: 'Obliques · hips',
    why: 'Rotation when no throwing wall.', setup: 'Side-on to cable set high or low, arms long.', execute: 'Rotate through hips and upper back, arms stay long.', avoid: 'Bending elbows; lumbar twisting.' }),
  x('nordic-assisted', 'Assisted Nordic curl', ['reps'], { equipment: 'Partner / band / pad', pattern: 'hamstring', muscles: 'Hamstrings',
    why: 'Eccentric hamstring strength.', setup: 'Kneel with heels anchored, hips extended.', execute: 'Lower as slowly as possible, push back up with hands.', avoid: 'Hips bending; dropping fast.' }),
  x('leg-curl', 'Leg curl machine', ['w', 'reps'], { inc: 2.5, equipment: 'Machine', pattern: 'hamstring', muscles: 'Hamstrings',
    why: 'Loadable knee-flexion strength.', setup: 'Knee aligned with machine axis.', execute: 'Curl fully, pause, lower over 2–3 seconds.', avoid: 'Hips lifting; swinging.' }),
  x('sl-balance', 'Single-leg balance', ['sec'], { perSide: true, equipment: 'Bodyweight', pattern: 'ankle', muscles: 'Ankle & foot stabilizers',
    why: 'Ankle proprioception.', setup: 'Stand on one leg near support.', execute: 'Hold steady; progress to eyes closed or soft surface.', avoid: 'Locking knee; gripping toes hard.' }),

  // ── Home / no-equipment options
  x('glute-bridge', 'Single-leg glute bridge', ['reps'], { perSide: true, equipment: 'Bodyweight', pattern: 'hinge', muscles: 'Glutes · hamstrings',
    why: 'Hip extension strength with no equipment.', setup: 'On your back, one foot planted near your hips, other knee hugged or leg straight.', execute: 'Drive through the heel to lift hips level, pause 2 s, lower slowly.', avoid: 'Arching the low back; hips tilting.' }),
  x('bw-squat', 'Tempo bodyweight squat', ['reps'], { equipment: 'Bodyweight', pattern: 'squat', muscles: 'Quads · glutes',
    why: 'Squat strength and control without load.', setup: 'Feet shoulder-width, arms forward for balance.', execute: 'Lower over 3 seconds, pause at the bottom, stand up fast.', avoid: 'Heels lifting; knees caving.' }),
  x('pike-push-up', 'Pike push-up', ['reps'], { equipment: 'Bodyweight', pattern: 'press', muscles: 'Shoulders · triceps',
    why: 'Overhead pressing strength at home.', setup: 'Hips high in an inverted V, hands shoulder-width.', execute: 'Lower head toward the floor between hands, press back up.', avoid: 'Flaring elbows; collapsing hips.' }),
  x('band-row', 'Band row', ['reps'], { equipment: 'Resistance band', pattern: 'pull', muscles: 'Lats · mid-back',
    why: 'Horizontal pulling with a band.', setup: 'Band anchored at chest height, step back until taut.', execute: 'Row elbows back, squeeze shoulder blades, return slowly.', avoid: 'Shrugging; leaning back.' }),
  x('band-woodchop', 'Band woodchop', ['reps'], { perSide: true, quality: true, equipment: 'Resistance band', pattern: 'power', muscles: 'Obliques · hips',
    why: 'Fast rotation from the ground up, like a stroke.', setup: 'Band anchored high, side-on, arms long.', execute: 'Rotate hips and chest together, pulling diagonally down fast; return slowly.', avoid: 'Bending elbows; twisting from the low back.' }),
  x('band-face-pull', 'Band face pull', ['reps'], { equipment: 'Resistance band', pattern: 'pull', muscles: 'Rear delts · rotator cuff',
    why: 'Shoulder balance for overhead shots, with a band.', setup: 'Band anchored at eye height, arms long.', execute: 'Pull toward your face, elbows high, thumbs finishing back.', avoid: 'Shrugging; leaning back.' }),
  x('plank-shoulder-tap', 'Plank shoulder tap', ['reps'], { equipment: 'Bodyweight', pattern: 'carry', muscles: 'Trunk · shoulders',
    why: 'Whole-body stiffness when there is nothing to carry.', setup: 'High plank, feet wider than hips.', execute: 'Tap opposite shoulder without the hips rocking.', avoid: 'Hips swaying; rushing.' }),
];

// Minimum kit needed: 'bw' = bodyweight, band, step or chair; 'db' = dumbbells/kettlebell/bench; 'gym' = machines, cables, bars.
const KIT = {
  'trap-bar-deadlift': 'gym', 'landmine-press': 'gym', 'cable-row-rotation': 'gym', 'face-pull': 'gym', 'mb-scoop-toss': 'gym',
  'seated-soleus-raise': 'gym', 'romanian-deadlift': 'gym', 'leg-press': 'gym', 'cable-adduction': 'gym', 'seated-cable-row': 'gym',
  'cable-woodchop': 'gym', 'leg-curl': 'gym', 'inverted-row': 'gym',
  'chest-supported-row': 'db', 'incline-db-press': 'db', 'farmer-carry': 'db', 'goblet-squat': 'db', 'hk-db-press': 'db',
  'sa-db-row': 'db', 'suitcase-carry': 'db',
};
// Exercises that still work with no added load (the load column is hidden at home).
const LOAD_OPTIONAL = new Set(['rfess', 'lateral-lunge', 'sl-rdl', 'pallof-press', 'standing-calf-raise', 'cable-er', 'wrist-rotation',
  'step-up-knee-drive', 'reverse-lunge', 'cossack-squat', 'kickstand-rdl', 'sl-calf-raise', 'side-lying-er']);
// Default ranges, used when a substitute logs a different unit than the slot it fills.
const RANGE = { 'plank-shoulder-tap': [16, 24], 'glute-bridge': [10, 15], 'bw-squat': [10, 15], 'pike-push-up': [6, 10], 'band-row': [12, 15],
  'band-woodchop': [6, 8], 'band-face-pull': [15, 20], 'push-up': [8, 15], 'side-plank': [20, 40], 'dead-bug': [8, 10], 'sl-balance': [30, 45], 'band-pull-apart': [15, 20] };
for (const e of LIST) { e.kit = KIT[e.id] || 'bw'; e.loadOptional = LOAD_OPTIONAL.has(e.id); e.range = RANGE[e.id] || null; }

// Equipment-free fallbacks per movement pattern, in preference order.
export const PATTERN_FALLBACK = {
  hinge: ['kickstand-rdl', 'glute-bridge', 'sl-rdl'], squat: ['bw-squat', 'reverse-lunge'], 'single-leg': ['reverse-lunge', 'step-up-knee-drive', 'rfess'],
  press: ['push-up', 'pike-push-up'], pull: ['band-row', 'band-face-pull', 'band-pull-apart'], cuff: ['cable-er', 'side-lying-er'], carry: ['plank-shoulder-tap', 'side-plank'],
  power: ['band-woodchop', 'skater-hop', 'cmj'], calf: ['sl-calf-raise', 'standing-calf-raise'], hamstring: ['slider-curl', 'nordic-assisted'],
  adductor: ['copenhagen-short', 'side-plank'], 'anti-rotation': ['pallof-press', 'dead-bug', 'side-plank'], forearm: ['wrist-rotation'],
  lateral: ['lateral-lunge', 'cossack-squat'], ankle: ['band-ankle', 'sl-balance'],
};


// Rich metadata: [needs, primary, secondary, movement, category, level, weightType].
// `needs` entries may offer alternatives with '|'. An empty list means no equipment.
const M = {
  'trap-bar-deadlift': [['trap_bar'], 'quads glutes hamstrings', 'lower_back traps forearms', 'hinge', 'lower-strength', 'intermediate', 'total'],
  rfess: [['bench'], 'quads glutes', 'adductors abs glute_med', 'single-leg', 'lower-strength', 'intermediate', 'per_hand'],
  'lateral-lunge': [[], 'adductors glutes quads', 'abs glute_med', 'lateral', 'lower-strength', 'beginner', 'per_hand'],
  'sl-rdl': [[], 'hamstrings glutes', 'abs lower_back glute_med', 'hinge', 'lower-strength', 'intermediate', 'per_hand'],
  'copenhagen-short': [['bench'], 'adductors', 'obliques abs glute_med', 'lateral', 'prevention', 'intermediate', 'bodyweight'],
  'pallof-press': [['band|cable'], 'obliques abs', 'front_delts', 'anti-rotation', 'core', 'beginner', 'total'],
  'standing-calf-raise': [[], 'calves', 'soleus', 'calf-ankle', 'prevention', 'beginner', 'total'],
  'tibialis-raise': [[], 'shins', '', 'calf-ankle', 'prevention', 'beginner', 'bodyweight'],
  'landmine-press': [['landmine'], 'front_delts upper_chest', 'triceps abs obliques', 'push', 'upper-strength', 'intermediate', 'total'],
  'chest-supported-row': [['dumbbells', 'bench'], 'mid_back lats', 'biceps rear_delts', 'pull', 'upper-strength', 'beginner', 'per_hand'],
  'incline-db-press': [['dumbbells', 'bench'], 'upper_chest front_delts', 'triceps chest', 'push', 'upper-strength', 'beginner', 'per_hand'],
  'cable-row-rotation': [['cable'], 'mid_back lats obliques', 'biceps rear_delts', 'pull', 'upper-strength', 'intermediate', 'total'],
  'cable-er': [['band|cable'], 'rotator_cuff', 'rear_delts', 'pull', 'prevention', 'beginner', 'total'],
  'face-pull': [['cable'], 'rear_delts mid_back', 'rotator_cuff', 'pull', 'prevention', 'beginner', 'total'],
  'wrist-rotation': [[], 'forearms', '', 'rotation', 'prevention', 'beginner', 'per_hand'],
  'farmer-carry': [['dumbbells|kettlebell'], 'forearms traps', 'abs obliques', 'carry', 'core', 'beginner', 'per_hand'],
  cmj: [[], 'quads glutes calves', 'hamstrings soleus', 'power', 'power', 'intermediate', 'bodyweight'],
  'lateral-bound': [[], 'glutes glute_med quads', 'adductors calves soleus', 'power', 'power', 'intermediate', 'bodyweight'],
  'mb-scoop-toss': [['med_ball'], 'obliques glutes', 'hamstrings front_delts abs', 'power', 'power', 'intermediate', 'total'],
  'goblet-squat': [['dumbbells|kettlebell'], 'quads glutes', 'abs adductors', 'squat', 'lower-strength', 'beginner', 'total'],
  'step-up-knee-drive': [['box'], 'quads glutes', 'calves abs glute_med hip_flexors', 'single-leg', 'lower-strength', 'beginner', 'per_hand'],
  'slider-curl': [['sliders'], 'hamstrings', 'glutes calves', 'hinge', 'prevention', 'intermediate', 'bodyweight'],
  'seated-soleus-raise': [['calf_machine|dumbbells'], 'soleus', 'calves', 'calf-ankle', 'prevention', 'beginner', 'total'],
  'band-ankle': [['band'], 'shins', 'calves soleus', 'calf-ankle', 'prevention', 'beginner', 'bodyweight'],
  'romanian-deadlift': [['barbell'], 'hamstrings glutes', 'lower_back forearms', 'hinge', 'lower-strength', 'intermediate', 'total'],
  'leg-press': [['leg_press'], 'quads glutes', 'adductors', 'squat', 'lower-strength', 'beginner', 'total'],
  'reverse-lunge': [[], 'quads glutes', 'adductors abs glute_med', 'single-leg', 'lower-strength', 'beginner', 'per_hand'],
  'cossack-squat': [[], 'adductors quads glutes', 'glute_med', 'lateral', 'lower-strength', 'intermediate', 'total'],
  'kickstand-rdl': [[], 'hamstrings glutes', 'lower_back glute_med', 'hinge', 'lower-strength', 'beginner', 'per_hand'],
  'side-plank': [[], 'obliques', 'abs glute_med', 'anti-rotation', 'core', 'beginner', 'bodyweight'],
  'cable-adduction': [['cable'], 'adductors', '', 'lateral', 'prevention', 'beginner', 'total'],
  'dead-bug': [[], 'abs', 'hip_flexors obliques', 'anti-rotation', 'core', 'beginner', 'bodyweight'],
  'sl-calf-raise': [[], 'calves', 'soleus', 'calf-ankle', 'prevention', 'beginner', 'per_hand'],
  'hk-db-press': [['dumbbells|kettlebell'], 'front_delts', 'side_delts triceps abs obliques', 'push', 'upper-strength', 'beginner', 'per_hand'],
  'seated-cable-row': [['cable'], 'mid_back lats', 'biceps rear_delts', 'pull', 'upper-strength', 'beginner', 'total'],
  'inverted-row': [['bar'], 'mid_back lats', 'biceps abs rear_delts', 'pull', 'upper-strength', 'beginner', 'bodyweight'],
  'push-up': [[], 'chest front_delts', 'triceps abs', 'push', 'upper-strength', 'beginner', 'bodyweight'],
  'sa-db-row': [['dumbbells|kettlebell', 'bench'], 'lats mid_back', 'biceps rear_delts', 'pull', 'upper-strength', 'beginner', 'per_hand'],
  'side-lying-er': [[], 'rotator_cuff', 'rear_delts', 'pull', 'prevention', 'beginner', 'per_hand'],
  'band-pull-apart': [['band'], 'mid_back rear_delts', 'rotator_cuff', 'pull', 'prevention', 'beginner', 'bodyweight'],
  'suitcase-carry': [['dumbbells|kettlebell'], 'obliques forearms', 'abs glute_med traps', 'carry', 'core', 'beginner', 'per_hand'],
  'box-jump': [['box'], 'quads glutes calves', 'hamstrings soleus', 'power', 'power', 'intermediate', 'bodyweight'],
  'skater-hop': [[], 'glutes glute_med adductors', 'quads calves soleus', 'power', 'power', 'intermediate', 'bodyweight'],
  'cable-woodchop': [['cable'], 'obliques abs', 'front_delts glutes', 'rotation', 'power', 'intermediate', 'total'],
  'nordic-assisted': [[], 'hamstrings', 'glutes', 'hinge', 'prevention', 'advanced', 'bodyweight'],
  'leg-curl': [['leg_curl'], 'hamstrings', 'calves', 'hinge', 'lower-strength', 'beginner', 'total'],
  'sl-balance': [[], 'calves shins', 'abs glute_med soleus', 'calf-ankle', 'prevention', 'beginner', 'bodyweight'],
  'glute-bridge': [[], 'glutes hamstrings', 'abs glute_med', 'hinge', 'lower-strength', 'beginner', 'bodyweight'],
  'bw-squat': [[], 'quads glutes', 'adductors abs', 'squat', 'lower-strength', 'beginner', 'bodyweight'],
  'pike-push-up': [[], 'front_delts triceps', 'side_delts upper_chest', 'push', 'upper-strength', 'intermediate', 'bodyweight'],
  'band-row': [['band'], 'mid_back lats', 'biceps rear_delts', 'pull', 'upper-strength', 'beginner', 'bodyweight'],
  'band-woodchop': [['band'], 'obliques abs', 'front_delts', 'rotation', 'power', 'beginner', 'bodyweight'],
  'band-face-pull': [['band'], 'rear_delts mid_back', 'rotator_cuff', 'pull', 'prevention', 'beginner', 'bodyweight'],
  'plank-shoulder-tap': [[], 'abs obliques', 'front_delts', 'anti-rotation', 'core', 'beginner', 'bodyweight'],
};
const words = s => s ? s.split(' ') : [];
for (const e of LIST) {
  const m = M[e.id];
  if (!m) continue;
  [e.needs, e.primary, e.secondary, e.movement, e.category, e.level, e.weightType] = [m[0], words(m[1]), words(m[2]), m[3], m[4], m[5], m[6]];
}

export const CATALOG = Object.fromEntries(LIST.map(e => [e.id, e]));
// Your own exercises (imported or created) live alongside the library.
const CUSTOM = {};
export const EXERCISES = LIST;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BY_NAME = Object.fromEntries(LIST.map(e => [norm(e.name), e.id]));

// Extra library exercises (the expansion pack). They join the built-in list, so they behave
// exactly like it; names already in the library are skipped.
export function registerPack(list) {
  let n = 0;
  for (const e of list) if (!CATALOG[e.id] && !BY_NAME[norm(e.name)]) { LIST.push(e); CATALOG[e.id] = e; BY_NAME[norm(e.name)] = e.id; n++; }
  return n;
}
// Your edits to library exercises (name, muscles, movement, type, equipment, video, how-to),
// layered on top of the original so they can be reset. How an exercise is logged never
// changes, so history stays consistent. Your own exercises are edited directly instead.
export const EDITABLE = ['name', 'primary', 'secondary', 'movement', 'category', 'needs', 'url', 'execute', 'muscles', 'equipment'];
const ORIG = {};
let EDITS = {};
export function applyExerciseEdits(map = {}) {
  for (const [id, o] of Object.entries(ORIG)) { const e = CATALOG[id]; if (!e) continue; delete BY_NAME[norm(e.name)]; Object.assign(e, o); BY_NAME[norm(e.name)] = id; delete ORIG[id]; }
  EDITS = map || {};
  for (const [id, ed] of Object.entries(EDITS)) {
    const e = CATALOG[id];
    if (!e) continue;
    ORIG[id] = Object.fromEntries(EDITABLE.map(k => [k, e[k]]));
    delete BY_NAME[norm(e.name)];
    for (const k of EDITABLE) if (k in ed) e[k] = ed[k];
    BY_NAME[norm(e.name)] = id;
  }
}
export const isEdited = id => !!EDITS[id];
export function setCustomExercises(map) { for (const k of Object.keys(CUSTOM)) delete CUSTOM[k]; Object.assign(CUSTOM, map || {}); }
export const customExercises = () => Object.values(CUSTOM);
// Starting weights from an import, for library exercises you haven't logged yet.
export function setStartWeights(map) { for (const e of LIST) delete e.startW; for (const [id, w] of Object.entries(map || {})) if (CATALOG[id] && w != null) CATALOG[id].startW = w; }
export const allExercises = () => [...LIST, ...Object.values(CUSTOM)];

export function getExercise(id) { return CATALOG[id] || CUSTOM[id] || null; }
export function idForName(name) { return BY_NAME[norm(name)] || Object.values(CUSTOM).find(c => norm(c.name) === norm(name))?.id || null; }
export const hasLoad = ex => ex.fields.includes('w');
export const targetField = ex => ex.fields[ex.fields.length - 1];
export const FIELD_UNIT = { reps: 'reps', sec: 's', m: 'm' };
