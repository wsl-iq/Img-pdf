/**
 * fonts
 * Dynamic font family loader.
 */

(function () {
  'use strict';

  var App = window.App;

  var MAP = {
    cairo: { url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap' },
    tajawal: { url: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap' },
    noto: { url: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700&display=swap' },
    system: { url: null }
  };

  var loaded = {};

  function apply(key) {
    document.documentElement.setAttribute('data-font', key);
    var cfg = MAP[key];
    if (!cfg || !cfg.url || loaded[key]) return;
    var link = document.getElementById('fontLink');
    if (link) {
      link.href = cfg.url;
      loaded[key] = true;
    }
  }

  App.Fonts = {
    init: function () {
      var s = App.Storage.getSettings();
      apply(s.font || 'cairo');
    },

    set: function (key) {
      if (!MAP[key]) return;
      apply(key);
      var s = App.Storage.getSettings();
      s.font = key;
      App.Storage.saveSettings(s);
    }
  };

  console.log('[fonts] loaded');
})();