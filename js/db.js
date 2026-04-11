const DB_NAME = 'fitforge-db';
const DB_VERSION = 2;
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      const stores = {
        workouts:     { ai: true, idx: ['date','type'] },
        activities:   { ai: true, idx: ['date','activityType'] },
        meals:        { ai: true, idx: ['date','mealType'] },
        weight:       { ai: true, idx: ['date'] },
        checklist:    { ai: true, idx: ['date'] },
        measurements: { ai: true, idx: ['date'] },
        cholesterol:  { ai: true, idx: ['date'] },
        photos:       { ai: true, idx: ['date','type'] },
        xp:           { ai: true, idx: ['date','source'] },
        badges:       { ai: false, kp: 'id' },
        coachHistory: { ai: true, idx: ['date','type'] },
        adaptations:  { ai: true, idx: ['date'] },
        settings:     { ai: false, kp: 'key' }
      };
      for (const [name, cfg] of Object.entries(stores)) {
        if (db.objectStoreNames.contains(name)) continue;
        const s = db.createObjectStore(name, cfg.ai
          ? { keyPath: 'id', autoIncrement: true }
          : { keyPath: cfg.kp });
        (cfg.idx || []).forEach(i => s.createIndex(i, i, { unique: false }));
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror  = e => reject(e.target.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

const DB = {
  add: (store, data) => tx(store, 'readwrite', s => s.add({ ...data, ts: Date.now() })),
  put: (store, data) => tx(store, 'readwrite', s => s.put({ ...data, ts: Date.now() })),
  get: (store, key)  => tx(store, 'readonly',  s => s.get(key)),
  del: (store, key)  => tx(store, 'readwrite', s => s.delete(key)),

  getAll: async (store) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  getByIndex: async (store, index, value) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  getByDateRange: async (store, from, to) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(from, to);
      const req = db.transaction(store,'readonly').objectStore(store).index('date').getAll(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  clear: async (store) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store,'readwrite').objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  },

  getSetting: async (key) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('settings','readonly').objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror   = () => reject(req.error);
    });
  },

  setSetting: async (key, value) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('settings','readwrite').objectStore('settings').put({ key, value, ts: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  },

  // Local-timezone date (fixes UTC midnight bug)
  today: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  daysAgo: (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  exportAll: async () => {
    const stores = ['workouts','activities','meals','weight','checklist','measurements','cholesterol','photos','xp','badges','coachHistory','adaptations','settings'];
    const out = {};
    for (const s of stores) out[s] = await DB.getAll(s);
    return JSON.stringify(out, null, 2);
  },

  importAll: async (json) => {
    const data = JSON.parse(json);
    const stores = ['workouts','activities','meals','weight','checklist','measurements','cholesterol','photos','xp','badges','coachHistory','adaptations','settings'];
    for (const s of stores) {
      if (!data[s]) continue;
      await DB.clear(s);
      for (const rec of data[s]) await DB.put(s, rec);
    }
  }
};

window.DB = DB;
