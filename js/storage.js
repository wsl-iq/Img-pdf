/**
 * storage
 * LocalStorage settings and records.
 */

(function () {
  'use strict';

  var App = window.App;

  var KEYS = {
    SETTINGS: 'img2pdf_settings',
    RECORDS: 'img2pdf_records',
    SESSION: 'img2pdf_session_meta'
  };

  var DEFAULT_SETTINGS = {
    theme: 'auto',
    font: 'cairo',
    pageSize: 'a4',
    orientation: 'portrait',
    margin: 'small',
    quality: '0.85',
    haptics: true,
    compression: 'balanced',
    pageNumbers: false
  };

  var DEFAULT_RECORDS = {
    totalPdfs: 0,
    totalImages: 0,
    lastGeneration: null,
    recentOperations: [],
    firstUse: new Date().toISOString()
  };

  function safeParse(str, fallback) {
    try { return str ? JSON.parse(str) : fallback; } catch (e) { return fallback; }
  }

  App.Storage = {
    getSettings: function () {
      var raw = localStorage.getItem(KEYS.SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, safeParse(raw, {}));
    },

    saveSettings: function (s) {
      try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s)); } catch (e) {}
    },

    getRecords: function () {
      var raw = localStorage.getItem(KEYS.RECORDS);
      return Object.assign({}, DEFAULT_RECORDS, safeParse(raw, {}));
    },

    saveRecords: function (r) {
      try { localStorage.setItem(KEYS.RECORDS, JSON.stringify(r)); } catch (e) {}
    },

    addRecord: function (type, data) {
      data = data || {};
      var records = this.getRecords();
      if (type === 'pdf_generated') {
        records.totalPdfs += 1;
        records.totalImages += data.imageCount || 0;
        records.lastGeneration = new Date().toISOString();
        records.recentOperations.unshift({
          id: App.Utils.generateId(),
          type: 'pdf',
          date: new Date().toISOString(),
          imageCount: data.imageCount || 0,
          pageSize: data.pageSize || 'a4',
          orientation: data.orientation || 'portrait'
        });
        if (records.recentOperations.length > 50) {
          records.recentOperations = records.recentOperations.slice(0, 50);
        }
      }
      this.saveRecords(records);
      return records;
    },

    clearRecords: function () {
      var fresh = Object.assign({}, DEFAULT_RECORDS, { firstUse: new Date().toISOString() });
      this.saveRecords(fresh);
      return fresh;
    },

    saveSession: function (meta) {
      try { localStorage.setItem(KEYS.SESSION, JSON.stringify(meta)); } catch (e) {}
    },

    wipeAllStorage: function () {
      try {
        Object.keys(KEYS).forEach(function (k) {
          localStorage.removeItem(KEYS[k]);
        });
      } catch (e) {}
    }
  };

  console.log('[storage] loaded');
})();