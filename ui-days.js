// What a planned day looks like, in one place for every screen: its kind (the strip colour), its title,
// its short pill label and its icon. v: a routine id | 'Padel' | 'Rest' | 'Recovery' | 'Quick' (a logged gym
// session with no routine) | 'Eve' (Match Eve: shown, never stored; see rolesOf in week.js). A new kind of day (see DAY-ROLES.md) is added here and nowhere else.
import { app } from './core-app.js';
import { isRoutine } from './domain-program.js';
import { PADEL_TYPES } from './domain-padel.js';

export const dayKind = v => v === 'Eve' ? 'eve' : v === 'Padel' ? 'padel' : isRoutine(v) || v === 'Quick' ? 'gym' : v === 'Recovery' ? 'rec' : 'rest';
export const dayTitle = v => v === 'Eve' ? 'Match Eve' : isRoutine(v) ? app.routine(v).title : v === 'Padel' ? 'Padel' : v === 'Recovery' ? 'Recovery' : 'Rest';
export const padelPill = p => p?.type === 'machine' ? 'Machine' : PADEL_TYPES[p?.type] || 'Padel';
// The one-word label in a day pill; '' for a rest day (each screen shows its own placeholder).
export const dayPill = (v, padel) => v === 'Eve' ? 'Eve' : v === 'Padel' ? padelPill(padel) : isRoutine(v) ? app.routine(v).title.split(/[ &]/)[0] : v === 'Quick' ? 'Gym' : v === 'Recovery' ? 'Rec' : '';
export const dayIcon = v => v === 'Eve' ? 'bolt' : isRoutine(v) ? 'dumbbell' : v === 'Padel' ? 'racket' : v === 'Recovery' ? 'heart' : 'snow';
