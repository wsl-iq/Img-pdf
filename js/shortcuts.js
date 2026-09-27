/**
 * shortcuts
 * Keyboard shortcut manager.
 */

(function () {
  'use strict';

  var App = window.App;
  var handlers = {};

  function buildCombo(e) {
    var parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  function onKeyDown(e) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    var combo = buildCombo(e);
    var handler = handlers[combo];
    if (!handler) return;

    e.preventDefault();
    try { handler.fn(e); } catch (err) {}
  }

  App.Shortcuts = {
    init: function () {
      window.addEventListener('keydown', onKeyDown);
    },

    register: function (combo, fn, description) {
      handlers[combo.toLowerCase()] = {
        fn: fn,
        description: description || ''
      };
    },

    unregister: function (combo) {
      delete handlers[combo.toLowerCase()];
    },

    clearAll: function () {
      handlers = {};
    },

    getAll: function () {
      return Object.keys(handlers).map(function (key) {
        return {
          combo: key,
          description: handlers[key].description
        };
      });
    }
  };

  console.log('[shortcuts] loaded');
})();