/**
 * haptics
 * Vibration feedback for touch devices.
 */

(function () {
  'use strict';

  var App = window.App;
  var enabled = true;

  function canVibrate() {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  function vibrate(pattern) {
    if (!enabled || !canVibrate()) return;
    try { navigator.vibrate(pattern); } catch (e) {}
  }

  App.Haptics = {
    set: function (v) { enabled = !!v; },
    get: function () { return enabled; },
    tap: function () { vibrate(10); },
    light: function () { vibrate(8); },
    medium: function () { vibrate(20); },
    heavy: function () { vibrate(40); },
    success: function () { vibrate([15, 40, 15]); },
    error: function () { vibrate([50, 30, 50]); },
    warning: function () { vibrate([30, 40, 30]); }
  };

  console.log('[haptics] loaded');
})();