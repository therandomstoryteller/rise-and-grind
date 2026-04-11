const CHECKLIST = {

  async render() {
    const el = document.getElementById('page-checklist');
    const today = DB.today();
    const logged = await DB.getByIndex('checklist', 'date', today);
    const doneIds = new Set(logged.map(l => l.itemId));
    const streak = await GAMIFICATION.getCurrentStreak();
    const todayXP = await GAMIFICATION.getTodayXP();
    const doneCount = doneIds.size;

    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Daily Checklist</h1></div>
      <div class="checklist-header">
        <div class="cl-progress-ring-wrap">
          <canvas id="cl-ring" width="80" height="80"></canvas>
          <div class="cl-ring-label">${doneCount}/10</div>
        </div>
        <div class="cl-header-stats">
          <div class="cl-stat"><span class="cl-stat-num">${streak}</span><span class="cl-stat-label">Day Streak 🔥</span></div>
          <div class="cl-stat"><span class="cl-stat-num">+${todayXP}</span><span class="cl-stat-label">XP Today ⭐</span></div>
        </div>
      </div>
      <div class="checklist-items" id="checklist-items">
        ${TEMPLATES.checklist.map(item => {
          const done = doneIds.has(item.id);
          return `<div class="cl-item ${done ? 'done' : ''}" id="cl-item-${item.id}" onclick="CHECKLIST.toggle('${item.id}', ${item.xp})">
            <div class="cl-icon">${item.icon}</div>
            <div class="cl-text">
              <div class="cl-label">${item.label}</div>
              <div class="cl-sub">${item.subtitle}</div>
            </div>
            <div class="cl-check ${done ? 'checked' : ''}">
              ${done ? '✓' : ''}
            </div>
            <div class="cl-xp">+${item.xp} XP</div>
          </div>`;
        }).join('')}
      </div>
      <div class="cl-footer">
        <div class="cl-footer-msg" id="cl-footer-msg">${this._getMessage(doneCount)}</div>
      </div>`;

    this._drawRing('cl-ring', doneCount, 10, '#0ff0b3');
  },

  async toggle(itemId, xp) {
    const today = DB.today();
    const logged = await DB.getByIndex('checklist', 'date', today);
    const existing = logged.find(l => l.itemId === itemId);
    const el = document.getElementById(`cl-item-${itemId}`);

    if (existing) {
      await DB.del('checklist', existing.id);
      el.classList.remove('done');
      el.querySelector('.cl-check').classList.remove('checked');
      el.querySelector('.cl-check').textContent = '';
    } else {
      await DB.add('checklist', { date: today, itemId });
      el.classList.add('done');
      el.querySelector('.cl-check').classList.add('checked');
      el.querySelector('.cl-check').textContent = '✓';
      await GAMIFICATION.awardXP(xp, 'checklist', itemId);
      el.classList.add('cl-bounce');
      setTimeout(() => el.classList.remove('cl-bounce'), 500);
    }

    const allLogged = await DB.getByIndex('checklist', 'date', today);
    const count = allLogged.length;
    this._drawRing('cl-ring', count, 10, '#0ff0b3');
    document.querySelector('.cl-ring-label').textContent = `${count}/10`;
    document.getElementById('cl-footer-msg').textContent = this._getMessage(count);

    if (count === 10) {
      await GAMIFICATION.awardXP(GAMIFICATION.xpValues.completeChecklist, 'completeChecklist', 'Full checklist done');
      APP.toast('Full checklist complete! 🏆 +20 XP', 'success');
    }
    await GAMIFICATION.checkBadges();
  },

  _drawRing(canvasId, value, max, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 40, cy = 40, r = 32, lw = 8;
    const pct = value / max;
    ctx.clearRect(0, 0, 80, 80);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = lw; ctx.stroke();
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
    }
  },

  _getMessage(count) {
    if (count === 0)  return 'Start ticking! Every habit counts.';
    if (count <= 3)   return 'Good start. Keep adding to the list.';
    if (count <= 6)   return 'Halfway there — strong effort.';
    if (count <= 8)   return 'Almost there. Finish strong!';
    if (count === 9)  return 'One more! Go get it.';
    if (count === 10) return 'Perfect day! Full checklist achieved. 🏆';
    return '';
  }
};

window.CHECKLIST = CHECKLIST;
