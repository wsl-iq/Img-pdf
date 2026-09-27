/**
 * modules.js
 * All utility modules exposed as global objects.
 * No ES6 modules - works from file:// and http://.
 */

(function (global) {
  'use strict';

  /*
     Utils
     */
  const Utils = {
    formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    formatDate(isoString) {
      if (!isoString) return '-';
      try {
        const d = new Date(isoString);
        return d.toLocaleDateString('ar-EG', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      } catch (e) {
        return '-';
      }
    },

    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    loadImage(url) {
      return new Promise(function (resolve, reject) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('image load failed')); };
        img.src = url;
      });
    },

    escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  };

  /*
     Storage
     */
  const KEYS = {
    SETTINGS: 'img2pdf_settings',
    RECORDS: 'img2pdf_records',
    SESSION: 'img2pdf_session_meta'
  };

  const DEFAULT_SETTINGS = {
    theme: 'auto',
    font: 'cairo',
    pageSize: 'a4',
    orientation: 'portrait',
    margin: 'small',
    quality: '0.85',
    haptics: true,
    compression: 'balanced',
    pageNumbers: false
  };

  const DEFAULT_RECORDS = {
    totalPdfs: 0,
    totalImages: 0,
    lastGeneration: null,
    recentOperations: [],
    firstUse: new Date().toISOString()
  };

  function safeParse(str, fallback) {
    try { return str ? JSON.parse(str) : fallback; } catch (e) { return fallback; }
  }

  const Storage = {
    getSettings() {
      return Object.assign({}, DEFAULT_SETTINGS, safeParse(localStorage.getItem(KEYS.SETTINGS), {}));
    },
    saveSettings(s) {
      try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s)); } catch (e) {}
    },
    getRecords() {
      return Object.assign({}, DEFAULT_RECORDS, safeParse(localStorage.getItem(KEYS.RECORDS), {}));
    },
    saveRecords(r) {
      try { localStorage.setItem(KEYS.RECORDS, JSON.stringify(r)); } catch (e) {}
    },
    addRecord(type, data) {
      data = data || {};
      const records = this.getRecords();
      if (type === 'pdf_generated') {
        records.totalPdfs += 1;
        records.totalImages += data.imageCount || 0;
        records.lastGeneration = new Date().toISOString();
        records.recentOperations.unshift({
          id: Utils.generateId(),
          type: 'pdf',
          date: new Date().toISOString(),
          imageCount: data.imageCount || 0,
          pageSize: data.pageSize || 'a4',
          orientation: data.orientation || 'portrait'
        });
        if (records.recentOperations.length > 50) {
          records.recentOperations = records.recentOperations.slice(0, 50);
        }
      }
      this.saveRecords(records);
      return records;
    },
    clearRecords() {
      const fresh = Object.assign({}, DEFAULT_RECORDS, { firstUse: new Date().toISOString() });
      this.saveRecords(fresh);
      return fresh;
    },
    saveSession(meta) {
      try { localStorage.setItem(KEYS.SESSION, JSON.stringify(meta)); } catch (e) {}
    },
    wipeAllStorage() {
      try {
        Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); });
      } catch (e) {}
    }
  };

  /*
     IndexedDB
     */
  const DB_NAME = 'img2pdf_db';
  const DB_VERSION = 1;

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  const IDB = {
    async saveSessionImages(items) {
      if (!items.length) {
        await this.clearSessionImages();
        return true;
      }
      const db = await openDB();
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      store.clear();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const blob = item.file instanceof Blob
          ? item.file
          : await fetch(item.url).then(function (r) { return r.blob(); });
        store.put({
          id: item.id,
          name: item.name,
          size: item.size,
          width: item.width,
          height: item.height,
          type: item.type,
          blob: blob,
          transforms: item.transforms || null
        });
      }
      return new Promise(function (resolve) {
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    },

    async loadSessionImages() {
      try {
        const db = await openDB();
        const tx = db.transaction('sessions', 'readonly');
        const rows = await reqToPromise(tx.objectStore('sessions').getAll());
        return rows.map(function (row) {
          return {
            id: row.id,
            file: new File([row.blob], row.name, { type: row.type }),
            url: URL.createObjectURL(row.blob),
            name: row.name,
            size: row.size,
            width: row.width,
            height: row.height,
            type: row.type,
            transforms: row.transforms || null
          };
        });
      } catch (e) {
        return [];
      }
    },

    async clearSessionImages() {
      try {
        const db = await openDB();
        const tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').clear();
        return new Promise(function (resolve) {
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        });
      } catch (e) {
        return false;
      }
    },

    async wipeDB() {
      try {
        const db = await openDB();
        db.close();
        dbPromise = null;
        await new Promise(function (resolve) {
          const req = indexedDB.deleteDatabase(DB_NAME);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      } catch (e) {}
    }
  };

  /*
     History
     */
  const History = (function () {
    const MAX = 50;
    let undoStack = [];
    let redoStack = [];
    let currentSnap = null;
    const listeners = new Set();

    function notify() {
      listeners.forEach(function (cb) {
        try { cb({ canUndo: undoStack.length > 1, canRedo: redoStack.length > 0 }); } catch (e) {}
      });
    }

    return {
      push(state, label) {
        const snap = {
          ts: Date.now(),
          order: state.order || [],
          settings: Object.assign({}, state.settings || {}),
          label: label || ''
        };
        undoStack.push(snap);
        if (undoStack.length > MAX) undoStack.shift();
        redoStack = [];
        currentSnap = snap;
        notify();
      },
      undo() {
        if (undoStack.length <= 1) return null;
        const cur = undoStack.pop();
        redoStack.push(cur);
        currentSnap = undoStack[undoStack.length - 1];
        notify();
        return currentSnap;
      },
      redo() {
        if (redoStack.length === 0) return null;
        const s = redoStack.pop();
        undoStack.push(s);
        currentSnap = s;
        notify();
        return s;
      },
      current() { return currentSnap; },
      onChange(cb) {
        listeners.add(cb);
        return function () { listeners.delete(cb); };
      },
      reset() {
        undoStack = [];
        redoStack = [];
        currentSnap = null;
        notify();
      }
    };
  })();

  /*
     Theme
     */
  const Theme = (function () {
    const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');
    let currentMode = 'auto';

    function resolve(mode) {
      if (mode === 'auto') return MEDIA.matches ? 'dark' : 'light';
      return mode;
    }

    function apply(mode) {
      const r = resolve(mode);
      document.documentElement.setAttribute('data-theme', r);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', r === 'dark' ? '#0b0e14' : '#f4f6fa');
    }

    return {
      init() {
        const s = Storage.getSettings();
        currentMode = s.theme || 'auto';
        apply(currentMode);
        MEDIA.addEventListener('change', function () {
          if (currentMode === 'auto') apply('auto');
        });
      },
      set(mode) {
        currentMode = mode;
        apply(mode);
        const s = Storage.getSettings();
        s.theme = mode;
        Storage.saveSettings(s);
      },
      toggle() {
        const r = resolve(currentMode);
        const next = r === 'dark' ? 'light' : 'dark';
        this.set(next);
        return next;
      },
      current() { return currentMode; }
    };
  })();

  /*
     Fonts
     */
  const Fonts = (function () {
    const MAP = {
      cairo: { url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap' },
      tajawal: { url: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap' },
      noto: { url: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700&display=swap' },
      system: { url: null }
    };
    const loaded = {};

    function apply(key) {
      document.documentElement.setAttribute('data-font', key);
      const cfg = MAP[key];
      if (!cfg || !cfg.url || loaded[key]) return;
      const link = document.getElementById('fontLink');
      if (link) {
        link.href = cfg.url;
        loaded[key] = true;
      }
    }

    return {
      init() {
        const s = Storage.getSettings();
        apply(s.font || 'cairo');
      },
      set(key) {
        if (!MAP[key]) return;
        apply(key);
        const s = Storage.getSettings();
        s.font = key;
        Storage.saveSettings(s);
      }
    };
  })();

  /*
     SizeScreen
     */
  const SizeScreen = (function () {
    let currentDevice = 'mobile';
    const listeners = new Set();

    function detect(width) {
      if (width < 600) return 'mobile';
      if (width < 1200) return 'ipad';
      return 'computer';
    }

    function info() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const d = detect(w);
      return {
        device: d, width: w, height: h,
        isMobile: d === 'mobile', isIpad: d === 'ipad', isComputer: d === 'computer',
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        isPortrait: h > w, isLandscape: w > h,
        dpr: window.devicePixelRatio || 1
      };
    }

    function apply(d) {
      if (document.body && document.body.dataset.device !== d) {
        document.body.dataset.device = d;
      }
    }

    function notify(i) {
      listeners.forEach(function (cb) { try { cb(i); } catch (e) {} });
    }

    function check() {
      const i = info();
      if (i.device !== currentDevice) {
        currentDevice = i.device;
        apply(currentDevice);
      }
      notify(i);
    }

    return {
      init() {
        const i = info();
        currentDevice = i.device;
        apply(currentDevice);

        const queries = [
          window.matchMedia('(max-width: 599px)'),
          window.matchMedia('(min-width: 600px) and (max-width: 1199px)'),
          window.matchMedia('(min-width: 1200px)')
        ];

        queries.forEach(function (q) {
          if (q.addEventListener) q.addEventListener('change', check);
          else if (q.addListener) q.addListener(check);
        });

        let timer = null;
        window.addEventListener('resize', function () {
          clearTimeout(timer);
          timer = setTimeout(check, 120);
        }, { passive: true });

        window.addEventListener('orientationchange', function () {
          setTimeout(check, 200);
        }, { passive: true });
      },
      get() { return currentDevice; },
      info: info,
      onChange(cb) {
        listeners.add(cb);
        return function () { listeners.delete(cb); };
      }
    };
  })();

  /*
     Haptics
     */
  const Haptics = (function () {
    let enabled = true;

    function can() {
      return typeof navigator !== 'undefined' && 'vibrate' in navigator;
    }

    function vib(pattern) {
      if (!enabled || !can()) return;
      try { navigator.vibrate(pattern); } catch (e) {}
    }

    return {
      set(v) { enabled = !!v; },
      get() { return enabled; },
      tap() { vib(10); },
      light() { vib(8); },
      medium() { vib(20); },
      success() { vib([15, 40, 15]); },
      error() { vib([50, 30, 50]); },
      warning() { vib([30, 40, 30]); }
    };
  })();

  /*
     Badge
     */
  const Badge = {
    async set(count) {
      if (!('setAppBadge' in navigator)) return;
      try {
        if (count > 0) await navigator.setAppBadge(count);
        else await navigator.clearAppBadge();
      } catch (e) {}
    }
  };

  /*
     Cache (image hashing, no worker)
     */
  const Cache = {
    async hashImage(blob) {
      try {
        const slice = blob.slice(0, Math.min(blob.size, 65536));
        const buf = await slice.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-1', buf);
        return Array.from(new Uint8Array(hash))
          .map(function (b) { return b.toString(16).padStart(2, '0'); })
          .join('');
      } catch (e) {
        return null;
      }
    }
  };

  /*
     Duplicates
     */
  const Duplicates = (function () {
    const hashes = new Map();

    return {
      async register(item) {
        const hash = await Cache.hashImage(item.file);
        if (!hash) return { hash: null };
        const existing = hashes.get(hash);
        hashes.set(hash, item.id);
        return existing ? { duplicateOf: existing, hash: hash } : { hash: hash };
      },
      unregister(id) {
        hashes.forEach(function (v, k) {
          if (v === id) hashes.delete(k);
        });
      },
      clearAll() { hashes.clear(); }
    };
  })();

  /*
     Suggest
     */
  const Suggest = {
    suggestSettings(items) {
      if (!items.length) return null;
      let portrait = 0, landscape = 0, square = 0;
      items.forEach(function (it) {
        const r = it.width / it.height;
        if (r > 1.1) landscape++;
        else if (r < 0.9) portrait++;
        else square++;
      });
      if (portrait >= landscape + square) {
        return { orientation: 'portrait', reason: 'معظم صورك طولية - ننصح بـ A4 طولي' };
      } else if (landscape >= portrait + square) {
        return { orientation: 'landscape', reason: 'معظم صورك عرضية - ننصح بـ A4 عرضي' };
      }
      return { orientation: 'auto', reason: 'صورك متنوعة - ننصح بالوضع التلقائي' };
    }
  };

  /*
     Stats
     */
  const Stats = {
    buildWeeklyChart(operations) {
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const counts = [0, 0, 0, 0, 0, 0, 0];
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      operations.forEach(function (op) {
        const t = new Date(op.date).getTime();
        if (t >= weekAgo) {
          const d = new Date(op.date).getDay();
          counts[d] += op.imageCount || 1;
        }
      });

      const max = Math.max.apply(null, counts.concat([1]));
      const W = 320, H = 120, pad = 20;
      const barW = (W - pad * 2) / 7 - 6;

      let bars = '';
      counts.forEach(function (v, i) {
        const h = (v / max) * (H - pad * 2);
        const x = pad + i * ((W - pad * 2) / 7) + 3;
        const y = H - pad - h;
        bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="4" fill="var(--accent)" opacity="' + (v ? 0.9 : 0.15) + '"/>';
        bars += '<text x="' + (x + barW / 2) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-muted)">' + days[i] + '</text>';
        if (v) bars += '<text x="' + (x + barW / 2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="10" fill="var(--text)">' + v + '</text>';
      });

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" width="100%" height="auto">' + bars + '</svg>';
    }
  };

  /*
     ExportImport
     */
  const ExportImport = {
    export() {
      const data = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        settings: Storage.getSettings(),
        records: Storage.getRecords()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'img2pdf-settings-' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    },

    import(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const data = JSON.parse(e.target.result);
            if (data.settings) Storage.saveSettings(data.settings);
            if (data.records) Storage.saveRecords(data.records);
            resolve(data);
          } catch (err) {
            reject(new Error('invalid file'));
          }
        };
        reader.onerror = function () { reject(new Error('read failed')); };
        reader.readAsText(file);
      });
    }
  };

  /*
     Images
     */
  const Images = (function () {
    const SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const MAX = 100;
    const MAX_SIZE = 50 * 1024 * 1024;
    let items = [];

    function validate(file) {
      if (!file || !file.type) return { valid: false, reason: 'ملف غير صالح' };
      if (SUPPORTED.indexOf(file.type) === -1) {
        return { valid: false, reason: 'صيغة غير مدعومة' };
      }
      if (file.size > MAX_SIZE) {
        return { valid: false, reason: 'حجم كبير جدا (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)' };
      }
      return { valid: true };
    }

    return {
      SUPPORTED: SUPPORTED,
      MAX: MAX,

      async addFiles(fileList) {
        const files = Array.from(fileList);
        const results = { added: 0, rejected: [] };

        if (items.length >= MAX) {
          return {
            added: 0,
            rejected: [{ name: 'الحد الأقصى', reason: 'لا يمكن إضافة أكثر من ' + MAX + ' صورة' }]
          };
        }

        const remaining = MAX - items.length;
        const toProcess = files.slice(0, remaining);

        for (let i = 0; i < toProcess.length; i++) {
          const file = toProcess[i];
          const v = validate(file);
          if (!v.valid) {
            results.rejected.push({ name: file.name, reason: v.reason });
            continue;
          }
          try {
            const url = URL.createObjectURL(file);
            const img = await Utils.loadImage(url);

            const newItem = {
              id: Utils.generateId(),
              file: file,
              url: url,
              name: file.name,
              size: file.size,
              width: img.naturalWidth,
              height: img.naturalHeight,
              type: file.type,
              transforms: null
            };

            const dup = await Duplicates.register(newItem);
            if (dup.duplicateOf) {
              URL.revokeObjectURL(url);
              results.rejected.push({ name: file.name, reason: 'صورة مكررة' });
              continue;
            }

            items.push(newItem);
            results.added++;
          } catch (e) {
            results.rejected.push({ name: file.name, reason: 'فشل القراءة' });
          }
        }

        if (files.length > remaining) {
          results.rejected.push({
            name: 'ملفات إضافية',
            reason: 'تم تجاهل ' + (files.length - remaining) + ' ملف'
          });
        }

        return results;
      },

      remove(id) {
        const idx = items.findIndex(function (i) { return i.id === id; });
        if (idx === -1) return false;
        URL.revokeObjectURL(items[idx].url);
        Duplicates.unregister(id);
        items.splice(idx, 1);
        return true;
      },

      clearAll() {
        items.forEach(function (item) { URL.revokeObjectURL(item.url); });
        items = [];
        Duplicates.clearAll();
      },

      move(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= items.length) return false;
        if (toIndex < 0 || toIndex >= items.length) return false;
        if (fromIndex === toIndex) return false;
        const moved = items.splice(fromIndex, 1)[0];
        items.splice(toIndex, 0, moved);
        return true;
      },

      moveUp(id) {
        const idx = items.findIndex(function (i) { return i.id === id; });
        return idx > 0 ? this.move(idx, idx - 1) : false;
      },

      moveDown(id) {
        const idx = items.findIndex(function (i) { return i.id === id; });
        return idx < items.length - 1 ? this.move(idx, idx + 1) : false;
      },

      updateTransforms(id, transforms) {
        const item = items.find(function (i) { return i.id === id; });
        if (item) item.transforms = transforms;
      },

      getAll() { return items.slice(); },
      getById(id) { return items.find(function (i) { return i.id === id; }); },
      count() { return items.length; },
      restoreItem(item) {
        items.push(item);
        Duplicates.register(item);
      },
      replaceAll(newItems) { items = newItems; },
      cleanup() {
        items.forEach(function (item) { URL.revokeObjectURL(item.url); });
      }
    };
  })();

  /*
     PDF
     */
  const PDF = (function () {
    const PAGE_SIZES = {
      a4: { width: 595.28, height: 841.89 },
      letter: { width: 612, height: 792 }
    };
    const MARGINS = { '0': 0, small: 18, medium: 36 };
    const COMPRESSION = {
      small: { maxDimension: 1200, quality: 0.7 },
      balanced: { maxDimension: 2000, quality: 0.85 },
      max: { maxDimension: 0, quality: 1 }
    };

    async function convertToJpeg(item, quality, maxDimension) {
      const img = await Utils.loadImage(item.url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      const t = item.transforms || {};
      const rotation = t.rotation || 0;
      const brightness = t.brightness === undefined ? 1 : t.brightness;
      const contrast = t.contrast === undefined ? 1 : t.contrast;
      const removeWhite = t.removeWhite || false;

      if (maxDimension > 0 && Math.max(w, h) > maxDimension) {
        const scale = maxDimension / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const rad = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const cw = Math.round(w * cos + h * sin);
      const ch = Math.round(w * sin + h * cos);

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);

      if (brightness !== 1 || contrast !== 1 || removeWhite) {
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i], g = data[i + 1], b = data[i + 2];
          if (removeWhite && r > 235 && g > 235 && b > 235) {
            data[i + 3] = 0;
            continue;
          }
          r = Math.min(255, Math.max(0, ((r - 128) * contrast + 128) * brightness));
          g = Math.min(255, Math.max(0, ((g - 128) * contrast + 128) * brightness));
          b = Math.min(255, Math.max(0, ((b - 128) * contrast + 128) * brightness));
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      const blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });

      canvas.width = 0;
      canvas.height = 0;

      if (!blob) throw new Error('encode failed');
      const ab = await blob.arrayBuffer();
      return { data: new Uint8Array(ab), width: cw, height: ch };
    }

    function escapeText(str) {
      return String(str).replace(/[\\()]/g, '\\$&');
    }

    return {
      async build(items, options) {
        const pageSize = options.pageSize || 'a4';
        const orientation = options.orientation || 'portrait';
        const margin = options.margin || 'small';
        const quality = options.quality || '0.85';
        const compression = options.compression || 'balanced';
        const pageNumbers = options.pageNumbers || false;

        const comp = COMPRESSION[compression] || COMPRESSION.balanced;
        const effQuality = Math.min(parseFloat(quality), comp.quality);
        const maxDim = comp.maxDimension;
        const marginPts = MARGINS[margin] === undefined ? MARGINS.small : MARGINS[margin];

        const jpegs = [];
        for (let i = 0; i < items.length; i++) {
          jpegs.push(await convertToJpeg(items[i], effQuality, maxDim));
        }

        const baseSize = pageSize === 'auto'
          ? { width: jpegs[0].width * 0.75, height: jpegs[0].height * 0.75 }
          : Object.assign({}, PAGE_SIZES[pageSize] || PAGE_SIZES.a4);

        const catalogId = 1;
        const pagesId = 2;
        const fontId = 3;
        let nextId = 4;

        const pages = [];

        for (let i = 0; i < jpegs.length; i++) {
          const jpeg = jpegs[i];
          let pw = baseSize.width;
          let ph = baseSize.height;

          if (pageSize === 'auto') {
            pw = jpeg.width * 0.75;
            ph = jpeg.height * 0.75;
          }
          if (orientation === 'landscape') {
            const tmp = pw; pw = ph; ph = tmp;
          } else if (orientation === 'auto') {
            const imgLand = jpeg.width > jpeg.height;
            const pageLand = pw > ph;
            if (imgLand !== pageLand) { const tmp = pw; pw = ph; ph = tmp; }
          }

          const availW = pw - marginPts * 2;
          const availH = ph - marginPts * 2;
          const scale = Math.min(availW / jpeg.width, availH / jpeg.height);
          const drawW = jpeg.width * scale;
          const drawH = jpeg.height * scale;
          const offsetX = marginPts + (availW - drawW) / 2;
          const offsetY = marginPts + (availH - drawH) / 2;

          const pageObjId = nextId++;
          const contentObjId = nextId++;
          const imgObjId = nextId++;

          let extra = '';
          if (pageNumbers) {
            const text = 'Page ' + (i + 1) + ' of ' + jpegs.length;
            extra += 'BT /F1 10 Tf ' + (pw / 2 - 30).toFixed(2) + ' 20 Td (' + escapeText(text) + ') Tj ET\n';
          }

          const contentStream = extra +
            'q\n' + drawW.toFixed(2) + ' 0 0 ' + drawH.toFixed(2) + ' ' +
            offsetX.toFixed(2) + ' ' + offsetY.toFixed(2) + ' cm\n/Im' + i + ' Do\nQ';

          pages.push({
            pageObjId: pageObjId,
            contentObjId: contentObjId,
            imgObjId: imgObjId,
            pw: pw,
            ph: ph,
            contentStream: contentStream,
            imgDict: '<< /Type /XObject /Subtype /Image /Width ' + jpeg.width +
              ' /Height ' + jpeg.height +
              ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
              jpeg.data.length + ' >>',
            jpegData: jpeg.data,
            imgName: 'Im' + i
          });
        }

        const chunks = [];
        const encoder = new TextEncoder();
        let offset = 0;
        const offsets = {};

        function addString(str) {
          const bytes = encoder.encode(str);
          chunks.push(bytes);
          offset += bytes.length;
        }

        function addBytes(bytes) {
          chunks.push(bytes);
          offset += bytes.length;
        }

        addString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

        offsets[catalogId] = offset;
        addString(catalogId + ' 0 obj\n<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>\nendobj\n');

        offsets[pagesId] = offset;
        const kids = pages.map(function (p) { return p.pageObjId + ' 0 R'; }).join(' ');
        addString(pagesId + ' 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>\nendobj\n');

        offsets[fontId] = offset;
        addString(fontId + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

        for (let i = 0; i < pages.length; i++) {
          const entry = pages[i];

          offsets[entry.pageObjId] = offset;
          addString(entry.pageObjId + ' 0 obj\n<< /Type /Page /Parent ' + pagesId +
            ' 0 R /MediaBox [0 0 ' + entry.pw.toFixed(2) + ' ' + entry.ph.toFixed(2) +
            '] /Contents ' + entry.contentObjId + ' 0 R /Resources << /XObject << /' +
            entry.imgName + ' ' + entry.imgObjId + ' 0 R >> /Font << /F1 ' + fontId +
            ' 0 R >> >> >>\nendobj\n');

          offsets[entry.contentObjId] = offset;
          const streamBytes = encoder.encode(entry.contentStream);
          addString(entry.contentObjId + ' 0 obj\n<< /Length ' + streamBytes.length + ' >>\nstream\n');
          addBytes(streamBytes);
          addString('\nendstream\nendobj\n');

          offsets[entry.imgObjId] = offset;
          addString(entry.imgObjId + ' 0 obj\n' + entry.imgDict + '\nstream\n');
          addBytes(entry.jpegData);
          addString('\nendstream\nendobj\n');
        }

        const xrefOffset = offset;
        const totalObjects = nextId;
        const xrefLines = ['xref\n0 ' + totalObjects + '\n', '0000000000 65535 f \n'];
        for (let i = 1; i < totalObjects; i++) {
          xrefLines.push((offsets[i] || 0).toString().padStart(10, '0') + ' 00000 n \n');
        }
        addString(xrefLines.join(''));

        addString('trailer\n<< /Size ' + totalObjects + ' /Root ' + catalogId +
          ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n');

        const totalLength = chunks.reduce(function (sum, c) { return sum + c.length; }, 0);
        const result = new Uint8Array(totalLength);
        let pos = 0;
        chunks.forEach(function (chunk) {
          result.set(chunk, pos);
          pos += chunk.length;
        });

        return new Blob([result], { type: 'application/pdf' });
      }
    };
  })();

  /*
     DOCX
     */
  const Docx = (function () {
    function blobToDataURL(blob) {
      return new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onloadend = function () { resolve(reader.result); };
        reader.readAsDataURL(blob);
      });
    }

    return {
      async export(items) {
        const parts = [];
        for (let i = 0; i < items.length; i++) {
          const dataUrl = await blobToDataURL(items[i].file);
          parts.push(
            '<div style="page-break-after: always; text-align:center; padding:20px;">' +
            '<img src="' + dataUrl + '" style="max-width:100%; max-height:700px;" alt="image ' + (i + 1) + '">' +
            '</div>'
          );
        }

        const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
          'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
          'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
          '<title>Images</title></head><body>' + parts.join('') + '</body></html>';

        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'images-' + Date.now() + '.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      }
    };
  })();

  /*
     Editor
     */
  const Editor = (function () {
    let currentItem = null;
    let currentTransforms = null;
    let onSave = null;
    const state = { rotation: 0, brightness: 1, contrast: 1, removeWhite: false };

    function renderPanel(tab) {
      const panel = document.getElementById('editorPanel');
      if (!panel) return;
      panel.innerHTML = '';

      if (tab === 'rotate') {
        panel.innerHTML =
          '<div class="editor-row">' +
            '<button type="button" class="btn btn-secondary" data-rotate="-90">-90</button>' +
            '<button type="button" class="btn btn-secondary" data-rotate="90">+90</button>' +
            '<button type="button" class="btn btn-secondary" data-rotate="180">180</button>' +
          '</div>' +
          '<div class="editor-row">' +
            '<label class="editor-label">تدوير حر</label>' +
            '<input type="range" id="rotationSlider" min="0" max="360" value="' + state.rotation + '">' +
            '<span class="editor-value">' + state.rotation + '</span>' +
          '</div>';
      } else {
        panel.innerHTML =
          '<div class="editor-row">' +
            '<label class="editor-label">السطوع</label>' +
            '<input type="range" id="brightnessSlider" min="0.5" max="1.5" step="0.05" value="' + state.brightness + '">' +
            '<span class="editor-value">' + Math.round(state.brightness * 100) + '%</span>' +
          '</div>' +
          '<div class="editor-row">' +
            '<label class="editor-label">التباين</label>' +
            '<input type="range" id="contrastSlider" min="0.5" max="1.5" step="0.05" value="' + state.contrast + '">' +
            '<span class="editor-value">' + Math.round(state.contrast * 100) + '%</span>' +
          '</div>' +
          '<div class="editor-row">' +
            '<label class="editor-label" style="min-width:auto">' +
              '<input type="checkbox" id="removeWhiteToggle"' + (state.removeWhite ? ' checked' : '') + '>' +
              ' إزالة الخلفية البيضاء' +
            '</label>' +
          '</div>';
      }

      bindPanelInputs();
    }

    function bindPanelInputs() {
      const rot = document.getElementById('rotationSlider');
      if (rot) rot.oninput = function (e) {
        state.rotation = parseInt(e.target.value);
        applyPreview();
        const v = e.target.closest('.editor-row').querySelector('.editor-value');
        if (v) v.textContent = state.rotation;
      };

      const bri = document.getElementById('brightnessSlider');
      if (bri) bri.oninput = function (e) {
        state.brightness = parseFloat(e.target.value);
        applyPreview();
        const v = e.target.closest('.editor-row').querySelector('.editor-value');
        if (v) v.textContent = Math.round(state.brightness * 100) + '%';
      };

      const con = document.getElementById('contrastSlider');
      if (con) con.oninput = function (e) {
        state.contrast = parseFloat(e.target.value);
        applyPreview();
        const v = e.target.closest('.editor-row').querySelector('.editor-value');
        if (v) v.textContent = Math.round(state.contrast * 100) + '%';
      };

      const rem = document.getElementById('removeWhiteToggle');
      if (rem) rem.onchange = function (e) {
        state.removeWhite = e.target.checked;
        applyPreview();
      };
    }

    function applyPreview() {
      const img = document.getElementById('editorImage');
      if (!img) return;
      img.style.transform = 'rotate(' + state.rotation + 'deg)';
      img.style.filter = 'brightness(' + state.brightness + ') contrast(' + state.contrast + ')';
    }

    function close() {
      const c = document.getElementById('editorContainer');
      if (c) c.innerHTML = '';
      currentItem = null;
      currentTransforms = null;
      onSave = null;
    }

    function save() {
      Haptics.success();
      currentTransforms.rotation = state.rotation;
      currentTransforms.brightness = state.brightness;
      currentTransforms.contrast = state.contrast;
      currentTransforms.removeWhite = state.removeWhite;
      if (onSave) onSave(currentTransforms);
      close();
    }

    return {
      open(item, saveCb) {
        currentItem = item;
        currentTransforms = item.transforms ? Object.assign({}, item.transforms) : {};
        currentTransforms.rotation = currentTransforms.rotation || 0;
        currentTransforms.brightness = currentTransforms.brightness === undefined ? 1 : currentTransforms.brightness;
        currentTransforms.contrast = currentTransforms.contrast === undefined ? 1 : currentTransforms.contrast;
        currentTransforms.removeWhite = currentTransforms.removeWhite || false;
        onSave = saveCb;

        state.rotation = currentTransforms.rotation;
        state.brightness = currentTransforms.brightness;
        state.contrast = currentTransforms.contrast;
        state.removeWhite = currentTransforms.removeWhite;

        const container = document.getElementById('editorContainer');
        if (!container) return;

        container.innerHTML =
          '<div class="editor-overlay">' +
            '<div class="editor-sheet">' +
              '<div class="editor-header">' +
                '<button type="button" class="btn-icon" id="editorCancel" aria-label="إلغاء">' +
                  '<svg class="icon"><use href="#ico-close"/></svg>' +
                '</button>' +
                '<h3 class="editor-title">تحرير الصورة</h3>' +
                '<button type="button" class="btn-icon" id="editorSave" aria-label="حفظ">' +
                  '<svg class="icon"><use href="#ico-check"/></svg>' +
                '</button>' +
              '</div>' +
              '<div class="editor-preview">' +
                '<img id="editorImage" alt="">' +
              '</div>' +
              '<div class="editor-tabs">' +
                '<button type="button" class="editor-tab active" data-tab="rotate">' +
                  '<svg class="icon"><use href="#ico-rotate"/></svg> تدوير' +
                '</button>' +
                '<button type="button" class="editor-tab" data-tab="adjust">' +
                  '<svg class="icon"><use href="#ico-sliders"/></svg> ضبط' +
                '</button>' +
              '</div>' +
              '<div class="editor-panel" id="editorPanel"></div>' +
            '</div>' +
          '</div>';

        const img = document.getElementById('editorImage');
        img.src = item.url;

        renderPanel('rotate');
        applyPreview();

        container.addEventListener('click', function (e) {
          const tab = e.target.closest('.editor-tab');
          if (tab) {
            Haptics.tap();
            container.querySelectorAll('.editor-tab').forEach(function (t) {
              t.classList.remove('active');
            });
            tab.classList.add('active');
            renderPanel(tab.dataset.tab);
            return;
          }

          const rot = e.target.closest('[data-rotate]');
          if (rot) {
            Haptics.tap();
            state.rotation = (state.rotation + parseInt(rot.dataset.rotate) + 360) % 360;
            applyPreview();
            const slider = document.getElementById('rotationSlider');
            if (slider) slider.value = state.rotation;
            const v = container.querySelector('.editor-value');
            if (v) v.textContent = state.rotation;
            return;
          }

          if (e.target.closest('#editorCancel')) close();
          if (e.target.closest('#editorSave')) save();
        });
      }
    };
  })();

  /*
     Shortcuts
     */
  const Shortcuts = (function () {
    const handlers = new Map();

    function buildCombo(e) {
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      return parts.join('+');
    }

    function onKeyDown(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      const combo = buildCombo(e);
      const h = handlers.get(combo);
      if (!h) return;
      e.preventDefault();
      try { h.fn(e); } catch (err) {}
    }

    return {
      init() {
        window.addEventListener('keydown', onKeyDown);
      },
      register(combo, fn, desc) {
        handlers.set(combo.toLowerCase(), { fn: fn, description: desc || '' });
      },
      clearAll() { handlers.clear(); }
    };
  })();

  /*
     UI
     */
  const UI = (function () {
    const els = {};

    function cacheElements() {
      const ids = [
        'dropZone', 'fileInput', 'imageGrid', 'emptyState', 'imageCount',
        'btnClearAll', 'btnGenerate', 'btnReorderToggle', 'btnExportWord',
        'btnUndo', 'btnRedo', 'btnToggleTheme',
        'btnExportSettings', 'btnImportSettings', 'importInput',
        'viewMain', 'viewSettings', 'viewRecords', 'viewStats',
        'btnBackSettings', 'btnBackRecords', 'btnBackStats',
        'recordsList', 'btnClearRecords', 'btnWipeStorage',
        'statsChart', 'statsSummary',
        'bottomNav', 'toastContainer', 'modalContainer', 'editorContainer'
      ];
      ids.forEach(function (id) { els[id] = document.getElementById(id); });
    }

    function showToast(message, type, duration) {
      type = type || 'info';
      duration = duration || 3000;
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      const icons = { success: 'ico-check', error: 'ico-close', warning: 'ico-info', info: 'ico-info' };
      toast.innerHTML = '<svg class="icon"><use href="#' + (icons[type] || 'ico-info') +
        '"/></svg><span>' + message + '</span>';
      els.toastContainer.appendChild(toast);
      setTimeout(function () {
        toast.classList.add('removing');
        setTimeout(function () { toast.remove(); }, 300);
      }, duration);
    }

    function showModal(title, message, onConfirm, confirmText, cancelText) {
      confirmText = confirmText || 'تأكيد';
      cancelText = cancelText || 'إلغاء';
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<h2>' + title + '</h2>' +
          '<p>' + message + '</p>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary" data-action="cancel">' + cancelText + '</button>' +
            '<button type="button" class="btn btn-danger" data-action="confirm">' + confirmText + '</button>' +
          '</div>' +
        '</div>';
      els.modalContainer.appendChild(overlay);

      function close() {
        overlay.style.opacity = '0';
        setTimeout(function () { overlay.remove(); }, 200);
      }

      overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
      overlay.querySelector('[data-action="confirm"]').addEventListener('click', function () {
        close();
        onConfirm();
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
      });

      const f = overlay.querySelectorAll('button');
      if (f.length) f[0].focus();
    }

    function renderImages(items, handlers, reorderMode) {
      if (items.length === 0) {
        els.imageGrid.classList.add('hidden');
        els.emptyState.classList.remove('hidden');
        els.imageCount.textContent = '0';
        return;
      }

      els.imageGrid.classList.remove('hidden');
      els.emptyState.classList.add('hidden');
      els.imageCount.textContent = items.length;

      const fragment = document.createDocumentFragment();

      items.forEach(function (item, index) {
        const li = document.createElement('li');
        li.className = 'image-card';
        li.dataset.id = item.id;
        if (reorderMode) li.draggable = true;

        const t = item.transforms || {};
        const styles = [];
        if (t.rotation) styles.push('transform: rotate(' + t.rotation + 'deg)');
        if (t.brightness !== undefined || t.contrast !== undefined) {
          styles.push('filter: brightness(' + (t.brightness === undefined ? 1 : t.brightness) +
            ') contrast(' + (t.contrast === undefined ? 1 : t.contrast) + ')');
        }

        li.innerHTML =
          '<img src="' + item.url + '" alt="" loading="lazy" style="' + styles.join(';') + '">' +
          '<span class="image-card-index">' + (index + 1) + '</span>' +
          '<div class="image-card-overlay">' +
            '<div class="image-card-actions">' +
              '<button type="button" class="btn-icon" data-action="edit" aria-label="تحرير">' +
                '<svg class="icon"><use href="#ico-edit"/></svg>' +
              '</button>' +
              '<button type="button" class="btn-icon" data-action="up" aria-label="أعلى">' +
                '<svg class="icon"><use href="#ico-up"/></svg>' +
              '</button>' +
              '<button type="button" class="btn-icon" data-action="down" aria-label="أسفل">' +
                '<svg class="icon"><use href="#ico-down"/></svg>' +
              '</button>' +
              '<button type="button" class="btn-icon danger" data-action="remove" aria-label="حذف">' +
                '<svg class="icon"><use href="#ico-trash"/></svg>' +
              '</button>' +
            '</div>' +
            '<div>' +
              '<div class="image-card-name force-ltr-inline">' + item.name + '</div>' +
              '<div class="image-card-size force-ltr-inline">' +
                Utils.formatBytes(item.size) + ' - ' + item.width + 'x' + item.height +
              '</div>' +
            '</div>' +
          '</div>';

        li.querySelector('[data-action="remove"]').addEventListener('click', function (e) {
          e.stopPropagation();
          handlers.onRemove(item.id);
        });
        li.querySelector('[data-action="edit"]').addEventListener('click', function (e) {
          e.stopPropagation();
          handlers.onEdit(item.id);
        });
        li.querySelector('[data-action="up"]').addEventListener('click', function (e) {
          e.stopPropagation();
          handlers.onMoveUp(item.id);
        });
        li.querySelector('[data-action="down"]').addEventListener('click', function (e) {
          e.stopPropagation();
          handlers.onMoveDown(item.id);
        });

        fragment.appendChild(li);
      });

      els.imageGrid.innerHTML = '';
      els.imageGrid.appendChild(fragment);
    }

    function renderRecords(records) {
      const recent = records.recentOperations || [];
      let html =
        '<div class="record-item"><span class="record-label">ملفات PDF المُنشأة</span>' +
        '<span class="record-value">' + (records.totalPdfs || 0) + '</span></div>' +
        '<div class="record-item"><span class="record-label">إجمالي الصور المُعالجة</span>' +
        '<span class="record-value">' + (records.totalImages || 0) + '</span></div>' +
        '<div class="record-item"><span class="record-label">آخر إنشاء</span>' +
        '<span class="record-value">' + Utils.formatDate(records.lastGeneration) + '</span></div>' +
        '<div class="record-item"><span class="record-label">أول استخدام</span>' +
        '<span class="record-value">' + Utils.formatDate(records.firstUse) + '</span></div>';

      if (recent.length) {
        html += '<div class="records-subtitle">آخر العمليات:</div>';
        recent.slice(0, 10).forEach(function (op) {
          html += '<div class="record-item small">' +
            '<span class="record-label">' + Utils.formatDate(op.date) + '</span>' +
            '<span class="record-value">' + op.imageCount + ' صور - ' + op.pageSize.toUpperCase() + '</span>' +
            '</div>';
        });
      }

      els.recordsList.innerHTML = html;
    }

    let currentView = 'main';
    let animating = false;

    const VIEWS = {
      main: function () { return els.viewMain; },
      settings: function () { return els.viewSettings; },
      records: function () { return els.viewRecords; },
      stats: function () { return els.viewStats; }
    };

    function showView(name, direction) {
      direction = direction || 'forward';
      if (animating || name === currentView) return;

      const fromEl = VIEWS[currentView] ? VIEWS[currentView]() : null;
      const toEl = VIEWS[name] ? VIEWS[name]() : null;
      if (!fromEl || !toEl) return;

      animating = true;
      toEl.classList.remove('hidden');

      const isMobile = document.body.dataset.device === 'mobile';

      if (isMobile) {
        if (direction === 'forward') {
          toEl.classList.add('view-enter-right');
          fromEl.classList.add('view-exit-left');
        } else {
          toEl.classList.add('view-enter-left');
          fromEl.classList.add('view-exit-right');
        }
      } else {
        toEl.classList.add('view-enter-right');
        fromEl.classList.add('view-exit-right');
      }

      setTimeout(function () {
        fromEl.classList.add('hidden');
        fromEl.classList.remove('view-exit-left', 'view-exit-right');
        toEl.classList.remove('view-enter-left', 'view-enter-right');
        currentView = name;
        animating = false;
        window.scrollTo({ top: 0, behavior: 'auto' });

        document.querySelectorAll('.bottom-nav-btn').forEach(function (btn) {
          btn.classList.toggle('active', btn.dataset.view === name);
        });
      }, 380);
    }

    function updateSegmented(container, value) {
      if (!container) return;
      const buttons = container.querySelectorAll('button[data-value]');
      buttons.forEach(function (btn) {
        const isActive = btn.dataset.value === String(value);
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', String(isActive));
      });
    }

    function syncSettingsUI(settings) {
      const groups = document.querySelectorAll('[data-setting]');
      groups.forEach(function (group) {
        const key = group.dataset.setting;
        const val = settings[key];
        if (val !== undefined) updateSegmented(group, val);
      });
    }

    return {
      els: els,
      cacheElements: cacheElements,
      showToast: showToast,
      showModal: showModal,
      renderImages: renderImages,
      renderRecords: renderRecords,
      showView: showView,
      getCurrentView: function () { return currentView; },
      updateSegmented: updateSegmented,
      syncSettingsUI: syncSettingsUI
    };
  })();

  /*
     Expose to global
     */
  global.AppModules = {
    Utils: Utils,
    Storage: Storage,
    IDB: IDB,
    History: History,
    Theme: Theme,
    Fonts: Fonts,
    SizeScreen: SizeScreen,
    Haptics: Haptics,
    Badge: Badge,
    Cache: Cache,
    Duplicates: Duplicates,
    Suggest: Suggest,
    Stats: Stats,
    ExportImport: ExportImport,
    Images: Images,
    PDF: PDF,
    Docx: Docx,
    Editor: Editor,
    Shortcuts: Shortcuts,
    UI: UI
  };

})(window);