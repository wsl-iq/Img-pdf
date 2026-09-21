import { generateId } from './utils.js';

const KEYS = {
  SETTINGS: 'img2pdf_settings',
  RECORDS: 'img2pdf_records',
  SESSION: 'img2pdf_session_meta',
};

const DEFAULT_SETTINGS = {
  theme: 'auto',        // 'light' | 'dark' | 'auto'
  font: 'cairo',        // 'cairo' | 'tajawal' | 'noto' | 'system'
  pageSize: 'a4',
  orientation: 'portrait',
  margin: 'small',
  quality: '0.85',
};

const DEFAULT_RECORDS = {
  totalPdfs: 0,
  totalImages: 0,
  lastGeneration: null,
  recentOperations: [],
  firstUse: new Date().toISOString(),
};

const safeParse = (str, fallback) => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};

/* Settings */
export const getSettings = () => ({
  ...DEFAULT_SETTINGS,
  ...safeParse(localStorage.getItem(KEYS.SETTINGS), {}),
});

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
};

export const updateSetting = (key, value) => {
  const settings = getSettings();
  settings[key] = value;
  saveSettings(settings);
  return settings;
};

/* Records */
export const getRecords = () => ({
  ...DEFAULT_RECORDS,
  ...safeParse(localStorage.getItem(KEYS.RECORDS), {}),
});

export const saveRecords = (records) => {
  try {
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
};

export const addRecord = (type, data = {}) => {
  const records = getRecords();
  if (type === 'pdf_generated') {
    records.totalPdfs += 1;
    records.totalImages += data.imageCount || 0;
    records.lastGeneration = new Date().toISOString();
    records.recentOperations.unshift({
      id: generateId(),
      type: 'pdf',
      date: new Date().toISOString(),
      imageCount: data.imageCount || 0,
      pageSize: data.pageSize || 'a4',
      orientation: data.orientation || 'portrait',
    });
    if (records.recentOperations.length > 20) {
      records.recentOperations = records.recentOperations.slice(0, 20);
    }
  }
  saveRecords(records);
  return records;
};

export const clearRecords = () => {
  const fresh = { ...DEFAULT_RECORDS, firstUse: new Date().toISOString() };
  saveRecords(fresh);
  return fresh;
};

/* Session */
export const getSession = () => safeParse(localStorage.getItem(KEYS.SESSION), null);

export const saveSession = (meta) => {
  try {
    localStorage.setItem(KEYS.SESSION, JSON.stringify(meta));
  } catch (e) {
    console.warn('Session save failed:', e);
  }
};

/* Full wipe */
export const wipeAllStorage = () => {
  try {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Storage wipe failed:', e);
  }
};