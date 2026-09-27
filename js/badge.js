/**
 * badge
 * App icon badge API.
 */

(function () {
  'use strict';

  var App = window.App;

  App.Badge = {
    set: function (count) {
      if (!('setAppBadge' in navigator)) return Promise.resolve();
      try {
        if (count > 0) return navigator.setAppBadge(count);
        return navigator.clearAppBadge();
      } catch (e) {
        return Promise.resolve();
      }
    },

    clear: function () {
      if (!('clearAppBadge' in navigator)) return Promise.resolve();
      try {
        return navigator.clearAppBadge();
      } catch (e) {
        return Promise.resolve();
      }
    }
  };

  console.log('[badge] loaded');
})();