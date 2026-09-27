/**
 * exportImport
 * JSON settings export and import.
 */

(function () {
  'use strict';

  var App = window.App;

  App.ExportImport = {
    export: function () {
      var data = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        settings: App.Storage.getSettings(),
        records: App.Storage.getRecords()
      };

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'img2pdf-settings-' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    },

    import: function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var data = JSON.parse(e.target.result);
            if (data.settings) App.Storage.saveSettings(data.settings);
            if (data.records) App.Storage.saveRecords(data.records);
            resolve(data);
          } catch (err) {
            reject(new Error('invalid file'));
          }
        };
        reader.onerror = function () { reject(new Error('read failed')); };
        reader.readAsText(file);
      });
    }
  };

  console.log('[exportImport] loaded');
})();