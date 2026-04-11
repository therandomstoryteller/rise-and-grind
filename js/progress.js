const PROGRESS = {
  reportCard: null,

  async render() {
    const el = document.getElementById('page-progress');
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Progress</h1></div>
      <div class="progress-tabs">
        <button class="ptab active" onclick="PROGRESS.showTab('report', this)">Report Card</button>
        <button class="ptab" onclick="PROGRESS.showTab('body', this)">Body Stats</button>
        <button class="ptab" onclick="PROGRESS.showTab('nutrition', this)">Nutrition</button>
        <button class="ptab" onclick="PROGRESS.showTab('volume', this)">Volume</button>
        <button class="ptab" onclick="PROGRESS.showTab('heatmap', this)">Calendar</button>
        <button class="ptab" onclick="PROGRESS.showTab('cholesterol', this)">Cholesterol</button>
        <button class="ptab" onclick="PROGRESS.showTab('photos', this)">Photos</button>
        <button class="ptab" onclick="PROGRESS.showTab('badges', this)">Badges</button>
      </div>
      <div id="progress-tab-content"></div>`;

    await this.showTab('report', document.querySelector('.ptab'));
  },

  async showTab(tab, btn) {
    document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    const content = document.getElementById('progress-tab-content');
    content.innerHTML = '<div class="ai-loading">Loading...</div>';
    if (tab === 'report')      await this.renderReportCard(content);
    if (tab === 'body')        await this.renderBodyStats(content);
    if (tab === 'nutrition')   await this.renderNutritionTrends(content);
    if (tab === 'volume')      await this.renderWorkoutVolume(content);
    if (tab === 'heatmap')     await this.renderHeatmap(content);
    if (tab === 'cholesterol') await this.renderCholesterol(content);
    if (tab === 'photos')      await this.renderPhotos(content);
    if (tab === 'badges')      await this.renderBadges(content);
  },

  async renderReportCard(container) {
    const day = new Date().getDay();
    if (day !== 0 && !(await DB.getSetting('force_report'))) {
      const cached = await DB.getSetting('last_report_card');
      if (cached) {
        const report = JSON.parse(cached);
        container.innerHTML = this._buildReportHTML(report);
        return;
      }
      container.innerHTML = `<div class="report-placeholder"><div class="report-icon">📊</div><div>Weekly report cards are generated on Sundays.</div><button class="generate-btn" onclick="PROGRESS.generateReport()">Generate Now</button></div>`;
      return;
    }
    await this.generateReport(container);
  },

  async generateReport(container) {
    const content = container || document.getElementById('progress-tab-content');
    content.innerHTML = '<div class="ai-loading">🤖 Generating your weekly report card...</div>';
    try {
      const [weightTrend, calAnalysis, workoutAnalysis] = await Promise.all([
        ADAPTIVE.analyseWeightTrend(7),
        ADAPTIVE.analyseCalorieAdherence(7),
        ADAPTIVE.analyseWorkoutProgress(7)
      ]);
      const weekData = { weightTrend, calAnalysis, workoutAnalysis, streak: await GAMIFICATION.getCurrentStreak() };
      const report = await AI.getWeeklyReportCard(weekData);
      await DB.setSetting('last_report_card', JSON.stringify(report));
      await DB.setSetting('last_report_date', DB.today());
      content.innerHTML = this._buildReportHTML(report);
    } catch (err) { content.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  },

  _buildReportHTML(r) {
    const gradeColor = g => g?.startsWith('A') ? '#0ff0b3' : g?.startsWith('B') ? '#f0a500' : g?.startsWith('C') ? '#ff9f00' : '#ff6b6b';
    const grades = r.grades || {};
    return `
      <div class="report-card">
        <div class="report-title">Weekly Report Card</div>
        <div class="report-grades">
          ${Object.entries(grades).map(([cat, grade]) => `
            <div class="grade-item">
              <div class="grade-letter" style="color:${gradeColor(grade)}">${grade}</div>
              <div class="grade-cat">${cat.replace(/([A-Z])/g,' $1').trim()}</div>
            </div>`).join('')}
        </div>
        <div class="report-section"><b>Nutrition</b><p>${r.nutritionComment||''}</p></div>
        <div class="report-section"><b>Training</b><p>${r.trainingComment||''}</p></div>
        <div class="report-section"><b>Consistency</b><p>${r.consistencyComment||''}</p></div>
        <div class="report-section"><b>Weight Progress</b><p>${r.weightComment||''}</p></div>
        <div class="report-win">🏆 This Week's Win: ${r.topWin||''}</div>
        <div class="report-focus">🎯 Next Week Focus: ${r.focusNext||''}</div>
        ${r.calorieSuggestion ? `<div class="report-targets">Suggested targets: ${r.calorieSuggestion}kcal · ${r.proteinSuggestion}g protein</div>` : ''}
        <button class="share-btn" onclick="PROGRESS.generateShareImage()">📤 Share Summary</button>
      </div>`;
  },

  async renderHeatmap(container) {
    const workouts = await DB.getAll('workouts');
    const workoutDates = new Set(workouts.map(w => w.date));
    const today = new Date();
    const cells = [];

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      cells.push({ date: str, done: workoutDates.has(str), day: d.getDay() });
    }

    container.innerHTML = `
      <div class="heatmap-section">
        <div class="section-title">Workout Calendar (90 days)</div>
        <div class="heatmap-legend"><span class="hm-dot hm-rest"></span>Rest <span class="hm-dot hm-done"></span>Workout</div>
        <div class="heatmap-grid">
          ${cells.map(c => `<div class="hm-cell ${c.done ? 'hm-done' : 'hm-rest'}" title="${c.date}"></div>`).join('')}
        </div>
        <div class="heatmap-stats">
          <div class="hm-stat"><b>${workouts.length}</b> total sessions</div>
          <div class="hm-stat"><b>${cells.filter(c => c.done).length}</b> in last 90 days</div>
        </div>
      </div>`;
  },

  async renderCholesterol(container) {
    const logs = (await DB.getAll('cholesterol')).sort((a,b) => a.date.localeCompare(b.date));
    container.innerHTML = `
      <div class="chol-section">
        <div class="section-title">Cholesterol Tracker</div>
        <div class="chol-log-form">
          <div class="chol-form-row">
            <input type="date" id="chol-date" class="chol-input" value="${DB.today()}">
            <input type="number" id="chol-total" class="chol-input" placeholder="Total (mmol/L)" step="0.1">
            <input type="number" id="chol-ldl"   class="chol-input" placeholder="LDL (mmol/L)"   step="0.1">
            <input type="number" id="chol-hdl"   class="chol-input" placeholder="HDL (mmol/L)"   step="0.1">
            <input type="number" id="chol-trig"  class="chol-input" placeholder="Triglycerides"  step="0.1">
          </div>
          <button class="wl-save-btn" onclick="PROGRESS.logCholesterol()">Log Blood Test</button>
        </div>
        ${logs.length ? `
          <div class="chol-chart-wrap"><canvas id="chol-chart" height="200"></canvas></div>
          <div class="chol-history">
            ${logs.map(l => `<div class="chol-entry"><div class="chol-date">${l.date}</div><div class="chol-vals">Total: ${l.total||'–'} · LDL: ${l.ldl||'–'} · HDL: ${l.hdl||'–'} · Trig: ${l.triglycerides||'–'}</div></div>`).join('')}
          </div>` : '<div class="empty-state">No blood test results logged yet.<br>Log your cholesterol readings to track your heart health.</div>'}
      </div>`;

    if (logs.length) this.renderCholChart(logs);
  },

  renderCholChart(logs) {
    const ctx = document.getElementById('chol-chart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: logs.map(l => l.date.slice(5)),
        datasets: [
          { label: 'Total', data: logs.map(l => l.total), borderColor: '#0ff0b3', tension: 0.3 },
          { label: 'LDL',   data: logs.map(l => l.ldl),   borderColor: '#ff6b6b', tension: 0.3 },
          { label: 'HDL',   data: logs.map(l => l.hdl),   borderColor: '#f0a500', tension: 0.3 }
        ]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#aaa' } } }, scales: { x: { ticks: { color: '#777' } }, y: { ticks: { color: '#777' } } } }
    });
  },

  async logCholesterol() {
    const date = document.getElementById('chol-date').value;
    const total = parseFloat(document.getElementById('chol-total').value) || null;
    const ldl   = parseFloat(document.getElementById('chol-ldl').value)   || null;
    const hdl   = parseFloat(document.getElementById('chol-hdl').value)   || null;
    const trig  = parseFloat(document.getElementById('chol-trig').value)  || null;
    if (!total && !ldl) { APP.toast('Enter at least total or LDL', 'warn'); return; }
    await DB.add('cholesterol', { date, total, ldl, hdl, triglycerides: trig });
    await GAMIFICATION.checkBadges();
    APP.toast('Blood test logged ✓', 'success');
    await this.renderCholesterol(document.getElementById('progress-tab-content'));
  },

  async renderPhotos(container) {
    const photos = (await DB.getByIndex('photos', 'type', 'progress')).sort((a,b) => b.date.localeCompare(a.date));
    container.innerHTML = `
      <div class="photos-section">
        <div class="section-title">Progress Photos</div>
        <div class="photo-upload">
          <label class="photo-upload-btn" for="progress-photo-input">📸 Add Progress Photo</label>
          <input type="file" id="progress-photo-input" accept="image/*" capture="environment" style="display:none" onchange="PROGRESS.addPhoto(this)">
        </div>
        <div class="photos-grid" id="photos-grid">
          ${photos.map((p,i) => `
            <div class="photo-card">
              <img src="${p.dataUrl}" alt="Progress ${p.date}" class="progress-photo">
              <div class="photo-date">${p.date}</div>
              ${p.aiNote ? `<div class="photo-note">${p.aiNote}</div>` : ''}
              ${i < photos.length-1 ? `<button class="compare-btn" onclick="PROGRESS.comparePhotos('${p.id}', '${photos[i+1].id}')">Compare with previous</button>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  },

  async addPhoto(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      await DB.add('photos', { date: DB.today(), type: 'progress', dataUrl });
      await GAMIFICATION.awardXP(50, 'photo', 'Progress photo added');
      await GAMIFICATION.checkBadges();
      APP.toast('Progress photo saved ✓', 'success');
      await this.renderPhotos(document.getElementById('progress-tab-content'));
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
  },

  async comparePhotos(id1, id2) {
    const [p1, p2] = await Promise.all([DB.get('photos', parseInt(id1)), DB.get('photos', parseInt(id2))]);
    if (!p1 || !p2) return;
    APP.toast('AI is comparing photos...', 'info');
    try {
      const blob1 = await fetch(p1.dataUrl).then(r => r.blob());
      const blob2 = await fetch(p2.dataUrl).then(r => r.blob());
      const result = await AI.compareProgressPhotos(blob1, blob2);
      const el = document.createElement('div');
      el.className = 'compare-result-overlay';
      el.innerHTML = `<div class="compare-box"><h3>AI Photo Comparison</h3><ul>${result.changes?.map(c => `<li>${c}</li>`).join('') || ''}</ul><p>${result.overall}</p><p>💡 ${result.advice}</p><button onclick="this.closest('.compare-result-overlay').remove()">Close</button></div>`;
      document.body.appendChild(el);
    } catch (err) { APP.toast(err.message, 'error'); }
  },

  async renderBadges(container) {
    const earned  = await GAMIFICATION.getEarnedBadges();
    const earnedIds = new Set(earned.map(b => b.id));
    const allBadges = GAMIFICATION.badgeDefs;
    container.innerHTML = `
      <div class="badges-section">
        <div class="badges-summary">${earned.length} / ${allBadges.length} badges earned</div>
        <div class="badges-grid">
          ${allBadges.map(b => {
            const done = earnedIds.has(b.id);
            const earnedBadge = earned.find(e => e.id === b.id);
            return `<div class="badge-card ${done ? 'earned' : 'locked'}">
              <div class="badge-icon">${done ? b.icon : '🔒'}</div>
              <div class="badge-name">${b.name}</div>
              <div class="badge-desc">${b.desc}</div>
              ${earnedBadge ? `<div class="badge-date">${earnedBadge.earnedAt}</div>` : `<div class="badge-xp">+${b.xp} XP</div>`}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  // ── Body Stats ─────────────────────────────────────────────────────────────

  async renderBodyStats(container) {
    const settings = window._userSettings || {};
    const weights = (await DB.getAll('weight')).sort((a,b) => a.date.localeCompare(b.date));
    const latest  = weights[weights.length - 1];
    const oldest  = weights[0];
    const current = latest?.weight  || settings.currentWeight || '--';
    const target  = settings.targetWeight || 73.5;
    const startW  = settings.currentWeight || (oldest?.weight || current);
    const totalLost = (typeof current === 'number' && typeof startW === 'number')
      ? +(startW - current).toFixed(1) : '--';
    const toGo = typeof current === 'number' ? +(current - target).toFixed(1) : '--';
    const height = settings.height || 170;
    const bmi = typeof current === 'number' ? +(current / ((height/100)**2)).toFixed(1) : '--';
    const bmiCat = typeof bmi === 'number'
      ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese') : '--';

    // 30-day weight sparkline data
    const last30 = weights.filter(w => w.date >= DB.daysAgo(30));

    container.innerHTML = `
      <div class="body-stats-section">
        <div class="section-title">Body Stats</div>
        <div class="bs-kpi-grid">
          <div class="bs-kpi"><div class="bs-kpi-val">${current} <span class="bs-kpi-unit">kg</span></div><div class="bs-kpi-label">Current Weight</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${target} <span class="bs-kpi-unit">kg</span></div><div class="bs-kpi-label">Goal Weight</div></div>
          <div class="bs-kpi ${totalLost > 0 ? 'bs-kpi--good' : ''}"><div class="bs-kpi-val">${totalLost > 0 ? '-' : ''}${Math.abs(totalLost)} <span class="bs-kpi-unit">kg</span></div><div class="bs-kpi-label">Lost So Far</div></div>
          <div class="bs-kpi ${toGo > 0 ? 'bs-kpi--warn' : 'bs-kpi--good'}"><div class="bs-kpi-val">${toGo > 0 ? toGo : '🎯'} ${toGo > 0 ? '<span class="bs-kpi-unit">kg to go</span>' : ''}</div><div class="bs-kpi-label">To Goal</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${bmi}</div><div class="bs-kpi-label">BMI · ${bmiCat}</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${weights.length}</div><div class="bs-kpi-label">Weigh-ins Logged</div></div>
        </div>
        ${last30.length >= 2 ? `
          <div class="bs-chart-title">Weight — Last 30 Days</div>
          <div class="bs-chart-wrap"><canvas id="weight-chart" height="180"></canvas></div>` : ''}
        <div class="bs-log-row">
          <input type="number" id="bs-weight-input" class="chol-input" placeholder="Log today's weight (kg)" step="0.1">
          <button class="wl-save-btn" onclick="PROGRESS.logWeight()">Log</button>
        </div>
        ${weights.slice(-7).reverse().map(w => `<div class="bs-history-row"><span>${w.date}</span><span>${w.weight} kg</span></div>`).join('')}
      </div>`;

    if (last30.length >= 2) {
      const ctx = document.getElementById('weight-chart');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: last30.map(w => w.date.slice(5)),
            datasets: [{
              label: 'Weight (kg)',
              data: last30.map(w => w.weight),
              borderColor: '#007aff',
              backgroundColor: 'rgba(0,122,255,0.08)',
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: '#007aff'
            }, {
              label: 'Goal',
              data: last30.map(() => target),
              borderColor: '#34c759',
              borderDash: [6,4],
              pointRadius: 0,
              borderWidth: 1.5,
              fill: false
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#8e8e93', font: { size: 11 } } } },
            scales: {
              x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
              y: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
            }
          }
        });
      }
    }
  },

  async logWeight() {
    const val = parseFloat(document.getElementById('bs-weight-input')?.value);
    if (!val || val < 30 || val > 300) { APP.toast('Enter a valid weight', 'warn'); return; }
    await DB.add('weight', { date: DB.today(), weight: val });
    APP.toast('Weight logged ✓', 'success');
    await this.renderBodyStats(document.getElementById('progress-tab-content'));
  },

  // ── Nutrition Trends ────────────────────────────────────────────────────────

  async renderNutritionTrends(container) {
    const settings = window._userSettings || {};
    const calTarget  = settings.calorieTarget  || 2000;
    const protTarget = settings.proteinTarget  || 130;
    const fibreTarget = settings.fibreTarget   || 30;

    const meals = (await DB.getAll('meals')).filter(m => m.date >= DB.daysAgo(14));
    const byDate = {};
    for (const m of meals) {
      if (!byDate[m.date]) byDate[m.date] = { cal:0, protein:0, fibre:0, fat:0, carbs:0, count:0 };
      byDate[m.date].cal     += m.calories || 0;
      byDate[m.date].protein += m.protein  || 0;
      byDate[m.date].fibre   += m.fibre    || 0;
      byDate[m.date].fat     += m.fat      || 0;
      byDate[m.date].carbs   += m.carbs    || 0;
      byDate[m.date].count++;
    }

    const days = Object.keys(byDate).sort();
    const avgCal   = days.length ? Math.round(days.reduce((s,d) => s + byDate[d].cal, 0) / days.length) : 0;
    const avgProt  = days.length ? Math.round(days.reduce((s,d) => s + byDate[d].protein, 0) / days.length) : 0;
    const avgFibre = days.length ? Math.round(days.reduce((s,d) => s + byDate[d].fibre, 0) / days.length) : 0;
    const calAdh   = calTarget  ? Math.round((days.filter(d => byDate[d].cal <= calTarget + 100).length / Math.max(days.length,1)) * 100) : 0;
    const protAdh  = protTarget ? Math.round((days.filter(d => byDate[d].protein >= protTarget * 0.9).length / Math.max(days.length,1)) * 100) : 0;
    const fibreAdh = fibreTarget ? Math.round((days.filter(d => byDate[d].fibre >= fibreTarget * 0.85).length / Math.max(days.length,1)) * 100) : 0;

    container.innerHTML = `
      <div class="nutr-section">
        <div class="section-title">Nutrition — Last 14 Days</div>
        <div class="bs-kpi-grid">
          <div class="bs-kpi"><div class="bs-kpi-val">${avgCal}<span class="bs-kpi-unit"> kcal</span></div><div class="bs-kpi-label">Avg Daily Calories</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${avgProt}<span class="bs-kpi-unit"> g</span></div><div class="bs-kpi-label">Avg Daily Protein</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${avgFibre}<span class="bs-kpi-unit"> g</span></div><div class="bs-kpi-label">Avg Daily Fibre</div></div>
          <div class="bs-kpi ${calAdh >= 70 ? 'bs-kpi--good' : 'bs-kpi--warn'}"><div class="bs-kpi-val">${calAdh}<span class="bs-kpi-unit">%</span></div><div class="bs-kpi-label">Calorie Adherence</div></div>
          <div class="bs-kpi ${protAdh >= 70 ? 'bs-kpi--good' : 'bs-kpi--warn'}"><div class="bs-kpi-val">${protAdh}<span class="bs-kpi-unit">%</span></div><div class="bs-kpi-label">Protein Days Hit</div></div>
          <div class="bs-kpi ${fibreAdh >= 70 ? 'bs-kpi--good' : 'bs-kpi--warn'}"><div class="bs-kpi-val">${fibreAdh}<span class="bs-kpi-unit">%</span></div><div class="bs-kpi-label">Fibre Days Hit</div></div>
        </div>
        ${days.length >= 3 ? `<div class="bs-chart-title">Daily Calories vs Target</div><div class="bs-chart-wrap"><canvas id="cal-chart" height="180"></canvas></div>
          <div class="bs-chart-title" style="margin-top:20px">Daily Protein vs Target</div><div class="bs-chart-wrap"><canvas id="prot-chart" height="160"></canvas></div>` : ''}
        ${!days.length ? '<div class="empty-state">No meals logged in the last 14 days.</div>' : ''}
      </div>`;

    if (days.length >= 3) {
      const calCtx = document.getElementById('cal-chart');
      if (calCtx) new Chart(calCtx, {
        type: 'bar',
        data: {
          labels: days.map(d => d.slice(5)),
          datasets: [
            { label: 'Calories', data: days.map(d => Math.round(byDate[d].cal)), backgroundColor: 'rgba(0,122,255,0.55)', borderRadius: 6 },
            { label: 'Target', data: days.map(() => calTarget), type: 'line', borderColor: '#ff3b30', borderDash: [5,4], pointRadius: 0, fill: false, borderWidth: 1.5 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#8e8e93', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } } } }
      });
      const prCtx = document.getElementById('prot-chart');
      if (prCtx) new Chart(prCtx, {
        type: 'bar',
        data: {
          labels: days.map(d => d.slice(5)),
          datasets: [
            { label: 'Protein (g)', data: days.map(d => Math.round(byDate[d].protein)), backgroundColor: 'rgba(52,199,89,0.55)', borderRadius: 6 },
            { label: 'Target', data: days.map(() => protTarget), type: 'line', borderColor: '#ff9f0a', borderDash: [5,4], pointRadius: 0, fill: false, borderWidth: 1.5 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#8e8e93', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } } } }
      });
    }
  },

  // ── Workout Volume ──────────────────────────────────────────────────────────

  async renderWorkoutVolume(container) {
    const workouts = (await DB.getAll('workouts')).sort((a,b) => a.date.localeCompare(b.date));
    const last10   = workouts.slice(-10);
    const byType   = {};

    for (const w of workouts) {
      if (!byType[w.type]) byType[w.type] = 0;
      byType[w.type]++;
    }

    // Total tonnage per session (sum of weight × reps across all sets)
    const sessions = last10.map(w => {
      let tonnage = 0;
      for (const ex of (w.exercises || [])) {
        for (const s of (ex.sets || [])) {
          if (s.done) tonnage += (s.weight || 0) * (s.reps || 0);
        }
      }
      return { date: w.date.slice(5), type: w.type || 'Workout', tonnage: Math.round(tonnage), exercises: (w.exercises || []).length };
    });

    // Streak in last 30 days
    const last30Workouts = new Set(workouts.filter(w => w.date >= DB.daysAgo(30)).map(w => w.date));
    const thisWeek = workouts.filter(w => w.date >= DB.daysAgo(7)).length;
    const lastWeek = workouts.filter(w => w.date >= DB.daysAgo(14) && w.date < DB.daysAgo(7)).length;

    container.innerHTML = `
      <div class="vol-section">
        <div class="section-title">Workout Volume</div>
        <div class="bs-kpi-grid">
          <div class="bs-kpi"><div class="bs-kpi-val">${workouts.length}</div><div class="bs-kpi-label">Total Sessions</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${thisWeek}</div><div class="bs-kpi-label">This Week</div></div>
          <div class="bs-kpi ${thisWeek >= lastWeek ? 'bs-kpi--good' : 'bs-kpi--warn'}"><div class="bs-kpi-val">${lastWeek}</div><div class="bs-kpi-label">Last Week</div></div>
          <div class="bs-kpi"><div class="bs-kpi-val">${last30Workouts.size}</div><div class="bs-kpi-label">Days Active (30d)</div></div>
          ${Object.entries(byType).map(([t,c]) => `<div class="bs-kpi"><div class="bs-kpi-val">${c}</div><div class="bs-kpi-label">${t} sessions</div></div>`).join('')}
        </div>
        ${sessions.length >= 2 ? `
          <div class="bs-chart-title">Tonnage Lifted — Last 10 Sessions (kg moved)</div>
          <div class="bs-chart-wrap"><canvas id="vol-chart" height="180"></canvas></div>` : ''}
        <div class="vol-history">
          ${sessions.slice().reverse().map(s => `
            <div class="vol-row">
              <div class="vol-row-date">${s.date} · ${s.type}</div>
              <div class="vol-row-stats">${s.exercises} exercises · ${s.tonnage > 0 ? s.tonnage + ' kg total' : 'Cardio / Activity'}</div>
            </div>`).join('') || '<div class="empty-state">No workouts logged yet.</div>'}
        </div>
      </div>`;

    if (sessions.length >= 2) {
      const ctx = document.getElementById('vol-chart');
      if (ctx) new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sessions.map(s => s.date),
          datasets: [{
            label: 'Tonnage (kg)',
            data: sessions.map(s => s.tonnage),
            backgroundColor: sessions.map(s => s.tonnage > 0 ? 'rgba(255,159,10,0.65)' : 'rgba(142,142,147,0.4)'),
            borderRadius: 7
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#8e8e93', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } } } }
      });
    }
  },

  async generateShareImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#0ff0b3'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Rise and Grind — Weekly Summary', 400, 60);
    const weights = (await DB.getAll('weight')).sort((a,b) => b.date.localeCompare(a.date));
    ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif';
    ctx.fillText(`Current Weight: ${weights[0]?.weight || '--'} kg`, 400, 150);
    ctx.fillStyle = '#aaa'; ctx.font = '18px sans-serif';
    ctx.fillText(`Streak: ${await GAMIFICATION.getCurrentStreak()} days`, 400, 200);
    ctx.fillText(`Generated: ${DB.today()}`, 400, 560);
    const link = document.createElement('a');
    link.download = 'riseandgrind-weekly.png';
    link.href = canvas.toDataURL();
    link.click();
    APP.toast('Summary image downloaded!', 'success');
  }
};

window.PROGRESS = PROGRESS;
