import { updateSetting, getSettings } from './storage.js';

const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

let currentMode = 'auto';

const resolveTheme = (mode) => {
  if (mode === 'auto') return MEDIA.matches ? 'dark' : 'light';
  return mode;
};

const applyTheme = (mode) => {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0b0e14' : '#f4f6fa');
  }
};

export const initTheme = () => {
  const settings = getSettings();
  currentMode = settings.theme || 'auto';
  applyTheme(currentMode);

  // Respond to system changes when in auto mode
  MEDIA.addEventListener('change', () => {
    if (currentMode === 'auto') applyTheme('auto');
  });
};

export const setTheme = (mode) => {
  currentMode = mode;
  applyTheme(mode);
  updateSetting('theme', mode);
};

export const getCurrentTheme = () => currentMode;

export const toggleTheme = () => {
  const resolved = resolveTheme(currentMode);
  const next = resolved === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};