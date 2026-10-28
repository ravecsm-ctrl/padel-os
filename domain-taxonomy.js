// Shared vocabulary for exercises: muscles, movements, categories, levels, weight types
// and equipment. Imports, filters and (later) recovery all speak this language, so
// free text from CSVs is normalised onto these ids.

export const MUSCLES = {
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', adductors: 'Adductors', calves: 'Calves', shins: 'Shins',
  core: 'Core', obliques: 'Obliques', lower_back: 'Lower back', chest: 'Chest', upper_back: 'Upper back', lats: 'Lats',
  shoulders: 'Shoulders', rotator_cuff: 'Rotator cuff', arms: 'Biceps & triceps', forearms: 'Forearms',
};
export const MOVEMENTS = {
  squat: 'Squat', hinge: 'Hinge', 'single-leg': 'Single-leg', lateral: 'Lateral', push: 'Push', pull: 'Pull',
  rotation: 'Rotation', 'anti-rotation': 'Anti-rotation', carry: 'Carry', power: 'Jump / power', 'calf-ankle': 'Calf / ankle', mobility: 'Mobility',
};
export const CATEGORIES = {
  'lower-strength': 'Lower body · strength', 'upper-strength': 'Upper body · strength', power: 'Power & agility',
  core: 'Core & rotation', prevention: 'Injury prevention', mobility: 'Mobility', conditioning: 'Conditioning',
};
export const LEVELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
export const WEIGHT_TYPES = { per_hand: 'Per hand', total: 'Total', bodyweight: 'Bodyweight' };
export const UNITS = { reps: 'Reps', seconds: 'Seconds', metres: 'Metres' };

export const EQUIPMENT = {
  barbell: 'Barbell & plates', trap_bar: 'Trap bar', dumbbells: 'Dumbbells', kettlebell: 'Kettlebell', med_ball: 'Medicine ball', landmine: 'Landmine',
  cable: 'Cable machine', leg_press: 'Leg press', leg_curl: 'Leg curl machine', calf_machine: 'Calf raise machine',
  bench: 'Bench or sturdy chair', box: 'Box or step', band: 'Resistance band', sliders: 'Sliders or towels', bar: 'Pull-up or Smith bar',
};
export const EQUIPMENT_GROUPS = [
  ['Free weights', ['dumbbells', 'kettlebell', 'barbell', 'trap_bar', 'med_ball', 'landmine']],
  ['Machines', ['cable', 'leg_press', 'leg_curl', 'calf_machine']],
  ['Small kit', ['bench', 'box', 'band', 'sliders', 'bar']],
];
// Starting points for the first two locations; the user edits or deletes them.
export const PRESET_GEAR = {
  gym: Object.keys(EQUIPMENT),
  db: ['dumbbells', 'bench', 'band', 'box'],
  bw: ['band'],
};

// ── Availability. `needs` entries may offer alternatives: 'dumbbells|kettlebell'.
export const canDoWith = (needs = [], owned) => needs.every(n => n.split('|').some(alt => owned.has(alt)));
export const missingFor = (needs = [], owned) => needs.filter(n => !n.split('|').some(alt => owned.has(alt)));
export const equipLabel = (id, custom = {}) => EQUIPMENT[id] || custom[id] || id;
export const needsLabel = (needs = [], custom = {}) => needs.length ? needs.map(n => n.split('|').map(a => equipLabel(a, custom)).join(' or ')).join(' + ') : 'No equipment';

// ── Normalisation of free text (CSV / pasted lists) onto the ids above.
export const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ALIAS = {
  muscle: {
    quad: 'quads', quadriceps: 'quads', thighs: 'quads', hamstring: 'hamstrings', hammies: 'hamstrings', glute: 'glutes', 'glute max': 'glutes', 'glutes max': 'glutes', 'glute med': 'glutes', gluteus: 'glutes', butt: 'glutes', hips: 'glutes',
    adductor: 'adductors', groin: 'adductors', 'inner thigh': 'adductors', calf: 'calves', soleus: 'calves', gastrocnemius: 'calves', shin: 'shins', tibialis: 'shins', 'tibialis anterior': 'shins', ankles: 'shins', ankle: 'shins',
    abs: 'core', abdominals: 'core', 'deep trunk': 'core', trunk: 'core', oblique: 'obliques', 'low back': 'lower_back', 'lower back': 'lower_back', 'erector spinae': 'lower_back', erectors: 'lower_back',
    pecs: 'chest', pec: 'chest', 'upper back': 'upper_back', traps: 'upper_back', rhomboids: 'upper_back', 'mid back': 'upper_back', 'rear delts': 'shoulders', 'rear delt': 'shoulders', back: 'upper_back',
    lat: 'lats', latissimus: 'lats', delts: 'shoulders', deltoids: 'shoulders', deltoid: 'shoulders', shoulder: 'shoulders', 'rotator cuff': 'rotator_cuff', cuff: 'rotator_cuff', 'external rotators': 'rotator_cuff',
    biceps: 'arms', triceps: 'arms', arms: 'arms', bicep: 'arms', tricep: 'arms', forearm: 'forearms', grip: 'forearms', wrist: 'forearms', wrists: 'forearms',
  },
  equipment: {
    dumbbell: 'dumbbells', db: 'dumbbells', dbs: 'dumbbells', kettlebells: 'kettlebell', kb: 'kettlebell', barbell: 'barbell', bar: 'barbell', plates: 'barbell', 'trap bar': 'trap_bar', 'hex bar': 'trap_bar',
    'medicine ball': 'med_ball', 'med ball': 'med_ball', medball: 'med_ball', landmine: 'landmine', cable: 'cable', cables: 'cable', 'cable machine': 'cable', pulley: 'cable',
    'leg press': 'leg_press', 'leg curl': 'leg_curl', 'hamstring curl': 'leg_curl', 'calf machine': 'calf_machine', 'calf raise machine': 'calf_machine',
    bench: 'bench', chair: 'bench', box: 'box', step: 'box', 'plyo box': 'box', band: 'band', bands: 'band', 'resistance band': 'band', 'mini band': 'band', sliders: 'sliders', slider: 'sliders', towel: 'sliders', towels: 'sliders',
    'pull up bar': 'bar', 'pullup bar': 'bar', 'smith machine': 'bar', smith: 'bar', rings: 'bar',
  },
  movement: { squat: 'squat', squats: 'squat', hinge: 'hinge', deadlift: 'hinge', 'single leg': 'single-leg', unilateral: 'single-leg', lunge: 'single-leg', lateral: 'lateral', push: 'push', press: 'push', pull: 'pull', row: 'pull',
    rotation: 'rotation', rotational: 'rotation', 'anti rotation': 'anti-rotation', antirotation: 'anti-rotation', core: 'anti-rotation', carry: 'carry', jump: 'power', power: 'power', plyometric: 'power', plyo: 'power', 'jump power': 'power',
    calf: 'calf-ankle', ankle: 'calf-ankle', 'calf ankle': 'calf-ankle', mobility: 'mobility', stretch: 'mobility' },
  category: { lower: 'lower-strength', legs: 'lower-strength', 'lower body': 'lower-strength', 'lower body strength': 'lower-strength', upper: 'upper-strength', 'upper body': 'upper-strength', 'upper body strength': 'upper-strength',
    power: 'power', agility: 'power', 'power agility': 'power', core: 'core', 'core rotation': 'core', prevention: 'prevention', prehab: 'prevention', 'injury prevention': 'prevention', rehab: 'prevention',
    mobility: 'mobility', conditioning: 'conditioning', cardio: 'conditioning' },
  weightType: { 'per hand': 'per_hand', perhand: 'per_hand', each: 'per_hand', 'each hand': 'per_hand', 'per dumbbell': 'per_hand', total: 'total', combined: 'total', bodyweight: 'bodyweight', bw: 'bodyweight', none: 'bodyweight' },
  unit: { reps: 'reps', rep: 'reps', r: 'reps', seconds: 'seconds', second: 'seconds', sec: 'seconds', secs: 'seconds', s: 'seconds', metres: 'metres', meters: 'metres', metre: 'metres', meter: 'metres', m: 'metres' },
  level: { beginner: 'beginner', easy: 'beginner', novice: 'beginner', intermediate: 'intermediate', medium: 'intermediate', advanced: 'advanced', hard: 'advanced', expert: 'advanced' },
};
const ID_SETS = { muscle: MUSCLES, equipment: EQUIPMENT, movement: MOVEMENTS, category: CATEGORIES, weightType: WEIGHT_TYPES, unit: UNITS, level: LEVELS };

// Returns { id } for a known value, or { unknown: original } when it can't be mapped.
export function normalize(kind, value) {
  const n = norm(value);
  if (!n) return null;
  const ids = ID_SETS[kind];
  const asId = n.replace(/ /g, '_'), asDash = n.replace(/ /g, '-');
  if (ids[asId]) return { id: asId };
  if (ids[asDash]) return { id: asDash };
  const byLabel = Object.entries(ids).find(([, l]) => norm(l) === n);
  if (byLabel) return { id: byLabel[0] };
  const a = ALIAS[kind]?.[n] || ALIAS[kind]?.[n.replace(/s$/, '')];
  if (a) return { id: a };
  return { unknown: String(value).trim() };
}
export const splitList = v => String(v ?? '').split(/[,;|\/+]| and /).map(s => s.trim()).filter(Boolean);
export function normalizeList(kind, value) {
  const ids = [], unknown = [];
  for (const part of splitList(value)) { const r = normalize(kind, part); if (r?.id) { if (!ids.includes(r.id)) ids.push(r.id); } else if (r?.unknown) unknown.push(r.unknown); }
  return { ids, unknown };
}

// Legacy movement-pattern names used by the substitution engine.
export const MOVEMENT_TO_PATTERN = { squat: 'squat', hinge: 'hinge', 'single-leg': 'single-leg', lateral: 'lateral', push: 'press', pull: 'pull', rotation: 'power', 'anti-rotation': 'anti-rotation', carry: 'carry', power: 'power', 'calf-ankle': 'calf', mobility: 'mobility' };
