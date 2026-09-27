/**
 * idb
 * IndexedDB session persistence.
 */

(function () {
  'use strict';

  var App = window.App;

  var DB_NAME = 'img2pdf_db';
  var DB_VERSION = 1;
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  App.IDB = {
    saveSessionImages: function (items) {
      return openDB().then(function (db) {
        if (!items.length) {
          var ctx0 = db.transaction('sessions', 'readwrite');
          ctx0.objectStore('sessions').clear();
          return true;
        }
        var tx = db.transaction('sessions', 'readwrite');
        var store = tx.objectStore('sessions');
        store.clear();
        items.forEach(function (item) {
          var blob = item.file instanceof Blob ? item.file : null;
          if (blob) {
            store.put({
              id: item.id,
              name: item.name,
              size: item.size,
              width: item.width,
              height: item.height,
              type: item.type,
              blob: blob,
              transforms: item.transforms || null
            });
          }
        });
        return new Promise(function (resolve) {
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        });
      }).catch(function () { return false; });
    },

    loadSessionImages: function () {
      return openDB().then(function (db) {
        var tx = db.transaction('sessions', 'readonly');
        return reqToPromise(tx.objectStore('sessions').getAll());
      }).then(function (rows) {
        return rows.map(function (row) {
          return {
            id: row.id,
            file: new File([row.blob], row.name, { type: row.type }),
            url: URL.createObjectURL(row.blob),
            name: row.name,
            size: row.size,
            width: row.width,
            height: row.height,
            type: row.type,
            transforms: row.transforms || null
          };
        });
      }).catch(function () { return []; });
    },

    clearSessionImages: function () {
      return openDB().then(function (db) {
        var tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').clear();
        return new Promise(function (resolve) {
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        });
      }).catch(function () { return false; });
    },

    wipeDB: function () {
      return openDB().then(function (db) {
        db.close();
        dbPromise = null;
        return new Promise(function (resolve) {
          var req = indexedDB.deleteDatabase(DB_NAME);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      }).catch(function () {});
    }
  };

  console.log('[idb] loaded');
})();