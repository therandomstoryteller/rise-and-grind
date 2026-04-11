const DASHBOARD = {
  weightChart: null,

  async render() {
    const el = document.getElementById('page-dashboard');
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Rise <span class="accent">&amp; Grind</span></h1><div class="header-date" id="dash-date"></div></div>
      <div id="dash-alerts"></div>
      <div class="motivation-card" id="dash-motivation"><div class="motivation-text" id="dash-motivation-text">Loading your daily insight...</div></div>
      <div class="stats-row">
        <div class="stat-card" onclick="APP.navigate('weight')">
          <div class="stat-label">Current Weight</div>
          <div class="stat-value" id="dash-weight">-- kg</div>
          <div class="stat-sub" id="dash-weight-change"></div>
        </div>
        <div class="stat-card" onclick="APP.navigate('weight')">
          <div class="stat-label">To Target</div>
          <div class="stat-value" id="dash-to-target">--</div>
          <div class="stat-sub">72–75 kg goal</div>
        </div>
        <div class="stat-card" onclick="APP.navigate('workout')">
          <div class="stat-label">Burned Today 🔥</div>
          <div class="stat-value" id="dash-burned">0 kcal</div>
          <div class="stat-sub" id="dash-to-burn"></div>
        </div>
        <div class="stat-card" onclick="APP.navigate('diet')">
          <div class="stat-label">Calories In</div>
          <div class="stat-value" id="dash-cals-in">0</div>
          <div class="stat-sub" id="dash-cal-sub">of 2000 target</div>
        </div>
      </div>
      <div class="rings-row">
        <div class="ring-card">
          <canvas id="ring-calories" width="100" height="100"></canvas>
          <div class="ring-label">Calories</div>
          <div class="ring-values" id="ring-cal-vals"></div>
        </div>
        <div class="ring-card">
          <canvas id="ring-protein" width="100" height="100"></canvas>
          <div class="ring-label">Protein</div>
          <div class="ring-values" id="ring-prot-vals"></div>
        </div>
        <div class="ring-card">
          <canvas id="ring-fibre" width="100" height="100"></canvas>
          <div class="ring-label">Fibre</div>
          <div class="ring-values" id="ring-fibre-vals"></div>
        </div>
      </div>
      <div class="section-card">
        <div class="section-title">Weight Trend</div>
        <div class="chart-container"><canvas id="weight-trend-chart"></canvas></div>
      </div>
      <div class="xp-section">
        <div class="xp-row">
          <div class="xp-level" id="dash-level">Lv.1</div>
          <div class="xp-name" id="dash-level-name">Beginner</div>
          <div class="xp-today" id="dash-xp-today"></div>
        </div>
        <div class="xp-bar-bg"><div class="xp-bar-fill" id="xp-bar-fill"></div></div>
        <div class="xp-bar-label" id="xp-bar-label"></div>
      </div>
      <div class="streak-row">
        <div class="streak-card">
          <div class="streak-num" id="dash-streak">0</div>
          <div class="streak-label">Day Streak 🔥</div>
        </div>
        <div class="streak-card">
          <div class="streak-num" id="dash-badges">0</div>
          <div class="streak-label">Badges 🏅</div>
        </div>
        <div class="streak-card">
          <div class="streak-num" id="dash-workouts">0</div>
          <div class="streak-label">Sessions 💪</div>
        </div>
      </div>
      <div class="section-card" id="dash-coach-card" style="display:none">
        <div class="coach-header"><span class="coach-icon">🤖</span><div><div class="coach-title">AI Coach</div><div class="coach-date" id="coach-card-date"></div></div></div>
        <div class="coach-message" id="coach-message-text"></div>
      </div>
      <div class="quick-actions">
        <button class="qa-btn" onclick="APP.navigate('weight'); setTimeout(()=>WEIGHT.showLogModal(),200)">⚖️<span>Log Weight</span></button>
        <button class="qa-btn" onclick="APP.navigate('workout')">🏋️<span>Workout</span></button>
        <button class="qa-btn" onclick="APP.navigate('diet'); setTimeout(()=>DIET.triggerCamera(),200)">📷<span>Snap Food</span></button>
        <button class="qa-btn" onclick="APP.navigate('checklist')">✅<span>Checklist</span></button>
      </div>`;

    await this.loadData();
  },

  async loadData() {
    const today = DB.today();
    document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });

    await Promise.all([
      this.loadWeightStats(),
      this.loadTodayMacros(),
      this.loadWeightChart(),
      this.loadXP(),
      this.loadStreak(),
      this.loadCoachMessage(),
      this.loadAlerts(),
      this.loadMotivation(),
      this.loadBurnStats()
    ]);
  },

  async loadWeightStats() {
    const weights = (await DB.getAll('weight')).sort((a,b) => b.date.localeCompare(a.date));
    const settings = window._userSettings || {};
    const target = settings.targetWeight || 73.5;

    if (weights.length) {
      const latest = weights[0].weight;
      const prev = weights[1]?.weight;
      document.getElementById('dash-weight').textContent = `${latest} kg`;
      if (prev) {
        const diff = (latest - prev).toFixed(1);
        const el = document.getElementById('dash-weight-change');
        el.textContent = diff > 0 ? `+${diff} kg` : `${diff} kg`;
        el.style.color = diff < 0 ? 'var(--accent)' : '#ff6b6b';
      }
      const toTarget = (latest - target).toFixed(1);
      document.getElementById('dash-to-target').textContent = toTarget > 0 ? `${toTarget} kg` : '✅ Done!';
    }
  },

  async loadTodayMacros() {
    const today = DB.today();
    const meals = await DB.getByIndex('meals', 'date', today);
    const settings = window._userSettings || {};
    const calTarget  = settings.calorieTarget  || 2000;
    const protTarget = settings.proteinTarget  || 130;
    const fibreTarget = settings.fibreTarget   || 30;

    const totals = meals.reduce((acc, m) => ({
      cal:   acc.cal   + (m.calories || 0),
      prot:  acc.prot  + (m.protein  || 0),
      fibre: acc.fibre + (m.fibre    || 0)
    }), { cal:0, prot:0, fibre:0 });

    this._drawRing('ring-calories', totals.cal, calTarget, '#007aff');
    this._drawRing('ring-protein',  totals.prot, protTarget, '#ff9f0a');
    this._drawRing('ring-fibre',    totals.fibre, fibreTarget, '#30d158');

    document.getElementById('ring-cal-vals').textContent  = `${totals.cal} / ${calTarget}`;
    document.getElementById('ring-prot-vals').textContent = `${totals.prot}g / ${protTarget}g`;
    document.getElementById('ring-fibre-vals').textContent= `${totals.fibre}g / ${fibreTarget}g`;

    // Also update the Calories In stat card
    const calInEl = document.getElementById('dash-cals-in');
    const calSubEl = document.getElementById('dash-cal-sub');
    if (calInEl) calInEl.textContent = totals.cal;
    if (calSubEl) calSubEl.textContent = `of ${calTarget} target`;
  },

  _drawRing(canvasId, value, max, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 50, cy = 50, r = 40, lw = 10;
    const safeMax = (max && isFinite(max) && max > 0) ? max : 1;
    const pct = Math.min(value / safeMax, 1);
    ctx.clearRect(0, 0, 100, 100);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = lw; ctx.stroke();
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.fillStyle = '#1c1c1e'; ctx.font = 'bold 13px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(pct * 100) + '%', cx, cy);
  },

  async loadWeightChart() {
    const weights = (await DB.getAll('weight')).sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
    if (weights.length < 2) return;

    const labels = weights.map(w => w.date.slice(5));
    const data   = weights.map(w => w.weight);
    const settings = window._userSettings || {};
    const target = settings.targetWeight || 73.5;

    if (this.weightChart) { this.weightChart.destroy(); this.weightChart = null; }

    const ctx = document.getElementById('weight-trend-chart');
    if (!ctx) return;

    this.weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Weight (kg)',
            data,
            borderColor: '#0ff0b3',
            backgroundColor: 'rgba(15,240,179,0.08)',
            pointBackgroundColor: '#0ff0b3',
            pointRadius: 3,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Target',
            data: labels.map(() => target),
            borderColor: 'rgba(240,165,0,0.5)',
            borderDash: [5,5],
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', maxTicksLimit: 7 } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', callback: v => v + 'kg' } }
        }
      }
    });
  },

  async loadXP() {
    const totalXP = await GAMIFICATION.getTotalXP();
    const levelInfo = GAMIFICATION.getLevelFromXP(totalXP);
    const todayXP = await GAMIFICATION.getTodayXP();

    document.getElementById('dash-level').textContent = `Lv.${levelInfo.level}`;
    document.getElementById('dash-level-name').textContent = levelInfo.name;
    document.getElementById('xp-bar-fill').style.width = `${levelInfo.progress}%`;
    document.getElementById('xp-bar-label').textContent = levelInfo.next
      ? `${totalXP} / ${levelInfo.next.minXP} XP`
      : `${totalXP} XP — Max Level!`;
    document.getElementById('dash-xp-today').textContent = todayXP > 0 ? `+${todayXP} XP today` : '';
  },

  async loadStreak() {
    const streak   = await GAMIFICATION.getCurrentStreak();
    const badges   = await GAMIFICATION.getEarnedBadges();
    const workouts = await DB.getAll('workouts');
    document.getElementById('dash-streak').textContent   = streak;
    document.getElementById('dash-badges').textContent   = badges.length;
    document.getElementById('dash-workouts').textContent = workouts.length;
  },

  async loadCoachMessage() {
    const { message, date } = await ADAPTIVE.getCoachMessage();
    if (message) {
      document.getElementById('dash-coach-card').style.display = '';
      document.getElementById('coach-message-text').textContent = message;
      document.getElementById('coach-card-date').textContent = date ? new Date(date).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '';
    }
  },

  async loadAlerts() {
    const alerts = await ADAPTIVE.getActiveAlerts();
    const container = document.getElementById('dash-alerts');
    container.innerHTML = alerts.map(a => `
      <div class="alert-card alert-card--${a.type}">
        <div class="alert-icon">${a.type === 'plateau' ? '⚠️' : a.type === 'deload' ? '😴' : a.type === 'milestone' ? '🎯' : '📉'}</div>
        <div class="alert-body"><div class="alert-msg">${a.message}</div><div class="alert-action">${a.action}</div></div>
      </div>`).join('');
  },

  async loadMotivation() {
    const cached = await DB.getSetting('daily_motivation');
    const cachedDate = await DB.getSetting('daily_motivation_date');
    const today = DB.today();

    if (cached && cachedDate === today) {
      document.getElementById('dash-motivation-text').textContent = cached;
      return;
    }

    // Try AI first
    try {
      const weights = (await DB.getAll('weight')).sort((a,b) => b.date.localeCompare(a.date)).slice(0,7);
      const streak  = await GAMIFICATION.getCurrentStreak();
      const totalXP = await GAMIFICATION.getTotalXP();
      const recentData = { streak, totalXP, recentWeights: weights.map(w => w.weight), weekday: new Date().toLocaleDateString('en-GB', { weekday:'long' }) };
      const msg = await AI.getDailyMotivation(recentData);
      await DB.setSetting('daily_motivation', msg);
      await DB.setSetting('daily_motivation_date', today);
      document.getElementById('dash-motivation-text').textContent = msg;
    } catch {
      // Rotate through 30 quotes based on day of year — always fresh each day
      const quotes = [
        "You don't have to be extreme, just consistent.",
        "One workout, one meal at a time. That's all it takes.",
        "Your body can do it. It's your mind you have to convince.",
        "Progress, not perfection. Show up today.",
        "Every rep is a vote for the person you want to become.",
        "The only bad workout is the one that didn't happen.",
        "Sore today, stronger tomorrow.",
        "Discipline is choosing what you want most over what you want now.",
        "You are one workout away from a good mood.",
        "Small steps every day. Massive results over time.",
        "Eat well, move daily, sleep deeply. Repeat.",
        "Your future self is watching you right now. Make them proud.",
        "The pain of discipline weighs ounces. The pain of regret weighs tonnes.",
        "Don't stop when you're tired — stop when you're done.",
        "It's not about being the best. It's about being better than yesterday.",
        "Motivation gets you started. Habit keeps you going.",
        "A year from now you'll wish you had started today.",
        "The body achieves what the mind believes.",
        "Sweat is just fat crying.",
        "Your health is an investment, not an expense.",
        "Champions aren't made in gyms. Champions are made from something inside.",
        "Eat for the body you want, not the body you have.",
        "The difference between try and triumph is a little 'umph'.",
        "Take care of your body. It's the only place you have to live.",
        "Success is the sum of small efforts repeated day after day.",
        "Today's workout is tomorrow's strength.",
        "The hardest part is walking through the gym door.",
        "Fall in love with taking care of yourself — body, mind and soul.",
        "Weight loss is not a physical challenge. It's a mental one.",
        "Make yourself proud. Rise and grind."
      ];
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const msg = quotes[dayOfYear % quotes.length];
      await DB.setSetting('daily_motivation', msg);
      await DB.setSetting('daily_motivation_date', today);
      document.getElementById('dash-motivation-text').textContent = msg;
    }
  },

  async loadBurnStats() {
    const today = DB.today();
    const settings = window._userSettings || {};
    const burnTarget = settings.burnTarget || 500;

    // Sum calories from activities logged today
    const activities = await DB.getByIndex('activities', 'date', today);
    const actCals = activities.reduce((sum, a) => sum + (a.calories || 0), 0);

    // Estimate calories from weight workouts (300 kcal each as a reasonable estimate)
    const workouts = await DB.getByIndex('workouts', 'date', today);
    const wktCals = workouts.reduce((sum, w) => sum + (w.estimatedCalories || 300), 0);

    const totalBurned = actCals + wktCals;
    const remaining = Math.max(0, burnTarget - totalBurned);

    document.getElementById('dash-burned').textContent = `${totalBurned} kcal`;
    document.getElementById('dash-to-burn').textContent = remaining > 0 ? `${remaining} left` : '✅ Done!';
    document.getElementById('dash-to-burn').style.color = remaining === 0 ? 'var(--green)' : '';
  }
};

window.DASHBOARD = DASHBOARD;
