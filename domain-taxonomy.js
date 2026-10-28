// Shared vocabulary for exercises: muscles, movements, categories, levels, weight types
// and equipment. Imports, filters and (later) recovery all speak this language, so
// free text from CSVs is normalised onto these ids.

export const MUSCLES = {
  front_delts: 'Front delts', side_delts: 'Side delts', rear_delts: 'Rear delts', rotator_cuff: 'Rotator cuff',
  upper_chest: 'Upper chest', chest: 'Chest', lower_chest: 'Lower chest',
  traps: 'Traps', mid_back: 'Mid back', lats: 'Lats', lower_back: 'Lower back',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', hip_flexors: 'Hip flexors',
  glutes: 'Glutes', glute_med: 'Glute med', adductors: 'Adductors', quads: 'Quads', hamstrings: 'Hamstrings',
  calves: 'Calves', soleus: 'Soleus', shins: 'Shins',
};
// Muscle groups before the finer split (2026-10). Saved data and old imports may still use them.
export const LEGACY_MUSCLES = { shoulders: ['front_delts', 'side_delts', 'rear_delts'], upper_back: ['traps', 'mid_back'], arms: ['biceps', 'triceps'], core: ['abs'] };
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
  // Expanded gym machines
  hack_squat: 'Hack squat machine', pendulum_squat: 'Pendulum squat', belt_squat: 'Belt squat', v_squat: 'V-squat machine', leg_extension: 'Leg extension machine',
  hip_abduction: 'Hip abduction machine', glute_machine: 'Glute kickback machine', reverse_hyper: 'Reverse hyper', back_extension: 'Back extension bench',
  glute_ham_developer: 'Glute-ham developer (GHD)', chest_press: 'Chest press machine', pec_deck: 'Pec deck', shoulder_press: 'Shoulder press machine',
  lateral_raise_machine: 'Lateral raise machine', row_machine: 'Row machine (chest-supported)', pullover_machine: 'Pullover machine',
  assisted_pull_up_machine: 'Assisted pull-up machine', assisted_dip_machine: 'Assisted dip machine', curl_machine: 'Biceps curl machine', triceps_machine: 'Triceps machine',
  // Conditioning and accessories
  sled: 'Sled', battle_ropes: 'Battle ropes', suspension_trainer: 'Suspension trainer (TRX)', rope: 'Climbing rope', sandbag: 'Sandbag',
  hurdles: 'Mini hurdles', agility_ladder: 'Agility ladder', cones: 'Cones', ab_wheel: 'Ab wheel', stability_ball: 'Stability ball', nordic_bench: 'Nordic bench or anchor',
};
export const EQUIPMENT_GROUPS = [
  ['Free weights', ['dumbbells', 'kettlebell', 'barbell', 'trap_bar', 'med_ball', 'landmine']],
  ['Machines', ['cable', 'leg_press', 'leg_curl', 'calf_machine', 'hack_squat', 'pendulum_squat', 'belt_squat', 'v_squat', 'leg_extension', 'hip_abduction', 'glute_machine',
    'reverse_hyper', 'back_extension', 'glute_ham_developer', 'chest_press', 'pec_deck', 'shoulder_press', 'lateral_raise_machine', 'row_machine', 'pullover_machine',
    'assisted_pull_up_machine', 'assisted_dip_machine', 'curl_machine', 'triceps_machine']],
  ['Small kit', ['bench', 'box', 'band', 'sliders', 'bar']],
  ['Conditioning & accessories', ['sled', 'battle_ropes', 'suspension_trainer', 'rope', 'sandbag', 'hurdles', 'agility_ladder', 'cones', 'ab_wheel', 'stability_ball', 'nordic_bench']],
];
// Starting points for the first two locations; the user edits or deletes them.
export const PRESET_GEAR = {
  // A typical gym: the core kit only. Specialist machines and conditioning gear are ticked per location.
  gym: ['barbell', 'trap_bar', 'dumbbells', 'kettlebell', 'med_ball', 'landmine', 'cable', 'leg_press', 'leg_curl', 'calf_machine', 'bench', 'box', 'band', 'sliders', 'bar'],
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
    quad: 'quads', quadriceps: 'quads', thighs: 'quads', hamstring: 'hamstrings', hammies: 'hamstrings', glute: 'glutes', 'glute max': 'glutes', 'glutes max': 'glutes', 'gluteus maximus': 'glutes', gluteus: 'glutes', butt: 'glutes', hips: 'glutes',
    'glute med': 'glute_med', 'glute medius': 'glute_med', 'gluteus medius': 'glute_med', 'side glutes': 'glute_med', abductors: 'glute_med', 'hip abductors': 'glute_med',
    'hip flexor': 'hip_flexors', 'hip flexors': 'hip_flexors', psoas: 'hip_flexors', iliopsoas: 'hip_flexors',
    adductor: 'adductors', groin: 'adductors', 'inner thigh': 'adductors', calf: 'calves', gastrocnemius: 'calves', gastroc: 'calves', 'deep calf': 'soleus',
    shin: 'shins', tibialis: 'shins', 'tibialis anterior': 'shins', ankles: 'shins', ankle: 'shins',
    core: 'abs', abdominals: 'abs', 'deep trunk': 'abs', trunk: 'abs', 'rectus abdominis': 'abs', six: 'abs', oblique: 'obliques',
    'low back': 'lower_back', 'lower back': 'lower_back', 'erector spinae': 'lower_back', erectors: 'lower_back',
    pecs: 'chest', pec: 'chest', 'mid chest': 'chest', 'middle chest': 'chest', 'upper pecs': 'upper_chest', 'upper pec': 'upper_chest', 'clavicular pec': 'upper_chest', 'lower pecs': 'lower_chest', 'lower pec': 'lower_chest',
    'upper back': 'mid_back', 'mid back': 'mid_back', 'middle back': 'mid_back', rhomboids: 'mid_back', 'mid traps': 'mid_back', 'middle traps': 'mid_back', 'lower traps': 'mid_back', back: 'mid_back',
    trap: 'traps', trapezius: 'traps', 'upper traps': 'traps',
    lat: 'lats', latissimus: 'lats', 'latissimus dorsi': 'lats',
    delts: 'front_delts', deltoids: 'front_delts', deltoid: 'front_delts', shoulder: 'front_delts', shoulders: 'front_delts', 'front delt': 'front_delts', 'anterior delts': 'front_delts', 'anterior deltoid': 'front_delts',
    'side delt': 'side_delts', 'lateral delts': 'side_delts', 'lateral delt': 'side_delts', 'medial delts': 'side_delts', 'middle delts': 'side_delts',
    'rear delt': 'rear_delts', 'posterior delts': 'rear_delts', 'posterior deltoid': 'rear_delts',
    'rotator cuff': 'rotator_cuff', cuff: 'rotator_cuff', 'external rotators': 'rotator_cuff',
    bicep: 'biceps', tricep: 'triceps', arms: 'biceps', arm: 'biceps',
    forearm: 'forearms', grip: 'forearms', wrist: 'forearms', wrists: 'forearms',
  },
  equipment: {
    dumbbell: 'dumbbells', db: 'dumbbells', dbs: 'dumbbells', kettlebells: 'kettlebell', kb: 'kettlebell', barbell: 'barbell', bar: 'barbell', plates: 'barbell', 'trap bar': 'trap_bar', 'hex bar': 'trap_bar',
    'medicine ball': 'med_ball', 'med ball': 'med_ball', medball: 'med_ball', landmine: 'landmine', cable: 'cable', cables: 'cable', 'cable machine': 'cable', pulley: 'cable',
    'leg press': 'leg_press', 'leg curl': 'leg_curl', 'hamstring curl': 'leg_curl', 'calf machine': 'calf_machine', 'calf raise machine': 'calf_machine',
    bench: 'bench', chair: 'bench', box: 'box', step: 'box', 'plyo box': 'box', band: 'band', bands: 'band', 'resistance band': 'band', 'mini band': 'band', sliders: 'sliders', slider: 'sliders', towel: 'sliders', towels: 'sliders',
    'pull up bar': 'bar', 'pullup bar': 'bar', 'smith machine': 'bar', smith: 'bar', rings: 'bar',
    trx: 'suspension_trainer', 'suspension straps': 'suspension_trainer', 'battle rope': 'battle_ropes', ghd: 'glute_ham_developer', 'climbing rope': 'rope', hurdle: 'hurdles', 'swiss ball': 'stability_ball', 'exercise ball': 'stability_ball', 'ab roller': 'ab_wheel', 'pec fly': 'pec_deck', 'leg extension machine': 'leg_extension', 'hack squat machine': 'hack_squat',
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
