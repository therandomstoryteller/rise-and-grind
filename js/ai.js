const AI = {

  async getKeys() {
    const gemini = await DB.getSetting('gemini_key');
    const groq   = await DB.getSetting('groq_key');
    return { gemini, groq };
  },

  // ── Gemini Vision (food photos, menu scanning, progress photos) ─────────────

  async analyseImage(blob, prompt) {
    const { gemini } = await this.getKeys();
    if (!gemini) throw new Error('Gemini API key not set. Go to Settings to add it.');

    const base64 = await this._blobToBase64(blob);
    const mimeType = blob.type || 'image/jpeg';

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64.split(',')[1] } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.2 }
    };

    // Try models in order — fall back on 503/429/404/500
    const models = ['gemini-2.5-flash-preview-04-17', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let lastErr;
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        if (res.status === 503 || res.status === 429 || res.status === 500 || res.status === 404) {
          lastErr = new Error(`Gemini ${model} unavailable (${res.status}), trying fallback…`);
          continue;
        }
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `Gemini error: ${res.status}`);
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        try { return JSON.parse(text); } catch { return text; }
      } catch (err) {
        if (err.message.includes('trying fallback')) { lastErr = err; continue; }
        throw err;
      }
    }
    throw new Error('Gemini is temporarily unavailable. Please try again in a moment.');
  },

  // Step 1 – identify items only, no nutrition yet
  async identifyFoodItems(blob) {
    const prompt = `You are a food identification expert. Look at this photo and identify every distinct food item you can see.
Return ONLY a JSON array — nothing else:
[
  { "name": "exact dish name (be specific, e.g. 'Dal tadka' not 'lentils')", "estimatedWeight": "150g", "notes": "any relevant detail, e.g. 'with ghee', 'looks home-cooked'" }
]
Rules:
- Be specific with Indian/South Asian dish names when applicable (dal, sabji, chapati, raita, etc.)
- Separate distinct items (rice and dal are separate, not 'rice and dal')
- Estimate realistic UK/Indian home-portion weights
- If you see a drink, include it
- Return valid JSON array only, no explanation`;
    return this.analyseImage(blob, prompt);
  },

  // Step 2 – estimate nutrition for a confirmed text list (no image needed, uses Groq)
  async estimateNutritionForItems(confirmedItems) {
    const itemList = confirmedItems.map(i => `- ${i.name}, approx ${i.weight}`).join('\n');
    return this._groq(
      `You are a precision nutrition expert specialising in Indian and UK food. Estimate detailed macros for each food item listed. Return JSON only.`,
      `Food items to estimate:
${itemList}

Return this exact JSON structure:
{
  "items": [
    {
      "name": "item name exactly as given",
      "estimatedWeight": "weight as given",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "fibre": 0,
      "cholesterolRating": "good|neutral|bad",
      "cholesterolNote": "brief reason"
    }
  ],
  "totals": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fibre": 0 },
  "mealRating": { "cholesterol": "good|neutral|bad", "protein": "adequate|low|high", "fibre": "good|low|high" },
  "mealNote": "brief 1-sentence overall comment"
}
Use realistic home-cooked Indian portion assumptions. Only return valid JSON.`
    );
  },

  // Legacy single-step (kept for voice/text flows)
  async analyseFoodPhoto(blob) {
    const prompt = `You are a nutrition expert. Analyse this food photo and return a JSON object with this exact structure:
{
  "items": [
    {
      "name": "food name",
      "estimatedWeight": "e.g. 150g",
      "calories": 250,
      "protein": 12,
      "carbs": 35,
      "fat": 8,
      "fibre": 4,
      "cholesterolRating": "good|neutral|bad",
      "cholesterolNote": "brief reason"
    }
  ],
  "totals": { "calories": 250, "protein": 12, "carbs": 35, "fat": 8, "fibre": 4 },
  "mealRating": { "cholesterol": "good|neutral|bad", "protein": "adequate|low|high", "fibre": "good|low|high" },
  "mealNote": "brief 1-sentence overall comment"
}
Assume UK portions. Be realistic with estimates. Only return valid JSON.`;
    return this.analyseImage(blob, prompt);
  },

  async scanMenu(blob, remainingMacros) {
    const prompt = `You are a nutrition and fitness coach. This is a restaurant menu photo.
The person needs to hit these remaining macros today: ${JSON.stringify(remainingMacros)}.
They have high cholesterol and prefer vegetarian options (occasional chicken/eggs OK).
Return JSON:
{
  "bestOptions": [
    { "dish": "name", "estimatedCal": 400, "protein": 20, "carbs": 45, "fat": 12, "reason": "why this is good" }
  ],
  "avoid": ["dish name - brief reason"],
  "tip": "one personalised tip"
}
Only return valid JSON.`;
    return this.analyseImage(blob, prompt);
  },

  async compareProgressPhotos(blob1, blob2) {
    const { gemini } = await this.getKeys();
    if (!gemini) throw new Error('Gemini API key not set.');

    const [b64a, b64b] = await Promise.all([this._blobToBase64(blob1), this._blobToBase64(blob2)]);
    const body = {
      contents: [{
        parts: [
          { text: 'Compare these two fitness progress photos (before and after). Note visible changes in body composition objectively and encouragingly. Return JSON: { "changes": ["change 1", "change 2"], "overall": "encouraging summary sentence", "advice": "one specific training or diet tip based on what you see" }' },
          { inline_data: { mime_type: 'image/jpeg', data: b64a.split(',')[1] } },
          { inline_data: { mime_type: 'image/jpeg', data: b64b.split(',')[1] } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.3 }
    };

    const models = ['gemini-2.5-flash-preview-04-17', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if ((res.status === 503 || res.status === 429 || res.status === 500 || res.status === 404) && model !== models[models.length-1]) continue;
      if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      try { return JSON.parse(text); } catch { return { changes: [], overall: text, advice: '' }; }
    }
  },

  // ── Groq Whisper (voice to text) ────────────────────────────────────────────

  async transcribeVoice(audioBlob) {
    const { groq } = await this.getKeys();
    if (!groq) throw new Error('Groq API key not set. Go to Settings to add it.');

    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    form.append('model', 'whisper-large-v3');
    form.append('language', 'en');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groq}` },
      body: form
    });
    if (!res.ok) throw new Error(`Whisper error: ${res.status}`);
    const data = await res.json();
    return data.text || '';
  },

  // ── Groq Llama (all text-based AI) ─────────────────────────────────────────

  async _groq(systemPrompt, userMessage, temperature = 0.4) {
    const { groq } = await this.getKeys();
    if (!groq) throw new Error('Groq API key not set. Go to Settings to add it.');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groq}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage }
        ],
        temperature,
        response_format: { type: 'json_object' }
      })
    });
    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    try { return JSON.parse(text); } catch { return { result: text }; }
  },

  async _groqText(systemPrompt, userMessage, temperature = 0.5) {
    const { groq } = await this.getKeys();
    if (!groq) throw new Error('Groq API key not set.');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groq}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage }
        ],
        temperature
      })
    });
    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },

  get _userContext() {
    const s = window._userSettings || {};
    return `User profile: ${s.name||'Akshay'}, 36 years old, male, 5'6" (168cm), current weight ~${s.currentWeight||87}kg, target weight ${s.targetWeight||73.5}kg. Mostly vegetarian (occasional eggs and chicken). UK-based. Has high cholesterol. Daily targets: ${s.calorieTarget||2000} kcal, ${s.proteinTarget||130}g protein, ${s.carbTarget||220}g carbs, ${s.fatTarget||65}g fat, ${s.fibreTarget||30}g fibre.`;
  },

  async parseVoiceFood(transcript) {
    return this._groq(
      `You are a UK nutrition expert. Parse spoken food descriptions into structured nutrition data. ${this._userContext} Return JSON: { "items": [{ "name": "food", "quantity": "150g", "calories": 200, "protein": 15, "carbs": 20, "fat": 5, "fibre": 3 }], "totals": { "calories": 200, "protein": 15, "carbs": 20, "fat": 5, "fibre": 3 } }`,
      transcript
    );
  },

  async parseTextFood(text) {
    return this._groq(
      `You are a UK nutrition expert. Estimate nutrition from a food description. ${this._userContext} Use UK food portions and common UK ingredients. Return JSON: { "items": [{ "name": "food", "quantity": "estimated amount", "calories": 200, "protein": 15, "carbs": 20, "fat": 5, "fibre": 3, "cholesterolRating": "good|neutral|bad" }], "totals": { "calories": 200, "protein": 15, "carbs": 20, "fat": 5, "fibre": 3 }, "mealNote": "one-line comment on this meal" }`,
      text
    );
  },

  async parseVoiceWorkout(transcript) {
    return this._groq(
      `You are a gym coach. Parse a spoken workout log into structured data. The user may say things like "bench press 60 kg 3 sets of 10" or "squats, 80 kilos, four sets, eight reps". Return JSON: { "exercises": [{ "name": "exercise name", "weight": 60, "weightUnit": "kg", "sets": 3, "reps": 10, "notes": "" }] }`,
      transcript
    );
  },

  async getMealSuggestions(remainingMacros, preferences) {
    return this._groq(
      `You are a UK nutrition coach. ${this._userContext} Suggest meals to fill remaining macros. Use UK-available vegetarian ingredients (occasional chicken/eggs OK). Prioritise cholesterol-lowering foods (oats, legumes, nuts, olive oil). Return JSON: { "suggestions": [{ "name": "meal name", "description": "brief description with quantities", "calories": 400, "protein": 30, "carbs": 45, "fat": 12, "fibre": 8, "cholesterolRating": "good", "prepTime": "10 mins" }] }`,
      `Remaining macros needed: ${JSON.stringify(remainingMacros)}. Preferences: ${preferences || 'none'}`
    );
  },

  async buildRecipe(remainingMacros) {
    return this._groqText(
      `You are a UK nutritionist and chef. ${this._userContext} Create a simple recipe to fill remaining macros. Use UK supermarket ingredients. Format as: recipe name, macros, ingredients list, step-by-step instructions (max 6 steps). Keep it simple — this is a weeknight meal.`,
      `Remaining macros: calories ${remainingMacros.calories}, protein ${remainingMacros.protein}g, carbs ${remainingMacros.carbs}g, fat ${remainingMacros.fat}g. Fibre goal remaining: ${remainingMacros.fibre}g.`
    );
  },

  async getDailyMotivation(recentData) {
    return this._groqText(
      `You are an encouraging fitness coach. Write ONE motivational sentence (max 20 words) personalised to this person's recent progress. Be specific, not generic. No emojis. No clichés like "keep going" or "you've got this".`,
      `Recent data: ${JSON.stringify(recentData)}`
    );
  },

  async getWeeklyReportCard(weekData) {
    return this._groq(
      `You are an evidence-based fitness and nutrition coach. ${this._userContext} Analyse this week's data and generate a weekly report card. Be specific and actionable. Return JSON: { "grades": { "nutrition": "B+", "training": "A", "consistency": "A-", "weightProgress": "B" }, "nutritionComment": "...", "trainingComment": "...", "consistencyComment": "...", "weightComment": "...", "topWin": "best thing from this week", "focusNext": "single most important thing to improve next week", "calorieSuggestion": 2000, "proteinSuggestion": 130 }`,
      JSON.stringify(weekData)
    );
  },

  async getBodyCompEstimate(data) {
    return this._groq(
      `You are a body composition expert. Estimate body fat percentage and lean mass using available data. Note: these are rough estimates, not medical measurements. Return JSON: { "estimatedBodyFat": 22, "estimatedLeanMass": 67, "bmi": 30.8, "bmiCategory": "Overweight", "bodyFatCategory": "Above average", "insight": "two sentences about their composition and what this means", "leanMassTrend": "stable|increasing|decreasing" }`,
      JSON.stringify(data)
    );
  },

  async getSupplementAdvice(dietLogs) {
    return this._groq(
      `You are a UK-based registered dietitian. ${this._userContext} Analyse recent diet logs and identify potential nutrient gaps. Only recommend supplements with strong evidence. Return JSON: { "gaps": [{ "nutrient": "Vitamin B12", "risk": "moderate|low|high", "reason": "why this might be low", "foodSources": ["food1", "food2"], "supplementSuggestion": "if needed, what to take and dose", "nhs": "NHS guidance note" }], "overall": "overall diet quality comment" }`,
      JSON.stringify(dietLogs)
    );
  },

  async generateGroceryList(mealPlan) {
    return this._groq(
      `You are a UK nutritionist. Generate a weekly grocery list for a Tesco or Aldi shop based on this meal plan. Group by category. Include quantities for one person for the week. Return JSON: { "categories": { "Produce": [{ "item": "name", "quantity": "1kg", "note": "optional tip" }], "Protein": [], "Dairy & Eggs": [], "Grains & Pulses": [], "Tins & Jars": [], "Condiments & Oils": [], "Supplements": [] }, "estimatedCost": "£XX-XX", "tip": "money-saving tip" }`,
      JSON.stringify(mealPlan)
    );
  },

  async getCheatMealBudget(recentCalorieData) {
    return this._groq(
      `You are a flexible dieting coach. ${this._userContext} Calculate the person's calorie "budget" from being under target recently. Give practical advice on how to enjoy a treat meal without derailing progress. Return JSON: { "deficitAccumulated": 1200, "budgetCalories": 2600, "advice": "specific advice", "mealSuggestions": ["suggestion 1", "suggestion 2"], "rules": ["guideline 1", "guideline 2"] }`,
      JSON.stringify(recentCalorieData)
    );
  },

  async getFormTip(exerciseName) {
    const cached = sessionStorage.getItem(`tip_${exerciseName}`);
    if (cached) return cached;
    const tip = await this._groqText(
      'You are an expert personal trainer. Give ONE concise (max 2 sentences) form cue for the following exercise. Focus on the most commonly made mistake. Be direct and specific.',
      exerciseName
    );
    sessionStorage.setItem(`tip_${exerciseName}`, tip);
    return tip;
  },

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async compressImage(file, maxWidth = 800) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(resolve, 'image/jpeg', 0.82);
      };
      img.src = url;
    });
  },

  showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `ai-toast ai-toast--${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3500);
  },

  async testKeys() {
    const { gemini, groq } = await this.getKeys();
    const results = { gemini: false, groq: false };
    if (groq) {
      try {
        await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${groq}` } })
          .then(r => { if (r.ok) results.groq = true; });
      } catch {}
    }
    if (gemini) {
      try {
        await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${gemini}`)
          .then(r => { if (r.ok) results.gemini = true; });
      } catch {}
    }
    return results;
  },

  // ── Workout AI ───────────────────────────────────────────────────────────────

  async workoutChat(userMessage, conversationHistory, workoutContext) {
    const { groq } = await this.getKeys();
    if (!groq) throw new Error('Groq API key not set. Go to Settings to add it.');

    const systemPrompt = `You are an expert personal trainer and strength coach. ${this._userContext}

Current workout context:
${JSON.stringify(workoutContext, null, 2)}

You have deep knowledge of:
- Progressive overload, periodisation, deload weeks
- Exercise substitutions for injuries or equipment limitations  
- Programme design (PPL, Upper/Lower, Full Body, 5/3/1, GZCLP etc.)
- Cholesterol management through exercise (aerobic + resistance combo)
- Tennis as supplementary cardio
- UK gym equipment availability

Be conversational, specific, and actionable. If suggesting a new exercise, always include sets, reps, rest time, and a form cue. If redesigning a programme, be comprehensive. Keep responses concise but complete — no waffle.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groq}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.6 })
    });
    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },

  async getExerciseAlternatives(exerciseName, muscle, reason) {
    return this._groq(
      `You are an expert personal trainer. ${this._userContext} Suggest alternative exercises. Return JSON only.`,
      `Exercise to replace: "${exerciseName}" (targets: ${muscle}). Reason for replacement: ${reason || 'variety/preference'}.
Return JSON: { "alternatives": [{ "name": "exercise name", "sets": 3, "reps": "8-12", "rest": 75, "muscle": "${muscle}", "tip": "key form cue", "why": "why this is a good swap" }] }`
    );
  },

  async generateAdaptedWorkout(workoutType, recentLogs, preferences) {
    return this._groqText(
      `You are an expert personal trainer. ${this._userContext} Generate an adapted workout session. Be specific with weights based on recent logs. Format clearly with exercise name, sets x reps @ weight, rest time, and one form tip per exercise.`,
      `Workout type needed: ${workoutType}
Recent performance data: ${JSON.stringify(recentLogs)}
Special requests/preferences: ${preferences || 'none'}
Generate a complete, personalised workout for today. Include a brief 1-sentence rationale for any changes from the standard template.`
    );
  },

  async generateNewProgramme(allWorkoutHistory, request) {
    return this._groqText(
      `You are an elite strength and conditioning coach. ${this._userContext} Design a complete, personalised training programme. Base it on the person's history and the specific request. Include: programme name, rationale, full weekly schedule, and all exercises with sets/reps/rest/progression scheme. Format clearly with headers for each day.`,
      `Full workout history summary: ${JSON.stringify(allWorkoutHistory)}
Specific request: ${request}
Design the complete programme. It should be 4-6 weeks long with clear progression guidelines.`
    );
  },

  async getMonthlyProgrammeReview(workoutHistory, performanceMetrics) {
    return this._groq(
      `You are an evidence-based strength coach. ${this._userContext} Review 4 weeks of training data and provide specific programme adjustments. Return JSON only.`,
      `4-week workout history: ${JSON.stringify(workoutHistory)}
Performance metrics: ${JSON.stringify(performanceMetrics)}
Return JSON: {
  "overallAssessment": "2 sentence summary",
  "whatIsWorking": ["point 1", "point 2"],
  "whatToChange": [{ "change": "specific change", "reason": "evidence-based reason", "implementation": "exactly how to implement" }],
  "nextPhase": "description of recommended next 4-week focus",
  "deloadNeeded": true/false,
  "deloadReason": "if true, why"
}`
    );
  }
};

window.AI = AI;
