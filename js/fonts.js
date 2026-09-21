import { updateSetting, getSettings } from './storage.js';

const FONT_MAP = {
  cairo: {
    family: 'Cairo',
    url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
  },
  tajawal: {
    family: 'Tajawal',
    url: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap',
  },
  noto: {
    family: 'Noto Kufi Arabic',
    url: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700&display=swap',
  },
  system: { family: null, url: null },
};

const loadedFonts = new Set();

const loadFont = (key) => {
  const cfg = FONT_MAP[key];
  if (!cfg || !cfg.url || loadedFonts.has(key)) return;
  const link = document.getElementById('fontLink');
  if (link) {
    link.href = cfg.url;
    loadedFonts.add(key);
  }
};

const applyFont = (key) => {
  document.documentElement.setAttribute('data-font', key);
  loadFont(key);
};

export const initFont = () => {
  const settings = getSettings();
  const key = settings.font || 'cairo';
  applyFont(key);
};

export const setFont = (key) => {
  if (!FONT_MAP[key]) return;
  applyFont(key);
  updateSetting('font', key);
};

export const getCurrentFont = () => getSettings().font || 'cairo';