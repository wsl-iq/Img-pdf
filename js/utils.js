/**
 * utils
 * Pure helper functions.
 */

(function () {
  'use strict';

  var App = window.App;

  App.Utils = {
    formatBytes: function (bytes) {
      if (bytes === 0) return '0 B';
      var k = 1024;
      var sizes = ['B', 'KB', 'MB', 'GB'];
      var i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    formatDate: function (isoString) {
      if (!isoString) return '-';
      try {
        var d = new Date(isoString);
        return d.toLocaleDateString('ar-EG', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      } catch (e) {
        return '-';
      }
    },

    generateId: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    loadImage: function (url) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('image load failed')); };
        img.src = url;
      });
    },

    escapeHtml: function (str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  };

  console.log('[utils] loaded');
})();