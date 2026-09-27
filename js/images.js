/**
 * images
 * In-memory collection of selected images.
 */

(function () {
  'use strict';

  var App = window.App;
  var Utils = App.Utils;

  var SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  var MAX_IMAGES = 100;
  var MAX_FILE_SIZE = 50 * 1024 * 1024;

  var items = [];

  function validate(file) {
    if (!file || !file.type) {
      return { valid: false, reason: 'ملف غير صالح' };
    }
    if (SUPPORTED.indexOf(file.type) === -1) {
      return { valid: false, reason: 'صيغة غير مدعومة' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, reason: 'حجم كبير جدا (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)' };
    }
    return { valid: true };
  }

  function buildItem(file, url, img) {
    return {
      id: Utils.generateId(),
      file: file,
      url: url,
      name: file.name,
      size: file.size,
      width: img.naturalWidth,
      height: img.naturalHeight,
      type: file.type,
      transforms: null
    };
  }

  App.Images = {
    SUPPORTED: SUPPORTED,
    MAX: MAX_IMAGES,

    addFiles: function (fileList) {
      var files = Array.prototype.slice.call(fileList);
      var results = { added: 0, rejected: [] };

      if (items.length >= MAX_IMAGES) {
        results.rejected.push({
          name: 'الحد الأقصى',
          reason: 'لا يمكن إضافة أكثر من ' + MAX_IMAGES + ' صورة'
        });
        return Promise.resolve(results);
      }

      var remaining = MAX_IMAGES - items.length;
      var toProcess = files.slice(0, remaining);

      if (files.length > remaining) {
        results.rejected.push({
          name: 'ملفات إضافية',
          reason: 'تم تجاهل ' + (files.length - remaining) + ' ملف'
        });
      }

      var chain = Promise.resolve();

      toProcess.forEach(function (file) {
        chain = chain.then(function () {
          var v = validate(file);
          if (!v.valid) {
            results.rejected.push({ name: file.name, reason: v.reason });
            return;
          }
          var url = URL.createObjectURL(file);
          return Utils.loadImage(url).then(function (img) {
            items.push(buildItem(file, url, img));
            results.added++;
          }).catch(function () {
            URL.revokeObjectURL(url);
            results.rejected.push({ name: file.name, reason: 'فشل القراءة' });
          });
        });
      });

      return chain.then(function () {
        return results;
      });
    },

    remove: function (id) {
      var idx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { idx = i; break; }
      }
      if (idx === -1) return false;
      URL.revokeObjectURL(items[idx].url);
      items.splice(idx, 1);
      return true;
    },

    clearAll: function () {
      items.forEach(function (item) {
        URL.revokeObjectURL(item.url);
      });
      items = [];
    },

    move: function (fromIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= items.length) return false;
      if (toIndex < 0 || toIndex >= items.length) return false;
      if (fromIndex === toIndex) return false;
      var moved = items.splice(fromIndex, 1)[0];
      items.splice(toIndex, 0, moved);
      return true;
    },

    moveUp: function (id) {
      var idx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { idx = i; break; }
      }
      return idx > 0 ? this.move(idx, idx - 1) : false;
    },

    moveDown: function (id) {
      var idx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { idx = i; break; }
      }
      return idx >= 0 && idx < items.length - 1 ? this.move(idx, idx + 1) : false;
    },

    updateTransforms: function (id, transforms) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) {
          items[i].transforms = transforms;
          return;
        }
      }
    },

    getAll: function () {
      return items.slice();
    },

    getById: function (id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    },

    count: function () {
      return items.length;
    },

    restoreItem: function (item) {
      items.push(item);
    },

    replaceAll: function (newItems) {
      items = newItems;
    },

    cleanup: function () {
      items.forEach(function (item) {
        URL.revokeObjectURL(item.url);
      });
    }
  };

  console.log('[images] loaded');
})();