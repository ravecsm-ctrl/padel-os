// Expansion pack: 211 more exercises (barbell, Smith machine, machines, cables, kettlebells,
// TRX, sled, ropes, plyometrics, agility, core and mobility). Kept as CSV in the importer's own
// format so it's easy to read and extend; turned into library exercises when the app starts.
import { rowsFrom, normalizeRow, buildCustomExercise } from './domain-importer.js';
import { registerPack } from './domain-catalog.js';

const CSV = `name,primary_muscles,secondary_muscles,movement,category,equipment,unit,weight_type,per_side,level,source
Barbell back squat,"quads, glutes","adductors, lower_back, abs",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell front squat,"quads, glutes","abs, mid_back",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell box squat,"glutes, quads","hamstrings, adductors, lower_back",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell hack squat,quads,"glutes, hamstrings",squat,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell sumo squat,"adductors, glutes, quads",abs,squat,lower-strength,barbell,reps,total,no,beginner,expanded
Zercher squat,"quads, glutes","abs, mid_back, biceps",squat,lower-strength,barbell,reps,total,no,advanced,expanded
Overhead squat,"quads, glutes","front_delts, traps, mid_back, abs",squat,lower-strength,barbell,reps,total,no,advanced,expanded
Barbell conventional deadlift,"glutes, hamstrings","quads, lower_back, traps, forearms",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell sumo deadlift,"glutes, adductors, hamstrings","quads, lower_back, traps, forearms",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell good morning,"hamstrings, glutes","lower_back, abs",hinge,lower-strength,barbell,reps,total,no,intermediate,expanded
Barbell hip thrust,glutes,"hamstrings, glute_med, quads",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell glute bridge,glutes,"hamstrings, glute_med",hinge,lower-strength,barbell,reps,total,no,beginner,expanded
Barbell walking lunge,"quads, glutes","adductors, abs, glute_med",single-leg,lower-strength,barbell,reps,total,yes,intermediate,expanded
Barbell calf raise,calves,soleus,calf-ankle,lower-strength,barbell,reps,total,no,beginner,expanded
Smith machine back squat,"quads, glutes","adductors, abs",squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine front squat,"quads, glutes","abs, mid_back",squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine box squat,"glutes, quads","hamstrings, adductors",squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine hack squat,quads,"glutes, hamstrings",squat,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine split squat,"quads, glutes","adductors, abs, glute_med",single-leg,lower-strength,bar,reps,total,yes,beginner,expanded
Smith machine hip thrust,glutes,"hamstrings, glute_med, quads",hinge,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine glute bridge,glutes,"hamstrings, glute_med",hinge,lower-strength,bar,reps,total,no,beginner,expanded
Smith machine seated shoulder press,"front_delts, side_delts","triceps, upper_chest",push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine bench press,chest,"front_delts, triceps",push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine incline bench press,"upper_chest, front_delts","triceps, chest",push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine close-grip bench press,"triceps, chest",front_delts,push,upper-strength,bar,reps,total,no,beginner,expanded
Smith machine bent-over row,"mid_back, lats","biceps, lower_back, rear_delts",pull,upper-strength,bar,reps,total,no,beginner,expanded
Hack squat machine,quads,"glutes, adductors",squat,lower-strength,hack squat,reps,total,no,beginner,expanded
Pendulum squat,quads,"glutes, adductors",squat,lower-strength,pendulum squat,reps,total,no,beginner,expanded
Belt squat,"quads, glutes","adductors, hamstrings",squat,lower-strength,belt squat,reps,total,no,beginner,expanded
V-squat machine,"quads, glutes",adductors,squat,lower-strength,v squat,reps,total,no,beginner,expanded
Leg extension machine,quads,,squat,lower-strength,leg extension,reps,total,no,beginner,expanded
Single-leg leg extension,quads,,single-leg,lower-strength,leg extension,reps,total,yes,beginner,expanded
Lying leg curl machine,hamstrings,calves,hinge,lower-strength,leg_curl,reps,total,no,beginner,expanded
Seated leg curl machine,hamstrings,calves,hinge,lower-strength,leg_curl,reps,total,no,beginner,expanded
Standing single-leg curl machine,hamstrings,calves,hinge,lower-strength,leg_curl,reps,total,yes,beginner,expanded
Hip abduction machine,glute_med,glutes,lateral,lower-strength,hip abduction,reps,total,no,beginner,expanded
Glute kickback machine,glutes,"hamstrings, glute_med",hinge,lower-strength,glute machine,reps,total,yes,beginner,expanded
Reverse hyperextension,"glutes, hamstrings",lower_back,hinge,lower-strength,reverse hyper,reps,total,no,beginner,expanded
45-degree back extension,"lower_back, glutes",hamstrings,hinge,lower-strength,back extension,reps,total,no,beginner,expanded
Glute-ham raise,hamstrings,"glutes, calves, lower_back",hinge,lower-strength,glute ham developer,reps,total,no,beginner,expanded
Donkey calf raise machine,calves,soleus,calf-ankle,lower-strength,calf_machine,reps,total,no,beginner,expanded
Leg press calf raise,calves,soleus,calf-ankle,lower-strength,leg_press,reps,total,no,beginner,expanded
Dumbbell front squat,"quads, glutes","adductors, abs",squat,lower-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell sumo squat,"adductors, glutes, quads",abs,squat,lower-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell walking lunge,"quads, glutes","adductors, abs, glute_med",single-leg,lower-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Dumbbell step-up,"quads, glutes","calves, abs, glute_med",single-leg,lower-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Dumbbell sumo deadlift,"glutes, adductors, hamstrings","quads, forearms",hinge,lower-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell hip thrust,glutes,"hamstrings, glute_med",hinge,lower-strength,dumbbells,reps,total,no,beginner,expanded
Barbell bench press,chest,"front_delts, triceps",push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell incline bench press,"upper_chest, front_delts","triceps, chest",push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell decline bench press,"lower_chest, chest","triceps, front_delts",push,upper-strength,barbell,reps,total,no,beginner,expanded
Close-grip bench press,"triceps, chest",front_delts,push,upper-strength,barbell,reps,total,no,beginner,expanded
Floor press,"chest, triceps",front_delts,push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell overhead press,"front_delts, side_delts","triceps, upper_chest, traps, abs",push,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell push press,"front_delts, side_delts","triceps, quads, glutes, traps",power,power,barbell,reps,total,no,intermediate,expanded
Barbell bent-over row,"mid_back, lats","biceps, lower_back, rear_delts",pull,upper-strength,barbell,reps,total,no,beginner,expanded
Pendlay row,"mid_back, lats","biceps, lower_back, rear_delts",pull,upper-strength,barbell,reps,total,no,intermediate,expanded
T-bar row,"mid_back, lats","biceps, rear_delts",pull,upper-strength,landmine,reps,total,no,beginner,expanded
Barbell upright row,"side_delts, traps","front_delts, biceps",pull,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell shrug,traps,forearms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell biceps curl,biceps,forearms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
EZ-bar biceps curl,biceps,forearms,pull,upper-strength,barbell,reps,total,no,beginner,expanded
Barbell skull crusher,triceps,,push,upper-strength,barbell,reps,total,no,beginner,expanded
Dumbbell bench press,chest,"front_delts, triceps",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell incline bench press,"upper_chest, front_delts","triceps, chest",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell decline bench press,"lower_chest, chest","triceps, front_delts",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell floor press,"chest, triceps",front_delts,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell fly,chest,front_delts,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Incline dumbbell fly,upper_chest,"front_delts, chest",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell shoulder press,"front_delts, side_delts","triceps, upper_chest, traps",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Arnold press,"front_delts, side_delts","triceps, upper_chest",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell lateral raise,side_delts,traps,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell front raise,front_delts,"upper_chest, side_delts",push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell reverse fly,"rear_delts, mid_back","rotator_cuff, traps",pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell pullover,"lats, chest","triceps, abs",pull,upper-strength,dumbbells,reps,total,no,beginner,expanded
Dumbbell shrug,traps,forearms,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell biceps curl,biceps,forearms,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Hammer curl,"biceps, forearms",,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Incline dumbbell curl,biceps,forearms,pull,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Concentration curl,biceps,forearms,pull,upper-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Dumbbell triceps extension,triceps,,push,upper-strength,dumbbells,reps,total,no,beginner,expanded
Dumbbell skull crusher,triceps,,push,upper-strength,dumbbells,reps,per_hand,no,beginner,expanded
Dumbbell triceps kickback,triceps,rear_delts,push,upper-strength,dumbbells,reps,per_hand,yes,beginner,expanded
Lat pulldown,"lats, mid_back","biceps, rear_delts",pull,upper-strength,cable,reps,total,no,beginner,expanded
Close-grip lat pulldown,"lats, mid_back","biceps, rear_delts",pull,upper-strength,cable,reps,total,no,beginner,expanded
Single-arm lat pulldown,lats,"biceps, mid_back, obliques",pull,upper-strength,cable,reps,total,yes,beginner,expanded
Straight-arm cable pulldown,lats,"triceps, abs, rear_delts",pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable chest press,chest,"front_delts, triceps",push,upper-strength,cable,reps,total,no,beginner,expanded
Cable crossover,chest,front_delts,push,upper-strength,cable,reps,total,no,beginner,expanded
Low-to-high cable fly,upper_chest,"front_delts, chest",push,upper-strength,cable,reps,total,no,beginner,expanded
High-to-low cable fly,lower_chest,"chest, front_delts",push,upper-strength,cable,reps,total,no,beginner,expanded
Cable lateral raise,side_delts,traps,push,upper-strength,cable,reps,total,yes,beginner,expanded
Cable front raise,front_delts,"upper_chest, side_delts",push,upper-strength,cable,reps,total,no,beginner,expanded
Cable reverse fly,"rear_delts, mid_back","rotator_cuff, traps",pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable upright row,"side_delts, traps","front_delts, biceps",pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable shrug,traps,forearms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable biceps curl,biceps,forearms,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable hammer curl,"biceps, forearms",,pull,upper-strength,cable,reps,total,no,beginner,expanded
Cable triceps pushdown,triceps,,push,upper-strength,cable,reps,total,no,beginner,expanded
Cable overhead triceps extension,triceps,,push,upper-strength,cable,reps,total,no,beginner,expanded
Cable pull-through,"glutes, hamstrings",lower_back,hinge,lower-strength,cable,reps,total,no,beginner,expanded
Chest press machine,chest,"front_delts, triceps",push,upper-strength,chest press,reps,total,no,beginner,expanded
Incline chest press machine,"upper_chest, front_delts","triceps, chest",push,upper-strength,chest press,reps,total,no,beginner,expanded
Pec deck fly,chest,front_delts,push,upper-strength,pec deck,reps,total,no,beginner,expanded
Reverse pec deck,"rear_delts, mid_back",rotator_cuff,pull,upper-strength,pec deck,reps,total,no,beginner,expanded
Shoulder press machine,"front_delts, side_delts","triceps, upper_chest",push,upper-strength,shoulder press,reps,total,no,beginner,expanded
Lateral raise machine,side_delts,,push,upper-strength,lateral raise machine,reps,total,no,beginner,expanded
High row machine,"mid_back, lats","biceps, rear_delts",pull,upper-strength,row machine,reps,total,no,beginner,expanded
Pullover machine,lats,"chest, triceps",pull,upper-strength,pullover machine,reps,total,no,beginner,expanded
Assisted pull-up,"lats, mid_back","biceps, abs, rear_delts",pull,upper-strength,assisted pull-up machine,reps,bodyweight,no,beginner,expanded
Assisted dip,"lower_chest, triceps","front_delts, chest",push,upper-strength,assisted dip machine,reps,bodyweight,no,beginner,expanded
Biceps curl machine,biceps,forearms,pull,upper-strength,curl machine,reps,total,no,beginner,expanded
Triceps extension machine,triceps,,push,upper-strength,triceps machine,reps,total,no,beginner,expanded
Pull-up,"lats, mid_back","biceps, abs, rear_delts",pull,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Chin-up,"lats, biceps","mid_back, abs, rear_delts",pull,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Neutral-grip pull-up,"lats, mid_back","biceps, abs, rear_delts",pull,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Dip,"lower_chest, triceps","front_delts, chest",push,upper-strength,bar,reps,bodyweight,no,beginner,expanded
Diamond push-up,"triceps, chest","front_delts, abs",push,upper-strength,none,reps,bodyweight,no,beginner,expanded
Decline push-up,"upper_chest, front_delts","triceps, chest, abs",push,upper-strength,none,reps,bodyweight,no,beginner,expanded
Handstand push-up,"front_delts, triceps","side_delts, traps, upper_chest, abs",push,upper-strength,none,reps,bodyweight,no,advanced,expanded
Burpee,"quads, glutes, chest","front_delts, triceps, abs, hip_flexors",power,conditioning,none,reps,bodyweight,no,beginner,expanded
Mountain climber,"abs, hip_flexors","front_delts, quads, obliques",anti-rotation,conditioning,none,reps,bodyweight,yes,beginner,expanded
Kettlebell swing,"glutes, hamstrings","lower_back, abs, forearms",power,power,kettlebell,reps,total,no,beginner,expanded
Kettlebell clean,"glutes, hamstrings","front_delts, traps, forearms, abs",power,power,kettlebell,reps,per_hand,yes,intermediate,expanded
Kettlebell snatch,"glutes, hamstrings, front_delts","side_delts, traps, forearms, abs",power,power,kettlebell,reps,per_hand,yes,advanced,expanded
Kettlebell clean and press,"front_delts, side_delts, glutes","triceps, hamstrings, traps, abs",power,power,kettlebell,reps,per_hand,yes,intermediate,expanded
Kettlebell front-rack squat,"quads, glutes","abs, mid_back, adductors",squat,lower-strength,kettlebell,reps,per_hand,no,beginner,expanded
Kettlebell Turkish get-up,"front_delts, abs, obliques","side_delts, rotator_cuff, glutes, triceps",mobility,core,kettlebell,reps,per_hand,yes,advanced,expanded
Kettlebell windmill,"obliques, abs","front_delts, rotator_cuff, hamstrings, glutes",rotation,core,kettlebell,reps,per_hand,yes,intermediate,expanded
Bottoms-up kettlebell carry,"forearms, rotator_cuff","front_delts, abs",carry,prevention,kettlebell,metres,per_hand,yes,intermediate,expanded
Overhead carry,"front_delts, side_delts, abs","traps, triceps, obliques",carry,core,dumbbells,metres,per_hand,no,beginner,expanded
Front-rack carry,"abs, obliques","mid_back, forearms, biceps",carry,core,kettlebell,metres,per_hand,no,beginner,expanded
Waiter carry,"front_delts, side_delts, rotator_cuff","abs, obliques, triceps",carry,core,kettlebell,metres,per_hand,yes,beginner,expanded
Bear-hug carry,"abs, mid_back","biceps, glutes, quads",carry,conditioning,sandbag,metres,total,no,beginner,expanded
Landmine squat,"quads, glutes","adductors, abs",squat,lower-strength,landmine,reps,total,no,beginner,expanded
Landmine reverse lunge,"quads, glutes","abs, front_delts, glute_med",single-leg,lower-strength,landmine,reps,total,yes,beginner,expanded
Landmine Romanian deadlift,"hamstrings, glutes","lower_back, forearms",hinge,lower-strength,landmine,reps,total,no,beginner,expanded
Landmine row,"mid_back, lats","biceps, rear_delts",pull,upper-strength,landmine,reps,total,no,beginner,expanded
Meadows row,"lats, mid_back","biceps, obliques, rear_delts",pull,upper-strength,landmine,reps,total,yes,intermediate,expanded
Landmine rotation,"obliques, abs","front_delts, glutes",rotation,core,landmine,reps,total,yes,beginner,expanded
Landmine thruster,"quads, glutes, front_delts","triceps, upper_chest, abs",power,power,landmine,reps,total,no,beginner,expanded
TRX row,"mid_back, lats","biceps, abs, rear_delts",pull,upper-strength,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX chest press,"chest, front_delts","triceps, abs",push,upper-strength,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX Y raise,"mid_back, rear_delts","side_delts, rotator_cuff",pull,prevention,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX hamstring curl,"hamstrings, glutes","calves, abs",hinge,lower-strength,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX fallout,"abs, front_delts",lats,anti-rotation,core,suspension trainer,reps,bodyweight,no,beginner,expanded
TRX split squat,"quads, glutes","abs, glute_med",single-leg,lower-strength,suspension trainer,reps,bodyweight,yes,beginner,expanded
Sled push,"quads, glutes","calves, soleus, hamstrings, abs",push,conditioning,sled,metres,total,no,beginner,expanded
Sled pull,"glutes, hamstrings","calves, quads, mid_back, forearms",pull,conditioning,sled,metres,total,no,beginner,expanded
Backward sled drag,quads,"shins, calves, mid_back, forearms",pull,conditioning,sled,metres,total,no,beginner,expanded
Lateral sled drag,"glute_med, adductors, glutes","quads, calves, abs",lateral,conditioning,sled,metres,total,yes,beginner,expanded
Battle rope alternating waves,front_delts,"forearms, biceps, triceps, abs",power,conditioning,battle ropes,seconds,bodyweight,no,beginner,expanded
Battle rope double waves,front_delts,"forearms, biceps, triceps, abs",power,conditioning,battle ropes,seconds,bodyweight,no,beginner,expanded
Battle rope slams,"lats, abs","front_delts, triceps, glutes",power,conditioning,battle ropes,reps,bodyweight,no,beginner,expanded
Rope climb,"lats, biceps","forearms, mid_back, abs",pull,conditioning,rope,metres,bodyweight,no,beginner,expanded
Broad jump,"glutes, quads, hamstrings","calves, soleus, abs",power,power,none,reps,bodyweight,no,beginner,expanded
Depth jump,"quads, glutes, calves",soleus,power,power,box,reps,bodyweight,no,advanced,expanded
Drop jump,"quads, glutes, calves",soleus,power,power,box,reps,bodyweight,no,advanced,expanded
Tuck jump,"quads, glutes, calves","hip_flexors, abs, soleus",power,power,none,reps,bodyweight,no,intermediate,expanded
Split squat jump,"quads, glutes, calves","abs, glute_med, soleus",power,power,none,reps,bodyweight,yes,intermediate,expanded
Squat jump,"quads, glutes, calves",soleus,power,power,none,reps,bodyweight,no,beginner,expanded
Lateral box jump,"glutes, glute_med, quads","adductors, calves, soleus",power,power,box,reps,bodyweight,yes,intermediate,expanded
Single-leg box jump,"quads, glutes, calves","abs, soleus",power,power,box,reps,bodyweight,yes,advanced,expanded
Hurdle hop,"quads, glutes, calves",soleus,power,power,hurdles,reps,bodyweight,no,intermediate,expanded
Lateral hurdle hop,"glute_med, adductors, calves","glutes, quads, soleus",power,power,hurdles,reps,bodyweight,yes,intermediate,expanded
Pogo jump,"calves, soleus","shins, quads",calf-ankle,power,none,reps,bodyweight,no,beginner,expanded
Single-leg hop to stick,"glutes, quads, calves","adductors, abs, soleus",power,power,none,reps,bodyweight,yes,intermediate,expanded
Lateral line hop,"calves, soleus","shins, glute_med, quads",power,conditioning,none,seconds,bodyweight,no,beginner,expanded
Forward-back line hop,"calves, soleus","shins, quads",power,conditioning,none,seconds,bodyweight,no,beginner,expanded
Box jump over,"quads, glutes, calves","abs, soleus",power,power,box,reps,bodyweight,no,advanced,expanded
Medicine-ball chest pass,"chest, triceps","front_delts, abs",power,power,med_ball,reps,total,no,beginner,expanded
Medicine-ball overhead slam,"lats, front_delts, abs","triceps, glutes",power,power,med_ball,reps,total,no,beginner,expanded
Medicine-ball rotational wall throw,"obliques, glutes","front_delts, abs",power,power,med_ball,reps,total,yes,beginner,expanded
Medicine-ball overhead throw,"lats, abs","front_delts, triceps, glutes",power,power,med_ball,reps,total,no,beginner,expanded
Medicine-ball shot-put throw,"chest, front_delts, obliques","triceps, glutes",power,power,med_ball,reps,total,yes,beginner,expanded
Medicine-ball backward throw,"glutes, hamstrings","lower_back, front_delts, traps",power,power,med_ball,reps,total,no,beginner,expanded
Agility ladder two-feet-in,"calves, shins","soleus, quads, hip_flexors",lateral,conditioning,agility ladder,seconds,bodyweight,no,beginner,expanded
Agility ladder in-in-out-out,"calves, shins","soleus, glute_med, quads, hip_flexors",lateral,conditioning,agility ladder,seconds,bodyweight,no,beginner,expanded
Agility ladder lateral shuffle,"glute_med, calves","adductors, quads, soleus",lateral,conditioning,agility ladder,seconds,bodyweight,no,beginner,expanded
Cone shuttle run,"quads, glutes, hamstrings","calves, soleus, adductors, hip_flexors",power,conditioning,cones,metres,bodyweight,no,beginner,expanded
5-10-5 shuttle,"quads, glutes, adductors","glute_med, hamstrings, calves, soleus",lateral,conditioning,cones,metres,bodyweight,no,beginner,expanded
Lateral shuffle,"glute_med, adductors, quads","glutes, calves",lateral,conditioning,cones,metres,bodyweight,no,beginner,expanded
Carioca drill,"adductors, glute_med","obliques, hip_flexors, calves",rotation,conditioning,cones,metres,bodyweight,no,beginner,expanded
Hanging knee raise,"abs, hip_flexors","forearms, lats, obliques",rotation,core,bar,reps,bodyweight,no,beginner,expanded
Hanging leg raise,"abs, hip_flexors","forearms, lats, obliques",rotation,core,bar,reps,bodyweight,no,intermediate,expanded
Ab wheel rollout,abs,"front_delts, lats",anti-rotation,core,ab wheel,reps,bodyweight,no,intermediate,expanded
Cable crunch,abs,obliques,rotation,core,cable,reps,total,no,beginner,expanded
Reverse crunch,abs,"hip_flexors, obliques",rotation,core,none,reps,bodyweight,no,beginner,expanded
Bird dog,"abs, lower_back","glutes, front_delts",anti-rotation,core,none,reps,bodyweight,yes,beginner,expanded
Hollow body hold,abs,"hip_flexors, obliques",anti-rotation,core,none,seconds,bodyweight,no,beginner,expanded
Plank,abs,"obliques, front_delts, glutes",anti-rotation,core,none,seconds,bodyweight,no,beginner,expanded
Bear crawl,"abs, front_delts","quads, hip_flexors, triceps",carry,conditioning,none,metres,bodyweight,no,beginner,expanded
Turkish sit-up,"abs, hip_flexors","obliques, front_delts",rotation,core,kettlebell,reps,per_hand,yes,beginner,expanded
Cable lift,"obliques, abs","front_delts, glutes",rotation,core,cable,reps,total,yes,beginner,expanded
Stir the pot,"abs, front_delts","obliques, lats",anti-rotation,core,stability ball,reps,bodyweight,no,beginner,expanded
90/90 hip switch,"glutes, hip_flexors","adductors, glute_med",mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
World greatest stretch,"hip_flexors, hamstrings","glutes, adductors, mid_back",mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Half-kneeling hip flexor stretch,"hip_flexors, quads",glutes,mobility,mobility,none,seconds,bodyweight,yes,beginner,expanded
Adductor rock-back,"adductors, glutes",abs,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Ankle dorsiflexion mobilization,"soleus, calves",shins,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Thoracic rotation,"mid_back, obliques",lats,mobility,mobility,none,reps,bodyweight,yes,beginner,expanded
Wall slide,"rotator_cuff, mid_back",,mobility,mobility,none,reps,bodyweight,no,beginner,expanded
Scapular push-up,"front_delts, chest","abs, triceps",push,prevention,none,reps,bodyweight,no,beginner,expanded
Scapular pull-up,"mid_back, lats",forearms,pull,prevention,bar,reps,bodyweight,no,beginner,expanded
Band internal rotation,rotator_cuff,"chest, lats",pull,prevention,band,reps,bodyweight,yes,beginner,expanded
Cable Y raise,"mid_back, rear_delts","side_delts, rotator_cuff",pull,prevention,cable,reps,total,no,beginner,expanded
Spanish squat,quads,"glutes, abs",squat,prevention,band,seconds,bodyweight,no,beginner,expanded
Peterson step-up,quads,"glutes, glute_med",single-leg,prevention,box,reps,bodyweight,yes,beginner,expanded
Nordic hamstring curl,hamstrings,"glutes, calves",hinge,prevention,nordic bench,reps,bodyweight,no,advanced,expanded
Reverse Nordic curl,"quads, hip_flexors",abs,single-leg,prevention,none,reps,bodyweight,no,intermediate,expanded
Single-leg squat to box,"quads, glutes","glute_med, adductors, abs",single-leg,lower-strength,box,reps,bodyweight,yes,intermediate,expanded`;

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
