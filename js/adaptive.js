const ADAPTIVE = {

  async shouldRun() {
    const last = await DB.getSetting('adaptive_last_run');
    const now = Date.now();
    if (!last) return true;
    const hoursSince = (now - parseInt(last)) / 3600000;
    const hour = new Date().getHours();
    // Run nightly (after 8pm) or morning (before 10am) if not run in last 12h
    return hoursSince >= 12 && (hour >= 20 || hour <= 10);
  },

  async run(force = false) {
    if (!force && !(await this.shouldRun())) return null;
    try {
      const analysis = await this._analyse();
      const aiResponse = await this._callAI(analysis);
      await this._applyAdaptations(aiResponse, analysis);
      await DB.setSetting('adaptive_last_run', Date.now().toString());
      await DB.add('coachHistory', { date: DB.today(), type: 'adaptive', analysis, response: aiResponse });
      return aiResponse;
    } catch (err) {
      console.warn('Adaptive engine error:', err.message);
      return null;
    }
  },

  // ── Analysis ────────────────────────────────────────────────────────────────

  async _analyse() {
    const [weightTrend, calorieAnalysis, workoutAnalysis, checklistAnalysis, tdee] = await Promise.all([
      this.analyseWeightTrend(30),
      this.analyseCalorieAdherence(14),
      this.analyseWorkoutProgress(28),
      this.analyseChecklistAdherence(14),
      this.recalculateTDEE()
    ]);
    return { weightTrend, calorieAnalysis, workoutAnalysis, checklistAnalysis, tdee, analysedAt: new Date().toISOString() };
  },

  async analyseWeightTrend(days) {
    const from = DB.daysAgo(days);
    const today = DB.today();
    const weights = await DB.getByDateRange('weight', from, today);
    if (weights.length < 2) return { status: 'insufficient_data', entries: weights.length };

    const sorted = weights.sort((a,b) => a.date.localeCompare(b.date));
    const values  = sorted.map(w => w.weight);

    const avg7  = this._movingAvg(values, 7);
    const avg14 = this._movingAvg(values, 14);
    const weeklyRate = (values[values.length-1] - values[Math.max(0, values.length-8)]) / Math.min(values.length-1, 7) * 7;

    const settings = window._userSettings || {};
    const target = settings.targetWeight || 73.5;
    const latest = values[values.length-1];
    const oldest = values[0];
    const totalLost = oldest - latest;
    const kgToTarget = latest - target;

    let status = 'on_track';
    if (Math.abs(weeklyRate) < 0.1 && days >= 14) status = 'plateau';
    else if (weeklyRate < -1.2) status = 'losing_too_fast';
    else if (weeklyRate < -0.3) status = 'on_track';
    else status = 'losing_slowly';

    return { status, latest, oldest, totalLost: +totalLost.toFixed(1), weeklyRate: +weeklyRate.toFixed(2), avg7: avg7[avg7.length-1], avg14: avg14[avg14.length-1], kgToTarget: +kgToTarget.toFixed(1), entries: weights.length };
  },

  async analyseCalorieAdherence(days) {
    const from = DB.daysAgo(days);
    const meals = await DB.getByDateRange('meals', from, DB.today());
    const settings = window._userSettings || {};
    const target = settings.calorieTarget || 2000;
    const proteinTarget = settings.proteinTarget || 130;

    const byDate = {};
    for (const m of meals) {
      if (!byDate[m.date]) byDate[m.date] = { cal:0, protein:0, carbs:0, fat:0, fibre:0 };
      byDate[m.date].cal     += m.calories || 0;
      byDate[m.date].protein += m.protein  || 0;
      byDate[m.date].carbs   += m.carbs    || 0;
      byDate[m.date].fat     += m.fat      || 0;
      byDate[m.date].fibre   += m.fibre    || 0;
    }

    const dayEntries = Object.values(byDate);
    if (!dayEntries.length) return { status: 'no_data' };

    const avgCal  = dayEntries.reduce((s,d) => s + d.cal, 0) / dayEntries.length;
    const avgProt = dayEntries.reduce((s,d) => s + d.protein, 0) / dayEntries.length;
    const daysHitProtein = dayEntries.filter(d => d.protein >= proteinTarget * 0.9).length;
    const daysOverCal    = dayEntries.filter(d => d.cal > target + 200).length;

    return {
      avgCalories: Math.round(avgCal),
      avgProtein: Math.round(avgProt),
      calorieTarget: target,
      proteinTarget,
      daysHitProtein,
      daysOverCalorie: daysOverCal,
      daysLogged: dayEntries.length,
      proteinAdherence: Math.round((daysHitProtein / dayEntries.length) * 100),
      caloricBalance: Math.round(avgCal - target)
    };
  },

  async analyseWorkoutProgress(days) {
    const from = DB.daysAgo(days);
    const workouts = await DB.getByDateRange('workouts', from, DB.today());

    const expectedDays = Math.floor(days * (5/7));
    const completed = workouts.length;
    const completionRate = Math.round((completed / Math.max(expectedDays, 1)) * 100);

    // Find stagnating exercises (same weight for 3+ sessions)
    const byExercise = {};
    for (const w of workouts) {
      for (const ex of (w.exercises || [])) {
        if (!byExercise[ex.name]) byExercise[ex.name] = [];
        byExercise[ex.name].push({ weight: ex.weight || 0, date: w.date });
      }
    }

    const stagnating = [];
    const progressing = [];
    for (const [name, sessions] of Object.entries(byExercise)) {
      if (sessions.length < 3) continue;
      const recent = sessions.slice(-3).map(s => s.weight);
      const isStagnant = recent.every(w => w === recent[0]);
      if (isStagnant) stagnating.push(name);
      else progressing.push(name);
    }

    // Deload check
    const allWorkouts = await DB.getAll('workouts');
    const weeksSinceDeload = await DB.getSetting('last_deload');
    const weeksTraining = weeksSinceDeload
      ? Math.round((Date.now() - parseInt(weeksSinceDeload)) / (7 * 86400000))
      : Math.min(Math.floor(allWorkouts.length / 5), 12);

    return {
      completed, expectedDays, completionRate,
      stagnatingExercises: stagnating,
      progressingExercises: progressing,
      weeksTraining,
      needsDeload: weeksTraining >= 7
    };
  },

  async analyseChecklistAdherence(days) {
    const from = DB.daysAgo(days);
    const logs = await DB.getByDateRange('checklist', from, DB.today());
    const byDate = {};
    for (const l of logs) {
      if (!byDate[l.date]) byDate[l.date] = [];
      byDate[l.date].push(l.itemId);
    }
    const allItems = TEMPLATES.checklist.map(c => c.id);
    const weakItems = {};
    allItems.forEach(id => { weakItems[id] = 0; });
    const totalDays = Object.keys(byDate).length || 1;
    for (const items of Object.values(byDate)) items.forEach(id => { if (weakItems[id] !== undefined) weakItems[id]++; });
    const sorted = Object.entries(weakItems).sort((a,b) => a[1]-b[1]);
    return {
      totalDays,
      weakestItems: sorted.slice(0,3).map(([id,count]) => ({ id, label: allItems.find(i=>i===id), completionRate: Math.round((count/totalDays)*100) })),
      avgScore: Math.round(Object.values(weakItems).reduce((s,v)=>s+v,0) / (allItems.length * totalDays) * 100)
    };
  },

  async recalculateTDEE() {
    const settings = window._userSettings || {};
    const weights = await DB.getAll('weight');
    const currentWeight = weights.length
      ? weights.sort((a,b) => b.date.localeCompare(a.date))[0].weight
      : (settings.currentWeight || 87);

    const height = settings.height || 168;
    const age = settings.age || 36;
    const bmr = 10 * currentWeight + 6.25 * height - 5 * age + 5;
    const multiplier = 1.55; // moderately active
    const tdee = Math.round(bmr * multiplier);
    const recommended = Math.round(tdee - 500);

    return { currentWeight, bmr: Math.round(bmr), tdee, recommendedCalories: recommended };
  },

  // ── AI Call ─────────────────────────────────────────────────────────────────

  async _callAI(analysis) {
    const systemPrompt = `You are an evidence-based fitness and nutrition coach. User profile: male, 36, 5'6", starting weight 87kg, target 72-75kg, mostly vegetarian, UK-based, high cholesterol, gym access + tennis. Current weekly plan: Push Mon, Pull Tue, Legs Wed, Tennis Thu, Upper Fri, Lower Sat, Rest Sun. Daily targets: 2000kcal, 130g protein.

Based on the analysis data provided, generate specific, actionable adaptations. Be direct and precise — not generic. Return JSON with this exact structure:
{
  "calorieSuggestion": 2000,
  "proteinSuggestion": 130,
  "workoutAdjustments": [{ "exercise": "name", "currentWeight": 60, "suggestedWeight": 62.5, "reason": "brief" }],
  "dietAdjustments": ["specific diet change"],
  "coachMessage": "2-3 sentence personalised message",
  "alerts": [{ "type": "plateau|rapid_loss|deload|milestone", "message": "alert text", "action": "what to do" }],
  "weeklyFocus": "single most important focus this week",
  "mealSuggestionBias": "high-protein|high-fibre|balanced|cholesterol-focus"
}`;

    return AI._groq(systemPrompt, JSON.stringify(analysis));
  },

  // ── Apply Adaptations ───────────────────────────────────────────────────────

  async _applyAdaptations(response, analysis) {
    if (!response) return;

    // Update calorie/protein targets if changed
    if (response.calorieSuggestion && Math.abs(response.calorieSuggestion - (window._userSettings?.calorieTarget || 2000)) > 50) {
      await DB.setSetting('calorie_target_override', response.calorieSuggestion);
    }

    // Store workout weight suggestions
    if (response.workoutAdjustments?.length) {
      await DB.setSetting('weight_suggestions', JSON.stringify(response.workoutAdjustments));
    }

    // Store meal bias
    if (response.mealSuggestionBias) {
      await DB.setSetting('meal_bias', response.mealSuggestionBias);
    }

    // Store coach message for dashboard
    if (response.coachMessage) {
      await DB.setSetting('coach_message', response.coachMessage);
      await DB.setSetting('coach_message_date', DB.today());
    }

    // Store alerts
    if (response.alerts?.length) {
      await DB.setSetting('active_alerts', JSON.stringify(response.alerts));
    }
  },

  // ── Utilities ───────────────────────────────────────────────────────────────

  _movingAvg(arr, window) {
    return arr.map((_, i) => {
      const slice = arr.slice(Math.max(0, i - window + 1), i + 1);
      return +(slice.reduce((s,v) => s+v, 0) / slice.length).toFixed(1);
    });
  },

  async getActiveAlerts() {
    const stored = await DB.getSetting('active_alerts');
    return stored ? JSON.parse(stored) : [];
  },

  async getCoachMessage() {
    const msg = await DB.getSetting('coach_message');
    const date = await DB.getSetting('coach_message_date');
    return { message: msg, date };
  },

  async getWeightSuggestions() {
    const stored = await DB.getSetting('weight_suggestions');
    return stored ? JSON.parse(stored) : [];
  },

  async getSuggestionForExercise(exerciseName) {
    const suggestions = await this.getWeightSuggestions();
    return suggestions.find(s => s.exercise.toLowerCase() === exerciseName.toLowerCase()) || null;
  }
};

window.ADAPTIVE = ADAPTIVE;
