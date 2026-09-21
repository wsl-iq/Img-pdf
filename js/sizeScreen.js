export const BREAKPOINTS = {
  MOBILE: { min: 0, max: 599, name: 'mobile' },
  IPAD:   { min: 600, max: 1199, name: 'ipad' },
  COMPUTER: { min: 1200, max: Infinity, name: 'computer' },
};

let currentDevice = 'mobile';
const listeners = new Set();

/* Detect the device type based on width */
const detectDevice = (width) => {
  if (width < 600) return 'mobile';
  if (width < 1200) return 'ipad';
  return 'computer';
};

/* Additional device details */
export const getDeviceInfo = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const device = detectDevice(width);

  return {
    device,
    width,
    height,
    isMobile: device === 'mobile',
    isIpad: device === 'ipad',
    isComputer: device === 'computer',
    isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isPortrait: height > width,
    isLandscape: width > height,
    dpr: window.devicePixelRatio || 1,
  };
};

/* Get the current device name */
export const getCurrentDevice = () => currentDevice;

/* Apply the data-device attribute to <body> */
const applyDeviceAttribute = (device) => {
  if (document.body.dataset.device !== device) {
    document.body.dataset.device = device;
  }
};

/* Notify listeners */
const notifyListeners = (info) => {
  listeners.forEach((cb) => {
    try { cb(info); } catch (e) { console.warn(e); }
  });
};

/* Respond to resize changes */
let resizeTimer = null;
const handleResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const info = getDeviceInfo();
    if (info.device !== currentDevice) {
      currentDevice = info.device;
      applyDeviceAttribute(currentDevice);
    }
    notifyListeners(info);
  }, 100);
};

/* Respond to orientation changes */
const handleOrientationChange = () => {
  setTimeout(() => {
    notifyListeners(getDeviceInfo());
  }, 200);
};

/* Monitor media queries (better performance than frequent resize handling) */
const setupMediaListeners = () => {
  const queries = [
    window.matchMedia('(max-width: 599px)'),
    window.matchMedia('(min-width: 600px) and (max-width: 1199px)'),
    window.matchMedia('(min-width: 1200px)'),
  ];

  queries.forEach((q) => {
    const handler = () => {
      const info = getDeviceInfo();
      if (info.device !== currentDevice) {
        currentDevice = info.device;
        applyDeviceAttribute(currentDevice);
      }
      notifyListeners(info);
    };

    if (q.addEventListener) {
      q.addEventListener('change', handler);
    } else if (q.addListener) {
      q.addListener(handler);
    }
  });
};

/* Initialization */
export const initSizeScreen = () => {
  const info = getDeviceInfo();
  currentDevice = info.device;
  applyDeviceAttribute(currentDevice);

  setupMediaListeners();

  // Fallback: monitor resize for older devices
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
};

/* Subscribe to device changes */
export const onDeviceChange = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/* Does the current device match this type? */
export const isDevice = (type) => currentDevice === type;