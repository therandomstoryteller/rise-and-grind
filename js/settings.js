const SETTINGS = {

  async render() {
    const el = document.getElementById('page-settings');
    const geminiKey = await DB.getSetting('gemini_key') || '';
    const groqKey   = await DB.getSetting('groq_key')   || '';
    const profile   = window._userSettings || TEMPLATES.userDefaults;

    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Settings</h1></div>

      <div class="settings-section">
        <div class="settings-title">🔑 AI API Keys</div>
        <div class="settings-info">Your keys are stored only on this device and never sent anywhere else. Get them free at the links below.</div>
        <div class="form-group">
          <label>Gemini API Key <a href="https://aistudio.google.com/apikey" target="_blank" class="key-link">Get free key →</a></label>
          <div class="key-input-row">
            <input type="password" id="gemini-key-input" class="settings-input" placeholder="AIza..." value="${geminiKey}">
            <button class="test-btn" onclick="SETTINGS.testKey('gemini')">Test</button>
          </div>
          <div class="key-status" id="gemini-status"></div>
        </div>
        <div class="form-group">
          <label>Groq API Key <a href="https://console.groq.com" target="_blank" class="key-link">Get free key →</a></label>
          <div class="key-input-row">
            <input type="password" id="groq-key-input" class="settings-input" placeholder="gsk_..." value="${groqKey}">
            <button class="test-btn" onclick="SETTINGS.testKey('groq')">Test</button>
          </div>
          <div class="key-status" id="groq-status"></div>
        </div>
        <button class="save-btn" onclick="SETTINGS.saveKeys()">Save API Keys</button>
      </div>

      <div class="settings-section">
        <div class="settings-title">👤 Your Profile</div>
        <div class="profile-grid">
          <div class="form-group"><label>Name</label><input type="text" id="prof-name" class="settings-input" value="${profile.name||''}"></div>
          <div class="form-group"><label>Age</label><input type="number" id="prof-age" class="settings-input" value="${profile.age||36}" onchange="SETTINGS.recalcTargets()"></div>
          <div class="form-group"><label>Height (cm)</label><input type="number" id="prof-height" class="settings-input" value="${profile.height||168}" step="1" onchange="SETTINGS.recalcTargets()"></div>
          <div class="form-group"><label>Current Weight (kg)</label><input type="number" id="prof-start" class="settings-input" value="${profile.startWeight||87}" step="0.1" onchange="SETTINGS.recalcTargets()"></div>
          <div class="form-group"><label>Target Weight (kg)</label><input type="number" id="prof-target" class="settings-input" value="${profile.targetWeight||73.5}" step="0.1" onchange="SETTINGS.recalcTargets()"></div>
        </div>

        <div class="form-group" style="margin: 10px 0 4px">
          <label>Activity Level</label>
          <select id="prof-activity" class="settings-input" onchange="SETTINGS.recalcTargets()">
            <option value="1.2"   ${(profile.activityLevel||1.55)==1.2  ?'selected':''}>Sedentary — desk job, little exercise</option>
            <option value="1.375" ${(profile.activityLevel||1.55)==1.375?'selected':''}>Lightly Active — 1–3 workouts/week</option>
            <option value="1.55"  ${(profile.activityLevel||1.55)==1.55 ?'selected':''}>Moderately Active — 3–5 workouts/week</option>
            <option value="1.725" ${(profile.activityLevel||1.55)==1.725?'selected':''}>Very Active — 6–7 hard sessions/week</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 12px">
          <label>Weight Loss Rate</label>
          <select id="prof-lossrate" class="settings-input" onchange="SETTINGS.recalcTargets()">
            <option value="275"  ${(profile.weeklyDeficit||550)==275 ?'selected':''}>Gentle — 0.25 kg/week (275 kcal deficit)</option>
            <option value="550"  ${(profile.weeklyDeficit||550)==550 ?'selected':''}>Moderate — 0.5 kg/week (550 kcal deficit) ✓</option>
            <option value="825"  ${(profile.weeklyDeficit||550)==825 ?'selected':''}>Aggressive — 0.75 kg/week (825 kcal deficit)</option>
          </select>
        </div>

        <div id="calc-breakdown" class="calc-breakdown" style="display:none"></div>

        <div class="profile-grid" style="margin-top: 12px">
          <div class="form-group"><label>Daily Calories <span class="label-optional">(auto-calculated)</span></label><input type="number" id="prof-cal" class="settings-input" value="${profile.calorieTarget||2000}"></div>
          <div class="form-group"><label>Protein Target (g) <span class="label-optional">(auto)</span></label><input type="number" id="prof-protein" class="settings-input" value="${profile.proteinTarget||130}"></div>
          <div class="form-group"><label>Fibre Target (g)</label><input type="number" id="prof-fibre" class="settings-input" value="${profile.fibreTarget||30}"></div>
          <div class="form-group"><label>Daily Burn Target (kcal) 🔥 <span class="label-optional">(auto)</span></label><input type="number" id="prof-burn" class="settings-input" value="${profile.burnTarget||500}"></div>
        </div>

        <button class="calc-btn" onclick="SETTINGS.recalcTargets(true)">⚡ Recalculate All Targets</button>
        <button class="save-btn" onclick="SETTINGS.saveProfile()" style="margin-left:8px">Save Profile</button>
      </div>

      <div class="settings-section">
        <div class="settings-title">🏋️ Training Preferences</div>
        <div class="profile-grid">
          <div class="form-group">
            <label>Programme Split</label>
            <select id="prof-split" class="settings-input">
              <option value="ppl_ul" ${(profile.splitType||'ppl_ul')==='ppl_ul'?'selected':''}>Push/Pull/Legs + Upper/Lower</option>
              <option value="ppl" ${profile.splitType==='ppl'?'selected':''}>Push/Pull/Legs (3-day)</option>
              <option value="upper_lower" ${profile.splitType==='upper_lower'?'selected':''}>Upper/Lower (4-day)</option>
              <option value="full_body" ${profile.splitType==='full_body'?'selected':''}>Full Body (3-day)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Weekly Target (days)</label>
            <select id="prof-weekly" class="settings-input">
              ${[3,4,5,6].map(n => `<option value="${n}" ${(profile.weeklyTarget||5)===n?'selected':''}>${n} days</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Preferred Rest Day</label>
            <select id="prof-restday" class="settings-input">
              <option value="none" ${(profile.restDayPref||'none')==='none'?'selected':''}>No preference</option>
              ${'Sun,Mon,Tue,Wed,Thu,Fri,Sat'.split(',').map((d,i) => `<option value="${i}" ${profile.restDayPref===String(i)?'selected':''}>${d}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="save-btn" onclick="SETTINGS.saveTrainingPrefs()">Save Training Preferences</button>
      </div>

      <div class="settings-section">
        <div class="settings-title">🤖 AI Tools</div>
        <div class="ai-tools-grid">
          <button class="ai-tool-btn" onclick="SETTINGS.getSupplementAdvice()">💊 Supplement Advisor</button>
          <button class="ai-tool-btn" onclick="SETTINGS.getGroceryList()">🛒 Weekly Grocery List</button>
          <button class="ai-tool-btn" onclick="ADAPTIVE.run(true).then(()=>APP.toast('Adaptive engine ran!','success'))">🔄 Run Adaptive Engine</button>
          <button class="ai-tool-btn" onclick="SETTINGS.clearMotivation()">🔁 Reset Daily Quote</button>
        </div>
        <div id="ai-tool-result" style="display:none" class="ai-tool-result"></div>
      </div>

      <div class="settings-section">
        <div class="settings-title">💾 Data</div>
        <div class="data-actions">
          <button class="data-btn" onclick="SETTINGS.exportData()">📤 Export All Data (JSON)</button>
          <label class="data-btn" for="import-file-input">📥 Import Data (JSON)</label>
          <input type="file" id="import-file-input" accept=".json" style="display:none" onchange="SETTINGS.importData(this)">
          <button class="data-btn data-btn--danger" onclick="SETTINGS.clearAllData()">🗑️ Clear All Data</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">🔄 App Update</div>
        <div class="settings-info">If the app looks outdated after a deployment, tap below to force a fresh reload. Your data is never affected.</div>
        <button class="save-btn" style="background:#ff9f0a" onclick="SETTINGS.forceUpdate()">⚡ Force Update App Now</button>
        <div id="update-status" style="font-size:0.8rem;color:var(--muted);margin-top:8px;text-align:center"></div>
      </div>

      <div class="settings-section">
        <div class="settings-title">ℹ️ About</div>
        <div class="about-text">
          <b>Rise and Grind</b> — Built for your 87→72kg transformation.<br>
          Powered by Gemini 2.5 Flash (vision) and Groq Llama 3.3 70B (coaching).<br>
          All data stored on your device. No account, no server, no cost.<br><br>
          <span style="color:#777;font-size:0.85em">To install on iPhone: open in Safari → Share → Add to Home Screen</span>
        </div>
      </div>`;
  },

  async saveKeys() {
    const gemini = document.getElementById('gemini-key-input').value.trim();
    const groq   = document.getElementById('groq-key-input').value.trim();
    if (gemini) await DB.setSetting('gemini_key', gemini);
    if (groq)   await DB.setSetting('groq_key', groq);
    APP.toast('API keys saved ✓', 'success');
  },

  async testKey(type) {
    const statusEl = document.getElementById(`${type}-status`);
    statusEl.textContent = 'Testing...';
    statusEl.style.color = '#aaa';
    const key = document.getElementById(`${type}-key-input`).value.trim();
    if (key) await DB.setSetting(`${type}_key`, key);
    const results = await AI.testKeys();
    const ok = results[type];
    statusEl.textContent = ok ? '✓ Connected' : '✗ Invalid key';
    statusEl.style.color = ok ? 'var(--accent)' : '#ff6b6b';
  },

  // ── Auto-calculate targets from body stats ────────────────────────────────
  recalcTargets(showBreakdown = false) {
    const age      = parseInt(document.getElementById('prof-age')?.value)    || 36;
    const height   = parseFloat(document.getElementById('prof-height')?.value) || 168;
    const weight   = parseFloat(document.getElementById('prof-start')?.value)  || 87;
    const target   = parseFloat(document.getElementById('prof-target')?.value) || 73.5;
    const activity = parseFloat(document.getElementById('prof-activity')?.value) || 1.55;
    const deficit  = parseInt(document.getElementById('prof-lossrate')?.value)  || 550;

    // Mifflin-St Jeor BMR (male)
    const bmr  = Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    const tdee = Math.round(bmr * activity);
    const calTarget  = Math.max(1400, tdee - deficit); // floor at 1400 for safety
    const protTarget = Math.round(1.8 * target);       // 1.8g per kg of TARGET weight
    const fibreTarget = 30;                             // NHS recommendation
    const burnTarget  = Math.round(deficit * 0.55);    // ~55% of deficit via exercise

    // Fill in the fields
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('prof-cal',     calTarget);
    set('prof-protein', protTarget);
    set('prof-fibre',   fibreTarget);
    set('prof-burn',    burnTarget);

    // Show breakdown card
    if (showBreakdown) {
      const weeksToGoal = Math.round(((weight - target) * 7700) / (deficit * 7));
      const el = document.getElementById('calc-breakdown');
      if (el) {
        el.style.display = 'block';
        el.innerHTML = `
          <div class="calc-row"><span>BMR (base metabolism)</span><strong>${bmr} kcal</strong></div>
          <div class="calc-row"><span>TDEE (with activity)</span><strong>${tdee} kcal</strong></div>
          <div class="calc-row calc-row--accent"><span>Daily calorie target</span><strong>${calTarget} kcal</strong></div>
          <div class="calc-row"><span>Protein (1.8g × ${target}kg goal)</span><strong>${protTarget}g</strong></div>
          <div class="calc-row"><span>Fibre (NHS guideline)</span><strong>${fibreTarget}g</strong></div>
          <div class="calc-row calc-row--burn"><span>Daily burn target</span><strong>${burnTarget} kcal 🔥</strong></div>
          <div class="calc-note">At this rate you'll reach ${target}kg in approx <strong>~${weeksToGoal} weeks</strong></div>`;
        APP.toast('Targets recalculated ✓', 'success');
      }
    }

    return { calTarget, protTarget, fibreTarget, burnTarget };
  },

  async saveProfile() {
    const profile = {
      name:          document.getElementById('prof-name').value,
      age:           parseInt(document.getElementById('prof-age').value),
      height:        parseFloat(document.getElementById('prof-height').value),
      startWeight:   parseFloat(document.getElementById('prof-start').value),
      targetWeight:  parseFloat(document.getElementById('prof-target').value),
      activityLevel: parseFloat(document.getElementById('prof-activity').value) || 1.55,
      weeklyDeficit: parseInt(document.getElementById('prof-lossrate').value)   || 550,
      calorieTarget: parseInt(document.getElementById('prof-cal').value),
      proteinTarget: parseInt(document.getElementById('prof-protein').value),
      fibreTarget:   parseInt(document.getElementById('prof-fibre').value),
      burnTarget:    parseInt(document.getElementById('prof-burn').value)  || 500,
      carbTarget:    Math.round(parseInt(document.getElementById('prof-cal').value) * 0.44 / 4),
      fatTarget:     Math.round(parseInt(document.getElementById('prof-cal').value) * 0.30 / 9),
      diet: 'mostly-vegetarian'
    };
    await DB.setSetting('user_profile', JSON.stringify(profile));
    window._userSettings = profile;
    APP.toast('Profile saved ✓', 'success');
  },

  async saveTrainingPrefs() {
    const profile = window._userSettings || {};
    profile.splitType   = document.getElementById('prof-split').value;
    profile.weeklyTarget = parseInt(document.getElementById('prof-weekly').value);
    profile.restDayPref  = document.getElementById('prof-restday').value;
    await DB.setSetting('user_profile', JSON.stringify(profile));
    window._userSettings = profile;
    APP.toast('Training preferences saved ✓', 'success');
  },

  async getSupplementAdvice() {
    const el = document.getElementById('ai-tool-result');
    el.style.display = 'block';
    el.innerHTML = '<div class="ai-loading">🤖 Analysing your diet logs...</div>';
    try {
      const meals = (await DB.getAll('meals')).slice(-30);
      const result = await AI.getSupplementAdvice(meals);
      el.innerHTML = `
        <div class="tool-result-title">💊 Supplement Advisor</div>
        ${result.gaps?.map(g => `
          <div class="supplement-item">
            <div class="supp-header"><b>${g.nutrient}</b> <span class="risk-badge risk-${g.risk}">${g.risk} risk</span></div>
            <div>${g.reason}</div>
            <div class="supp-sources">Food sources: ${g.foodSources?.join(', ')}</div>
            ${g.supplementSuggestion ? `<div class="supp-rec">💊 ${g.supplementSuggestion}</div>` : ''}
            <div class="supp-nhs">${g.nhs}</div>
          </div>`).join('') || ''}
        <div class="supp-overall"><i>${result.overall}</i></div>`;
    } catch (err) { el.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  },

  async getGroceryList() {
    const el = document.getElementById('ai-tool-result');
    el.style.display = 'block';
    el.innerHTML = '<div class="ai-loading">🤖 Building your weekly grocery list...</div>';
    try {
      const mealPlan = TEMPLATES.mealPlans;
      const result = await AI.generateGroceryList(mealPlan);
      let html = `<div class="tool-result-title">🛒 Weekly Grocery List</div>`;
      if (result.categories) {
        for (const [cat, items] of Object.entries(result.categories)) {
          if (!items?.length) continue;
          html += `<div class="grocery-cat"><b>${cat}</b><ul>${items.map(i => `<li>${i.item} — ${i.quantity}${i.note ? ` <span class="grocery-note">(${i.note})</span>` : ''}</li>`).join('')}</ul></div>`;
        }
      }
      if (result.estimatedCost) html += `<div class="grocery-cost">Estimated cost: ${result.estimatedCost}</div>`;
      if (result.tip) html += `<div class="grocery-tip">💡 ${result.tip}</div>`;
      el.innerHTML = html;
    } catch (err) { el.innerHTML = `<div class="ai-error">❌ ${err.message}</div>`; }
  },

  async clearMotivation() {
    await DB.setSetting('daily_motivation', null);
    await DB.setSetting('daily_motivation_date', null);
    APP.toast('Quote will refresh on next dashboard load', 'info');
  },

  async exportData() {
    const json = await DB.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `riseandgrind-backup-${DB.today()}.json`;
    a.click();
    APP.toast('Data exported ✓', 'success');
  },

  importData(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await DB.importAll(e.target.result);
        APP.toast('Data imported ✓', 'success');
      } catch { APP.toast('Import failed — invalid file', 'error'); }
    };
    reader.readAsText(input.files[0]);
    input.value = '';
  },

  async clearAllData() {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    const stores = ['workouts','activities','meals','weight','checklist','measurements','cholesterol','photos','xp','badges','coachHistory','adaptations'];
    for (const s of stores) await DB.clear(s);
    APP.toast('All data cleared', 'warn');
  },

  async forceUpdate() {
    const status = document.getElementById('update-status');
    if (status) status.textContent = 'Clearing app cache…';
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      // Delete all caches (does NOT touch IndexedDB / your data)
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(n => caches.delete(n)));
      if (status) status.textContent = 'Done! Reloading…';
      // Small delay so user sees the message, then hard reload
      setTimeout(() => window.location.reload(true), 800);
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
    }
  }
};

window.SETTINGS = SETTINGS;
