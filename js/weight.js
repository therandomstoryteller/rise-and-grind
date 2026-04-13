const WEIGHT = {
  chart: null,

  async render() {
    const el = document.getElementById('page-weight');
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Weight & Body</h1></div>
      <div class="weight-log-section">
        <div class="weight-log-card">
          <div class="wl-label">Today's Weight</div>
          <div class="wl-input-row">
            <input type="number" id="weight-input" class="weight-big-input" placeholder="82.5" step="0.1" min="40" max="200">
            <span class="wl-unit">kg</span>
          </div>
          <button class="wl-save-btn" onclick="WEIGHT.logWeight()">Log Weight</button>
        </div>
        <div id="weight-stats-row" class="weight-stats-row"></div>
      </div>
      <div class="section-card"><div class="section-title">30-Day Trend</div><div class="chart-container"><canvas id="weight-chart"></canvas></div></div>
      <div class="milestones-section" id="milestones-section"></div>
      <div class="section-card">
        <div class="section-title">Body Measurements</div>
        <div class="measurements-grid">
          <div class="meas-item"><label>Waist (cm)</label><input type="number" id="meas-waist" class="meas-input" step="0.5"></div>
          <div class="meas-item"><label>Chest (cm)</label><input type="number" id="meas-chest" class="meas-input" step="0.5"></div>
          <div class="meas-item"><label>Hip (cm)</label><input type="number" id="meas-hip" class="meas-input" step="0.5"></div>
          <div class="meas-item"><label>Arm (cm)</label><input type="number" id="meas-arm" class="meas-input" step="0.5"></div>
        </div>
        <button class="wl-save-btn" onclick="WEIGHT.saveMeasurements()" style="margin-top:12px">Save Measurements</button>
      </div>
      <div class="section-card" id="body-comp-card">
        <div class="section-title">Body Composition Estimate</div>
        <button class="estimate-btn" onclick="WEIGHT.getBodyComp()">🤖 AI Estimate</button>
        <div id="body-comp-result"></div>
      </div>`;

    await this.loadData();
  },

  showLogModal() {
    document.getElementById('weight-input')?.focus();
  },

  async logWeight() {
    const val = parseFloat(document.getElementById('weight-input').value);
    if (!val || val < 30 || val > 300) { APP.toast('Enter a valid weight', 'warn'); return; }

    const today = DB.today();
    const existing = await DB.getByIndex('weight', 'date', today);
    if (existing.length) {
      await DB.put('weight', { ...existing[0], weight: val, date: today });
    } else {
      await DB.add('weight', { weight: val, date: today });
    }

    if (window._userSettings) window._userSettings.currentWeight = val;

    await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logWeight, 'weight', `${val}kg logged`);
    await GAMIFICATION.checkBadges();

    document.getElementById('weight-input').value = '';
    APP.toast(`${val} kg logged ✓`, 'success');
    await this.loadData();
    this._checkMilestones(val);
  },

  async loadData() {
    const weights = (await DB.getAll('weight')).sort((a,b) => a.date.localeCompare(b.date));
    if (!weights.length) return;

    const settings = window._userSettings || {};
    const start  = settings.startWeight  || 87;
    const target = settings.targetWeight || 73.5;
    const latest = weights[weights.length - 1].weight;
    const lost   = +(start - latest).toFixed(1);
    const toTarget = +(latest - target).toFixed(1);

    const statsRow = document.getElementById('weight-stats-row');
    statsRow.innerHTML = `
      <div class="wstat"><div class="wstat-val">${latest}kg</div><div class="wstat-label">Current</div></div>
      <div class="wstat"><div class="wstat-val" style="color:var(--accent)">${lost > 0 ? '-' : '+'}${Math.abs(lost)}kg</div><div class="wstat-label">Lost</div></div>
      <div class="wstat"><div class="wstat-val">${toTarget > 0 ? toTarget + 'kg' : '🎯 Done!'}</div><div class="wstat-label">To Target</div></div>
      <div class="wstat"><div class="wstat-val">${target}kg</div><div class="wstat-label">Goal</div></div>`;

    await this.renderChart(weights, target);
    this.renderMilestones(start, latest, target);
    this.loadLastMeasurements();
  },

  async renderChart(weights, target) {
    const last30 = weights.slice(-30);
    const labels = last30.map(w => w.date.slice(5));
    const data   = last30.map(w => w.weight);

    // 7-day moving average
    const movAvg = data.map((_, i) => {
      const slice = data.slice(Math.max(0, i-6), i+1);
      return +(slice.reduce((s,v) => s+v, 0) / slice.length).toFixed(1);
    });

    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const ctx = document.getElementById('weight-chart');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Daily', data, borderColor: 'rgba(15,240,179,0.4)', backgroundColor: 'transparent', pointRadius: 3, pointBackgroundColor: '#0ff0b3', tension: 0.2 },
          { label: '7-day avg', data: movAvg, borderColor: '#0ff0b3', backgroundColor: 'rgba(15,240,179,0.06)', pointRadius: 0, tension: 0.4, fill: true, borderWidth: 2 },
          { label: 'Target', data: labels.map(() => target), borderColor: 'rgba(240,165,0,0.6)', borderDash: [6,4], pointRadius: 0, borderWidth: 1.5 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#777', maxTicksLimit: 8 } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#777', callback: v => v + 'kg' } }
        }
      }
    });
  },

  renderMilestones(start, current, target) {
    const lost = start - current;
    const milestones = [
      { label: '-5kg', target: 5,  emoji: '⬇️' },
      { label: '-10kg', target: 10, emoji: '🎯' },
      { label: '-15kg', target: 15, emoji: '🔥' },
      { label: 'Goal!', target: start - target, emoji: '🏆' }
    ];
    const el = document.getElementById('milestones-section');
    el.innerHTML = `<div class="section-title">Milestones</div><div class="milestones-row">${
      milestones.map(m => {
        const done = lost >= m.target;
        const pct  = Math.min(lost / m.target * 100, 100);
        return `<div class="milestone-card ${done ? 'done' : ''}">
          <div class="milestone-emoji">${done ? m.emoji : '🔒'}</div>
          <div class="milestone-label">${m.label}</div>
          <div class="milestone-bar-bg"><div class="milestone-bar-fill" style="width:${pct}%"></div></div>
          <div class="milestone-pct">${Math.round(pct)}%</div>
        </div>`;
      }).join('')
    }</div>`;
  },

  _checkMilestones(currentWeight) {
    const settings = window._userSettings || {};
    const start = settings.startWeight || 87;
    const lost = +(start - currentWeight).toFixed(1);
    const shown = JSON.parse(sessionStorage.getItem('milestones_shown') || '[]');
    const celebrate = (key, msg, emoji) => {
      if (!shown.includes(key)) {
        this._celebrate(msg, emoji);
        shown.push(key);
        sessionStorage.setItem('milestones_shown', JSON.stringify(shown));
      }
    };
    if (lost >= 5)  celebrate('5kg',    '-5kg Lost! Keep going!',   '⬇️');
    if (lost >= 10) celebrate('10kg',   '-10kg! Halfway there!',    '🔥');
    if (currentWeight <= (settings.targetWeight || 73.5)) celebrate('target', 'TARGET REACHED! 🏆', '🏆');
  },

  _celebrate(msg, emoji) {
    const el = document.createElement('div');
    el.className = 'milestone-popup';
    el.innerHTML = `<div class="milestone-popup-inner"><div style="font-size:48px">${emoji}</div><div class="milestone-popup-msg">${msg}</div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 10);
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 500); }, 4000);
  },

  async saveMeasurements() {
    const waist = parseFloat(document.getElementById('meas-waist').value) || null;
    const chest = parseFloat(document.getElementById('meas-chest').value) || null;
    const hip   = parseFloat(document.getElementById('meas-hip').value)   || null;
    const arm   = parseFloat(document.getElementById('meas-arm').value)   || null;
    if (!waist && !chest && !hip && !arm) { APP.toast('Enter at least one measurement', 'warn'); return; }
    await DB.add('measurements', { date: DB.today(), waist, chest, hip, arm });
    APP.toast('Measurements saved ✓', 'success');
  },

  async loadLastMeasurements() {
    const all = (await DB.getAll('measurements')).sort((a,b) => b.date.localeCompare(a.date));
    if (!all.length) return;
    const last = all[0];
    if (last.waist) document.getElementById('meas-waist').placeholder = `${last.waist} (last)`;
    if (last.chest) document.getElementById('meas-chest').placeholder = `${last.chest} (last)`;
    if (last.hip)   document.getElementById('meas-hip').placeholder   = `${last.hip} (last)`;
    if (last.arm)   document.getElementById('meas-arm').placeholder   = `${last.arm} (last)`;
  },

  async getBodyComp() {
    const el = document.getElementById('body-comp-result');
    el.innerHTML = '<div class="ai-loading">🤖 Estimating body composition...</div>';
    try {
      const settings  = window._userSettings || {};
      const weights   = (await DB.getAll('weight')).sort((a,b) => b.date.localeCompare(a.date));
      const measurements = (await DB.getAll('measurements')).sort((a,b) => b.date.localeCompare(a.date));
      const workouts  = await DB.getAll('workouts');
      const data = {
        currentWeight: weights[0]?.weight || settings.currentWeight || 87,
        startWeight: settings.startWeight || 87,
        height: settings.height || 168,
        age: settings.age || 36,
        latestWaist: measurements[0]?.waist || null,
        workoutCount: workouts.length
      };
      const result = await AI.getBodyCompEstimate(data);
      el.innerHTML = `
        <div class="comp-grid">
          <div class="comp-stat"><div class="comp-val">${result.estimatedBodyFat}%</div><div class="comp-label">Est. Body Fat</div></div>
          <div class="comp-stat"><div class="comp-val">${result.estimatedLeanMass}kg</div><div class="comp-label">Lean Mass</div></div>
          <div class="comp-stat"><div class="comp-val">${result.bmi}</div><div class="comp-label">BMI</div></div>
        </div>
        <div class="comp-insight">${result.insight}</div>
        <div class="comp-note">Note: These are estimates based on available data, not medical measurements.</div>`;
    } catch (err) { el.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  }
};

window.WEIGHT = WEIGHT;
