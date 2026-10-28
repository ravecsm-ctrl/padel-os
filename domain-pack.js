// Expansion pack: 211 more exercises (barbell, Smith machine, machines, cables, kettlebells,
// TRX, sled, ropes, plyometrics, agility, core and mobility). Kept as CSV in the importer's own
// format so it's easy to read and extend; turned into library exercises when the app starts.
import { rowsFrom, normalizeRow, buildCustomExercise } from './domain-importer.js';
import { registerPack } from './domain-catalog.js';

const CSV = `name,primary_muscles,secondary_muscles,movement,category,equipment,unit,weight_type,per_side,level,source
Barbell back squat,"quads, glutes","adductors, core",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell front squat,"quads, glutes","core, upper_back",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell box squat,"quads, glutes","hamstrings, core",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell hack squat,"quads, glutes",hamstrings,squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell sumo squat,"adductors, glutes, quads",core,squat,lower-strength,barbell,reps,total,no,beginner,expanded
Zercher squat,"quads, glutes","core, upper_back",squat,lower-strength,barbell,reps,total,no,advanced,expanded
Overhead squat,"quads, glutes","shoulders, core",squat,lower-strength,barbell,reps,total,no,advanced,expanded
Barbell conventional deadlift,"hamstrings, glutes","quads, lower_back, forearms",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell sumo deadlift,"glutes, adductors, hamstrings","quads, lower_back",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell good morning,"hamstrings, glutes","lower_back, core",hinge,lower-strength,barbell,reps,total,no,intermediate,expanded
Barbell hip thrust,glutes,"hamstrings, core",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell glute bridge,glutes,"hamstrings, core",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell walking lunge,"quads, glutes","adductors, core",single-leg,lower-strength,barbell,reps,total,yes,intermediate,expanded
Barbell calf raise,calves,,calf-ankle,lower-strength,barbell,reps,total,no,beginner,expanded
Smith machine back squat,"quads, glutes","adductors, core",squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine front squat,"quads, glutes","core, upper_back",squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine box squat,"quads, glutes",hamstrings,squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine hack squat,"quads, glutes",hamstrings,squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine split squat,"quads, glutes","adductors, core",single-leg,lower-strength,bar,reps,total,yes,beginner,expanded
Smith machine hip thrust,glutes,"hamstrings, core",hinge,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine glute bridge,glutes,hamstrings,hinge,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine seated shoulder press,shoulders,"arms, chest",push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine bench press,chest,"shoulders, arms",push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine incline bench press,"chest, shoulders",arms,push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine close-grip bench press,"arms, chest",shoulders,push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine bent-over row,"upper_back, lats","arms, lower_back",pull,upper-strength,bar,reps,total,no,beginner,expanded
Hack squat machine,"quads, glutes",adductors,squat,lower-strength,hack squat,reps,total,no,beginner,expanded
Pendulum squat,"quads, glutes",adductors,squat,lower-strength,pendulum squat,reps,total,no,beginner,expanded
Belt squat,"quads, glutes","adductors, core",squat,lower-strength,belt squat,reps,total,no,beginner,expanded
V-squat machine,"quads, glutes",adductors,squat,lower-strength,v squat,reps,total,no,beginner,expanded
Leg extension machine,quads,,squat,lower-strength,leg extension,reps,total,no,beginner,expanded
Single-leg leg extension,quads,,single-leg,lower-strength,leg extension,reps,total,yes,beginner,expanded
Lying leg curl machine,hamstrings,,hinge,lower-strength,leg_curl,reps,total,no,beginner,expanded
Seated leg curl machine,hamstrings,,hinge,lower-strength,leg_curl,reps,total,no,beginner,expanded
Standing single-leg curl machine,hamstrings,,hinge,lower-strength,leg_curl,reps,total,yes,beginner,expanded
Hip abduction machine,glutes,core,lateral,lower-strength,hip abduction,reps,total,no,beginner,expanded
Glute kickback machine,glutes,hamstrings,hinge,lower-strength,glute machine,reps,total,yes,beginner,expanded
Reverse hyperextension,"glutes, hamstrings",lower_back,hinge,lower-strength,reverse hyper,reps,total,no,beginner,expanded
45-degree back extension,"lower_back, glutes",hamstrings,hinge,lower-strength,back extension,reps,total,no,beginner,expanded
Glute-ham raise,"hamstrings, glutes",lower_back,hinge,lower-strength,glute ham developer,reps,total,no,beginner,expanded
Donkey calf raise machine,calves,,calf-ankle,lower-strength,calf_machine,reps,total,no,beginner,expanded
Leg press calf raise,calves,,calf-ankle,lower-strength,leg_press,reps,total,no,beginner,expanded
Dumbbell front squat,"quads, glutes",core,squat,lower-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell sumo squat,"adductors, glutes, quads",core,squat,lower-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell walking lunge,"quads, glutes","adductors, core",single-leg,lower-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Dumbbell step-up,"quads, glutes","calves, core",single-leg,lower-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Dumbbell sumo deadlift,"glutes, adductors, hamstrings",quads,hinge,lower-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell hip thrust,glutes,hamstrings,hinge,lower-strength,dumbbells,reps,total,no,beginner,expanded
Barbell bench press,chest,"shoulders, arms",push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell incline bench press,"chest, shoulders",arms,push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell decline bench press,chest,"shoulders, arms",push,upper-strength,barbell,reps,total,no,beginner,expanded
Close-grip bench press,"arms, chest",shoulders,push,upper-strength,barbell,reps,total,no,beginner,expanded
Floor press,"chest, arms",shoulders,push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell overhead press,shoulders,"arms, core",push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell push press,shoulders,"arms, quads, glutes",power,power,barbell,reps,total,no,intermediate,expanded
Barbell bent-over row,"upper_back, lats","arms, lower_back",pull,upper-strength,barbell,reps,total,no,beginner,expanded
Pendlay row,"upper_back, lats","arms, lower_back",pull,upper-strength,barbell,reps,total,no,intermediate,expanded
T-bar row,"upper_back, lats",arms,pull,upper-strength,landmine,reps,total,no,beginner,expanded
Barbell upright row,"shoulders, upper_back",arms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell shrug,upper_back,forearms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell biceps curl,arms,forearms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
EZ-bar biceps curl,arms,forearms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell skull crusher,arms,,push,upper-strength,barbell,reps,total,no,beginner,expanded
Dumbbell bench press,chest,"shoulders, arms",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell incline bench press,"chest, shoulders",arms,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell decline bench press,chest,"shoulders, arms",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell floor press,"chest, arms",shoulders,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell fly,chest,shoulders,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Incline dumbbell fly,chest,shoulders,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell shoulder press,shoulders,"arms, chest",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Arnold press,shoulders,"arms, chest",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell lateral raise,shoulders,,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell front raise,shoulders,,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell reverse fly,"upper_back, shoulders",rotator_cuff,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell pullover,"lats, chest",arms,pull,upper-strength,dumbbells,reps,total,no,beginner,expanded
Dumbbell shrug,upper_back,forearms,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell biceps curl,arms,forearms,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Hammer curl,"arms, forearms",,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Incline dumbbell curl,arms,forearms,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Concentration curl,arms,forearms,pull,upper-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Dumbbell triceps extension,arms,shoulders,push,upper-strength,dumbbells,reps,total,no,beginner,expanded
Dumbbell skull crusher,arms,,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell triceps kickback,arms,shoulders,push,upper-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Lat pulldown,"lats, upper_back",arms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Close-grip lat pulldown,"lats, upper_back",arms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Single-arm lat pulldown,lats,"arms, core",pull,upper-strength,cable,reps,total,yes,beginner,expanded
Straight-arm cable pulldown,lats,"arms, core",pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable chest press,chest,"shoulders, arms",push,upper-strength,cable,reps,total,no,beginner,expanded
Cable crossover,chest,shoulders,push,upper-strength,cable,reps,total,no,beginner,expanded
Low-to-high cable fly,"chest, shoulders",arms,push,upper-strength,cable,reps,total,no,beginner,expanded
High-to-low cable fly,chest,"shoulders, arms",push,upper-strength,cable,reps,total,no,beginner,expanded
Cable lateral raise,shoulders,,push,upper-strength,cable,reps,total,yes,beginner,expanded
Cable front raise,shoulders,,push,upper-strength,cable,reps,total,no,beginner,expanded
Cable reverse fly,"upper_back, shoulders",rotator_cuff,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable upright row,"shoulders, upper_back",arms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable shrug,upper_back,forearms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable biceps curl,arms,forearms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable hammer curl,"arms, forearms",,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable triceps pushdown,arms,,push,upper-strength,cable,reps,total,no,beginner,expanded
Cable overhead triceps extension,arms,shoulders,push,upper-strength,cable,reps,total,no,beginner,expanded
Cable pull-through,"glutes, hamstrings",lower_back,hinge,lower-strength,cable,reps,total,no,beginner,expanded
Chest press machine,chest,"shoulders, arms",push,upper-strength,chest press,reps,total,no,beginner,expanded
Incline chest press machine,"chest, shoulders",arms,push,upper-strength,chest press,reps,total,no,beginner,expanded
Pec deck fly,chest,shoulders,push,upper-strength,pec deck,reps,total,no,beginner,expanded
Reverse pec deck,"upper_back, shoulders",rotator_cuff,pull,upper-strength,pec deck,reps,total,no,beginner,expanded
Shoulder press machine,shoulders,"arms, chest",push,upper-strength,shoulder press,reps,total,no,beginner,expanded
Lateral raise machine,shoulders,,push,upper-strength,lateral raise machine,reps,total,no,beginner,expanded
High row machine,"upper_back, lats","arms, shoulders",pull,upper-strength,row machine,reps,total,no,beginner,expanded
Pullover machine,lats,"chest, arms",pull,upper-strength,pullover machine,reps,total,no,beginner,expanded
Assisted pull-up,"lats, upper_back","arms, core",pull,upper-strength,assisted pull-up machine,reps,bodyweight,no,beginner,expanded
Assisted dip,"chest, arms",shoulders,push,upper-strength,assisted dip machine,reps,bodyweight,no,beginner,expanded
Biceps curl machine,arms,forearms,pull,upper-strength,curl machine,reps,total,no,beginner,expanded
Triceps extension machine,arms,,push,upper-strength,triceps machine,reps,total,no,beginner,expanded
Pull-up,"lats, upper_back","arms, core",pull,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Chin-up,"lats, arms","upper_back, core",pull,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Neutral-grip pull-up,"lats, upper_back","arms, core",pull,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Dip,"chest, arms",shoulders,push,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Diamond push-up,"arms, chest","shoulders, core",push,upper-strength,none,reps,bodyweight,no,beginner,expanded
Decline push-up,"chest, shoulders","arms, core",push,upper-strength,none,reps,bodyweight,no,beginner,expanded
Handstand push-up,"shoulders, arms","chest, core",push,upper-strength,none,reps,bodyweight,no,advanced,expanded
Burpee,"quads, glutes, chest","shoulders, arms, core",power,conditioning,none,reps,bodyweight,no,beginner,expanded
Mountain climber,"core, shoulders","quads, arms",anti-rotation,conditioning,none,reps,bodyweight,yes,beginner,expanded
Kettlebell swing,"glutes, hamstrings","core, shoulders",power,power,kettlebell,reps,total,no,beginner,expanded
Kettlebell clean,"glutes, hamstrings, shoulders","core, forearms",power,power,kettlebell,reps,per_hand,yes,intermediate,expanded
Kettlebell snatch,"glutes, hamstrings, shoulders","core, forearms",power,power,kettlebell,reps,per_hand,yes,advanced,expanded
Kettlebell clean and press,"shoulders, glutes","hamstrings, arms, core",power,power,kettlebell,reps,per_hand,yes,intermediate,expanded
Kettlebell front-rack squat,"quads, glutes","core, shoulders",squat,lower-strength,kettlebell,reps,per_hand,no,beginner,expanded
Kettlebell Turkish get-up,"shoulders, core","glutes, arms",mobility,core,kettlebell,reps,per_hand,yes,advanced,expanded
Kettlebell windmill,"obliques, shoulders","hamstrings, core",rotation,core,kettlebell,reps,per_hand,yes,intermediate,expanded
Bottoms-up kettlebell carry,"forearms, shoulders","core, rotator_cuff",carry,prevention,kettlebell,metres,per_hand,yes,intermediate,expanded
Overhead carry,"shoulders, core","forearms, upper_back",carry,core,dumbbells,metres,per_hand,no,beginner,expanded
Front-rack carry,"core, upper_back","shoulders, forearms",carry,core,kettlebell,metres,per_hand,no,beginner,expanded
Waiter carry,"shoulders, core","forearms, rotator_cuff",carry,core,kettlebell,metres,per_hand,yes,beginner,expanded
Bear-hug carry,"core, upper_back","arms, glutes",carry,conditioning,sandbag,metres,total,no,beginner,expanded
Landmine squat,"quads, glutes",core,squat,lower-strength,landmine,reps,total,no,beginner,expanded
Landmine reverse lunge,"quads, glutes","core, shoulders",single-leg,lower-strength,landmine,reps,total,yes,beginner,expanded
Landmine Romanian deadlift,"hamstrings, glutes","lower_back, forearms",hinge,lower-strength,landmine,reps,total,no,beginner,expanded
Landmine row,"upper_back, lats",arms,pull,upper-strength,landmine,reps,total,no,beginner,expanded
Meadows row,"lats, upper_back","arms, obliques",pull,upper-strength,landmine,reps,total,yes,intermediate,expanded
Landmine rotation,"obliques, core","shoulders, glutes",rotation,core,landmine,reps,total,yes,beginner,expanded
Landmine thruster,"quads, glutes, shoulders","arms, core",power,power,landmine,reps,total,no,beginner,expanded
TRX row,"upper_back, lats","arms, core",pull,upper-strength,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX chest press,"chest, shoulders","arms, core",push,upper-strength,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX Y raise,"shoulders, upper_back","rotator_cuff, core",pull,prevention,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX hamstring curl,"hamstrings, glutes",core,hinge,lower-strength,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX fallout,"core, shoulders",lats,anti-rotation,core,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX split squat,"quads, glutes",core,single-leg,lower-strength,suspension trainer,reps,bodyweight,yes,beginner,expanded
Sled push,"quads, glutes","calves, core",push,conditioning,sled,metres,total,no,beginner,expanded
Sled pull,"hamstrings, glutes","calves, upper_back",pull,conditioning,sled,metres,total,no,beginner,expanded
Backward sled drag,"quads, shins","calves, core",pull,conditioning,sled,metres,total,no,beginner,expanded
Lateral sled drag,"adductors, glutes","core, calves",lateral,conditioning,sled,metres,total,yes,beginner,expanded
Battle rope alternating waves,"shoulders, arms","core, forearms",power,conditioning,battle ropes,seconds,bodyweight,no,beginner,expanded
Battle rope double waves,"shoulders, arms","core, forearms",power,conditioning,battle ropes,seconds,bodyweight,no,beginner,expanded
Battle rope slams,"shoulders, lats","core, arms",power,conditioning,battle ropes,reps,bodyweight,no,beginner,expanded
Rope climb,"lats, arms","forearms, core",pull,conditioning,rope,metres,bodyweight,no,beginner,expanded
Broad jump,"quads, glutes, calves","hamstrings, core",power,power,none,reps,bodyweight,no,beginner,expanded
Depth jump,"quads, glutes, calves",,power,power,box,reps,bodyweight,no,advanced,expanded
Drop jump,"quads, glutes, calves",,power,power,box,reps,bodyweight,no,advanced,expanded
Tuck jump,"quads, glutes, calves",core,power,power,none,reps,bodyweight,no,intermediate,expanded
Split squat jump,"quads, glutes, calves",core,power,power,none,reps,bodyweight,yes,intermediate,expanded
Squat jump,"quads, glutes, calves",,power,power,none,reps,bodyweight,no,beginner,expanded
Lateral box jump,"glutes, quads, calves",adductors,power,power,box,reps,bodyweight,yes,intermediate,expanded
Single-leg box jump,"quads, glutes, calves",core,power,power,box,reps,bodyweight,yes,advanced,expanded
Hurdle hop,"quads, glutes, calves",,power,power,hurdles,reps,bodyweight,no,intermediate,expanded
Lateral hurdle hop,"glutes, adductors, calves",quads,power,power,hurdles,reps,bodyweight,yes,intermediate,expanded
Pogo jump,calves,"shins, quads",calf-ankle,power,none,reps,bodyweight,no,beginner,expanded
Single-leg hop to stick,"glutes, quads, calves","adductors, core",power,power,none,reps,bodyweight,yes,intermediate,expanded
Lateral line hop,"calves, shins",quads,power,conditioning,none,seconds,bodyweight,no,beginner,expanded
Forward-back line hop,"calves, shins",quads,power,conditioning,none,seconds,bodyweight,no,beginner,expanded
Box jump over,"quads, glutes, calves",core,power,power,box,reps,bodyweight,no,advanced,expanded
Medicine-ball chest pass,"chest, arms","shoulders, core",power,power,med_ball,reps,total,no,beginner,expanded
Medicine-ball overhead slam,"lats, shoulders, core","arms, glutes",power,power,med_ball,reps,total,no,beginner,expanded
Medicine-ball rotational wall throw,"obliques, glutes","shoulders, core",power,power,med_ball,reps,total,yes,beginner,expanded
Medicine-ball overhead throw,"shoulders, lats","core, glutes",power,power,med_ball,reps,total,no,beginner,expanded
Medicine-ball shot-put throw,"chest, shoulders","arms, obliques",power,power,med_ball,reps,total,yes,beginner,expanded
Medicine-ball backward throw,"glutes, hamstrings","shoulders, core",power,power,med_ball,reps,total,no,beginner,expanded
Agility ladder two-feet-in,"calves, shins","quads, core",lateral,conditioning,agility ladder,seconds,bodyweight,no,beginner,expanded
Agility ladder in-in-out-out,"calves, shins","quads, core",lateral,conditioning,agility ladder,seconds,bodyweight,no,beginner,expanded
Agility ladder lateral shuffle,"calves, glutes","adductors, core",lateral,conditioning,agility ladder,seconds,bodyweight,no,beginner,expanded
Cone shuttle run,"quads, glutes, calves","hamstrings, core",power,conditioning,cones,metres,bodyweight,no,beginner,expanded
5-10-5 shuttle,"quads, glutes, calves","adductors, core",lateral,conditioning,cones,metres,bodyweight,no,beginner,expanded
Lateral shuffle,"glutes, adductors","quads, calves",lateral,conditioning,cones,metres,bodyweight,no,beginner,expanded
Carioca drill,"adductors, glutes","calves, core",rotation,conditioning,cones,metres,bodyweight,no,beginner,expanded
Hanging knee raise,core,"arms, forearms",rotation,core,bar,reps,bodyweight,no,beginner,expanded
Hanging leg raise,core,"arms, forearms",rotation,core,bar,reps,bodyweight,no,intermediate,expanded
Ab wheel rollout,core,"shoulders, lats",anti-rotation,core,ab wheel,reps,bodyweight,no,intermediate,expanded
Cable crunch,core,,rotation,core,cable,reps,total,no,beginner,expanded
Reverse crunch,core,,rotation,core,none,reps,bodyweight,no,beginner,expanded
Bird dog,"core, lower_back","glutes, shoulders",anti-rotation,core,none,reps,bodyweight,yes,beginner,expanded
Hollow body hold,core,,anti-rotation,core,none,seconds,bodyweight,no,beginner,expanded
Plank,core,"shoulders, glutes",anti-rotation,core,none,seconds,bodyweight,no,beginner,expanded
Bear crawl,"core, shoulders","quads, arms",carry,conditioning,none,metres,bodyweight,no,beginner,expanded
Turkish sit-up,"core, shoulders",obliques,rotation,core,kettlebell,reps,per_hand,yes,beginner,expanded
Cable lift,"obliques, core","shoulders, glutes",rotation,core,cable,reps,total,yes,beginner,expanded
Stir the pot,"core, shoulders",obliques,anti-rotation,core,stability ball,reps,bodyweight,no,beginner,expanded
90/90 hip switch,"glutes, adductors",core,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
World greatest stretch,"glutes, hamstrings","core, shoulders",mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Half-kneeling hip flexor stretch,"quads, glutes",core,mobility,mobility,none,seconds,bodyweight,yes,beginner,expanded
Adductor rock-back,"adductors, glutes",core,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Ankle dorsiflexion mobilization,"calves, shins",,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Thoracic rotation,"upper_back, obliques",shoulders,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Wall slide,"shoulders, upper_back",rotator_cuff,mobility,mobility,none,reps,bodyweight,no,beginner,expanded
Scapular push-up,"shoulders, upper_back","chest, arms",push,prevention,none,reps,bodyweight,no,beginner,expanded
Scapular pull-up,"upper_back, lats","shoulders, arms",pull,prevention,bar,reps,bodyweight,no,beginner,expanded
Band internal rotation,rotator_cuff,shoulders,pull,prevention,band,reps,bodyweight,yes,beginner,expanded
Cable Y raise,"shoulders, upper_back",rotator_cuff,pull,prevention,cable,reps,total,no,beginner,expanded
Spanish squat,quads,"glutes, core",squat,prevention,band,seconds,bodyweight,no,beginner,expanded
Peterson step-up,quads,"glutes, calves",single-leg,prevention,box,reps,bodyweight,yes,beginner,expanded
Nordic hamstring curl,hamstrings,,hinge,prevention,nordic bench,reps,bodyweight,no,advanced,expanded
Reverse Nordic curl,quads,core,single-leg,prevention,none,reps,bodyweight,no,intermediate,expanded
Single-leg squat to box,"quads, glutes","core, calves",single-leg,lower-strength,box,reps,bodyweight,yes,intermediate,expanded`;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function buildPack(csv = CSV) {
  const { rows } = rowsFrom(csv);
  return rows.map((r, i) => normalizeRow(r, i)).filter(it => it.name).map(it => {
    const ex = buildCustomExercise(it, { idSuffix: 'pack' });
    return { ...ex, id: `p-${slug(it.name)}`, custom: false, pack: true,
      execute: it.cues || 'Start light and own the movement first. Use the video button for a demo.' };
  });
}

export const PACK_SIZE = registerPack(buildPack());
