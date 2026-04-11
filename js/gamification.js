const GAMIFICATION = {

  levels: [
    { level:1,  name:'Beginner',       minXP:0,     color:'#888' },
    { level:2,  name:'Getting Started', minXP:100,   color:'#aaa' },
    { level:3,  name:'Committed',       minXP:250,   color:'#bbb' },
    { level:4,  name:'Consistent',      minXP:450,   color:'#0ff0b3' },
    { level:5,  name:'Motivated',       minXP:700,   color:'#0ff0b3' },
    { level:6,  name:'Disciplined',     minXP:1000,  color:'#00d4a0' },
    { level:7,  name:'Dedicated',       minXP:1400,  color:'#00d4a0' },
    { level:8,  name:'Focused',         minXP:1900,  color:'#f0a500' },
    { level:9,  name:'Serious',         minXP:2500,  color:'#f0a500' },
    { level:10, name:'Advanced',        minXP:3200,  color:'#e8940a' },
    { level:11, name:'Expert',          minXP:4000,  color:'#e8940a' },
    { level:12, name:'Elite',           minXP:5000,  color:'#ff6b35' },
    { level:13, name:'Champion',        minXP:6200,  color:'#ff6b35' },
    { level:14, name:'Warrior',         minXP:7600,  color:'#ff4500' },
    { level:15, name:'Iron Will',       minXP:9200,  color:'#ff4500' },
    { level:16, name:'Beast Mode',      minXP:11000, color:'#cc0000' },
    { level:17, name:'Legend',          minXP:13000, color:'#cc0000' },
    { level:18, name:'Titan',           minXP:15500, color:'#9b30ff' },
    { level:19, name:'Apex',            minXP:18500, color:'#9b30ff' },
    { level:20, name:'Athlete',         minXP:22000, color:'#FFD700' }
  ],

  xpValues: {
    logWorkout:      50,
    hitProtein:      30,
    hitCalories:     20,
    completeChecklist: 20,
    checklistItem:   10,
    logWeight:       10,
    logMeal:         10,
    logVoice:        15,
    photoFood:       15,
    newPR:           75,
    streakBonus:     25,
    weeklyGoal:      100
  },

  badgeDefs: [
    { id:'first_log',       name:'First Step',        desc:'Log your first workout',                icon:'🏁', xp:25 },
    { id:'first_meal',      name:'Fuelled Up',         desc:'Log your first meal',                   icon:'🍽️', xp:25 },
    { id:'first_weight',    name:'Weighed In',         desc:'Log your first weight entry',           icon:'⚖️', xp:25 },
    { id:'streak_3',        name:'Warming Up',         desc:'3-day logging streak',                  icon:'🔥', xp:30 },
    { id:'streak_7',        name:'Week Warrior',       desc:'7-day logging streak',                  icon:'🔥', xp:75 },
    { id:'streak_14',       name:'Fortnight Fighter',  desc:'14-day logging streak',                 icon:'🔥', xp:150 },
    { id:'streak_30',       name:'Monthly Legend',     desc:'30-day logging streak',                 icon:'🏆', xp:300 },
    { id:'streak_60',       name:'Ironclad',           desc:'60-day logging streak',                 icon:'💎', xp:600 },
    { id:'streak_100',      name:'Centurion',          desc:'100-day logging streak',                icon:'💯', xp:1000 },
    { id:'weight_5kg',      name:'-5kg Achieved',      desc:'Lost 5kg from start weight',            icon:'⬇️', xp:200 },
    { id:'weight_10kg',     name:'-10kg Milestone',    desc:'Lost 10kg from start weight',           icon:'🎯', xp:400 },
    { id:'weight_target',   name:'Target Reached!',    desc:'Hit your goal weight',                  icon:'🏆', xp:1000 },
    { id:'protein_week',    name:'Protein Pro',        desc:'Hit protein target 7 days in a row',    icon:'💪', xp:100 },
    { id:'workouts_10',     name:'10 Sessions',        desc:'Complete 10 gym sessions',              icon:'💪', xp:100 },
    { id:'workouts_25',     name:'25 Sessions',        desc:'Complete 25 gym sessions',              icon:'🏋️', xp:200 },
    { id:'workouts_50',     name:'50 Sessions',        desc:'Complete 50 gym sessions',              icon:'🦾', xp:400 },
    { id:'workouts_100',    name:'Century Club',       desc:'Complete 100 gym sessions',             icon:'💯', xp:800 },
    { id:'first_pr',        name:'Personal Best',      desc:'Set your first personal record',        icon:'🏅', xp:75 },
    { id:'pr_5',            name:'PR Machine',         desc:'Set 5 personal records',                icon:'📈', xp:150 },
    { id:'cholesterol_log', name:'Cholesterol Check',  desc:'Log your first cholesterol result',     icon:'❤️', xp:50 },
    { id:'cholesterol_imp', name:'Cholesterol Warrior',desc:'Improve LDL cholesterol level',         icon:'💚', xp:300 },
    { id:'photo_progress',  name:'Progress Photo',     desc:'Take your first progress photo',        icon:'📸', xp:50 },
    { id:'voice_log',       name:'Hands-Free Logger',  desc:'Use voice logging for the first time',  icon:'🎤', xp:30 },
    { id:'checklist_week',  name:'Full Week Clean',    desc:'Complete full checklist 7 days running', icon:'✅', xp:150 },
    { id:'xp_1000',         name:'Four Figures',       desc:'Earn 1,000 total XP',                   icon:'⭐', xp:50 },
    { id:'xp_5000',         name:'High Achiever',      desc:'Earn 5,000 total XP',                   icon:'🌟', xp:100 }
  ],

  async getTotalXP() {
    const all = await DB.getAll('xp');
    return all.reduce((sum, r) => sum + (r.amount || 0), 0);
  },

  getLevelFromXP(totalXP) {
    let current = this.levels[0];
    for (const l of this.levels) {
      if (totalXP >= l.minXP) current = l;
      else break;
    }
    const nextIdx = this.levels.indexOf(current) + 1;
    const next = this.levels[nextIdx] || null;
    const progress = next
      ? ((totalXP - current.minXP) / (next.minXP - current.minXP)) * 100
      : 100;
    return { ...current, totalXP, next, progress: Math.round(progress) };
  },

  async awardXP(amount, source, detail = '') {
    const today = DB.today();
    await DB.add('xp', { amount, source, detail, date: today });
    await this.checkBadges();
    return amount;
  },

  async getEarnedBadges() {
    return DB.getAll('badges');
  },

  async awardBadge(badgeId) {
    const existing = await DB.get('badges', badgeId);
    if (existing) return false;
    const def = this.badgeDefs.find(b => b.id === badgeId);
    if (!def) return false;
    await DB.put('badges', { id: badgeId, earnedAt: DB.today(), ...def });
    await this.awardXP(def.xp, 'badge', def.name);
    this._showBadgeNotif(def);
    return true;
  },

  async checkBadges() {
    const earned = (await this.getEarnedBadges()).map(b => b.id);
    const check = async (id, condition) => {
      if (!earned.includes(id) && await condition()) await this.awardBadge(id);
    };

    const meals = await DB.getAll('meals');
    const workouts = await DB.getAll('workouts');
    const weights = await DB.getAll('weight');
    const xpAll = await DB.getAll('xp');
    const totalXP = xpAll.reduce((s,r) => s + r.amount, 0);

    await check('first_log',    async () => workouts.length >= 1);
    await check('first_meal',   async () => meals.length >= 1);
    await check('first_weight', async () => weights.length >= 1);
    await check('workouts_10',  async () => workouts.length >= 10);
    await check('workouts_25',  async () => workouts.length >= 25);
    await check('workouts_50',  async () => workouts.length >= 50);
    await check('workouts_100', async () => workouts.length >= 100);
    await check('xp_1000',      async () => totalXP >= 1000);
    await check('xp_5000',      async () => totalXP >= 5000);
    await check('voice_log',    async () => xpAll.some(x => x.source === 'voice'));
    await check('photo_progress', async () => (await DB.getAll('photos')).some(p => p.type === 'progress'));
    await check('cholesterol_log', async () => (await DB.getAll('cholesterol')).length >= 1);

    // Weight loss badges
    const settings = window._userSettings;
    if (settings && weights.length > 0) {
      const start = settings.startWeight || 87;
      const latest = weights.sort((a,b) => b.date.localeCompare(a.date))[0];
      const lost = start - latest.weight;
      await check('weight_5kg',    async () => lost >= 5);
      await check('weight_10kg',   async () => lost >= 10);
      await check('weight_target', async () => latest.weight <= (settings.targetWeight || 73.5));
    }

    // Streak badges
    const streak = await this.getCurrentStreak();
    await check('streak_3',   async () => streak >= 3);
    await check('streak_7',   async () => streak >= 7);
    await check('streak_14',  async () => streak >= 14);
    await check('streak_30',  async () => streak >= 30);
    await check('streak_60',  async () => streak >= 60);
    await check('streak_100', async () => streak >= 100);
  },

  async getCurrentStreak() {
    const checklists = await DB.getAll('checklist');
    if (!checklists.length) return 0;
    const dates = [...new Set(checklists.map(c => c.date))].sort().reverse();
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0,0,0,0);
    for (const dateStr of dates) {
      const d = new Date(dateStr + 'T00:00:00');
      const diff = Math.round((cursor - d) / 86400000);
      if (diff <= 1) { streak++; cursor = d; }
      else break;
    }
    return streak;
  },

  async getTodayXP() {
    const today = DB.today();
    const all = await DB.getByIndex('xp', 'date', today);
    return all.reduce((s,r) => s + r.amount, 0);
  },

  _showBadgeNotif(badge) {
    const el = document.createElement('div');
    el.className = 'badge-notif';
    el.innerHTML = `<div class="badge-notif__icon">${badge.icon}</div><div><div class="badge-notif__title">Badge Unlocked!</div><div class="badge-notif__name">${badge.name}</div><div class="badge-notif__desc">${badge.desc}</div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 10);
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 500); }, 4000);
  },

  showLevelUp(levelInfo) {
    const el = document.createElement('div');
    el.className = 'levelup-overlay';
    el.innerHTML = `
      <div class="levelup-box">
        <div class="levelup-stars">⭐</div>
        <div class="levelup-label">Level Up!</div>
        <div class="levelup-level">${levelInfo.level}</div>
        <div class="levelup-name">${levelInfo.name}</div>
        <button class="levelup-btn" onclick="this.closest('.levelup-overlay').remove()">Let's Go!</button>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 10);
  }
};

window.GAMIFICATION = GAMIFICATION;
