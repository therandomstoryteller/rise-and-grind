const DIET = {
  mediaRecorder: null,
  isRecording: false,
  _pendingResults: {}, // stores AI results by key to avoid JSON-in-onclick issues

  async render() {
    const el = document.getElementById('page-diet');
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Diet</h1><div class="header-date" id="diet-date"></div></div>
      <div class="macro-summary-bar" id="diet-macro-bar"></div>
      <div class="log-actions">
        <label class="log-btn log-btn--camera" for="food-camera-input">📷 Snap Food</label>
        <input type="file" id="food-camera-input" accept="image/*" capture="environment" style="display:none" onchange="DIET.handlePhoto(this)">
        <label class="log-btn log-btn--menu" for="menu-camera-input">🍽️ Scan Menu</label>
        <input type="file" id="menu-camera-input" accept="image/*" capture="environment" style="display:none" onchange="DIET.handleMenuPhoto(this)">
        <button class="log-btn log-btn--voice" onmousedown="DIET.startVoice()" onmouseup="DIET.stopVoice()" ontouchstart="DIET.startVoice()" ontouchend="DIET.stopVoice()"><span id="voice-diet-icon">🎤</span> Hold</button>
        <button class="log-btn log-btn--suggest" onclick="DIET.getMealSuggestions()">🤔 Suggest</button>
      </div>
      <div class="text-log-row">
        <input type="text" id="food-text-input" class="food-text-input" placeholder="Type food... e.g. dal rice salad" onkeypress="if(event.key==='Enter')DIET.handleTextLog()">
        <button class="text-log-btn" onclick="DIET.handleTextLog()">Log</button>
      </div>
      <div class="cheat-budget-bar" id="cheat-budget-bar" style="display:none"></div>
      <div id="ai-result-panel" style="display:none" class="ai-result-panel"></div>
      <div class="section-title" style="margin-top:16px">Today's Meals</div>
      <div id="meals-list"></div>
      <div class="recipe-section">
        <button class="recipe-btn" onclick="DIET.buildRecipe()">👨‍🍳 Build Recipe from Remaining Macros</button>
      </div>
      <div id="recipe-result" style="display:none" class="recipe-card"></div>`;

    document.getElementById('diet-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });
    await this.loadTodayMeals();
    await this.loadCheatBudget();
  },

  async loadTodayMeals() {
    const today = DB.today();
    const meals  = (await DB.getByIndex('meals', 'date', today)).sort((a,b) => a.ts - b.ts);
    const settings = window._userSettings || {};
    const calTarget   = (settings.calorieTarget  > 0 ? settings.calorieTarget  : null) || 2000;
    const protTarget  = (settings.proteinTarget  > 0 ? settings.proteinTarget  : null) || 130;
    const carbTarget  = (settings.carbTarget     > 0 ? settings.carbTarget     : null) || 220;
    const fatTarget   = (settings.fatTarget      > 0 ? settings.fatTarget      : null) || 65;
    const fibreTarget = (settings.fibreTarget    > 0 ? settings.fibreTarget    : null) || 30;

    const totals = meals.reduce((acc, m) => ({
      cal:   acc.cal   + (m.calories || 0),
      prot:  acc.prot  + (m.protein  || 0),
      carbs: acc.carbs + (m.carbs    || 0),
      fat:   acc.fat   + (m.fat      || 0),
      fibre: acc.fibre + (m.fibre    || 0)
    }), {cal:0,prot:0,carbs:0,fat:0,fibre:0});

    const bar = document.getElementById('diet-macro-bar');
    bar.innerHTML = `
      <div class="macro-item"><div class="macro-val">${totals.cal}<span class="macro-unit">kcal</span></div><div class="macro-bar-track"><div class="macro-bar-fill" style="width:${Math.min(totals.cal/calTarget*100,100)}%;background:#0ff0b3"></div></div><div class="macro-target">/ ${calTarget}</div></div>
      <div class="macro-item"><div class="macro-val">${totals.prot}<span class="macro-unit">g P</span></div><div class="macro-bar-track"><div class="macro-bar-fill" style="width:${Math.min(totals.prot/protTarget*100,100)}%;background:#f0a500"></div></div><div class="macro-target">/ ${protTarget}g</div></div>
      <div class="macro-item"><div class="macro-val">${totals.carbs}<span class="macro-unit">g C</span></div><div class="macro-bar-track"><div class="macro-bar-fill" style="width:${Math.min(totals.carbs/carbTarget*100,100)}%;background:#6c63ff"></div></div><div class="macro-target">/ ${carbTarget}g</div></div>
      <div class="macro-item"><div class="macro-val">${totals.fat}<span class="macro-unit">g F</span></div><div class="macro-bar-track"><div class="macro-bar-fill" style="width:${Math.min(totals.fat/fatTarget*100,100)}%;background:#ff6b35"></div></div><div class="macro-target">/ ${fatTarget}g</div></div>`;

    const list = document.getElementById('meals-list');
    list.innerHTML = meals.length ? meals.map(m => `
      <div class="meal-card">
        <div class="meal-header">
          <div class="meal-name">${m.name}</div>
          <div class="meal-actions">
            <span class="chol-badge chol-badge--${m.cholesterolRating || 'neutral'}">${m.cholesterolRating || 'neutral'}</span>
            <button class="meal-delete" onclick="DIET.deleteMeal(${m.id})">✕</button>
          </div>
        </div>
        <div class="meal-desc">${m.description || ''}</div>
        <div class="meal-macros">
          <span>${m.calories} kcal</span>
          <span>${m.protein}g P</span>
          <span>${m.carbs}g C</span>
          <span>${m.fat}g F</span>
          ${m.fibre ? `<span>${m.fibre}g Fi</span>` : ''}
        </div>
        ${m.mealNote ? `<div class="meal-note">💡 ${m.mealNote}</div>` : ''}
      </div>`).join('') : '<div class="empty-state">No meals logged yet today.<br>Snap a photo or type what you ate.</div>';

    // Award protein XP if target hit
    if (totals.prot >= protTarget) {
      const xpToday = await DB.getByIndex('xp', 'date', today);
      if (!xpToday.some(x => x.source === 'hitProtein')) {
        await GAMIFICATION.awardXP(GAMIFICATION.xpValues.hitProtein, 'hitProtein', 'Protein target hit');
      }
    }
  },

  async handlePhoto(input) {
    if (!input.files?.[0]) return;
    const panel = document.getElementById('ai-result-panel');
    panel.style.display = 'block';
    panel.innerHTML = '<div class="ai-loading">📷 Identifying food items...</div>';

    try {
      const compressed = await AI.compressImage(input.files[0]);
      // Store compressed blob for step 2 (not needed — step 2 uses text, but keep for potential re-scan)
      this._lastPhotoBlob = compressed;

      const identified = await AI.identifyFoodItems(compressed);
      if (!Array.isArray(identified) || !identified.length) throw new Error('Could not identify any food items. Try a clearer photo.');

      this._showItemConfirmation(identified);
      await GAMIFICATION.awardXP(GAMIFICATION.xpValues.photoFood, 'photo', 'Food photo analysed');
    } catch (err) {
      panel.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`;
    }
    input.value = '';
  },

  _showItemConfirmation(items) {
    const panel = document.getElementById('ai-result-panel');
    panel.innerHTML = `
      <div class="confirm-header">
        <div class="confirm-title">🔍 Found these items — correct them if needed</div>
        <div class="confirm-subtitle">Edit names or portions, then tap Calculate Nutrition</div>
      </div>
      <div id="confirm-items-list">
        ${items.map((item, i) => `
          <div class="confirm-item" id="confirm-item-${i}">
            <div class="confirm-item-row">
              <input type="text" class="confirm-name-input" id="confirm-name-${i}" value="${item.name}" placeholder="Food name">
              <button class="confirm-remove-btn" onclick="DIET._removeConfirmItem(${i})" title="Remove this item">✕</button>
            </div>
            <div class="confirm-item-row">
              <input type="text" class="confirm-weight-input" id="confirm-weight-${i}" value="${item.estimatedWeight}" placeholder="e.g. 150g">
              ${item.notes ? `<span class="confirm-item-note">${item.notes}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <button class="confirm-add-btn" onclick="DIET._addConfirmItem()">+ Add Missing Item</button>
      <div class="confirm-actions">
        <button class="result-confirm" onclick="DIET._calculateNutrition()">🧮 Calculate Nutrition</button>
        <button class="result-close" onclick="document.getElementById('ai-result-panel').style.display='none'">✕ Cancel</button>
      </div>`;
  },

  _removeConfirmItem(idx) {
    const el = document.getElementById(`confirm-item-${idx}`);
    if (el) el.remove();
    // Check if any items remain
    const remaining = document.querySelectorAll('.confirm-item');
    if (!remaining.length) {
      document.getElementById('ai-result-panel').style.display = 'none';
      APP.toast('All items removed — nothing to log.', 'info');
    }
  },

  _addConfirmItem() {
    const list = document.getElementById('confirm-items-list');
    if (!list) return;
    const newIdx = 'new-' + Date.now();
    const div = document.createElement('div');
    div.className = 'confirm-item';
    div.id = `confirm-item-${newIdx}`;
    div.innerHTML = `
      <div class="confirm-item-row">
        <input type="text" class="confirm-name-input" id="confirm-name-${newIdx}" placeholder="e.g. Chapati" autofocus>
        <button class="confirm-remove-btn" onclick="this.closest('.confirm-item').remove()" title="Remove">✕</button>
      </div>
      <div class="confirm-item-row">
        <input type="text" class="confirm-weight-input" id="confirm-weight-${newIdx}" placeholder="e.g. 60g">
      </div>`;
    list.appendChild(div);
    div.querySelector('input').focus();
  },

  async _calculateNutrition() {
    // Collect confirmed items from the editable list
    const confirmedItems = [];
    document.querySelectorAll('.confirm-item').forEach(row => {
      const nameInput   = row.querySelector('.confirm-name-input');
      const weightInput = row.querySelector('.confirm-weight-input');
      const name   = nameInput?.value?.trim();
      const weight = weightInput?.value?.trim() || '100g';
      if (name) confirmedItems.push({ name, weight });
    });

    if (!confirmedItems.length) {
      APP.toast('Add at least one item first.', 'warn');
      return;
    }

    const panel = document.getElementById('ai-result-panel');
    panel.innerHTML = `<div class="ai-loading">🤖 Calculating nutrition for ${confirmedItems.length} item${confirmedItems.length > 1 ? 's' : ''}...</div>`;

    try {
      const result = await AI.estimateNutritionForItems(confirmedItems);
      this.showFoodResult(result);
    } catch (err) {
      panel.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`;
    }
  },

  async handleMenuPhoto(input) {
    if (!input.files?.[0]) return;
    APP.toast('Scanning menu...', 'info');
    const panel = document.getElementById('ai-result-panel');
    panel.style.display = 'block';
    panel.innerHTML = '<div class="ai-loading">🤖 Scanning menu for best options...</div>';
    try {
      const remaining = await this._getRemainingMacros();
      const compressed = await AI.compressImage(input.files[0]);
      const result = await AI.scanMenu(compressed, remaining);
      panel.innerHTML = `
        <div class="result-header">📋 Menu Analysis</div>
        <div class="result-section"><b>Best Options:</b>${result.bestOptions?.map(o => `<div class="menu-option"><div class="menu-dish">${o.dish}</div><div class="menu-macros">${o.estimatedCal} kcal · ${o.protein}g P</div><div class="menu-reason">${o.reason}</div></div>`).join('') || ''}</div>
        ${result.avoid?.length ? `<div class="result-section"><b>Avoid:</b> ${result.avoid.join(', ')}</div>` : ''}
        <div class="result-tip">💡 ${result.tip || ''}</div>
        <button class="result-close" onclick="document.getElementById('ai-result-panel').style.display='none'">✕ Close</button>`;
    } catch (err) {
      panel.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`;
    }
    input.value = '';
  },

  showFoodResult(result) {
    const panel = document.getElementById('ai-result-panel');
    if (!result?.items) { panel.innerHTML = '<div class="ai-error">Could not parse result. Please try again.</div>'; return; }

    panel.innerHTML = `
      <div class="result-header">📷 Meal Analysis</div>
      ${result.items.map((item, i) => `
        <div class="result-item" id="result-item-${i}">
          <div class="result-item-header">
            <span class="result-item-name">${item.name}</span>
            <span class="result-item-qty">${item.estimatedWeight}</span>
          </div>
          <div class="result-item-macros">${item.calories}kcal · ${item.protein}g P · ${item.carbs}g C · ${item.fat}g F · ${item.fibre||0}g Fi</div>
          <span class="chol-badge chol-badge--${item.cholesterolRating}">${item.cholesterolRating} cholesterol</span>
        </div>`).join('')}
      <div class="result-totals">
        <b>Total:</b> ${result.totals.calories}kcal · ${result.totals.protein}g P · ${result.totals.carbs}g C · ${result.totals.fat}g F · ${result.totals.fibre}g Fi
      </div>
      <div class="result-rating">
        Protein: <b>${result.mealRating?.protein || 'ok'}</b> · Fibre: <b>${result.mealRating?.fibre || 'ok'}</b>
      </div>
      ${result.mealNote ? `<div class="result-note">💡 ${result.mealNote}</div>` : ''}
      <div class="result-actions">
        <button class="result-confirm" id="confirm-log-btn">✓ Log This</button>
        <button class="result-close" onclick="document.getElementById('ai-result-panel').style.display='none'">✕ Cancel</button>
      </div>`;
    this._pendingResults['food'] = result;
    document.getElementById('confirm-log-btn').onclick = () => this.confirmFoodLog(this._pendingResults['food']);
  },

  async confirmFoodLog(result) {
    const today = DB.today();
    await DB.add('meals', {
      date: today, name: result.items.map(i => i.name).join(', '),
      description: result.items.map(i => `${i.name} (${i.estimatedWeight})`).join(', '),
      calories: result.totals.calories, protein: result.totals.protein,
      carbs: result.totals.carbs, fat: result.totals.fat, fibre: result.totals.fibre,
      cholesterolRating: result.mealRating?.cholesterol || 'neutral',
      mealNote: result.mealNote || '', source: 'photo'
    });
    GAMIFICATION.invalidateStreakCache?.();
    await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logMeal, 'meal', 'Meal logged');
    document.getElementById('ai-result-panel').style.display = 'none';
    await this.loadTodayMeals();
    APP.toast('Meal logged! ✓', 'success');
  },

  async handleTextLog() {
    const input = document.getElementById('food-text-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    APP.toast('Estimating nutrition...', 'info');
    const panel = document.getElementById('ai-result-panel');
    panel.style.display = 'block';
    panel.innerHTML = '<div class="ai-loading">🤖 Estimating nutrition...</div>';
    try {
      const result = await AI.parseTextFood(text);
      this.showFoodResult(result);
    } catch (err) { panel.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  },

  async startVoice() {
    if (this.isRecording) return;
    this.isRecording = true;
    document.getElementById('voice-diet-icon').textContent = '🔴';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) { this.isRecording = false; return; }
    const chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = e => chunks.push(e.data);
    this.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      document.getElementById('voice-diet-icon').textContent = '⏳';
      const blob = new Blob(chunks, { type: 'audio/webm' });
      try {
        const transcript = await AI.transcribeVoice(blob);
        const panel = document.getElementById('ai-result-panel');
        panel.style.display = 'block';
        panel.innerHTML = `<div class="ai-loading">Heard: "${transcript}"<br>Estimating...</div>`;
        const result = await AI.parseVoiceFood(transcript);
        this.showFoodResult(result);
        await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logVoice, 'voice', transcript);
      } catch (err) { APP.toast(err.message, 'error'); }
      document.getElementById('voice-diet-icon').textContent = '🎤';
      this.isRecording = false;
    };
    this.mediaRecorder.start();
  },

  stopVoice() { if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop(); },

  triggerCamera() { document.getElementById('food-camera-input')?.click(); },

  async getMealSuggestions() {
    APP.toast('Getting suggestions...', 'info');
    const panel = document.getElementById('ai-result-panel');
    panel.style.display = 'block';
    panel.innerHTML = '<div class="ai-loading">🤖 Finding the best meal for your remaining macros...</div>';
    try {
      const remaining = await this._getRemainingMacros();
      const bias = await DB.getSetting('meal_bias');
      const result = await AI.getMealSuggestions(remaining, bias);
      panel.innerHTML = `
        <div class="result-header">🍽️ Meal Suggestions</div>
        <div class="result-note">Remaining today: ${remaining.calories}kcal · ${remaining.protein}g P</div>
        ${result.suggestions?.map(s => `
          <div class="suggestion-card">
            <div class="suggestion-name">${s.name}</div>
            <div class="suggestion-desc">${s.description}</div>
            <div class="suggestion-macros">${s.calories}kcal · ${s.protein}g P · ${s.prepTime}</div>
            <div class="chol-badge chol-badge--${s.cholesterolRating || 'neutral'}">${s.cholesterolRating || 'neutral'} cholesterol</div>
            <button class="log-suggestion-btn" data-suggestion-idx="${s.name}">Log This</button>
          </div>`).join('') || '<div>No suggestions available</div>'}
        <button class="result-close" onclick="document.getElementById('ai-result-panel').style.display='none'">✕ Close</button>`;
      // Wire up suggestion buttons safely without JSON-in-onclick
      result.suggestions?.forEach(s => {
        this._pendingResults[s.name] = s;
      });
      panel.querySelectorAll('[data-suggestion-idx]').forEach(btn => {
        btn.onclick = () => this.logSuggestion(this._pendingResults[btn.dataset.suggestionIdx]);
      });
    } catch (err) { panel.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  },

  async logSuggestion(suggestion) {
    const today = DB.today();
    await DB.add('meals', { date: today, name: suggestion.name, description: suggestion.description, calories: suggestion.calories, protein: suggestion.protein, carbs: suggestion.carbs || 0, fat: suggestion.fat || 0, fibre: suggestion.fibre || 0, cholesterolRating: suggestion.cholesterolRating || 'neutral', source: 'suggestion' });
    GAMIFICATION.invalidateStreakCache?.();
    await GAMIFICATION.awardXP(GAMIFICATION.xpValues.logMeal, 'meal', suggestion.name);
    document.getElementById('ai-result-panel').style.display = 'none';
    await this.loadTodayMeals();
    APP.toast(`${suggestion.name} logged! ✓`, 'success');
  },

  async buildRecipe() {
    const remaining = await this._getRemainingMacros();
    const el = document.getElementById('recipe-result');
    el.style.display = 'block';
    el.innerHTML = '<div class="ai-loading">👨‍🍳 Building a recipe for your remaining macros...</div>';
    try {
      const recipe = await AI.buildRecipe(remaining);
      el.innerHTML = `<div class="recipe-title">Tonight's Recipe</div><div class="recipe-body">${recipe.replace(/\n/g,'<br>')}</div>`;
    } catch (err) { el.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  },

  async deleteMeal(id) {
    await DB.del('meals', id);
    GAMIFICATION.invalidateStreakCache?.();
    await this.loadTodayMeals();
    APP.toast('Meal removed', 'info');
  },

  async _getRemainingMacros() {
    const today = DB.today();
    const meals = await DB.getByIndex('meals', 'date', today);
    const settings = window._userSettings || {};
    const totals = meals.reduce((acc, m) => ({ cal: acc.cal + (m.calories||0), prot: acc.prot + (m.protein||0), carbs: acc.carbs + (m.carbs||0), fat: acc.fat + (m.fat||0), fibre: acc.fibre + (m.fibre||0) }), {cal:0,prot:0,carbs:0,fat:0,fibre:0});
    return {
      calories: Math.max(0, (settings.calorieTarget || 2000) - totals.cal),
      protein:  Math.max(0, (settings.proteinTarget || 130)  - totals.prot),
      carbs:    Math.max(0, (settings.carbTarget || 220)     - totals.carbs),
      fat:      Math.max(0, (settings.fatTarget || 65)       - totals.fat),
      fibre:    Math.max(0, (settings.fibreTarget || 30)     - totals.fibre)
    };
  },

  async loadCheatBudget() {
    try {
      const last7 = [];
      for (let i=1; i<=7; i++) {
        const day = DB.daysAgo(i);
        const meals = await DB.getByIndex('meals', 'date', day);
        const cal = meals.reduce((s,m) => s + (m.calories||0), 0);
        if (cal > 0) last7.push({ date: day, calories: cal });
      }
      if (last7.length < 3) return;
      const result = await AI.getCheatMealBudget(last7);
      if (result?.budgetCalories) {
        const bar = document.getElementById('cheat-budget-bar');
        bar.style.display = 'block';
        bar.innerHTML = `<div class="cheat-header">🍕 Cheat Meal Budget</div><div class="cheat-body">Based on recent deficit: <b>${result.budgetCalories} kcal today</b>. ${result.advice}</div>`;
      }
    } catch {}
  }
};

window.DIET = DIET;
