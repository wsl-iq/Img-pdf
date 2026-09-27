/**
 * docx
 * Word export via HTML-based .doc format.
 */

(function () {
  'use strict';

  var App = window.App;

  function blobToDataURL(blob) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result); };
      reader.readAsDataURL(blob);
    });
  }

  App.Docx = {
    export: function (items) {
      var chain = Promise.resolve();
      var parts = [];

      items.forEach(function (item, idx) {
        chain = chain.then(function () {
          return blobToDataURL(item.file).then(function (dataUrl) {
            parts.push(
              '<div style="page-break-after: always; text-align:center; padding:20px;">' +
              '<img src="' + dataUrl + '" style="max-width:100%; max-height:700px;" alt="image ' + (idx + 1) + '">' +
              '</div>'
            );
          });
        });
      });

      return chain.then(function () {
        var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
          'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
          'xmlns="http://www.w3.org/TR/REC-html40">' +
          '<head><meta charset="utf-8"><title>Images</title></head>' +
          '<body>' + parts.join('') + '</body></html>';

        var blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'images-' + Date.now() + '.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      });
    }
  };

  console.log('[docx] loaded');
})();