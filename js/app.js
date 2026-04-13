const APP = {
  currentPage: 'dashboard',
  pages: ['dashboard', 'workout', 'diet', 'weight', 'progress', 'settings'],

  async init() {
    await this.loadUserSettings();
    await this.navigate('dashboard');
    this.setupNav();
    this.registerSW();
    this.scheduleAdaptive();
    this._startDayWatcher();
  },

  async loadUserSettings() {
    const stored = await DB.getSetting('user_profile');
    window._userSettings = stored ? JSON.parse(stored) : { ...TEMPLATES.userDefaults };
  },

  setupNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
  },

  async navigate(page) {
    if (!this.pages.includes(page)) page = 'dashboard';
    this.currentPage = page;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navBtn = document.querySelector(`[data-page="${page}"]`);

    pageEl.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div></div>';
    pageEl.classList.add('active');
    navBtn?.classList.add('active');

    window.scrollTo(0, 0);

    switch (page) {
      case 'dashboard':  await DASHBOARD.render();  break;
      case 'workout':    await WORKOUT.render();     break;
      case 'diet':       await DIET.render();        break;
      case 'weight':     await WEIGHT.render();      break;
      case 'progress':   await PROGRESS.render();    break;
      case 'settings':   await SETTINGS.render();    break;
    }
  },

  scheduleAdaptive() {
    const run = async () => {
      const result = await ADAPTIVE.run();
      if (result?.alerts?.length) {
        this.toast(`Coach update: ${result.alerts[0].message}`, 'info');
      }
    };
    setTimeout(run, 3000);
    setInterval(run, 6 * 3600 * 1000);
  },

  toast(msg, type = 'info') {
    const existing = document.querySelector('.app-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `app-toast app-toast--${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 3500);
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  // Re-render when date changes (midnight reset + resume from background)
  _startDayWatcher() {
    let lastDay = DB.today();

    const check = () => {
      const today = DB.today();
      if (today !== lastDay) {
        lastDay = today;
        // Refresh current page so counters reset
        this.navigate(this.currentPage);
        this.toast('New day — counters reset!', 'info');
      }
    };

    // Check every minute
    setInterval(check, 60 * 1000);

    // Also check when app comes back to foreground
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  APP.init();
  APP._nativeFeel();
});
window.APP = APP;

// ── Native-feel touch patches ──────────────────────────────────────────────
APP._nativeFeel = function() {
  // Prevent pull-to-refresh gesture on the whole document
  document.body.addEventListener('touchmove', e => {
    if (e.target.closest('#pages')) return; // allow scroll inside pages
    e.preventDefault();
  }, { passive: false });

  // Scroll the #pages div to top on every nav, not window
  const pages = document.getElementById('pages');
  const origNav = APP.navigate.bind(APP);
  APP.navigate = async function(page) {
    await origNav(page);
    if (pages) pages.scrollTop = 0;
  };

  // Prevent image drag (looks very web-like)
  document.addEventListener('dragstart', e => e.preventDefault());

  // Prevent double-tap zoom (native apps don't zoom)
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  // Haptic feedback on key actions (works on iOS Safari 16.4+)
  if (window.navigator?.vibrate) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigator.vibrate(8));
    });
  }
};
