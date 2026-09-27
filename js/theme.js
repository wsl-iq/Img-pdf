/**
 * theme
 * Dark/light/auto theme management.
 */

(function () {
  'use strict';

  var App = window.App;
  var MEDIA = window.matchMedia('(prefers-color-scheme: dark)');
  var currentMode = 'auto';

  function resolve(mode) {
    if (mode === 'auto') return MEDIA.matches ? 'dark' : 'light';
    return mode;
  }

  function apply(mode) {
    var r = resolve(mode);
    document.documentElement.setAttribute('data-theme', r);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', r === 'dark' ? '#0b0e14' : '#f4f6fa');
  }

  App.Theme = {
    init: function () {
      var s = App.Storage.getSettings();
      currentMode = s.theme || 'auto';
      apply(currentMode);
      MEDIA.addEventListener('change', function () {
        if (currentMode === 'auto') apply('auto');
      });
    },

    set: function (mode) {
      currentMode = mode;
      apply(mode);
      var s = App.Storage.getSettings();
      s.theme = mode;
      App.Storage.saveSettings(s);
    },

    toggle: function () {
      var r = resolve(currentMode);
      var next = r === 'dark' ? 'light' : 'dark';
      this.set(next);
      return next;
    },

    current: function () { return currentMode; }
  };

  console.log('[theme] loaded');
})();