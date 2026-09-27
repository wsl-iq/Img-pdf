/**
 * history
 * Undo / Redo stack for image order and settings snapshots.
 */

(function () {
  'use strict';

  var App = window.App;
  var MAX_HISTORY = 50;
  var undoStack = [];
  var redoStack = [];
  var currentSnapshot = null;
  var listeners = [];

  function snapshot(state, label) {
    return {
      ts: Date.now(),
      order: state.order ? state.order.slice() : [],
      settings: Object.assign({}, state.settings || {}),
      label: label || ''
    };
  }

  function notify() {
    var state = { canUndo: canUndo(), canRedo: canRedo() };
    listeners.forEach(function (cb) {
      try { cb(state); } catch (e) {}
    });
  }

  function canUndo() {
    return undoStack.length > 1;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  App.History = {
    push: function (state, label) {
      var snap = snapshot(state, label);
      undoStack.push(snap);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
      currentSnapshot = snap;
      notify();
    },

    undo: function () {
      if (undoStack.length <= 1) return null;
      var current = undoStack.pop();
      redoStack.push(current);
      currentSnapshot = undoStack[undoStack.length - 1];
      notify();
      return currentSnapshot;
    },

    redo: function () {
      if (redoStack.length === 0) return null;
      var snap = redoStack.pop();
      undoStack.push(snap);
      currentSnapshot = snap;
      notify();
      return snap;
    },

    current: function () {
      return currentSnapshot;
    },

    canUndo: canUndo,
    canRedo: canRedo,

    onChange: function (cb) {
      listeners.push(cb);
      return function () {
        listeners = listeners.filter(function (l) { return l !== cb; });
      };
    },

    reset: function () {
      undoStack = [];
      redoStack = [];
      currentSnapshot = null;
      notify();
    }
  };

  console.log('[history] loaded');
})();