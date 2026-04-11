const WORKOUT = {
  selectedType: null,
  restTimer: null,
  mediaRecorder: null,
  isRecording: false,
  chatHistory: [],

  // ── Main Render ──────────────────────────────────────────────────────────────

  async render() {
    const el = document.getElementById('page-workout');
    const suggested = await this._getNextInQueue();
    const todaysLogs = await this._getTodaysSessions();

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Workout</h1>
        <button class="ai-coach-open-btn" onclick="WORKOUT.openChat()" title="Talk to AI Coach">🤖 AI Coach</button>
      </div>

      <!-- Today's Summary (if any sessions logged today) -->
      <div id="today-sessions">${this._renderTodaySessions(todaysLogs)}</div>

      <!-- Smart Suggestion -->
      <div class="workout-suggestion" id="workout-suggestion">
        <div class="suggestion-header">
          <div>
            <div class="suggestion-label">UP NEXT</div>
            <div class="suggestion-type">${TEMPLATES.workouts[suggested.type]?.icon || '🏋️'} ${TEMPLATES.workouts[suggested.type]?.name || suggested.type}</div>
            <div class="suggestion-reason">${suggested.reason}</div>
          </div>
          <button class="suggestion-go" onclick="WORKOUT.startWorkout('${suggested.type}')">Start →</button>
        </div>
      </div>

      <!-- Workout Type Picker -->
      <div class="picker-section">
        <div class="picker-label">WEIGHTS</div>
        <div class="workout-picker" id="weights-picker">
          ${TEMPLATES.workoutQueue.map(t => {
            const w = TEMPLATES.workouts[t];
            return `<button class="picker-card${t===suggested.type?' picker-suggested':''}" onclick="WORKOUT.startWorkout('${t}')">
              <span class="picker-icon">${w.icon}</span>
              <span class="picker-name">${t.charAt(0).toUpperCase()+t.slice(1)}</span>
              ${t===suggested.type?'<span class="picker-badge">Next</span>':''}
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="picker-section">
        <div class="picker-label">ACTIVITIES</div>
        <div class="workout-picker activity-picker" id="activity-picker">
          ${Object.entries(TEMPLATES.activityTypes).map(([key, a]) =>
            `<button class="picker-card picker-card--activity" onclick="WORKOUT.startActivity('${key}')">
              <span class="picker-icon">${a.icon}</span>
              <span class="picker-name">${a.name}</span>
            </button>`
          ).join('')}
        </div>
      </div>

      <!-- Workout Content Area (populated when a workout/activity is selected) -->
      <div id="workout-ai-banner" style="display:none"></div>
      <div id="workout-content"></div>

      <!-- Rest Timer -->
      <div class="timer-overlay" id="timer-overlay" style="display:none">
        <div class="timer-box">
          <div class="timer-label">Rest Timer</div>
          <div class="timer-display" id="timer-display">90</div>
          <div class="timer-presets">
            ${[45,60,75,90,120].map(s=>`<button class="timer-preset" onclick="WORKOUT.startTimer(${s})">${s}s</button>`).join('')}
          </div>
          <button class="timer-stop" onclick="WORKOUT.stopTimer()">✓ Done Resting</button>
        </div>
      </div>

      <!-- Post-save overlay -->
      <div class="postsave-overlay" id="postsave-overlay" style="display:none">
        <div class="postsave-panel">
          <div class="postsave-top">
            <div class="postsave-header">✅ Workout Saved!</div>
            <div class="postsave-question">Want to log any additional activity?</div>
            <button class="postsave-skip" onclick="WORKOUT.closePostSave()">No, I'm done for today</button>
          </div>
          <div class="postsave-divider">Or add an activity</div>
          <div class="postsave-actions">
            ${Object.entries(TEMPLATES.activityTypes).filter(([k]) => ['tennis','treadmill','cycle','swim','rowing','hiit','walk'].includes(k))
              .map(([k,a]) => `<button class="postsave-act-btn" onclick="WORKOUT.closePostSave();WORKOUT.startActivity('${k}')">${a.icon} ${a.name}</button>`).join('')}
          </div>
        </div>
      </div>

      <!-- AI Chat Panel -->
      ${this._renderChatPanel()}`;

    await this.checkMonthlyReview();

    // Auto-resume any in-progress workout from before app was backgrounded
    const draft = this._getDraft();
    if (draft?.workoutType) {
      await this.startWorkout(draft.workoutType);
    }
  },

  // ── Smart Queue Logic ────────────────────────────────────────────────────────

  async _getNextInQueue() {
    const queue = TEMPLATES.workoutQueue;
    const allWorkouts = (await DB.getAll('workouts'))
      .filter(w => queue.includes(w.type))
      .sort((a,b) => b.date.localeCompare(a.date) || b.ts - a.ts);

    if (!allWorkouts.length) {
      return { type: queue[0], reason: 'First workout — let\'s start with Push!' };
    }

    const lastType = allWorkouts[0].type;
    const lastDate = allWorkouts[0].date;
    const lastIdx  = queue.indexOf(lastType);
    const nextIdx  = (lastIdx + 1) % queue.length;
    const nextType = queue[nextIdx];
    const daysSince = Math.round((new Date(DB.today()) - new Date(lastDate)) / 86400000);

    const reasons = [];
    if (daysSince === 0) reasons.push(`You already did ${lastType} today`);
    else if (daysSince === 1) reasons.push(`Last: ${lastType.charAt(0).toUpperCase()+lastType.slice(1)} yesterday`);
    else reasons.push(`Last: ${lastType.charAt(0).toUpperCase()+lastType.slice(1)} · ${daysSince} days ago`);

    // Check if any muscle group hasn't been hit in 7+ days
    const recentTypes = new Set(allWorkouts.filter(w => {
      const d = Math.round((new Date(DB.today()) - new Date(w.date)) / 86400000);
      return d <= 7;
    }).map(w => w.type));

    const neglected = queue.filter(t => !recentTypes.has(t));
    if (neglected.length && neglected.includes(nextType)) {
      reasons.push(`${nextType} hasn't been done this week`);
    }

    return { type: nextType, reason: reasons.join(' · ') };
  },

  async _getTodaysSessions() {
    const today = DB.today();
    const workouts   = await DB.getByIndex('workouts', 'date', today);
    const activities = await DB.getByIndex('activities', 'date', today);
    return { workouts, activities };
  },

  _renderTodaySessions(logs) {
    const all = [
      ...(logs.workouts || []).map(w => ({
        icon: TEMPLATES.workouts[w.type]?.icon || '🏋️',
        name: TEMPLATES.workouts[w.type]?.name || w.type,
        detail: `${w.exercises?.length || 0} exercises`
      })),
      ...(logs.activities || []).map(a => ({
        icon: TEMPLATES.activityTypes[a.activityType]?.icon || '🏃',
        name: a.name || TEMPLATES.activityTypes[a.activityType]?.name || a.activityType,
        detail: `${a.duration || '?'} min · ${a.caloriesSource === 'actual' ? '' : '~'}${a.calories || 0} kcal`
      }))
    ];
    if (!all.length) return '';
    return `
      <div class="today-sessions-bar">
        <div class="today-sessions-label">TODAY</div>
        <div class="today-sessions-list">
          ${all.map(s => `<div class="today-session-chip">${s.icon} ${s.name} <span class="chip-detail">· ${s.detail}</span></div>`).join('')}
        </div>
      </div>`;
  },

  // ── Draft Auto-save (survives app switching / iOS kill) ─────────────────────

  _saveDraft(workoutType) {
    const sets = {};
    document.querySelectorAll('[id^="weight-"]').forEach(el => {
      const key = el.id.replace('weight-', '');
      if (!sets[key]) sets[key] = {};
      sets[key].weight = el.value;
    });
    document.querySelectorAll('[id^="reps-"]').forEach(el => {
      const key = el.id.replace('reps-', '');
      if (!sets[key]) sets[key] = {};
      sets[key].reps = el.value;
    });
    document.querySelectorAll('[id^="done-"]').forEach(el => {
      const key = el.id.replace('done-', '');
      if (!sets[key]) sets[key] = {};
      sets[key].done = el.classList.contains('done');
    });
    // Track which exercise bodies are open
    const openCards = [];
    document.querySelectorAll('[id^="ex-body-"]').forEach(el => {
      if (el.style.display !== 'none') openCards.push(el.id.replace('ex-body-', ''));
    });
    localStorage.setItem('workout_draft', JSON.stringify({
      date: DB.today(), workoutType, sets, openCards
    }));
  },

  _restoreDraft(draft) {
    if (!draft?.sets) return;
    Object.entries(draft.sets).forEach(([key, data]) => {
      const wEl = document.getElementById(`weight-${key}`);
      const rEl = document.getElementById(`reps-${key}`);
      const dEl = document.getElementById(`done-${key}`);
      if (wEl && data.weight) wEl.value = data.weight;
      if (rEl && data.reps)   rEl.value = data.reps;
      if (dEl && data.done)   dEl.classList.add('done');
    });
    // Re-open previously open exercise cards
    (draft.openCards || []).forEach(idx => {
      const body    = document.getElementById(`ex-body-${idx}`);
      const chevron = document.querySelector(`#ex-card-${idx} .ex-chevron`);
      if (body)    body.style.display = 'block';
      if (chevron) chevron.textContent = '▲';
    });
  },

  _clearDraft() {
    localStorage.removeItem('workout_draft');
  },

  _getDraft() {
    try {
      const raw = localStorage.getItem('workout_draft');
      if (!raw) return null;
      const draft = JSON.parse(raw);
      // Only valid if it's from today
      return draft.date === DB.today() ? draft : null;
    } catch { return null; }
  },

  _attachDraftListeners(workoutType) {
    // Save draft on any input change
    document.querySelectorAll('.set-input').forEach(input => {
      input.addEventListener('input', () => this._saveDraft(workoutType));
    });
    // Also save periodically every 15s as a safety net
    if (this._draftInterval) clearInterval(this._draftInterval);
    this._draftInterval = setInterval(() => {
      if (this.selectedType) this._saveDraft(this.selectedType);
    }, 15000);
  },

  // ── Start a Weights Workout ──────────────────────────────────────────────────

  async startWorkout(workoutType) {
    this.selectedType = workoutType;
    const template   = TEMPLATES.workouts[workoutType];
    const container  = document.getElementById('workout-content');
    const today      = DB.today();
    const existing   = (await DB.getByIndex('workouts', 'date', today)).find(w => w.type === workoutType);
    const suggestions = await ADAPTIVE.getWeightSuggestions();

    // Check for an in-progress draft from before app was backgrounded
    const draft = this._getDraft();
    const hasDraft = draft && draft.workoutType === workoutType;

    // Hide the picker section, show workout content
    document.getElementById('workout-suggestion').style.display = 'none';
    document.querySelectorAll('.picker-section').forEach(s => s.style.display = 'none');

    const exercises = template.exercises;

    container.innerHTML = `
      <div class="workout-active-header">
        <button class="back-to-picker" onclick="WORKOUT._clearDraft();WORKOUT.render()">← Back</button>
        <div class="workout-type-badge">${template.icon} ${template.name}</div>
        <div class="workout-header-actions">
          <button class="voice-btn" onmousedown="WORKOUT.startVoice()" onmouseup="WORKOUT.stopVoice()" ontouchstart="WORKOUT.startVoice()" ontouchend="WORKOUT.stopVoice()">
            <span id="voice-workout-icon">🎤</span>
          </button>
          <button class="gen-workout-btn" onclick="WORKOUT.generateAdaptedWorkout('${workoutType}')">⚡ Adapt</button>
        </div>
      </div>
      ${hasDraft ? '<div class="draft-restored-banner">↩️ Your in-progress workout was restored</div>' : ''}
      <div id="exercise-list">
        ${exercises.map((ex, i) => this._buildExerciseCard(ex, i, suggestions, existing)).join('')}
      </div>
      <button class="save-workout-btn" onclick="WORKOUT.saveWorkout('${workoutType}')">💾 Save Workout</button>

      <!-- Add Activity after weights -->
      <div class="add-activity-inline">
        <div class="add-act-label">Add cardio or activity?</div>
        <div class="add-act-pills">
          ${Object.entries(TEMPLATES.activityTypes).filter(([k]) => ['treadmill','cycle','rowing','hiit','walk'].includes(k))
            .map(([k,a]) => `<button class="add-act-pill" onclick="WORKOUT.startActivity('${k}')">${a.icon} ${a.name}</button>`).join('')}
        </div>
      </div>

      <div class="pr-section" id="pr-section"></div>`;

    // Restore draft values into the DOM if we have one
    if (hasDraft) this._restoreDraft(draft);

    // Attach listeners so every keystroke saves the draft going forward
    this._attachDraftListeners(workoutType);

    await this.loadPRs();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ── Start an Activity ────────────────────────────────────────────────────────

  async startActivity(activityType) {
    this.selectedType = activityType;
    const activity  = TEMPLATES.activityTypes[activityType];
    const container = document.getElementById('workout-content');
    const today     = DB.today();
    const existing  = (await DB.getByIndex('activities', 'date', today))
      .find(a => a.activityType === activityType);

    // Hide picker
    const suggestion = document.getElementById('workout-suggestion');
    if (suggestion) suggestion.style.display = 'none';
    document.querySelectorAll('.picker-section').forEach(s => s.style.display = 'none');

    container.innerHTML = `
      <div class="workout-active-header">
        <button class="back-to-picker" onclick="WORKOUT.render()">← Back</button>
        <div class="workout-type-badge">${activity.icon} ${activity.name}</div>
      </div>

      <div class="activity-log-form">
        <div class="form-group">
          <label>Duration (minutes)</label>
          <input type="number" id="act-duration" class="settings-input" value="${existing?.duration || activity.defaultDuration}" min="1" max="300" step="1">
        </div>

        <div class="form-group">
          <label>Intensity</label>
          <div class="intensity-picker">
            ${TEMPLATES.intensityLevels.map(lvl =>
              `<button class="intensity-btn${(existing?.intensity||'moderate')===lvl.id?' active':''}" data-intensity="${lvl.id}" onclick="WORKOUT.selectIntensity('${lvl.id}')">${lvl.label}</button>`
            ).join('')}
          </div>
        </div>

        ${activityType === 'custom' ? `
        <div class="form-group">
          <label>Activity Name</label>
          <input type="text" id="act-custom-name" class="settings-input" placeholder="e.g. Football, Badminton, Boxing..." value="${existing?.name || ''}">
        </div>` : ''}

        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="act-notes" class="settings-input" rows="2" placeholder="How did it feel? Any details...">${existing?.notes || ''}</textarea>
        </div>

        <div class="activity-cal-estimate" id="act-cal-estimate">
          ${this._estimateCalories(activity, existing?.duration || activity.defaultDuration, existing?.intensity || 'moderate')}
        </div>

        <div class="form-group">
          <label>Actual calories burned <span class="label-optional">(optional — overrides estimate)</span></label>
          <input type="number" id="act-actual-cal" class="settings-input" placeholder="e.g. 420" value="${existing?.actualCalories || ''}" min="1" max="3000" step="1">
        </div>

        <button class="save-workout-btn" onclick="WORKOUT.saveActivity('${activityType}')">💾 Save Activity</button>
      </div>`;

    // Live calorie update
    document.getElementById('act-duration')?.addEventListener('input', () => this._updateCalEstimate(activityType));

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  selectIntensity(level) {
    document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.intensity-btn[data-intensity="${level}"]`)?.classList.add('active');
    const type = this.selectedType;
    if (type && TEMPLATES.activityTypes[type]) this._updateCalEstimate(type);
  },

  _updateCalEstimate(activityType) {
    const activity = TEMPLATES.activityTypes[activityType];
    const duration = parseInt(document.getElementById('act-duration')?.value) || activity.defaultDuration;
    const intensity = document.querySelector('.intensity-btn.active')?.dataset?.intensity || 'moderate';
    const el = document.getElementById('act-cal-estimate');
    if (el) el.innerHTML = this._estimateCalories(activity, duration, intensity);
  },

  _estimateCalories(activity, duration, intensity) {
    const multiplier = TEMPLATES.intensityLevels.find(l => l.id === intensity)?.multiplier || 1;
    const cal = Math.round(activity.calPerMin * duration * multiplier);
    return `<div class="cal-est-row"><span class="cal-est-icon">🔥</span> Estimated burn: <strong>${cal} kcal</strong> <span class="cal-est-note">— enter actual below if you have it</span></div>`;
  },

  async saveActivity(activityType) {
    const activity = TEMPLATES.activityTypes[activityType];
    const duration = parseInt(document.getElementById('act-duration')?.value) || activity.defaultDuration;
    const intensity = document.querySelector('.intensity-btn.active')?.dataset?.intensity || 'moderate';
    const notes = document.getElementById('act-notes')?.value?.trim() || '';
    const customName = document.getElementById('act-custom-name')?.value?.trim() || '';
    const actualCalInput = parseInt(document.getElementById('act-actual-cal')?.value) || 0;
    const multiplier = TEMPLATES.intensityLevels.find(l => l.id === intensity)?.multiplier || 1;
    const estimatedCalories = Math.round(activity.calPerMin * duration * multiplier);
    const calories = actualCalInput > 0 ? actualCalInput : estimatedCalories;
    const caloriesSource = actualCalInput > 0 ? 'actual' : 'estimated';

    const record = {
      date: DB.today(),
      activityType,
      name: customName || activity.name,
      duration,
      intensity,
      calories,
      caloriesSource,
      actualCalories: actualCalInput > 0 ? actualCalInput : null,
      estimatedCalories,
      notes
    };

    await DB.add('activities', record);
    await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logWorkout, 'activity', record.name);
    await GAMIFICATION.checkBadges();

    const calLabel = caloriesSource === 'actual' ? `${calories} kcal` : `~${calories} kcal (est.)`;
    APP.toast(`${activity.icon} ${record.name} logged — ${calLabel} burned!`, 'success');
    await this.render();
  },

  // ── Post-save Flow ───────────────────────────────────────────────────────────

  showPostSave() {
    document.getElementById('postsave-overlay').style.display = 'flex';
  },

  closePostSave() {
    document.getElementById('postsave-overlay').style.display = 'none';
  },

  // ── Exercise Cards (unchanged core) ──────────────────────────────────────────

  _buildExerciseCard(ex, i, suggestions, todayLog) {
    const suggestion = suggestions.find(s => s.exercise?.toLowerCase() === ex.name?.toLowerCase());
    const logged     = todayLog?.exercises?.find(e => e.name === ex.name);
    const sets       = ex.sets || 3;
    const reps       = ex.reps || '10-12';
    const rest       = ex.rest || 75;

    return `
    <div class="exercise-card" id="ex-card-${i}">
      <div class="ex-header" onclick="WORKOUT.toggleExercise(${i})">
        <div>
          <div class="ex-name">${ex.name}</div>
          <div class="ex-meta">${ex.muscle || ''} · ${sets} sets · ${reps} reps · ${rest}s rest</div>
        </div>
        <div class="ex-header-right">
          <button class="swap-btn" onclick="event.stopPropagation();WORKOUT.showAlternatives(${i},'${ex.name.replace(/'/g,"\\'")}','${(ex.muscle||'').replace(/'/g,"\\'")}')">⇄</button>
          <span class="ex-chevron">▼</span>
        </div>
      </div>
      <div class="ex-body" id="ex-body-${i}" style="display:none">
        ${ex.tip ? `<div class="ex-tip">💡 ${ex.tip}</div>` : ''}
        ${suggestion ? `<div class="ai-suggestion">🤖 AI suggests: <b>${suggestion.suggestedWeight}kg</b> — ${suggestion.reason}</div>` : ''}
        <div id="alt-panel-${i}" style="display:none" class="alt-panel"></div>
        <div class="sets-table">
          <div class="sets-header"><span>Set</span><span>kg</span><span>Reps</span><span>✓</span></div>
          ${Array.from({length: sets}, (_,s) => {
            const prevSet = logged?.sets?.[s];
            return `<div class="set-row" id="set-${i}-${s}">
              <span class="set-num">${s+1}</span>
              <input type="number" class="set-input" id="weight-${i}-${s}" placeholder="${suggestion?.suggestedWeight || ''}" value="${prevSet?.weight||''}" step="2.5" min="0">
              <input type="number" class="set-input" id="reps-${i}-${s}" placeholder="${String(reps).split('-')[0]}" value="${prevSet?.reps||''}" min="0" max="100">
              <button class="set-done-btn${prevSet?.done?' done':''}" onclick="WORKOUT.toggleSet(${i},${s},${sets},${rest})" id="done-${i}-${s}">✓</button>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  },

  toggleExercise(idx) {
    const body    = document.getElementById(`ex-body-${idx}`);
    const chevron = document.querySelector(`#ex-card-${idx} .ex-chevron`);
    const isOpen  = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    chevron.textContent = isOpen ? '▼' : '▲';
  },

  toggleSet(exIdx, setIdx, totalSets, restSeconds) {
    const btn  = document.getElementById(`done-${exIdx}-${setIdx}`);
    const done = btn.classList.toggle('done');
    if (done && setIdx < totalSets - 1) this.startTimer(restSeconds);
    if (done) GAMIFICATION.awardXP(5, 'set', `set ${setIdx+1}`);
    // Save draft after every set tick
    if (this.selectedType) this._saveDraft(this.selectedType);
  },

  startTimer(seconds) {
    if (this.restTimer) clearInterval(this.restTimer);
    let remaining = seconds;
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('timer-display').textContent = remaining;
    this.restTimer = setInterval(() => {
      remaining--;
      document.getElementById('timer-display').textContent = remaining;
      if (remaining <= 0) {
        clearInterval(this.restTimer);
        document.getElementById('timer-overlay').style.display = 'none';
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  },

  stopTimer() {
    if (this.restTimer) clearInterval(this.restTimer);
    document.getElementById('timer-overlay').style.display = 'none';
  },

  // ── Save Weights Workout ─────────────────────────────────────────────────────

  async saveWorkout(workoutType) {
    const template = TEMPLATES.workouts[workoutType];
    const today    = DB.today();
    const exCount  = document.querySelectorAll('[id^="ex-card-"]').length;

    const exercises = [];
    for (let i = 0; i < exCount; i++) {
      const nameEl = document.querySelector(`#ex-card-${i} .ex-name`);
      const name   = nameEl?.textContent || template.exercises[i]?.name || `Exercise ${i+1}`;
      const muscle = document.querySelector(`#ex-card-${i} .ex-meta`)?.textContent?.split('·')[0]?.trim() || '';
      const setsData = [];

      for (let s = 0; s < 10; s++) {
        const weightEl = document.getElementById(`weight-${i}-${s}`);
        const repsEl   = document.getElementById(`reps-${i}-${s}`);
        const doneEl   = document.getElementById(`done-${i}-${s}`);
        if (!weightEl) break;
        setsData.push({ weight: parseFloat(weightEl.value)||0, reps: parseInt(repsEl?.value)||0, done: doneEl?.classList.contains('done')||false });
      }

      const logged = setsData.filter(s => s.done || s.weight > 0);
      if (logged.length) exercises.push({ name, muscle, sets: logged });
    }

    if (!exercises.length) { APP.toast('Log some sets first!', 'warn'); return; }

    await DB.add('workouts', { date: today, type: workoutType, exercises, estimatedCalories: 300 });
    await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logWorkout, 'workout', workoutType);
    await this.checkAndSavePRs(exercises);
    await GAMIFICATION.checkBadges();

    // Clear draft — workout is now saved to DB
    this._clearDraft();
    if (this._draftInterval) { clearInterval(this._draftInterval); this._draftInterval = null; }

    // Show post-save prompt
    this.showPostSave();
  },

  async checkAndSavePRs(exercises) {
    const allWorkouts = await DB.getAll('workouts');
    for (const ex of exercises) {
      const maxWeight = Math.max(...ex.sets.map(s => s.weight||0));
      if (!maxWeight) continue;
      const prevBest = allWorkouts.flatMap(w => w.exercises||[]).filter(e => e.name === ex.name).flatMap(e => e.sets||[]).reduce((max,s) => Math.max(max,s.weight||0), 0);
      if (maxWeight > prevBest) {
        await GAMIFICATION.awardXP(GAMIFICATION.xpValues.newPR, 'pr', ex.name);
        APP.toast(`🏅 New PR! ${ex.name}: ${maxWeight}kg`, 'success');
      }
    }
  },

  async loadPRs() {
    const allWorkouts = await DB.getAll('workouts');
    const PRs = {};
    for (const workout of allWorkouts) {
      for (const ex of (workout.exercises||[])) {
        const best = Math.max(...(ex.sets||[]).map(s => s.weight||0));
        if (best > (PRs[ex.name]||0)) PRs[ex.name] = best;
      }
    }
    const el = document.getElementById('pr-section');
    if (!el) return;
    const entries = Object.entries(PRs).sort((a,b) => b[1]-a[1]).slice(0,6);
    el.innerHTML = entries.length ? `
      <div class="section-title" style="margin-top:16px">Personal Records 🏆</div>
      <div class="pr-grid">${entries.map(([name,w]) => `<div class="pr-card"><div class="pr-exercise">${name}</div><div class="pr-weight">${w}kg</div></div>`).join('')}</div>` : '';
  },

  // ── AI Chat ──────────────────────────────────────────────────────────────────

  _renderChatPanel() {
    return `
      <div class="chat-overlay" id="chat-overlay" style="display:none">
        <div class="chat-panel">
          <div class="chat-header">
            <div class="chat-header-left">
              <span class="chat-avatar">🤖</span>
              <div>
                <div class="chat-title">AI Workout Coach</div>
                <div class="chat-subtitle">Ask me anything about your training</div>
              </div>
            </div>
            <button class="chat-close" onclick="WORKOUT.closeChat()">✕</button>
          </div>
          <div class="chat-suggestions">
            <button class="chat-suggestion" onclick="WORKOUT.sendSuggestion(this)">Suggest alternatives to today's exercises</button>
            <button class="chat-suggestion" onclick="WORKOUT.sendSuggestion(this)">I'm stuck at a plateau — what should I change?</button>
            <button class="chat-suggestion" onclick="WORKOUT.sendSuggestion(this)">Design me a new 4-week programme</button>
            <button class="chat-suggestion" onclick="WORKOUT.sendSuggestion(this)">I only have 30 mins today, what should I do?</button>
            <button class="chat-suggestion" onclick="WORKOUT.sendSuggestion(this)">My shoulder is sore — what can I replace?</button>
            <button class="chat-suggestion" onclick="WORKOUT.sendSuggestion(this)">Review my last 4 weeks and tell me what to change</button>
          </div>
          <div class="chat-messages" id="chat-messages">
            <div class="chat-msg chat-msg--ai">
              <div class="chat-msg-content">Hey! I'm your AI workout coach. I know your full training history, your goals, and your current programme. What do you want to work on today?</div>
            </div>
          </div>
          <div class="chat-input-row">
            <textarea id="chat-input" class="chat-input" placeholder="Ask me anything about your training..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();WORKOUT.sendChat()}"></textarea>
            <button class="chat-send" onclick="WORKOUT.sendChat()">➤</button>
          </div>
        </div>
      </div>`;
  },

  openChat() {
    document.getElementById('chat-overlay').style.display = 'flex';
    document.getElementById('chat-input')?.focus();
    if (this.chatHistory.length > 0) {
      const suggestions = document.querySelector('.chat-suggestions');
      if (suggestions) suggestions.style.display = 'none';
    }
  },

  closeChat() {
    document.getElementById('chat-overlay').style.display = 'none';
  },

  async sendSuggestion(btn) {
    const text = btn.textContent;
    const suggestions = document.querySelector('.chat-suggestions');
    if (suggestions) suggestions.style.display = 'none';
    await this.sendChat(text);
  },

  async sendChat(overrideText) {
    const input = document.getElementById('chat-input');
    const text  = overrideText || input?.value?.trim();
    if (!text) return;
    if (input) input.value = '';

    this._appendChatMsg(text, 'user');
    const thinkingId = 'thinking-' + Date.now();
    this._appendChatMsg('...', 'ai', thinkingId);

    try {
      const context = await this._buildWorkoutContext();
      const response = await AI.workoutChat(text, this.chatHistory, context);

      const thinking = document.getElementById(thinkingId);
      if (thinking) thinking.querySelector('.chat-msg-content').innerHTML = this._formatChatResponse(response);

      this.chatHistory.push({ role: 'user', content: text });
      this.chatHistory.push({ role: 'assistant', content: response });

      if (response.toLowerCase().includes('day 1') || response.toLowerCase().includes('monday') ||
          response.toLowerCase().includes('programme') || response.toLowerCase().includes('week 1')) {
        this._appendApplyButton(response);
      }
    } catch (err) {
      const thinking = document.getElementById(thinkingId);
      if (thinking) thinking.querySelector('.chat-msg-content').textContent = `⚠️ ${err.message}`;
    }

    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  },

  _appendChatMsg(text, role, id) {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg--${role}`;
    if (id) div.id = id;
    div.innerHTML = `<div class="chat-msg-content">${role === 'ai' ? this._formatChatResponse(text) : text}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  _appendApplyButton(programmeText) {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'chat-apply-row';
    div.innerHTML = `
      <div class="chat-apply-note">This looks like a new programme. Want to save it?</div>
      <button class="chat-apply-btn" onclick="WORKOUT.saveProgrammeNote(this)">📋 Save Programme</button>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    div.dataset.programme = programmeText;
  },

  async saveProgrammeNote(btn) {
    const text = btn.closest('.chat-apply-row').dataset.programme;
    await DB.add('coachHistory', { date: DB.today(), type: 'programme', content: text });
    btn.textContent = '✓ Saved';
    btn.disabled = true;
    APP.toast('Programme saved to your coach history', 'success');
  },

  _formatChatResponse(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^#{1,3} (.+)$/gm, '<div class="chat-heading">$1</div>')
      .replace(/^- (.+)$/gm, '<div class="chat-bullet">• $1</div>')
      .replace(/^\d+\. (.+)$/gm, '<div class="chat-bullet">$1</div>')
      .replace(/\n{2,}/g, '<br><br>')
      .replace(/\n/g, '<br>');
  },

  async _buildWorkoutContext() {
    const queue = TEMPLATES.workoutQueue;
    const recentWorkouts = (await DB.getByDateRange('workouts', DB.daysAgo(28), DB.today()))
      .sort((a,b) => b.date.localeCompare(a.date));
    const recentActivities = (await DB.getByDateRange('activities', DB.daysAgo(28), DB.today()))
      .sort((a,b) => b.date.localeCompare(a.date));

    const performance = {};
    for (const w of recentWorkouts) {
      for (const ex of (w.exercises || [])) {
        if (!performance[ex.name]) performance[ex.name] = [];
        const maxWeight = Math.max(...(ex.sets||[]).map(s => s.weight||0));
        if (maxWeight > 0) performance[ex.name].push({ date: w.date, maxWeight, sets: ex.sets?.length || 0 });
      }
    }

    const weightTrend = await ADAPTIVE.analyseWeightTrend(14);
    const settings = window._userSettings || {};

    return {
      currentlyViewing: this.selectedType,
      allWorkoutTypes: queue,
      recentWorkoutDates: recentWorkouts.map(w => ({ date: w.date, type: w.type })).slice(0, 20),
      recentActivities: recentActivities.map(a => ({ date: a.date, type: a.activityType, name: a.name, duration: a.duration })).slice(0, 10),
      recentPerformance: performance,
      weightTrend: weightTrend.status,
      weeklyRate: weightTrend.weeklyRate,
      totalSessionsLast4Weeks: recentWorkouts.length,
      totalActivitiesLast4Weeks: recentActivities.length,
      userGoal: `Lose ${((settings.currentWeight||87) - (settings.targetWeight||73.5)).toFixed(1)}kg, current weight ${settings.currentWeight||87}kg`,
      splitType: settings.splitType || 'ppl_ul',
      weeklyTarget: settings.weeklyTarget || 5
    };
  },

  // ── Exercise Alternatives ────────────────────────────────────────────────────

  async showAlternatives(exIdx, exerciseName, muscle) {
    const panel = document.getElementById(`alt-panel-${exIdx}`);
    if (!panel) return;
    if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

    panel.style.display = 'block';
    panel.innerHTML = `<div class="ai-loading" style="padding:10px">Finding alternatives...</div>`;
    document.getElementById(`ex-body-${exIdx}`).style.display = 'block';
    document.querySelector(`#ex-card-${exIdx} .ex-chevron`).textContent = '▲';

    try {
      const result = await AI.getExerciseAlternatives(exerciseName, muscle, '');
      const alts = result.alternatives || [];
      panel.innerHTML = `
        <div class="alt-header">⇄ Alternatives for ${exerciseName}</div>
        ${alts.map(alt => `
          <div class="alt-card">
            <div class="alt-name">${alt.name}</div>
            <div class="alt-meta">${alt.sets} sets · ${alt.reps} reps · ${alt.rest}s rest</div>
            <div class="alt-why">${alt.why}</div>
            <div class="alt-tip">💡 ${alt.tip}</div>
            <button class="alt-use-btn" onclick="WORKOUT.swapExercise(${exIdx}, ${JSON.stringify(alt).replace(/"/g,'&quot;')})">Use This Instead</button>
          </div>`).join('')}
        <button class="alt-close-btn" onclick="document.getElementById('alt-panel-${exIdx}').style.display='none'">✕ Keep Original</button>`;
    } catch (err) {
      panel.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`;
    }
  },

  swapExercise(exIdx, newExercise) {
    const card = document.getElementById(`ex-card-${exIdx}`);
    if (!card) return;
    card.querySelector('.ex-name').textContent = newExercise.name;
    card.querySelector('.ex-meta').textContent = `${newExercise.muscle} · ${newExercise.sets} sets · ${newExercise.reps} reps · ${newExercise.rest}s rest`;
    const tip = card.querySelector('.ex-tip');
    if (tip) tip.textContent = `💡 ${newExercise.tip}`;
    const setsTable = card.querySelector('.sets-table');
    if (setsTable && newExercise.sets) {
      setsTable.innerHTML = `
        <div class="sets-header"><span>Set</span><span>kg</span><span>Reps</span><span>✓</span></div>
        ${Array.from({length: newExercise.sets}, (_,s) => `
          <div class="set-row" id="set-${exIdx}-${s}">
            <span class="set-num">${s+1}</span>
            <input type="number" class="set-input" id="weight-${exIdx}-${s}" placeholder="" step="2.5" min="0">
            <input type="number" class="set-input" id="reps-${exIdx}-${s}" placeholder="${newExercise.reps?.split('-')[0]||10}" min="0" max="100">
            <button class="set-done-btn" onclick="WORKOUT.toggleSet(${exIdx},${s},${newExercise.sets},${newExercise.rest})" id="done-${exIdx}-${s}">✓</button>
          </div>`).join('')}`;
    }
    document.getElementById(`alt-panel-${exIdx}`).style.display = 'none';
    APP.toast(`Swapped to ${newExercise.name}`, 'success');
  },

  // ── AI-Adapted Workout ───────────────────────────────────────────────────────

  async generateAdaptedWorkout(workoutType) {
    const banner = document.getElementById('workout-ai-banner');
    banner.style.display = 'block';
    banner.innerHTML = `<div class="ai-loading">⚡ AI is adapting today's workout based on your recent performance...</div>`;

    try {
      const context = await this._buildWorkoutContext();
      const pref = await this._getAdaptationPreference();
      const result = await AI.generateAdaptedWorkout(workoutType, context.recentPerformance, pref);

      banner.innerHTML = `
        <div class="ai-workout-result">
          <div class="ai-workout-header">⚡ AI-Adapted Workout</div>
          <div class="ai-workout-body">${this._formatChatResponse(result)}</div>
          <div class="ai-workout-actions">
            <button class="ai-workout-save" onclick="WORKOUT.saveAIWorkoutNote('${workoutType}')">📋 Save This Plan</button>
            <button class="ai-workout-close" onclick="document.getElementById('workout-ai-banner').style.display='none'">✕ Use Template Instead</button>
          </div>
        </div>`;
    } catch (err) {
      banner.innerHTML = `<div class="ai-error">❌ ${err.message} <button onclick="document.getElementById('workout-ai-banner').style.display='none'" style="margin-left:8px;cursor:pointer">✕</button></div>`;
    }
  },

  async _getAdaptationPreference() {
    const trend = await ADAPTIVE.analyseWeightTrend(14);
    const prefs = [];
    if (trend.status === 'plateau') prefs.push('weight loss has stalled, consider adding metabolic finisher');
    if (trend.status === 'losing_too_fast') prefs.push('losing weight too fast, prioritise muscle retention, reduce cardio');
    const weeksTraining = parseInt(await DB.getSetting('weeks_training') || '0');
    if (weeksTraining >= 7) prefs.push('consider deload elements');
    return prefs.join('; ') || 'standard progressive overload approach';
  },

  async saveAIWorkoutNote(workoutType) {
    const content = document.querySelector('.ai-workout-body')?.textContent || '';
    await DB.add('coachHistory', { date: DB.today(), type: 'ai_workout', workoutType, content });
    APP.toast('AI workout saved to history', 'success');
  },

  // ── Monthly Programme Review ─────────────────────────────────────────────────

  async checkMonthlyReview() {
    const lastReview = await DB.getSetting('last_programme_review');
    const today = DB.today();
    if (lastReview) {
      const daysSince = Math.round((new Date(today) - new Date(lastReview)) / 86400000);
      if (daysSince < 28) return;
    }
    const allWorkouts = await DB.getAll('workouts');
    if (allWorkouts.length < 12) return;

    const banner = document.getElementById('workout-ai-banner');
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="review-prompt">
        <div class="review-prompt-icon">📋</div>
        <div class="review-prompt-text">It's been 4 weeks — time for an AI programme review based on your training data.</div>
        <div class="review-prompt-actions">
          <button class="review-go-btn" onclick="WORKOUT.runMonthlyReview()">Run Review</button>
          <button class="review-skip-btn" onclick="document.getElementById('workout-ai-banner').style.display='none'">Later</button>
        </div>
      </div>`;
  },

  async runMonthlyReview() {
    const banner = document.getElementById('workout-ai-banner');
    banner.innerHTML = `<div class="ai-loading">🤖 Analysing your last 4 weeks of training...</div>`;

    try {
      const from = DB.daysAgo(28);
      const workouts = await DB.getByDateRange('workouts', from, DB.today());
      const analysis = await ADAPTIVE.analyseWorkoutProgress(28);
      const result = await AI.getMonthlyProgrammeReview(workouts, analysis);

      await DB.setSetting('last_programme_review', DB.today());
      await DB.add('coachHistory', { date: DB.today(), type: 'monthly_review', content: JSON.stringify(result) });

      banner.innerHTML = `
        <div class="monthly-review">
          <div class="review-title">📋 4-Week Programme Review</div>
          <div class="review-assessment">${result.overallAssessment || ''}</div>
          ${result.whatIsWorking?.length ? `<div class="review-section"><div class="review-label">✅ What's Working</div>${result.whatIsWorking.map(w=>`<div class="review-bullet">• ${w}</div>`).join('')}</div>` : ''}
          ${result.whatToChange?.length ? `<div class="review-section"><div class="review-label">🔄 What To Change</div>${result.whatToChange.map(c=>`<div class="review-change"><div class="change-name">${c.change}</div><div class="change-reason">${c.reason}</div><div class="change-impl">How: ${c.implementation}</div></div>`).join('')}</div>` : ''}
          ${result.deloadNeeded ? `<div class="deload-alert">😴 Deload recommended: ${result.deloadReason}</div>` : ''}
          <div class="review-next"><b>Next phase:</b> ${result.nextPhase || ''}</div>
          <button class="review-close-btn" onclick="document.getElementById('workout-ai-banner').style.display='none'">Got It ✓</button>
        </div>`;
    } catch (err) {
      banner.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`;
    }
  },

  // ── Voice Logging ────────────────────────────────────────────────────────────

  async startVoice() {
    if (this.isRecording) return;
    this.isRecording = true;
    document.getElementById('voice-workout-icon').textContent = '🔴';
    APP.toast('Listening... say exercise, weight, sets and reps', 'info');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) { this.isRecording = false; return; }
    const chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = e => chunks.push(e.data);
    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      stream.getTracks().forEach(t => t.stop());
      document.getElementById('voice-workout-icon').textContent = '⏳';
      try {
        const transcript = await AI.transcribeVoice(blob);
        const parsed     = await AI.parseVoiceWorkout(transcript);
        if (parsed.exercises?.length) {
          this._fillFromVoice(parsed.exercises);
          await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logVoice, 'voice', transcript);
          APP.toast(`Logged: ${parsed.exercises.map(e=>e.name).join(', ')}`, 'success');
        }
      } catch (err) { APP.toast(err.message, 'error'); }
      document.getElementById('voice-workout-icon').textContent = '🎤';
      this.isRecording = false;
    };
    this.mediaRecorder.start();
  },

  stopVoice() { if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop(); },

  _fillFromVoice(exercises) {
    if (!this.selectedType) return;
    const template = TEMPLATES.workouts[this.selectedType];
    if (!template) return;
    for (const voiceEx of exercises) {
      const idx = template.exercises.findIndex(e => e.name.toLowerCase().includes(voiceEx.name.toLowerCase().split(' ')[0]));
      if (idx >= 0) {
        const w = document.getElementById(`weight-${idx}-0`);
        const r = document.getElementById(`reps-${idx}-0`);
        if (w && voiceEx.weight) w.value = voiceEx.weight;
        if (r && voiceEx.reps)   r.value = voiceEx.reps;
        document.getElementById(`ex-body-${idx}`).style.display = 'block';
      }
    }
  }
};

window.WORKOUT = WORKOUT;
