window.TEMPLATES = {

  // Queue order: the order in which weight sessions rotate
  workoutQueue: ['push', 'pull', 'legs', 'upper', 'lower'],

  // Activity types (non-weights sessions)
  activityTypes: {
    tennis:   { name: 'Tennis',          icon: '🎾', defaultDuration: 60, calPerMin: 8 },
    run:      { name: 'Running',         icon: '🏃', defaultDuration: 30, calPerMin: 10 },
    treadmill:{ name: 'Treadmill',       icon: '🏃', defaultDuration: 25, calPerMin: 9 },
    cycle:    { name: 'Cycling',         icon: '🚴', defaultDuration: 30, calPerMin: 7 },
    swim:     { name: 'Swimming',        icon: '🏊', defaultDuration: 30, calPerMin: 9 },
    rowing:   { name: 'Rowing Machine',  icon: '🚣', defaultDuration: 20, calPerMin: 10 },
    crosstrainer:{ name: 'Cross-Trainer',icon: '🏋️', defaultDuration: 25, calPerMin: 8 },
    hiit:     { name: 'HIIT Session',    icon: '🔥', defaultDuration: 20, calPerMin: 12 },
    walk:     { name: 'Walking',         icon: '🚶', defaultDuration: 45, calPerMin: 4 },
    yoga:     { name: 'Yoga / Stretch',  icon: '🧘', defaultDuration: 30, calPerMin: 3 },
    custom:   { name: 'Custom Activity', icon: '✏️', defaultDuration: 30, calPerMin: 6 }
  },

  intensityLevels: [
    { id: 'light',    label: 'Light',    multiplier: 0.7 },
    { id: 'moderate', label: 'Moderate', multiplier: 1.0 },
    { id: 'hard',     label: 'Hard',     multiplier: 1.3 },
    { id: 'max',      label: 'All-out',  multiplier: 1.5 }
  ],

  workouts: {
    push: {
      name: 'Push — Chest · Shoulders · Triceps', icon: '💪',
      exercises: [
        { name:'Flat Barbell Bench Press',    sets:4, reps:'8-10',  rest:90,  muscle:'Chest',        tip:'Retract shoulder blades, slight arch. Bar travels from mid-chest to above shoulders in a slight arc.' },
        { name:'Incline Dumbbell Press',       sets:3, reps:'10-12', rest:75,  muscle:'Upper Chest',  tip:'30° incline. 2-second eccentric. Feel the stretch at the bottom.' },
        { name:'Cable Fly',                   sets:3, reps:'12-15', rest:60,  muscle:'Chest',        tip:'Think "hugging a tree". Squeeze hard at peak contraction, control the return.' },
        { name:'Overhead Barbell Press',      sets:3, reps:'8-10',  rest:90,  muscle:'Shoulders',    tip:'Brace core. Press straight up, move head through the bar path at the top.' },
        { name:'Lateral Raises',              sets:4, reps:'12-15', rest:45,  muscle:'Side Delts',   tip:'Lead with elbows, slight forward lean. Light weight, full control. No swinging.' },
        { name:'Tricep Rope Pushdowns',       sets:3, reps:'12-15', rest:45,  muscle:'Triceps',      tip:'Elbows pinned to sides. Spread the rope at the bottom for full contraction.' },
        { name:'Overhead Tricep Extension',   sets:3, reps:'10-12', rest:45,  muscle:'Triceps',      tip:'Elbows pointing forward, not flaring. Full stretch overhead.' }
      ]
    },
    pull: {
      name: 'Pull — Back · Biceps · Rear Delts', icon: '🔙',
      exercises: [
        { name:'Barbell Row',                 sets:4, reps:'8-10',  rest:90,  muscle:'Back',         tip:'Hinge to 45°. Pull to lower chest. Squeeze shoulder blades together at the top.' },
        { name:'Lat Pulldown (Wide)',          sets:3, reps:'10-12', rest:75,  muscle:'Lats',         tip:'Pull to upper chest. Lean back slightly. Full stretch at the top — feel the lat.' },
        { name:'Seated Cable Row',            sets:3, reps:'10-12', rest:75,  muscle:'Mid Back',     tip:'Sit tall. Pull to belly button. Hold for 1 second at contraction.' },
        { name:'Face Pulls',                  sets:4, reps:'15-20', rest:45,  muscle:'Rear Delts',   tip:'Cable at face height. Pull to ears with external rotation. Essential for posture.' },
        { name:'Barbell Curl',                sets:3, reps:'10-12', rest:45,  muscle:'Biceps',       tip:'Elbows stay at sides. No swinging. Slow 3-second eccentric.' },
        { name:'Hammer Curl',                 sets:3, reps:'10-12', rest:45,  muscle:'Biceps/Brachialis', tip:'Neutral grip. Works brachialis for arm thickness. Alternate arms.' },
        { name:'Conventional Deadlift',       sets:3, reps:'6-8',   rest:120, muscle:'Posterior Chain', tip:'Flat back, hinge at hips. Push the floor away. Bar stays close to shins.' }
      ]
    },
    legs: {
      name: 'Legs — Quads · Hamstrings · Glutes', icon: '🦵',
      exercises: [
        { name:'Barbell Back Squat',          sets:4, reps:'6-10',  rest:120, muscle:'Quads/Glutes', tip:'Push knees out over toes, chest up, break at hips first. Aim for parallel or below.' },
        { name:'Romanian Deadlift',           sets:3, reps:'10-12', rest:90,  muscle:'Hamstrings',   tip:'Soft knees, push hips back. Bar slides down thighs. Feel hamstring stretch.' },
        { name:'Leg Press',                   sets:3, reps:'10-12', rest:90,  muscle:'Quads',        tip:'Feet shoulder-width. Never lock knees at top. Control the descent.' },
        { name:'Walking Lunges',              sets:3, reps:'12 each',rest:60, muscle:'Quads/Glutes', tip:'Long strides for glutes, short strides for quads. Keep torso upright.' },
        { name:'Lying Leg Curl',              sets:3, reps:'12-15', rest:60,  muscle:'Hamstrings',   tip:'Squeeze at top. Slow eccentric. Hips stay on pad.' },
        { name:'Standing Calf Raises',        sets:4, reps:'15-20', rest:45,  muscle:'Calves',       tip:'Full ROM. 2-second pause at top. Go heavy — calves need high intensity.' },
        { name:'Plank',                       sets:3, reps:'45-60s', rest:30, muscle:'Core',         tip:'Squeeze glutes, brace abs. Straight line head to heels. Do not sag.' }
      ]
    },
    upper: {
      name: 'Upper Body — Full (Moderate Volume)', icon: '🏋️',
      exercises: [
        { name:'Dumbbell Bench Press',        sets:3, reps:'10-12', rest:75,  muscle:'Chest',        tip:'Touch at top, full stretch at bottom. More range of motion than barbell.' },
        { name:'Pull-ups',                    sets:3, reps:'6-10',  rest:90,  muscle:'Lats',         tip:'Dead hang at bottom, chin over bar. Use assisted machine if needed.' },
        { name:'Dumbbell Shoulder Press',     sets:3, reps:'10-12', rest:75,  muscle:'Shoulders',    tip:'Start at ear level, press straight up. Do not arch back excessively.' },
        { name:'Cable Row',                   sets:3, reps:'10-12', rest:60,  muscle:'Back',         tip:'Sit tall. Pull to navel. Squeeze shoulder blades together.' },
        { name:'Lateral + Front Raise (superset)',sets:3,reps:'12 each',rest:45,muscle:'Delts',     tip:'Lateral: lead with elbows. Front: thumbs slightly up. Light weight, strict form.' },
        { name:'Tricep Dips',                 sets:3, reps:'10-12', rest:60,  muscle:'Triceps',      tip:'Lean forward for chest emphasis, upright for triceps. Full lockout.' },
        { name:'EZ Bar Curl',                 sets:3, reps:'10-12', rest:45,  muscle:'Biceps',       tip:'Angled grip reduces wrist strain. Squeeze at peak. Slow negative.' }
      ]
    },
    lower: {
      name: 'Lower Body + Core', icon: '⬇️',
      exercises: [
        { name:'Front Squat',                 sets:4, reps:'8-10',  rest:90,  muscle:'Quads',        tip:'Elbows high, bar on front delts. More upright torso. Quad-dominant variation.' },
        { name:'Bulgarian Split Squat',       sets:3, reps:'10 each',rest:75, muscle:'Quads/Glutes', tip:'Rear foot on bench. Drop straight down. Great unilateral strength builder.' },
        { name:'Hip Thrust',                  sets:3, reps:'10-12', rest:75,  muscle:'Glutes',       tip:'Shoulders on bench, drive through heels. Squeeze glutes at top. Chin tucked.' },
        { name:'Leg Extension',               sets:3, reps:'12-15', rest:60,  muscle:'Quads',        tip:'Pause 1 second at top. Control the descent. Do not swing.' },
        { name:'Leg Curl',                    sets:3, reps:'12-15', rest:60,  muscle:'Hamstrings',   tip:'Slow 3-second eccentric. Squeeze at peak.' },
        { name:'Cable Woodchop',              sets:3, reps:'12 each',rest:45, muscle:'Obliques',     tip:'Rotate through thoracic spine. Arms stay straight. Control throughout.' },
        { name:'Hanging Leg Raises',          sets:3, reps:'10-15', rest:45,  muscle:'Abs',          tip:'Curl pelvis up — do not just swing legs. Control the negative.' },
        { name:'Ab Wheel Rollout',            sets:3, reps:'10-12', rest:45,  muscle:'Core',         tip:'Squeeze abs throughout. Only go as far as you can without arching.' }
      ]
    },
    tennis: {
      name: 'Tennis / Active Recovery', icon: '🎾',
      exercises: [
        { name:'Tennis Session',              sets:1, reps:'60-90 min',rest:0, muscle:'Full Body',   tip:'Focus on movement and enjoyment. Great cardio, agility, and mental health.' },
        { name:'Dynamic Warm-up',             sets:1, reps:'10 min',  rest:0, muscle:'Mobility',     tip:'Leg swings, arm circles, hip openers, walking lunges. Get synovial fluid flowing.' },
        { name:'Foam Rolling / Cool-down',    sets:1, reps:'10 min',  rest:0, muscle:'Recovery',     tip:'Focus on quads, IT band, calves, upper back. Maintain for 30-45 seconds each.' }
      ]
    },
    rest: {
      name: 'Rest & Recovery', icon: '😴',
      exercises: [
        { name:'Light Walk',                  sets:1, reps:'30-45 min',rest:0, muscle:'Recovery',    tip:'Easy conversational pace. Aim for 8,000+ steps total today.' },
        { name:'Mobility / Stretching',       sets:1, reps:'15-20 min',rest:0, muscle:'Flexibility', tip:'Hip flexors, hamstrings, chest, and shoulders — the areas that get tight from training.' }
      ]
    }
  },

  checklist: [
    { id:'oats',    label:'Ate oats / porridge', subtitle:'3g+ beta-glucan for cholesterol', icon:'🥣', xp:10 },
    { id:'steps',   label:'10,000+ steps',        subtitle:'Daily movement target',           icon:'👟', xp:15 },
    { id:'water',   label:'3 litres of water',     subtitle:'Hydration goal',                  icon:'💧', xp:10 },
    { id:'sleep',   label:'7+ hours sleep',         subtitle:'Recovery & hormones',             icon:'😴', xp:10 },
    { id:'protein', label:'Hit protein target',     subtitle:'130g+ today',                    icon:'💪', xp:15 },
    { id:'veggies', label:'5+ portions fruit/veg', subtitle:'Vitamins, fibre & antioxidants', icon:'🥦', xp:10 },
    { id:'workout', label:'Completed gym/activity', subtitle:'Training session done',           icon:'🏋️', xp:20 },
    { id:'alcohol', label:'No alcohol',             subtitle:'Zero today',                     icon:'🚫', xp:10 },
    { id:'mealprep',label:'Meals prepped/planned',  subtitle:'Tomorrow sorted',                icon:'📋', xp:10 },
    { id:'benecol', label:'Had plant sterol spread', subtitle:'Benecol or Flora ProActiv',     icon:'🧈', xp:5 }
  ],

  mealPlans: {
    vegDay: {
      name: 'Vegetarian Day', emoji: '🥗',
      meals: [
        { mealType:'breakfast', name:'Protein Porridge',       desc:'70g oats, 1 scoop whey, half banana, cinnamon, 10g chia seeds', cal:450, p:25, c:60, f:12, fi:8 },
        { mealType:'snack1',    name:'Almonds & Apple',         desc:'30g almonds, 1 medium apple',                                   cal:180, p:10, c:18, f:10, fi:5 },
        { mealType:'lunch',     name:'Lentil Dal & Brown Rice', desc:'80g red lentils, tomatoes, spices, 150g brown rice, salad',     cal:500, p:35, c:75, f:8,  fi:12 },
        { mealType:'snack2',    name:'Greek Yoghurt & Berries', desc:'200g 0% Greek yoghurt, mixed berries',                         cal:200, p:20, c:22, f:2,  fi:3 },
        { mealType:'dinner',    name:'Chickpea Spinach Curry',  desc:'150g chickpeas, spinach, peppers, 1 wholemeal chapati',         cal:550, p:35, c:65, f:15, fi:14 },
        { mealType:'evening',   name:'Oatcakes & Benecol',      desc:'2 oatcakes, Benecol spread, herbal tea',                       cal:100, p:5,  c:14, f:4,  fi:2 }
      ]
    },
    eggDay: {
      name: 'Egg Day', emoji: '🍳',
      meals: [
        { mealType:'breakfast', name:'Veggie Omelette',         desc:'3 eggs, spinach, mushroom, tomato, 1 wholemeal toast',         cal:450, p:30, c:25, f:22, fi:4 },
        { mealType:'snack1',    name:'Walnuts & Pear',           desc:'30g walnuts, 1 pear',                                          cal:180, p:8,  c:18, f:12, fi:5 },
        { mealType:'lunch',     name:'Mixed Bean Salad',         desc:'Kidney beans, black beans, sweetcorn, peppers, pitta, hummus', cal:500, p:30, c:65, f:12, fi:15 },
        { mealType:'snack2',    name:'Protein Shake',            desc:'1 scoop whey, water, 1 banana',                               cal:170, p:20, c:22, f:2,  fi:2 },
        { mealType:'dinner',    name:'Paneer Tikka & Rice',      desc:'150g paneer, peppers, onions, 150g brown rice, raita',        cal:550, p:35, c:50, f:22, fi:5 },
        { mealType:'evening',   name:'Berries & Herbal Tea',     desc:'Handful mixed berries, herbal tea',                           cal:100, p:5,  c:18, f:1,  fi:3 }
      ]
    },
    chickenDay: {
      name: 'Chicken Day', emoji: '🍗',
      meals: [
        { mealType:'breakfast', name:'Overnight Oats',          desc:'60g oats, oat milk, chia seeds, peanut butter, blueberries',  cal:420, p:25, c:52, f:14, fi:8 },
        { mealType:'snack1',    name:'Almonds & Apple',          desc:'30g almonds, 1 apple',                                        cal:180, p:10, c:18, f:10, fi:5 },
        { mealType:'lunch',     name:'Grilled Chicken Salad',    desc:'150g chicken breast, mixed leaves, avocado, cherry toms, roll',cal:520, p:40, c:35, f:20, fi:8 },
        { mealType:'snack2',    name:'Cottage Cheese',           desc:'200g cottage cheese with pineapple chunks',                   cal:180, p:20, c:15, f:5,  fi:1 },
        { mealType:'dinner',    name:'Rajma (Kidney Bean Curry)',desc:'Kidney beans, tomatoes, spices, 150g brown rice, green beans', cal:550, p:30, c:75, f:10, fi:16 },
        { mealType:'evening',   name:'Oatcakes & Benecol',       desc:'2 oatcakes, Benecol spread',                                 cal:100, p:5,  c:14, f:4,  fi:2 }
      ]
    }
  },

  foods: {
    'Porridge Oats (dry)':         { cal:375, p:11, c:66, f:8,   fi:9,   unit:'100g' },
    'Brown Rice (cooked)':         { cal:112, p:2.6,c:24, f:0.9, fi:1.8, unit:'100g' },
    'Red Lentils (dry)':           { cal:318, p:24, c:50, f:1.3, fi:11,  unit:'100g' },
    'Chickpeas (cooked)':          { cal:164, p:9,  c:27, f:2.6, fi:8,   unit:'100g' },
    'Kidney Beans (cooked)':       { cal:127, p:8.7,c:22, f:0.5, fi:6.4, unit:'100g' },
    'Paneer':                      { cal:321, p:25, c:1.2,f:25,  fi:0,   unit:'100g' },
    'Chicken Breast (cooked)':     { cal:165, p:31, c:0,  f:3.6, fi:0,   unit:'100g' },
    'Whole Egg':                   { cal:155, p:13, c:1.1,f:11,  fi:0,   unit:'100g' },
    'Egg White':                   { cal:52,  p:11, c:0.7,f:0.2, fi:0,   unit:'100g' },
    'Greek Yoghurt 0%':            { cal:59,  p:10, c:3.6,f:0.7, fi:0,   unit:'100g' },
    'Whey Protein (1 scoop 30g)':  { cal:120, p:24, c:3,  f:1.5, fi:0,   unit:'scoop' },
    'Almonds':                     { cal:579, p:21, c:22, f:50,  fi:12,  unit:'100g' },
    'Walnuts':                     { cal:654, p:15, c:14, f:65,  fi:7,   unit:'100g' },
    'Peanut Butter':               { cal:588, p:25, c:20, f:50,  fi:6,   unit:'100g' },
    'Banana (medium)':             { cal:89,  p:1.1,c:23, f:0.3, fi:2.6, unit:'100g' },
    'Apple (medium)':              { cal:52,  p:0.3,c:14, f:0.2, fi:2.4, unit:'100g' },
    'Blueberries':                 { cal:57,  p:0.7,c:14, f:0.3, fi:2.4, unit:'100g' },
    'Spinach':                     { cal:23,  p:2.9,c:3.6,f:0.4, fi:2.2, unit:'100g' },
    'Broccoli':                    { cal:34,  p:2.8,c:7,  f:0.4, fi:2.6, unit:'100g' },
    'Sweet Potato':                { cal:86,  p:1.6,c:20, f:0.1, fi:3,   unit:'100g' },
    'Avocado':                     { cal:160, p:2,  c:9,  f:15,  fi:7,   unit:'100g' },
    'Olive Oil':                   { cal:884, p:0,  c:0,  f:100, fi:0,   unit:'100g' },
    'Wholemeal Bread (slice)':     { cal:80,  p:4,  c:14, f:1,   fi:2.3, unit:'slice' },
    'Wholemeal Chapati':           { cal:120, p:4,  c:22, f:2,   fi:3,   unit:'each' },
    'Quinoa (cooked)':             { cal:120, p:4.4,c:21, f:1.9, fi:2.8, unit:'100g' },
    'Tofu (firm)':                 { cal:144, p:17, c:3,  f:9,   fi:2,   unit:'100g' },
    'Hummus':                      { cal:166, p:8,  c:14, f:10,  fi:4,   unit:'100g' },
    'Cottage Cheese':              { cal:98,  p:11, c:3.4,f:4.3, fi:0,   unit:'100g' },
    'Oat Milk':                    { cal:46,  p:1,  c:7,  f:1.5, fi:0.8, unit:'100g' },
    'Chia Seeds':                  { cal:486, p:17, c:42, f:31,  fi:34,  unit:'100g' },
    'Oatcake':                     { cal:45,  p:1,  c:7,  f:1.5, fi:1,   unit:'each' },
    'Dal (cooked, avg)':           { cal:104, p:7,  c:16, f:1.5, fi:4,   unit:'100g' },
    'Mixed Salad Leaves':          { cal:20,  p:1.5,c:3,  f:0.3, fi:2,   unit:'100g' },
    'Tomato':                      { cal:18,  p:0.9,c:3.9,f:0.2, fi:1.2, unit:'100g' },
    'Cucumber':                    { cal:15,  p:0.7,c:3.6,f:0.1, fi:0.5, unit:'100g' },
    'Mushrooms':                   { cal:22,  p:3.1,c:3.3,f:0.3, fi:1,   unit:'100g' },
    'Green Beans':                 { cal:31,  p:1.8,c:7,  f:0.2, fi:2.7, unit:'100g' },
    'Sweetcorn':                   { cal:86,  p:3.3,c:19, f:1.2, fi:2.7, unit:'100g' },
    'Bell Pepper':                 { cal:20,  p:0.9,c:4.6,f:0.2, fi:1.7, unit:'100g' },
    'Benecol Spread':              { cal:35,  p:0,  c:0,  f:4,   fi:0,   unit:'10g serve' },
    'Black Beans (cooked)':        { cal:132, p:8.9,c:24, f:0.5, fi:8.7, unit:'100g' }
  },

  userDefaults: {
    name: 'Akshay',
    height: 168,
    startWeight: 87,
    currentWeight: 87,
    targetWeight: 73.5,
    age: 36,
    gender: 'male',
    activityLevel: 1.55,
    calorieTarget: 2000,
    proteinTarget: 130,
    carbTarget: 220,
    fatTarget: 65,
    fibreTarget: 30,
    diet: 'mostly-vegetarian',
    splitType: 'ppl_ul',
    weeklyTarget: 5,
    restDayPref: 'none'
  }
};
